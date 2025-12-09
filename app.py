import os
from io import BytesIO

import cv2
import numpy as np
from flask import (
    Flask, render_template, request,
    jsonify, send_file, session
)
import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2 import Binary

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
UPLOAD_DIR = os.path.join(STATIC_DIR, "uploads")

CASCADE_PATH = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
face_cascade = cv2.CascadeClassifier(CASCADE_PATH)

app = Flask(__name__)
app.secret_key = "FRASS_SECRET_KEY_CHANGE_ME"   # for sessions

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL environment variable not set")


# ------------------------ DB HELPERS ------------------------ #

def get_db_connection():
    """
    Open a new connection to PostgreSQL using DATABASE_URL.
    Returns a connection with RealDictCursor so rows behave like dicts.
    """
    conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
    return conn


def init_db():
    os.makedirs(UPLOAD_DIR, exist_ok=True)

    conn = get_db_connection()
    cur = conn.cursor()

    # USERS TABLE
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id        SERIAL PRIMARY KEY,
            email     TEXT UNIQUE NOT NULL,
            password  TEXT NOT NULL
        )
        """
    )

    # STUDENTS TABLE (serial, roll, name, course, branch, image, face_id)
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS students (
            id         SERIAL PRIMARY KEY,
            roll_no    TEXT NOT NULL,
            name       TEXT,
            course     TEXT,
            branch     TEXT,
            image_path TEXT,
            face_id    TEXT
        )
        """
    )

    # default auto user (ignore if already exists)
    cur.execute(
        """
        INSERT INTO users (email, password)
        VALUES (%s, %s)
        ON CONFLICT (email) DO NOTHING
        """,
        ("admin@frass.com", "admin123")
    )
    
    # Ensure photo_data column exists for storing image bytes
    cur.execute(
        """
        ALTER TABLE students
        ADD COLUMN IF NOT EXISTS photo_data BYTEA
        """
    )
    conn.commit()
    conn.close()

def extract_face_vector(image_bgr):
    """
    Detects the largest face in the image (if any), converts to grayscale,
    resizes, flattens and normalizes to a 1D vector.

    If no face is detected, falls back to the whole image instead of
    returning None – this avoids "always first student" behaviour when
    detection fails.
    """
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)

    faces = face_cascade.detectMultiScale(
        gray,
        scaleFactor=1.2,
        minNeighbors=5,
        minSize=(60, 60)
    )

    if len(faces) > 0:
        # pick the largest detected face
        x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
        patch = gray[y:y + h, x:x + w]
    else:
        # fallback: use entire image (still better than "no vector")
        patch = gray

    patch = cv2.resize(patch, (96, 96))
    vec = patch.astype("float32").ravel()
    norm = np.linalg.norm(vec)
    if norm > 0:
        vec /= norm
    return vec
    
def setup():
    init_db()


# run DB init when app module is imported
setup()


# ------------------------ ROUTES ------------------------ #

@app.route("/")
def home():
    return render_template("main.html")


# ---------- AUTH: SIGNUP & LOGIN ---------- #

@app.route("/api/signup", methods=["POST"])
def signup():
    email = request.form.get("email", "").strip()
    password = request.form.get("password", "").strip()

    if not email or not password:
        return jsonify({"status": "error", "message": "Email and password required"})

    conn = get_db_connection()
    cur = conn.cursor()

    try:
        cur.execute(
            "INSERT INTO users (email, password) VALUES (%s, %s)",
            (email, password)
        )
        conn.commit()
    except psycopg2.errors.UniqueViolation:
        conn.rollback()
        conn.close()
        return jsonify({"status": "error", "message": "Email already registered"})
    except psycopg2.Error:
        conn.rollback()
        conn.close()
        return jsonify({"status": "error", "message": "Database error"})
    conn.close()

    return jsonify({"status": "success", "message": "User registered successfully"})


@app.route("/api/login", methods=["POST"])
def login():
    email = request.form.get("email", "").strip()
    password = request.form.get("password", "").strip()

    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT * FROM users
        WHERE LOWER(email) = LOWER(%s)
          AND LOWER(password) = LOWER(%s)
        """,
        (email, password)
    )
    user = cur.fetchone()
    conn.close()

    if user:
        session["logged_in"] = True
        session["user_email"] = email
        return jsonify({"status": "success"})
    else:
        return jsonify({"status": "error", "message": "Invalid email or password"})


@app.route("/api/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"status": "success"})


# ---------- STUDENT CRUD ---------- #

@app.route("/api/students", methods=["GET"])
def get_students():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT id, roll_no, name, course, branch, image_path, face_id
        FROM students
        ORDER BY id ASC
        """
    )
    rows = cur.fetchall()
    conn.close()
    # rows are already dicts because of RealDictCursor
    return jsonify(rows)


@app.route("/api/save_student", methods=["POST"])
def save_student():
    roll_no = request.form.get("roll_no", "").strip()
    name = request.form.get("name", "").strip()
    course = request.form.get("course", "").strip()
    branch = request.form.get("branch", "").strip()

    if not roll_no:
        return jsonify({"status": "error", "message": "Roll Number is required"})

    conn = get_db_connection()
    cur = conn.cursor()

    # Check if the roll number already exists
    cur.execute("SELECT * FROM students WHERE roll_no = %s", (roll_no,))
    existing = cur.fetchone()

    photo = request.files.get("photo")
    image_path = None
    photo_bytes = None

    if photo and photo.filename:
        # read uploaded bytes
        raw = photo.read()
        file_arr = np.frombuffer(raw, np.uint8)
        img = cv2.imdecode(file_arr, cv2.IMREAD_COLOR)

        if img is not None:
            # normalize & store as PNG in DB
            ok, buffer = cv2.imencode(".png", img)
            if ok:
                photo_bytes = buffer.tobytes()
                # optional: also save to filesystem for this deployment
                filename = f"{roll_no}.png"
                full_path = os.path.join(UPLOAD_DIR, filename)
                os.makedirs(os.path.dirname(full_path), exist_ok=True)
                with open(full_path, "wb") as f:
                    f.write(photo_bytes)
                image_path = f"uploads/{filename}"
                
    # face_id = roll_no in this basic version
    face_id = roll_no

    if existing:
        # UPDATE only fields that are provided
        update_fields = []
        update_values = []

        if name:
            update_fields.append("name = %s")
            update_values.append(name)

        if course:
            update_fields.append("course = %s")
            update_values.append(course)

        if branch:
            update_fields.append("branch = %s")
            update_values.append(branch)

        if image_path:
            update_fields.append("image_path = %s")
            update_values.append(image_path)

        update_fields.append("face_id = %s")
        update_values.append(face_id)

        if photo_bytes is not None:
            update_fields.append("photo_data = %s")
            update_values.append(Binary(photo_bytes))

        if update_fields:
            update_values.append(roll_no)
            sql = f"UPDATE students SET {', '.join(update_fields)} WHERE roll_no = %s"
            cur.execute(sql, update_values)
            conn.commit()

        conn.close()
        return jsonify({"status": "success", "message": "Student updated successfully"})

    # INSERT new student
    cur.execute(
        """
        INSERT INTO students (roll_no, name, course, branch, image_path, face_id, photo_data)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        """,
        (roll_no, name, course, branch, image_path, face_id,
         Binary(photo_bytes) if photo_bytes is not None else None)
    )
    conn.commit()
    conn.close()
    return jsonify({"status": "success", "message": "Student added successfully"})


@app.route("/api/delete_student", methods=["POST"])
def delete_student():
    roll_no = request.form.get("roll_no", "").strip()

    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM students WHERE roll_no = %s", (roll_no,))
    conn.commit()
    deleted = cur.rowcount
    conn.close()

    if deleted > 0:
        return jsonify({"status": "success", "message": "Student deleted successfully"})
    else:
        return jsonify({"status": "error", "message": "No student with that Roll Number"})


# ---------- LOOKUP BY face_id (for future OpenCV) ---------- #

@app.route("/api/student_by_face/<face_id>", methods=["GET"])
def student_by_face(face_id):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM students WHERE face_id = %s", (face_id,))
    row = cur.fetchone()
    conn.close()
    if row:
        return jsonify(row)
    return jsonify({"status": "error", "message": "No student found"}), 404


# ---------- OPENCV ROUTE ---------- #

@app.route("/api/scan_face", methods=["POST"])
def scan_face():
    file = request.files.get("image")
    if not file:
        return jsonify({"status": "error", "message": "No file uploaded"}), 400

    file_bytes = np.frombuffer(file.read(), np.uint8)
    img = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
    if img is None:
        return jsonify({"status": "error", "message": "Invalid image"}), 400

    # vector for incoming scan
    target_vec = extract_face_vector(img)

    # students with stored photo_data
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT id, roll_no, name, course, branch, photo_data "
        "FROM students WHERE photo_data IS NOT NULL"
    )
    students = cur.fetchall()
    conn.close()

    best_student = None
    best_dist = None

    for s in students:
        data = s.get("photo_data")
        if not data:
            continue

        arr = np.frombuffer(data, np.uint8)
        ref_img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if ref_img is None:
            continue

        ref_vec = extract_face_vector(ref_img)
        dist = float(np.linalg.norm(target_vec - ref_vec))

        if best_dist is None or dist < best_dist:
            best_dist = dist
            best_student = {
                "id": s["id"],
                "roll_no": s["roll_no"],
                "name": s["name"],
                "course": s["course"],
                "branch": s["branch"],
                "image_path": s.get("image_path"),
            }

    THRESHOLD = 0.55

    if best_student is None or best_dist is None or best_dist > THRESHOLD:
        return jsonify({
            "status": "error",
            "message": "No matching student found",
            "score": best_dist
        })

    return jsonify({
        "status": "success",
        "student": best_student,
        "score": best_dist
    })

@app.route("/api/student_photo/<int:sid>")
def student_photo(sid):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT photo_data FROM students WHERE id = %s", (sid,))
    row = cur.fetchone()
    conn.close()

    if not row or not row.get("photo_data"):
        return "", 404

    data = row["photo_data"]
    return send_file(BytesIO(data), mimetype="image/png")
    
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)

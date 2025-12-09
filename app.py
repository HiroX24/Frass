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

# -------------------------------------------------------
# PATH CONFIG
# -------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
UPLOAD_DIR = os.path.join(STATIC_DIR, "uploads")

CASCADE_PATH = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
face_cascade = cv2.CascadeClassifier(CASCADE_PATH)

app = Flask(__name__)
app.secret_key = "FRASS_SECRET_KEY_CHANGE_ME"

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL environment variable not set")


# -------------------------------------------------------
# DB HELPERS
# -------------------------------------------------------
def get_db_connection():
    conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
    return conn


def init_db():
    os.makedirs(UPLOAD_DIR, exist_ok=True)

    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        )
        """
    )

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS students (
            id SERIAL PRIMARY KEY,
            roll_no TEXT NOT NULL,
            name TEXT,
            course TEXT,
            branch TEXT,
            image_path TEXT,
            face_id TEXT
        )
        """
    )

    cur.execute(
        """
        INSERT INTO users (email, password)
        VALUES (%s, %s)
        ON CONFLICT (email) DO NOTHING
        """,
        ("admin@frass.com", "admin123")
    )

    cur.execute(
        "ALTER TABLE students ADD COLUMN IF NOT EXISTS photo_data BYTEA"
    )
    cur.execute(
        "ALTER TABLE students ADD COLUMN IF NOT EXISTS face_vec BYTEA"
    )

    conn.commit()
    conn.close()


def extract_face_vector(image_bgr):
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)

    faces = face_cascade.detectMultiScale(
        gray, scaleFactor=1.2, minNeighbors=5, minSize=(60, 60)
    )

    if len(faces) == 0:
        return None

    x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
    face = gray[y:y + h, x:x + w]

    face_resized = cv2.resize(face, (96, 96))

    vec = face_resized.astype("float32").ravel()
    norm = np.linalg.norm(vec)
    if norm > 0:
        vec /= norm
    return vec


# Run DB migration once
init_db()


# -------------------------------------------------------
# ROUTES
# -------------------------------------------------------
@app.route("/")
def home():
    return render_template("main.html")


# ------------------ AUTH ------------------
@app.route("/api/signup", methods=["POST"])
def signup():
    email = request.form.get("email", "").strip()
    password = request.form.get("password", "").strip()

    if not email or not password:
        return jsonify({"status": "error", "message": "Email and password required"})

    conn = get_db_connection()
    cur = conn.cursor()

    try:
        cur.execute("INSERT INTO users (email, password) VALUES (%s, %s)",
                    (email, password))
        conn.commit()
    except psycopg2.errors.UniqueViolation:
        conn.rollback()
        conn.close()
        return jsonify({"status": "error", "message": "Email already registered"})
    finally:
        conn.close()

    return jsonify({"status": "success", "message": "Account created"})


@app.route("/api/login", methods=["POST"])
def login():
    email = request.form.get("email", "").strip()
    password = request.form.get("password", "").strip()

    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT * FROM users WHERE LOWER(email)=LOWER(%s) AND LOWER(password)=LOWER(%s)",
        (email, password)
    )
    user = cur.fetchone()
    conn.close()

    if user:
        session["logged_in"] = True
        session["user_email"] = email
        return jsonify({"status": "success"})

    return jsonify({"status": "error", "message": "Invalid credentials"})


@app.route("/api/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"status": "success"})


# ------------------ STUDENTS CRUD ------------------
@app.route("/api/students", methods=["GET"])
def get_students():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT id, roll_no, name, course, branch, image_path
        FROM students ORDER BY id ASC
        """
    )
    rows = cur.fetchall()
    conn.close()
    return jsonify(rows)


@app.route("/api/save_student", methods=["POST"])
def save_student():
    roll_no = request.form.get("roll_no", "").strip()
    name = request.form.get("name", "").strip()
    course = request.form.get("course", "").strip()
    branch = request.form.get("branch", "").strip()

    if not roll_no:
        return jsonify({"status": "error", "message": "Roll Number required"})

    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM students WHERE roll_no=%s", (roll_no,))
    existing = cur.fetchone()

    photo = request.files.get("photo")
    image_path = None
    photo_bytes = None
    face_vec_bytes = None

    if photo and photo.filename:
        raw = photo.read()
        img = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)
        if img is None:
            return jsonify({"status": "error", "message": "Invalid image"})

        vec = extract_face_vector(img)
        if vec is None:
            return jsonify({"status": "error",
                            "message": "Face not detected. Upload a clear face image."})

        face_vec_bytes = vec.tobytes()

        ok, buffer = cv2.imencode(".png", img)
        if ok:
            photo_bytes = buffer.tobytes()
            filename = f"{roll_no}.png"
            full_path = os.path.join(UPLOAD_DIR, filename)
            with open(full_path, "wb") as f:
                f.write(photo_bytes)
            image_path = f"uploads/{filename}"

    if existing:
        updates = []
        values = []

        if name:
            updates.append("name=%s")
            values.append(name)
        if course:
            updates.append("course=%s")
            values.append(course)
        if branch:
            updates.append("branch=%s")
            values.append(branch)
        if image_path:
            updates.append("image_path=%s")
            values.append(image_path)
        if photo_bytes:
            updates.append("photo_data=%s")
            values.append(Binary(photo_bytes))
        if face_vec_bytes:
            updates.append("face_vec=%s")
            values.append(Binary(face_vec_bytes))

        if updates:
            values.append(roll_no)
            sql = f"UPDATE students SET {', '.join(updates)} WHERE roll_no=%s"
            cur.execute(sql, values)
            conn.commit()

        conn.close()
        return jsonify({"status": "success", "message": "Updated"})

    cur.execute(
        """
        INSERT INTO students (roll_no, name, course, branch, image_path,
                              photo_data, face_vec)
        VALUES (%s,%s,%s,%s,%s,%s,%s)
        """,
        (
            roll_no, name, course, branch,
            image_path,
            Binary(photo_bytes) if photo_bytes else None,
            Binary(face_vec_bytes) if face_vec_bytes else None
        )
    )
    conn.commit()
    conn.close()
    return jsonify({"status": "success", "message": "Added"})


@app.route("/api/delete_student", methods=["POST"])
def delete_student():
    roll_no = request.form.get("roll_no", "").strip()

    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM students WHERE roll_no=%s", (roll_no,))
    conn.commit()
    deleted = cur.rowcount
    conn.close()

    if deleted > 0:
        return jsonify({"status": "success"})
    return jsonify({"status": "error", "message": "Roll not found"})


# ------------------ FACE MATCH ------------------
@app.route("/api/scan_face", methods=["POST"])
def scan_face():
    file = request.files.get("image")
    if not file:
        return jsonify({"status": "error", "message": "No file uploaded"}), 400

    file_bytes = np.frombuffer(file.read(), np.uint8)
    img = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
    if img is None:
        return jsonify({"status": "error", "message": "Invalid image"}), 400

    # 1) vector for the incoming scan
    target_vec = extract_face_vector(img)
    if target_vec is None:
        return jsonify({"status": "error", "message": "No face detected in scan"}), 400

    # 2) students with stored face_vec
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT id, roll_no, name, course, branch, image_path, face_vec
        FROM students
        WHERE face_vec IS NOT NULL
        """
    )
    students = cur.fetchall()
    conn.close()

    best_student = None
    best_dist = None

    for s in students:
        vec_bytes = s.get("face_vec")
        if not vec_bytes:
            continue

        vec_db = np.frombuffer(vec_bytes, dtype="float32")
        if vec_db.size == 0:
            continue

        dist = float(np.linalg.norm(target_vec - vec_db))

        if best_dist is None or dist < best_dist:
            best_dist = dist
            best_student = s

    # 3) more relaxed threshold (you can tune this)
    THRESHOLD = 0.85  # was 0.55

    if best_student is None or best_dist is None:
        return jsonify({
            "status": "error",
            "message": "No enrolled faces to compare",
            "score": best_dist
        }), 404

    if best_dist > THRESHOLD:
        return jsonify({
            "status": "error",
            "message": "No matching student found",
            "score": best_dist
        }), 404

    return jsonify({
        "status": "success",
        "student": best_student,
        "score": best_dist
    })

@app.route("/api/student_photo/<int:sid>")
def student_photo(sid):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT photo_data FROM students WHERE id=%s", (sid,))
    row = cur.fetchone()
    conn.close()

    if not row or not row.get("photo_data"):
        return "", 404

    return send_file(BytesIO(row["photo_data"]), mimetype="image/png")


# -------------------------------------------------------
# RUN
# -------------------------------------------------------
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)

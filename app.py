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

    conn.commit()
    conn.close()


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
    if photo and photo.filename:
        filename = f"{roll_no}.png"
        full_path = os.path.join(UPLOAD_DIR, filename)
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        photo.save(full_path)
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
        INSERT INTO students (roll_no, name, course, branch, image_path, face_id)
        VALUES (%s, %s, %s, %s, %s, %s)
        """,
        (roll_no, name, course, branch, image_path, face_id)
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


# ---------- OPENCV DEMO ROUTE ---------- #

@app.route("/api/process_image", methods=["POST"])
def process_image():
    file = request.files.get("image")
    if not file:
        return "No file uploaded", 400

    file_bytes = np.frombuffer(file.read(), np.uint8)
    img = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
    if img is None:
        return "Invalid image", 400

    # demo: grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    ok, buffer = cv2.imencode(".png", gray)
    if not ok:
        return "Processing error", 500

    io_buf = BytesIO(buffer.tobytes())
    return send_file(io_buf, mimetype="image/png")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)

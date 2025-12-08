import os
import sqlite3
from io import BytesIO

import cv2
import numpy as np
from flask import (
    Flask, render_template, request,
    jsonify, send_file, session
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "frass.db")
UPLOAD_DIR = os.path.join(BASE_DIR, "static", "uploads")

app = Flask(__name__)
app.secret_key = "FRASS_SECRET_KEY_CHANGE_ME"   # for sessions


# ------------------------ DB HELPERS ------------------------ #

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    os.makedirs(UPLOAD_DIR, exist_ok=True)

    conn = get_db_connection()
    cur = conn.cursor()

    # USERS TABLE
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            email     TEXT UNIQUE NOT NULL,
            password  TEXT NOT NULL
        )
        """
    )

    # STUDENTS TABLE (serial, roll, name, course, branch, image, face_id)
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS students (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            roll_no    TEXT NOT NULL,
            name       TEXT NOT NULL,
            course     TEXT NOT NULL,
            branch     TEXT NOT NULL,
            image_path TEXT,
            face_id    TEXT
        )
        """
    )

    # default auto user
    cur.execute(
        """
        INSERT OR IGNORE INTO users (email, password)
        VALUES (?, ?)
        """,
        ("admin@frass.com", "admin123")
    )

    conn.commit()
    conn.close()


# Flask 3 safe: no before_first_request, just call once at import
def setup():
    init_db()


setup()  # run DB init when app module is imported


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
            "INSERT INTO users (email, password) VALUES (?, ?)",
            (email, password)
        )
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({"status": "error", "message": "Email already registered"})
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
        WHERE LOWER(email) = LOWER(?)
          AND LOWER(password) = LOWER(?)
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
        "SELECT id, roll_no, name, course, branch, image_path, face_id "
        "FROM students ORDER BY id ASC"
    )
    rows = cur.fetchall()
    conn.close()
    students = [dict(r) for r in rows]
    return jsonify(students)


@app.route("/api/save_student", methods=["POST"])

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
    cur.execute("SELECT * FROM students WHERE roll_no = ?", (roll_no,))
    existing = cur.fetchone()

    photo = request.files.get("photo")
    image_path = None
    if photo and photo.filename:
        filename = f"{roll_no}.png"
        full_path = os.path.join(UPLOAD_DIR, filename)
        photo.save(full_path)
        image_path = f"uploads/{filename}"

    # If student exists → UPDATE
    if existing:
        update_fields = []
        update_values = []

        if name:
            update_fields.append("name = ?")
            update_values.append(name)

        if course:
            update_fields.append("course = ?")
            update_values.append(course)

        if branch:
            update_fields.append("branch = ?")
            update_values.append(branch)

        if image_path:
            update_fields.append("image_path = ?")
            update_values.append(image_path)

        # Always update face_id = roll_no
        update_fields.append("face_id = ?")
        update_values.append(roll_no)

        if update_fields:
            update_values.append(roll_no)
            cur.execute(
                f"UPDATE students SET {', '.join(update_fields)} WHERE roll_no = ?",
                update_values
            )
            conn.commit()

        conn.close()
        return jsonify({"status": "success", "message": "Student updated successfully"})

    # If not exists → INSERT new
    cur.execute(
        """
        INSERT INTO students (roll_no, name, course, branch, image_path, face_id)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (roll_no, name, course, branch, image_path, roll_no)
    )
    conn.commit()
    conn.close()
    return jsonify({"status": "success", "message": "Student added successfully"})
    
@app.route("/api/delete_student", methods=["POST"])
def delete_student():
    roll_no = request.form.get("roll_no", "").strip()

    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM students WHERE roll_no = ?", (roll_no,))
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
    cur.execute("SELECT * FROM students WHERE face_id = ?", (face_id,))
    row = cur.fetchone()
    conn.close()
    if row:
        return jsonify(dict(row))
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

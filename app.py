import os
import cv2
import numpy as np
from io import BytesIO

from flask import (
    Flask, render_template, request,
    send_file, jsonify, session
)
import mysql.connector

app = Flask(__name__)

# Use env var in production, fallback for local dev
app.secret_key = os.environ.get("SECRET_KEY", "FRASS_DEV_SECRET")

def get_db_connection():
    return mysql.connector.connect(
        host=os.environ.get("DB_HOST", "localhost"),
        user=os.environ.get("DB_USER", "root"),
        password=os.environ.get("DB_PASSWORD", ""),
        database=os.environ.get("DB_NAME", "facerecognition")
    )

# --------------------------------------
# HOME
# --------------------------------------
@app.route('/')
def home():
    return render_template('main.html')

# --------------------------------------
# LOGIN
# --------------------------------------
@app.route('/api/login', methods=['POST'])
def login():
    email = request.form['email']
    password = request.form['password']

    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)
    cur.execute(
        "SELECT * FROM users WHERE email=%s AND password=%s",
        (email, password)
    )
    user = cur.fetchone()
    cur.close()
    conn.close()

    if user:
        session['logged_in'] = True
        return jsonify({"status": "success"})
    else:
        return jsonify({"status": "error", "message": "Invalid Email or Password"})

# --------------------------------------
# SHOW STUDENT TABLE
# --------------------------------------
@app.route('/api/students')
def get_students():
    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)
    cur.execute("SELECT * FROM students")
    students = cur.fetchall()
    cur.close()
    conn.close()
    return jsonify(students)

# --------------------------------------
# ADD / UPDATE STUDENT
# --------------------------------------
@app.route('/api/save_student', methods=['POST'])
def save_student():
    data = request.form
    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute("SELECT student_id FROM students WHERE student_id=%s",
                (data['student_id'],))
    exists = cur.fetchone()

    if exists:
        cur.execute("""
            UPDATE students
            SET roll_no=%s, name=%s, gender=%s, dob=%s,
                contact_no=%s, email=%s, class=%s, section=%s
            WHERE student_id=%s
        """, (
            data['roll_no'], data['name'], data['gender'],
            data['dob'], data['contact_no'], data['email'],
            data['class'], data['section'], data['student_id']
        ))
        msg = "✅ Student Updated Successfully"
    else:
        cur.execute("""
            INSERT INTO students
            (student_id, roll_no, name, gender, dob,
             contact_no, email, class, section)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """, (
            data['student_id'], data['roll_no'], data['name'],
            data['gender'], data['dob'], data['contact_no'],
            data['email'], data['class'], data['section']
        ))
        msg = "✅ Student Added Successfully"

    conn.commit()
    cur.close()
    conn.close()
    return jsonify({"message": msg})

# --------------------------------------
# DELETE STUDENT
# --------------------------------------
@app.route('/api/delete_student', methods=['POST'])
def delete_student():
    roll = request.form['roll_no']

    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM students WHERE roll_no=%s", (roll,))
    conn.commit()

    affected = cur.rowcount
    cur.close()
    conn.close()

    if affected > 0:
        return jsonify({"message": "✅ Student Deleted Successfully"})
    else:
        return jsonify({"message": "⚠ No student found with that Roll Number"})

# --------------------------------------
# EXAMPLE OPENCV ROUTE (upload -> gray image)
# --------------------------------------
@app.route("/api/process_image", methods=["POST"])
def process_image():
    file = request.files.get("image")
    if not file:
        return "No file uploaded", 400

    file_bytes = np.frombuffer(file.read(), np.uint8)
    img = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)

    # demo: convert to grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    _, buffer = cv2.imencode(".png", gray)
    io_buf = BytesIO(buffer.tobytes())

    return send_file(io_buf, mimetype="image/png")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)

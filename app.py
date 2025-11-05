from flask import Flask, render_template, request, redirect, session, jsonify
import mysql.connector
import re

app = Flask(__name__)
app.secret_key = "your_secret_key_here"  # change this to something strong

# --- Database Connection ---
def get_db():
    return mysql.connector.connect(
        host="localhost",     # change to your DB settings
        user="root",
        password="",
        database="frass"
    )

# --- REGEX Rules ---
username_re = re.compile(r"^[A-Za-z ]{1,50}$")
password_re = re.compile(r"^[A-Za-z0-9]{1,8}$")

# ------------------------------
#           ROUTES
# ------------------------------

@app.route("/")
def home():
    # If logged in → show dashboard mode
    if "username" in session:
        return render_template("index.html", logged_in=True, username=session["username"])
    # Else show pre-login version
    return render_template("index.html", logged_in=False)

# --- REGISTER ---
@app.route("/register", methods=["POST"])
def register():
    username = request.form.get("username", "").strip()
    email = request.form.get("email", "").strip()
    password = request.form.get("password", "").strip().lower()  # case-insensitive

    # Validate formats
    if not username_re.fullmatch(username):
        return jsonify({"status": "error", "msg": "Invalid username"}), 400
    if "@" not in email:
        return jsonify({"status": "error", "msg": "Invalid email format"}), 400
    if not password_re.fullmatch(password):
        return jsonify({"status": "error", "msg": "Invalid password"}), 400

    db = get_db()
    cur = db.cursor()

    # Check if username exists
    cur.execute("SELECT id FROM users WHERE username=%s", (username,))
    if cur.fetchone():
        return jsonify({"status": "error", "msg": "Username taken"}), 409

    cur.execute(
        "INSERT INTO users (username, email, password) VALUES (%s, %s, %s)",
        (username, email, password)
    )
    db.commit()
    cur.close()
    db.close()
    return jsonify({"status": "ok", "msg": "Registered successfully"})

# --- LOGIN ---
@app.route("/login", methods=["POST"])
def login():
    username = request.form.get("username", "").strip()
    password = request.form.get("password", "").strip().lower()

    db = get_db()
    cur = db.cursor(dictionary=True)

    cur.execute("SELECT * FROM users WHERE username=%s AND password=%s", (username, password))
    user = cur.fetchone()

    cur.close()
    db.close()

    if not user:
        return jsonify({"status": "error", "msg": "Invalid credentials"}), 401

    session["username"] = username
    return jsonify({"status": "ok", "msg": "Login successful"})

# --- LOGOUT ---
@app.route("/logout")
def logout():
    session.clear()
    return redirect("/")

# --- PLACEHOLDER: ADD STUDENT ---
@app.route("/add", methods=["POST"])
def add_student():
    # We will fill this in when hooking form POST
    return jsonify({"status": "ok", "msg": "Add student endpoint ready"})

# --- PLACEHOLDER: SCAN FACE ---
@app.route("/scan", methods=["POST"])
def scan_face():
    # Will handle OpenCV later
    return jsonify({"result": "Scan module placeholder"})

# --- SHOW ALL STUDENT RECORDS ---
@app.route("/records")
def records():
    db = get_db()
    cur = db.cursor(dictionary=True)
    cur.execute("SELECT name, roll, dept, email FROM students")
    data = cur.fetchall()
    cur.close()
    db.close()
    return jsonify(data)

import os

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port)
let isLoggedIn = false; // Track login status on frontend

const pages = {

  // -------------------- HOME --------------------
  home: `
    <div class="card">
      <h1>Welcome to <span style="color:#2563eb">FRASS</span></h1>
      <p>Smart Student Record & Attendance System</p>
      <div style="margin-top:20px;">
        <button class="btn btn-primary" onclick="showPage('login')">Login</button>
      </div>
    </div>

    <div class="stats" style="margin-top:30px;">
      <div class="card"><h3>⚡ Fast</h3><p>Quick access to records</p></div>
      <div class="card"><h3>🔒 Secure</h3><p>Data protection</p></div>
      <div class="card"><h3>🤖 Automated</h3><p>Streamlined processes</p></div>
    </div>
  `,

  // -------------------- LOGIN PAGE --------------------
  login: `
    <div class="card" style="max-width:400px;margin:auto;">
      <h2>Login</h2>
      <input id="login_email" type="email" placeholder="Email" required>
      <input id="login_password" type="password" placeholder="Password" required minlength="8">
      <button onclick="login()" class="btn btn-primary">Login</button>
      <p id="login_msg" style="color:red;"></p>
    </div>
  `,

  // -------------------- REGISTER / UPDATE STUDENT --------------------
  register: (`
    <div class="card" style="max-width:600px;margin:auto;">
      <h2>Add / Update Student</h2>
      <form onsubmit="saveStudent(event)">
        <input id="student_id" placeholder="Student ID" required>
        <input id="roll_no" placeholder="Roll No" required>
        <input id="name" placeholder="Name" required>

        <select id="gender" required>
          <option value="" disabled selected>Select Gender</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
          <option value="Other">Other</option>
        </select>

        <input id="dob" type="date" required>
        <input id="contact_no" placeholder="Contact No" required>
        <input id="email" type="email" placeholder="Email" required>
        <input id="class" placeholder="Class" required>
        <input id="section" placeholder="Section" required>

        <button class="btn btn-primary" type="submit">Save</button>
      </form>
      <p id="save_msg" style="color:green;"></p>
    </div>
  `),

  // -------------------- SHOW DB --------------------
  show: `
    <div class="card">
      <h2>Student Database</h2>
      <button onclick="loadStudents()" class="btn btn-primary">Refresh</button>
      <div id="table"></div>
    </div>
  `,

  // -------------------- DELETE STUDENT --------------------
  delete: `
    <div class="card" style="max-width:400px;margin:auto;">
      <h2>Delete Student</h2>
      <input id="delete_roll" type="text" placeholder="Enter Roll Number" style="width:100%;padding:10px;margin:10px 0;">
      <button class="btn btn-primary" onclick="deleteStudent()">Delete</button>
      <p id="delete_msg" style="color:red;margin-top:10px;"></p>
    </div>
  `,

  // -------------------- SCAN (OpenCV) --------------------
  scan: `
    <div class="card" style="max-width:400px;margin:auto;">
      <h2>Upload Photo for Scan</h2>
      <input type="file" id="imageInput" accept="image/*">
      <button class="btn btn-primary" onclick="processImage()">Process</button>
      <h3>Result:</h3>
      <img id="outputImg" style="max-width:300px;">
    </div>
  `
};

// -------------------- LOGIN FUNC --------------------
async function login(){
  const email = document.getElementById("login_email").value;
  const pass = document.getElementById("login_password").value;

  if(!email.includes("@") || !email.includes(".")){
    return document.getElementById("login_msg").innerText = "Invalid email format 🫠";
  }
  if(pass.length < 8){
    return document.getElementById("login_msg").innerText = "Password must be 8+ characters 😒";
  }

  const form = new FormData();
  form.append("email", email);
  form.append("password", pass);

  const r = await fetch('/api/login', { method:'POST', body:form });
  const res = await r.json();

  if(res.status === "success"){
    isLoggedIn = true;
    showPage('register');
  } else {
    document.getElementById("login_msg").innerText = res.message;
  }
}

// -------------------- AUTH-GUARDED PAGE LOADER --------------------
function showPage(page) {
  if(!isLoggedIn && page !== "home" && page !== "login" && page !== "scan"){
    alert("⚠ Login First!");
    return showPage('login');
  }
  document.getElementById('content').innerHTML = pages[page];
}

// -------------------- SAVE STUDENT --------------------
async function saveStudent(event){
  event.preventDefault();
  const form = new FormData();

  ["student_id","roll_no","name","gender","dob","contact_no","email","class","section"]
    .forEach(id => form.append(id, document.getElementById(id).value));

  const r = await fetch('/api/save_student', { method:'POST', body:form });
  const data = await r.json();
  document.getElementById('save_msg').innerText = data.message;
}

// -------------------- LOAD STUDENTS --------------------
async function loadStudents(){
  const r = await fetch('/api/students');
  const students = await r.json();

  let html = `
    <table border="1" cellspacing="0" cellpadding="8">
      <tr>
        <th>Student ID</th><th>Roll No</th><th>Name</th><th>Gender</th><th>Class</th><th>Section</th><th>D.O.B</th><th>Contact</th><th>Email</th>
      </tr>
  `;

  students.forEach(s => {
    html += `
      <tr>
        <td>${s.student_id}</td>
        <td>${s.roll_no}</td>
        <td>${s.name}</td>
        <td>${s.gender}</td>
        <td>${s.class}</td>
        <td>${s.section}</td>
        <td>${s.dob}</td>
        <td>${s.contact_no}</td>
        <td>${s.email}</td>
      </tr>`;
  });

  html += "</table>";
  document.getElementById("table").innerHTML = html;
}

// -------------------- DELETE FUNC --------------------
async function deleteStudent(){
  const roll = document.getElementById("delete_roll").value;
  if(!roll){
    document.getElementById("delete_msg").innerText = "⚠ Enter Roll Number";
    return;
  }

  const form = new FormData();
  form.append("roll_no", roll);

  const r = await fetch('/api/delete_student', { method:'POST', body: form });
  const res = await r.json();
  document.getElementById("delete_msg").innerText = res.message;
}

// -------------------- OPENCV PROCESS --------------------
async function processImage() {
  const input = document.getElementById("imageInput");
  if (!input.files.length) return alert("Select image first 😑");

  const formData = new FormData();
  formData.append("image", input.files[0]);

  const r = await fetch("/api/process_image", { method:"POST", body: formData });
  const blob = await r.blob();

  document.getElementById("outputImg").src =
     URL.createObjectURL(blob);
}

// Auto-load home
showPage('home');

const pages = {

  // -------------------- HOME --------------------
  home: `
    <div class="card">
      <h1>Welcome to <span style="color:#2563eb">FRASS</span></h1>
      <p>Smart Student Record & Attendance System</p>
      <div style="margin-top:20px;">
        <button class="btn btn-primary" onclick="showPage('login')">Login</button>
        <button class="btn btn-outline" onclick="showPage('register')">Update Database</button>
      </div>
    </div>

    <div class="stats" style="margin-top:30px;">
      <div class="card"><h3>⚡ Fast</h3><p>Quick access to records</p></div>
      <div class="card"><h3>🔒 Secure</h3><p>Data protection</p></div>
      <div class="card"><h3>🤖 Automated</h3><p>Streamlined processes</p></div>
    </div>
  `,

  // -------------------- LOGIN --------------------
  login: `
    <div class="card" style="max-width:400px;margin:auto;">
      <h2>Login</h2>
      <input id="login_email" type="email" placeholder="Email" required>
      <input id="login_password" type="password" placeholder="Password" required>
      <button onclick="login()" class="btn btn-primary">Login</button>
      <p id="login_msg" style="color:red;"></p>
    </div>
  `,

  // -------------------- UPDATE / ADD STUDENT --------------------
  register: `
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
  `,

  // -------------------- SHOW DATABASE --------------------
  show: `
    <div class="card">
      <h2>Student Database</h2>
      <button onclick="loadStudents()" class="btn btn-primary">Refresh</button>
      <div id="table"></div>
    </div>
  `,

  // -------------------- SUPPORT --------------------
  support: `
    <div class="card" style="max-width:500px;margin:auto;">
      <h2>Support</h2>
      <p>Need help? Contact us at <b>support@frass.local</b></p>
      <textarea placeholder="Describe your issue..." style="width:100%;padding:10px;margin:10px 0;"></textarea>
      <button class="btn btn-primary">Submit</button>
    </div>
  `
,

delete: `
  <div class="card" style="max-width:400px;margin:auto;">
    <h2>Delete Student</h2>
    <input id="delete_roll" type="text" placeholder="Enter Roll Number" style="width:100%;padding:10px;margin:10px 0;">
    <button class="btn btn-primary" onclick="deleteStudent()">Delete</button>
    <p id="delete_msg" style="color:red;margin-top:10px;"></p>
  </div>
`};

async function deleteStudent(){
  const roll = document.getElementById("delete_roll").value;
  if(!roll){
    document.getElementById("delete_msg").innerText = "⚠ Enter Roll Number";
    return;
  }

  const form = new FormData();
  form.append("roll_no", roll);

  const r = await fetch('/api/delete_student', { method: 'POST', body: form });
  const res = await r.json();

  document.getElementById("delete_msg").innerText = res.message;
}

// -------------------- PAGE LOADER --------------------
function showPage(page) {
  document.getElementById('content').innerHTML = pages[page];
}

// -------------------- LOGIN --------------------
async function login(){
  const form = new FormData();
  form.append("email", document.getElementById("login_email").value);
  form.append("password", document.getElementById("login_password").value);

  const r = await fetch('/api/login', { method:'POST', body:form });
  const res = await r.json();

  if(res.status === "success"){
    showPage('register');
  } else {
    document.getElementById("login_msg").innerText = res.message;
  }
}

// -------------------- SAVE (ADD / UPDATE) STUDENT --------------------
async function saveStudent(event){
  event.preventDefault();
  const form = new FormData();

  ["student_id","roll_no","name","gender","dob","contact_no","email","class","section"]
    .forEach(id => form.append(id, document.getElementById(id).value));

  const r = await fetch('/api/save_student', { method:'POST', body:form });
  const data = await r.json();
  document.getElementById('save_msg').innerText = data.message;
}

// -------------------- SHOW TABLE --------------------
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

  document.getElementById("table").innerHTML = html;
}

// Load home page at start
showPage('home');

let isLoggedIn = false;

function renderNav() {
  const nav = document.getElementById("nav");
  if (!nav) return;

  if (!isLoggedIn) {
    nav.innerHTML = `
      <a onclick="showPage('home')">Home</a>
      <a onclick="showPage('login')">Login</a>
      <a onclick="showPage('signup')">Sign Up</a>
    `;
  } else {
    nav.innerHTML = `
      <a onclick="showPage('dashboard')">Dashboard</a>
      <a onclick="showPage('scan')">Scan</a>
      <a onclick="showPage('manage')">Manage DB</a>
      <a onclick="logout()">Logout</a>
    `;
  }
}

const pages = {

  home: `
    <div class="card">
      <h1>Welcome to <span style="color:#2563eb">FRASS</span></h1>
      <p>Smart Student Record & Attendance System</p>
      <div style="margin-top:20px;">
        <button class="btn btn-primary" onclick="showPage('login')">Login</button>
        <button class="btn btn-outline" onclick="showPage('signup')">Sign Up</button>
      </div>
    </div>
  `,

  login: `
    <div class="card" style="max-width:400px;margin:auto;">
      <h2>Login</h2>
      <input id="login_email" type="email" placeholder="Email" required>
      <input id="login_password" type="password" placeholder="Password" required>
      <button onclick="login()" class="btn btn-primary">Login</button>
      <p id="login_msg" class="msg-error"></p>
      <p style="margin-top:10px;">No account? <a href="javascript:void(0)" onclick="showPage('signup')">Sign up</a></p>
    </div>
  `,

  signup: `
    <div class="card" style="max-width:400px;margin:auto;">
      <h2>Sign Up</h2>
      <input id="signup_email" type="email" placeholder="Email" required>
      <input id="signup_password" type="password" placeholder="Password" required>
      <button onclick="signup()" class="btn btn-primary">Create Account</button>
      <p id="signup_msg" class="msg-error"></p>
    </div>
  `,

  dashboard: `
    <div class="card">
      <h2>FRASS Dashboard</h2>
      <p>Choose what you want to do:</p>
      <div class="grid">
        <button class="btn big" onclick="showPage('scan')">Scan Student</button>
        <button class="btn big" onclick="showPage('manage')">Manage Database</button>
      </div>
    </div>
  `,

  manage: `
    <div class="card">
      <h2>Manage Database</h2>

      <label>Choose database:</label>
      <select id="db_select" disabled>
        <option value="students">Students</option>
      </select>

      <div class="grid" style="margin-top:20px;">
        <button class="btn" onclick="showPage('register')">Add / Update</button>
        <button class="btn" onclick="showPage('show')">Show Records</button>
        <button class="btn" onclick="showPage('delete')">Delete Record</button>
      </div>
    </div>
  `,

  register: `
    <div class="card" style="max-width:600px;margin:auto;">
      <h2>Add / Update Student</h2>
      <form onsubmit="saveStudent(event)">
        <input id="student_id" type="hidden">

        <input id="roll_no" placeholder="Roll Number" required>
        <input id="name" placeholder="Name" required>
        <input id="course" placeholder="Course" required>
        <input id="branch" placeholder="Branch" required>

        <label style="margin-top:10px;display:block;">Student Photo (optional)</label>
        <input id="photo" type="file" accept="image/*">

        <button class="btn btn-primary" type="submit">Save</button>
      </form>
      <p id="save_msg" class="msg-info"></p>
    </div>
  `,

  show: `
    <div class="card">
      <h2>Student Database</h2>
      <button onclick="loadStudents()" class="btn btn-primary">Refresh</button>
      <div id="table"></div>
    </div>
  `,

  delete: `
    <div class="card" style="max-width:400px;margin:auto;">
      <h2>Delete Student</h2>
      <input id="delete_roll" type="text" placeholder="Enter Roll Number" style="width:100%;padding:10px;margin:10px 0;">
      <button class="btn btn-primary" onclick="deleteStudent()">Delete</button>
      <p id="delete_msg" class="msg-error"></p>
    </div>
  `,

  scan: `
    <div class="card" style="max-width:400px;margin:auto;">
      <h2>Upload Photo for Scan</h2>
      <input type="file" id="imageInput" accept="image/*">
      <button class="btn btn-primary" onclick="processImage()">Process</button>
      <h3>Result:</h3>
      <img id="outputImg" style="max-width:300px;">
      <p class="msg-info">Later, this will also fetch student data using face_id.</p>
    </div>
  `
};

let isPop = false;

function showPage(page) {
  const publicPages = ["home", "login", "signup"];
  
  if (!isLoggedIn && !publicPages.includes(page)) {
    page = "login";
  }

  document.getElementById("content").innerHTML = pages[page];
  renderNav();

  // Only push into history when navigation is user-triggered
  if (!isPop) {
    history.pushState({ page }, "", "#" + page);
  }
  
  isPop = false;
}

window.onpopstate = function(event) {
  if (event.state && event.state.page) {
    isPop = true;
    showPage(event.state.page);
  }
};


// ---------- AUTH ---------- //

async function signup() {
  const email = document.getElementById("signup_email").value.trim();
  const pass = document.getElementById("signup_password").value.trim();
  const msg = document.getElementById("signup_msg");
  msg.innerText = "";

  if (!email.includes("@") || !email.includes(".")) {
    msg.innerText = "Invalid email format";
    return;
  }
  if (pass.length < 4) {
    msg.innerText = "Password must be at least 4 characters";
    return;
  }

  const form = new FormData();
  form.append("email", email);
  form.append("password", pass);

  const r = await fetch("/api/signup", { method: "POST", body: form });
  const res = await r.json();
  if (res.status === "success") {
    msg.style.color = "green";
    msg.innerText = "Account created. You can log in now.";
  } else {
    msg.style.color = "red";
    msg.innerText = res.message;
  }
}

async function login() {
  const email = document.getElementById("login_email").value.trim();
  const pass = document.getElementById("login_password").value.trim();
  const msg = document.getElementById("login_msg");
  msg.innerText = "";

  const form = new FormData();
  form.append("email", email);
  form.append("password", pass);

  const r = await fetch("/api/login", { method: "POST", body: form });
  const res = await r.json();
  if (res.status === "success") {
    isLoggedIn = true;
    showPage("dashboard");
  } else {
    msg.innerText = res.message;
  }
}

async function logout() {
  await fetch("/api/logout", { method: "POST" });
  isLoggedIn = false;
  showPage("home");
}


// ---------- STUDENT CRUD ---------- //

async function saveStudent(event) {
  event.preventDefault();

  const form = new FormData();
  form.append("id", document.getElementById("student_id").value);
  form.append("roll_no", document.getElementById("roll_no").value);
  form.append("name", document.getElementById("name").value);
  form.append("course", document.getElementById("course").value);
  form.append("branch", document.getElementById("branch").value);

  const photoInput = document.getElementById("photo");
  if (photoInput && photoInput.files.length) {
    form.append("photo", photoInput.files[0]);
  }

  const r = await fetch("/api/save_student", { method: "POST", body: form });
  const res = await r.json();
  const msg = document.getElementById("save_msg");
  msg.style.color = res.status === "success" ? "green" : "red";
  msg.innerText = res.message;
}

async function loadStudents() {
  const r = await fetch("/api/students");
  const students = await r.json();

  let html = `
    <table border="1" cellspacing="0" cellpadding="8">
      <tr>
        <th>Serial</th>
        <th>Roll No</th>
        <th>Name</th>
        <th>Course</th>
        <th>Branch</th>
        <th>Photo</th>
      </tr>
  `;

  students.forEach(s => {
    const imgTag = s.image_path ? `<img src="/static/${s.image_path}" style="max-width:60px;">` : "-";
    html += `
      <tr>
        <td>${s.id}</td>
        <td>${s.roll_no}</td>
        <td>${s.name}</td>
        <td>${s.course}</td>
        <td>${s.branch}</td>
        <td>${imgTag}</td>
      </tr>
    `;
  });

  html += "</table>";
  document.getElementById("table").innerHTML = html;
}

async function deleteStudent() {
  const roll = document.getElementById("delete_roll").value.trim();
  const msg = document.getElementById("delete_msg");
  if (!roll) {
    msg.innerText = "Enter Roll Number";
    return;
  }

  const form = new FormData();
  form.append("roll_no", roll);

  const r = await fetch("/api/delete_student", { method: "POST", body: form });
  const res = await r.json();
  msg.style.color = res.status === "success" ? "green" : "red";
  msg.innerText = res.message;
}


// ---------- OPENCV PROCESS ---------- //

async function processImage() {
  const input = document.getElementById("imageInput");
  if (!input.files.length) {
    alert("Select an image first");
    return;
  }

  const formData = new FormData();
  formData.append("image", input.files[0]);

  const r = await fetch("/api/process_image", { method: "POST", body: formData });
  const blob = await r.blob();
  document.getElementById("outputImg").src = URL.createObjectURL(blob);
}


// start app
showPage("home");
renderNav();

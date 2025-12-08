let isLoggedIn = false;
let isPop = false;
let cameraStream = null;

// ---------------- NAV ----------------

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
      <a onclick="showPage('scan')">Scan (Upload)</a>
      <a onclick="showPage('scan_live')">Live Scan</a>
      <a onclick="showPage('manage')">Manage DB</a>
      <a onclick="logout()">Logout</a>
    `;
  }
}

// ---------------- PAGES ----------------

const pages = {

  home: `
    <div class="card hero">
      <div>
        <div class="pill">Face Recognition · Smart Attendance</div>
        <h1 class="hero-title">FRASS – Fast, Reliable Attendance for Students</h1>
        <p class="hero-subtitle">
          Scan a face, fetch the record, and update your database in seconds.
          Built for labs, exams and classroom demos.
        </p>
        <div class="hero-actions">
          <button class="btn btn-primary" onclick="showPage('login')">Login to Dashboard</button>
          <button class="btn btn-outline" onclick="showPage('signup')">Create Admin Account</button>
        </div>
      </div>
      <div class="hero-side">
        <p class="hero-metric">System Snapshot</p>
        <p class="hero-value" id="hero_student_count">— students</p>
        <p style="font-size:0.8rem;margin-top:8px;opacity:0.9;">
          Live face matching, PostgreSQL cloud database and mobile-first UI –
          all running directly from your browser.
        </p>
      </div>
    </div>

    <div class="card">
      <h3 class="section-title">Why FRASS?</h3>
      <div class="grid">
        <div class="stat-card">
          <span class="stat-label">Face-based Identification</span>
          <span class="stat-value" style="font-size:1rem;">Scan & match against stored photos</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Cloud Database</span>
          <span class="stat-value" style="font-size:1rem;">PostgreSQL – persistent & secure</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Admin Tools</span>
          <span class="stat-value" style="font-size:1rem;">Add, update & delete student records</span>
        </div>
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
        <button class="btn big" onclick="showPage('scan')">Scan (Upload)</button>
        <button class="btn big" onclick="showPage('scan_live')">Live Scan</button>
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
        <input id="roll_no" placeholder="Roll Number" required>
        <input id="name" placeholder="Name">
        <input id="course" placeholder="Course">
        <input id="branch" placeholder="Branch">

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
      <h2>Scan Student Face (Upload)</h2>
      <input type="file" id="imageInput" accept="image/*">
      <button class="btn btn-primary" onclick="processImage()">Scan & Match</button>

      <h3 style="margin-top:16px;">Uploaded</h3>
      <img id="previewImg" style="max-width:300px;display:none;">

      <h3 style="margin-top:16px;">Matched Student</h3>
      <div id="scanResult"></div>
    </div>
  `,

  scan_live: `
    <div class="card" style="max-width:500px;margin:auto;text-align:center;">
      <h2>Live Scan</h2>

      <video id="cameraFeed" autoplay playsinline style="width:100%;border-radius:8px;background:#000;"></video>

      <button class="btn btn-primary" style="margin-top:12px;" onclick="captureFrame()">
        Scan Face
      </button>

      <div id="scanResult" style="margin-top:16px;"></div>
    </div>
  `
};

// ---------------- PAGE LOADER + HISTORY ----------------

function showPage(page) {
  const publicPages = ["home", "login", "signup"];
  const content = document.getElementById("content");
  if (!content) return;

  if (!isLoggedIn && !publicPages.includes(page)) {
    page = "login";
  }

  content.innerHTML = pages[page] || "";
  renderNav();

  // stats on home + dashboard
  if (page === "home" || page === "dashboard") {
    loadDashboardStats();
  }

  // camera handling
  if (page === "scan_live") {
    startCamera();
  } else {
    stopCamera();
  }

  if (!isPop) {
    history.pushState({ page }, "", "#" + page);
  }
  isPop = false;
}

window.onpopstate = function (event) {
  if (event.state && event.state.page) {
    isPop = true;
    showPage(event.state.page);
  } else {
    isPop = true;
    showPage("home");
  }
};

// ---------------- AUTH ----------------

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
  stopCamera();
  showPage("home");
}

// ---------------- STUDENT CRUD ----------------

async function saveStudent(event) {
  event.preventDefault();

  const form = new FormData();
  form.append("roll_no", document.getElementById("roll_no").value.trim());
  form.append("name", document.getElementById("name").value.trim());
  form.append("course", document.getElementById("course").value.trim());
  form.append("branch", document.getElementById("branch").value.trim());

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
    const imgTag = s.image_path
      ? `<img src="/static/${s.image_path}" style="max-width:60px;">`
      : "-";
    html += `
      <tr>
        <td>${s.id}</td>
        <td>${s.roll_no}</td>
        <td>${s.name || "-"}</td>
        <td>${s.course || "-"}</td>
        <td>${s.branch || "-"}</td>
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

async function loadDashboardStats() {
  try {
    const r = await fetch("/api/students");
    const students = await r.json();
    const total = Array.isArray(students) ? students.length : 0;

    const statEl = document.getElementById("stat_total_students");
    const heroEl = document.getElementById("hero_student_count");
    if (statEl) statEl.textContent = total;
    if (heroEl) heroEl.textContent = `${total} students`;
  } catch (err) {
    console.error(err);
  }
}
// ---------------- SCAN (UPLOAD) ----------------

async function processImage() {
  const input = document.getElementById("imageInput");
  const resultBox = document.getElementById("scanResult");
  const preview = document.getElementById("previewImg");

  resultBox.innerHTML = "";
  if (!input || !input.files.length) {
    alert("Select an image first");
    return;
  }

  const file = input.files[0];
  preview.src = URL.createObjectURL(file);
  preview.style.display = "block";

  const formData = new FormData();
  formData.append("image", file);

  resultBox.innerHTML = "⏳ Scanning...";

  const r = await fetch("/api/scan_face", {
    method: "POST",
    body: formData
  });
  const data = await r.json();

  if (data.status === "success") {
    const s = data.student;
    const photoHtml = s.image_path
      ? `<img src="/static/${s.image_path}" style="max-width:120px;display:block;margin-top:8px;">`
      : "";

    resultBox.innerHTML = `
      <p><b>Roll:</b> ${s.roll_no}</p>
      <p><b>Name:</b> ${s.name || "-"}</p>
      <p><b>Course:</b> ${s.course || "-"}</p>
      <p><b>Branch:</b> ${s.branch || "-"}</p>
      ${photoHtml}
    `;
  } else {
    resultBox.innerHTML = `<p class="msg-error">${data.message || "No match found"}</p>`;
  }
}

// ---------------- LIVE SCAN (CAMERA) ----------------

async function startCamera() {
  const video = document.getElementById("cameraFeed");
  if (!video) return;

  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = cameraStream;
  } catch (err) {
    alert("Camera access denied or unavailable");
    console.error(err);
  }
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(t => t.stop());
    cameraStream = null;
  }
  const video = document.getElementById("cameraFeed");
  if (video) {
    video.srcObject = null;
  }
}

async function captureFrame() {
  const video = document.getElementById("cameraFeed");
  const resultBox = document.getElementById("scanResult");

  if (!video || !video.videoWidth) {
    resultBox.innerHTML = `<span style="color:red;">Camera not ready</span>`;
    return;
  }

  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0);

  const blob = await new Promise(resolve =>
    canvas.toBlob(resolve, "image/png")
  );
  const formData = new FormData();
  formData.append("image", blob, "frame.png");

  resultBox.innerHTML = "⏳ Scanning...";

  const r = await fetch("/api/scan_face", { method: "POST", body: formData });
  const res = await r.json();

  if (res.status === "success") {
    const s = res.student;
    resultBox.innerHTML = `
      <p><b>Detected:</b> ${s.name || "-"} (${s.roll_no})</p>
      <p>${s.course || ""} ${s.branch || ""}</p>
      ${s.image_path ? `<img src="/static/${s.image_path}" style="max-width:120px;border-radius:6px;margin-top:8px;">` : ""}
    `;
  } else {
    resultBox.innerHTML = `<span style="color:red;">${res.message || "No match found"}</span>`;
  }
}

// ---------------- INIT ----------------

showPage("home");
renderNav();

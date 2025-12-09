let isLoggedIn = false;
let isPop = false;
let cameraStream = null;
let navOpen = false;

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
        </p>
        <div class="hero-actions">
          <button class="btn btn-primary" onclick="showPage('login')">Login to Dashboard</button>
          <button class="btn btn-outline" onclick="showPage('signup')">Create Admin Account</button>
        </div>
      </div>
      <div class="hero-side">
        <p class="hero-metric">System Snapshot</p>
        <p class="hero-value" id="hero_student_count">— students</p>
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
      <p style="margin-top:10px;">No account?
        <a onclick="showPage('signup')" href="javascript:void(0)">Sign up</a>
      </p>
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
      <div class="grid">
        <button class="btn big" onclick="showPage('scan')">Scan (Upload)</button>
        <button class="btn big" onclick="showPage('scan_live')">Live Scan</button>
        <button class="btn big" onclick="showPage('manage')">Manage Database</button>
      </div>
      <p id="stat_total_students" style="margin-top:10px;color:#2563eb;font-weight:bold;"></p>
    </div>
  `,

  manage: `
    <div class="card">
      <h2>Manage Database</h2>
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
        <label>Student Photo (optional)</label>
        <input id="photo" type="file" accept="image/*">
        <button class="btn btn-primary" type="submit">Save</button>
      </form>
      <p id="save_msg"></p>
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
      <input id="delete_roll" placeholder="Roll No">
      <button class="btn btn-primary" onclick="deleteStudent()">Delete</button>
      <p id="delete_msg"></p>
    </div>
  `,

  scan: `
    <div class="card" style="max-width:450px;margin:auto;">
      <h2>Scan (Upload)</h2>
      <input id="imageInput" type="file" accept="image/*">
      <button class="btn btn-primary" onclick="processImage()">Scan</button>
      <img id="previewImg" style="max-width:300px;display:none;margin-top:10px;">
      <div id="scanResult" style="margin-top:10px;"></div>
    </div>
  `,

  scan_live: `
    <div class="card" style="max-width:500px;margin:auto;">
      <h2>Live Scan</h2>
      <video id="cameraFeed" autoplay playsinline style="width:100%;border-radius:8px;background:#000;"></video>
      <button class="btn btn-primary" style="margin-top:12px;" onclick="captureFrame()">Scan</button>
      <div id="scanResult" style="margin-top:12px;"></div>
    </div>
  `
};

// ---------------- PAGE LOADING + HISTORY ----------------

function showPage(page) {
  const publicPages = ["home", "login", "signup"];
  if (!isLoggedIn && !publicPages.includes(page)) {
    page = "login";
  }
  document.getElementById("content").innerHTML = pages[page];
  renderNav();

  if (page === "scan_live") startCamera();
  else stopCamera();

  if (!isPop) history.pushState({ page }, "", "#" + page);
  isPop = false;
}

window.onpopstate = e => {
  isPop = true;
  showPage(e.state?.page || "home");
};

// ---------------- AUTH ----------------

async function signup() {
  const email = signup_email.value.trim();
  const pass = signup_password.value.trim();
  signup_msg.textContent = "";

  const form = new FormData();
  form.append("email", email);
  form.append("password", pass);
  const res = await (await fetch("/api/signup",{method:"POST",body:form})).json();

  signup_msg.style.color = res.status==="success"?"green":"red";
  signup_msg.textContent = res.message;
}

async function login() {
  const email = login_email.value.trim();
  const pass = login_password.value.trim();
  login_msg.textContent = "";

  const form = new FormData();
  form.append("email", email);
  form.append("password", pass);
  const res = await (await fetch("/api/login",{method:"POST",body:form})).json();

  if (res.status === "success") {
    isLoggedIn = true;
    showPage("dashboard");
  } else {
    login_msg.textContent = res.message;
  }
}

async function logout() {
  await fetch("/api/logout",{method:"POST"});
  isLoggedIn = false;
  stopCamera();
  showPage("home");
}

// ---------------- CRUD ----------------

async function saveStudent(e){
  e.preventDefault();
  const f = new FormData();
  ["roll_no","name","course","branch"].forEach(id =>
    f.append(id, document.getElementById(id).value.trim())
  );
  const img = document.getElementById("photo").files[0];
  if (img) f.append("photo", img);

  const r = await fetch("/api/save_student",{method:"POST",body:f});
  const res = await r.json();
  save_msg.style.color = res.status==="success"?"green":"red";
  save_msg.textContent = res.message;
}

async function loadStudents(){
  const r = await fetch("/api/students");
  const students = await r.json();

  let html = `<div class="table-wrapper"><table>
      <tr><th>ID</th><th>Roll</th><th>Name</th><th>Course</th><th>Branch</th><th>Photo</th></tr>`;

  students.forEach(s=>{
    const img = s.image_path
      ? `<img src="/api/student_photo/${s.id}" style="max-width:60px;">`
      : "-";
    html+=`<tr><td>${s.id}</td><td>${s.roll_no}</td><td>${s.name||"-"}</td>
<td>${s.course||"-"}</td><td>${s.branch||"-"}</td><td>${img}</td></tr>`;
  });

  html+=`</table></div>`;
  document.getElementById("table").innerHTML = html;
}

async function deleteStudent(){
  const roll = delete_roll.value.trim();
  const f = new FormData();
  f.append("roll_no", roll);
  const res = await (await fetch("/api/delete_student",{method:"POST",body:f})).json();
  delete_msg.style.color=res.status==="success"?"green":"red";
  delete_msg.textContent = res.message;
}

// ---------------- SCAN (UPLOAD) ----------------

async function processImage(){
  if (!imageInput.files.length) return alert("Pick a photo first!");
  previewImg.src = URL.createObjectURL(imageInput.files[0]);
  previewImg.style.display = "block";

  const f=new FormData();
  f.append("image",imageInput.files[0]);
  scanResult.textContent="⏳ scanning...";

  const res=await (await fetch("/api/scan_face",{method:"POST",body:f})).json();
  if(res.status==="success"){
    const s=res.student;
    scanResult.innerHTML = `
      <p><b>${s.name||"-"}</b> (${s.roll_no})</p>
      <img src="/api/student_photo/${s.id}" style="max-width:140px;margin-top:6px;">
    `;
  } else {
    scanResult.innerHTML=`<p style="color:red;">${res.message}</p>`;
  }
}

// ---------------- LIVE SCAN ----------------

async function startCamera(){
  const v=document.getElementById("cameraFeed");
  if(!v) return;
  cameraStream=await navigator.mediaDevices.getUserMedia({video:true});
  v.srcObject=cameraStream;
}

function stopCamera(){
  cameraStream?.getTracks().forEach(t=>t.stop());
  cameraStream=null;
  const v=document.getElementById("cameraFeed");
  if(v) v.srcObject=null;
}

async function captureFrame(){
  const v=document.getElementById("cameraFeed");
  if(!v.videoWidth) return scanResult.textContent="Camera not ready";

  const canvas=document.createElement("canvas");
  canvas.width=v.videoWidth;
  canvas.height=v.videoHeight;
  canvas.getContext("2d").drawImage(v,0,0);

  const blob=await new Promise(r=>canvas.toBlob(r,"image/png"));
  const f=new FormData(); f.append("image",blob);
  scanResult.textContent="⏳ scanning...";

  const res=await (await fetch("/api/scan_face",{method:"POST",body:f})).json();
  if(res.status==="success"){
    const s=res.student;
    scanResult.innerHTML=`
      <div class="table-wrapper"><table>
      <tr><th>ID</th><th>Roll</th><th>Name</th><th>Course</th><th>Branch</th><th>Photo</th></tr>
      <tr><td>${s.id}</td><td>${s.roll_no}</td><td>${s.name||"-"}</td>
<td>${s.course||"-"}</td><td>${s.branch||"-"}</td>
<td><img src="/api/student_photo/${s.id}"></td></tr></table></div>`;
  } else {
    scanResult.innerHTML=`<span style="color:red;">${res.message}</span>`;
  }
}

// ---------------- INIT ----------------
showPage("home");
renderNav();

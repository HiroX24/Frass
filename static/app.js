// Simple router + auth shell (no backend yet)
const PRE = document.getElementById('PRE');
const HOME = document.getElementById('HOME');
const accountBtn = document.getElementById('accountBtn');
const welcomeEl = document.getElementById('welcome');

// Nav routing for HOME views
const views = {
  home: document.getElementById('homeView'),
  scan: document.getElementById('scanView'),
  update: document.getElementById('updateView'),
  records: document.getElementById('recordsView'),
  support: document.getElementById('supportView')
};
function showView(name){
  Object.values(views).forEach(v=>v.classList.add('hidden'));
  (views[name] || views.home).classList.remove('hidden');
}

// Auth modal
const authModal = document.getElementById('authModal');
const openLogin = document.getElementById('openLogin');
const openRegister = document.getElementById('openRegister');
const tabLogin = document.getElementById('tabLogin');
const tabRegister = document.getElementById('tabRegister');
const loginPane = document.getElementById('loginPane');
const registerPane = document.getElementById('registerPane');

function switchPane(which){
  const isLogin = which === 'login';
  loginPane.classList.toggle('hidden', !isLogin);
  registerPane.classList.toggle('hidden', isLogin);
  tabLogin.classList.toggle('active', isLogin);
  tabRegister.classList.toggle('active', !isLogin);
}
openLogin?.addEventListener('click', ()=>{ switchPane('login'); authModal.showModal(); });
openRegister?.addEventListener('click', ()=>{ switchPane('register'); authModal.showModal(); });
document.getElementById('closeAuth')?.addEventListener('click', ()=> authModal.close());
tabLogin?.addEventListener('click', ()=> switchPane('login'));
tabRegister?.addEventListener('click', ()=> switchPane('register'));

// Login/Register validation (client-side only for now)
const unameRe = /^[A-Za-z ]{1,50}$/;
const passRe  = /^[A-Za-z0-9]{1,8}$/;

document.getElementById('doLogin')?.addEventListener('click', ()=>{
  const u = document.getElementById('lUser').value.trim();
  const p = document.getElementById('lPass').value.trim();
  if(!unameRe.test(u)) return alert("Username: letters & spaces only (max 50).");
  if(!passRe.test(p))  return alert("Password: alphanumeric, max 8 chars.");
  // TODO: POST to Flask: /login {username, passwordLower}
  activateSession(u);
});

document.getElementById('doRegister')?.addEventListener('click', ()=>{
  const u = document.getElementById('rUser').value.trim();
  const m = document.getElementById('rMail').value.trim();
  const p = document.getElementById('rPass').value.trim();
  if(!unameRe.test(u)) return alert("Username: letters & spaces only (max 50).");
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m)) return alert("Email must contain @ and domain.");
  if(!passRe.test(p))  return alert("Password: alphanumeric, max 8 chars.");
  // TODO: POST to Flask: /register  (store lowercased password if case-insensitive)
  alert("Registered (client-only demo). Now login.");
  switchPane('login');
});

// Fake session flip (will be replaced with real Flask session later)
function activateSession(username){
  authModal.close();
  PRE.classList.add('hidden');
  HOME.classList.remove('hidden');
  accountBtn.hidden = false;
  welcomeEl.textContent = `Welcome, ${username}`;
  showView('home');
}

// Top ribbon routing (after login)
document.getElementById('top-links')?.addEventListener('click', (e)=>{
  if(e.target.matches('a[data-link]')){
    e.preventDefault();
    const to = e.target.getAttribute('data-link');
    showView(to === 'home' ? 'home'
           : to === 'scan' ? 'scan'
           : to === 'update' ? 'update'
           : to === 'records' ? 'records'
           : 'support');
  }
});

// Update form (client side only)
document.getElementById('updateForm')?.addEventListener('submit', (e)=>{
  e.preventDefault();
  const name = document.getElementById('uName').value.trim();
  const roll = document.getElementById('uRoll').value.trim();
  const dept = document.getElementById('uDept').value.trim();
  const mail = document.getElementById('uMail').value.trim();
  if(!unameRe.test(name)) return alert("Name invalid.");
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) return alert("Email invalid.");
  // const file = document.getElementById('uImage').files[0];
  // TODO: POST to /add with formData (name, roll, dept, mail, image)
  alert("Saved (demo). Hook to Flask next.");
});

// Scan once (placeholder)
document.getElementById('scanOnce')?.addEventListener('click', async ()=>{
  // TODO: capture from webcam & POST to /scan
  document.getElementById('scanResult').textContent = "Result: (demo) No match yet.";
});

// Example placeholders; hook these when backend is ready
document.getElementById('scanBtn')?.addEventListener('click', ()=> showView('scan'));
document.getElementById('updateBtn')?.addEventListener('click', ()=> showView('update'));
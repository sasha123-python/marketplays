/**
 * frontend/js/auth.js
 * Handles:
 *  - JWT storage in a JS variable (NOT localStorage — safer against XSS)
 *  - Login / Register modals
 *  - Topbar state (show user badge vs login button)
 *  - Post-job and contact-job modals (auth-gated)
 *  - Google OAuth popup login                                         ← NEW
 *
 * Token is lost on page reload — acceptable for MVP.
 * Production upgrade: use HttpOnly cookies via /auth/refresh endpoint.
 */

// ── Private state ─────────────────────────────────────────────────────────────
let _token       = null;   // JWT string
let _user        = null;   // { id, name, role, created_at }
let _pendingJob  = null;   // job id user tried to contact before logging in

// ── Token helpers (used by api.js) ───────────────────────────────────────────
function getToken()    { return _token; }
function clearToken()  { _token = null; _user = null; }
function isLoggedIn()  { return !!_token; }

// ── District → coordinates map (used when posting a job) ─────────────────────
const DISTRICT_COORDS = {
  "Eixample":            [41.3927, 2.1649],
  "Gràcia":              [41.4025, 2.1534],
  "Sant Martí":          [41.4054, 2.1997],
  "Sants-Montjuïc":      [41.3737, 2.1514],
  "Sarrià-Sant Gervasi": [41.4086, 2.1327],
  "Horta-Guinardó":      [41.4218, 2.1652],
  "Nou Barris":          [41.4378, 2.1786],
  "Sant Andreu":         [41.4357, 2.1898],
  "Les Corts":           [41.3846, 2.1319],
  "Ciutat Vella":        [41.3827, 2.1771],
};

// ── Auth modal ────────────────────────────────────────────────────────────────
function openAuth()  { document.getElementById("authOverlay").classList.add("open"); }
function closeAuth() { document.getElementById("authOverlay").classList.remove("open"); }

function switchTab(tab) {
  document.querySelectorAll(".tab").forEach((t, i) =>
    t.classList.toggle("active", (i === 0) === (tab === "login"))
  );
  document.getElementById("tLogin").classList.toggle("active", tab === "login");
  document.getElementById("tReg").classList.toggle("active",   tab === "register");
}

async function doLogin() {
  const email    = document.getElementById("lEmail").value.trim();
  const password = document.getElementById("lPass").value;
  if (!email || !password) { showToast("Completa todos los campos.", "error"); return; }

  try {
    const data = await api.post("/auth/login", { email, password });
    _token = data.access_token;
    _user  = await api.get("/auth/me");
    closeAuth();
    updateTopbar();
    showToast(`¡Bienvenido, ${_user.name}! 👷`, "success");

    // Resume a pending contact request if there was one
    if (_pendingJob) { setTimeout(() => openContactFor(_pendingJob), 400); }
  } catch (e) { showToast(e.message, "error"); }
}

async function doRegister() {
  const name     = document.getElementById("rName").value.trim();
  const email    = document.getElementById("rEmail").value.trim();
  const password = document.getElementById("rPass").value;
  const role     = document.getElementById("rRole").value;
  if (!name || !email || !password) { showToast("Completa todos los campos.", "error"); return; }

  try {
    const data = await api.post("/auth/register", { name, email, password, role });
    _token = data.access_token;
    _user  = await api.get("/auth/me");
    closeAuth();
    updateTopbar();
    showToast(`¡Cuenta creada! Bienvenido, ${_user.name}! 🎉`, "success");
  } catch (e) { showToast(e.message, "error"); }
}

function doLogout() {
  clearToken();
  updateTopbar();
  showToast("Sesión cerrada.", "success");
}


// ══════════════════════════════════════════════════════════════════════════════
//  NEW: Google OAuth
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Opens a popup pointing at /auth/google/login.
 * The backend redirects to Google → user consents → Google redirects
 * back to /auth/google/callback → callback page postMessages the JWT here.
 */
function loginWithGoogle() {
  const w = 500, h = 600;
  const left = window.screenX + (window.outerWidth  - w) / 2;
  const top  = window.screenY + (window.outerHeight - h) / 2;

  const popup = window.open(
    `${API_BASE}/auth/google/login`,
    "google-login",
    `width=${w},height=${h},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes`
  );

  if (!popup) {
    showToast("Permite las ventanas emergentes para este sitio.", "error");
    return;
  }

  // Safety: detect if user closes the popup without completing
  const check = setInterval(() => {
    if (popup.closed) clearInterval(check);
  }, 500);
}

/**
 * Listen for the postMessage from the Google callback popup.
 */
window.addEventListener("message", async (event) => {
  // Security: only accept messages from our own origin
  if (event.origin !== window.location.origin &&
      event.origin !== new URL(API_BASE).origin) return;

  const d = event.data;
  if (d.type !== "GOOGLE_AUTH_SUCCESS") return;

  // Store token and fetch full user profile (same as doLogin)
  _token = d.token;
  try {
    _user = await api.get("/auth/me");
  } catch {
    // Fallback: use data from the callback
    _user = { name: d.name, email: d.email, role: d.role };
  }

  closeAuth();
  updateTopbar();
  showToast(`¡Bienvenido, ${_user.name}! 🎉`, "success");

  // If this is a brand-new Google user, let them pick their role
  if (d.isNewUser) {
    setTimeout(() => showRoleModal(), 500);
  }

  // Resume pending contact if any
  if (_pendingJob) { setTimeout(() => openContactFor(_pendingJob), 600); }
});

/**
 * Role-selection modal for new Google users.
 * They default to "contractor" but might want "client".
 */
function showRoleModal() {
  const overlay = document.createElement("div");
  overlay.id = "roleOverlay";
  overlay.className = "overlay open";
  overlay.innerHTML = `
    <div class="modal" style="text-align:center;">
      <div class="modal-title">¡Bienvenido a <span>ObraMap</span>!</div>
      <p style="color:var(--dim);font-size:13px;margin-bottom:22px;">
        ¿Cómo quieres usar la plataforma?
      </p>
      <button class="btn btn-primary" style="width:100%;justify-content:center;margin-bottom:10px;"
              onclick="pickRole('client')">
        🏗️ Soy Cliente — Publico obras
      </button>
      <button class="btn btn-ghost" style="width:100%;justify-content:center;"
              onclick="pickRole('contractor')">
        🔧 Soy Contratista — Busco obras
      </button>
    </div>
  `;
  document.body.appendChild(overlay);
}

async function pickRole(role) {
  try {
    await api.patch("/auth/me/role", { role });
    _user.role = role;
    updateTopbar();
    showToast(role === "client" ? "Rol: Cliente ✅" : "Rol: Contratista ✅", "success");
  } catch (e) {
    showToast(e.message, "error");
  }
  const el = document.getElementById("roleOverlay");
  if (el) el.remove();
}


// ── Topbar user state ─────────────────────────────────────────────────────────
function updateTopbar() {
  const el = document.getElementById("topbarActions");
  if (_user) {
    const isClient = _user.role === "client";
    el.innerHTML = `
      <div class="user-badge">
        <div class="avatar">${_user.name.charAt(0).toUpperCase()}</div>
        <span class="uname">${_user.name}</span>
      </div>
      ${isClient
        ? `<button class="btn btn-ghost" onclick="openPost()">+ Publicar</button>`
        : ``
      }
      <button class="btn btn-ghost" onclick="doLogout()">Salir</button>
    `;
  } else {
    el.innerHTML = `
      <button class="btn btn-primary" onclick="openAuth()">Acceder</button>
      <button class="btn btn-ghost"   onclick="openPost()">+ Publicar</button>
    `;
  }
}

// ── Post job modal ────────────────────────────────────────────────────────────
function openPost() {
  if (!isLoggedIn()) { openAuth(); showToast("Inicia sesión para publicar.", "error"); return; }
  if (_user && _user.role !== "client") {
    showToast("Solo los clientes pueden publicar obras. Tu cuenta es de contratista.", "error");
    return;
  }
  document.getElementById("postOverlay").classList.add("open");
}
function closePost() { document.getElementById("postOverlay").classList.remove("open"); }

async function doPost() {
  const title    = document.getElementById("pTitle").value.trim();
  const desc     = document.getElementById("pDesc").value.trim();
  const category = document.getElementById("pCat").value;
  const price    = document.getElementById("pPrice").value;
  const district = document.getElementById("pDistrict").value;
  const email    = document.getElementById("pEmail").value.trim();

  if (!title || !desc || !email) { showToast("Completa título, descripción y email.", "error"); return; }
  if (title.length < 5)  { showToast("El título debe tener al menos 5 caracteres.", "error"); return; }
  if (desc.length < 10)  { showToast("La descripción debe tener al menos 10 caracteres.", "error"); return; }

  if (_user && _user.role !== "client") {
    showToast("Solo los clientes pueden publicar obras. Tu cuenta es de contratista.", "error");
    return;
  }

  const [bLat, bLng] = DISTRICT_COORDS[district] || [41.3851, 2.1734];
  const latitude  = bLat + (Math.random() - 0.5) * 0.03;
  const longitude = bLng + (Math.random() - 0.5) * 0.03;

  try {
    await api.post("/jobs", {
      title,
      description: desc,
      category,
      price: price ? parseFloat(price) : null,
      latitude,
      longitude,
      district,
      contact: email,
    });
    closePost();
    showToast("¡Obra publicada! 🏗", "success");
    setTimeout(loadJobs, 300);
  } catch (e) { showToast(e.message, "error"); }
}

// ── Contact modal ─────────────────────────────────────────────────────────────
function openContactFor(jobId) {
  _pendingJob = jobId;
  if (!isLoggedIn()) { openAuth(); showToast("Inicia sesión para contactar.", "error"); return; }
  const job = window._jobs?.find(j => j.id === jobId);
  if (job) document.getElementById("contactJobTitle").textContent = `"${job.title}"`;
  document.getElementById("contactOverlay").classList.add("open");
}
function closeContact() { document.getElementById("contactOverlay").classList.remove("open"); }

async function doContact() {
  const msg = document.getElementById("contactMsg").value.trim();
  if (msg.length < 20) { showToast("El mensaje debe tener al menos 20 caracteres.", "error"); return; }

  try {
    await api.post(`/jobs/${_pendingJob}/contact`, { message: msg });
    closeContact();
    _pendingJob = null;
    document.getElementById("contactMsg").value = "";
    showToast("¡Solicitud enviada al cliente! ✅", "success");
  } catch (e) { showToast(e.message, "error"); }
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function showToast(msg, type = "success") {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.className = `toast ${type}`;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 3500);
}
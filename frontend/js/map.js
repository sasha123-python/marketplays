/**
 * frontend/js/map.js
 * All Leaflet map logic:
 *  - Map initialisation (dark CartoDB tiles, Barcelona centre)
 *  - Fetching jobs from GET /jobs and rendering markers
 *  - Custom category markers (coloured pin + emoji)
 *  - Sidebar job cards in sync with the map
 *  - Job detail slide-up panel
 *  - Category filter buttons
 */

// ── State ─────────────────────────────────────────────────────────────────────
let map;
let markers;          // Leaflet LayerGroup
let activeFilter = "";

window._jobs = [];    // shared with auth.js for the contact modal

// ── Category visual config ────────────────────────────────────────────────────
const CAT = {
  renovation:  { label: "Reformas",     emoji: "🏗", color: "#f5a623" },
  electrical:  { label: "Electricidad", emoji: "⚡", color: "#facc15" },
  plumbing:    { label: "Fontanería",   emoji: "🔧", color: "#60a5fa" },
  painting:    { label: "Pintura",      emoji: "🎨", color: "#c084fc" },
  carpentry:   { label: "Carpintería",  emoji: "🪵", color: "#a3e635" },
  tiling:      { label: "Suelos",       emoji: "🪟", color: "#34d399" },
  roofing:     { label: "Cubiertas",    emoji: "🏠", color: "#fb923c" },
  demolition:  { label: "Demolición",   emoji: "⛏",  color: "#f87171" },
  other:       { label: "Otros",        emoji: "🔩", color: "#94a3b8" },
};


// ── Initialise map ────────────────────────────────────────────────────────────

function initMap() {
  map = L.map("map", {
    center: [41.3851, 2.1734],   // Barcelona centre
    zoom: 13,
    zoomControl: false,
  });

  L.control.zoom({ position: "bottomright" }).addTo(map);

  // Dark CartoDB tiles match the app's dark theme
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution: '© <a href="https://carto.com/">CARTO</a>',
    subdomains: "abcd",
    maxZoom: 19,
  }).addTo(map);

  markers = L.layerGroup().addTo(map);
}


// ── Fetch jobs from API ───────────────────────────────────────────────────────

async function loadJobs(category = activeFilter) {
  try {
    const qs = new URLSearchParams({ status: "open" });
    if (category) qs.append("category", category);

    const jobs = await api.get(`/jobs?${qs}`);
    window._jobs = jobs;

    renderMarkers(jobs);
    renderSidebar(jobs);
    document.getElementById("countNum").textContent = jobs.length;
  } catch (err) {
    console.error("loadJobs error:", err);
    document.getElementById("jobsList").innerHTML = `
      <div class="empty">
        <div class="empty-icon">⚠️</div>
        <div class="empty-txt">No se pudieron cargar las obras.<br>Comprueba que el servidor está corriendo.</div>
      </div>`;
  } finally {
    // Hide the loading overlay (first load only)
    const el = document.getElementById("loading");
    if (el) { el.classList.add("out"); setTimeout(() => el.remove(), 500); }
  }
}


// ── Build a custom Leaflet marker icon ────────────────────────────────────────

function makeIcon(category) {
  const cfg  = CAT[category] || CAT.other;
  const size = 36;

  return L.divIcon({
    className: "",
    html: `
      <div style="
        width:${size}px; height:${size}px;
        background:${cfg.color};
        border: 2px solid rgba(255,255,255,.3);
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        box-shadow: 0 3px 10px rgba(0,0,0,.5);
        display: flex; align-items: center; justify-content: center;
      ">
        <span style="transform:rotate(45deg); font-size:${size * .44}px; line-height:1;">
          ${cfg.emoji}
        </span>
      </div>`,
    iconSize:   [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor:[0, -size],
  });
}


// ── Place markers on the map ──────────────────────────────────────────────────

function renderMarkers(jobs) {
  markers.clearLayers();

  jobs.forEach(job => {
    const marker = L.marker([job.latitude, job.longitude], { icon: makeIcon(job.category) });
    const price  = job.price ? `€${Number(job.price).toLocaleString("es-ES")}` : "A convenir";

    marker.bindPopup(`
      <div style="min-width:190px; padding:2px">
        <div class="popup-title">${esc(job.title)}</div>
        <div class="popup-price">${price}</div>
        <button class="popup-btn" onclick="showDetail(${job.id})">Ver detalles →</button>
      </div>`, { maxWidth: 240 });

    marker.on("click", () => {
      showDetail(job.id);
      highlightCard(job.id);
    });

    markers.addLayer(marker);
  });
}


// ── Sidebar ───────────────────────────────────────────────────────────────────

function renderSidebar(jobs) {
  const el = document.getElementById("jobsList");

  if (!jobs.length) {
    el.innerHTML = `<div class="empty"><div class="empty-icon">🔍</div><div class="empty-txt">No hay obras en esta categoría.</div></div>`;
    return;
  }

  el.innerHTML = jobs.map(job => {
    const cfg   = CAT[job.category] || CAT.other;
    const price = job.price ? `€${Number(job.price).toLocaleString("es-ES")}` : "A convenir";
    const date  = new Date(job.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "short" });

    return `
      <div class="job-card" id="card-${job.id}" onclick="clickCard(${job.id})">
        <div class="card-top">
          <div class="card-title">${esc(job.title)}</div>
          <div class="card-price">${price}</div>
        </div>
        <div class="card-tags">
          <span class="tag tag-cat">${cfg.emoji} ${cfg.label}</span>
          ${job.district ? `<span class="tag tag-dist">📍 ${esc(job.district)}</span>` : ""}
        </div>
        <p class="card-desc">${esc(job.description)}</p>
        <div class="card-date">Publicado el ${date}</div>
      </div>`;
  }).join("");
}


// ── Detail panel ──────────────────────────────────────────────────────────────

function showDetail(jobId) {
  const job = window._jobs.find(j => j.id === jobId);
  if (!job) return;

  const cfg   = CAT[job.category] || CAT.other;
  const price = job.price
    ? `€${Number(job.price).toLocaleString("es-ES")} <small>presupuesto</small>`
    : `<small style="font-size:17px">Presupuesto a convenir</small>`;
  const date  = new Date(job.created_at).toLocaleDateString("es-ES",
    { weekday: "long", day: "numeric", month: "long" });

  document.getElementById("dCat").textContent   = `${cfg.emoji} ${cfg.label.toUpperCase()}`;
  document.getElementById("dTitle").textContent = job.title;
  document.getElementById("dPrice").innerHTML   = price;
  document.getElementById("dDesc").textContent  = job.description;

  document.getElementById("dMeta").innerHTML = `
    ${job.district   ? `<span class="tag tag-dist">📍 ${esc(job.district)}</span>` : ""}
    <span class="tag" style="background:#1a1f2e;color:#aaa;border:1px solid #2a2f3e">📅 ${date}</span>
    ${job.owner_name ? `<span class="tag" style="background:#1a1f2e;color:#aaa;border:1px solid #2a2f3e">👤 ${esc(job.owner_name)}</span>` : ""}
  `;

  document.getElementById("dActions").innerHTML = `
    <button class="btn btn-primary" style="justify-content:center" onclick="openContactFor(${job.id})">
      ✉️ Contactar al cliente
    </button>
    <button class="btn btn-ghost" style="justify-content:center;font-size:12px" onclick="flyTo(${job.id})">
      🗺 Centrar en mapa
    </button>
  `;

  document.getElementById("detail").classList.add("open");
  highlightCard(jobId);
}

function closeDetail() {
  document.getElementById("detail").classList.remove("open");
  document.querySelectorAll(".job-card").forEach(c => c.classList.remove("active"));
}

function clickCard(jobId) {
  const job = window._jobs.find(j => j.id === jobId);
  if (job) {
    map.flyTo([job.latitude, job.longitude], 15, { duration: 0.8 });
    showDetail(jobId);
  }
}

function flyTo(jobId) {
  const job = window._jobs.find(j => j.id === jobId);
  if (job) map.flyTo([job.latitude, job.longitude], 16, { duration: 1 });
}

function highlightCard(jobId) {
  document.querySelectorAll(".job-card").forEach(c => c.classList.remove("active"));
  const card = document.getElementById(`card-${jobId}`);
  if (card) {
    card.classList.add("active");
    card.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}


// ── Category filters ──────────────────────────────────────────────────────────

document.querySelectorAll(".filter-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    activeFilter = btn.dataset.cat;
    closeDetail();
    loadJobs(activeFilter);
  });
});


// ── Utility ───────────────────────────────────────────────────────────────────

/** Escape HTML — prevents XSS when injecting user-generated content into innerHTML */
function esc(s) {
  if (!s) return "";
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
          .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}


// ── Bootstrap ─────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  initMap();
  loadJobs();

  // Close any modal when clicking the dark overlay background
  document.querySelectorAll(".overlay").forEach(o =>
    o.addEventListener("click", e => { if (e.target === o) o.classList.remove("open"); })
  );
});
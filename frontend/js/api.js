/**
 * api.js — обгортка fetch() для спілкування з FastAPI бекендом.
 *
 * ВАЖЛИВО: API_BASE тепер включає /api префікс.
 * Всі роути: /api/auth/login, /api/jobs, тощо.
 */

const API_BASE = "http://localhost:8000/api";

async function apiFetch(path, opts = {}) {
  const token = getToken();

  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...opts.headers,
  };

  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });

  if (res.status === 401) {
    clearToken();
    updateTopbar();
    showToast("Sesión caducada. Inicia sesión de nuevo.", "error");
    throw new Error("Unauthorized");
  }

  const data = await res.json();

  if (!res.ok) {
    let msg;
    if (Array.isArray(data.detail)) {
      msg = data.detail.map(e => {
        const field = e.loc?.length > 1 ? `${e.loc[e.loc.length - 1]}: ` : "";
        return field + (e.msg || "Error");
      }).join(" | ");
    } else {
      msg = data.detail || "Error en la API";
    }
    throw new Error(msg);
  }

  return data;
}

const api = {
  get:    (path)       => apiFetch(path, { method: "GET" }),
  post:   (path, body) => apiFetch(path, { method: "POST",  body: JSON.stringify(body) }),
  patch:  (path, body) => apiFetch(path, { method: "PATCH", body: JSON.stringify(body) }),
  put:    (path, body) => apiFetch(path, { method: "PUT",   body: JSON.stringify(body) }),
  delete: (path)       => apiFetch(path, { method: "DELETE" }),
};
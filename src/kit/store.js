// Save small things on the iPad (guest book entries, settings, scores). Survives restarts.
// Note: the home-screen app and Safari keep separate storage on iOS 8.

export function load(key, fallback = null) {
  try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); } catch { return fallback; }
}

export function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } // full or private mode
}

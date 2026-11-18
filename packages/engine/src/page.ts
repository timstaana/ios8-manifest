// Page behaviour for a full-screen iPad app on iOS 8, and saving small things on the device.

/** True when opened from the home screen (full screen, no Safari bars). */
export const isHomeScreenApp = () => !!(navigator as Navigator & { standalone?: boolean }).standalone;

/** Pixels at the top under the status bar: 20 in a home-screen app (the page runs full screen under it), else 0.
 *  Keep buttons and text below this. */
export function safeTop(): number { return isHomeScreenApp() ? 20 : 0; }

/** What to paint behind the status bar (app.config.json "statusBar"): '#000' for "black", translucent black for
 *  "dim", null for "overlay" (the page shows through; keep the top of it dark so the white text stays readable). */
export function statusBarFill(): string | null {
  if (!isHomeScreenApp()) return null;
  const m = document.querySelector('meta[name="status-bar"]'), v = m && m.getAttribute('content');
  return v === 'black' ? '#000' : v === 'dim' ? 'rgba(0,0,0,0.45)' : null;
}

/** Stop the page bouncing, scrolling, pinch-zooming and showing the copy/save menu.
 *  Elements with a data-scroll attribute (or inside one) can still scroll. */
export function lockPage() {
  document.addEventListener('touchmove', (e) => {
    for (let el = e.target as Node | null; el && el !== document; el = el.parentNode) if ((el as Element).hasAttribute && (el as Element).hasAttribute('data-scroll')) return;
    e.preventDefault();
  }, false);
  document.addEventListener('gesturestart', (e) => e.preventDefault(), false);
  window.addEventListener('contextmenu', (e) => e.preventDefault(), false);
}

/** Offline (release builds): when a new version has been downloaded into the app cache, switch to it.
 *  iOS 8 has no service workers; the Application Cache keeps a home-screen app working without Wi-Fi. */
export function autoUpdate() {
  const ac = (window as unknown as { applicationCache?: { status: number; UNCACHED: number; update(): void; swapCache(): void; addEventListener(t: string, f: () => void, c: boolean): void } }).applicationCache;
  if (!ac) return;
  ac.addEventListener('updateready', () => { try { ac.swapCache(); } catch { /* ok */ } location.reload(); }, false);
  setInterval(() => { try { if (ac.status !== ac.UNCACHED) ac.update(); } catch { /* offline */ } }, 5 * 60 * 1000);
}

/** Small "Add to Home Screen" hint when the page is opened in Safari instead of from the home screen. */
export function homeScreenHint(text = 'For full screen: tap Share, then Add to Home Screen') {
  if (isHomeScreenApp()) return;
  const d = document.createElement('div');
  d.textContent = text;
  d.style.cssText = 'position:fixed;left:50%;bottom:16px;z-index:10;-webkit-transform:translateX(-50%);padding:10px 16px;border-radius:12px;background:rgba(0,0,0,.7);color:#fff;font-size:16px';
  document.body.appendChild(d);
  const hide = () => d.parentNode && d.parentNode.removeChild(d);
  d.addEventListener('touchend', hide, false); setTimeout(hide, 8000);
}

/** Save/load small JSON values on the iPad (home-screen app and Safari keep separate storage). */
export function load<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v === null ? fallback : (JSON.parse(v) as T); } catch { return fallback; }
}
export function save(key: string, value: unknown): boolean {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}

// Page behaviour for a full-screen iPad app on iOS 8.

/** True when opened from the home screen (full screen, no Safari bars). */
export const isHomeScreenApp = () => !!navigator.standalone;

/** Stop the page bouncing, scrolling, pinch-zooming and showing the copy/save menu.
 *  Elements with a data-scroll attribute (or inside one) can still scroll. */
export function lockPage() {
  document.addEventListener('touchmove', (e) => {
    for (let el = e.target; el && el !== document; el = el.parentNode) if (el.hasAttribute && el.hasAttribute('data-scroll')) return;
    e.preventDefault();
  }, false);
  document.addEventListener('gesturestart', (e) => e.preventDefault(), false); // pinch
  window.addEventListener('contextmenu', (e) => e.preventDefault(), false);
}

/** Run fn on a tap. Uses touchend (not touchstart): iOS 8 only lets media/audio start from the end of a tap. */
export function onTap(el, fn) {
  let last = 0;
  const handler = (e) => { const now = Date.now(); if (now - last < 400) return; last = now; e.preventDefault(); fn(e); };
  el.addEventListener('touchend', handler, false);
  el.addEventListener('click', handler, false);
  return () => { el.removeEventListener('touchend', handler); el.removeEventListener('click', handler); };
}

/** Offline (release builds): when a new version has been downloaded into the app cache, switch to it.
 *  iOS 8 has no service workers; the Application Cache is what keeps a home-screen app working without Wi-Fi. */
export function autoUpdate() {
  const ac = window.applicationCache;
  if (!ac) return;
  ac.addEventListener('updateready', () => { try { ac.swapCache(); } catch {} location.reload(); }, false);
  setInterval(() => { try { if (ac.status !== ac.UNCACHED) ac.update(); } catch {} }, 5 * 60 * 1000);
}

/** Small "Add to Home Screen" hint when the page is opened in Safari instead of from the home screen. */
export function homeScreenHint(text = 'For full screen: tap Share, then Add to Home Screen') {
  if (isHomeScreenApp()) return;
  const d = document.createElement('div');
  d.textContent = text;
  d.style.cssText = 'position:fixed;left:50%;bottom:16px;z-index:10;-webkit-transform:translateX(-50%);padding:10px 16px;border-radius:12px;background:rgba(0,0,0,.7);color:#fff;font-size:16px';
  document.body.appendChild(d);
  onTap(d, () => d.parentNode && d.parentNode.removeChild(d));
}

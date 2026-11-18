// Video on iOS 8: plays inline (no fullscreen jump) and can be drawn into the p5 canvas.
// The <video> element must stay in the page and visible; it sits behind the canvas (z-index 0).
// Start it from a tap (iOS 8 won't autoplay), and serve it from a host with byte ranges (all normal hosts do).
// Use H.264 + AAC .mp4, 1024x768 or smaller (ipad-push-video converts files).

export function inlineVideo(src, { parent = document.getElementById('stage'), loop = true, muted = true } = {}) {
  const v = document.createElement('video');
  v.src = src; v.loop = loop; v.muted = muted; v.preload = 'auto';
  v.setAttribute('webkit-playsinline', ''); v.setAttribute('playsinline', '');
  if (muted) v.setAttribute('muted', '');
  v.style.width = '100%'; v.style.height = '100%'; // full size behind the canvas: the tested setup (a hidden or tiny video may not decode)
  parent.appendChild(v);
  return {
    el: v,
    play() { v.play(); }, // call from onTap()
    pause() { v.pause(); },
    get ready() { return v.readyState >= 2; },
    /** Draw the current frame into a p5 sketch: vid.draw(p, x, y, w, h) */
    draw(p, x = 0, y = 0, w = p.width, h = p.height) { if (v.readyState >= 2) p.drawingContext.drawImage(v, x, y, w, h); },
  };
}

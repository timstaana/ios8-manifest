/* iOS 8 Safari gaps that core-js doesn't cover (found on the iPad minis). ES5 only. */
window.performance = window.performance || {};
if (!performance.now) { (function (t) { performance.now = function () { return Date.now() - t; }; })(Date.now()); }
(function (P) { // CanvasRenderingContext2D.ellipse (p5 1.9+ uses it)
  if (P && !P.ellipse) P.ellipse = function (x, y, rx, ry, rot, a0, a1, ccw) { this.save(); this.translate(x, y); this.rotate(rot); this.scale(rx, ry); this.arc(0, 0, 1, a0, a1, !!ccw); this.restore(); };
})(window.CanvasRenderingContext2D && CanvasRenderingContext2D.prototype);
(function (P) { // CanvasRenderingContext2D.roundRect (p5 1.10+ uses it for rect() with corner radii; Safari added it in 16)
  if (!P || P.roundRect) return;
  P.roundRect = function (x, y, w, h, r) {
    var a = Object.prototype.toString.call(r) === '[object Array]' ? r : [r === undefined ? 0 : r];
    var g = function (i) { var v = a[i]; return v && typeof v === 'object' ? +v.x || 0 : +v || 0; };
    var tl, tr, br, bl;
    if (a.length === 1) { tl = tr = br = bl = g(0); } else if (a.length === 2) { tl = br = g(0); tr = bl = g(1); }
    else if (a.length === 3) { tl = g(0); tr = bl = g(1); br = g(2); } else { tl = g(0); tr = g(1); br = g(2); bl = g(3); }
    if (w < 0) { x += w; w = -w; } if (h < 0) { y += h; h = -h; }
    var m = Math.min(w, h) / 2; tl = Math.min(tl, m); tr = Math.min(tr, m); br = Math.min(br, m); bl = Math.min(bl, m);
    this.moveTo(x + tl, y); this.lineTo(x + w - tr, y); this.arcTo(x + w, y, x + w, y + tr, tr);
    this.lineTo(x + w, y + h - br); this.arcTo(x + w, y + h, x + w - br, y + h, br);
    this.lineTo(x + bl, y + h); this.arcTo(x, y + h, x, y + h - bl, bl);
    this.lineTo(x, y + tl); this.arcTo(x, y, x + tl, y, tl); this.closePath();
  };
})(window.CanvasRenderingContext2D && CanvasRenderingContext2D.prototype);
(function (saved) { // put back the natives core-js replaced (see tools/natives-before.js)
  if (!saved) return;
  for (var k in saved) { var dot = k.indexOf('.'), proto = window[k.substring(0, dot)].prototype, name = k.substring(dot + 1); if (saved[k] && proto[name] !== saved[k]) proto[name] = saved[k]; }
})(window.__ios8natives);
// Safari 8 has no Object.assign and core-js's is slow (210 us a call; p5's pop() uses it): a plain ES5 one.
Object.assign = function (target) {
  for (var i = 1; i < arguments.length; i++) { var s = arguments[i]; if (s != null) for (var k in s) if (Object.prototype.hasOwnProperty.call(s, k)) target[k] = s[k]; }
  return target;
};
// Babel's super-call helper (_get) uses Reflect.get; core-js's is slow and p5 calls super on every push/pop/fill.
if (window.Reflect) Reflect.get = function (target, key, receiver) {
  for (var o = target; o; o = Object.getPrototypeOf(o)) {
    var d = Object.getOwnPropertyDescriptor(o, key);
    if (d) return d.get ? d.get.call(arguments.length < 3 ? target : receiver) : d.value;
  }
};

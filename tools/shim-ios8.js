/* iOS 8 Safari gaps that core-js doesn't cover (found on the iPad minis). ES5 only. */
window.performance = window.performance || {};
if (!performance.now) { (function (t) { performance.now = function () { return Date.now() - t; }; })(Date.now()); }
(function (P) { // CanvasRenderingContext2D.ellipse (p5 1.9+ uses it)
  if (P && !P.ellipse) P.ellipse = function (x, y, rx, ry, rot, a0, a1, ccw) { this.save(); this.translate(x, y); this.rotate(rot); this.scale(rx, ry); this.arc(0, 0, 1, a0, a1, !!ccw); this.restore(); };
})(window.CanvasRenderingContext2D && CanvasRenderingContext2D.prototype);

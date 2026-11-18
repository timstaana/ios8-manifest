/* Benchmark showcase examples on the iPad (no screenshots meanwhile!). Run: npm run ipad:eval -- --file tools/device/bench-examples.js
 * Optional first: npm run ipad:eval -- "window.__ids = ['paint', 'sprites']". Then poll: npm run ipad:eval -- "JSON.stringify(__bench)"
 * until running is false. Each example: 1.5 s to settle, then 3 s of frame times (average fps, 90th-percentile frame). */
(function () {
  var ids = window.__ids || ['menu','paint','multi-touch','pinch','tilt','synth','drums','video','sprites','keyboard','fonts','pixels','generative','speed'], out = {}, k = 0;
  window.__bench = { running: true, out: out };
  function next() {
    if (k >= ids.length) { window.__bench.running = false; __app.open('menu'); return; }
    var id = ids[k++]; __app.open(id);
    setTimeout(function () {
      var fr = [], last = 0, t0 = 0;
      function f(t) { var n = performance.now(); if (!t0) t0 = n; else fr.push(n - last); last = n; if (n - t0 < 3000) requestAnimationFrame(f); else { fr.sort(function (a, b) { return a - b; }); var s = 0; for (var i = 0; i < fr.length; i++) s += fr[i]; out[id] = Math.round(1000 / (s / fr.length)) + 'fps p90=' + Math.round(fr[Math.floor(fr.length * 0.9)]) + 'ms'; next(); } }
      requestAnimationFrame(f);
    }, 1500);
  }
  next(); return 'started';
})()

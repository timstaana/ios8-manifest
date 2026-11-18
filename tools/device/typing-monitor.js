/* Watch someone type: logs to the dev server every 3 s while keys are pressed in the showcase's Keyboard example:
 * key event lag, key→screen (input event to the next frame), frame times and draw cost. Runs 4 minutes.
 * Run: npm run ipad:eval -- --file tools/device/typing-monitor.js, then ask them to type and read the dev server log. */
(function () {
  if (window.__tmon) return 'already running';
  var p = __p, keys = [], visual = [], frames = [], drawMs = [], pending = [], lastF = 0, stop = false, all = [];
  window.__tmon = { all: all };
  if (__app.current !== 'keyboard') __app.open('keyboard');
  var noLoop = p.noLoop; p.noLoop = function () {}; p.loop(); // keep drawing every frame, like an ordinary sketch
  var d = p.draw; p.draw = function () { var a = performance.now(); d.apply(this, arguments); drawMs.push(performance.now() - a); };
  function onKey(e) {
    var ts = e.timeStamp, lag = ts > 1e12 ? Date.now() - ts : performance.now() - ts;
    keys.push({ t: e.type, lag: lag });
    if (e.type === 'input') pending.push(performance.now());
  }
  ['keydown', 'keypress', 'input', 'keyup'].forEach(function (t) { document.addEventListener(t, onKey, true); });
  function f() {
    var n = performance.now(); if (lastF) frames.push(n - lastF); lastF = n;
    while (pending.length) visual.push(n - pending.shift());
    if (!stop) requestAnimationFrame(f);
  }
  requestAnimationFrame(f);
  function st(a) { if (!a.length) return '-'; var s = 0, m = 0; for (var i = 0; i < a.length; i++) { s += a[i]; m = Math.max(m, a[i]); } return Math.round(s / a.length) + '/' + Math.round(m); }
  var timer = setInterval(function () {
    var downs = keys.filter(function (k) { return k.t === 'keydown'; });
    if (downs.length) {
      var line = 'typing: ' + downs.length + ' keys | keydown lag avg/max ' + st(downs.map(function (k) { return k.lag; })) + 'ms | key→screen ' + st(visual) + 'ms | frame ' + st(frames) + 'ms | draw ' + st(drawMs) + 'ms';
      console.log(line); all.push(line);
    }
    keys = []; visual = []; frames = []; drawMs = [];
  }, 3000);
  setTimeout(function () { stop = true; clearInterval(timer); p.noLoop = noLoop; p.draw = d; ['keydown', 'keypress', 'input', 'keyup'].forEach(function (t) { document.removeEventListener(t, onKey, true); }); console.log('typing monitor stopped'); window.__tmon = null; }, 240000);
  return 'monitoring for 4 minutes';
})()

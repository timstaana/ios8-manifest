/* Dev only, injected into index.html by tools/dev.mjs. ES5 on purpose: it must run even if app.js fails.
   - console.log/warn/error and uncaught errors go to the laptop terminal
   - the page reloads itself when you save; a build error shows as a red banner
   - npm run ipad:eval -- "code" runs code on the iPad from the laptop */
(function () {
  var BUILD = '{{BUILD}}', queue = [], sending = false;
  function post(url, body, cb) { try { var x = new XMLHttpRequest(); x.open('POST', url, true); x.setRequestHeader('Content-Type', 'application/json'); x.onreadystatechange = function () { if (x.readyState === 4 && cb) cb(); }; x.send(body); } catch (e) { if (cb) cb(); } }
  function flush() { if (sending || !queue.length) return; sending = true; var batch = queue.splice(0, queue.length); post('/__dev/log', JSON.stringify(batch), function () { sending = false; flush(); }); }
  function str(a) { if (a instanceof Error) return a.stack || String(a); if (typeof a === 'object') { try { return JSON.stringify(a); } catch (e) { return String(a); } } return String(a); }
  function hook(level) { var orig = console[level]; console[level] = function () { var parts = []; for (var i = 0; i < arguments.length; i++) parts.push(str(arguments[i])); queue.push({ level: level, msg: parts.join(' ') }); flush(); if (orig) orig.apply(console, arguments); }; }
  hook('log'); hook('warn'); hook('error'); hook('info');
  window.onerror = function (msg, src, line, col) { queue.push({ level: 'error', msg: msg + ' (' + String(src || '').split('/').pop() + ':' + line + ')' }); flush(); };
  function banner(text) { var b = document.getElementById('__dev'); if (!b) { b = document.createElement('pre'); b.id = '__dev'; b.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:99999;margin:0;padding:10px;background:#c00;color:#fff;font:13px Menlo,monospace;white-space:pre-wrap'; document.documentElement.appendChild(b); } b.textContent = text; }
  // remote eval (npm run ipad:eval): run the code, send back the result (or the error); poll faster for a while after
  var hot = 0;
  function runJobs(jobs) {
    for (var i = 0; i < jobs.length; i++) {
      var out; hot = Date.now() + 30000;
      try { out = str((0, eval)(jobs[i].code)); } catch (e) { out = 'Error: ' + (e && e.message || e); }
      post('/__dev/eval-result', JSON.stringify({ id: jobs[i].id, out: String(out) }));
    }
  }
  function poll() {
    var x = new XMLHttpRequest(); x.open('GET', '/__dev/version?' + Date.now(), true);
    x.onreadystatechange = function () {
      if (x.readyState !== 4) return;
      if (x.status === 200) { try { var v = JSON.parse(x.responseText); if (v.error) banner('Build error\n' + v.error); else if (v.id !== BUILD) location.reload(); runJobs(v.eval || []); } catch (e) {} }
      setTimeout(poll, hot > Date.now() ? 250 : 1000);
    };
    x.send();
  }
  setTimeout(poll, 1000);
  queue.push({ level: 'info', msg: 'loaded build ' + BUILD + (navigator.standalone ? ' (home screen app)' : ' (Safari)') + ' ' + innerWidth + 'x' + innerHeight }); flush();
})();

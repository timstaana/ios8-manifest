/* Time single p5 calls on the iPad (µs per call, 500 calls each), against raw canvas calls.
 * Run: npm run ipad:eval -- --file tools/device/bench-p5-calls.js (prints the result). */
(function () {
  var p = __p, c = p.drawingContext, img = p.createGraphics(24, 24).get(), col = p.color('#2196f3'), N = 500, out = [];
  function t(name, f) { var a = performance.now(); for (var i = 0; i < N; i++) f(i); out.push(name + ' ' + ((performance.now() - a) * 1000 / N).toFixed(1) + 'us'); }
  p.push();
  t('raw ctx.fillRect', function (i) { c.fillRect(i % 300, 10, 10, 10); });
  t('p.rect', function (i) { p.rect(i % 300, 10, 10, 10); });
  t('p.ellipse', function (i) { p.ellipse(i % 300, 10, 10, 10); });
  t('p.fill(hex string)', function () { p.fill('#2196f3'); });
  t('p.fill(r,g,b)', function () { p.fill(33, 150, 243); });
  t('p.fill(p5.Color)', function () { p.fill(col); });
  t('p.image(fast img)', function (i) { p.image(img, i % 300, 10); });
  t('raw ctx.drawImage', function (i) { c.drawImage(img._fastImg || img.canvas, i % 300, 10); });
  t('p.push+pop', function () { p.push(); p.pop(); });
  t('p.translate', function () { p.translate(1, 1); });
  t('p.text', function (i) { p.text('Aa', i % 300, 40); });
  t('p.line', function (i) { p.line(0, 0, i % 300, 50); });
  t('p.background(hex)', function () { p.background('#fafafa'); });
  p.pop();
  return out.join(' | ');
})()

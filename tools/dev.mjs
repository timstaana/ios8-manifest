// Dev server: rebuilds on save, iPads reload themselves, their console shows up here.
// npm run dev   then open the printed URL on an iPad (npm run ipad:open) or install it (npm run ipad:install).
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync, watch } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { build, config, DIST, ROOT } from './build.mjs';
import { lanAddress } from './dev-address.mjs';

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.mov': 'video/quicktime',
  '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff': 'font/woff', '.appcache': 'text/cache-manifest' };
const C = { dim: '\x1b[2m', red: '\x1b[31m', yellow: '\x1b[33m', cyan: '\x1b[36m', reset: '\x1b[0m' };

let state = { id: null, error: null };
async function rebuild(why) {
  try { const r = await build({ dev: true }); state = { id: r.id, error: null }; console.log(`${C.dim}${time()} built (${why}) in ${r.ms} ms${C.reset}`); }
  catch (e) { state = { id: state.id, error: e.message }; console.log(`${C.red}${time()} build failed: ${e.message}${C.reset}`); }
}
const time = () => new Date().toTimeString().slice(0, 8);

const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (process.argv.includes('--static')) console.log(`${C.dim}${time()} ${(req.socket.remoteAddress || '').replace('::ffff:', '')} ${req.method} ${req.url}${C.reset}`);
  if (url.pathname === '/__dev/version') { res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); return res.end(JSON.stringify(state)); }
  if (url.pathname === '/__dev/log' && req.method === 'POST') {
    let body = ''; req.on('data', (c) => (body += c)); req.on('end', () => {
      const who = (req.socket.remoteAddress || '').replace('::ffff:', '');
      try { for (const m of JSON.parse(body)) console.log(`${m.level === 'error' ? C.red : m.level === 'warn' ? C.yellow : C.cyan}[${who}] ${m.msg}${C.reset}`); } catch {}
      res.writeHead(204); res.end();
    });
    return;
  }
  let path = normalize(join(DIST, decodeURIComponent(url.pathname)));
  if (!path.startsWith(DIST)) { res.writeHead(403); return res.end(); }
  if (existsSync(path) && statSync(path).isDirectory()) path = join(path, 'index.html');
  if (!existsSync(path)) { res.writeHead(404); return res.end('not found'); }
  const size = statSync(path).size, type = TYPES[extname(path).toLowerCase()] || 'application/octet-stream';
  const head = { 'Content-Type': type, 'Cache-Control': 'no-store', 'Accept-Ranges': 'bytes' };
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || ''); // iOS needs byte ranges for <audio>/<video>
  if (range) {
    let start = range[1] ? +range[1] : Math.max(0, size - +range[2]); let end = range[1] && range[2] ? +range[2] : size - 1;
    if (start >= size) { res.writeHead(416, { 'Content-Range': `bytes */${size}` }); return res.end(); }
    end = Math.min(end, size - 1);
    res.writeHead(206, { ...head, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': end - start + 1 });
    return createReadStream(path, { start, end }).pipe(res);
  }
  res.writeHead(200, { ...head, 'Content-Length': size });
  createReadStream(path).pipe(res);
});

const STATIC = process.argv.includes('--static'); // npm run serve: serve dist/ as built (release + offline cache), no rebuilds
if (STATIC) state = { id: 'static', error: null }; else await rebuild('start');
let timer = null;
if (!STATIC) for (const dir of ['src', 'public', 'vendor']) watch(join(ROOT, dir), { recursive: true }, (_, f) => { clearTimeout(timer); timer = setTimeout(() => rebuild(`${dir}/${f}`), 120); });
if (!STATIC) watch(join(ROOT, 'app.config.json'), () => { clearTimeout(timer); timer = setTimeout(() => rebuild('app.config.json'), 120); });
const port = config().devPort || 8080;
server.listen(port, '0.0.0.0', () => console.log(`\n  ${config().name}${STATIC ? ' (dist/ as built)' : ''}: http://${lanAddress()}:${port}/   (iPad: npm run ipad:open, or npm run ipad:install for the home screen)\n`));

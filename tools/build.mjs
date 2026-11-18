// Build src/ + public/ + vendor/ into dist/ for iOS 8 Safari.
// node tools/build.mjs        release build (minified, offline cache if app.config.json "offline")
// import { build } from it    used by tools/dev.mjs with { dev: true }
import * as esbuild from 'esbuild';
import { transformAsync } from '@babel/core';
import { minify } from 'terser';
import * as acorn from 'acorn';
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { BABEL_IOS8 } from './babel.mjs';

export const ROOT = new URL('..', import.meta.url).pathname;
export const DIST = join(ROOT, 'dist');
export const config = () => JSON.parse(readFileSync(join(ROOT, 'app.config.json'), 'utf8'));

function walk(dir) {
  return readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
}

/** Show where newer-than-ES5 code is, instead of letting the iPad fail silently. */
function assertES5(code, label) {
  try { acorn.parse(code, { ecmaVersion: 5 }); }
  catch (e) {
    const at = code.slice(Math.max(0, e.pos - 60), e.pos + 40).replace(/\s+/g, ' ');
    throw new Error(`${label} is not ES5 after transpiling (iOS 8 would fail here): ...${at}...`);
  }
}

export async function build({ dev = false } = {}) {
  const cfg = config();
  const t0 = Date.now();
  // 1. bundle modern JS (imports, let/const, arrows, classes...) into one ES2015 file
  const bundled = await esbuild.build({
    entryPoints: [join(ROOT, 'src/main.js')], bundle: true, format: 'iife', target: 'es2015',
    write: false, logLevel: 'silent', define: { __DEV__: String(dev) },
  });
  // 2. rewrite to ES5 for Safari 8, 3. minify for release
  let code = (await transformAsync(bundled.outputFiles[0].text, { ...BABEL_IOS8, compact: !dev, filename: 'app.js' })).code;
  if (!dev) code = (await minify(code, { ecma: 5, compress: { passes: 2 }, mangle: true, safari10: true })).code;
  assertES5(code, 'src/');

  rmSync(DIST, { recursive: true, force: true }); mkdirSync(DIST, { recursive: true });
  cpSync(join(ROOT, 'public'), DIST, { recursive: true });
  cpSync(join(ROOT, 'vendor'), join(DIST, 'vendor'), { recursive: true });
  writeFileSync(join(DIST, 'app.js'), code);

  const id = createHash('sha1').update(code).update(String(Date.now())).digest('hex').slice(0, 10);
  const offline = !dev && cfg.offline;
  let html = readFileSync(join(ROOT, 'public/index.html'), 'utf8')
    .replace('{{DEV}}', dev ? `<script>${readFileSync(join(ROOT, 'tools/dev-client.js'), 'utf8')}</script>` : '')
    .replaceAll('{{NAME}}', cfg.name).replaceAll('{{SHORT_NAME}}', cfg.shortName || cfg.name)
    .replaceAll('{{BG}}', cfg.background || '#000').replaceAll('{{BUILD}}', id)
    .replace('{{MANIFEST}}', offline ? 'manifest="app.appcache"' : '');
  writeFileSync(join(DIST, 'index.html'), html);

  if (offline) { // iOS 8 has no service workers; the Application Cache keeps a home-screen app working offline
    const files = walk(DIST).map((p) => relative(DIST, p)).filter((p) => p !== 'app.appcache').sort();
    const hash = createHash('sha1'); for (const f of files) hash.update(f).update(readFileSync(join(DIST, f)));
    writeFileSync(join(DIST, 'app.appcache'), `CACHE MANIFEST\n# ${hash.digest('hex').slice(0, 12)}\n${files.map(encodeURI).join('\n')}\n\nNETWORK:\n*\n`);
  }
  return { id, ms: Date.now() - t0, bytes: code.length, offline };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  build().then((r) => console.log(`dist/ built in ${r.ms} ms: app.js ${(r.bytes / 1024).toFixed(1)} KB, ES5 OK${r.offline ? ', offline cache on' : ''}`))
    .catch((e) => { console.error(e.message); process.exit(1); });
}

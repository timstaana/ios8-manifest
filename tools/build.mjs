// Build an app (apps/<name>: src/ + public/ + the shared vendor/) into a folder for iOS 8 Safari.
// node tools/build.mjs [--app apps/showcase] [--out dist]    release build (minified, offline cache if "offline")
// import { build } from it                                    used by tools/dev.mjs with { dev: true }
import * as esbuild from 'esbuild';
import { transformAsync } from '@babel/core';
import { minify } from 'terser';
import * as acorn from 'acorn';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { BABEL_IOS8 } from './babel.mjs';
import { ROOT, appArgs, appConfig } from './app.mjs';

export { ROOT };

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

export async function build(appDir, { dev = false, outDir = join(appDir, 'dist') } = {}) {
  const cfg = appConfig(appDir);
  const t0 = Date.now();
  const entry = ['src/main.ts', 'src/main.js'].map((f) => join(appDir, f)).find(existsSync);
  // 1. bundle modern JS/TS (imports, types, let/const, arrows, classes...) into one ES2015 file
  const bundled = await esbuild.build({
    entryPoints: [entry], bundle: true, format: 'iife', target: 'es2015', write: false, logLevel: 'silent',
    define: { __DEV__: String(dev) },
  });
  // 2. rewrite to ES5 for Safari 8, 3. minify for release
  let code = (await transformAsync(bundled.outputFiles[0].text, { ...BABEL_IOS8, compact: !dev, filename: 'app.js' })).code;
  if (!dev) code = (await minify(code, { ecma: 5, compress: { passes: 2 }, mangle: true, safari10: true })).code;
  assertES5(code, relative(ROOT, appDir) + '/src');

  rmSync(outDir, { recursive: true, force: true }); mkdirSync(outDir, { recursive: true });
  cpSync(join(appDir, 'public'), outDir, { recursive: true });
  cpSync(join(ROOT, 'vendor'), join(outDir, 'vendor'), { recursive: true });
  writeFileSync(join(outDir, 'app.js'), code);

  const id = createHash('sha1').update(code).update(String(Date.now())).digest('hex').slice(0, 10);
  const offline = !dev && cfg.offline;
  const html = readFileSync(join(appDir, 'public/index.html'), 'utf8')
    .replace('{{DEV}}', dev ? `<script>${readFileSync(join(ROOT, 'tools/dev-client.js'), 'utf8')}</script>` : '')
    .replaceAll('{{NAME}}', cfg.name).replaceAll('{{SHORT_NAME}}', cfg.shortName || cfg.name)
    .replaceAll('{{BG}}', cfg.background || '#000')
    // The page always runs full screen under the status bar (its text is always white on iOS 8, checked on IPAD-02).
    // "black" / "dim": the engine paints a solid / translucent black strip behind it. "overlay": nothing behind it.
    .replaceAll('{{STATUS_BAR}}', ['black', 'dim', 'overlay'].includes(cfg.statusBar) ? cfg.statusBar : 'overlay').replaceAll('{{BUILD}}', id)
    .replace('{{MANIFEST}}', offline ? 'manifest="app.appcache"' : '');
  writeFileSync(join(outDir, 'index.html'), html);

  if (offline) { // iOS 8 has no service workers; the Application Cache keeps a home-screen app working offline
    const files = walk(outDir).map((p) => relative(outDir, p)).filter((p) => p !== 'app.appcache').sort();
    const hash = createHash('sha1'); for (const f of files) hash.update(f).update(readFileSync(join(outDir, f)));
    writeFileSync(join(outDir, 'app.appcache'), `CACHE MANIFEST\n# ${hash.digest('hex').slice(0, 12)}\n${files.map(encodeURI).join('\n')}\n\nNETWORK:\n*\n`);
  }
  return { id, ms: Date.now() - t0, bytes: code.length, offline, outDir };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { appDir, rest } = appArgs();
  const o = rest.indexOf('--out'), outDir = o >= 0 ? resolve(ROOT, rest[o + 1]) : join(appDir, 'dist');
  build(appDir, { outDir }).then((r) => console.log(`${relative(ROOT, r.outDir)}/ built in ${r.ms} ms: app.js ${(r.bytes / 1024).toFixed(1)} KB, ES5 OK${r.offline ? ', offline cache on' : ''}`))
    .catch((e) => { console.error(e.message); process.exit(1); });
}

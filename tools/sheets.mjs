// Pack frame-by-frame art into sprite strips the engine loads (needs ImageMagick).
// npm run sheets [-- --app apps/showcase]
//   apps/<app>/art/<name>/<clip>_<n>.png   (e.g. idle_0.png idle_1.png move_0.png ... — a Krita frame export works)
//   apps/<app>/art/<name>/sheet.json        optional: { "size": 200, "fps": 10, "clips": { "move": { "fps": 12 }, "react": { "loop": false, "next": "idle" } } }
//   -> apps/<app>/public/sheets/<name>.png + <name>.json  (one horizontal strip; clips list frame indexes)
// Every frame is scaled to the same square-ish size: the iPad mini 1 is 1024x768, so 200-300 px frames are plenty.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { appArgs } from './app.mjs';

const { appDir } = appArgs();
const art = join(appDir, 'art'), out = join(appDir, 'public/sheets');
if (!existsSync(art)) { console.log('No art/ folder in this app.'); process.exit(0); }
mkdirSync(out, { recursive: true });

for (const name of readdirSync(art).filter((n) => statSync(join(art, n)).isDirectory())) {
  const dir = join(art, name);
  const opts = existsSync(join(dir, 'sheet.json')) ? JSON.parse(readFileSync(join(dir, 'sheet.json'), 'utf8')) : {};
  const frames = readdirSync(dir).map((f) => /^(.+?)[_-](\d+)\.png$/i.exec(f)).filter(Boolean)
    .map((m) => ({ file: m[0], clip: m[1], n: +m[2] }))
    .sort((a, b) => (a.clip < b.clip ? -1 : a.clip > b.clip ? 1 : a.n - b.n));
  if (!frames.length) continue;
  const [w, h] = execFileSync('magick', ['identify', '-format', '%w %h', join(dir, frames[0].file) + '[0]']).toString().split(' ').map(Number);
  const size = opts.size || Math.min(w, 300), fw = size, fh = Math.round((h / w) * size);
  execFileSync('magick', [...frames.map((f) => join(dir, f.file)), '-resize', `${fw}x${fh}!`, '-background', 'none', '+append', '-strip', join(out, `${name}.png`)]);
  const clips = {};
  frames.forEach((f, i) => { (clips[f.clip] ||= { frames: [], fps: opts.fps || 10, loop: true }).frames.push(i); });
  for (const [c, o] of Object.entries(opts.clips || {})) if (clips[c]) Object.assign(clips[c], o);
  writeFileSync(join(out, `${name}.json`), JSON.stringify({ image: `${name}.png`, frameWidth: fw, frameHeight: fh, clips }, null, 1));
  console.log(`sheets/${name}: ${frames.length} frames at ${fw}x${fh} (${Object.entries(clips).map(([c, v]) => `${c}:${v.frames.length}`).join(' ')})`);
}

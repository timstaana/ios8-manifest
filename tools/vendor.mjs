// Rebuild vendor/: polyfills.js (core-js + iOS 8 shims) and p5.js (p5 1.x rewritten to ES5).
// Usage: node tools/vendor.mjs [p5 version, default 1.11.13]. p5 2.x can't run on iOS 8 (needs Proxy).
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { transformAsync } from '@babel/core';
import * as acorn from 'acorn';
import { BABEL_IOS8 } from './babel.mjs';

const version = process.argv[2] || '1.11.13';
if (!/^[01]\./.test(version)) throw new Error('p5 2.x needs Proxy, which iOS 8 does not have. Use 1.x.');
const root = new URL('..', import.meta.url).pathname;

// Minimal tar reader (npm tarballs are plain ustar).
function untar(buf) {
  const files = {};
  for (let o = 0; o + 512 <= buf.length;) {
    const name = buf.toString('utf8', o, o + 100).replace(/\0.*$/s, '');
    if (!name) break;
    const size = parseInt(buf.toString('utf8', o + 124, o + 136).replace(/\0.*$/s, '').trim() || '0', 8);
    files[name] = buf.subarray(o + 512, o + 512 + size);
    o += 512 + Math.ceil(size / 512) * 512;
  }
  return files;
}

const meta = await (await fetch('https://registry.npmjs.org/p5')).json();
const dist = meta.versions[version]?.dist;
if (!dist) throw new Error(`p5 ${version} not on npm`);
const tgz = Buffer.from(await (await fetch(dist.tarball)).arrayBuffer());
const [algo, b64] = dist.integrity.split('-');
if (createHash(algo).update(tgz).digest('base64') !== b64) throw new Error('p5 tarball failed its npm integrity check');
const files = untar(gunzipSync(tgz));
const src = files['package/lib/p5.min.js'].toString('utf8');

const out = await transformAsync(src, { ...BABEL_IOS8, filename: 'p5.min.js' });
acorn.parse(out.code, { ecmaVersion: 5 }); // throws if anything newer than ES5 slipped through

mkdirSync(root + 'vendor', { recursive: true });
const shim = readFileSync(root + 'tools/shim-ios8.js', 'utf8');
writeFileSync(root + 'vendor/polyfills.js', readFileSync(root + 'node_modules/core-js-bundle/minified.js', 'utf8') + '\n' + shim);
writeFileSync(root + 'vendor/p5.js', `/*! p5.js ${version} (LGPL-2.1), rewritten to ES5 for iOS 8 */\n` + out.code);
console.log(`vendor/p5.js = p5 ${version} (ES5, integrity OK); vendor/polyfills.js = core-js ${JSON.parse(readFileSync(root + 'node_modules/core-js-bundle/package.json')).version} + shims`);

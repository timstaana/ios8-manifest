// Run JavaScript on the iPad from the laptop (dev server must be running and the app open):
//   npm run ipad:eval -- "innerWidth + 'x' + innerHeight"
//   npm run ipad:eval -- --file bench.js
import { readFileSync } from 'node:fs';
import { appArgs, appConfig } from './app.mjs';
const { appDir, rest } = appArgs();
const args = rest;
const fi = args.indexOf('--file');
const code = fi >= 0 ? readFileSync(args[fi + 1], 'utf8') : args.join(' ');
const port = appConfig(appDir).devPort || 8080;
const r = await fetch(`http://127.0.0.1:${port}/__dev/eval`, { method: 'POST', body: code });
console.log(await r.text()); if (!r.ok) process.exit(1);

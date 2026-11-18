// Which app a tool works on: `--app apps/starter`, else the APP env var, else apps/showcase.
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const ROOT = new URL('..', import.meta.url).pathname;

export function appArgs(argv = process.argv.slice(2)) {
  const rest = [...argv];
  let dir = process.env.APP || 'apps/showcase';
  const i = rest.indexOf('--app');
  if (i >= 0) { dir = rest[i + 1]; rest.splice(i, 2); }
  const appDir = resolve(ROOT, dir);
  if (!existsSync(join(appDir, 'app.config.json'))) throw new Error(`${dir} has no app.config.json`);
  return { appDir, rest };
}

export const appConfig = (appDir) => JSON.parse(readFileSync(join(appDir, 'app.config.json'), 'utf8'));

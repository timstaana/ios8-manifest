// Make the home-screen icons and launch screens from one square image (needs ImageMagick).
// npm run icons [-- --app apps/starter]   reads the app's icon-source.png (at least 512x512), writes its public/icons/.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { appArgs, appConfig } from './app.mjs';
const { appDir } = appArgs();

const src = join(appDir, 'icon-source.png'), out = join(appDir, 'public/icons');
if (!existsSync(src)) { console.error('Put a square icon-source.png (512 px or more) in the project folder first.'); process.exit(1); }
mkdirSync(out, { recursive: true });
const bg = appConfig(appDir).background || '#000';
const magick = (...a) => execFileSync('magick', a, { stdio: 'inherit' });

for (const s of [76, 152, 180]) magick(src, '-resize', `${s}x${s}`, '-background', bg, '-flatten', join(out, `icon-${s}.png`));
// iPad mini 1 launch screens: 768x1004 portrait; landscape is 1024x748 rotated into a 748x1024 image (Apple's format).
magick('-size', '768x1004', `xc:${bg}`, '(', src, '-resize', '200x200', ')', '-gravity', 'center', '-composite', join(out, 'launch-portrait.png'));
magick('-size', '1024x748', `xc:${bg}`, '(', src, '-resize', '200x200', ')', '-gravity', 'center', '-composite', '-rotate', '90', join(out, 'launch-landscape.png'));
console.log('public/icons/: icon-76, icon-152, icon-180, launch-portrait, launch-landscape');

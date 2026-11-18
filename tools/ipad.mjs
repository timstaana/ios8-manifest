// Put the app on the USB-connected iPad (uses the iPad tools set up on the laptop: ipad-ssh, pymobiledevice3).
//   npm run ipad:open [-- URL]               open it in Safari
//   npm run ipad:install [-- URL]            add it to the home screen as a full-screen app (no tapping needed)
//   npm run ipad:install -- --profile [URL]  same through a configuration profile (tap Install; no jailbreak needed,
//                                            but iOS then shows a white status bar instead of the see-through one)
//   npm run ipad:remove                      take it off the home screen again
// URL defaults to the dev server on this laptop; use --prod for app.config.json "prodUrl".
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { config, ROOT } from './build.mjs';
import { lanAddress } from './dev-address.mjs';

const args = process.argv.slice(2), cmd = args.shift();
const viaProfile = args[0] === '--profile' && args.shift();
const cfg = config();
const url = args[0] === '--prod' ? cfg.prodUrl : args[0] || `http://${lanAddress()}:${cfg.devPort || 8080}/`;
if (!url) { console.error('No URL: set "prodUrl" in app.config.json or pass one.'); process.exit(1); }
const env = { ...process.env, OPENSSL_CONF: join(homedir(), '.config/ipad-legacy/openssl.cnf') }; // iOS 8 needs old TLS for USB services
const pmd = join(homedir(), '.local/opt/pymobiledevice3/bin/pymobiledevice3');
const run = (bin, a, opts = {}) => {
  try { return execFileSync(bin, a, { env, stdio: 'inherit', ...opts }); }
  catch { console.error(`\n${bin.split('/').pop()} failed. Is an iPad plugged in by USB, trusted and unlocked, with the laptop key on it (ipad-addkey)?`); process.exit(1); }
};
const ssh = (remote, opts) => run('ipad-ssh', ['-o', 'BatchMode=yes', 'root@127.0.0.1', remote], opts);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const label = cfg.shortName || cfg.name;
// One folder per app id, so installing again replaces it instead of adding a second icon.
const clipId = createHash('sha1').update(cfg.id).digest('hex').slice(0, 32).toUpperCase();
const CLIPS = '/var/mobile/Library/WebClips';

/** The status bar style the page asks for, in the form iOS stores for a home-screen app. */
function statusBarStyle() {
  const m = /apple-mobile-web-app-status-bar-style"\s+content="([^"]+)"/.exec(readFileSync(join(ROOT, 'public/index.html'), 'utf8'));
  return { 'black-translucent': 'UIStatusBarStyleLightContent', black: 'UIStatusBarStyleLightContent' }[m && m[1]] || 'UIStatusBarStyleDefault';
}

function installDirect() {
  // Writes the same web clip folder Safari's "Add to Home Screen" makes (checked against one on IPAD-02).
  const dir = mkdtempSync(join(tmpdir(), 'webclip-')), clip = join(dir, `${clipId}.webclip`), icons = join(ROOT, 'public/icons');
  mkdirSync(join(clip, 'Storage'), { recursive: true });
  writeFileSync(join(clip, 'Info.plist'), `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>ClassicMode</key><false/><key>FullScreen</key><true/><key>IconIsPrecomposed</key><false/><key>IconIsScreenShotBased</key><false/>
<key>Orientations</key><integer>0</integer><key>Title</key><string>${esc(label)}</string>
<key>UIStatusBarStyle</key><string>${statusBarStyle()}</string><key>URL</key><string>${esc(url)}</string>
</dict></plist>
`);
  for (const [from, to] of [['icon-76.png', 'icon.png'], ['launch-portrait.png', 'startup.png'], ['launch-landscape.png', 'startup-landscape.png']])
    if (existsSync(join(icons, from))) copyFileSync(join(icons, from), join(clip, to));
  try {
    const tar = execFileSync('tar', ['-C', dir, '-cf', '-', `${clipId}.webclip`]);
    ssh(`mkdir -p ${CLIPS} && cd ${CLIPS} && rm -rf ${clipId}.webclip && tar xf - && chown -R mobile:mobile ${CLIPS} && killall -9 SpringBoard`, { input: tar, stdio: ['pipe', 'inherit', 'inherit'] });
  } finally { rmSync(dir, { recursive: true, force: true }); }
  console.log(`"${label}" -> ${url} is on the home screen (the home screen restarts to show it).`);
}

function installProfile() {
  const icon = join(ROOT, 'public/icons/icon-152.png');
  if (!existsSync(pmd)) { console.error('pymobiledevice3 not found at ' + pmd); process.exit(1); }
  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>PayloadType</key><string>Configuration</string><key>PayloadVersion</key><integer>1</integer>
<key>PayloadIdentifier</key><string>${esc(cfg.id)}</string><key>PayloadUUID</key><string>${randomUUID().toUpperCase()}</string>
<key>PayloadDisplayName</key><string>${esc(cfg.name)}</string><key>PayloadDescription</key><string>${esc(cfg.name)} on the home screen</string>
<key>PayloadContent</key><array><dict>
  <key>PayloadType</key><string>com.apple.webClip.managed</string><key>PayloadVersion</key><integer>1</integer>
  <key>PayloadIdentifier</key><string>${esc(cfg.id)}.webclip</string><key>PayloadUUID</key><string>${randomUUID().toUpperCase()}</string>
  <key>PayloadDisplayName</key><string>${esc(label)}</string>
  <key>Label</key><string>${esc(label)}</string><key>URL</key><string>${esc(url)}</string>
  <key>FullScreen</key><true/><key>IsRemovable</key><true/><key>Precomposed</key><true/>
  ${existsSync(icon) ? `<key>Icon</key><data>${readFileSync(icon).toString('base64')}</data>` : ''}
</dict></array></dict></plist>`;
  const dir = mkdtempSync(join(tmpdir(), 'webclip-')), file = join(dir, 'app.mobileconfig');
  writeFileSync(file, plist);
  try { run(pmd, ['profile', 'install', file]); } finally { rmSync(dir, { recursive: true, force: true }); }
  console.log(`Sent "${label}" -> ${url}. Tap Install on the iPad. (White status bar: iOS ignores the page's style for profile web clips.)`);
}

if (cmd === 'open') {
  ssh(`uiopen "${url}"`);
  console.log(`Opened ${url} in Safari (the iPad must be unlocked).`);
} else if (cmd === 'install') {
  viaProfile ? installProfile() : installDirect();
} else if (cmd === 'remove') {
  ssh(`rm -rf ${CLIPS}/${clipId}.webclip && killall -9 SpringBoard`);
  try { execFileSync(pmd, ['profile', 'remove', cfg.id], { env, stdio: 'ignore' }); } catch {} // in case it was installed with --profile
  console.log(`Removed "${label}" from the iPad's home screen.`);
} else {
  console.log('Usage: node tools/ipad.mjs open | install [--profile] [URL | --prod] | remove');
}

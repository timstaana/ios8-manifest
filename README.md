# iPad app template

A skeleton for full-screen apps and experiences on the iPad mini 1s (IPAD-01 to IPAD-05: iOS 8.4.1, Safari 8, A5 chip, 1024×768). Opened from the home screen, the app runs full screen with no Safari bars, works offline once loaded, and has p5.js 1.11.13 ready to use.

Write normal modern JavaScript in `src/`. The build rewrites it into the older JavaScript Safari 8 understands, and refuses to finish if anything newer slips through, so the iPad never fails silently.

## Start a new project

```bash
cp -r ~/code/ipad-app-template ~/code/my-thing && cd ~/code/my-thing
rm -rf .git dist && git init && npm install
```

Then edit `app.config.json` (name, id, colour), replace `icon-source.png` with your own square image and run `npm run icons`.

## Every day

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on this laptop. Rebuilds on save; open iPads reload themselves. The iPad's `console.log` and errors print in this terminal, and build errors show as a red banner on the iPad. |
| `npm run ipad:open` | Opens the dev server's page in Safari on the iPad plugged in by USB. |
| `npm run ipad:install` | Puts the app on that iPad's home screen as a full-screen app (tap **Install** on the iPad). The same as Add to Home Screen, but sent over USB. |
| `npm run ipad:remove` | Takes it off the home screen again. |
| `npm run build` | Release build in `dist/`: minified, with the offline cache. Upload `dist/` to any static host (Cloudflare, GitHub Pages...), set `prodUrl` in `app.config.json`, then `npm run ipad:install -- --prod`. |
| `npm run icons` | Makes the home-screen icons and launch screens from `icon-source.png`. |

`ipad:open` and `ipad:install` use the iPad tools already set up on the laptop (`ipad-ssh`, pymobiledevice3, the legacy OpenSSL config). The iPad and laptop must be on the same Wi-Fi for the dev server.

## Deploy

Pushing to `main` builds the app and publishes `dist/` to GitHub Pages (`.github/workflows/pages.yml`), at the `prodUrl` in `app.config.json`. Install that version on an iPad with `npm run ipad:install -- --prod`. It loads once over Wi-Fi, then runs offline.

GitHub Pages caches files for up to 10 minutes, so an iPad can take that long to see a new version.

## Files

```
src/main.js        your app (p5 in instance mode: p.ellipse, p.touches...)
src/kit/ios.js     full-screen page behaviour, onTap, offline updates, Add to Home Screen hint
src/kit/sound.js   sound through Web Audio: unlockAudio, loadSound(url).play(), tone()
src/kit/video.js   inline video that can be drawn into the sketch
src/kit/net.js     multiplayer over a plain WebSocket with reconnect
src/kit/store.js   save/load small things on the iPad
public/            index.html, images, sounds, videos, fonts (copied as is)
vendor/            polyfills.js (core-js + iOS 8 shims) and p5.js (1.11.13 rewritten to ES5)
tools/             build, dev server, icons, iPad commands; vendor.mjs rebuilds vendor/
```

## What the iPads can and can't do (tested Nov 2026)

**Fast:** drawing images and sprites (100 at about 50 fps, 300 at about 30). Suits hand-drawn frame animation.
**Slow:** hundreds of shapes, many `text()` calls, full-screen `pixels`, and p5's WEBGL mode (unusable). Draw those once into `p.createGraphics()` and reuse it.

**Works:** multi-touch (5 fingers), typing into inputs, tilt (`p.rotationX/Y`), localStorage, WebSockets (and socket.io), Web Audio and `<audio>`, inline video drawn into the canvas, HTTPS to the big CDNs and timstaana.com.

**Doesn't:** p5.sound's `loadSound().play()` (use `kit/sound.js`), camera and microphone, the Fullscreen API (the home-screen app is the full screen), `fetch` (use `p.loadJSON` or XMLHttpRequest), service workers (the Application Cache does offline), p5 2.x, CSS grid and variables.

## Rules of thumb

- **Start sound and video from a tap.** iOS 8 needs one; `onTap()` uses the end of the tap, which is what iOS accepts.
- **Media needs a server with byte ranges.** The dev server and every normal host have them.
- **Video:** H.264 + AAC `.mp4`, 1024×768 or smaller. Keep the `<video>` element in the page (it sits behind the canvas).
- **The home-screen app keeps its own storage**, separate from Safari's.
- **The status bar stays.** iOS 8 always shows it on top of a home-screen app; the page draws underneath it.
- **Offline cache:** a release build stores every file on the iPad. After you upload a new version, the app picks it up the next time it's opened with Wi-Fi (and checks every 5 minutes while open).
- **Lock the iPad into the app** for a stall with Guided Access (Settings → General → Accessibility).

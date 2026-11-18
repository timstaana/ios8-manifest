# AGENTS.md

How to work in this repo: what it is, how to run and debug things on the real iPads, and the rules that keep code fast and working on iOS 8. Read this before changing anything. `README.md` has the user-facing version.

## What this is

Full-screen web apps for five **iPad mini 1s** (IPAD-01 to IPAD-05): **iOS 8.4.1, Safari 8, A5 chip, 1024×768, jailbroken**. Apps are opened from the home screen as web clips (no Safari bars) and work offline through the Application Cache. Drawing is **p5.js 1.11.13**, rewritten to ES5.

The repo is **public**. Use only art and sounds that are our own (or generated); no trademarked characters. Never commit private details: emails, home paths, Wi-Fi names, local IPs, passwords. App ids are `com.timstaana.*`.

```
apps/showcase/     the showcase: one small plain-p5 example per feature (src/examples/*.ts), run by src/runner.ts
apps/starter/      the smallest app, to copy for a new project
packages/engine/   @ios8/engine: ECS engine (gestures, drag/pinch, tilt, sprites, scenes, UI, audio, page helpers) + vitest tests
vendor/            p5.js (ES5), polyfills.js (core-js + iOS 8 fixes), p5-ios8.js (speed/bug patches); all shared by every app
tools/             build, dev server, sheets, icons, iPad commands (install, shot, eval); tools/device/ = scripts to run on the iPad
```

## Commands

| Command | Use |
|---|---|
| `npm run dev` | dev server (default app: showcase; `--app apps/<name>` for others). Rebuilds on save, iPads reload themselves, the iPad's console prints here. |
| `npm run check` / `npm test` | type check + tests. Run before every commit. |
| `npm run build` | release build into `dist/` (showcase) and `dist/starter/`; fails if anything newer than ES5 gets through. |
| `npm run ipad:install` | put the app on the USB iPad's home screen (dev server URL; `-- --prod` for GitHub Pages). Restarts the home screen, which closes the app: the user has to reopen it. |
| `npm run ipad:eval -- "js"` | run JavaScript in the open app and print the result (dev server only, laptop only). `--file x.js` for longer scripts. |
| `npm run ipad:shot -- out.png` | screenshot of the USB iPad (TIFF from the device, converted). |
| `npm run sheets` / `npm run icons` | pack `art/<name>/<clip>_<n>.png` into sprite strips; make icons and launch images from `icon-source.png`. |
| `node tools/vendor.mjs` | rebuild `vendor/p5.js` and `vendor/polyfills.js` (downloads p5 from npm). |

The laptop needs the iPad tooling set up outside this repo: libimobiledevice with a legacy OpenSSL config (iOS 8 needs SHA-1/TLS 1.0), an `ipad-ssh` script (SSH over USB via `iproxy 2222 22`), pymobiledevice3, ImageMagick, and the iOS 8.4 Developer Disk Image in `~/.local/share/ipad-ddi` for screenshots. The iPad and laptop must be on the same Wi-Fi for the dev server.

## Debugging on the device (do this, don't guess)

The iPads are the only truth: desktop browsers hide every iOS 8 problem.

- **Console**: `console.log` and errors on the iPad print in the dev server's terminal (`[192.168.x.x] ...`).
- **Remote eval**: `npm run ipad:eval -- "__app.current"`. Dev handles: `__p` (the p5 instance), `__app.open('paint')` / `__app.open('menu')`, `__game` (3D game: `setStick(turn, throttle)`, `jump()`), `__gl` (the 3D example's WEBGL instance). The eval runs outside a user gesture, so it can't start audio/video or open the keyboard.
- **Screens**: `npm run ipad:shot -- /tmp/x.png`, then look at it. Screenshotting slows the iPad: never measure performance while taking shots.
- **Perf**: dev builds show an fps graph (top right) and log `perf <example>: N fps, worst M ms` every 3 s. For real numbers use the scripts in `tools/device/`: `bench-examples.js` (fps per example), `bench-p5-calls.js` (µs per p5 call), `typing-monitor.js` (keyboard lag while someone types). They measure inside the page with `requestAnimationFrame` frame gaps and timing around `__p.draw`. When you suspect a polyfill, compare against a clean `iframe` realm (it has Safari's untouched built-ins).
- **With the user**: when something only shows with real hands (typing, tilt, feel), install a monitor through `ipad:eval` that logs per-event timings to the console, ask the user to do the thing, and read the log. Don't change the page's state while they're using it.
- **SSH**: `ipad-ssh -o BatchMode=yes root@127.0.0.1 '<cmd>'` for files on the device (web clips live in `/var/mobile/Library/WebClips/<id>.webclip`). Never type or store device passwords.
- **File watcher**: the dev server polls file times (Node's recursive `fs.watch` misses edits to new files on Linux). Edits to `tools/*.mjs` need a dev server restart.

## iOS 8 rules (each one was found the hard way)

- **Output is ES5.** Write modern TypeScript; esbuild bundles, Babel (`tools/babel.mjs`, loose, computed properties forced) rewrites, acorn rejects anything newer. No `Proxy` (so no p5 2.x), no `fetch` (XMLHttpRequest / `p.loadJSON`), no ES modules at runtime, no service workers, no WebP images (use PNG/JPEG), no CSS grid/variables.
- **Touch**: handlers return `false` (prevent default) so the page doesn't scroll or zoom, **except on form fields**, or the keyboard never opens (the runner's `onForm`). `lockPage()` blocks bounce/zoom.
- **Typing**: autocorrect doubles the keyboard's lag on the A5. `vendor/p5-ios8.js` turns it off for p5's inputs; add `autocorrect="off" autocapitalize="off" spellcheck="false"` to hand-written ones.
- **Sound**: Web Audio only (`loadSound`/`tone` from the engine, or the context from `audio()`); p5.sound's file playback throws. `unlockAudio()` at start-up (it also warms the first sound, which otherwise costs ~300 ms).
- **Video**: H.264 `.mp4`, server with byte ranges. The first `play()` of each video must run inside a touch handler (opening something from a tap counts). Keep the `<video>` in the page (hidden ones don't play); draw it with `p.image(video, ...)`.
- **Status bar**: always white text in a home-screen app (dark text is impossible; tested three ways). The page runs under it; `app.config.json` `"statusBar"`: `"dim"` (translucent strip, the showcase), `"black"` or `"overlay"`. Keep UI below `safeTop()` (20 px).
- **Motion**: use `devicemotion` `accelerationIncludingGravity` for "which way is down" (iOS: x right, y toward the top edge, gravity is negative y when upright); it arrives at only ~20 Hz, so smooth it. `p.rotationX/Y` are angles (fine for small tilts, wrong near upright).
- **p5 bugs patched in `vendor/p5-ios8.js`**: `MediaElement.remove()` and `Graphics.remove()` threw. Keep the patches when upgrading p5.

## Speed rules (measured on the A5)

Raw canvas calls are fast (`drawImage` ~25 µs). The cost is JavaScript, mostly p5's. After our fixes: `image()` ~100 µs, `rect()` ~90, `ellipse()` ~230, `line()` ~40, `fill('#hex')` ~100 (`fill(r,g,b)` ~40), `text()` ~500, `push()+pop()` ~360. A 60 fps frame leaves ~10 ms of JavaScript.

- **Images, not shapes or text.** Draw anything static once into `createGraphics()`, take `g.get()` (a p5.Image), then `image()` it every frame. Never make new graphics or images per frame or per keystroke (that froze typing for 400 ms a key).
- **No `push()`/`pop()` per object**: undo the transform (`scale(-1, 1)` twice) or `resetMatrix()`.
- **Limits**: a few hundred shapes/lines a frame, a few hundred images; pixel effects in a ~100×100 image scaled up with `noSmooth()` (Safari 8 also needs `webkitImageSmoothingEnabled = false`).
- **3D (WEBGL) works at ~30 fps with care**: p5's light and texture shaders fail ("too many uniforms": the A5 has 64 fragment uniform vectors), so write tiny shaders (see `examples/three-d.ts`, `examples/game3d.ts`). Each separate draw costs ~2 ms and `push`/`pop` ~2 ms: keep moving objects to about 12, use `resetMatrix()`, merge static geometry with `buildGeometry()`, and draw floor layers with depth testing off (the depth buffer is coarse). A WEBGL canvas is a second p5 instance behind the 2D one.
- **Why the vendor files matter**: core-js swaps Safari's fast built-ins for slow JavaScript ones (and disguises them as native). `tools/natives-before.js` saves the natives before core-js and `tools/shim-ios8.js` restores them, plus fast `Object.assign`/`Reflect.get`. That doubled to quintupled p5's speed. `p5-ios8.js` draws each p5.Image from an `<img>` copy (canvas sources were 36 fps vs 60) and caches colour strings. Don't drop these when rebuilding vendor.

## Adding a showcase example

1. `apps/showcase/src/examples/<name>.ts`: export an `Example` (`id`, `title`, `about`, `setup`, `draw`, touch handlers, `exit`) written as plain p5 instance-mode code; a header comment says what it shows and the iOS 8 catches.
2. Register it in `apps/showcase/src/main.ts`, add a row to the README table.
3. Open it on the iPad (`__app.open('<id>')`), screenshot it, and benchmark it. Aim for 55+ fps (30 for 3D) before calling it done.

Style: flat Material (solid fills, no shadows/glow/outlines), background `#fafafa`, ink `#212121`, Material 500 colours (`apps/showcase/src/art.ts`). Examples are generic (named by technique) unless asked otherwise.

## Deploying

Pushing to `main` builds and publishes `dist/` to GitHub Pages (`.github/workflows/pages.yml`). Run `npm run check` and `npm run build` first. Commit or push only when asked. On an iPad: `npm run ipad:install -- --prod`; it loads once over Wi-Fi, then works offline, and updates itself when opened online.

# iOS 8 manifest

Full-screen apps and experiences for the iPad mini 1s (IPAD-01 to IPAD-05: iOS 8.4.1, Safari 8, A5 chip, 1024×768). Opened from the home screen, an app runs full screen with no Safari bars, works offline once loaded, and has p5.js 1.11.13 ready to use.

Write modern TypeScript or JavaScript. The build rewrites it into the older JavaScript Safari 8 understands, and refuses to finish if anything newer slips through, so the iPad never fails silently.

- **`apps/showcase`**: what p5.js can do on these iPads, one small example per core feature. Each example in `apps/showcase/src/examples/` is plain p5 instance-mode code you can copy into a sketch. Live at the repo's GitHub Pages address.
- **`apps/starter`**: the smallest p5 app, to copy for a new project.
- **`packages/engine`**: `@ios8/engine`, the small ECS game engine (gestures, drag/pinch, tilt, sprites, scenes, UI, saving) for bigger pieces. The examples only borrow its sound and page helpers.
- **`vendor/`**: p5.js 1.11.13 rewritten to ES5, polyfills, and `p5-ios8.js`, the speed fixes measured on the iPads (see below).

### Showcase examples

| Example | What it shows |
|---|---|
| Paint | `p.touches` (5 fingers), strokes that stay (no `background()`), shake to clear |
| Multi-touch | every finger with its id, joined into a shape |
| Pinch & rotate | two-finger scale and twist with `translate`/`rotate`/`scale` |
| Tilt | `p.rotationX`/`rotationY` from the gyro, turned to match the screen; `deviceShaken` |
| Synth | live Web Audio oscillators, one per finger, from the touch handlers |
| Drum pads | sound files (`loadSound`): instant, overlapping hits |
| Video | an `.mp4` playing inline, drawn into the sketch and mirrored |
| Sprites | frame-by-frame animation from a sprite sheet (`image()` with a source rectangle) |
| Keyboard & saving | `createInput()` with the iPad keyboard, `storeItem()`/`getItem()` |
| Fonts | the fonts built into iOS 8, by name with `textFont()` |
| Pixels | `pixels[]` in a small image scaled up with `noSmooth()` (Game of Life) |
| Generative | Perlin `noise()` flow field with trails |
| 3D | p5 WEBGL at ~30 fps: one merged model, a few moving shapes, a tiny lighting shader |
| 3D game | the timstaana.com lobby game's player on a 3D plane: stick on the left, tap the right to jump, the site's follow camera (~30 fps) |
| Speed test | measures how many shapes, images or texts stay smooth |

## Start a new project

Add a folder under `apps/` (copy `apps/starter`, then borrow from the showcase examples). Edit its `app.config.json` (name, id, colour, `devPort`, `statusBar`), replace `icon-source.png` with your own square image, and run `npm run icons -- --app apps/my-thing`. Every command takes `--app apps/<name>`; the default is the showcase.

## Every day

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on this laptop. Rebuilds on save; open iPads reload themselves. The iPad's `console.log` and errors print in this terminal, and build errors show as a red banner on the iPad. |
| `npm run ipad:open` | Opens the dev server's page in Safari on the iPad plugged in by USB. |
| `npm run ipad:install` | Puts the app on that iPad's home screen as a full-screen app (tap **Install** on the iPad). The same as Add to Home Screen, but sent over USB. |
| `npm run ipad:remove` | Takes it off the home screen again. |
| `npm run build` | Release build in `dist/`: minified, with the offline cache. Upload `dist/` to any static host (Cloudflare, GitHub Pages...), set `prodUrl` in `app.config.json`, then `npm run ipad:install -- --prod`. |
| `npm run icons` | Makes the home-screen icons and launch screens from `icon-source.png`. |
| `npm run ipad:shot -- out.png` | Screenshot of the USB iPad. Needs the iOS 8.4 Developer Disk Image (`DeveloperDiskImage.dmg` + `.signature`, from an old Xcode's `DeviceSupport/8.4`) in `~/.local/share/ipad-ddi`; it's mounted automatically. |
| `npm run ipad:eval -- "code"` | Runs JavaScript in the open app (dev server only) and prints the result. In the showcase, `__p` is the p5 instance and `__app.open('paint')` opens an example. |

`ipad:open` and `ipad:install` use the iPad tools already set up on the laptop (`ipad-ssh`, pymobiledevice3, the legacy OpenSSL config). The iPad and laptop must be on the same Wi-Fi for the dev server.

## Deploy

Pushing to `main` builds the app and publishes `dist/` to GitHub Pages (`.github/workflows/pages.yml`), at the `prodUrl` in `app.config.json`. Install that version on an iPad with `npm run ipad:install -- --prod`. It loads once over Wi-Fi, then runs offline.

GitHub Pages caches files for up to 10 minutes, so an iPad can take that long to see a new version.

## Files

```
packages/engine/src/   ecs, loop (fixed 60 Hz), input (gestures, Track), drag (+pinch), motion, tilt, anim, render,
                       ui (buttons, meters), scenes (menu, idle, dev HUD), audio, page (full screen, safeTop, save/load)
packages/engine/test/  vitest: ECS, loop, gestures, Track, pinch
apps/showcase/src/     main.ts (the list), runner.ts (menu, Menu button, fps graph), examples/ (one file each)
apps/<app>/src/        the app (main.ts)
apps/<app>/art/        frame-by-frame art: <name>/<clip>_<n>.png -> npm run sheets -> public/sheets/
apps/<app>/public/     index.html, images, sounds, videos, fonts (copied as is)
vendor/                polyfills.js (core-js + iOS 8 shims), p5.js (1.11.13 rewritten to ES5), p5-ios8.js (speed fixes)
tools/                 build, dev server (live reload, remote console, remote eval), sheets, icons, iPad commands
```

## What the iPads can and can't do (tested Nov 2026)

**Fast:** drawing images and sprites (100 at about 50 fps, 300 at about 30). Suits hand-drawn frame animation.
**Slow:** hundreds of shapes, many `text()` calls, full-screen `pixels`, and drawing many separate 3D objects. Draw those once into `p.createGraphics()` and reuse it. See **Speed** below for numbers.

**Works:** multi-touch (5 fingers), typing into inputs, tilt and shake (`p.rotationX/Y`, `deviceShaken`), localStorage, WebSockets (and socket.io), Web Audio and `<audio>`, inline video drawn into the canvas, HTTPS to the big CDNs and timstaana.com.

**Doesn't:** p5.sound's `loadSound().play()` (use the engine's `loadSound` or `tone`; the starter app has `kit/sound.js`), camera and microphone, the Fullscreen API (the home-screen app is the full screen), `fetch` (use `p.loadJSON` or XMLHttpRequest), service workers (the Application Cache does offline), p5 2.x, CSS grid and variables.

## Speed (measured on the iPad minis)

Safari 8 on the A5 is fast at drawing images and slow at running lots of JavaScript, so the cost of p5 is mostly p5's own code. Time for one call (after the fixes below):

| Call | Time | | Call | Time |
|---|---|---|---|---|
| `image()` | ~100 µs | | `text()` | ~500 µs |
| `rect()` | ~90 µs | | `push()` + `pop()` | ~360 µs |
| `ellipse()` | ~230 µs | | `fill('#2196f3')` | ~100 µs (`fill(r, g, b)` ~40) |
| `line()` | ~40 µs | | raw `drawingContext.drawImage` | ~25 µs |

At 60 fps a frame has about 16 ms, and about 10 ms of that is yours. So:

- **Draw things as images.** Text, rounded cards, anything that doesn't change: draw it once into `createGraphics()`, take `g.get()`, and `image()` it every frame.
- **Avoid `push()`/`pop()` per object.** Undo the transform instead (`scale(-1, 1)` twice), or use `resetMatrix()`.
- **A few hundred shapes or lines a frame is the limit**; a few hundred images is fine.
- **Pixel effects in a small image** (around 100×100), scaled up.
- **3D (WEBGL) works at about 30 fps.** p5's own lights fail on the A5 ("too many uniforms"), so use a small shader of your own (see `examples/three-d.ts`). Each separately drawn object costs about 2 ms and `push()`/`pop()` about 2 ms, so keep moving objects to about 12, use `resetMatrix()` instead of `push`/`pop`, and merge the rest with `buildGeometry()`. Measured: 200 merged boxes at 43 fps, 20 separate boxes at 23 fps.

What `vendor/` fixes, so every sketch gets it:

- `p5-ios8.js`: `image()` draws from an `<img>` copy of each p5.Image (canvas → 36 fps, `<img>` → 60 fps in a sprite test) and straight from `<video>`. Colour strings are parsed once. Text boxes start with autocorrect off. `removeElements()` and `graphics.remove()` no longer throw.
- `polyfills.js`: core-js replaces many of Safari 8's fast built-ins (string, regex and array methods) with JavaScript versions. They are put back, and `Object.assign`/`Reflect.get` get fast versions. That made `text()` 2.5× faster, `push`/`pop` 2×, `line()` 5×.

## Rules of thumb

- **Start sound and video from a tap.** iOS 8 needs one; `unlockAudio()` handles sound at the end of the first tap. A video's `play()` must run inside a touch handler the first time (opening something from a tap counts); after that, code can play and pause it.
- **Media needs a server with byte ranges.** The dev server and every normal host have them.
- **Video:** H.264 + AAC `.mp4`, 1024×768 or smaller. Keep the `<video>` element in the page (it sits behind the canvas).
- **Typing: autocorrect off.** On the iPad mini, iOS autocorrect roughly doubles the keyboard's lag (measured while typing: 75 ms from key to screen with it on, 43 ms off). `vendor/p5-ios8.js` turns it off, with auto-capitals and spellcheck, for every `createInput()`; for hand-written `<input>`s add `autocorrect="off" autocapitalize="off" spellcheck="false"`. Don't block touches on text boxes (no `return false` for them), or the keyboard never opens.
- **The home-screen app keeps its own storage**, separate from Safari's.
- **The status bar stays, and its text is always white** in an iOS 8 home-screen app. The page always runs full screen under it; `app.config.json` `"statusBar"` sets what the engine paints behind the time and battery: `"black"` (solid), `"dim"` (translucent black, the game shows through) or `"overlay"` (nothing: keep the top of your page dark). Keep buttons below `safeTop()` (20 px).
- **Draw from images, not canvases.** Safari 8 draws an `<img>` much faster than a canvas (36 vs 60 fps measured). `vendor/p5-ios8.js` does this for `image()`; in the engine, `loadSheet`/`makeSheet`/`label` do it.
- **Churn is fine, allocation isn't.** Spawning/despawning many entities is cheap (ids are reused); avoid making new objects/arrays/strings every frame in systems, as garbage collection pauses show up as 50–250 ms hitches on the A5.
- **Offline cache:** a release build stores every file on the iPad. After you upload a new version, the app picks it up the next time it's opened with Wi-Fi (and checks every 5 minutes while open).
- **Lock the iPad into the app** for a stall with Guided Access (Settings → General → Accessibility).

// Your app. Write normal modern JavaScript here: the build rewrites it for iOS 8.
// p5 runs in instance mode (everything is p.something), so your own names can never clash with p5's.
//
// What runs well on the iPad mini 1 (A5, 1024x768): images/sprites (100 at ~50 fps, 300 at ~30).
// What's slow: hundreds of shapes, lots of text() calls, full-screen pixels, WEBGL. Draw those once
// into a p.createGraphics() buffer and reuse it.

import { lockPage, autoUpdate, homeScreenHint } from './kit/ios.js';
import { unlockAudio, tone } from './kit/sound.js';
import { load, save } from './kit/store.js';

lockPage();
unlockAudio();
autoUpdate();
homeScreenHint();

new p5((p) => {
  let sprite, taps = load('taps', 0);
  const trail = [];

  p.preload = () => { sprite = p.loadImage('assets/sprite.png'); };

  p.setup = () => {
    p.createCanvas(p.windowWidth, p.windowHeight);
    p.pixelDensity(1);   // the mini 1 is 1x anyway; keeps it fast if this ever runs on a retina iPad
    p.imageMode(p.CENTER);
    p.textFont('Helvetica Neue');
  };

  p.draw = () => {
    p.background(244, 239, 230);
    // idle: a few sprites bobbing so the screen is alive at a market stall
    for (let i = 0; i < 12; i++) {
      const x = ((i + 0.5) / 12) * p.width, y = p.height * 0.75 + Math.sin(p.frameCount * 0.05 + i) * 30;
      p.image(sprite, x, y, 48, 48);
    }
    // every finger on the screen leaves a short trail of sprites
    for (const t of p.touches) trail.push({ x: t.x, y: t.y, life: 30 });
    for (let i = trail.length - 1; i >= 0; i--) {
      const d = trail[i]; d.life--;
      if (d.life <= 0) { trail.splice(i, 1); continue; }
      p.image(sprite, d.x, d.y, d.life * 2.4, d.life * 2.4);
    }
    p.noStroke(); p.fill(40); p.textSize(28); p.textAlign(p.CENTER);
    p.text(`taps: ${taps}`, p.width / 2, 80);
    if (__DEV__) { p.textSize(14); p.textAlign(p.LEFT); p.text(`${Math.round(p.frameRate())} fps · ${p.touches.length} touches`, 12, p.height - 12); }
  };

  p.touchStarted = () => {
    taps++; save('taps', taps);
    tone(300 + (1 - p.mouseY / p.height) * 600, 0.15);
    return false;
  };

  p.windowResized = () => p.resizeCanvas(p.windowWidth, p.windowHeight);
}, 'stage');

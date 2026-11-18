// Sprites: frame-by-frame animation from a sprite sheet: one strip of frames (art/actor/*.png packed by
// `npm run sheets`) plus a JSON list of which frames make each clip. Tap to add walkers and see how many stay smooth.
// Core p5: loadImage() + loadJSON() in preload, image(img, dx, dy, dw, dh, sx, sy, sw, sh) to draw one frame.
import { type Example } from '../runner';
import { BG, MUTED, labelImage } from '../art';

interface Sheet { frameWidth: number; frameHeight: number; clips: Record<string, { frames: number[]; fps: number }> }
let img: p5.Image, sheet: Sheet;
const walkers: { x: number; y: number; vx: number; t: number }[] = [];

function add(p: p5, n: number) {
  for (let i = 0; i < n; i++) walkers.push({ x: Math.random() * p.width, y: 120 + Math.random() * (p.height - 200), vx: (Math.random() < 0.5 ? -1 : 1) * (40 + Math.random() * 60), t: Math.random() });
}

export const sprites: Example = {
  id: 'sprites', title: 'Sprites', about: 'Frame-by-frame animation from a sprite sheet. Tap to add more and watch the fps.',
  preload(p) { img = p.loadImage('sheets/actor.png'); sheet = p.loadJSON('sheets/actor.json') as unknown as Sheet; },
  setup(p) { walkers.length = 0; add(p, 10); },
  draw(p) {
    p.background(BG);
    const clip = sheet.clips.move, fw = sheet.frameWidth, fh = sheet.frameHeight, size = 100, dt = p.deltaTime / 1000;
    walkers.sort((a, b) => a.y - b.y); // nearer ones (lower down) drawn last
    for (const w of walkers) {
      w.x += w.vx * dt; w.t += dt;
      if (w.x < -size) w.x = p.width + size; else if (w.x > p.width + size) w.x = -size;
      const frame = clip.frames[Math.floor(w.t * clip.fps) % clip.frames.length];
      if (w.vx > 0) { // the art faces left: mirror it to walk right (scale back instead of push/pop: much cheaper here)
        p.scale(-1, 1); p.image(img, -w.x - size / 2, w.y - size, size, size, frame * fw, 0, fw, fh); p.scale(-1, 1);
      } else p.image(img, w.x - size / 2, w.y - size, size, size, frame * fw, 0, fw, fh);
    }
    p.fill(MUTED); p.noStroke(); p.textSize(18); p.textAlign(p.CENTER);
    p.text(`${walkers.length} sprites · ${Math.round(p.frameRate())} fps`, p.width / 2, p.height - 70);
    const l = labelImage(p, 'Tap to add 20 more', 18, MUTED);
    p.image(l, (p.width - l.width) / 2, p.height - 50);
  },
  touchStarted(p) { add(p, 20); },
};

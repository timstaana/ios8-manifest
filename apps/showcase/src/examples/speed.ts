// Speed test: how many things the iPad mini can draw and still stay smooth (~55 fps), for three ways of drawing:
// shapes (ellipse), images (image) and text (text). It adds more until the frame rate drops, then moves on.
// The answer guides how to build things: lots of moving things should be images.
import { type Example } from '../runner';
import { PALETTE, BG, INK, MUTED, labelImage } from '../art';

const MODES = ['ellipse()', 'image()', 'text()'] as const, MAX = 4000;
let dot: p5.Image, mode = 0, count = 0, settle = 0, frames: number[] = [], results: number[] = [];
const xs = new Float32Array(MAX), ys = new Float32Array(MAX), vx = new Float32Array(MAX), vy = new Float32Array(MAX);

function start() { mode = 0; count = 50; settle = 0; frames = []; results = []; }

export const speed: Example = {
  id: 'speed', title: 'Speed test', about: 'How many shapes, images or texts stay smooth? It measures all three. Tap to rerun.',
  setup(p) {
    const g = p.createGraphics(24, 24); g.pixelDensity(1); g.noStroke(); g.fill(PALETTE[0]); g.ellipse(12, 12, 24, 24); dot = g.get();
    for (let i = 0; i < MAX; i++) { xs[i] = Math.random() * p.width; ys[i] = Math.random() * p.height; vx[i] = Math.random() * 4 - 2; vy[i] = Math.random() * 4 - 2; }
    start();
  },
  draw(p, top) {
    p.background(BG); p.noStroke();
    const done = mode >= MODES.length, n = done ? 0 : count;
    if (!done) p.fill(PALETTE[0]);
    if (!done && mode === 2) { p.textSize(18); p.fill(PALETTE[0]); }
    for (let i = 0; i < n; i++) {
      xs[i] += vx[i]; ys[i] += vy[i];
      if (xs[i] < 0 || xs[i] > p.width) vx[i] = -vx[i]; if (ys[i] < 0 || ys[i] > p.height) vy[i] = -vy[i];
      if (mode === 0) p.ellipse(xs[i], ys[i], 24, 24);
      else if (mode === 1) p.image(dot, xs[i] - 12, ys[i] - 12);
      else p.text('Aa', xs[i], ys[i]);
    }
    if (!done) { // every half second: still smooth? add 25% more; if not, record and move on
      frames.push(p.deltaTime);
      if (++settle >= 30) {
        frames.sort((a, b) => a - b); const typical = frames[Math.floor(frames.length * 0.8)]; settle = 0; frames = [];
        if (typical < 1000 / 55 && count < MAX) count = Math.min(MAX, Math.ceil(count * 1.25));
        else { results[mode] = typical < 1000 / 55 ? count : Math.round(count / 1.25); mode++; count = 50; }
      }
    }
    // results panel
    p.fill(255, 255, 255, 235); p.rect(20, top + 60, 360, 150, 12);
    MODES.forEach((m, i) => {
      p.fill(i === mode ? PALETTE[1] : INK); p.textSize(20); p.textStyle(i === mode ? p.BOLD : p.NORMAL);
      p.text(m, 40, top + 98 + i * 40);
      p.text(results[i] !== undefined ? results[i] + ' smooth' : i === mode ? count + '…' : '', 190, top + 98 + i * 40);
    });
    const l = labelImage(p, done ? 'Done · tap to run again' : 'Measuring… (smooth = 55 fps or more)', 16, MUTED);
    p.image(l, 40, top + 214);
  },
  touchStarted() { if (mode >= MODES.length) start(); },
};

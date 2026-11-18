// Generative: particles drifting through a Perlin noise flow field, leaving trails. Tap for a new field.
// Core p5: noise(), noiseSeed(), drawing on top of the last frame (no background) for trails.
import { type Example } from '../runner';
import { PALETTE, BG } from '../art';

const N = 120; // each line() is a separate canvas stroke: ~120 keeps it near 60 fps on the iPad mini
let xs = new Float32Array(N), ys = new Float32Array(N), cs: p5.Color[] = [];

function reset(p: p5) {
  p.noiseSeed(Math.floor(Math.random() * 1e6)); p.background(BG);
  for (let i = 0; i < N; i++) { xs[i] = Math.random() * p.width; ys[i] = Math.random() * p.height; }
}

export const generative: Example = {
  id: 'generative', title: 'Generative', about: 'Particles drifting through a Perlin noise field, leaving trails. Tap for a new field.',
  setup(p) { cs = PALETTE.map((c) => { const col = p.color(c); col.setAlpha(60); return col; }); reset(p); },
  draw(p) {
    p.strokeWeight(2);
    const zoom = 0.0025, speed = 2.2;
    for (let i = 0; i < N; i++) {
      const a = p.noise(xs[i] * zoom, ys[i] * zoom) * Math.PI * 4;
      const x = xs[i] + Math.cos(a) * speed, y = ys[i] + Math.sin(a) * speed;
      p.stroke(cs[i % cs.length]); p.line(xs[i], ys[i], x, y);
      xs[i] = x; ys[i] = y;
      if (x < 0 || y < 0 || x > p.width || y > p.height) { xs[i] = Math.random() * p.width; ys[i] = Math.random() * p.height; }
    }
  },
  touchStarted(p) { reset(p); },
};

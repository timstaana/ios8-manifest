// Pinch & rotate: one finger moves the card, two fingers scale and twist it about the point between them.
// Core p5: translate(), rotate(), scale(), imageMode(CENTER), and a little maths on two touches.
import { fingers, type Example } from '../runner';
import { PALETTE, BG, MUTED, labelImage } from '../art';

let card: p5.Image;
const s = { x: 0, y: 0, scale: 1, angle: 0 };
let prev: { n: number; x: number; y: number; d: number; a: number } | null = null;

export const pinch: Example = {
  id: 'pinch', title: 'Pinch & rotate', about: 'One finger moves, two fingers scale and twist about the fingers.',
  setup(p) {
    const g = p.createGraphics(280, 200); g.pixelDensity(1);
    g.noStroke(); g.fill(PALETTE[4]); g.rect(0, 0, 280, 200, 20); g.fill(255); g.ellipse(140, 34, 22, 22);
    g.textAlign(p.CENTER, p.CENTER); g.textSize(30); g.textStyle(p.BOLD); g.text('Pinch me', 140, 110);
    card = g.get();
    s.x = p.width / 2; s.y = p.height / 2; s.scale = 1; s.angle = 0; prev = null;
  },
  draw(p) {
    const ts = fingers(p);
    if (ts.length) {
      // the centre between the fingers, their distance and their angle
      const a = ts[0], b = ts[1] || ts[0];
      const now = { n: ts.length, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, d: Math.hypot(b.x - a.x, b.y - a.y), a: Math.atan2(b.y - a.y, b.x - a.x) };
      if (prev && prev.n === now.n) {
        let k = 1, turn = 0;
        if (now.n > 1 && prev.d > 0) { k = now.d / prev.d; turn = now.a - prev.a; }
        const scale = Math.max(0.3, Math.min(4, s.scale * k)); k = scale / s.scale;
        // move the card around the old centre point, then by how far the centre moved
        const rx = s.x - prev.x, ry = s.y - prev.y, c = Math.cos(turn), sn = Math.sin(turn);
        s.x = now.x + (rx * c - ry * sn) * k; s.y = now.y + (rx * sn + ry * c) * k;
        s.scale = scale; s.angle += turn;
      }
      prev = now;
    } else prev = null;

    p.background(BG);
    p.translate(s.x, s.y); p.rotate(s.angle); p.scale(s.scale);
    p.imageMode(p.CENTER); p.image(card, 0, 0);
    p.resetMatrix(); p.imageMode(p.CORNER);
    const l = labelImage(p, 'Drag with one finger · pinch and twist with two', 18, MUTED);
    p.image(l, (p.width - l.width) / 2, p.height - 50);
  },
};

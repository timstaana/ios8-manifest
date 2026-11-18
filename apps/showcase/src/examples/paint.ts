// Paint: draw with up to five fingers at once. There's no background() in draw, so every stroke stays.
// Core p5: p.touches (each finger has an id), line(), strokeWeight from speed. Shake the iPad to clear (p.deviceShaken).
import { fingers, changed, type Example } from '../runner';
import { PALETTE, BG, INK, MUTED, labelImage } from '../art';

let color = 0, swatchY = 0, size = 0;
const last: Record<number, { x: number; y: number }> = {};

export const paint: Example = {
  id: 'paint', title: 'Paint', about: 'Draw with up to five fingers. Strokes stay because draw() never clears. Shake to clear.',
  setup(p) {
    p.background(BG); p.strokeCap(p.ROUND);
    size = Math.min(70, p.width / (PALETTE.length + 2)); swatchY = p.height - size - 16;
  },
  draw(p) {
    const now = fingers(p), seen: Record<number, boolean> = {};
    for (const t of now) {
      seen[t.id] = true;
      if (t.y > swatchY - 10) continue; // the colour row
      const q = last[t.id];
      if (q) {
        const speed = Math.hypot(t.x - q.x, t.y - q.y);
        p.stroke(PALETTE[color]); p.strokeWeight(Math.max(3, 18 - speed * 0.4)); // faster = thinner, like a brush
        p.line(q.x, q.y, t.x, t.y);
      }
      last[t.id] = { x: t.x, y: t.y };
    }
    for (const id in last) if (!seen[id]) delete last[id];
    // colour row (drawn every frame, on top of the painting)
    p.noStroke(); p.fill(BG); p.rect(0, swatchY - 10, p.width, p.height - swatchY + 10);
    PALETTE.forEach((c, i) => { p.fill(c); p.rect(16 + i * (size + 8), swatchY, size, size, 8); });
    p.fill(INK); p.rect(16 + color * (size + 8) + size * 0.35, swatchY + size + 4, size * 0.3, 4, 2);
    p.image(labelImage(p, 'Shake to clear', 16, MUTED), p.width - 130, swatchY + size / 2 - 10);
  },
  touchStarted(p, e) {
    for (const t of changed(e)) if (t.y > swatchY - 10) { const i = Math.floor((t.x - 16) / (size + 8)); if (i >= 0 && i < PALETTE.length) color = i; }
  },
  deviceShaken(p) { p.background(BG); },
};

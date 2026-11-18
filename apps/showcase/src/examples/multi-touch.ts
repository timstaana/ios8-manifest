// Multi-touch: every finger on the screen, with its id, joined into a shape. The iPad mini tracks 5 at once
// here (the system's 4/5-finger gestures are switched off on these iPads, so the app gets them all).
// Core p5: p.touches, beginShape()/vertex(), text().
import { fingers, type Example } from '../runner';
import { PALETTE, BG, MUTED, labelImage } from '../art';

export const multiTouch: Example = {
  id: 'multi-touch', title: 'Multi-touch', about: 'Every finger, with its id, joined into a shape. Up to five at once.',
  draw(p) {
    p.background(BG);
    const ts = fingers(p);
    if (!ts.length) { const l = labelImage(p, 'Put up to five fingers on the screen', 24, MUTED); p.image(l, (p.width - l.width) / 2, p.height / 2 - 20); return; }
    if (ts.length > 2) { // the shape between the fingers
      p.noStroke(); p.fill(33, 150, 243, 40); p.beginShape();
      for (const t of ts) p.vertex(t.x, t.y);
      p.endShape(p.CLOSE);
    }
    p.textAlign(p.CENTER, p.CENTER); p.textStyle(p.BOLD); p.textSize(28);
    ts.forEach((t, i) => {
      p.noStroke(); p.fill(PALETTE[i % PALETTE.length]); p.ellipse(t.x, t.y, 130, 130);
      p.fill(255); p.text(String(i + 1), t.x, t.y);
    });
    p.fill(MUTED); p.textSize(18); p.textStyle(p.NORMAL); p.text(ts.length + (ts.length === 1 ? ' finger' : ' fingers'), p.width / 2, p.height - 40);
  },
};

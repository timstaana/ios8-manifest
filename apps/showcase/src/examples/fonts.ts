// Fonts: the typefaces built into iOS 8, usable by name with textFont() with no files to load. Drag to scroll.
// Core p5: textFont(), and the iPad mini habit of drawing text once into an image instead of every frame.
import { fingers, type Example } from '../runner';
import { BG, INK, MUTED } from '../art';

const FONTS = [
  'Helvetica Neue', 'Avenir Next', 'Avenir', 'Futura', 'Gill Sans', 'Optima', 'Trebuchet MS', 'Verdana',
  'Arial Rounded MT Bold', 'Georgia', 'Baskerville', 'Didot', 'Bodoni 72', 'Palatino', 'Cochin', 'Hoefler Text',
  'Times New Roman', 'American Typewriter', 'Courier New', 'Menlo', 'Copperplate', 'Marker Felt', 'Noteworthy',
  'Chalkboard SE', 'Chalkduster', 'Bradley Hand', 'Snell Roundhand', 'Papyrus', 'Party LET', 'Zapfino',
];
let page: p5.Image, scroll = 0, lastY: number | null = null, velocity = 0;

export const fonts: Example = {
  id: 'fonts', title: 'Fonts', about: 'The typefaces built into iOS 8, ready by name with textFont(). Drag to scroll.',
  setup(p, top) {
    const row = 64, g = p.createGraphics(p.width, FONTS.length * row + top + 140); g.pixelDensity(1);
    g.background(BG); g.noStroke();
    FONTS.forEach((f, i) => {
      const y = top + 90 + i * row;
      g.fill(INK); g.textFont(f); g.textSize(f === 'Zapfino' ? 20 : 30); g.text('The quick brown fox', 28, y);
      g.fill(MUTED); g.textFont('Helvetica Neue'); g.textSize(14); g.text(f, 28, y + 20);
    });
    page = g.get(); scroll = 0; velocity = 0; lastY = null; // drawn once; scrolling just moves the image
  },
  draw(p) {
    const t = fingers(p)[0];
    if (t) { if (lastY !== null) { velocity = t.y - lastY; scroll += velocity; } lastY = t.y; }
    else { lastY = null; scroll += velocity; velocity *= 0.94; } // flick
    scroll = Math.max(Math.min(0, p.height - page.height), Math.min(0, scroll));
    p.background(BG); p.image(page, 0, scroll);
  },
};

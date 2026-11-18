// Pixels: Conway's Game of Life worked out pixel by pixel in a small image, drawn full screen with noSmooth().
// Drag to add life. Core p5: createImage(), pixels[], updatePixels(), noSmooth().
// Full-screen pixel work is too slow for the iPad mini; a small image scaled up is the way to do it.
import { fingers, type Example } from '../runner';
import { MUTED, labelImage } from '../art';

const W = 96, H = 128;
let img: p5.Image, cells = new Uint8Array(W * H), next = new Uint8Array(W * H), tick = 0, dirty = true;

function seed() { for (let i = 0; i < cells.length; i++) cells[i] = Math.random() < 0.18 ? 1 : 0; }

export const pixels: Example = {
  id: 'pixels', title: 'Pixels', about: 'Game of Life in a small image, scaled up with noSmooth(). Drag to add life.',
  setup(p) { img = p.createImage(W, H); img.loadPixels(); seed(); dirty = true; }, // loadPixels once: it reads the image back (slow)
  draw(p, top) {
    const sx = W / p.width, sy = H / (p.height - top);
    for (const t of fingers(p)) { // paint live cells under each finger
      const cx = Math.floor(t.x * sx), cy = Math.floor((t.y - top) * sy);
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const x = cx + dx, y = cy + dy; if (x >= 0 && y >= 0 && x < W && y < H && Math.random() < 0.6) cells[y * W + x] = 1; }
      dirty = true;
    }
    if (++tick % 3 === 0) { // a generation every 3 frames
      for (let y = 0; y < H; y++) {
        const up = ((y + H - 1) % H) * W, row = y * W, down = ((y + 1) % H) * W; // rows wrap around
        for (let x = 0; x < W; x++) {
          const l = (x + W - 1) % W, r = (x + 1) % W;
          const n = cells[up + l] + cells[up + x] + cells[up + r] + cells[row + l] + cells[row + r] + cells[down + l] + cells[down + x] + cells[down + r];
          next[row + x] = n === 3 || (n === 2 && cells[row + x]) ? 1 : 0;
        }
      }
      const t = cells; cells = next; next = t; dirty = true;
    }
    if (dirty) { // only rewrite the pixels when something changed
      const px = img.pixels;
      for (let i = 0, k = 0; i < cells.length; i++, k += 4) { const on = cells[i]; px[k] = on ? 33 : 250; px[k + 1] = on ? 150 : 250; px[k + 2] = on ? 243 : 250; px[k + 3] = 255; }
      img.updatePixels(); dirty = false;
    }
    p.noSmooth(); // no background(): the image covers the screen
    const c = p.drawingContext as CanvasRenderingContext2D & { webkitImageSmoothingEnabled?: boolean };
    c.webkitImageSmoothingEnabled = false; // Safari 8 only knows the prefixed name
    p.image(img, 0, top, p.width, p.height - top);
    const l = labelImage(p, 'Drag to add life', 18, MUTED, { bg: 'rgba(250,250,250,0.9)' });
    p.image(l, (p.width - l.width) / 2, p.height - 56);
  },
};

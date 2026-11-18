// Colours (flat Material) and a text helper shared by the examples.

/** Material 500s. */
export const PALETTE = ['#2196f3', '#f44336', '#4caf50', '#ffc107', '#9c27b0', '#ff9800', '#009688', '#3f51b5'];
export const INK = '#212121', MUTED = '#757575', BG = '#fafafa';

/** Mix a #rrggbb colour towards white (amount 0..1). */
export function tint(color: string, amount: number): string {
  const n = parseInt(color.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const m = (c: number) => Math.round(c + (255 - c) * amount);
  return '#' + ((1 << 24) | (m(r) << 16) | (m(g) << 8) | m(b)).toString(16).slice(1);
}

const labels: Record<string, p5.Image> = {};
/** Text drawn once into an image (cached). text() every frame is slow on the iPad mini; image() is fast. */
export function labelImage(p: p5, text: string, size: number, color: string, o: { bold?: boolean; bg?: string; font?: string } = {}): p5.Image {
  const key = [text, size, color, o.bold, o.bg, o.font].join('|');
  if (labels[key]) return labels[key];
  const font = o.font || 'Helvetica Neue', pad = o.bg ? Math.round(size * 0.6) : 2;
  const m = document.createElement('canvas').getContext('2d')!;
  m.font = `${o.bold ? 'bold ' : ''}${size}px "${font}"`;
  const w = Math.ceil(m.measureText(text).width) + pad * 2, h = Math.ceil(size * 1.3) + pad * 2;
  const g = p.createGraphics(w, h); g.pixelDensity(1);
  if (o.bg) { g.noStroke(); g.fill(o.bg); g.rect(0, 0, w, h, size * 0.45); }
  g.textFont(font); g.textSize(size); g.textStyle(o.bold ? p.BOLD : p.NORMAL); g.fill(color); g.noStroke(); g.textAlign(p.LEFT, p.TOP);
  g.text(text, pad, pad + size * 0.1);
  return (labels[key] = g.get());
}

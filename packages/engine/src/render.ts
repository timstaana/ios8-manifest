// Drawing with p5 (the only engine module that touches p5). Sprites are drawn back to front (z, then y),
// interpolated between update ticks, straight through the canvas drawImage for speed on Safari 8.
// Text is rendered once into a sheet ("label sprites"): on the A5, text() every frame is slow, images are fast.
import { component, resource, definePlugin, type World } from './ecs';
import { Transform, Lifetime, Core } from './core';
import { Anim, Sprite, sheets, type SpriteSheet, type Clip } from './anim';
import { TimeRes } from './loop';

export const P5Res = resource<p5>('p5');
export const ClearRes = resource<{ color: string | null }>('clear');
/** Sprites with Fade fade out over their Lifetime. */
export const Fade = component<true>('Fade');

// Speed rule for Safari 8 (measured on IPAD-02): always drawImage from an <img>, never from a canvas.
// A p5.Image or p5.Graphics is canvas-backed, and drawing from it ran the Sprite states demo at 36 fps vs 60 from <img>.

// Safari decodes an <img> lazily on its first draw (a visible hitch mid-interaction); draw it once when it loads.
let warmCtx: CanvasRenderingContext2D | null = null;
function warm(img: HTMLImageElement) {
  if (!warmCtx) { const c = document.createElement('canvas'); c.width = c.height = 1; warmCtx = c.getContext('2d'); }
  if (warmCtx) warmCtx.drawImage(img, 0, 0, 1, 1);
}

/** Load a sheet made by `npm run sheets`: public/sheets/<name>.json + .png, as a plain <img>. Call in preload(). */
export function loadSheet(p: p5, name: string, base = 'sheets/'): SpriteSheet {
  const sheet: SpriteSheet = { image: null, frameWidth: 1, frameHeight: 1, clips: {} };
  p.loadJSON(base + name + '.json', (d: Partial<SpriteSheet>) => { sheet.frameWidth = d.frameWidth!; sheet.frameHeight = d.frameHeight!; sheet.clips = d.clips!; });
  const pp = p as unknown as { _incrementPreload?: () => void; _decrementPreload?: () => void };
  if (pp._incrementPreload) pp._incrementPreload(); // setup() waits for it like p.loadImage
  const img = new Image(), done = () => { if (pp._decrementPreload) pp._decrementPreload(); };
  img.onload = () => { warm(img); sheet.image = img; done(); };
  img.onerror = () => { console.error(`sheet ${name}: could not load ${img.src}`); done(); };
  img.src = base + name + '.png';
  return sheet;
}

/** Swap a sheet's canvas for an <img> of it (async; the canvas is drawn until the image is ready). */
export function bakeSheet(sheet: SpriteSheet): SpriteSheet {
  const c = sourceCanvas(sheet.image);
  if (c && (c as HTMLElement).tagName === 'CANVAS') { const img = new Image(); img.onload = () => { warm(img); sheet.image = img; }; img.src = (c as HTMLCanvasElement).toDataURL(); }
  return sheet;
}

/** Draw a sheet in code (placeholder art, procedural creatures): draw(g, frameIndex) is called per frame, origin at the frame's top-left. */
export function makeSheet(p: p5, o: { frameWidth: number; frameHeight: number; frames: number; clips?: Record<string, Clip>; draw: (g: p5.Graphics, i: number) => void }): SpriteSheet {
  const g = p.createGraphics(o.frameWidth * o.frames, o.frameHeight);
  g.pixelDensity(1);
  for (let i = 0; i < o.frames; i++) { g.push(); g.translate(i * o.frameWidth, 0); o.draw(g, i); g.pop(); }
  const all: number[] = []; for (let i = 0; i < o.frames; i++) all.push(i);
  return bakeSheet({ image: g, frameWidth: o.frameWidth, frameHeight: o.frameHeight, clips: o.clips || { idle: { frames: all, fps: 8, loop: true } } });
}

const labelCache: Record<string, SpriteSheet> = {};
let measureCtx: CanvasRenderingContext2D | null = null;
const measurer = () => measureCtx || (measureCtx = document.createElement('canvas').getContext('2d')!);
/** Text as a one-frame sheet (cached). Register it with sheets(w)[key] = label(...) or use addLabel(). */
export function label(p: p5, text: string, o: { size?: number; color?: string; font?: string; style?: 'normal' | 'bold'; pad?: number; bg?: string; radius?: number } = {}): SpriteSheet {
  const key = [text, o.size, o.color, o.font, o.style, o.bg].join('|');
  if (labelCache[key]) return labelCache[key];
  const size = o.size || 24, pad = o.pad ?? (o.bg ? size * 0.5 : 2), font = o.font || 'Helvetica Neue', lines = text.split('\n');
  const m = measurer(); m.font = `${o.style === 'bold' ? 'bold ' : ''}${size}px "${font}"`;
  let tw = 0; for (const l of lines) tw = Math.max(tw, m.measureText(l).width);
  const w = Math.ceil(tw + pad * 2), lh = Math.ceil(size * 1.25), h = lh * lines.length + Math.ceil(pad * 2);
  const g = p.createGraphics(w, h); g.pixelDensity(1);
  if (o.bg) { g.noStroke(); g.fill(o.bg); g.rect(0, 0, w, h, o.radius ?? size * 0.4); }
  g.textFont(font); g.textSize(size); if (o.style === 'bold') g.textStyle(p.BOLD);
  g.fill(o.color || '#222'); g.noStroke(); g.textAlign(p.LEFT, p.TOP);
  lines.forEach((l, i) => g.text(l, pad, pad + i * lh + size * 0.1));
  return (labelCache[key] = bakeSheet({ image: g, frameWidth: w, frameHeight: h, clips: { idle: { frames: [0], fps: 1, loop: true } } }));
}

/** What to drawImage from: an <img>/<canvas> as is, or the canvas inside a p5.Image / p5.Graphics. */
function sourceCanvas(img: unknown): CanvasImageSource | null {
  if (!img) return null;
  if ((img as HTMLElement).tagName) return img as CanvasImageSource;
  const i = img as { canvas?: HTMLCanvasElement; elt?: HTMLCanvasElement };
  return i.canvas || i.elt || null;
}
const source = sourceCanvas;

// Reused between frames so drawing allocates nothing.
const order: number[] = [];
const keyZ: number[] = [];
const keyY: number[] = [];

function draw(w: World) {
  const p = w.resource(P5Res)!; const ctx = p.drawingContext as CanvasRenderingContext2D;
  const clear = w.resource(ClearRes);
  if (clear && clear.color) {
    // clearRect + the colour as the canvas's CSS background is cheaper than filling every pixel each frame
    const el = ctx.canvas; if (el.style.backgroundColor !== clear.color && el.getAttribute('data-bg') !== clear.color) { el.style.backgroundColor = clear.color; el.setAttribute('data-bg', clear.color); }
    ctx.clearRect(0, 0, p.width, p.height);
  }
  const a = (w.resource(TimeRes) || { alpha: 1 }).alpha, all = sheets(w);

  order.length = 0; keyZ.length = 0; keyY.length = 0;
  w.each(Transform, Sprite, (e, t, s) => {
    if (!s.visible || s.alpha <= 0) return;
    // insertion sort by (z, y): the list is nearly sorted frame to frame, so this is close to linear
    let i = order.length; order.push(e); keyZ.push(0); keyY.push(0);
    while (i > 0 && (keyZ[i - 1] > t.z || (keyZ[i - 1] === t.z && keyY[i - 1] > t.y))) { order[i] = order[i - 1]; keyZ[i] = keyZ[i - 1]; keyY[i] = keyY[i - 1]; i--; }
    order[i] = e; keyZ[i] = t.z; keyY[i] = t.y;
  });

  for (let n = 0; n < order.length; n++) {
    const e = order[n], t = w.get(e, Transform)!, s = w.get(e, Sprite)!, sh = all[s.sheet];
    const src = sh && source(sh.image); if (!src) continue;
    const fw = sh.frameWidth, fh = sh.frameHeight;
    const x = t.px + (t.x - t.px) * a, y = t.py + (t.y - t.py) * a, rot = t.prot + (t.rot - t.prot) * a;
    const dw = (s.w ?? fw) * t.scale, dh = (s.h ?? fh) * t.scale;
    let alpha = s.alpha;
    if (w.hasComponent(e, Fade)) { const l = w.get(e, Lifetime); if (l) alpha *= Math.max(0, l.left / l.total); }
    ctx.globalAlpha = alpha;
    if (!rot && !s.flipX) ctx.drawImage(src, s.frame * fw, 0, fw, fh, x - dw * s.ax, y - dh * s.ay, dw, dh);
    else {
      ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot); if (s.flipX) ctx.scale(-1, 1);
      ctx.drawImage(src, s.frame * fw, 0, fw, fh, -dw * s.ax, -dh * s.ay, dw, dh);
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1;
}

/** Render: clears to `clear` (null = leave the canvas alone) and draws every Transform + Sprite. */
export const Render = definePlugin<{ p: p5; clear?: string | null }>('render', (w, o) => {
  w.use(Core(), Anim());
  w.setResource(P5Res, o.p);
  w.setResource(ClearRes, { color: o.clear === undefined ? '#fafafa' : o.clear });
  w.system('render', draw, 'render.sprites');
});

/** Give an entity a text label sprite (cached). */
export function addLabel(w: World, key: string, text: string, o: Parameters<typeof label>[2] = {}) {
  const p = w.resource(P5Res)!; sheets(w)[key] = label(p, text, o); return key;
}

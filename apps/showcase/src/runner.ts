// Runs a menu of small p5 sketches ("examples") in one p5 instance. An example is plain p5 instance-mode code
// (p.ellipse, p.touches, p.rotationX...) in an object: setup/draw plus optional touch and shake handlers.
// The runner adds the menu, the "‹ Menu" button, the status bar strip and (in dev) the fps graph.
import { safeTop, statusBarFill } from '@ios8/engine';
import { PALETTE, BG, INK, MUTED, labelImage } from './art';

export interface Example {
  id: string; title: string; about: string;
  /** load files (p.loadImage, p.loadJSON...); runs once at start-up for every example */
  preload?(p: p5): void;
  /** runs each time the example opens (and after the iPad rotates). `top` = pixels hidden under the status bar */
  setup?(p: p5, top: number): void;
  /** every frame, inside push/pop: styles set here reset each frame, styles set in setup stay */
  draw(p: p5, top: number): void;
  touchStarted?(p: p5, e: TouchEvent): void;
  touchMoved?(p: p5, e: TouchEvent): void;
  touchEnded?(p: p5, e: TouchEvent): void;
  deviceShaken?(p: p5): void;
  exit?(p: p5): void;
}

/** p.touches with its fields typed: { x, y, id } for every finger on the screen. */
export const fingers = (p: p5) => p.touches as unknown as { x: number; y: number; id: number }[];
/** The touches that started / moved / ended in this event, in canvas coordinates. */
export function changed(e: TouchEvent): { x: number; y: number; id: number }[] {
  const out = [], list = (e && e.changedTouches) || [];
  for (let i = 0; i < list.length; i++) out.push({ x: list[i].clientX, y: list[i].clientY, id: list[i].identifier });
  return out;
}

export function runExamples(examples: Example[], o: { title: string; subtitle: string }) {
  return new p5((p: p5) => {
    let cur: Example | null = null, top = 0, bar: string | null = null;
    let tiles: { ex: Example; x: number; y: number; w: number; h: number; img: p5.Image }[] = [];
    let title: p5.Image, sub: p5.Image, backBtn: p5.Image;
    let tapStart: { x: number; y: number; t: number } | null = null;
    const hud = devHud();
    const ctx = () => p.drawingContext as CanvasRenderingContext2D;

    p.preload = () => { for (const ex of examples) if (ex.preload) ex.preload(p); };

    p.setup = () => {
      p.createCanvas(p.windowWidth, p.windowHeight); p.pixelDensity(1);
      top = safeTop(); bar = statusBarFill();
      title = labelImage(p, o.title, 40, INK, { bold: true });
      sub = labelImage(p, o.subtitle, 18, MUTED);
      backBtn = labelImage(p, '‹ Menu', 18, '#fff', { bold: true, bg: INK });
      layout();
      if (typeof __DEV__ !== 'undefined' && __DEV__) { // handles for npm run ipad:eval
        const g = window as unknown as Record<string, unknown>;
        g.__p = p; g.__app = { open: (id: string) => { const ex = examples.filter((x) => x.id === id)[0]; if (ex) open(ex); else leave(); }, get current() { return cur ? cur.id : 'menu'; } };
      }
    };

    function resetStyle() {
      p.colorMode(p.RGB, 255); p.angleMode(p.RADIANS); p.rectMode(p.CORNER); p.ellipseMode(p.CENTER); p.imageMode(p.CORNER);
      p.fill(255); p.stroke(0); p.strokeWeight(1); p.strokeCap(p.ROUND); p.strokeJoin(p.MITER); p.noTint(); p.blendMode(p.BLEND);
      p.textFont('Helvetica Neue'); p.textSize(12); p.textStyle(p.NORMAL); p.textAlign(p.LEFT, p.BASELINE); p.smooth(); p.frameRate(60);
    }
    /** Run an example's hook; an error is logged but never traps you inside the example. */
    function safely(f: () => void) { try { f(); } catch (e) { console.error(e); } }
    function open(ex: Example) {
      if (cur) leave();
      safely(() => p.removeElements()); resetStyle(); p.background(BG);
      cur = ex; if (ex.setup) safely(() => ex.setup!(p, top));
      console.log('example: ' + ex.id);
    }
    function leave() {
      const ex = cur;
      if (ex && ex.exit) safely(() => ex.exit!(p));
      safely(() => p.removeElements()); resetStyle(); cur = null;
      console.log('example: menu');
    }

    function layout() {
      const w = p.width, cols = w > p.height ? 4 : 3, gap = 14, m = 28, y0 = top + 120, rows = Math.ceil(examples.length / cols);
      const tw = Math.floor((w - m * 2 - gap * (cols - 1)) / cols);
      const th = Math.floor(Math.min(tw * 0.62, (p.height - y0 - m - gap * (rows - 1)) / rows));
      tiles = examples.map((ex, i) => {
        const g = p.createGraphics(tw, th); g.pixelDensity(1);
        g.noStroke(); g.fill(PALETTE[i % PALETTE.length]); g.rect(0, 0, tw, th, 12);
        g.fill(255); g.textFont('Helvetica Neue'); g.textStyle(p.BOLD); g.textSize(20); g.text(ex.title, 16, 34);
        g.textStyle(p.NORMAL); g.fill(255, 255, 255, 225); g.textSize(14); g.textLeading(18); g.text(ex.about, 16, 46, tw - 30, th - 52);
        const img = g.get(); // a p5.Image: drawn from a fast <img> copy (vendor/p5-ios8.js)
        return { ex, img, w: tw, h: th, x: m + (i % cols) * (tw + gap), y: y0 + Math.floor(i / cols) * (th + gap) };
      });
    }

    p.draw = () => {
      const c = ctx();
      if (cur) { p.push(); cur.draw(p, top); p.pop(); }
      else {
        p.background(BG);
        p.image(title, 28, top + 30); p.image(sub, 28, top + 80);
        for (const t of tiles) p.image(t.img, t.x, t.y);
      }
      c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; // overlays, whatever the example left behind
      if (cur) p.image(backBtn, 12, top + 8);
      if (bar) { c.fillStyle = bar; c.fillRect(0, 0, p.width, top); }
      if (hud) hud(c, p.width, top, cur ? cur.id : 'menu');
    };

    const onBack = (x: number, y: number) => cur && x < 130 && y < top + 56;
    // Touches on text boxes, buttons and other form fields must keep their default (return true): blocking it stops
    // iOS focusing the field, so the keyboard never opens.
    const onForm = (e?: object) => {
      for (let el = e && ((e as Event).target as Node | null); el && el !== document.body; el = el.parentNode) {
        if (/^(INPUT|TEXTAREA|SELECT|BUTTON|LABEL|A)$/.test((el as Element).tagName || '')) return true;
      }
      return false;
    };
    p.touchStarted = (e?: object) => {
      if (onForm(e)) return true;
      const ev = e as TouchEvent, t = changed(ev)[0];
      if (t && onBack(t.x, t.y)) { leave(); return false; }
      if (cur) { if (cur.touchStarted) cur.touchStarted(p, ev); }
      else if (t) tapStart = { x: t.x, y: t.y, t: Date.now() };
      return false; // no scrolling, zooming or emulated mouse events
    };
    p.touchMoved = (e?: object) => { if (onForm(e)) return true; if (cur && cur.touchMoved) cur.touchMoved(p, e as TouchEvent); return false; };
    p.touchEnded = (e?: object) => {
      if (onForm(e)) return true;
      const ev = e as TouchEvent, t = changed(ev)[0];
      if (cur) { if (cur.touchEnded) cur.touchEnded(p, ev); return false; }
      if (t && tapStart && Math.abs(t.x - tapStart.x) < 12 && Math.abs(t.y - tapStart.y) < 12) { // a tap on a tile
        for (const tile of tiles) if (t.x >= tile.x && t.x < tile.x + tile.w && t.y >= tile.y && t.y < tile.y + tile.h) { open(tile.ex); break; }
      }
      tapStart = null; return false;
    };
    (p as unknown as { deviceShaken: () => void }).deviceShaken = () => { if (cur && cur.deviceShaken) cur.deviceShaken(p); };
    p.windowResized = () => {
      p.resizeCanvas(p.windowWidth, p.windowHeight); layout();
      if (cur) { const ex = cur; safely(() => p.removeElements()); resetStyle(); p.background(BG); if (ex.setup) safely(() => ex.setup!(p, top)); }
    };
  }, document.getElementById('stage') || undefined);
}

/** Dev builds: fps, and a graph of the last 90 frame times (green under 20 ms, amber under 40, red above), plus a
 *  "perf" line to the laptop's terminal every 3 s. Release builds: nothing. */
function devHud() {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return null;
  const N = 90, ms = new Float32Array(N), text = document.createElement('canvas'), W = N * 2, H = 34;
  text.width = W; text.height = 16;
  let i0 = 0, last = 0, textAt = 0, logAt = 0, fps = 60;
  return (c: CanvasRenderingContext2D, width: number, top: number, id: string) => {
    const now = performance.now();
    if (last) { const d = now - last; ms[i0] = d; i0 = (i0 + 1) % N; fps += (1000 / Math.max(1, d) - fps) * 0.1; }
    last = now;
    const x0 = width - W - 14, y0 = top + 6, gy = y0 + 18;
    c.fillStyle = '#212121'; c.fillRect(x0 - 6, y0, W + 12, H + 24);
    if (now - textAt > 250) { // text is slow on the A5: redraw it 4 times a second
      textAt = now; const t = text.getContext('2d')!; t.clearRect(0, 0, W, 16);
      t.font = '11px Menlo, monospace'; t.fillStyle = fps < 20 ? '#ef5350' : fps < 40 ? '#ffca28' : '#66bb6a'; t.fillText(Math.round(fps) + ' fps', 0, 12);
    }
    c.drawImage(text, x0, y0 + 2);
    const k = H / 50, COLORS = ['#66bb6a', '#ffca28', '#ef5350'];
    for (let band = 0; band < 3; band++) {
      c.beginPath();
      for (let i = 0; i < N; i++) { const v = ms[(i0 + i) % N]; if (!v || (v <= 20 ? 0 : v <= 40 ? 1 : 2) !== band) continue; const h = Math.min(H, v * k); c.rect(x0 + i * 2, gy + H - h, 2, h); }
      c.fillStyle = COLORS[band]; c.fill();
    }
    c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(x0, gy + H - Math.round(16.7 * k), W, 1); c.fillRect(x0, gy + H - Math.round(33.3 * k), W, 1);
    if (now - logAt > 3000) {
      logAt = now; let worst = 0, sum = 0, n = 0;
      for (let i = 0; i < N; i++) if (ms[i]) { sum += ms[i]; n++; worst = Math.max(worst, ms[i]); }
      if (n) console.log(`perf ${id}: ${Math.round(1000 / (sum / n))} fps, worst ${Math.round(worst)} ms`);
    }
  };
}

// Scenes: each scene gets a fresh World with the core plugins (input, motion, drag, animation, rendering)
// and only adds its own components and systems. The manager runs the frame, the home button and the dev HUD.
import { World, type Plugin } from './ecs';
import { ScreenRes } from './core';
import { frame, TimeRes, useTime } from './loop';
import { Input, InputSourceRes, bindInput, Tap, fingers } from './input';
import { Motion } from './motion';
import { DragPlugin } from './drag';
import { SheetsRes, type Sheets } from './anim';
import { Render, label } from './render';
import { safeTop, statusBarFill } from './page';
import { sound, audio, tone } from './audio';

export interface SceneContext { p: p5; manager: SceneManager; sheets: Sheets }
export interface Scene {
  id: string; title: string; blurb?: string;
  /** background colour (null = the scene draws its own background) */
  clear?: string | null;
  /** fixed update rate, default 60 */
  hz?: number;
  setup(w: World, ctx: SceneContext): void;
}

const HUD_N = 90; // frames in the HUD graph (~1.5 s at 60 fps)

export interface ManagerOptions {
  sheets?: Sheets; home?: string; plugins?: Plugin[]; hud?: boolean; clear?: string;
  /** For displays: after `seconds` with no touch, go to `scene` (an attract loop, or the home scene). */
  idle?: { seconds: number; scene: string };
}

export class SceneManager {
  world!: World;
  current!: Scene;
  readonly sheets: Sheets;
  private next: string | null = null;
  private barFill: string | null | undefined;
  private hud: boolean;
  constructor(public p: p5, public scenes: Scene[], private o: ManagerOptions = {}) {
    this.sheets = o.sheets || {};
    this.hud = o.hud ?? (typeof __DEV__ !== 'undefined' && __DEV__);
    bindInput(((p as unknown as { canvas?: HTMLCanvasElement }).canvas || document.body).parentElement || document.body);
  }

  get home() { return this.o.home || this.scenes[0].id; }

  /** Switch scene at the end of this frame. */
  go(id: string) { this.next = id; }

  start(id: string) {
    const scene = this.scenes.filter((s) => s.id === id)[0] || this.scenes[0];
    const w = new World();
    w.setResource(ScreenRes, { w: this.p.width, h: this.p.height });
    w.setResource(SheetsRes, this.sheets); // shared: sheets loaded once stay loaded across scenes
    w.setResource(InputSourceRes, bindInput());
    useTime(w, scene.hz || 60);
    w.use(Input(), Motion(), DragPlugin(), Render({ p: this.p, clear: scene.clear === undefined ? (this.o.clear || '#fafafa') : scene.clear }));
    if (this.o.plugins) w.use(...this.o.plugins);
    const homeTap = (world: World) => { // the "‹ Menu" pill, top left (below the status bar)
      if (scene.id === this.home) return;
      const taps = world.read(Tap);
      const bottom = safeTop() + 56;
      for (let i = 0; i < taps.length; i++) if (taps[i].x < 130 && taps[i].y < bottom) this.go(this.home);
    };
    if (this.hud) w.profile = {};
    this.lastInput = performance.now(); // a scene change counts as activity
    this.world = w; this.current = scene;
    scene.setup(w, { p: this.p, manager: this, sheets: this.sheets });
    w.system('update', homeTap, 'scenes.home');
    if (typeof console !== 'undefined') console.log(`scene: ${scene.id}`);
  }

  /** Seconds since the last touch. */
  idleSeconds() { return (performance.now() - this.lastInput) / 1000; }
  private lastInput = performance.now();

  frame(nowMs: number) {
    // idle: any queued touch, or a finger resting on the screen, counts as activity
    const src = this.world.resource(InputSourceRes);
    if ((src && src.queue.length) || fingers(this.world) > 0) this.lastInput = nowMs;
    const idle = this.o.idle;
    if (idle && !this.next && this.current.id !== idle.scene && nowMs - this.lastInput > idle.seconds * 1000) this.go(idle.scene);
    frame(this.world, nowMs);
    const ctx = this.p.drawingContext as CanvasRenderingContext2D;
    if (this.current.id !== this.home) {
      const pill = label(this.p, '‹ Menu', { size: 18, color: '#fff', bg: '#212121', style: 'bold' });
      const src = pill.image as { elt?: HTMLCanvasElement } & HTMLImageElement;
      ctx.globalAlpha = 1; ctx.drawImage(src.tagName ? src : src.elt!, 14, safeTop() + 8);
    }
    if (this.barFill === undefined) this.barFill = statusBarFill();
    if (this.barFill) { ctx.globalAlpha = 1; ctx.fillStyle = this.barFill; ctx.fillRect(0, 0, this.p.width, safeTop()); }
    if (this.hud) this.drawHud(ctx);
    if (this.next) { const id = this.next; this.next = null; this.start(id); }
  }

  resize(w: number, h: number) {
    this.p.resizeCanvas(w, h);
    const s = this.world.resource(ScreenRes); if (s) { s.w = w; s.h = h; }
  }

  // Dev HUD: stats line plus a mini graph of the last HUD_N frame times (bar height = ms, lines at 60 and 30 fps).
  private frameMs = new Float32Array(HUD_N);
  private frameIdx = 0;
  private lastNow = 0;
  private hudText: HTMLCanvasElement | null = null;
  private hudTextAt = 0;
  private logAt = 0;

  private drawHud(ctx: CanvasRenderingContext2D) {
    const t = this.world.resource(TimeRes); if (!t) return;
    const now = performance.now();
    if (this.lastNow) { this.frameMs[this.frameIdx] = now - this.lastNow; this.frameIdx = (this.frameIdx + 1) % HUD_N; }
    this.lastNow = now;

    const W = HUD_N * 2, H = 34, x0 = this.p.width - W - 14, y0 = safeTop() + 6, gy = y0 + 18;
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#212121'; ctx.fillRect(x0 - 6, y0, W + 12, H + 24);
    // the stats line is text, which is slow on the A5: redraw it into its own canvas 4 times a second only
    if (!this.hudText) { this.hudText = document.createElement('canvas'); this.hudText.width = W; this.hudText.height = 16; }
    if (now - this.hudTextAt > 250) {
      this.hudTextAt = now;
      const c = this.hudText.getContext('2d')!; c.clearRect(0, 0, W, 16);
      c.font = '11px Menlo, monospace'; c.fillStyle = t.fps < 20 ? '#ef5350' : t.fps < 40 ? '#ffca28' : '#66bb6a';
      c.fillText(`${Math.round(t.fps)} fps · ${t.updateMs}/${t.renderMs} ms · ${this.world.entityCount}`, 0, 12);
    }
    ctx.drawImage(this.hudText, x0, y0 + 2);
    // every 3 s, a line to the dev console (the laptop sees it): fps, worst frame, update/draw ms, entities
    if (now - this.logAt > 3000) {
      this.logAt = now; let worst = 0, sum = 0, n = 0;
      for (let i = 0; i < HUD_N; i++) { const ms = this.frameMs[i]; if (ms) { sum += ms; n++; if (ms > worst) worst = ms; } }
      if (n) console.log(`perf ${this.current.id}: ${Math.round(1000 / (sum / n))} fps, worst ${Math.round(worst)} ms, update ${t.updateMs} ms, draw ${t.renderMs} ms, ${this.world.entityCount} entities`);
      const prof = this.world.profile;
      if (prof) { // the slowest systems over the last 3 s, as ms per second
        const top = Object.keys(prof).sort((a, b) => prof[b] - prof[a]).slice(0, 5).map((k) => `${k} ${Math.round(prof[k] / 3)}`);
        console.log(`  systems (ms/s): ${top.join(', ')}`); this.world.profile = {};
      }
    }
    // bars, oldest on the left; one path per colour so it's 3 fills, not HUD_N
    const scale = H / 50; // 50 ms = full height
    const COLORS = ['#66bb6a', '#ffca28', '#ef5350'];
    for (let c = 0; c < 3; c++) {
      ctx.beginPath();
      for (let i = 0; i < HUD_N; i++) {
        const ms = this.frameMs[(this.frameIdx + i) % HUD_N]; if (!ms) continue;
        const band = ms <= 20 ? 0 : ms <= 40 ? 1 : 2; if (band !== c) continue;
        const h = Math.min(H, ms * scale); ctx.rect(x0 + i * 2, gy + H - h, 2, h);
      }
      ctx.fillStyle = COLORS[c]; ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(x0, gy + H - Math.round(16.7 * scale), W, 1); // 60 fps
    ctx.fillRect(x0, gy + H - Math.round(33.3 * scale), W, 1); // 30 fps
  }
}

/** Remove p5's own window listeners for touch, mouse and device motion: the engine has its own input, and on iOS 8
 *  p5's devicemotion/deviceorientation handlers run ~60 times a second and its touch handlers force a layout. */
export function quietP5(p: p5, keep: string[] = ['resize', 'blur', 'keydown', 'keyup', 'keypress']) {
  const ev = (p as unknown as { _events: Record<string, EventListener | null> })._events;
  for (const k in ev) {
    const f = ev[k]; if (!f || keep.indexOf(k) >= 0) continue;
    window.removeEventListener(k, f, true); window.removeEventListener(k, f, false); // iOS 8 reads {passive:false} as capture=true
    ev[k] = null;
  }
}

/** Standard p5 setup for a scene-based app: canvas, 1x pixels, frame driving, rotation. */
export function runScenes(p: p5, scenes: Scene[], o: ManagerOptions & { start?: string } = {}) {
  p.createCanvas(p.windowWidth, p.windowHeight);
  p.pixelDensity(1);
  const m = new SceneManager(p, scenes, o);
  m.start(o.start || m.home);
  quietP5(p);
  // our own requestAnimationFrame loop instead of p5's draw(): no per-frame p5 bookkeeping or frame-rate throttling
  p.noLoop();
  const tick = () => { m.frame(performance.now()); requestAnimationFrame(tick); }; // one clock everywhere (iOS 8 rAF times differ)
  requestAnimationFrame(tick);
  p.windowResized = () => m.resize(p.windowWidth, p.windowHeight);
  // dev: handles for remote eval (npm run ipad:eval), e.g. __app.go('multi-touch') or pushing fake touches to __input.queue
  if (typeof __DEV__ !== 'undefined' && __DEV__) { const g = window as unknown as Record<string, unknown>; g.__app = m; g.__input = bindInput(); g.__sound = sound; g.__audio = audio; g.__tone = tone; }
  return m;
}

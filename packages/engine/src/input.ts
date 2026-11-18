// Touch and mouse input as gesture events: Tap, Hold, Drag(Start/End) with fling velocity, Pinch(Start/End)
// with scale + twist, plus raw PointerDown/Move/Up. Up to 5 fingers (what the iPad mini tracks).
// Each gesture carries `target`: the top entity under the finger that has a Hitbox, or -1 for empty space.
//
// The recogniser (Gestures) is plain logic with no DOM, so it's unit-tested on the laptop;
// bindInput() feeds it real touch/mouse events.
import { component, event, resource, definePlugin, type World, type Entity } from './ecs';
import { Transform } from './core';

export const now = () => performance.now(); // one clock for input, holds and the loop (shimmed on iOS 8)

// --- events ---
export interface PointerEv { id: number; x: number; y: number; target: Entity }
export interface MoveEv extends PointerEv { dx: number; dy: number }
export interface ReleaseEv extends PointerEv { vx: number; vy: number }
export interface DragEv extends PointerEv { dx: number; dy: number; vx: number; vy: number; startX: number; startY: number }
export interface PinchEv {
  target: Entity; ids: [number, number];
  /** centre between the fingers, and how far it moved since the last Pinch event */
  x: number; y: number; dx: number; dy: number;
  /** since the pinch started: scale ratio and twist in radians */
  scale: number; rotation: number;
  /** since the last Pinch event (multiply / add these onto a sticker) */
  dScale: number; dRotation: number;
}
export const PointerDown = event<PointerEv>('PointerDown');
export const PointerMove = event<MoveEv>('PointerMove');
export const PointerUp = event<ReleaseEv>('PointerUp');
export const Tap = event<PointerEv>('Tap');
export const Hold = event<PointerEv>('Hold');
export const DragStart = event<DragEv>('DragStart');
export const Drag = event<DragEv>('Drag');
/** vx/vy are the release speed in px/s: use them to fling. pinch=true when a second finger turned the drag into a pinch. */
export const DragEnd = event<DragEv & { pinch?: boolean }>('DragEnd');
export const PinchStart = event<PinchEv>('PinchStart');
export const Pinch = event<PinchEv>('Pinch');
export const PinchEnd = event<PinchEv>('PinchEnd');

/** Makes an entity touchable. Circle (r) or box (w, h), centred on its Transform, following its rotation and scale. */
/** Pin an entity to pointer `id` (+ offset): moved in the input stage every frame, drawn exactly under the finger. */
export interface Track { id: number; ox: number; oy: number }
export const Track = component<Track>('Track');

export interface Hitbox { r?: number; w?: number; h?: number; ox?: number; oy?: number }
export const Hitbox = component<Hitbox>('Hitbox');

export const TAP_MS = 350, SLOP = 10, HOLD_MS = 450, STILL_MS = 80;

export interface Pointer {
  id: number; x: number; y: number; sx: number; sy: number; t0: number; lastT: number;
  vx: number; vy: number; target: Entity; dragging: boolean; held: boolean; pinched: boolean;
}
interface PinchState { a: number; b: number; target: Entity; d0: number; a0: number; d: number; ang: number; cx: number; cy: number; last: PinchEv | null }
export interface Raw { type: 'down' | 'move' | 'up' | 'cancel'; id: number; x: number; y: number; t: number }
type Sink = { emit<T>(type: import('./ecs').EventType<T>, ev: T): void };

export class Gestures {
  pointers: Record<number, Pointer> = {};
  count = 0;
  private pinch: PinchState | null = null;
  /** Can this entity be pinched with the second finger anywhere (not only on the entity)? Set by the drag plugin. */
  canPinch: (e: Entity) => boolean = () => false;
  constructor(private hit: (x: number, y: number) => Entity, private out: Sink) {}

  handle(r: Raw) {
    if (r.type === 'down') return this.down(r);
    const p = this.pointers[r.id]; if (!p) return;
    if (r.type === 'move') this.move(p, r); else this.up(p, r);
  }

  /** Call every frame: fires Hold for fingers resting long enough. */
  update(t: number) {
    for (const k in this.pointers) {
      const p = this.pointers[k];
      if (!p.held && !p.dragging && !p.pinched && t - p.t0 >= HOLD_MS) { p.held = true; this.out.emit(Hold, { id: p.id, x: p.x, y: p.y, target: p.target }); }
    }
  }

  private down(r: Raw) {
    if (this.pointers[r.id]) return;
    const p: Pointer = { id: r.id, x: r.x, y: r.y, sx: r.x, sy: r.y, t0: r.t, lastT: r.t, vx: 0, vy: 0, target: this.hit(r.x, r.y), dragging: false, held: false, pinched: false };
    this.pointers[r.id] = p; this.count++;
    this.out.emit(PointerDown, { id: p.id, x: p.x, y: p.y, target: p.target });
    if (!this.pinch) { // a second finger can start a pinch (see below)
      for (const k in this.pointers) {
        const o = this.pointers[k];
        if (o === p || o.pinched) continue;
        // same thing (or both on empty space), or the first finger is on something pinchable and this one isn't on anything else
        if (o.target === p.target || (o.target >= 0 && p.target < 0 && this.canPinch(o.target))) { this.startPinch(o, p); break; }
      }
    }
  }

  private move(p: Pointer, r: Raw) {
    const dx = r.x - p.x, dy = r.y - p.y, dt = (r.t - p.lastT) / 1000;
    if (dx === 0 && dy === 0) return;
    if (dt > 0) { p.vx = p.vx * 0.4 + (dx / dt) * 0.6; p.vy = p.vy * 0.4 + (dy / dt) * 0.6; }
    p.x = r.x; p.y = r.y; p.lastT = r.t;
    this.out.emit(PointerMove, { id: p.id, x: p.x, y: p.y, dx, dy, target: p.target });
    if (p.pinched) { this.updatePinch(); return; }
    if (!p.dragging && (Math.abs(p.x - p.sx) > SLOP || Math.abs(p.y - p.sy) > SLOP)) {
      p.dragging = true;
      this.out.emit(DragStart, this.dragEv(p, p.x - p.sx, p.y - p.sy));
    } else if (p.dragging) this.out.emit(Drag, this.dragEv(p, dx, dy));
  }

  private up(p: Pointer, r: Raw) {
    if (r.t - p.lastT > STILL_MS) { p.vx = 0; p.vy = 0; } // finger stopped before lifting: no fling
    p.x = r.x; p.y = r.y;
    delete this.pointers[p.id]; this.count--;
    if (p.pinched) this.endPinch();
    else if (p.dragging) this.out.emit(DragEnd, this.dragEv(p, 0, 0));
    else if (r.type === 'up' && !p.held && r.t - p.t0 <= TAP_MS) this.out.emit(Tap, { id: p.id, x: p.x, y: p.y, target: p.target });
    this.out.emit(PointerUp, { id: p.id, x: p.x, y: p.y, vx: p.vx, vy: p.vy, target: p.target });
  }

  private dragEv(p: Pointer, dx: number, dy: number): DragEv {
    return { id: p.id, x: p.x, y: p.y, dx, dy, vx: p.vx, vy: p.vy, startX: p.sx, startY: p.sy, target: p.target };
  }

  private startPinch(a: Pointer, b: Pointer) {
    if (a.dragging) { this.out.emit(DragEnd, { ...this.dragEv(a, 0, 0), vx: 0, vy: 0, pinch: true }); a.dragging = false; }
    a.pinched = b.pinched = true;
    const d = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)), ang = Math.atan2(b.y - a.y, b.x - a.x);
    this.pinch = { a: a.id, b: b.id, target: a.target, d0: d, a0: ang, d, ang, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, last: null };
    this.out.emit(PinchStart, this.pinchEv(d, ang, this.pinch.cx, this.pinch.cy));
  }
  private updatePinch() {
    const s = this.pinch!; const a = this.pointers[s.a], b = this.pointers[s.b];
    if (!a || !b) return;
    const d = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)), ang = Math.atan2(b.y - a.y, b.x - a.x);
    this.out.emit(Pinch, this.pinchEv(d, ang, (a.x + b.x) / 2, (a.y + b.y) / 2));
  }
  private pinchEv(d: number, ang: number, cx: number, cy: number): PinchEv {
    const s = this.pinch!;
    let dRot = ang - s.ang; if (dRot > Math.PI) dRot -= 2 * Math.PI; else if (dRot < -Math.PI) dRot += 2 * Math.PI;
    let rot = ang - s.a0; if (rot > Math.PI) rot -= 2 * Math.PI; else if (rot < -Math.PI) rot += 2 * Math.PI;
    const ev: PinchEv = { target: s.target, ids: [s.a, s.b], x: cx, y: cy, dx: cx - s.cx, dy: cy - s.cy, scale: d / s.d0, rotation: rot, dScale: d / s.d, dRotation: dRot };
    s.d = d; s.ang = ang; s.cx = cx; s.cy = cy; s.last = ev;
    return ev;
  }
  private endPinch() {
    const s = this.pinch!; this.pinch = null;
    this.out.emit(PinchEnd, s.last || this.pinchEvFrom(s));
    for (const id of [s.a, s.b]) { // the finger still down carries on as a fresh drag
      const p = this.pointers[id];
      if (p) { p.pinched = false; p.dragging = false; p.held = true; p.sx = p.x; p.sy = p.y; p.vx = p.vy = 0; }
    }
  }
  private pinchEvFrom(s: PinchState): PinchEv {
    return { target: s.target, ids: [s.a, s.b], x: s.cx, y: s.cy, dx: 0, dy: 0, scale: s.d / s.d0, rotation: s.ang - s.a0, dScale: 1, dRotation: 0 };
  }
}

/** Topmost entity with a Hitbox under (x, y): highest z, then lowest on screen (drawn last), or -1. */
export function hitTest(w: World, x: number, y: number): Entity {
  let best = -1, bz = -Infinity, by = -Infinity;
  w.each(Transform, Hitbox, (e, t, h) => {
    let lx = x - t.x, ly = y - t.y;
    if (t.rot) { const c = Math.cos(-t.rot), s = Math.sin(-t.rot); const rx = lx * c - ly * s; ly = lx * s + ly * c; lx = rx; }
    const sc = t.scale || 1; lx = lx / sc - (h.ox || 0); ly = ly / sc - (h.oy || 0);
    const inside = h.r !== undefined ? lx * lx + ly * ly <= h.r * h.r : Math.abs(lx) <= (h.w || 0) / 2 && Math.abs(ly) <= (h.h || 0) / 2;
    if (inside && (t.z > bz || (t.z === bz && t.y > by))) { best = e; bz = t.z; by = t.y; }
  });
  return best;
}

// --- the DOM side ---
export interface InputSource { queue: Raw[] }
export const InputSourceRes = resource<InputSource>('inputSource');
let shared: InputSource | null = null;

/** Listen to touches and the mouse on an element (once per page). Returns the queue the Input plugin drains. */
export function bindInput(el: HTMLElement = document.body): InputSource {
  if (shared) return shared;
  const src: InputSource = (shared = { queue: [] });
  let lastTouch = 0;
  // the element's offset, cached: getBoundingClientRect on every touch forces a layout on Safari 8
  let left = 0, top = 0;
  const measure = () => { const r = el.getBoundingClientRect(); left = r.left; top = r.top; };
  measure(); window.addEventListener('resize', measure, false); window.addEventListener('orientationchange', measure, false);
  const pos = (cx: number, cy: number) => ({ x: cx - left, y: cy - top });
  const touch = (type: Raw['type']) => (e: TouchEvent) => {
    lastTouch = now();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i], p = pos(t.clientX, t.clientY);
      src.queue.push({ type, id: t.identifier, x: p.x, y: p.y, t: now() });
    }
    if (type !== 'move' && e.target === el) e.preventDefault(); // no emulated mouse events, no double-tap zoom
  };
  el.addEventListener('touchstart', touch('down'), false);
  el.addEventListener('touchmove', touch('move'), false);
  el.addEventListener('touchend', touch('up'), false);
  el.addEventListener('touchcancel', touch('cancel'), false);
  let mouseDown = false; // mouse, for testing on the laptop (ignored right after real touches)
  const mouse = (type: Raw['type']) => (e: MouseEvent) => {
    if (now() - lastTouch < 800) return;
    if (type === 'down') mouseDown = true; else if (!mouseDown) return; if (type === 'up') mouseDown = false;
    const p = pos(e.clientX, e.clientY); src.queue.push({ type, id: -1, x: p.x, y: p.y, t: now() });
  };
  el.addEventListener('mousedown', mouse('down'), false);
  window.addEventListener('mousemove', mouse('move'), false);
  window.addEventListener('mouseup', mouse('up'), false);
  return src;
}

export interface InputState {
  gestures: Gestures;
  /** PointerDown / PointerUp from this frame only (refreshed every input stage). Input-stage systems use these
   *  instead of world.read(), whose events live until the next update tick and would be seen twice. */
  downs: PointerEv[];
  ups: ReleaseEv[];
}
export const InputRes = resource<InputState>('input');

/** Input: turns the shared touch queue into gesture events each frame. Options: a custom source (tests). */
export const Input = definePlugin<{ source?: InputSource } | void>('input', (w, opts) => {
  const source = (opts && opts.source) || w.resource(InputSourceRes) || bindInput();
  const state: InputState = { gestures: null as unknown as Gestures, downs: [], ups: [] };
  state.gestures = new Gestures((x, y) => hitTest(w, x, y), {
    emit(type, ev) {
      if (type === PointerDown) state.downs.push(ev as unknown as PointerEv);
      else if (type === PointerUp) state.ups.push(ev as unknown as ReleaseEv);
      w.emit(type, ev);
    },
  });
  const gestures = state.gestures;
  w.setResource(InputRes, state);
  w.system('input', function input(world) {
    state.downs.length = 0; state.ups.length = 0;
    const q = source.queue;
    for (let i = 0; i < q.length; i++) gestures.handle(q[i]);
    q.length = 0;
    gestures.update(now());
    // Track: pin entities to their finger every frame (not every tick) and skip interpolation, so direct
    // manipulation has no added latency. The fixed tick still runs physics for everything else.
    const ps = gestures.pointers;
    world.each(Track, Transform, (_e, k, t) => {
      const p = ps[k.id]; if (!p) return;
      t.x = t.px = p.x + k.ox; t.y = t.py = p.y + k.oy;
    });
  }, 'input.gestures');
});

/** How many fingers are down right now. */
export const fingers = (w: World) => { const s = w.resource(InputRes); return s ? s.gestures.count : 0; };
/** The live pointers (id -> position, velocity, target). */
export const pointers = (w: World) => { const s = w.resource(InputRes); return s ? s.gestures.pointers : {}; };

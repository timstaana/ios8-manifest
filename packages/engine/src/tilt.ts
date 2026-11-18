// Tilt: the iPad's orientation as input, relative to how it was held when the scene started (or calibrateTilt()).
// x/y are -1..1 in screen terms (right/down), whichever way the iPad is rotated, smoothed a little.
// Parallax moves things by tilt every frame; TiltGravity pushes things "downhill".
import { component, resource, definePlugin, type World } from './ecs';
import { Transform } from './core';
import { Accel } from './motion';

export interface Tilt {
  /** -1..1: tilted right / towards the bottom of the screen. */
  x: number; y: number;
  /** true once the device has sent an orientation reading (false on laptops). */
  available: boolean;
  /** degrees of tilt that count as full (1). */
  range: number;
  /** 0..1 smoothing per frame (1 = raw). */
  smooth: number;
  nx: number; ny: number; calibrated: boolean;
}
export const TiltRes = resource<Tilt>('tilt');

/** Keeps an entity at (x0, y0) + tilt * depth, in pixels. Bigger depth = nearer. */
export interface Parallax { depth: number; x0: number; y0: number }
export const Parallax = component<Parallax>('Parallax');
export const parallax = (x0: number, y0: number, depth: number): Parallax => ({ x0, y0, depth });

/** Sets the entity's Accel from tilt: g pixels/s² at full tilt. Needs Velocity (and usually Bounds, Damping). */
export interface TiltGravity { g: number }
export const TiltGravity = component<TiltGravity>('TiltGravity');

// One listener for the page; the handler only stores numbers (orientation events arrive ~60 times a second).
const raw = { beta: 0, gamma: 0, has: false };
let listening = false;
function listen() {
  if (listening) return; listening = true;
  window.addEventListener('deviceorientation', (e: DeviceOrientationEvent) => {
    if (e.beta === null || e.gamma === null) return;
    raw.beta = e.beta; raw.gamma = e.gamma; raw.has = true;
  }, false);
}

/** Device tilt in screen terms (degrees): portrait, upside down or either landscape. */
function screenTilt(out: { x: number; y: number }) {
  const o = (window as unknown as { orientation?: number }).orientation || 0;
  if (o === 90) { out.x = raw.beta; out.y = -raw.gamma; }
  else if (o === -90) { out.x = -raw.beta; out.y = raw.gamma; }
  else if (o === 180) { out.x = -raw.gamma; out.y = -raw.beta; }
  else { out.x = raw.gamma; out.y = raw.beta; }
}

/** Make the current way the iPad is held the neutral (0, 0). */
export function calibrateTilt(w: World) { const t = w.resource(TiltRes); if (t) t.calibrated = false; }

const now = { x: 0, y: 0 };
function readTilt(w: World) {
  const t = w.resource(TiltRes)!; if (!raw.has) return;
  screenTilt(now);
  if (!t.calibrated) { t.nx = now.x; t.ny = now.y; t.calibrated = true; t.available = true; }
  const tx = Math.max(-1, Math.min(1, (now.x - t.nx) / t.range)), ty = Math.max(-1, Math.min(1, (now.y - t.ny) / t.range));
  t.x += (tx - t.x) * t.smooth; t.y += (ty - t.y) * t.smooth;
  // parallax every frame (not per tick) and without interpolation, so it tracks the hand exactly
  w.each(Parallax, Transform, (_e, p, tr) => { tr.x = tr.px = p.x0 + t.x * p.depth; tr.y = tr.py = p.y0 + t.y * p.depth; });
}
function tiltGravity(w: World) {
  const t = w.resource(TiltRes)!;
  w.each(TiltGravity, Accel, (_e, g, a) => { a.ax = t.x * g.g; a.ay = t.y * g.g; });
}

/** Tilt input. Options: range (degrees for full tilt, default 25), smooth (default 0.25). */
export const TiltPlugin = definePlugin<{ range?: number; smooth?: number } | void>('tilt', (w, o) => {
  listen();
  w.setResource(TiltRes, { x: 0, y: 0, available: raw.has, range: (o && o.range) || 25, smooth: (o && o.smooth) || 0.25, nx: 0, ny: 0, calibrated: false });
  w.system('input', readTilt, 'tilt.read');
  w.system('update', tiltGravity, 'tilt.gravity');
});

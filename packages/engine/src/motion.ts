// Simple, stable motion: velocity, damping, bouncing inside a box, and springy following.
import { component, event, definePlugin, type World, type Entity } from './ecs';
import { Transform, Core, screen } from './core';

/** px/s and radians/s. */
export interface Velocity { vx: number; vy: number; va: number }
export const Velocity = component<Velocity>('Velocity');
export const velocity = (vx = 0, vy = 0, va = 0): Velocity => ({ vx, vy, va });

/** Fraction of speed lost per second (0 = none, 3 = stops quickly). */
export interface Damping { k: number }
export const Damping = component<Damping>('Damping');

/** Keep inside a box (defaults to the screen), bouncing with `bounce` (0..1) of the speed. r = how far the edge is from the centre. */
export interface Bounds { r: number; bounce: number; left?: number; top?: number; right?: number; bottom?: number }
export const Bounds = component<Bounds>('Bounds');
export const BounceEv = event<{ e: Entity; speed: number; side: 'left' | 'right' | 'top' | 'bottom' }>('Bounce');

/** Pulled towards (x, y) like on a spring. stiffness ~ 60-300, damping ~ 8-25. */
export interface Follow { x: number; y: number; stiffness: number; damping: number }
export const Follow = component<Follow>('Follow');

/** Constant acceleration in px/s² (gravity). */
export interface Accel { ax: number; ay: number }
export const Accel = component<Accel>('Accel');

/** Entities with this are moved by something else (a finger): motion leaves their position alone. */
export const Held = component<true>('Held');

function integrate(w: World, dt: number) {
  w.each(Transform, Follow, (e, t, f) => {
    if (w.hasComponent(e, Held)) return;
    const v = w.get(e, Velocity) || w.set(e, Velocity, velocity());
    v.vx += ((f.x - t.x) * f.stiffness - v.vx * f.damping) * dt;
    v.vy += ((f.y - t.y) * f.stiffness - v.vy * f.damping) * dt;
  });
  w.each(Velocity, Accel, (_e, v, a) => { v.vx += a.ax * dt; v.vy += a.ay * dt; });
  w.each(Velocity, Damping, (_e, v, d) => { const f = Math.max(0, 1 - d.k * dt); v.vx *= f; v.vy *= f; v.va *= f; });
  w.each(Transform, Velocity, (e, t, v) => {
    if (w.hasComponent(e, Held)) return;
    t.x += v.vx * dt; t.y += v.vy * dt; t.rot += v.va * dt;
  });
  const s = screen(w);
  w.each(Transform, Bounds, (e, t, b) => {
    const v = w.get(e, Velocity); if (!v || w.hasComponent(e, Held)) return;
    const l = (b.left ?? 0) + b.r, r = (b.right ?? s.w) - b.r, tp = (b.top ?? 0) + b.r, bt = (b.bottom ?? s.h) - b.r;
    if (t.x < l && v.vx < 0) { t.x = l; w.emit(BounceEv, { e, speed: -v.vx, side: 'left' }); v.vx = -v.vx * b.bounce; }
    else if (t.x > r && v.vx > 0) { t.x = r; w.emit(BounceEv, { e, speed: v.vx, side: 'right' }); v.vx = -v.vx * b.bounce; }
    if (t.y < tp && v.vy < 0) { t.y = tp; w.emit(BounceEv, { e, speed: -v.vy, side: 'top' }); v.vy = -v.vy * b.bounce; }
    else if (t.y > bt && v.vy > 0) { t.y = bt; w.emit(BounceEv, { e, speed: v.vy, side: 'bottom' }); v.vy = -v.vy * b.bounce; }
  });
}

export const Motion = definePlugin('motion', (w) => { w.use(Core()); w.system('update', integrate, 'motion.integrate'); });

// Fixed-timestep loop: game logic ('update' systems) runs at a steady rate (60 Hz by default; logic is cheap, drawing is the A5's bottleneck),
// drawing ('render') runs once per frame. Movement then feels the same at 20 fps on an iPad mini 1
// as at 60 fps on a laptop, and physics doesn't explode when a frame is slow.
import { resource, type World } from './ecs';

export interface Time {
  /** Seconds per update tick (1/hz). Update systems get this as dt. */
  step: number;
  /** Time in ms of the current frame. */
  now: number;
  /** Update ticks run so far. */
  tick: number;
  /** 0..1, how far between the last tick and the next the frame is: render uses it to interpolate. */
  alpha: number;
  /** Measured frames per second (smoothed). */
  fps: number;
  /** ms the update systems took last frame, and the render systems. */
  updateMs: number;
  renderMs: number;
  /** Seconds since the scene started. */
  elapsed: number;
  acc: number;
  last: number;
}
export const TimeRes = resource<Time>('time');

export function useTime(world: World, hz = 60): Time {
  return world.resource(TimeRes) || world.setResource(TimeRes, { step: 1 / hz, now: 0, tick: 0, alpha: 0, fps: 0, updateMs: 0, renderMs: 0, elapsed: 0, acc: 0, last: -1 });
}

const MAX_STEPS = 4; // at most this many ticks per frame; after a long stall, drop time instead of spiralling

/** Run one frame: input systems, then 0..n fixed update ticks, then render systems. */
export function frame(world: World, nowMs: number) {
  const t = useTime(world);
  if (t.last < 0) t.last = nowMs - t.step * 1000;
  let frameMs = nowMs - t.last; t.last = nowMs; t.now = nowMs;
  if (frameMs > 250) frameMs = 250;
  if (frameMs > 0) t.fps = t.fps ? t.fps + (1000 / frameMs - t.fps) * 0.1 : 1000 / frameMs;

  world.run('input', frameMs / 1000);

  const u0 = Date.now();
  t.acc += frameMs / 1000;
  let steps = 0;
  while (t.acc >= t.step && steps < MAX_STEPS) {
    world.run('update', t.step);
    world.clearEvents(); // events live for one tick: input events reach every update system once
    t.acc -= t.step; t.tick++; t.elapsed += t.step; steps++;
  }
  if (steps === MAX_STEPS && t.acc > t.step) t.acc = 0;
  t.updateMs = Date.now() - u0;
  t.alpha = t.acc / t.step;

  const r0 = Date.now();
  world.run('render', frameMs / 1000);
  t.renderMs = Date.now() - r0;
}

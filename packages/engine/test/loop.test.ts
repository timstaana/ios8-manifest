import { describe, it, expect } from 'vitest';
import { World, event } from '../src/ecs';
import { frame, useTime, TimeRes } from '../src/loop';

describe('fixed-timestep loop', () => {
  it('runs update at a fixed rate regardless of frame rate', () => {
    const w = new World(); useTime(w, 30);
    let ticks = 0, frames = 0;
    w.system('update', () => ticks++); w.system('render', () => frames++);
    let t = 1000; frame(w, t);
    for (let i = 0; i < 60; i++) { t += 1000 / 60; frame(w, t); } // 1 s at 60 fps
    expect(frames).toBe(61);
    expect(ticks).toBeGreaterThanOrEqual(30); expect(ticks).toBeLessThanOrEqual(32);
    const w2 = new World(); useTime(w2, 30); let t2 = 1000, ticks2 = 0;
    w2.system('update', () => ticks2++); frame(w2, t2);
    for (let i = 0; i < 20; i++) { t2 += 50; frame(w2, t2); } // 1 s at 20 fps
    expect(ticks2).toBeGreaterThanOrEqual(30); expect(ticks2).toBeLessThanOrEqual(32);
  });

  it('caps catch-up after a long stall', () => {
    const w = new World(); useTime(w, 30); let ticks = 0;
    w.system('update', () => ticks++);
    frame(w, 1000); ticks = 0;
    frame(w, 6000); // 5 s freeze
    expect(ticks).toBeLessThanOrEqual(4);
  });

  it('events reach every update system in a tick, then clear', () => {
    const w = new World(); useTime(w, 30);
    const Ev = event<number>('Ev'); const seen: number[] = [];
    w.system('input', (world) => world.emit(Ev, 1));
    w.system('update', (world) => { for (const v of world.read(Ev)) seen.push(v); });
    w.system('update', (world) => { for (const v of world.read(Ev)) seen.push(v * 10); });
    frame(w, 1000); frame(w, 1000 + 34);
    expect(seen.slice(0, 2)).toEqual([1, 10]);
    expect(w.read(Ev).length).toBe(0);
    expect(w.resource(TimeRes)!.tick).toBeGreaterThan(0);
  });
});

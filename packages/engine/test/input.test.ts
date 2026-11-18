import { describe, it, expect } from 'vitest';
import { World, type EventType } from '../src/ecs';
import { Gestures, hitTest, Hitbox, Tap, Hold, DragStart, Drag, DragEnd, PinchStart, Pinch, PinchEnd, HOLD_MS } from '../src/input';
import { Transform, transform } from '../src/core';

function rec(hit = () => -1) {
  const log: { type: string; ev: any }[] = [];
  const g = new Gestures(hit, { emit<T>(type: EventType<T>, ev: T) { log.push({ type: type.name, ev }); } });
  const of = (n: string) => log.filter((l) => l.type === n).map((l) => l.ev);
  return { g, log, of };
}

describe('gestures', () => {
  it('a quick still touch is a tap', () => {
    const { g, of } = rec(() => 7);
    g.handle({ type: 'down', id: 1, x: 100, y: 100, t: 0 });
    g.handle({ type: 'move', id: 1, x: 103, y: 101, t: 50 });
    g.handle({ type: 'up', id: 1, x: 103, y: 101, t: 120 });
    expect(of(Tap.name)).toHaveLength(1);
    expect(of(Tap.name)[0].target).toBe(7);
    expect(of(DragStart.name)).toHaveLength(0);
  });

  it('a long still touch is a hold, not a tap', () => {
    const { g, of } = rec();
    g.handle({ type: 'down', id: 1, x: 10, y: 10, t: 0 });
    g.update(HOLD_MS + 10);
    g.handle({ type: 'up', id: 1, x: 10, y: 10, t: HOLD_MS + 20 });
    expect(of(Hold.name)).toHaveLength(1);
    expect(of(Tap.name)).toHaveLength(0);
  });

  it('moving past the slop drags, and a fast release flings', () => {
    const { g, of } = rec();
    g.handle({ type: 'down', id: 1, x: 0, y: 0, t: 0 });
    for (let i = 1; i <= 5; i++) g.handle({ type: 'move', id: 1, x: i * 20, y: 0, t: i * 16 });
    g.handle({ type: 'up', id: 1, x: 100, y: 0, t: 90 });
    expect(of(DragStart.name)).toHaveLength(1);
    expect(of(Drag.name).length).toBeGreaterThan(2);
    const end = of(DragEnd.name)[0];
    expect(end.vx).toBeGreaterThan(800); // ~1250 px/s
    expect(of(Tap.name)).toHaveLength(0);
  });

  it('a finger that stops before lifting does not fling', () => {
    const { g, of } = rec();
    g.handle({ type: 'down', id: 1, x: 0, y: 0, t: 0 });
    g.handle({ type: 'move', id: 1, x: 60, y: 0, t: 30 });
    g.handle({ type: 'up', id: 1, x: 60, y: 0, t: 400 });
    expect(of(DragEnd.name)[0].vx).toBe(0);
  });

  it('two fingers on the same target pinch: scale and twist', () => {
    const { g, of } = rec(() => 3);
    g.handle({ type: 'down', id: 1, x: 100, y: 100, t: 0 });
    g.handle({ type: 'down', id: 2, x: 200, y: 100, t: 10 });
    expect(of(PinchStart.name)).toHaveLength(1);
    g.handle({ type: 'move', id: 2, x: 300, y: 100, t: 30 }); // twice as far apart
    const p = of(Pinch.name).pop();
    expect(p.scale).toBeCloseTo(2, 5);
    expect(p.dScale).toBeCloseTo(2, 5);
    g.handle({ type: 'move', id: 2, x: 100, y: 300, t: 50 }); // swing a quarter turn
    const q = of(Pinch.name).pop();
    expect(q.rotation).toBeCloseTo(Math.PI / 2, 5);
    g.handle({ type: 'up', id: 1, x: 100, y: 100, t: 70 });
    expect(of(PinchEnd.name)).toHaveLength(1);
    expect(of(Tap.name)).toHaveLength(0);
  });

  it('five fingers are tracked independently', () => {
    const { g } = rec();
    for (let i = 0; i < 5; i++) g.handle({ type: 'down', id: i + 10, x: i * 100, y: 0, t: 0 });
    expect(g.count).toBe(5);
  });
});

describe('hitTest', () => {
  it('picks the top entity, honouring rotation and scale', () => {
    const w = new World();
    const a = w.spawn(); w.set(a, Transform, transform(100, 100, { z: 0 })); w.set(a, Hitbox, { r: 50 });
    const b = w.spawn(); w.set(b, Transform, transform(120, 100, { z: 1 })); w.set(b, Hitbox, { r: 30 });
    expect(hitTest(w, 120, 100)).toBe(b);
    expect(hitTest(w, 60, 100)).toBe(a);
    expect(hitTest(w, 400, 400)).toBe(-1);
    const c = w.spawn(); w.set(c, Transform, transform(500, 500, { rot: Math.PI / 2, scale: 2 })); w.set(c, Hitbox, { w: 100, h: 20 });
    expect(hitTest(w, 500, 590)).toBe(c);  // a 100x20 box turned upright and doubled: reaches 100 px down
    expect(hitTest(w, 590, 500)).toBe(-1);
  });
});

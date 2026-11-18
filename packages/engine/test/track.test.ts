import { describe, it, expect } from 'vitest';
import { World } from '../src/ecs';
import { Input, Track, type InputSource } from '../src/input';
import { Transform, transform, ScreenRes } from '../src/core';
import { useTime, frame } from '../src/loop';

describe('Track', () => {
  it('pins an entity to its finger every frame, with no interpolation lag', () => {
    const w = new World(), source: InputSource = { queue: [] };
    w.setResource(ScreenRes, { w: 1024, h: 768 });
    useTime(w, 30);
    w.use(Input({ source }));
    const e = w.spawn();
    w.set(e, Transform, transform(0, 0));
    w.set(e, Track, { id: 3, ox: 5, oy: -5 });
    source.queue.push({ type: 'down', id: 3, x: 100, y: 100, t: 0 });
    frame(w, 1000);
    source.queue.push({ type: 'move', id: 3, x: 140, y: 120, t: 5 });
    frame(w, 1005); // a frame with no update tick still moves it
    const t = w.get(e, Transform)!;
    expect([t.x, t.y, t.px, t.py]).toEqual([145, 115, 145, 115]);
  });
});

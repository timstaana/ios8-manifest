import { describe, it, expect } from 'vitest';
import { World } from '../src/ecs';
import { Input, Hitbox, PinchStart, type InputSource } from '../src/input';
import { Transform, transform, ScreenRes } from '../src/core';
import { useTime, frame } from '../src/loop';
import { DragPlugin, Draggable, draggable, Pinchable, pinchable, Dragging } from '../src/drag';

function setup() {
  const w = new World(), source: InputSource = { queue: [] };
  w.setResource(ScreenRes, { w: 1024, h: 768 }); useTime(w, 60);
  w.use(Input({ source }), DragPlugin());
  const e = w.spawn();
  w.set(e, Transform, transform(500, 400)); w.set(e, Hitbox, { r: 50 });
  w.set(e, Draggable, draggable()); w.set(e, Pinchable, pinchable());
  let t = 1000; const step = () => { t += 17; frame(w, t); };
  const touch = (type: 'down' | 'move' | 'up', id: number, x: number, y: number) => source.queue.push({ type, id, x, y, t });
  return { w, e, step, touch };
}

describe('pinch', () => {
  it('a second finger on empty space pinches the thing under the first finger', () => {
    const { w, e, step, touch } = setup();
    touch('down', 1, 500, 400); step();
    expect(w.hasComponent(e, Dragging)).toBe(true);
    let started = false; w.system('update', (world) => { if (world.read(PinchStart).length) started = true; });
    touch('down', 2, 700, 400); step(); step();
    expect(started).toBe(true);
  });

  it('spreading the fingers to twice the distance doubles the scale, about the point between them', () => {
    const { w, e, step, touch } = setup();
    touch('down', 1, 450, 400); step();
    touch('down', 2, 550, 400); step(); // centre 500,400 = the entity
    touch('move', 1, 400, 400); touch('move', 2, 600, 400); step(); step();
    const t = w.get(e, Transform)!;
    expect(t.scale).toBeCloseTo(2, 5);
    expect(t.x).toBeCloseTo(500, 5); expect(t.y).toBeCloseTo(400, 5);
  });

  it('a quarter turn of the fingers rotates it a quarter turn', () => {
    const { w, e, step, touch } = setup();
    touch('down', 1, 450, 400); step();
    touch('down', 2, 550, 400); step();
    touch('move', 1, 500, 350); touch('move', 2, 500, 450); step(); step();
    expect(w.get(e, Transform)!.rot).toBeCloseTo(Math.PI / 2, 5);
  });

  it('lifting one finger after a pinch keeps dragging with the other', () => {
    const { w, e, step, touch } = setup();
    touch('down', 1, 450, 400); step();
    touch('down', 2, 550, 400); step();
    touch('up', 1, 450, 400); step(); step();
    expect(w.get(e, Dragging)?.id).toBe(2);
    touch('move', 2, 650, 400); step();
    expect(w.get(e, Transform)!.x).toBeCloseTo(600, 5); // kept its 50 px offset from finger 2
  });
});

// Drag anything with a Hitbox + Draggable: grabbed the moment a finger lands on it, thrown with the finger's speed.
// Pinch and twist anything with Pinchable. Grabbed things come to the front.
import { component, event, definePlugin, type World, type Entity } from './ecs';
import { Transform } from './core';
import { Input, InputRes, Track, PinchStart, Pinch, PinchEnd, pointers } from './input';
import { Motion, Velocity, Held, velocity } from './motion';

export interface Draggable { fling: number; maxSpeed: number; toFront: boolean }
export const Draggable = component<Draggable>('Draggable');
export const draggable = (o: Partial<Draggable> = {}): Draggable => ({ fling: 1, maxSpeed: 2500, toFront: true, ...o });

/** Present while a finger holds the entity. */
export interface Dragging { id: number; ox: number; oy: number }
export const Dragging = component<Dragging>('Dragging');

export interface Pinchable { minScale: number; maxScale: number; rotate: boolean }
export const Pinchable = component<Pinchable>('Pinchable');
export const pinchable = (o: Partial<Pinchable> = {}): Pinchable => ({ minScale: 0.3, maxScale: 4, rotate: true, ...o });

export const Grabbed = event<{ e: Entity }>('Grabbed');
export const Released = event<{ e: Entity; vx: number; vy: number }>('Released');

let topZ = 1;
function bringToFront(w: World, e: Entity) { const t = w.get(e, Transform); if (t) t.z = Math.max(t.z, ++topZ); }

// Runs in the input stage, every frame: a finger landing on a Draggable grabs it at once (no slop, no waiting
// for the next tick) and lifting it throws it on the same frame. Track keeps it under the finger in between.
function catchSystem(w: World) {
  const st = w.resource(InputRes); if (!st) return;
  for (let i = 0; i < st.downs.length; i++) {
    const ev = st.downs[i], e = ev.target;
    const d = e >= 0 ? w.get(e, Draggable) : undefined, t = e >= 0 ? w.get(e, Transform) : undefined;
    if (!d || !t || w.hasComponent(e, Dragging)) continue;
    const g = w.set(e, Dragging, { id: ev.id, ox: t.x - ev.x, oy: t.y - ev.y });
    w.set(e, Track, { id: g.id, ox: g.ox, oy: g.oy });
    t.px = t.x; t.py = t.y; // stop drawing it mid-interpolation
    const v = w.get(e, Velocity); if (v) { v.vx = v.vy = 0; v.va = 0; } // caught
    w.tag(e, Held);
    if (d.toFront) bringToFront(w, e);
    w.emit(Grabbed, { e });
  }
  for (let i = 0; i < st.ups.length; i++) {
    const ev = st.ups[i];
    w.each(Dragging, Draggable, (e, g, d) => {
      if (g.id !== ev.id) return;
      w.remove(e, Dragging); w.remove(e, Track); w.remove(e, Held);
      let vx = ev.vx * d.fling, vy = ev.vy * d.fling; const sp = Math.hypot(vx, vy);
      if (sp > d.maxSpeed) { vx *= d.maxSpeed / sp; vy *= d.maxSpeed / sp; }
      const v = w.get(e, Velocity) || w.set(e, Velocity, velocity());
      v.vx = vx; v.vy = vy;
      w.emit(Released, { e, vx, vy });
    });
  }
}

// Pinch scales and twists around the point between the fingers, so the thing stays under them.
function pinchSystem(w: World) {
  const starts = w.read(PinchStart);
  for (let i = 0; i < starts.length; i++) {
    const e = starts[i].target;
    if (e >= 0 && w.hasComponent(e, Pinchable)) { w.tag(e, Held); w.remove(e, Track); bringToFront(w, e); } // the pinch moves it now
  }
  const ps = w.read(Pinch);
  for (let i = 0; i < ps.length; i++) {
    const ev = ps[i], e = ev.target; if (e < 0) continue;
    const p = w.get(e, Pinchable), t = w.get(e, Transform); if (!p || !t) continue;
    const scale = Math.min(p.maxScale, Math.max(p.minScale, t.scale * ev.dScale)), k = scale / t.scale;
    const rot = p.rotate ? ev.dRotation : 0, cos = Math.cos(rot), sin = Math.sin(rot);
    const ox = ev.x - ev.dx, oy = ev.y - ev.dy, rx = t.x - ox, ry = t.y - oy; // offset from the old centre point
    t.x = ev.x + (rx * cos - ry * sin) * k; t.y = ev.y + (rx * sin + ry * cos) * k;
    t.scale = scale; t.rot += rot;
    t.px = t.x; t.py = t.y; t.prot = t.rot; // drawn exactly where the fingers put it (no interpolation lag)
  }
  const ends = w.read(PinchEnd);
  for (let i = 0; i < ends.length; i++) {
    const ev = ends[i], e = ev.target;
    if (e < 0 || !w.hasComponent(e, Pinchable)) continue;
    const t = w.get(e, Transform), v = w.get(e, Velocity); if (v) { v.vx = v.vy = 0; v.va = 0; }
    // a finger still down carries on dragging it
    const ps2 = pointers(w); let id = -1;
    for (let k = 0; k < ev.ids.length; k++) if (ps2[ev.ids[k]]) id = ev.ids[k];
    if (id >= 0 && t) {
      const f = ps2[id], g = { id, ox: t.x - f.x, oy: t.y - f.y };
      w.set(e, Dragging, g); w.set(e, Track, { id, ox: g.ox, oy: g.oy });
    } else { w.remove(e, Dragging); w.remove(e, Held); }
  }
}

export const DragPlugin = definePlugin('drag', (w) => {
  w.use(Input(), Motion());
  const st = w.resource(InputRes); if (st) st.gestures.canPinch = (e) => w.hasComponent(e, Pinchable);
  w.system('input', catchSystem, 'drag.catch'); // after input.gestures, which fills downs/ups
  w.system('update', pinchSystem, 'drag.pinch');
});

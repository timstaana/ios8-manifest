// Simple flat UI made of sprites: buttons (a label with a background and an action) and meters (bars).
// Everything is a normal entity, so it sorts, hides and despawns like anything else.
import { component, definePlugin, type World, type Entity } from './ecs';
import { Transform, transform } from './core';
import { Hitbox, PointerDown, PointerUp, Tap, Input } from './input';
import { Sprite, sprite, sheets } from './anim';
import { P5Res, label, makeSheet, Render } from './render';

export interface Button { action: (w: World, e: Entity) => void; pressed: boolean }
export const Button = component<Button>('Button');

export interface ButtonStyle { size?: number; color?: string; bg?: string; radius?: number; pad?: number; z?: number }

/** A tappable label: button(w, x, y, 'Undo', () => ..., { bg: '#2196f3' }). Centred on (x, y). */
export function button(w: World, x: number, y: number, text: string, action: Button['action'], o: ButtonStyle = {}): Entity {
  const e = w.spawn();
  w.set(e, Transform, transform(x, y, { z: o.z ?? 50 }));
  setButtonText(w, e, text, o);
  w.set(e, Button, { action, pressed: false });
  return e;
}

/** Change a button's text (and size its hitbox to match). */
export function setButtonText(w: World, e: Entity, text: string, o: ButtonStyle = {}) {
  const p = w.resource(P5Res)!, size = o.size || 18;
  const sh = label(p, text, { size, color: o.color || '#fff', bg: o.bg || '#212121', radius: o.radius ?? 8, pad: o.pad ?? size * 0.6, style: 'bold' });
  const key = 'ui:' + text + '|' + size + '|' + (o.bg || '') + '|' + (o.color || '');
  sheets(w)[key] = sh;
  const s = w.get(e, Sprite); if (s) { s.sheet = key; s.frame = 0; } else w.set(e, Sprite, sprite(key));
  w.set(e, Hitbox, { w: sh.frameWidth + 16, h: sh.frameHeight + 16 }); // a little bigger than it looks: fingers are wide
}

function buttons(w: World) {
  const downs = w.read(PointerDown);
  for (let i = 0; i < downs.length; i++) { const b = w.get(downs[i].target, Button), t = w.get(downs[i].target, Transform); if (b && t) { b.pressed = true; t.scale = 0.94; } }
  const ups = w.read(PointerUp);
  for (let i = 0; i < ups.length; i++) { const b = w.get(ups[i].target, Button), t = w.get(ups[i].target, Transform); if (b && t) { b.pressed = false; t.scale = 1; } }
  const taps = w.read(Tap);
  for (let i = 0; i < taps.length; i++) { const e = taps[i].target, b = w.get(e, Button); if (b) b.action(w, e); }
}

/** A horizontal meter: a track and a fill whose width follows value (0..1). Left edge at x, vertically centred on y. */
export interface Meter { value: number; width: number; fill: Entity }
export const Meter = component<Meter>('Meter');

function solid(w: World, color: string) {
  const all = sheets(w), key = 'ui:solid:' + color;
  if (!all[key]) all[key] = makeSheet(w.resource(P5Res)!, { frameWidth: 4, frameHeight: 4, frames: 1, draw(g) { g.noStroke(); g.fill(color); g.rect(0, 0, 4, 4); } });
  return key;
}

export function meter(w: World, x: number, y: number, width: number, height: number, color: string, o: { track?: string; value?: number; z?: number } = {}): Entity {
  const z = o.z ?? 40, track = w.spawn(), fill = w.spawn();
  w.set(track, Transform, transform(x, y, { z }));
  w.set(track, Sprite, sprite(solid(w, o.track || '#e0e0e0'), 'idle', { ax: 0, ay: 0.5, w: width, h: height }));
  w.set(fill, Transform, transform(x, y, { z: z + 0.5 }));
  w.set(fill, Sprite, sprite(solid(w, color), 'idle', { ax: 0, ay: 0.5, w: width * (o.value ?? 1), h: height }));
  w.set(track, Meter, { value: o.value ?? 1, width, fill });
  return track;
}

/** Set a meter's value (0..1). */
export function setMeter(w: World, e: Entity, v: number) {
  const m = w.get(e, Meter); if (!m) return;
  m.value = Math.max(0, Math.min(1, v));
  const s = w.get(m.fill, Sprite); if (s) { s.w = m.width * m.value; s.visible = m.value > 0.001; }
}

/** UI: buttons respond to taps. */
export const UI = definePlugin('ui', (w) => { w.use(Input(), Render({ p: w.resource(P5Res)! })); w.system('update', buttons, 'ui.buttons'); });

// Components and resources nearly every scene uses.
import { component, resource, definePlugin, type World, type Entity } from './ecs';

/** Position, rotation (radians), scale and draw order. px/py/prot are last tick's values, for smooth drawing. */
export interface Transform { x: number; y: number; rot: number; scale: number; z: number; px: number; py: number; prot: number }
export const Transform = component<Transform>('Transform');
export const transform = (x: number, y: number, o: Partial<Transform> = {}): Transform =>
  ({ x, y, rot: 0, scale: 1, z: 0, px: x, py: y, prot: 0, ...o });

/** Removes the entity after `left` seconds. `total` lets renderers fade it out. */
export interface Lifetime { left: number; total: number }
export const Lifetime = component<Lifetime>('Lifetime');
export const lifetime = (seconds: number): Lifetime => ({ left: seconds, total: seconds });

/** The canvas size in CSS pixels. Updated on rotate/resize. */
export interface Screen { w: number; h: number }
export const ScreenRes = resource<Screen>('screen');
export const screen = (w: World): Screen => w.resource(ScreenRes) || w.setResource(ScreenRes, { w: 1024, h: 768 });

/** Remember last tick's position so render can interpolate. Runs first in 'update'. */
function rememberPrevious(w: World) {
  w.each(Transform, (_e, t) => { t.px = t.x; t.py = t.y; t.prot = t.rot; });
}
function expire(w: World, dt: number) {
  w.each(Lifetime, (e, l) => { l.left -= dt; if (l.left <= 0) w.despawn(e); });
}

/** Core: Transform history and Lifetime. Installed by every scene. */
export const Core = definePlugin('core', (w) => {
  screen(w);
  w.system('update', rememberPrevious, 'core.rememberPrevious');
  w.system('update', expire, 'core.expire');
});

/** Spawn an entity and set several components in one go: spawnWith(w, [Transform, transform(0,0)], [Tag, true]). */
export function spawnWith(w: World, ...parts: [import('./ecs').ComponentType<any>, unknown][]): Entity {
  const e = w.spawn();
  for (let i = 0; i < parts.length; i++) w.set(e, parts[i][0], parts[i][1]);
  return e;
}

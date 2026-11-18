// Frame-by-frame animation from sprite strips (made by `npm run sheets` from Krita/PNG frames, or drawn in code).
// A Sprite plays a named clip of its sheet; play(sprite, 'walk') switches clip (and restarts it only if it changed).
import { component, event, resource, definePlugin, type World, type Entity } from './ecs';

export interface Clip { frames: number[]; fps: number; loop: boolean; next?: string }
/** One horizontal strip of equal frames. `image` is whatever the renderer draws (a p5.Image or p5.Graphics). */
export interface SpriteSheet { image: unknown; frameWidth: number; frameHeight: number; clips: Record<string, Clip> }

export interface Sheets { [name: string]: SpriteSheet }
export const SheetsRes = resource<Sheets>('sheets');
export const sheets = (w: World): Sheets => w.resource(SheetsRes) || w.setResource(SheetsRes, {});

export interface Sprite {
  sheet: string; clip: string; t: number; frame: number; done: boolean; speed: number;
  /** drawn size in px (default: the frame size), anchor 0..1 (default centre, 0.5/0.5), mirror, opacity */
  w?: number; h?: number; ax: number; ay: number; flipX: boolean; alpha: number; visible: boolean;
}
export const Sprite = component<Sprite>('Sprite');
export const sprite = (sheet: string, clip = 'idle', o: Partial<Sprite> = {}): Sprite =>
  ({ sheet, clip, t: 0, frame: 0, done: false, speed: 1, ax: 0.5, ay: 0.5, flipX: false, alpha: 1, visible: true, ...o });

/** Switch clip; restarts only when it's a different clip (or restart = true). */
export function play(s: Sprite, clip: string, restart = false) {
  if (s.clip === clip && !restart) return;
  s.clip = clip; s.t = 0; s.done = false;
}

/** A clip without `loop` reached its end. */
export const ClipEnded = event<{ e: Entity; clip: string }>('ClipEnded');

function animate(w: World, dt: number) {
  const all = sheets(w);
  w.each(Sprite, (e, s) => {
    const sh = all[s.sheet]; if (!sh) return;
    const c = sh.clips[s.clip] || sh.clips[Object.keys(sh.clips)[0]];
    if (!c) return;
    s.t += dt * s.speed;
    let i = Math.floor(s.t * c.fps);
    if (i >= c.frames.length) {
      if (c.loop) i %= c.frames.length;
      else {
        i = c.frames.length - 1;
        if (!s.done) { s.done = true; w.emit(ClipEnded, { e, clip: s.clip }); if (c.next) play(s, c.next, true); }
      }
    }
    s.frame = c.frames[i] || 0;
  });
}

export const Anim = definePlugin('anim', (w) => { sheets(w); w.system('update', animate, 'anim.animate'); });

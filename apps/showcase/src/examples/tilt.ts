// Tilt: a marble that rolls with real gravity. Flat on a table it stays put, tip the iPad and it rolls downhill,
// hold it upright and it drops to the bottom. Shake to change colour.
// Core: the 'devicemotion' event's accelerationIncludingGravity, which is the direction of gravity in the iPad's
// own axes. Its x/y part is how much gravity pulls along the screen, so it works at any angle (no calibration).
// (p5's rotationX/Y are angles, which go wrong near upright; p5's accelerationX/Y leave gravity out.)
// iOS 8 sends motion only 20 times a second, so it's smoothed.
import { type Example } from '../runner';
import { PALETTE, BG, MUTED, labelImage, tint } from '../art';

const R = 36;                 // ball radius, px
const PX_PER_MS2 = 1500;      // px/s² per m/s² of gravity along the screen: like a marble in a tray about 50 cm wide
const ROLL = 5 / 7;           // a rolling solid ball accelerates at 5/7 of a sliding one
const FRICTION = 0.35;        // rolling resistance: fraction of speed lost per second
const BOUNCE = 0.45;          // speed kept when hitting a wall
const ball = { x: 0, y: 0, vx: 0, vy: 0, spin: 0 };
const g = { x: 0, y: 0, has: false };     // smoothed gravity along the screen, m/s² (x right, y down)
let color = 0, onMotion: ((e: DeviceMotionEvent) => void) | null = null;

/** Gravity in screen directions (right, down), whichever way up the iPad is. iOS: device y points to the top edge. */
function toScreen(x: number, y: number): [number, number] {
  const o = (window as unknown as { orientation?: number }).orientation || 0;
  if (o === 90) return [-y, -x];   // landscape, home button on the right
  if (o === -90) return [y, x];    // landscape, home button on the left
  if (o === 180) return [-x, y];   // upside down
  return [x, -y];                  // portrait
}

export const tiltExample: Example = {
  id: 'tilt', title: 'Tilt', about: 'A marble rolling with real gravity: flat it stays, tip the iPad and it rolls. Shake to recolour.',
  setup(p) {
    ball.x = p.width / 2; ball.y = p.height / 2; ball.vx = ball.vy = 0; g.has = false;
    onMotion = (e) => {
      const a = e.accelerationIncludingGravity; if (!a || a.x === null || a.y === null) return;
      const [sx, sy] = toScreen(a.x!, a.y!);
      if (!g.has) { g.x = sx; g.y = sy; g.has = true; }
      g.x += (sx - g.x) * 0.5; g.y += (sy - g.y) * 0.5; // smooth out sensor jitter
    };
    window.addEventListener('devicemotion', onMotion, false);
  },
  draw(p, top) {
    const dt = Math.min(0.04, p.deltaTime / 1000);
    // gravity along the screen pushes the ball; friction slows it
    ball.vx += g.x * PX_PER_MS2 * ROLL * dt; ball.vy += g.y * PX_PER_MS2 * ROLL * dt;
    const keep = Math.exp(-FRICTION * dt); ball.vx *= keep; ball.vy *= keep;
    ball.x += ball.vx * dt; ball.y += ball.vy * dt;
    // walls: push back inside, bounce, and let tiny bounces die so it can rest against a wall
    const minY = top + R;
    if (ball.x < R) { ball.x = R; ball.vx = Math.abs(ball.vx) * BOUNCE < 30 ? 0 : -ball.vx * BOUNCE; }
    if (ball.x > p.width - R) { ball.x = p.width - R; ball.vx = Math.abs(ball.vx) * BOUNCE < 30 ? 0 : -ball.vx * BOUNCE; }
    if (ball.y < minY) { ball.y = minY; ball.vy = Math.abs(ball.vy) * BOUNCE < 30 ? 0 : -ball.vy * BOUNCE; }
    if (ball.y > p.height - R) { ball.y = p.height - R; ball.vy = Math.abs(ball.vy) * BOUNCE < 30 ? 0 : -ball.vy * BOUNCE; }
    const speed = Math.hypot(ball.vx, ball.vy); ball.spin += (speed * dt) / R;

    p.background(BG);
    // spirit level: the bubble floats to the high side
    const cx = p.width / 2, cy = p.height / 2, slope = Math.min(1, Math.hypot(g.x, g.y) / 9.81);
    p.noFill(); p.stroke(224); p.strokeWeight(2); p.ellipse(cx, cy, 240, 240); p.ellipse(cx, cy, 60, 60);
    p.noStroke(); p.fill(76, 175, 80, 150); p.ellipse(cx - (g.x / 9.81) * 100, cy - (g.y / 9.81) * 100, 50, 50);
    // the marble, with a spot that turns as it rolls (along the direction it's moving)
    p.fill(PALETTE[color]); p.ellipse(ball.x, ball.y, R * 2, R * 2);
    if (speed > 1) {
      const ux = ball.vx / speed, uy = ball.vy / speed, d = Math.sin(ball.spin) * R * 0.6;
      p.fill(tint(PALETTE[color], 0.6)); p.ellipse(ball.x + ux * d, ball.y + uy * d, R * 0.5 * (0.6 + 0.4 * Math.abs(Math.cos(ball.spin))), R * 0.5);
    }
    p.fill(MUTED); p.textSize(16); p.textAlign(p.CENTER);
    p.text(g.has ? `slope ${Math.round((Math.asin(slope) * 180) / Math.PI)}°` : 'no motion sensor here (try it on the iPad)', cx, cy + 150);
    const l = labelImage(p, 'Tip the iPad · shake to recolour', 18, MUTED);
    p.image(l, (p.width - l.width) / 2, p.height - 50);
  },
  deviceShaken() { color = (color + 1) % PALETTE.length; },
  exit() { if (onMotion) window.removeEventListener('devicemotion', onMotion, false); onMotion = null; },
};

// 3D game: a basic version of the timstaana.com lobby game on the iPad. The paper-doll player from the website
// walks around a pink plane in 3D: a stick on the left half of the screen (tank controls: turn and walk), tap the
// right half to jump, and the follow camera from the site. All the numbers are the website's (shared/game.ts,
// client/input.ts, client/main.ts), so it moves the same.
// iPad mini notes: p5's own texture and light shaders need more uniforms than the A5's GPU has, so one tiny shader
// (TEX below) draws everything, picking the sprite frame out of the sheet on the GPU. The whole scene is 4 draws.
// The 3D canvas is a second p5 instance (WEBGL) behind the main one, which draws the stick, hints and Menu button.
import { changed, type Example } from '../runner';

// ---------- the website's numbers ----------
const TANK = { speed: 7, turnSpeed: 2.6 };                  // units/s, radians/s
const GRAVITY = -48, JUMP = 12, HALF = 20;                   // the map is -20..20 on x and z
const CAM = { distance: 7.2, height: 4.0, lookHeight: 0.5, drop: 0.24, smooth: 0.18, fov: 60 };
const STICK = { radius: 70, deadX: 0.12, deadY: 0.48 };
const PPU = 106, FRAME = [210, 295], PAD = 20;               // sheet pixels per world unit; frame size; clear margin under the feet
const W = FRAME[0] / PPU, H = FRAME[1] / PPU, FEET = PAD / PPU;
const COLORS = { sky: '#ffffff', ground: '#ffe8ef', grid: '#ffc9d9', accent: '#ff5c8a' };

const TEX_VERT = `precision mediump float;
attribute vec3 aPosition; attribute vec2 aTexCoord;
uniform mat4 uModelViewMatrix; uniform mat4 uProjectionMatrix; uniform vec4 uFrame; varying vec2 vUV;
void main() { vUV = uFrame.xy + aTexCoord * uFrame.zw; gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aPosition, 1.0); }`;
const TEX_FRAG = `precision mediump float;
uniform sampler2D uSampler; uniform float uCut; varying vec2 vUV;
void main() { vec4 c = texture2D(uSampler, vUV); if (c.a < uCut) discard; gl_FragColor = vec4(c.rgb * c.a, c.a); }`;

// ---------- shared between the two canvases ----------
const me = { x: 0, z: 0, yaw: 0, back: false, y: 0, vy: 0, rotY: 0, moving: false, t: 0 };
const cam = { x: 0, y: CAM.height, z: CAM.distance, lx: 0, ly: CAM.lookHeight, lz: 0 };
let stick: { id: number; x0: number; y0: number; turn: number; throttle: number; kx: number; ky: number } | null = null;
let jumpAsked = false, moved = false, jumped = false;
let gl: p5 | null = null, holder: HTMLDivElement | null = null, hintMove: p5.Image, hintJump: p5.Image;

/** A thumb offset in pixels to turn/throttle, with the site's dead zones (client/input.ts stickValue). */
function stickValue(dx: number, dy: number) {
  const d = Math.hypot(dx, dy), k = d > STICK.radius ? STICK.radius / d : 1;
  let nx = (dx * k) / STICK.radius, ny = (dy * k) / STICK.radius;
  if (Math.abs(nx) < STICK.deadX) nx = 0;
  if (Math.abs(ny) < STICK.deadY) ny = 0;
  return { turn: nx, throttle: ny === 0 ? 0 : -ny, kx: dx * k, ky: dy * k };
}
const forward = (yaw: number) => ({ x: Math.sin(yaw), z: -Math.cos(yaw) });
const clampW = (v: number) => Math.max(-HALF, Math.min(HALF, v));

/** One frame of the game: tank controls, the jump, the walk cycle, the follow camera (client/main.ts). */
function step(dt: number) {
  const turn = stick ? stick.turn : 0, throttle = stick ? stick.throttle : 0;
  me.yaw += turn * TANK.turnSpeed * dt;
  const f = forward(me.yaw);
  me.x = clampW(me.x + f.x * TANK.speed * throttle * dt); me.z = clampW(me.z + f.z * TANK.speed * throttle * dt);
  if (throttle > 0.01) me.back = false; else if (throttle < -0.01) me.back = true; // walking backwards turns you to face the camera
  me.rotY = me.back ? me.yaw + Math.PI : me.yaw;
  me.moving = Math.abs(throttle) > 0.01;
  if (jumpAsked && me.y <= 0) me.vy = JUMP;
  jumpAsked = false;
  me.vy += GRAVITY * dt; me.y += me.vy * dt;
  if (me.y <= 0) { me.y = 0; me.vy = 0; }
  me.t += dt;
  // the camera sits behind you and turns with you; same feel at any frame rate
  const k = 1 - Math.pow(1 - CAM.smooth, dt * 60);
  cam.x += (me.x - f.x * CAM.distance - cam.x) * k; cam.y += (CAM.height - cam.y) * k; cam.z += (me.z - f.z * CAM.distance - cam.z) * k;
  cam.lx += (me.x - cam.lx) * k; cam.ly += (CAM.lookHeight - cam.ly) * k; cam.lz += (me.z - cam.lz) * k;
}

function sketch(q: p5) {
  let tex: p5.Shader, sheet: p5.Image, grid: p5.Image, shadow: p5.Image, ground: p5.Image;
  /** A small picture drawn with the 2D canvas API, as a WebGL texture (an image, so it's uploaded once). */
  const picture = (w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) => {
    const g = q.createGraphics(w, h); g.pixelDensity(1); draw(g.drawingContext as CanvasRenderingContext2D); return g.get();
  };
  q.preload = () => { sheet = q.loadImage('game/player.png'); };
  q.setup = () => {
    q.createCanvas(q.windowWidth, q.windowHeight, q.WEBGL); q.pixelDensity(1); q.noStroke();
    tex = q.createShader(TEX_VERT, TEX_FRAG);
    ground = picture(4, 4, (c) => { c.fillStyle = COLORS.ground; c.fillRect(0, 0, 4, 4); });
    grid = picture(512, 512, (c) => { // the walkable map: 8 squares a side (the site's GridHelper)
      c.fillStyle = COLORS.ground; c.fillRect(0, 0, 512, 512); c.fillStyle = COLORS.grid;
      for (let i = 0; i <= 8; i++) { const v = Math.min(509, Math.round((i * 512) / 8)); c.fillRect(v, 0, 3, 512); c.fillRect(0, v, 512, 3); }
    });
    shadow = picture(64, 64, (c) => { c.fillStyle = 'rgba(0,0,0,0.13)'; c.beginPath(); c.arc(32, 32, 30, 0, Math.PI * 2); c.fill(); });
  };
  q.draw = () => {
    step(Math.min(0.05, q.deltaTime / 1000));
    q.background(COLORS.sky);
    // the site's camera, with the frame shifted so you're drawn `drop` below the middle (more world ahead of you)
    const near = 0.3, t = near * Math.tan((CAM.fov * Math.PI) / 360), a = q.width / q.height;
    q.frustum(-t * a, t * a, -t * (1 - 2 * CAM.drop), t * (1 + 2 * CAM.drop), near, 400);
    q.camera(cam.x, -cam.y, cam.z, cam.lx, -cam.ly, cam.lz, 0, 1, 0); // p5's y points down: heights are negative y
    q.shader(tex);
    const draw = (img: p5.Image, frame: number[], cut: number) => { tex.setUniform('uSampler', img); tex.setUniform('uFrame', frame); tex.setUniform('uCut', cut); };
    // The floor (ground to the horizon, the map's grid, your shadow) is drawn in order with depth testing off: layers
    // this close together flicker on the iPad's depth buffer. Then depth back on for you.
    const ctx = q.drawingContext as WebGLRenderingContext;
    ctx.disable(ctx.DEPTH_TEST);
    q.resetMatrix(); q.rotateX(Math.PI / 2); draw(ground, [0, 0, 1, 1], 0); q.plane(HALF * 12, HALF * 12);
    q.resetMatrix(); q.rotateX(Math.PI / 2); draw(grid, [0, 0, 1, 1], 0); q.plane(HALF * 2, HALF * 2);
    const s = W * 0.8 * Math.max(0.3, 1 - me.y * 0.12); // smaller the higher you are
    q.resetMatrix(); q.translate(me.x, 0, me.z); q.rotateX(Math.PI / 2); draw(shadow, [0, 0, 1, 1], 0.01); q.plane(s, s);
    ctx.enable(ctx.DEPTH_TEST);
    // the paper doll: turned to its heading; its front if that faces the camera, else its back (mirrored, as the plane's seen from behind)
    const f = forward(me.rotY), front = f.x * (cam.x - me.x) + f.z * (cam.z - me.z) > 0;
    const col = me.moving || me.y > 0.05 ? 1 + (Math.floor(me.t * 6) % 2) : 0, row = front ? 0 : 1;
    q.resetMatrix(); q.translate(me.x, -(me.y + H / 2 - FEET), me.z); q.rotateY(Math.PI - me.rotY); // as the site: rotation.y = PI - heading
    draw(sheet, front ? [col / 3, row / 2, 1 / 3, 1 / 2] : [(col + 1) / 3, row / 2, -1 / 3, 1 / 2], 0.5); q.plane(W, H);
  };
}

export const game3d: Example = {
  id: 'game3d', title: '3D game', about: 'The website game on the iPad: the player in a 3D world, stick on the left, tap the right to jump.',
  preload(p) { hintMove = p.loadImage('game/hint-move.png'); hintJump = p.loadImage('game/hint-jump.png'); },
  setup() {
    Object.assign(me, { x: 0, z: 0, yaw: 0, back: false, y: 0, vy: 0, rotY: 0, moving: false, t: 0 });
    Object.assign(cam, { x: 0, y: CAM.height, z: CAM.distance, lx: 0, ly: CAM.lookHeight, lz: 0 });
    stick = null; jumpAsked = false; moved = false; jumped = false;
    holder = document.createElement('div');
    holder.style.cssText = 'position:absolute;left:0;top:0;z-index:0'; // behind the 2D canvas (the stick, hints, Menu)
    (document.getElementById('stage') || document.body).appendChild(holder);
    gl = new p5(sketch, holder);
    if (typeof __DEV__ !== 'undefined' && __DEV__) (window as unknown as Record<string, unknown>).__game = { me, cam, setStick: (turn: number, throttle: number) => { stick = turn || throttle ? { id: -9, x0: 0, y0: 0, turn, throttle, kx: 0, ky: 0 } : null; }, jump: () => { jumpAsked = true; } };
  },
  draw(p) {
    p.clear(); // see-through: the 3D canvas is underneath
    if (!moved) p.image(hintMove, 20, p.height - 20 - 150, 150, 150);
    if (!jumped) p.image(hintJump, p.width - 20 - 110, p.height - 110 - 110, 110, 110);
    if (stick && stick.id >= 0) { // the stick, where your thumb went down (the site's .cl-joy)
      p.noStroke(); p.fill(255, 255, 255, 153); p.ellipse(stick.x0, stick.y0, 100, 100);
      p.fill(COLORS.accent); p.ellipse(stick.x0 + (stick.kx * 30) / STICK.radius, stick.y0 + (stick.ky * 30) / STICK.radius, 40, 40);
    }
  },
  touchStarted(p, e) {
    for (const t of changed(e)) {
      if (t.x > p.width * 0.55) { jumpAsked = true; jumped = true; } // right side: jump
      else if (!stick) stick = { id: t.id, x0: t.x, y0: t.y, turn: 0, throttle: 0, kx: 0, ky: 0 }; // left side: a stick appears under your thumb
    }
  },
  touchMoved(p, e) {
    for (const t of changed(e)) if (stick && t.id === stick.id) { Object.assign(stick, stickValue(t.x - stick.x0, t.y - stick.y0)); if (stick.turn || stick.throttle) moved = true; }
  },
  touchEnded(p, e) { for (const t of changed(e)) if (stick && t.id === stick.id) stick = null; },
  exit() {
    try { if (gl) gl.remove(); } catch (e) { console.error(e); }
    if (holder && holder.parentNode) holder.parentNode.removeChild(holder);
    gl = null; holder = null; stick = null;
  },
};

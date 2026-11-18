// 3D: p5's WEBGL mode at a 30 fps target. A static "city" built once into one model, plus a few shapes that move
// on their own. Drag to turn the scene.
// What it takes on the iPad mini (measured):
//  - p5's own lights don't work: their shader needs more uniforms than the A5's GPU has ("too many uniforms").
//    A tiny shader of our own does simple sun + ambient lighting (LIT below).
//  - every separately drawn object costs ~2 ms of p5's JavaScript, so keep moving things to ~12;
//    merge everything that doesn't move on its own with buildGeometry() and draw it as one model().
//  - push()/pop() costs ~2 ms in WEBGL: use resetMatrix() and set each object's transform instead.
// A WEBGL canvas is its own p5 instance, so this example runs one behind the main (2D) canvas.
import { fingers, type Example } from '../runner';
import { MUTED, labelImage } from '../art';

const LIT_VERT = `precision mediump float;
attribute vec3 aPosition; attribute vec3 aNormal;
uniform mat4 uModelViewMatrix; uniform mat4 uProjectionMatrix; uniform mat3 uNormalMatrix;
uniform vec3 uColor; uniform vec3 uLight; varying vec3 vColor;
void main() {
  float sun = max(dot(normalize(uNormalMatrix * aNormal), -uLight), 0.0);
  vColor = uColor * (0.4 + 0.6 * sun);
  gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aPosition, 1.0);
}`;
const LIT_FRAG = `precision mediump float; varying vec3 vColor; void main() { gl_FragColor = vec4(vColor, 1.0); }`;
const COLORS: [number, number, number][] = [[0.13, 0.59, 0.95], [0.96, 0.26, 0.21], [0.30, 0.69, 0.31], [1, 0.76, 0.03], [0.61, 0.15, 0.69], [1, 0.6, 0]];

let gl: p5 | null = null, holder: HTMLDivElement | null = null, turn = 0.6, tilt = -0.5, lastX: number | null = null, lastY = 0;

function sketch(q: p5) {
  let lit: p5.Shader, city: p5.Geometry;
  q.setup = () => {
    q.createCanvas(q.windowWidth, q.windowHeight, q.WEBGL); q.pixelDensity(1); q.noStroke();
    lit = q.createShader(LIT_VERT, LIT_FRAG);
    city = (q as unknown as { buildGeometry(f: () => void): p5.Geometry }).buildGeometry(() => { // built once: 144 boxes, one model (p5 1.8+; not in @types/p5 yet)
      for (let x = -6; x < 6; x++) for (let z = -6; z < 6; z++) {
        const h = 20 + Math.abs(Math.sin(x * 1.7) * Math.cos(z * 1.3)) * 140;
        q.push(); q.translate(x * 50 + 25, -h / 2, z * 50 + 25); q.box(36, h, 36); q.pop();
      }
    });
  };
  q.draw = () => {
    const t = q.millis() / 1000;
    q.background(250);
    q.shader(lit); lit.setUniform('uLight', [0.4, 0.8, -0.45]);
    const place = () => { q.resetMatrix(); q.translate(0, 120, -700); q.rotateX(tilt); q.rotateY(turn); };
    place(); lit.setUniform('uColor', [0.8, 0.8, 0.82]); q.model(city);
    for (let i = 0; i < 6; i++) { // things that move on their own: one draw each
      const a = t * 0.6 + (i * Math.PI) / 3;
      place(); q.translate(Math.cos(a) * 260, -230 - Math.sin(t * 2 + i) * 30, Math.sin(a) * 260); q.rotateX(t + i); q.rotateY(t * 1.3);
      lit.setUniform('uColor', COLORS[i]);
      if (i % 3 === 0) q.sphere(34, 16, 12); else if (i % 3 === 1) q.torus(30, 11, 16, 8); else q.box(50);
    }
  };
}

export const threeD: Example = {
  id: '3d', title: '3D', about: "p5's WEBGL mode at 30 fps: a city built once into one model, shapes that move, our own lighting.",
  setup(p) {
    holder = document.createElement('div');
    holder.style.cssText = 'position:absolute;left:0;top:0;z-index:0'; // behind the 2D canvas, which draws the Menu button and fps graph
    (document.getElementById('stage') || document.body).appendChild(holder);
    gl = new p5(sketch, holder);
    if (typeof __DEV__ !== 'undefined' && __DEV__) (window as unknown as { __gl: p5 }).__gl = gl; // for npm run ipad:eval
    lastX = null; void p;
  },
  draw(p) {
    p.clear(); // the 2D canvas stays see-through over the 3D one
    const t = fingers(p)[0];
    if (t) { if (lastX !== null) { turn += (t.x - lastX) * 0.01; tilt = Math.max(-1.2, Math.min(0.2, tilt - (t.y - lastY) * 0.01)); } lastX = t.x; lastY = t.y; } else lastX = null;
    const l = labelImage(p, 'Drag to turn the city', 18, MUTED);
    p.image(l, (p.width - l.width) / 2, p.height - 50);
  },
  exit() {
    try { if (gl) gl.remove(); } catch (e) { console.error(e); }
    if (holder && holder.parentNode) holder.parentNode.removeChild(holder);
    gl = null; holder = null;
  },
};

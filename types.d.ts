// Globals: p5 is loaded by a <script> tag (vendor/p5.js) and used in instance mode; the build defines __DEV__.
import type P5 from 'p5';
declare global {
  const p5: typeof P5;
  type p5 = P5;
  namespace p5 { type Graphics = import('p5').Graphics; type Image = import('p5').Image; type Color = import('p5').Color; type Element = import('p5').Element; type MediaElement = import('p5').MediaElement; type Shader = import('p5').Shader; type Geometry = import('p5').Geometry }
  const __DEV__: boolean;
}
export {};

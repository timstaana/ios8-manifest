// iPad Showcase: what p5.js can do on the iPad mini 1 (iOS 8), one small example per core feature.
// Every example in src/examples/ is plain p5 instance-mode code you can copy into a sketch.
import { lockPage, autoUpdate, unlockAudio, homeScreenHint } from '@ios8/engine';
import { runExamples } from './runner';
import { paint } from './examples/paint';
import { multiTouch } from './examples/multi-touch';
import { pinch } from './examples/pinch';
import { tiltExample } from './examples/tilt';
import { synth } from './examples/synth';
import { drums } from './examples/drums';
import { videoExample } from './examples/video';
import { sprites } from './examples/sprites';
import { keyboard } from './examples/keyboard';
import { fonts } from './examples/fonts';
import { pixels } from './examples/pixels';
import { generative } from './examples/generative';
import { speed } from './examples/speed';
import { threeD } from './examples/three-d';
import { game3d } from './examples/game3d';

lockPage();      // no bouncing, zooming or copy menus
unlockAudio();   // sound starts working from the first tap
autoUpdate();    // offline copy updates itself
homeScreenHint();

runExamples(
  [paint, multiTouch, pinch, tiltExample, synth, drums, videoExample, sprites, keyboard, fonts, pixels, generative, threeD, game3d, speed],
  { title: 'iPad mini · p5.js', subtitle: 'What this setup can do on iOS 8. Tap one to try it.' },
);

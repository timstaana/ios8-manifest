// Video: an .mp4 playing inline and drawn into the sketch, mirrored four ways like a kaleidoscope.
// Drag to move the centre. Core p5: createVideo(), image(video, ...), scale(-1, 1) to mirror.
// iOS 8 notes: a video can only start inside a touch event. Opening this example is a tap (the menu opens it from
// touchEnded), so setup() can call play() and it just starts; after that, play/pause from code works.
// H.264 .mp4 only; the server needs byte ranges (the dev server and GitHub Pages have them).
// vendor/p5-ios8.js draws straight from the <video> element, which keeps it fast.
import { fingers, type Example } from '../runner';
import { BG, MUTED, labelImage } from '../art';

let video: p5.MediaElement | null = null, playing = false, cx = 0, cy = 0;

export const videoExample: Example = {
  id: 'video', title: 'Video', about: 'An .mp4 playing inline, drawn into the sketch and mirrored like a kaleidoscope.',
  setup(p) {
    video = p.createVideo('media/life.mp4');
    video.elt.setAttribute('webkit-playsinline', ''); video.elt.muted = true; video.elt.loop = true;
    video.size(320, 240); // stays in the page behind the canvas (hidden <video> doesn't play on iOS 8)
    cx = p.width / 2; cy = p.height / 2;
    video.elt.play(); playing = !video.elt.paused; // works when opened by a tap; otherwise wait for one
  },
  draw(p) {
    p.background(BG);
    const t = fingers(p)[0]; if (t && playing) { cx = t.x; cy = t.y; }
    if (video && playing) {
      const w = Math.max(cx, p.width - cx), h = Math.max(cy, p.height - cy);
      for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
        p.push(); p.translate(cx, cy); p.scale(sx, sy); p.image(video, 0, 0, w, h); p.pop();
      }
    }
    const l = labelImage(p, playing ? 'Drag to move the centre' : 'Tap to play the video', 20, playing ? '#fff' : MUTED, { bg: playing ? 'rgba(0,0,0,0.5)' : undefined });
    p.image(l, (p.width - l.width) / 2, p.height - 60);
  },
  touchStarted() { if (video && !playing) { video.elt.play(); playing = true; } }, // iOS: play() only from a touch
  exit() { if (video) video.elt.pause(); video = null; },
};

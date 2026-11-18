// Drum pads: six sound files, played the moment a finger lands. Hit several at once.
// Core: loadSound() (Web Audio: the file is decoded once, then every hit is instant and can overlap).
// p5.sound's own file playback doesn't work on iOS 8; this does. Sounds: public/sounds/*.wav.
import { loadSound, type Sound } from '@ios8/engine';
import { changed, type Example } from '../runner';
import { PALETTE, BG, MUTED, labelImage, tint } from '../art';

const NAMES = ['kick', 'snare', 'hat', 'clap', 'tom', 'blip'];
let sounds: Sound[] = [];
const flash = NAMES.map(() => 0);
let pads: { x: number; y: number; w: number; h: number }[] = [];

export const drums: Example = {
  id: 'drums', title: 'Drum pads', about: 'Six sound files that play the instant a finger lands. Hit several at once.',
  setup(p, top) {
    if (!sounds.length) sounds = NAMES.map((n) => loadSound('sounds/' + n + '.wav'));
    const cols = p.width > p.height ? 3 : 2, rows = NAMES.length / cols, m = 24, gap = 16, y0 = top + 70;
    const w = (p.width - m * 2 - gap * (cols - 1)) / cols, h = (p.height - y0 - 80 - gap * (rows - 1)) / rows;
    pads = NAMES.map((_, i) => ({ x: m + (i % cols) * (w + gap), y: y0 + Math.floor(i / cols) * (h + gap), w, h }));
  },
  draw(p) {
    p.background(BG); p.noStroke();
    pads.forEach((r, i) => {
      flash[i] = Math.max(0, flash[i] - p.deltaTime / 250);
      p.fill(tint(PALETTE[i], 0.6 * flash[i])); p.rect(r.x, r.y, r.w, r.h, 16);
      p.image(labelImage(p, NAMES[i], 26, '#fff', { bold: true }), r.x + 20, r.y + 16);
    });
    const ready = sounds.filter((s) => s.ready).length;
    const l = labelImage(p, ready < NAMES.length ? 'Loading sounds…' : 'Tap the pads · several at once', 18, MUTED);
    p.image(l, (p.width - l.width) / 2, p.height - 50);
  },
  touchStarted(p, e) {
    for (const t of changed(e)) pads.forEach((r, i) => {
      if (t.x >= r.x && t.x < r.x + r.w && t.y >= r.y && t.y < r.y + r.h) { sounds[i].play({ volume: 0.9 }); flash[i] = 1; }
    });
  },
};

// Synth: every finger is a voice. Left to right is pitch (snapped to a pentatonic scale, so it always sounds
// nice), top to bottom is loudness. Slide to glide between notes.
// Core: Web Audio straight from the touch handlers: one oscillator + gain per finger, started on touchStarted,
// moved on touchMoved, faded out on touchEnded. (audio() is the shared, already-unlocked context.)
import { audio, pentatonic } from '@ios8/engine';
import { changed, fingers, type Example } from '../runner';
import { PALETTE, BG, MUTED, labelImage, tint } from '../art';

const NOTES = 15, BASE = 130.81; // C3, three octaves
const voices: Record<number, { osc: OscillatorNode; gain: GainNode; note: number }> = {};
let lanes: p5.Image; // the background, drawn once (15 coloured rects every frame was too slow)

const noteAt = (p: p5, x: number) => Math.max(0, Math.min(NOTES - 1, Math.floor((x / p.width) * NOTES)));
const volumeAt = (p: p5, y: number) => 0.05 + 0.3 * (1 - y / p.height);

function stopAll() {
  const c = audio(); if (!c) return;
  for (const id in voices) { const v = voices[id]; v.gain.gain.setTargetAtTime(0, c.currentTime, 0.05); v.osc.stop(c.currentTime + 0.3); delete voices[id]; }
}

export const synth: Example = {
  id: 'synth', title: 'Synth', about: 'Every finger is a voice: pitch across, volume down. Live Web Audio oscillators.',
  setup(p) {
    const g = p.createGraphics(p.width, p.height), lane = p.width / NOTES; g.pixelDensity(1); g.noStroke(); g.background(BG);
    for (let i = 0; i < NOTES; i++) { g.fill(i % 5 === 0 ? tint(PALETTE[0], 0.75) : i % 2 ? '#eeeeee' : '#f5f5f5'); g.rect(i * lane, 0, lane, p.height); }
    lanes = g.get();
  },
  draw(p) {
    p.image(lanes, 0, 0); p.noStroke();
    const lane = p.width / NOTES;
    fingers(p).forEach((t, i) => {
      const n = noteAt(p, t.x); p.fill(tint(PALETTE[(i + 1) % PALETTE.length], 0.5)); p.rect(n * lane, 0, lane, p.height);
      p.fill(PALETTE[(i + 1) % PALETTE.length]); p.ellipse(t.x, t.y, 90, 90);
    });
    const l = labelImage(p, 'Pitch across · volume down · slide to glide', 18, MUTED);
    p.image(l, (p.width - l.width) / 2, p.height - 50);
  },
  touchStarted(p, e) {
    const c = audio(); if (!c) return;
    for (const t of changed(e)) {
      const osc = c.createOscillator(), gain = c.createGain(), note = noteAt(p, t.x);
      osc.type = 'triangle'; osc.frequency.value = pentatonic(note, BASE);
      gain.gain.value = 0; gain.gain.setTargetAtTime(volumeAt(p, t.y), c.currentTime, 0.01);
      osc.connect(gain); gain.connect(c.destination); osc.start(0);
      voices[t.id] = { osc, gain, note };
    }
  },
  touchMoved(p, e) {
    const c = audio(); if (!c) return;
    for (const t of changed(e)) {
      const v = voices[t.id]; if (!v) continue;
      const note = noteAt(p, t.x);
      if (note !== v.note) { v.note = note; v.osc.frequency.setTargetAtTime(pentatonic(note, BASE), c.currentTime, 0.02); } // glide
      v.gain.gain.setTargetAtTime(volumeAt(p, t.y), c.currentTime, 0.03);
    }
  },
  touchEnded(p, e) {
    const c = audio(); if (!c) return;
    for (const t of changed(e)) {
      const v = voices[t.id]; if (!v) continue;
      v.gain.gain.setTargetAtTime(0, c.currentTime, 0.08); v.osc.stop(c.currentTime + 0.5); delete voices[t.id];
    }
  },
  exit: stopAll,
};

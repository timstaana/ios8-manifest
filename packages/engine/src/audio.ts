// Sound through Web Audio (works on iOS 8; p5.sound's file playback doesn't).
// Silent until the first tap: unlockAudio() handles that, and revives the context if iOS suspended it.

type Ctx = AudioContext;
const AC: { new (): Ctx } | undefined = (window as unknown as { AudioContext?: { new (): Ctx }; webkitAudioContext?: { new (): Ctx } }).AudioContext
  || (window as unknown as { webkitAudioContext?: { new (): Ctx } }).webkitAudioContext;
let ctx: Ctx | null = null;

export function audio(): Ctx | null { if (!ctx && AC) ctx = new AC(); return ctx; }

/** Call once at start-up. Every tap makes sure audio is running (iOS 8 suspends it after interruptions). */
export function unlockAudio() {
  // Create the context and run a silent oscillator now, at start-up: on the A5 the first use costs ~300 ms,
  // which would otherwise freeze the first note mid-interaction. (iOS keeps it silent until the first tap.)
  const warm = (c: Ctx) => { const s = c.createBufferSource(), g = c.createGain(); s.buffer = c.createBuffer(1, 64, 22050); g.gain.value = 0; s.connect(g); g.connect(c.destination); s.start(0); };
  const c0 = audio(); if (c0) warm(c0);
  const kick = () => {
    const c = audio(); if (!c) return;
    if (c.state === 'running') return;
    // iOS 8's webkitAudioContext has no .state: play a 1-sample silent buffer on every tap (cheap) to unlock/revive it
    const s = c.createBufferSource(); s.buffer = c.createBuffer(1, 1, 22050); s.connect(c.destination); s.start(0);
    if (c.state === 'suspended' && c.resume) c.resume();
  };
  document.addEventListener('touchend', kick, true);
  document.addEventListener('click', kick, true);
}

export interface Sound { readonly ready: boolean; play(o?: { volume?: number; rate?: number }): void }

/** Load a sound file (.m4a/.mp3/.wav). Plays once decoded; earlier play() calls are ignored. */
export function loadSound(url: string): Sound {
  const c = audio(); let buffer: AudioBuffer | null = null;
  const x = new XMLHttpRequest(); x.open('GET', url, true); x.responseType = 'arraybuffer';
  x.onload = () => { if (c) c.decodeAudioData(x.response as ArrayBuffer, (b) => { buffer = b; }, () => console.warn('could not decode ' + url)); };
  x.send();
  return {
    get ready() { return !!buffer; },
    play({ volume = 1, rate = 1 } = {}) {
      if (!buffer || !c || sound.muted) return;
      const s = c.createBufferSource(), g = c.createGain();
      s.buffer = buffer; s.playbackRate.value = rate; g.gain.value = volume;
      s.connect(g); g.connect(c.destination); s.start(0); // start(0) only: iOS 8 throws on undefined extra arguments
    },
  };
}

/** Global sound switch (e.g. a silent display mode). */
export const sound = { muted: false };

// Notes are rendered once into an AudioBuffer (wave + attack/decay envelope) and then played as samples: on the A5
// that's cheaper than live oscillators with gain automation, and chords of 5 notes don't stall a frame.
const noteCache: Record<string, AudioBuffer> = {};
function noteBuffer(c: Ctx, freq: number, seconds: number, type: OscillatorType): AudioBuffer {
  const key = type + Math.round(freq * 100) + ':' + seconds;
  const hit = noteCache[key]; if (hit) return hit;
  const rate = c.sampleRate, n = Math.max(1, Math.ceil(rate * seconds)), b = c.createBuffer(1, n, rate), d = b.getChannelData(0);
  const attack = Math.min(n - 1, Math.floor(rate * 0.012)), step = freq / rate;
  for (let i = 0, ph = 0; i < n; i++, ph += step) {
    const f = ph - Math.floor(ph);
    const v = type === 'square' ? (f < 0.5 ? 0.6 : -0.6) : type === 'sawtooth' ? (2 * f - 1) * 0.7 : type === 'triangle' ? 1 - 4 * Math.abs(f - 0.5) : Math.sin(2 * Math.PI * f);
    const env = i < attack ? i / attack : 1 - (i - attack) / (n - attack); // straight attack, linear decay to silence
    d[i] = v * env * env;
  }
  return (noteCache[key] = b);
}

/** A short synthesised note: tone(440, 0.2, 0.25, 'triangle'). */
export function tone(freq = 440, seconds = 0.2, volume = 0.25, type: OscillatorType = 'sine') {
  if (sound.muted) return;
  const c = audio(); if (!c) return;
  const s = c.createBufferSource(), g = c.createGain();
  s.buffer = noteBuffer(c, freq, seconds, type); g.gain.value = volume;
  s.connect(g); g.connect(c.destination); s.start(0);
}

/** Render notes ahead of time (e.g. an instrument's whole scale in setup) so the first play is instant. */
export function prepareTones(freqs: number[], seconds = 0.2, type: OscillatorType = 'sine') {
  const c = audio(); if (!c) return;
  for (let i = 0; i < freqs.length; i++) noteBuffer(c, freqs[i], seconds, type);
}

/** Pentatonic note n (0, 1, 2...) from a base pitch: always sounds nice together. */
export function pentatonic(n: number, base = 261.63) {
  const steps = [0, 2, 4, 7, 9], o = Math.floor(n / 5), i = ((n % 5) + 5) % 5;
  return base * Math.pow(2, o + steps[i] / 12);
}

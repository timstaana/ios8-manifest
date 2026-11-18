// Sound that works on iOS 8: plain Web Audio. (p5.sound's loadSound().play() errors on iOS 8, so it isn't used.)
// Audio stays silent until the first tap; unlockAudio() handles that.

const AC = window.AudioContext || window.webkitAudioContext;
let ctx = null;

export function audioContext() { if (!ctx && AC) ctx = new AC(); return ctx; }

/** Call once at start-up. The first tap anywhere unlocks audio (iOS needs a tap before any sound). */
export function unlockAudio() {
  const unlock = () => {
    const c = audioContext(); if (!c) return;
    const s = c.createBufferSource(); s.buffer = c.createBuffer(1, 1, 22050); s.connect(c.destination); s.start(0);
    if (c.resume) c.resume();
    document.removeEventListener('touchend', unlock, true); document.removeEventListener('click', unlock, true);
  };
  document.addEventListener('touchend', unlock, true); document.addEventListener('click', unlock, true);
}

/** Load a sound file (.m4a/AAC or .mp3 or .wav). Returns { play({ volume, rate }), get ready }.
 *  Plays as soon as it's decoded; calls before that are ignored. */
export function loadSound(url) {
  const c = audioContext();
  let buffer = null;
  const x = new XMLHttpRequest();
  x.open('GET', url, true); x.responseType = 'arraybuffer';
  x.onload = () => c && c.decodeAudioData(x.response, (b) => { buffer = b; }, () => console.warn('could not decode', url));
  x.send();
  return {
    get ready() { return !!buffer; },
    play({ volume = 1, rate = 1 } = {}) {
      if (!buffer) return;
      const s = c.createBufferSource(), g = c.createGain();
      s.buffer = buffer; s.playbackRate.value = rate; g.gain.value = volume;
      s.connect(g); g.connect(c.destination); s.start(0); // start(0) only: iOS 8 throws on undefined extra arguments
    },
  };
}

/** A short beep: tone(440, 0.3). */
export function tone(freq = 440, seconds = 0.25, volume = 0.3, type = 'sine') {
  const c = audioContext(); if (!c) return;
  const o = c.createOscillator(), g = c.createGain(), t = c.currentTime;
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(volume, t + 0.02); g.gain.linearRampToValueAtTime(0, t + seconds);
  o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + seconds + 0.05);
}

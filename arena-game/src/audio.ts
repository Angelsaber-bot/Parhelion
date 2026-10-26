// Tiny synthesized sound set (no audio assets yet).
let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  if (!ctx) {
    try { ctx = new AudioContext(); } catch { return null; }
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function noise(dur: number, freq: number, gain: number, q = 1) {
  const a = ac();
  if (!a) return;
  const len = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  f.Q.value = q;
  const g = a.createGain();
  g.gain.value = gain;
  src.connect(f).connect(g).connect(a.destination);
  src.start();
}

function tone(freq: number, dur: number, gain: number, type: OscillatorType = 'sine', slide = 1) {
  const a = ac();
  if (!a) return;
  const o = a.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, a.currentTime);
  o.frequency.exponentialRampToValueAtTime(freq * slide, a.currentTime + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(gain, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
  o.connect(g).connect(a.destination);
  o.start();
  o.stop(a.currentTime + dur);
}

export const sfx = {
  unlock: () => ac(),
  shot(weapon: number, near: boolean) {
    const v = near ? 1 : 0.35;
    if (weapon === 0) noise(0.08, 1800, 0.5 * v, 0.8);
    else if (weapon === 1) { noise(0.22, 700, 0.9 * v, 0.6); tone(90, 0.15, 0.3 * v, 'triangle', 0.5); }
    else { noise(0.16, 1200, 0.7 * v, 0.7); tone(220, 0.2, 0.2 * v, 'sawtooth', 0.4); }
  },
  hit(head: boolean) { tone(head ? 1650 : 1100, 0.07, 0.18, 'square'); },
  kill() { tone(880, 0.12, 0.2, 'triangle', 1.5); setTimeout(() => tone(1320, 0.18, 0.2, 'triangle', 1.2), 90); },
  hurt() { tone(160, 0.15, 0.25, 'sawtooth', 0.6); },
  dash() { noise(0.18, 3000, 0.25, 0.4); },
  shield() { tone(420, 0.35, 0.18, 'sine', 2); },
  shieldBreak() { noise(0.3, 2500, 0.4, 2); },
  reload() { tone(600, 0.05, 0.08, 'square'); setTimeout(() => tone(500, 0.05, 0.08, 'square'), 120); },
  empty() { tone(300, 0.04, 0.08, 'square'); },
};

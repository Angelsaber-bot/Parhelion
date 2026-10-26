// Synthesized sound set (no audio assets yet). Shots are layered the way mature shooters build
// them: a sharp transient, a filtered noise body, a low thump you feel, and a reverb tail; the
// shotgun adds a pump. Everything runs through one compressor so stacked shots stay punchy.
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let verb: ConvolverNode | null = null;

function ac(): AudioContext | null {
  if (!ctx) {
    try { ctx = new AudioContext(); } catch { return null; }
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 5; comp.attack.value = 0.002; comp.release.value = 0.15;
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(comp).connect(ctx.destination);
    // short open-air reverb: decaying stereo noise impulse
    verb = ctx.createConvolver();
    const len = Math.floor(ctx.sampleRate * 1.1);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
    }
    verb.buffer = ir;
    const wet = ctx.createGain();
    wet.gain.value = 0.22;
    verb.connect(wet).connect(master);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

interface Opt { delay?: number; send?: number; lowpass?: number }

function out(a: AudioContext, node: AudioNode, o: Opt) {
  let last = node;
  if (o.lowpass) {
    const lp = a.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = o.lowpass;
    last.connect(lp);
    last = lp;
  }
  last.connect(master!);
  if (o.send) {
    const s = a.createGain();
    s.gain.value = o.send;
    last.connect(s).connect(verb!);
  }
}

function noise(dur: number, freq: number, gain: number, q = 1, o: Opt = {}, type: BiquadFilterType = 'bandpass') {
  const a = ac();
  if (!a) return;
  const len = Math.max(1, Math.floor(a.sampleRate * dur));
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2.2;
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = a.createGain();
  g.gain.value = gain;
  src.connect(f).connect(g);
  out(a, g, o);
  src.start(a.currentTime + (o.delay ?? 0));
}

function tone(freq: number, dur: number, gain: number, type: OscillatorType = 'sine', slide = 1, o: Opt = {}) {
  const a = ac();
  if (!a) return;
  const t0 = a.currentTime + (o.delay ?? 0);
  const osc = a.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t0 + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  out(a, g, o);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export const sfx = {
  unlock: () => ac(),
  /** dist in metres; 0 = your own gun. */
  shot(weapon: number, near: boolean, dist = 0) {
    const v = dist <= 0 ? 1 : near ? Math.max(0.25, 1 - dist / 40) : 0.18;
    const o: Opt = { send: 0.5, lowpass: dist > 0 ? Math.max(1400, 12000 - dist * 260) : undefined };
    if (weapon === 0) { // Lumen AR: tight crack + punchy body
      noise(0.018, 4200, 0.55 * v, 0.7, o);
      noise(0.09, 1300, 0.6 * v, 0.9, o);
      tone(140, 0.07, 0.5 * v, 'sine', 0.4, o);
    } else if (weapon === 1) { // Corona SG: big boom, chest thump, then the pump
      noise(0.03, 3000, 0.6 * v, 0.6, o);
      noise(0.28, 800, 1.0 * v, 0.5, o, 'lowpass');
      tone(95, 0.22, 0.9 * v, 'sine', 0.35, o);
      tone(55, 0.3, 0.5 * v, 'triangle', 0.6, o);
      if (dist <= 0) {
        noise(0.04, 2200, 0.25, 3, { delay: 0.32 });
        noise(0.05, 1500, 0.3, 3, { delay: 0.43 });
      }
    } else { // Halo DMR: whip crack, metallic ring, heavy thump
      noise(0.03, 5200, 0.7 * v, 0.6, o);
      noise(0.16, 1600, 0.65 * v, 0.8, o);
      tone(540, 0.26, 0.16 * v, 'triangle', 0.5, o);
      tone(110, 0.16, 0.65 * v, 'sine', 0.4, o);
    }
  },
  impact(dist: number) { noise(0.05, 2400, Math.max(0.05, 0.22 - dist / 200), 2, { lowpass: 5000 }); },
  hit(head: boolean) {
    if (head) { tone(1900, 0.16, 0.22, 'sine'); tone(2850, 0.12, 0.1, 'sine'); noise(0.02, 6000, 0.2, 1); }
    else { tone(2300, 0.035, 0.16, 'square', 0.9); noise(0.015, 5000, 0.18, 1); }
  },
  kill(head = false) {
    tone(70, 0.25, 0.5, 'sine', 0.5);
    tone(880, 0.12, 0.2, 'triangle', 1.2, { send: 0.4 });
    tone(1320, 0.18, 0.2, 'triangle', 1.15, { delay: 0.08, send: 0.4 });
    if (head) tone(1980, 0.3, 0.16, 'sine', 1, { delay: 0.16, send: 0.6 });
  },
  hurt() { tone(160, 0.15, 0.25, 'sawtooth', 0.6); noise(0.06, 400, 0.3, 1); },
  dash() { noise(0.2, 3000, 0.25, 0.4, { send: 0.3 }); },
  shield() { tone(420, 0.35, 0.18, 'sine', 2, { send: 0.5 }); },
  shieldBreak() { noise(0.3, 2500, 0.4, 2, { send: 0.6 }); tone(900, 0.25, 0.12, 'triangle', 0.3); },
  reload() { noise(0.03, 1800, 0.2, 4); noise(0.04, 1200, 0.22, 4, { delay: 0.18 }); tone(600, 0.04, 0.06, 'square', 1, { delay: 0.3 }); },
  empty() { tone(300, 0.04, 0.08, 'square'); },
};

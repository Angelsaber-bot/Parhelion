/** Scope picture drawn over the real zoomed camera: a lens in a dark tube with edge vignette,
 * colour fringing, glare and a little dirt; a per-weapon reticle whose illuminated element takes
 * the finish's accent colour; and live readouts (range, zoom, breath). Presentation only. */
import { bilingual } from '../../../shared-client/i18n.ts';

export interface ScopeFrame {
  open: number; // 0..1 as the scope comes up
  kind: 'sniper' | 'dmr';
  accent: number;
  range: number | null; // metres to what the reticle is on
  zoom: number;
  stamina: number; // 0..1 breath left
  holding: boolean;
  gasp: boolean;
  kick: number; // 0..1 recoil, decays
  label: string;
}

const DIRT = Array.from({ length: 22 }, (_, i) => {
  const a = Math.sin(i * 12.9898) * 43758.5453, b = Math.sin(i * 78.233) * 12345.678;
  const fa = a - Math.floor(a), fb = b - Math.floor(b);
  return { a: fa * Math.PI * 2, r: Math.sqrt(fb) * .92, s: 1 + (i % 4), o: .04 + (i % 3) * .025 };
});
const hex = (c: number, alpha = 1) => `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${alpha})`;
/** Illuminated reticles must read on any finish: lift dark accents toward white. */
export function reticleColour(c: number) {
  const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255, l = (.2126 * r + .7152 * g + .0722 * b) / 255;
  if (l >= .45) return c;
  const k = (.45 - l) / (1 - l) + .15, mix = (v: number) => Math.round(v + (255 - v) * Math.min(1, k));
  return (mix(r) << 16) | (mix(g) << 8) | mix(b);
}

export class ScopeOverlay {
  private ctx: CanvasRenderingContext2D | null;
  private w = 0; private h = 0; private ratio = 1;
  constructor(readonly canvas: HTMLCanvasElement) { this.ctx = canvas.getContext?.('2d') ?? null; }
  private fit() {
    const ratio = Math.min(2, (globalThis.devicePixelRatio as number) || 1), w = this.canvas.clientWidth || innerWidth, h = this.canvas.clientHeight || innerHeight;
    if (w === this.w && h === this.h && ratio === this.ratio) return;
    this.w = w; this.h = h; this.ratio = ratio;
    this.canvas.width = Math.round(w * ratio); this.canvas.height = Math.round(h * ratio);
  }
  clear() { if (this.ctx) this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); }
  draw(f: ScopeFrame) {
    const g = this.ctx; if (!g) return;
    f = { ...f, accent: reticleColour(f.accent) };
    this.fit(); g.setTransform(this.ratio, 0, 0, this.ratio, 0, 0); g.clearRect(0, 0, this.w, this.h);
    const { w, h } = this, open = Math.max(0, Math.min(1, f.open));
    const R = Math.min(w, h) * .46 * (.82 + .18 * open), cx = w / 2, cy = h / 2 + f.kick * R * .07;
    // Tube: everything outside the lens is the inside of the scope, then the eyepiece shadow.
    g.save(); g.beginPath(); g.rect(0, 0, w, h); g.arc(cx, cy, R, 0, Math.PI * 2, true); g.fillStyle = '#020407'; g.fill('evenodd'); g.restore();
    const rim = g.createRadialGradient(cx, cy, R * .74, cx, cy, R);
    rim.addColorStop(0, 'rgba(0,0,0,0)'); rim.addColorStop(.75, 'rgba(0,0,0,.18)'); rim.addColorStop(1, 'rgba(0,0,0,.78)');
    g.fillStyle = rim; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();
    // Chromatic fringe at the rim and a soft glare arc.
    g.lineWidth = 2;
    for (const [dx, col] of [[1.6, 'rgba(255,70,60,.38)'], [-1.6, 'rgba(70,210,255,.34)']] as const) { g.strokeStyle = col; g.beginPath(); g.arc(cx + dx, cy, R - 1.5, 0, Math.PI * 2); g.stroke(); }
    g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = R * .05; g.beginPath(); g.arc(cx, cy, R * .86, Math.PI * 1.08, Math.PI * 1.42); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.035)'; g.lineWidth = R * .02; g.beginPath(); g.arc(cx, cy, R * .78, Math.PI * 1.12, Math.PI * 1.3); g.stroke();
    for (const d of DIRT) { g.fillStyle = `rgba(210,220,230,${d.o})`; g.beginPath(); g.arc(cx + Math.cos(d.a) * d.r * R, cy + Math.sin(d.a) * d.r * R, d.s, 0, Math.PI * 2); g.fill(); }
    // Reticle.
    g.save(); g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.clip();
    const glow = (c: number) => { g.shadowColor = hex(c, .9); g.shadowBlur = 8; };
    if (f.kind === 'sniper') {
      g.fillStyle = '#05080c';
      const post = 7, inner = R * .2;
      g.fillRect(cx - R, cy - post / 2, R - inner, post); g.fillRect(cx + inner, cy - post / 2, R - inner, post); g.fillRect(cx - post / 2, cy + inner, post, R - inner);
      g.fillRect(cx - post / 2, cy - R, post, R - inner);
      g.fillRect(cx - inner, cy - .75, inner * 2, 1.5); g.fillRect(cx - .75, cy - inner, 1.5, inner * 2);
      for (let i = 1; i <= 4; i++) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { g.beginPath(); g.arc(cx + dx * i * inner / 5, cy + dy * i * inner / 5, 2.2, 0, Math.PI * 2); g.fill(); }
      for (let i = 1; i <= 3; i++) { const y = cy + inner + i * R * .1; g.fillRect(cx - 14 + i * 2, y, 28 - i * 4, 1.5); g.font = '600 10px ui-monospace, monospace'; g.fillText(String(i * 2), cx + 18, y + 4); }
      g.fillStyle = '#05080c'; g.beginPath(); g.arc(cx, cy, 4.2, 0, Math.PI * 2); g.fill();
      glow(f.accent); g.fillStyle = hex(f.accent, 1); g.beginPath(); g.arc(cx, cy, 2.8, 0, Math.PI * 2); g.fill(); g.shadowBlur = 0;
    } else {
      g.strokeStyle = 'rgba(5,8,12,.75)'; g.lineWidth = 1.4; g.beginPath(); g.arc(cx, cy, R * .42, 0, Math.PI * 2); g.stroke();
      g.fillStyle = '#05080c'; g.fillRect(cx - .7, cy + 14, 1.4, R * .38);
      for (let i = 1; i <= 4; i++) { const y = cy + 12 + i * R * .07, half = 26 - i * 4; g.fillRect(cx - half, y, half * 2, 1.4); g.font = '600 10px ui-monospace, monospace'; g.fillText(String(i + 2), cx + half + 6, y + 4); }
      const chevron = () => { g.beginPath(); g.moveTo(cx - 14, cy + 14); g.lineTo(cx, cy); g.lineTo(cx + 14, cy + 14); g.stroke(); };
      g.lineJoin = 'round'; g.strokeStyle = '#05080c'; g.lineWidth = 5.5; chevron();
      glow(f.accent); g.strokeStyle = hex(f.accent, 1); g.lineWidth = 2.8; chevron(); g.shadowBlur = 0;
    }
    g.restore();
    // Readouts inside the bottom of the lens.
    g.font = '700 15px ui-monospace, SFMono-Regular, Menlo, monospace'; g.textBaseline = 'middle';
    const base = cy + R * .78;
    g.fillStyle = 'rgba(4,8,12,.62)';
    for (const x of [cx - R * .52, cx + R * .52 - 92]) { g.beginPath(); g.roundRect?.(x, base - 13, 92, 26, 8); g.fill(); }
    g.fillStyle = 'rgba(220,245,240,.95)'; g.textAlign = 'right';
    g.fillText(f.range === null ? '--- m' : `${Math.round(f.range)} m`, cx + R * .52 - 12, base);
    g.textAlign = 'left'; g.fillText(`${f.zoom.toFixed(1)}×`, cx - R * .52 + 12, base);
    g.textAlign = 'center'; g.font = '600 10px ui-monospace, monospace'; g.fillStyle = 'rgba(210,235,230,.55)'; g.fillText(f.label, cx, cy + R * .9);
    // Breath: a thin arc that drains while held, red while gasping.
    if (f.holding || f.gasp || f.stamina < .999) {
      g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.arc(cx, cy, R * .62, Math.PI * .62, Math.PI * .38, true); g.stroke();
      g.strokeStyle = f.gasp ? 'rgba(255,90,80,.85)' : hex(f.accent, .85);
      const span = Math.PI * 1.76 * Math.max(0, Math.min(1, f.stamina));
      g.beginPath(); g.arc(cx, cy, R * .62, Math.PI * .62, Math.PI * .62 - span, true); g.stroke();
      g.fillStyle = f.gasp ? 'rgba(255,120,110,.9)' : 'rgba(220,240,235,.8)'; g.font = '700 11px system-ui, sans-serif';
      g.fillText(f.gasp ? bilingual('换气', 'Out of breath') : f.holding ? bilingual('屏息', 'Holding breath') : '', cx, cy + R * .56);
    }
    // Scope-in: a dark tunnel that clears as the optic settles.
    if (open < 1) { g.fillStyle = `rgba(2,4,7,${(1 - open) * .85})`; g.beginPath(); g.arc(cx, cy, R + 2, 0, Math.PI * 2); g.fill(); }
  }
}

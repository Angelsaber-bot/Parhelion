/** Scope picture drawn over the real zoomed camera: a lens in a dark tube with edge vignette,
 * colour fringing, glare and a little dirt; a per-weapon reticle whose illuminated element takes
 * the finish's accent colour; and range/zoom readouts. Purely visual: it never moves the aim. */

export interface ScopeFrame {
  open: number; // 0..1 as the scope comes up
  kind: 'sniper' | 'dmr';
  accent: number;
  range: number | null; // metres to what the reticle is on
  zoom: number;
  label: string;
  /** Finish id: themed scopes (fire, lightning, frost...) for the ten sniper/DMR finishes. */
  theme?: string;
  time?: number;
}

const DIRT = Array.from({ length: 22 }, (_, i) => {
  const a = Math.sin(i * 12.9898) * 43758.5453, b = Math.sin(i * 78.233) * 12345.678;
  const fa = a - Math.floor(a), fb = b - Math.floor(b);
  return { a: fa * Math.PI * 2, r: Math.sqrt(fb) * .92, s: 1 + (i % 4), o: .04 + (i % 3) * .025 };
});
import { scopeTheme, type ScopeTheme } from './scopeThemes.ts';
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
  private layer: HTMLCanvasElement | null = null; private layerKey = ''; private layerAt = -1; private layerR = 0;
  constructor(readonly canvas: HTMLCanvasElement) { this.ctx = canvas.getContext?.('2d') ?? null; }
  /** Animated themes are soft: a capped internal resolution keeps them cheap on large, dense screens. */
  private fit(themed = false) {
    const ratio = Math.min(themed ? 1.25 : 2, (globalThis.devicePixelRatio as number) || 1), w = this.canvas.clientWidth || innerWidth, h = this.canvas.clientHeight || innerHeight;
    if (w === this.w && h === this.h && ratio === this.ratio) return;
    this.w = w; this.h = h; this.ratio = ratio;
    this.canvas.width = Math.round(w * ratio); this.canvas.height = Math.round(h * ratio);
  }
  clear() { if (this.ctx) this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); }
  draw(f: ScopeFrame) {
    const g = this.ctx; if (!g) return;
    f = { ...f, accent: reticleColour(f.accent) };
    this.fit(!!scopeTheme(f.theme)); g.setTransform(this.ratio, 0, 0, this.ratio, 0, 0); g.clearRect(0, 0, this.w, this.h);
    const { w, h } = this, open = Math.max(0, Math.min(1, f.open));
    const R = Math.min(w, h) * .46 * (.82 + .18 * open), cx = w / 2, cy = h / 2, theme = scopeTheme(f.theme), t = f.time ?? 0;
    if (theme) {
      // Themed surrounds are soft and busy: paint them into a half-resolution layer at most ~30
      // times a second, then stretch it under the crisp, every-frame reticle.
      const layer = this.layer ??= typeof document === 'undefined' ? null : document.createElement('canvas'), scale = .5;
      const lw = Math.max(1, Math.round(w * scale)), lh = Math.max(1, Math.round(h * scale)), key = `${lw}x${lh}|${f.theme}`;
      if (layer && (key !== this.layerKey || t < this.layerAt || t - this.layerAt >= 1 / 30 || Math.abs(R - this.layerR) > R * .02)) {
        if (layer.width !== lw || layer.height !== lh) { layer.width = lw; layer.height = lh; }
        const lg = layer.getContext('2d');
        if (lg) {
          lg.setTransform(lw / w, 0, 0, lh / h, 0, 0); lg.clearRect(0, 0, w, h);
          this.backdrop(lg, w, h, cx, cy, R, theme); lg.save(); theme.fx(lg, { cx, cy, R, w, h, t }); lg.restore();
          this.layerKey = key; this.layerAt = t; this.layerR = R;
        } else this.layerKey = '';
      }
      if (layer && this.layerKey === key) { g.imageSmoothingEnabled = true; g.drawImage(layer, 0, 0, w, h); }
      else { this.backdrop(g, w, h, cx, cy, R, theme); g.save(); theme.fx(g, { cx, cy, R, w, h, t }); g.restore(); }
    } else this.backdrop(g, w, h, cx, cy, R, undefined);
    // Reticle.
    g.save(); g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.clip();
    if (theme) { this.themedReticle(g, f.kind, theme, cx, cy, R, t); g.restore(); this.readouts(g, f, cx, cy, R, open); return; }
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
    this.readouts(g, f, cx, cy, R, open);
  }
  /** Tube, rim darkening, colour fringe, glare and dirt: everything under the reticle. */
  private backdrop(g: CanvasRenderingContext2D, w: number, h: number, cx: number, cy: number, R: number, theme: ScopeTheme | undefined) {
    // Tube: everything outside the lens is the inside of the scope (tinted by the finish's theme).
    let tube: string | CanvasGradient = '#020407';
    if (theme) { const tint = g.createRadialGradient(cx, cy, R, cx, cy, Math.hypot(w, h) / 2); tint.addColorStop(0, theme.surround[0]); tint.addColorStop(1, theme.surround[1]); tube = tint; }
    g.save(); g.beginPath(); g.rect(0, 0, w, h); g.arc(cx, cy, R, 0, Math.PI * 2, true); g.fillStyle = tube; g.fill('evenodd'); g.restore();
    const rim = g.createRadialGradient(cx, cy, R * .74, cx, cy, R);
    rim.addColorStop(0, 'rgba(0,0,0,0)'); rim.addColorStop(.75, 'rgba(0,0,0,.18)'); rim.addColorStop(1, 'rgba(0,0,0,.78)');
    g.fillStyle = rim; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();
    // Chromatic fringe at the rim and a soft glare arc.
    g.lineWidth = 2;
    for (const [dx, col] of [[1.6, 'rgba(255,70,60,.38)'], [-1.6, 'rgba(70,210,255,.34)']] as const) { g.strokeStyle = col; g.beginPath(); g.arc(cx + dx, cy, R - 1.5, 0, Math.PI * 2); g.stroke(); }
    g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = R * .05; g.beginPath(); g.arc(cx, cy, R * .86, Math.PI * 1.08, Math.PI * 1.42); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.035)'; g.lineWidth = R * .02; g.beginPath(); g.arc(cx, cy, R * .78, Math.PI * 1.12, Math.PI * 1.3); g.stroke();
    for (const d of DIRT) { g.fillStyle = `rgba(210,220,230,${d.o})`; g.beginPath(); g.arc(cx + Math.cos(d.a) * d.r * R, cy + Math.sin(d.a) * d.r * R, d.s, 0, Math.PI * 2); g.fill(); }
  }
  private readouts(g: CanvasRenderingContext2D, f: ScopeFrame, cx: number, cy: number, R: number, open: number) {
    // Readouts inside the bottom of the lens.
    g.font = '700 15px ui-monospace, SFMono-Regular, Menlo, monospace'; g.textBaseline = 'middle';
    const base = cy + R * .78;
    g.fillStyle = 'rgba(4,8,12,.62)';
    const pill = Math.min(92, R * .42);
    for (const x of [cx - R * .52, cx + R * .52 - pill]) { g.beginPath(); g.roundRect?.(x, base - 13, pill, 26, 8); g.fill(); }
    g.fillStyle = 'rgba(220,245,240,.95)'; g.textAlign = 'right';
    g.fillText(f.range === null ? '--- m' : `${Math.round(f.range)} m`, cx + R * .52 - 12, base);
    g.textAlign = 'left'; g.fillText(`${f.zoom.toFixed(1)}×`, cx - R * .52 + 12, base);
    g.textAlign = 'center'; g.font = '600 10px ui-monospace, monospace'; g.fillStyle = 'rgba(210,235,230,.55)'; g.fillText(f.label, cx, cy + R * .9);
    // Scope-in: a dark tunnel that clears as the optic settles.
    if (open < 1) { g.fillStyle = `rgba(2,4,7,${(1 - open) * .85})`; g.beginPath(); g.arc(cx, cy, R + 2, 0, Math.PI * 2); g.fill(); }
  }

  /** Reticle in the theme's colours. A thin straight core always marks the exact aim; the
   * style (flame, electric, frost) only dresses it. */
  private themedReticle(g: CanvasRenderingContext2D, kind: ScopeFrame['kind'], theme: ScopeTheme, cx: number, cy: number, R: number, t: number) {
    const seed = Math.floor(t * 20), h = (n: number) => { const x = Math.sin(n * 91.3 + seed * 7.1) * 43758.5; return x - Math.floor(x); };
    const flicker = theme.style === 'flame' ? .82 + .18 * Math.sin(t * 23) * Math.sin(t * 7.3) : 1;
    const line = (x1: number, y1: number, x2: number, y2: number, width: number, id: number) => {
      g.lineCap = 'round';
      g.shadowBlur = 0; g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = width + 2.4; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
      g.shadowColor = theme.line; g.shadowBlur = theme.style === 'flame' ? Math.round(10 + 6 * Math.sin(t * 17 + id)) : 8;
      g.globalAlpha = flicker; g.strokeStyle = theme.line; g.lineWidth = width; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); g.globalAlpha = 1;
      g.shadowBlur = 0; // additive strokes under a live shadow are the slow path; the glow is already there
      if (theme.style === 'flame' && width > 2) { g.globalCompositeOperation = 'lighter'; g.strokeStyle = 'rgba(255,240,170,.7)'; g.lineWidth = width * .35; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); g.globalCompositeOperation = 'source-over'; }
      if (theme.style === 'electric') {
        const len = Math.hypot(x2 - x1, y2 - y1), nx = -(y2 - y1) / (len || 1), ny = (x2 - x1) / (len || 1), steps = Math.max(4, Math.round(len / 18));
        g.globalCompositeOperation = 'lighter'; g.strokeStyle = 'rgba(255,170,200,.75)'; g.lineWidth = 1.1; g.beginPath();
        for (let s = 0; s <= steps; s++) { const k = s / steps, j = s === 0 || s === steps ? 0 : (h(id * 31 + s) - .5) * width * 2.2; const x = x1 + (x2 - x1) * k + nx * j, y = y1 + (y2 - y1) * k + ny * j; s ? g.lineTo(x, y) : g.moveTo(x, y); }
        g.stroke(); g.globalCompositeOperation = 'source-over';
      }
      if (theme.style === 'frost') {
        const len = Math.hypot(x2 - x1, y2 - y1), n = Math.floor(len / 34);
        g.shadowBlur = 4; g.fillStyle = theme.glow;
        for (let s = 1; s < n; s++) { const x = x1 + (x2 - x1) * s / n, y = y1 + (y2 - y1) * s / n, d = 3 + (s % 2); g.beginPath(); g.moveTo(x, y - d); g.lineTo(x + d * .6, y); g.lineTo(x, y + d); g.lineTo(x - d * .6, y); g.closePath(); g.fill(); }
      }
      g.shadowBlur = 0;
    };
    const dot = (x: number, y: number, r: number) => { g.shadowColor = theme.glow; g.shadowBlur = 10; g.fillStyle = theme.glow; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.shadowBlur = 0; };
    g.font = '600 10px ui-monospace, monospace';
    if (kind === 'sniper') {
      const inner = R * .2;
      line(cx - R, cy, cx - inner, cy, 5, 1); line(cx + inner, cy, cx + R, cy, 5, 2); line(cx, cy + inner, cx, cy + R, 5, 3); line(cx, cy - R, cx, cy - inner, 5, 4);
      line(cx - inner, cy, cx + inner, cy, 1.5, 5); line(cx, cy - inner, cx, cy + inner, 1.5, 6);
      g.fillStyle = theme.line;
      for (let i = 1; i <= 4; i++) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { g.beginPath(); g.arc(cx + dx * i * inner / 5, cy + dy * i * inner / 5, 2.2, 0, Math.PI * 2); g.fill(); }
      for (let i = 1; i <= 3; i++) { const y = cy + inner + i * R * .1; line(cx - 14 + i * 2, y, cx + 14 - i * 2, y, 1.6, 10 + i); g.fillStyle = theme.line; g.fillText(String(i * 2), cx + 18, y + 4); }
      dot(cx, cy, 2.8);
    } else {
      g.shadowColor = theme.line; g.shadowBlur = 6; g.strokeStyle = theme.line; g.globalAlpha = .75 * flicker; g.lineWidth = 1.4; g.beginPath(); g.arc(cx, cy, R * .42, 0, Math.PI * 2); g.stroke(); g.globalAlpha = 1; g.shadowBlur = 0;
      line(cx, cy + 14, cx, cy + 14 + R * .38, 1.4, 20);
      for (let i = 1; i <= 4; i++) { const y = cy + 12 + i * R * .07, half = 26 - i * 4; line(cx - half, y, cx + half, y, 1.4, 20 + i); g.fillStyle = theme.line; g.fillText(String(i + 2), cx + half + 6, y + 4); }
      const chevron = () => { g.beginPath(); g.moveTo(cx - 14, cy + 14); g.lineTo(cx, cy); g.lineTo(cx + 14, cy + 14); g.stroke(); };
      g.lineJoin = 'round'; g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 5.5; chevron();
      g.shadowColor = theme.glow; g.shadowBlur = 10; g.strokeStyle = theme.glow; g.lineWidth = 2.8; chevron(); g.shadowBlur = 0;
    }
  }
}

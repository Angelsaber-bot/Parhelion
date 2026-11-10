import * as THREE from 'three';
import type { FlashShape, MarkShape } from '../cosmetics/signatureFx.ts';

/** Canvas-painted shapes for muzzle flashes / contact emblems and for the marks shots leave.
 * Painted white so a material colour tints them; each is made once and cached. A stubbed or
 * missing canvas (tests, very old browsers) falls back to an empty texture. */
type Paint = (g: CanvasRenderingContext2D, m: number) => void;
function canvasTexture(size: number, paint: Paint): THREE.Texture {
  try {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const g = c.getContext('2d'); if (!g) return new THREE.Texture();
    paint(g, size / 2);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  } catch { return new THREE.Texture(); }
}
const TAU = Math.PI * 2;
const W = (a: number) => `rgba(255,255,255,${a})`;
const D = (a: number) => `rgba(12,10,9,${a})`;
const radial = (g: CanvasRenderingContext2D, m: number, r: number, stops: [number, string][]) => {
  const grad = g.createRadialGradient(m, m, 0, m, m, r); for (const [k, c] of stops) grad.addColorStop(k, c); return grad;
};
const around = (g: CanvasRenderingContext2D, m: number, n: number, offset: number, draw: (i: number) => void) => {
  for (let i = 0; i < n; i++) { g.save(); g.translate(m, m); g.rotate(offset + i / n * TAU); draw(i); g.restore(); }
};
const spike = (g: CanvasRenderingContext2D, len: number, w: number, a = .95) => {
  const grad = g.createLinearGradient(0, 0, len, 0); grad.addColorStop(0, W(a)); grad.addColorStop(1, W(0));
  g.fillStyle = grad; g.beginPath(); g.moveTo(0, -w); g.lineTo(len, 0); g.lineTo(0, w); g.closePath(); g.fill();
};
const core = (g: CanvasRenderingContext2D, m: number, r = .5) => { g.fillStyle = radial(g, m, m * r, [[0, W(1)], [.4, W(.7)], [1, W(0)]]); g.fillRect(0, 0, m * 2, m * 2); };
const zigzag = (g: CanvasRenderingContext2D, len: number, steps: number, amp: number, seed: number) => {
  g.beginPath(); g.moveTo(0, 0);
  for (let s = 1; s <= steps; s++) { const h = Math.sin(seed * 12.9 + s * 78.2) * 43758.5; g.lineTo(len * s / steps, (h - Math.floor(h) - .5) * 2 * amp * (s < steps ? 1 : 0)); }
  g.stroke();
};
const gearPath = (g: CanvasRenderingContext2D, m: number, r: number, teeth: number, depth: number) => {
  g.beginPath();
  for (let i = 0; i < teeth * 4; i++) { const a = i / (teeth * 4) * TAU, rr = (i % 4 < 2) ? r : r - depth; i ? g.lineTo(m + Math.cos(a) * rr, m + Math.sin(a) * rr) : g.moveTo(m + Math.cos(a) * rr, m + Math.sin(a) * rr); }
  g.closePath();
};
const hexPath = (g: CanvasRenderingContext2D, x: number, y: number, r: number) => {
  g.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + Math.PI / 6; i ? g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r) : g.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.closePath();
};
const petalPath = (g: CanvasRenderingContext2D, len: number, w: number) => {
  g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(len * .35, -w, len * .85, -w * .8, len, -w * .15); g.lineTo(len * .92, 0); g.lineTo(len, w * .15);
  g.bezierCurveTo(len * .85, w * .8, len * .35, w, 0, 0); g.closePath();
};
const featherPath = (g: CanvasRenderingContext2D, len: number, w: number) => {
  g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(len * .45, -w, len, 0); g.quadraticCurveTo(len * .45, w, 0, 0); g.closePath();
};

const FLASH: Record<FlashShape, Paint> = {
  star: (g, m) => { core(g, m, .55); g.globalCompositeOperation = 'lighter'; around(g, m, 8, .2, (i) => spike(g, m * .96 * [1, .55, .85, .5, .95, .6, .8, .45][i], m * (i % 2 ? .07 : .11))); },
  ring: (g, m) => { core(g, m, .35); g.strokeStyle = W(.95); g.lineWidth = m * .09; g.beginPath(); g.arc(m, m, m * .62, 0, TAU); g.stroke(); g.strokeStyle = W(.45); g.lineWidth = m * .04; g.beginPath(); g.arc(m, m, m * .85, 0, TAU); g.stroke(); },
  bloom: (g, m) => { around(g, m, 5, -Math.PI / 2, () => { g.fillStyle = W(.85); petalPath(g, m * .9, m * .34); g.fill(); }); core(g, m, .35); },
  cross: (g, m) => { core(g, m, .4); g.globalCompositeOperation = 'lighter'; around(g, m, 4, 0, () => spike(g, m * .98, m * .07)); around(g, m, 4, Math.PI / 4, () => spike(g, m * .45, m * .05, .7)); },
  crystal: (g, m) => { around(g, m, 6, .3, (i) => { const len = m * (i % 2 ? .7 : .95); g.fillStyle = W(.9); g.beginPath(); g.moveTo(m * .1, 0); g.lineTo(len * .45, -m * .13); g.lineTo(len, 0); g.lineTo(len * .45, m * .13); g.closePath(); g.fill(); }); core(g, m, .3); },
  pixel: (g, m) => { const c = m * .16; g.fillStyle = W(1); for (const [x, y] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2], [1, 1], [-1, -1], [1, -1], [-1, 1], [3, 0], [-3, 0], [0, 3], [0, -3], [2, 2], [-2, -2]] as const) g.fillRect(m + x * c * 1.2 - c / 2, m + y * c * 1.2 - c / 2, c, c); },
  burst: (g, m) => { core(g, m, .45); g.globalCompositeOperation = 'lighter'; around(g, m, 16, .1, (i) => spike(g, m * (.55 + .45 * ((i * 7) % 5) / 4), m * .035)); },
  spiral: (g, m) => { core(g, m, .3); g.lineCap = 'round'; around(g, m, 3, 0, () => { for (let k = 0; k < 14; k++) { const a0 = k / 14 * 2.2, a1 = (k + 1) / 14 * 2.2, r0 = m * (.15 + k / 14 * .8), r1 = m * (.15 + (k + 1) / 14 * .8); g.strokeStyle = W(.95 * (1 - k / 16)); g.lineWidth = m * .14 * (1 - k / 16); g.beginPath(); g.moveTo(Math.cos(a0) * r0, Math.sin(a0) * r0); g.lineTo(Math.cos(a1) * r1, Math.sin(a1) * r1); g.stroke(); } }); },
  hex: (g, m) => { core(g, m, .35); g.strokeStyle = W(.95); g.lineWidth = m * .08; hexPath(g, m, m, m * .55); g.stroke(); g.lineWidth = m * .04; for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; hexPath(g, m + Math.cos(a) * m * .78, m + Math.sin(a) * m * .78, m * .17); g.stroke(); } },
  bolt: (g, m) => { core(g, m, .3); g.lineJoin = 'round'; around(g, m, 5, .4, (i) => { g.strokeStyle = W(.55); g.lineWidth = m * .1; zigzag(g, m * (.7 + (i % 2) * .25), 5, m * .1, i); g.strokeStyle = W(1); g.lineWidth = m * .04; zigzag(g, m * (.7 + (i % 2) * .25), 5, m * .1, i); }); },
  fangs: (g, m) => { core(g, m, .3); g.fillStyle = W(.92); around(g, m, 10, 0, (i) => { const r0 = m * .9, r1 = m * (i % 2 ? .45 : .32); g.beginPath(); g.moveTo(r0, -m * .13); g.lineTo(r1, 0); g.lineTo(r0, m * .13); g.closePath(); g.fill(); }); },
  seal: (g, m) => { g.fillStyle = W(.9); g.beginPath(); for (let i = 0; i <= 48; i++) { const a = i / 48 * TAU, r = m * (.72 + .07 * Math.sin(a * 12)); i ? g.lineTo(m + Math.cos(a) * r, m + Math.sin(a) * r) : g.moveTo(m + Math.cos(a) * r, m + Math.sin(a) * r); } g.fill(); g.globalCompositeOperation = 'destination-out'; g.lineWidth = m * .06; g.strokeStyle = W(1); g.beginPath(); g.arc(m, m, m * .45, 0, TAU); g.stroke(); g.globalCompositeOperation = 'source-over'; core(g, m, .25); },
  feathers: (g, m) => { around(g, m, 7, -Math.PI / 2, (i) => { g.fillStyle = W(.8); featherPath(g, m * (.75 + (i % 2) * .2), m * .16); g.fill(); g.strokeStyle = W(1); g.lineWidth = m * .02; g.beginPath(); g.moveTo(0, 0); g.lineTo(m * .8, 0); g.stroke(); }); core(g, m, .3); },
  gear: (g, m) => { g.fillStyle = W(.9); gearPath(g, m, m * .82, 10, m * .14); g.fill(); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(m, m, m * .38, 0, TAU); g.fill(); g.globalCompositeOperation = 'source-over'; core(g, m, .3); },
};

/** Marks are painted with a dark outline under a white motif: the motif takes the finish's colour
 * and the outline keeps it legible on white floors. */
const outlined = (g: CanvasRenderingContext2D, path: () => void, width: number, fill = true) => {
  path(); g.strokeStyle = D(.55); g.lineWidth = width + 3; g.stroke(); if (fill) { g.fillStyle = W(.95); g.fill(); } else { g.strokeStyle = W(.95); g.lineWidth = width; g.stroke(); }
};
const hole = (g: CanvasRenderingContext2D, m: number, r = .17) => {
  g.fillStyle = radial(g, m, m * r * 2.2, [[0, D(1)], [.45, D(.9)], [1, D(0)]]); g.fillRect(0, 0, m * 2, m * 2);
  g.fillStyle = D(1); g.beginPath(); g.arc(m, m, m * r, 0, TAU); g.fill();
};
const MARK: Record<MarkShape, Paint> = {
  hole: (g, m) => {
    g.fillStyle = radial(g, m, m, [[0, D(1)], [.28, D(.92)], [.45, 'rgba(55,47,40,.55)'], [1, 'rgba(40,34,28,0)']]); g.fillRect(0, 0, m * 2, m * 2);
    g.strokeStyle = D(.7); g.lineWidth = 1.2; for (let i = 0; i < 7; i++) { const a = i * 2.39 + .4, r0 = m * .2, r1 = m * (.42 + (i % 3) * .12); g.beginPath(); g.moveTo(m + Math.cos(a) * r0, m + Math.sin(a) * r0); g.lineTo(m + Math.cos(a + .15) * r1, m + Math.sin(a + .15) * r1); g.stroke(); }
    g.fillStyle = D(1); g.beginPath(); g.arc(m, m, m * .17, 0, TAU); g.fill();
  },
  scorch: (g, m) => { g.fillStyle = radial(g, m, m * .95, [[0, D(.95)], [.5, D(.6)], [1, D(0)]]); around(g, m, 9, .3, (i) => { g.fillStyle = D(.75); g.beginPath(); g.moveTo(0, -m * .1); g.lineTo(m * (.6 + (i % 3) * .13), 0); g.lineTo(0, m * .1); g.fill(); }); g.fillStyle = radial(g, m, m * .5, [[0, W(.9)], [.35, W(.5)], [1, W(0)]]); g.fillRect(0, 0, m * 2, m * 2); hole(g, m, .12); },
  frost: (g, m) => { around(g, m, 6, 0, () => outlined(g, () => { g.beginPath(); g.moveTo(m * .1, 0); g.lineTo(m * .9, 0); g.moveTo(m * .5, 0); g.lineTo(m * .7, -m * .16); g.moveTo(m * .5, 0); g.lineTo(m * .7, m * .16); }, 3, false)); hole(g, m, .13); },
  petal: (g, m) => { around(g, m, 5, -Math.PI / 2, () => outlined(g, () => { g.translate(m * .16, 0); petalPath(g, m * .66, m * .28); }, 1)); hole(g, m, .12); },
  pixel: (g, m) => { const c = m * .2; for (const [x, y] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [2, 1], [-2, -1], [1, -2], [-1, 2]] as const) { g.fillStyle = D(.6); g.fillRect(m + x * c - c / 2 - 2, m + y * c - c / 2 - 2, c + 4, c + 4); g.fillStyle = (x || y) ? W(.95) : D(1); g.fillRect(m + x * c - c / 2, m + y * c - c / 2, c, c); } },
  rune: (g, m) => { outlined(g, () => { g.beginPath(); g.arc(m, m, m * .62, 0, TAU); }, 4, false); around(g, m, 8, 0, (i) => outlined(g, () => { g.beginPath(); g.moveTo(m * .7, 0); g.lineTo(m * (i % 2 ? .85 : .95), 0); }, 3, false)); outlined(g, () => { g.beginPath(); g.arc(m, m, m * .38, 0, TAU); }, 2, false); hole(g, m, .14); },
  crack: (g, m) => { g.lineJoin = 'round'; around(g, m, 6, .2, (i) => { g.strokeStyle = D(.85); g.lineWidth = 4; zigzag(g, m * (.6 + (i % 3) * .14), 4, m * .1, i + 3); g.strokeStyle = W(.9); g.lineWidth = 1.6; zigzag(g, m * (.6 + (i % 3) * .14), 4, m * .1, i + 3); }); hole(g, m, .16); },
  splash: (g, m) => { const blobs = [[0, 0, .45], [.55, .1, .17], [-.5, .3, .15], [.2, -.6, .14], [-.3, -.45, .12], [.35, .55, .13], [.75, -.3, .08], [-.75, -.05, .09]]; for (const [x, y, r] of blobs) { g.fillStyle = D(.5); g.beginPath(); g.arc(m + x * m, m + y * m, r * m + 2, 0, TAU); g.fill(); } for (const [x, y, r] of blobs) { g.fillStyle = W(.92); g.beginPath(); g.arc(m + x * m, m + y * m, r * m, 0, TAU); g.fill(); } hole(g, m, .1); },
  hex: (g, m) => { for (const [x, y] of [[0, 0], [.52, .3], [-.52, .3], [0, -.6], [.52, -.3], [-.52, -.3], [0, .6]] as const) outlined(g, () => hexPath(g, m + x * m * .8, m + y * m * .8, m * .26), 2, false); g.fillStyle = D(.9); hexPath(g, m, m, m * .17); g.fill(); },
  seal: (g, m) => { outlined(g, () => { g.beginPath(); for (let i = 0; i <= 48; i++) { const a = i / 48 * TAU, r = m * (.7 + .08 * Math.sin(a * 12)); i ? g.lineTo(m + Math.cos(a) * r, m + Math.sin(a) * r) : g.moveTo(m + Math.cos(a) * r, m + Math.sin(a) * r); } g.closePath(); }, 1); g.strokeStyle = D(.6); g.lineWidth = 2.5; g.beginPath(); g.arc(m, m, m * .45, 0, TAU); g.stroke(); hole(g, m, .12); },
  feather: (g, m) => { g.save(); g.translate(m, m); g.rotate(-.6); g.translate(-m * .85, 0); outlined(g, () => featherPath(g, m * 1.7, m * .38), 1); g.strokeStyle = D(.6); g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, 0); g.lineTo(m * 1.6, 0); g.stroke(); g.restore(); hole(g, m, .12); },
  gear: (g, m) => { outlined(g, () => gearPath(g, m, m * .8, 9, m * .15), 1); g.fillStyle = D(.9); g.beginPath(); g.arc(m, m, m * .34, 0, TAU); g.fill(); },
};

const flashCache = new Map<FlashShape, THREE.Texture>(), markCache = new Map<MarkShape, THREE.Texture>();
export function flashTexture(shape: FlashShape = 'star'): THREE.Texture {
  let t = flashCache.get(shape); if (!t) { t = canvasTexture(128, FLASH[shape] ?? FLASH.star); flashCache.set(shape, t); } return t;
}
export function markTexture(shape: MarkShape = 'hole'): THREE.Texture {
  let t = markCache.get(shape); if (!t) { t = canvasTexture(64, MARK[shape] ?? MARK.hole); markCache.set(shape, t); } return t;
}

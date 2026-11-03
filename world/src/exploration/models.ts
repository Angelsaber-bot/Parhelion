/**
 * Procedural, layered models for the exploration layer. Static parts are merged into a
 * SiteArt (three draw calls per region); moving parts (chest lids, prism heads, feathers)
 * are small groups that the runtime culls by distance.
 */
import * as THREE from 'three';
import { SiteArt } from '../campaignSites';
import type { ChestTier } from './catalog';
import type { RegionId } from '../settlements/types';

export type V3 = [number, number, number];
type Layer = 'body' | 'metal' | 'glow';

const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl8: new THREE.CylinderGeometry(1, 1, 1, 8),
  cyl12: new THREE.CylinderGeometry(1, 1, 1, 12),
  cyl20: new THREE.CylinderGeometry(1, 1, 1, 20),
  cone8: new THREE.ConeGeometry(1, 1, 8),
  cone4: new THREE.ConeGeometry(1, 1, 4),
  sphere: new THREE.SphereGeometry(1, 14, 10),
  octa: new THREE.OctahedronGeometry(1, 0),
  halfCyl: new THREE.CylinderGeometry(1, 1, 1, 14, 1, false, 0, Math.PI),
};

/** Places parts in a local frame (origin + yaw) on a SiteArt. */
export class Frame {
  private readonly base: THREE.Matrix4;
  constructor(readonly art: SiteArt, origin: V3, yaw = 0) {
    this.base = new THREE.Matrix4().compose(new THREE.Vector3(...origin), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(1, 1, 1));
  }
  part(g: THREE.BufferGeometry, p: V3, size: V3, color: string, layer: Layer = 'body', rot: V3 = [0, 0, 0], solid = false) {
    const local = new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(...size));
    const geo = (g.index ? g.toNonIndexed() : g.clone()).applyMatrix4(new THREE.Matrix4().multiplyMatrices(this.base, local));
    this.art.add(geo, color, [0, 0, 0], [1, 1, 1], solid, layer); geo.dispose();
  }
  box(p: V3, s: V3, c: string, layer: Layer = 'body', rot: V3 = [0, 0, 0], solid = false) { this.part(G.box, p, s, c, layer, rot, solid); }
  cyl(p: V3, r: number, h: number, c: string, layer: Layer = 'body', seg: 8 | 12 | 20 = 12, rot: V3 = [0, 0, 0], solid = false) { this.part(seg === 8 ? G.cyl8 : seg === 12 ? G.cyl12 : G.cyl20, p, [r, h, r], c, layer, rot, solid); }
  taper(p: V3, r0: number, r1: number, h: number, c: string, layer: Layer = 'body', seg = 8, solid = false) {
    const g = new THREE.CylinderGeometry(r1, r0, h, seg); this.part(g, p, [1, 1, 1], c, layer, [0, 0, 0], solid); g.dispose();
  }
  torus(p: V3, r: number, tube: number, c: string, layer: Layer = 'metal', rot: V3 = [0, 0, 0], arc = Math.PI * 2) {
    const g = new THREE.TorusGeometry(r, tube, 6, 24, arc); this.part(g, p, [1, 1, 1], c, layer, rot); g.dispose();
  }
  gem(p: V3, r: number, c: string, rot: V3 = [0, 0, 0], stretch = 1.4) { this.part(G.octa, p, [r, r * stretch, r], c, 'glow', rot); }
  sphere(p: V3, s: V3, c: string, layer: Layer = 'body') { this.part(G.sphere, p, s, c, layer); }
  cone(p: V3, r: number, h: number, c: string, layer: Layer = 'body', seg: 4 | 8 = 8, rot: V3 = [0, 0, 0], solid = false) { this.part(seg === 4 ? G.cone4 : G.cone8, p, [r, h, r], c, layer, rot, solid); }
  lathe(points: [number, number][], p: V3, c: string, layer: Layer = 'body', seg = 14, solid = false) {
    const g = new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), seg); this.part(g, p, [1, 1, 1], c, layer, [0, 0, 0], solid); g.dispose();
  }
  halfCyl(p: V3, r: number, len: number, c: string, layer: Layer = 'body') { this.part(G.halfCyl, p, [r, len, r], c, layer, [0, 0, Math.PI / 2]); }
}

// ─────────────────────────────────────────── chests ───────────────────────────────────────────
export const CHEST_STYLE: Record<ChestTier, { wood: string; plank: string; metal: string; gem: string | null; trim: string }> = {
  common: { wood: '#8a5a34', plank: '#5c3a20', metal: '#77736c', gem: null, trim: '#4c4a46' },
  exquisite: { wood: '#2f6b78', plank: '#21505b', metal: '#c99b55', gem: '#7fe6ff', trim: '#8c6a3a' },
  precious: { wood: '#8b2c2c', plank: '#651d1f', metal: '#e7bd5f', gem: '#ff7a55', trim: '#b4893c' },
  luxurious: { wood: '#efe6d2', plank: '#d8cba9', metal: '#f2c95c', gem: '#fff0a6', trim: '#c79a37' },
};
const W = 1.0, D = .64, H = .48;
/** Chest body (static). Local frame: front faces +z, origin on the ground. */
export function chestBody(f: Frame, tier: ChestTier) {
  const s = CHEST_STYLE[tier];
  f.box([0, .035, 0], [W + .06, .07, D + .06], s.trim, 'body', [0, 0, 0], true);
  for (const x of [-1, 1]) for (const z of [-1, 1]) f.box([x * (W / 2 - .04), .03, z * (D / 2 - .04)], [.1, .06, .1], s.metal, 'metal');
  f.box([0, .07 + H / 2, 0], [W, H, D], s.wood, 'body', [0, 0, 0], true);
  // plank grooves on all four faces
  for (const y of [.2, .34, .46]) {
    f.box([0, y, D / 2 + .004], [W - .04, .018, .012], s.plank);
    f.box([0, y, -D / 2 - .004], [W - .04, .018, .012], s.plank);
    for (const x of [-1, 1]) f.box([x * (W / 2 + .004), y, 0], [.012, .018, D - .04], s.plank);
  }
  // corner guards and straps
  for (const x of [-1, 1]) for (const z of [-1, 1]) f.box([x * (W / 2 - .015), .07 + H / 2, z * (D / 2 - .015)], [.075, H + .02, .075], s.metal, 'metal');
  for (const x of [-.3, .3]) {
    f.box([x, .07 + H / 2, D / 2 + .012], [.085, H, .014], s.metal, 'metal');
    f.box([x, .07 + H / 2, -D / 2 - .012], [.085, H, .014], s.metal, 'metal');
    for (const y of [.16, .42]) f.cyl([x, y, D / 2 + .022], .016, .012, s.trim, 'metal', 8, [Math.PI / 2, 0, 0]);
  }
  f.box([0, .07 + H + .012, 0], [W + .03, .035, D + .03], s.metal, 'metal');
  // lock plate + keyhole
  f.box([0, .44, D / 2 + .022], [.2, .22, .025], s.metal, 'metal');
  f.box([0, .43, D / 2 + .036], [.035, .08, .01], '#1d1712');
  f.cyl([0, .47, D / 2 + .036], .025, .01, '#1d1712', 'body', 8, [Math.PI / 2, 0, 0]);
  // side handles
  for (const x of [-1, 1]) f.torus([x * (W / 2 + .03), .34, 0], .07, .014, s.metal, 'metal', [0, Math.PI / 2, 0], Math.PI);
  if (tier === 'luxurious') {
    for (const x of [-1, 1]) {
      // gilded wing flourishes on the sides
      for (let i = 0; i < 3; i++) f.box([x * (W / 2 + .03), .22 + i * .09, -.05 + i * .05], [.02, .05, .34 - i * .07], s.metal, 'metal', [0.35 * x, 0, 0]);
    }
  }
}
/** Lid as its own group: pivot is the back hinge, so `rotation.x` opens it. */
export function chestLid(tier: ChestTier): { group: THREE.Group; art: SiteArt } {
  const s = CHEST_STYLE[tier], art = new SiteArt(), f = new Frame(art, [0, 0, 0]);
  const r = D / 2;
  // geometry is authored relative to the hinge at (0,0,-D/2)
  f.halfCyl([0, 0, r], r, W, s.wood);
  f.part(G.halfCyl, [0, 0, r], [r + .012, .03, r + .012], s.metal, 'metal', [0, 0, Math.PI / 2]);
  for (const x of [-.3, .3]) f.part(G.halfCyl, [x, 0, r], [r + .014, .085, r + .014], s.metal, 'metal', [0, 0, Math.PI / 2]);
  for (const x of [-W / 2, W / 2]) f.part(G.halfCyl, [x, 0, r], [r + .01, .03, r + .01], s.metal, 'metal', [0, 0, Math.PI / 2]);
  f.box([0, .02, r * 2 + .01], [.16, .12, .03], s.metal, 'metal');
  if (s.gem) f.gem([0, .1, r * 2 + .03], .055, s.gem, [Math.PI / 2, 0, 0], 1.2);
  if (tier === 'luxurious') {
    f.torus([0, r + .015, r], .12, .018, s.metal, 'glow', [Math.PI / 2, 0, 0]);
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; f.box([Math.cos(a) * .17, r + .02, r + Math.sin(a) * .17], [.05, .02, .015], s.gem!, 'glow', [0, -a, 0]); }
  }
  art.finish('britain');
  const group = new THREE.Group(); group.add(art.root); art.root.position.set(0, 0, 0);
  return { group, art };
}

// ─────────────────────────────────────── prism puzzle parts ───────────────────────────────────────
const STONE = '#9a9384', STONE_DARK = '#6f6a60', BRONZE = '#b8874a', RUNE = '#8fe3ff';
export function prismPedestal(f: Frame, height = 0) {
  if (height > 0) ruinTower(f, height);
  const y = height;
  f.cyl([0, y + .12, 0], .95, .24, STONE_DARK, 'body', 8, [0, 0, 0], true);
  f.cyl([0, y + .55, 0], .62, .66, STONE, 'body', 8, [0, Math.PI / 8, 0], true);
  f.cyl([0, y + .94, 0], .78, .14, STONE_DARK, 'body', 8, [0, 0, 0], true);
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; f.box([Math.cos(a) * .66, y + .45, Math.sin(a) * .66], [.18, .6, .3], STONE, 'body', [0, -a, .12]); }
  f.torus([0, y + .62, 0], .64, .028, RUNE, 'glow', [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + Math.PI / 8; f.box([Math.cos(a) * .625, y + .78, Math.sin(a) * .625], [.06, .12, .02], RUNE, 'glow', [0, Math.PI / 2 - a, 0]); }
}
/** Rotating head: points along local +x. */
export function prismHead(): { group: THREE.Group; art: SiteArt; crystal: THREE.Mesh } {
  const art = new SiteArt(), f = new Frame(art, [0, 0, 0]);
  f.torus([0, 1.08, 0], .46, .045, BRONZE, 'metal', [Math.PI / 2, 0, 0]);
  for (const z of [-1, 1]) {
    f.box([0, 1.4, z * .44], [.08, .62, .07], BRONZE, 'metal');
    f.sphere([0, 1.72, z * .44], [.07, .07, .07], BRONZE, 'metal');
  }
  f.torus([0, 1.5, 0], .4, .03, BRONZE, 'metal', [0, 0, 0]);
  // lens barrel + emitter pointing +x (the facing direction)
  f.cyl([.42, 1.5, 0], .1, .32, BRONZE, 'metal', 12, [0, 0, Math.PI / 2]);
  f.cyl([.6, 1.5, 0], .14, .05, '#d8f6ff', 'glow', 12, [0, 0, Math.PI / 2]);
  f.cone([.78, 1.5, 0], .06, .18, '#e9fbff', 'glow', 8, [0, 0, -Math.PI / 2]);
  // small fins as a readable arrow on the ring
  for (const z of [-1, 1]) f.box([.3, 1.08, z * .12], [.32, .03, .05], BRONZE, 'metal', [0, z * .5, 0]);
  art.finish('britain');
  const crystal = new THREE.Mesh(G.octa, crystalMaterial(false));
  crystal.scale.set(.24, .36, .24); crystal.position.set(0, 1.5, 0); crystal.name = 'PrismCrystal';
  const group = new THREE.Group(); group.add(art.root, crystal);
  return { group, art, crystal };
}
const crystalMats = new Map<string, THREE.MeshStandardMaterial>();
export function crystalMaterial(lit: boolean) {
  const key = lit ? 'lit' : 'dim';
  let m = crystalMats.get(key);
  if (!m) { m = new THREE.MeshStandardMaterial({ color: lit ? '#fff2b8' : '#a9e7ff', emissive: lit ? '#ffc94a' : '#3b8fb5', emissiveIntensity: lit ? 2.2 : .55, roughness: .2, metalness: .1, flatShading: true }); crystalMats.set(key, m); }
  return m;
}
export function sunSource(f: Frame) {
  f.box([0, .2, 0], [1.8, .4, 1.8], STONE_DARK, 'body', [0, 0, 0], true);
  f.taper([0, 1.9, 0], .62, .38, 3.0, STONE, 'body', 4, true);
  f.cone([0, 3.6, 0], .4, .4, STONE_DARK, 'body', 4);
  for (const y of [.9, 1.7, 2.5]) f.box([0, y, .47 - (y - .9) * .06], [.3, .3, .02], RUNE, 'glow');
  f.torus([0, 3.25, 0], .56, .05, BRONZE, 'metal', [0, 0, 0]);
  f.cyl([0, 3.25, 0], .4, .08, '#ffd66b', 'glow', 20, [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; f.box([Math.cos(a) * .72, 3.25 + Math.sin(a) * .72, 0], [.2, .05, .04], '#ffcf5a', 'glow', [0, 0, a]); }
}
/** The source lens points along local +x like the prisms. */
export function sunLens(f: Frame) {
  f.cyl([.5, 1.6, 0], .14, .5, BRONZE, 'metal', 12, [0, 0, Math.PI / 2]);
  f.cyl([.78, 1.6, 0], .17, .06, '#fff3c4', 'glow', 12, [0, 0, Math.PI / 2]);
}
export function receiverBase(f: Frame) {
  f.cyl([0, .15, 0], 1.1, .3, STONE_DARK, 'body', 8, [0, 0, 0], true);
  f.cyl([0, .55, 0], .7, .5, STONE, 'body', 8, [0, Math.PI / 8, 0], true);
  for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; f.box([Math.cos(a) * .55, 1.3, Math.sin(a) * .55], [.07, 1.1, .07], BRONZE, 'metal', [Math.sin(a) * .25, 0, -Math.cos(a) * .25]); }
  f.torus([0, 1.85, 0], .78, .04, BRONZE, 'metal', [Math.PI / 2, 0, 0]);
  f.torus([0, .82, 0], .66, .03, RUNE, 'glow', [Math.PI / 2, 0, 0]);
}
export function receiverCrystal(): THREE.Group {
  const g = new THREE.Group();
  for (const [x, y, z, s, rz] of [[0, 1.55, 0, .42, 0], [.22, 1.25, .1, .22, .5], [-.2, 1.28, -.08, .2, -.45]] as const) {
    const m = new THREE.Mesh(G.octa, crystalMaterial(false)); m.scale.set(s * .6, s, s * .6); m.position.set(x, y, z); m.rotation.z = rz; g.add(m);
  }
  return g;
}
export function blockerPillar(f: Frame, r: number, h: number) {
  let y = 0;
  for (let i = 0; i < 4; i++) {
    const seg = h / 4, w = r * (1.05 - i * .06);
    f.cyl([0, y + seg / 2, 0], w, seg * .96, i % 2 ? STONE : STONE_DARK, 'body', 8, [0, i * .4, (i - 1.5) * .03], true);
    y += seg;
  }
  f.cyl([0, h + .1, 0], r * .9, .2, '#5d6b4b', 'body', 8);
}
export function ruinTower(f: Frame, h: number) {
  f.cyl([0, h / 2, 0], 2.3, h, STONE_DARK, 'body', 8, [0, 0, 0], true);
  for (let i = 1; i < Math.floor(h / 1.6); i++) f.cyl([0, i * 1.6, 0], 2.34, .08, '#857e70', 'body', 8);
  f.cyl([0, h - .1, 0], 2.55, .25, STONE, 'body', 8, [0, 0, 0], true);
  for (let i = 0; i < 8; i++) { if (i === 3) continue; const a = i * Math.PI / 4 + Math.PI / 8; f.box([Math.cos(a) * 2.3, h + .35, Math.sin(a) * 2.3], [.7, .7 - (i % 3) * .15, .45], STONE, 'body', [0, -a, 0]); }
  // ivy and cracks
  for (let i = 0; i < 6; i++) { const a = i * 1.1; f.box([Math.cos(a) * 2.31, h * .3 + i * .9, Math.sin(a) * 2.31], [.5, .9, .04], '#4f6b3c', 'body', [0, -a + Math.PI / 2, 0]); }
}
export function waterPlatform(f: Frame, top: number, bottom: number, r = 2.6) {
  const h = top - bottom;
  f.cyl([0, bottom + h / 2, 0], r, h, STONE_DARK, 'body', 8, [0, 0, 0], true);
  f.cyl([0, top - .08, 0], r + .15, .16, STONE, 'body', 8, [0, Math.PI / 8, 0], true);
  f.torus([0, top - .2, 0], r + .06, .05, '#6f8f5a', 'body', [Math.PI / 2, 0, 0]);
}
export function steppingStone(f: Frame, top: number, bottom: number, r = 1.05) {
  const h = top - bottom;
  f.cyl([0, bottom + h / 2, 0], r, h, STONE_DARK, 'body', 8, [0, .3, 0], true);
  f.cyl([0, top - .05, 0], r * .95, .1, '#a7a28f', 'body', 8, [0, .7, 0]);
}

// ─────────────────────────────────────────── statue ───────────────────────────────────────────
export function haloStatue(f: Frame) {
  const marble = '#e6e0d2', shade = '#bdb5a2', gold = '#e9c063';
  f.box([0, .2, 0], [4.2, .4, 4.2], '#8f8878', 'body', [0, 0, 0], true);
  f.box([0, .6, 0], [3.4, .4, 3.4], '#a59e8d', 'body', [0, 0, 0], true);
  f.cyl([0, 1.2, 0], 1.25, .8, '#b8b19f', 'body', 8, [0, Math.PI / 8, 0], true);
  f.torus([0, 1.2, 0], 1.27, .05, gold, 'metal', [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; f.box([Math.cos(a) * 1.22, 1.2, Math.sin(a) * 1.22], [.1, .5, .04], '#9fe8ff', 'glow', [0, Math.PI / 2 - a, 0]); }
  // robed figure (lathe), hood, face, raised arms holding the sun ring
  f.lathe([[0, 0], [.72, 0], [.68, .4], [.58, 1.1], [.46, 1.8], [.4, 2.25], [.3, 2.5], [0, 2.56]], [0, 1.6, 0], marble, 'body', 16, true);
  for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; f.box([Math.cos(a) * .6, 2.2, Math.sin(a) * .6], [.06, 1.2, .06], shade, 'body', [Math.sin(a) * .12, 0, -Math.cos(a) * .12]); }
  f.sphere([0, 4.35, .05], [.26, .3, .26], marble);
  f.lathe([[.0, .0], [.34, .02], [.36, .22], [.3, .46], [.14, .62], [0, .66]], [0, 4.1, -.04], shade, 'body', 14);
  for (const x of [-1, 1]) {
    f.box([x * .42, 4.05, .05], [.18, .7, .2], marble, 'body', [0, 0, x * .5]);
    f.box([x * .5, 4.65, .05], [.15, .6, .17], marble, 'body', [0, 0, -x * .15]);
    f.sphere([x * .46, 5.0, .05], [.1, .1, .1], marble);
  }
  f.torus([0, 5.35, .05], .48, .07, gold, 'metal', [0, 0, 0]);
  f.cyl([0, 5.35, .05], .32, .06, '#fff1b0', 'glow', 20, [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8; f.box([Math.cos(a) * .7, 5.35 + Math.sin(a) * .7, .05], [i % 2 ? .22 : .34, .05, .03], '#ffd875', 'glow', [0, 0, a]); }
  f.torus([0, 4.4, -.45], .75, .03, gold, 'glow', [0, 0, 0]);
  // offering bowl in front
  f.cyl([0, 1.75, 1.45], .1, .3, '#a59e8d', 'body', 8);
  f.lathe([[0, 0], [.32, .02], [.42, .18], [.38, .2], [0, .06]], [0, 1.9, 1.45], gold, 'metal', 14);
  f.cyl([0, 2.02, 1.45], .28, .03, '#bff3ff', 'glow', 12);
}

// ─────────────────────────────────────────── trial stele ───────────────────────────────────────────
export function trialStele(f: Frame) {
  f.box([0, .15, 0], [2.4, .3, 1.4], '#7c7568', 'body', [0, 0, 0], true);
  f.box([0, 1.5, 0], [1.6, 2.4, .42], '#a19a89', 'body', [0, 0, 0], true);
  f.cone([0, 3.0, 0], 1.14, .6, '#8d8676', 'body', 4, [0, Math.PI / 4, 0]);
  f.box([0, 1.5, .22], [1.3, 2.0, .02], '#6f695d');
  // hourglass rune
  f.cone([0, 1.85, .24], .32, .45, '#9ff0ff', 'glow', 4, [Math.PI, 0, 0]);
  f.cone([0, 1.15, .24], .32, .45, '#9ff0ff', 'glow', 4);
  f.box([0, 2.25, .24], [.7, .05, .02], '#9ff0ff', 'glow'); f.box([0, .75, .24], [.7, .05, .02], '#9ff0ff', 'glow');
  for (const x of [-1, 1]) { f.box([x * .95, 1.0, 0], [.28, 2.0, .6], '#8d8676', 'body', [0, 0, x * .06], true); f.gem([x * .95, 2.2, 0], .14, '#9ff0ff'); }
}

// ─────────────────────────────────────────── enemy camp ───────────────────────────────────────────
export function campProps(f: Frame, seed: number, region: RegionId = 'britain') {
  const t = SITE_THEMES[region], wood = t.wood, dark = '#3f2c1c', cloth = t.cloth[seed % 3], banner = t.banner[seed % 3];
  // palisade ring with four openings
  const R = 13;
  for (let i = 0; i < 72; i++) {
    const a = i / 72 * Math.PI * 2;
    if (i % 18 >= 15) continue;
    const h = 2.0 + ((i * 37) % 7) * .1, x = Math.cos(a) * R, z = Math.sin(a) * R;
    f.cyl([x, h / 2 - .2, z], .16, h, wood, 'body', 8, [((i * 13) % 5 - 2) * .02, 0, ((i * 7) % 5 - 2) * .02], true);
    f.cone([x, h - .05, z], .16, .4, dark, 'body', 8);
  }
  for (let i = 0; i < 4; i++) { const a0 = i * Math.PI / 2 + .1; for (const t of [.6, 1.25]) { const a = a0 + t * .55; f.box([Math.cos(a) * R, .9 + t * .25, Math.sin(a) * R], [.12, .12, 2.6], dark, 'body', [0, -a, 0]); } }
  // tents
  // tents sit on the outer ring: their inner edge stays beyond 9 m so every spawn socket (≤ 7.6 m) keeps its 1.5 m footing
  for (const [a, s] of [[.8, 1], [2.6, .9], [4.4, 1.05]] as const) {
    const x = Math.cos(a) * 10.9, z = Math.sin(a) * 10.9;
    f.cone([x, 1.25 * s, z], 1.75 * s, 2.5 * s, cloth, 'body', 4, [0, a, 0], true);
    if (t.snow) f.cone([x, 1.9 * s, z], .93 * s, 1.32 * s, '#f4f8fc', 'body', 4, [0, a, 0]);
    f.cyl([x, 1.5 * s, z], .06, 3.1 * s, dark, 'body', 8);
    f.box([x + Math.cos(a) * -1.5 * s, .6, z + Math.sin(a) * -1.5 * s], [.05, 1.2, .05], dark);
  }
  // campfire, weapon rack and crates sit on the outer ring so enemy spawn sockets (≤ 7.5 m) stay clear
  const ring = (a: number, r: number): [number, number] => [Math.cos(a) * r, Math.sin(a) * r];
  const [fx, fz] = ring(5.6, 10.2);
  for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; f.sphere([Math.cos(a) * .7 + fx, .12, Math.sin(a) * .7 + fz], [.22, .14, .2], '#77736c'); }
  for (let i = 0; i < 4; i++) f.box([fx, .2, fz], [.14, .14, 1.1], dark, 'body', [0, i * .8, .3]);
  f.cone([fx, .55, fz], .35, .8, '#ff9a3c', 'glow', 8);
  // banners
  for (const a of [Math.PI * .25, Math.PI * 1.25]) {
    const x = Math.cos(a) * 11.4, z = Math.sin(a) * 11.4;
    f.cyl([x, 2.4, z], .07, 4.8, dark, 'body', 8, [0, 0, 0], true);
    f.box([x + .6, 3.7, z], [1.1, 1.8, .05], banner, 'body', [0, -a, 0]);
    f.box([x + .6, 4.45, z], [1.15, .1, .07], '#b9963e', 'metal', [0, -a, 0]);
  }
  const [rx, rz] = ring(1.75, 10.6);
  f.box([rx, .9, rz], [2.2, .1, .1], dark, 'body', [0, -1.75 + Math.PI / 2, 0]);
  for (const d of [-1, 1]) f.box([rx + Math.sin(1.75) * d, .5, rz - Math.cos(1.75) * d], [.1, 1, .1], dark);
  for (let i = 0; i < 4; i++) { const t = (i - 1.5) * .45; f.box([rx + Math.sin(1.75) * t, .85, rz - Math.cos(1.75) * t], [.05, 1.6, .05], '#8a8d92', 'metal', [.25, 0, 0]); }
  if (region === 'blacksail') for (const [a, r] of [[3.0, 10.6], [3.12, 11.4], [2.9, 11.5]] as const) { const [x, z] = ring(a, r); f.cyl([x, .5, z], .42, 1.0, '#6a4a2c', 'body', 12, [0, 0, 0], true); for (const y of [.18, .82]) f.torus([x, y, z], .43, .03, '#3a3a3a', 'metal', [Math.PI / 2, 0, 0]); }
  if (region === 'kyoto') for (const a of [Math.PI * .25, Math.PI * 1.25]) { const [x, z] = ring(a + .25, 11.6); f.sphere([x, 1.9, z], [.3, .42, .3], '#ffcf8a', 'glow'); f.cyl([x, .95, z], .06, 1.5, dark, 'body', 8); }
  for (const [a, r, s] of [[3.5, 10.4, 1], [3.62, 11.2, .8], [3.38, 11.0, .6]] as const) { const [x, z] = ring(a, r); f.box([x, s / 2, z], [s, s, s], '#8a6a42', 'body', [0, x, 0], true); f.box([x, s / 2, z], [s + .02, .08, s + .02], dark, 'body', [0, x, 0]); }
}

// ─────────────────────────────────────────── dynamic bits ───────────────────────────────────────────
let glintTexture: THREE.CanvasTexture | null = null;
export function glintMap() {
  if (glintTexture) return glintTexture;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  if (g) {
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.25, 'rgba(255,240,190,.75)'); r.addColorStop(1, 'rgba(255,220,140,0)');
    g.fillStyle = r; g.fillRect(0, 0, 64, 64); g.fillStyle = 'rgba(255,255,255,.9)'; g.fillRect(30, 4, 4, 56); g.fillRect(4, 30, 56, 4);
  }
  glintTexture = new THREE.CanvasTexture(c); glintTexture.colorSpace = THREE.SRGBColorSpace; return glintTexture;
}
export function glint(color = '#ffe9a8', size = .9) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glintMap(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.setScalar(size); return s;
}
export const FX = {
  featherMat: new THREE.MeshStandardMaterial({ color: '#ffe7a3', emissive: '#ffb93a', emissiveIntensity: 1.6, roughness: .35, side: THREE.DoubleSide }),
  quillMat: new THREE.MeshStandardMaterial({ color: '#fff7dd', emissive: '#ffe2a0', emissiveIntensity: .8 }),
  shaftMat: new THREE.MeshBasicMaterial({ color: '#ffd77a', transparent: true, opacity: .16, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
  beamCore: new THREE.MeshBasicMaterial({ color: '#fff6d2', transparent: true, opacity: .95, depthWrite: false, blending: THREE.AdditiveBlending }),
  beamGlow: new THREE.MeshBasicMaterial({ color: '#ffbf3d', transparent: true, opacity: .32, depthWrite: false, blending: THREE.AdditiveBlending }),
  orbMat: new THREE.MeshStandardMaterial({ color: '#c9f6ff', emissive: '#59d8ff', emissiveIntensity: 2.2, roughness: .2 }),
  ringMat: new THREE.MeshBasicMaterial({ color: '#8ee9ff', transparent: true, opacity: .7, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
  sealMat: new THREE.MeshBasicMaterial({ color: '#b48cff', transparent: true, opacity: .22, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
  pillarMat: new THREE.MeshBasicMaterial({ color: '#ffe6a0', transparent: true, opacity: .25, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
};
const featherGeo = (() => {
  // a curved vane: lathe a half-leaf profile, then flatten
  const pts = [] as THREE.Vector2[]; for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(new THREE.Vector2(Math.sin(t * Math.PI) * .16 * (1 - t * .35), t * .9)); }
  const g = new THREE.LatheGeometry(pts, 10); g.scale(1, 1, .18); g.translate(0, -.45, 0); return g;
})();
export function featherMesh(): THREE.Group {
  const g = new THREE.Group();
  const a = new THREE.Mesh(featherGeo, FX.featherMat); a.rotation.z = .35; a.position.x = -.08;
  const b = new THREE.Mesh(featherGeo, FX.featherMat); b.rotation.z = -.35; b.position.x = .08; b.scale.setScalar(.85);
  const quill = new THREE.Mesh(G.cyl8, FX.quillMat); quill.scale.set(.018, .95, .018);
  const halo = glint('#ffd36b', 1.6);
  const shaft = new THREE.Mesh(G.cyl8, FX.shaftMat); shaft.scale.set(.22, 40, .22); shaft.position.y = 20; shaft.name = 'FeatherShaft';
  g.add(a, b, quill, halo, shaft); return g;
}
export function orbMesh(): THREE.Group {
  const g = new THREE.Group();
  const core = new THREE.Mesh(G.sphere, FX.orbMat); core.scale.setScalar(.3);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.75, .045, 6, 28), FX.ringMat); ring.name = 'OrbRing';
  g.add(core, ring, glint('#9feaff', 1.4)); return g;
}
export function sealDome(r = 1.1): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), FX.sealMat); m.name = 'ChestSeal'; return m;
}
export function lightPillar(): THREE.Mesh { const m = new THREE.Mesh(G.cyl12, FX.pillarMat); m.scale.set(.6, 30, .6); m.position.y = 15; return m; }
/** Beam path as merged thin cylinders (core + glow). */
export function beamGeometry(points: THREE.Vector3[], radius: number): THREE.BufferGeometry | null {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], d = b.clone().sub(a), len = d.length(); if (len < .01) continue;
    const g = new THREE.CylinderGeometry(radius, radius, len, 8, 1, true).toNonIndexed();
    g.applyMatrix4(new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()), new THREE.Vector3(1, 1, 1)));
    parts.push(g);
  }
  if (!parts.length) return null;
  let count = 0; for (const p of parts) count += p.attributes.position.count;
  const pos = new Float32Array(count * 3); let o = 0;
  for (const p of parts) { pos.set(p.attributes.position.array as Float32Array, o); o += p.attributes.position.array.length; p.dispose(); }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); return out;
}

// ─────────────────────────────────────────── domain ruin ───────────────────────────────────────────
/** 秘境 floor, broken cloister colonnade, arches and the central sword monument (a beam blocker). */
/** Per-era palette so camps and domains read as part of their chapter rather than one generic kit. */
export interface SiteTheme { readonly earth: string; readonly stone: string; readonly dark: string; readonly trim: string; readonly moss: string; readonly wood: string; readonly cloth: readonly string[]; readonly banner: readonly string[]; readonly snow?: boolean }
export const SITE_THEMES: Record<RegionId, SiteTheme> = {
  alpha: { earth: '#7d8a5c', stone: '#c4c0b4', dark: '#8e8a80', trim: '#e3dccb', moss: '#5f7a4a', wood: '#6b4b2f', cloth: ['#3c4a6a', '#5d6b86', '#45566e'], banner: ['#2a3a5a', '#d9b25a', '#2a2a36'] },
  britain: { earth: '#7d8a5c', stone: '#b9b2a0', dark: '#8a8373', trim: '#d7cfb8', moss: '#5f7a4a', wood: '#6b4b2f', cloth: ['#5b2f3b', '#3c4a6a', '#6a5a3a'], banner: ['#3c1f3a', '#7a1f1f', '#2a2a36'] },
  blacksail: { earth: '#b9a57a', stone: '#a79c86', dark: '#6f6656', trim: '#cbbf9f', moss: '#4f6e5e', wood: '#5a3d26', cloth: ['#d8ccb0', '#8a3b2c', '#3a3a3a'], banner: ['#151515', '#151515', '#6b1a1a'] },
  winter: { earth: '#dfe6ee', stone: '#aeb6c2', dark: '#7d8696', trim: '#e6edf5', moss: '#9fb3c4', wood: '#4f3a2a', cloth: ['#e9e4d8', '#5a6a4a', '#3d4f6b'], banner: ['#1f3a6b', '#7a1f1f', '#e9e4d8'], snow: true },
  kyoto: { earth: '#8a7a5a', stone: '#a9a497', dark: '#6c6a62', trim: '#cfc8b5', moss: '#566f3f', wood: '#4a3424', cloth: ['#e7dfcf', '#2f3f5a', '#6b2a2a'], banner: ['#b7322a', '#f1ece0', '#2f3f5a'] },
};

export function domainRuin(f: Frame, radius: number, region: RegionId = 'britain') {
  const t = SITE_THEMES[region], stone = t.stone, dark = t.dark, moss = t.moss, gold = '#d9b25a';
  // two-step round floor with inlaid rings and radial joints, on an embankment in the era's ground colour
  f.taper([0, -.8, 0], radius + 6.5, radius + 1.2, 2.0, t.earth, 'body', 24, true);
  f.cyl([0, .06, 0], radius + 1.2, .3, dark, 'body', 20, [0, 0, 0], true);
  f.cyl([0, .2, 0], radius, .16, stone, 'body', 20, [0, 0, 0], true);
  for (const r of [radius * .38, radius * .74]) f.torus([0, .29, 0], r, .07, t.trim, 'body', [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8; f.box([Math.cos(a) * radius * .56, .285, Math.sin(a) * radius * .56], [radius * .86, .012, .07], dark, 'body', [0, -a, 0]); }
  f.torus([0, .3, 0], radius * .2, .06, gold, 'glow', [Math.PI / 2, 0, 0]);
  // colonnade: 20 columns, a few broken, gaps at north/south entrances (kyoto: lacquered posts with a beam ring)
  const n = 20, kyoto = region === 'kyoto';
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2; if (i === 5 || i === 15) continue;
    const x = Math.cos(a) * (radius - .6), z = Math.sin(a) * (radius - .6), broken = (i * 7) % 5 === 0, h = broken ? 2.2 + (i % 3) * .6 : 5.4;
    f.cyl([x, .55, z], .62, .5, dark, 'body', 8, [0, 0, 0], true);
    if (kyoto) {
      f.cyl([x, .3 + h / 2 + .5, z], .3, h, broken ? '#6a3a2a' : '#a8352a', 'body', 12, [0, 0, 0], true);
      f.cyl([x, 1.05, z], .36, .3, '#2a2522', 'metal', 12);
    } else {
      f.cyl([x, .3 + h / 2 + .5, z], .42, h, stone, 'body', 12, [0, 0, 0], true);
      for (let k = 0; k < 6; k++) { const b = k / 6 * Math.PI * 2; f.box([x + Math.cos(b) * .41, .8 + h / 2, z + Math.sin(b) * .41], [.06, h - .3, .06], dark, 'body', [0, -b, 0]); }
    }
    if (!broken) {
      f.box([x, h + 1.0, z], [1.1, .28, 1.1], kyoto ? '#2a2522' : dark, 'body', [0, -a, 0], true);
      const next = (i + 1) / n * Math.PI * 2, x2 = Math.cos(next) * (radius - .6), z2 = Math.sin(next) * (radius - .6);
      if ((i + 1) % n !== 5 && (i + 1) % n !== 15 && (i * 7 + 7) % 5 !== 0) f.box([(x + x2) / 2, h + 1.32, (z + z2) / 2], [.6, .36, Math.hypot(x2 - x, z2 - z) + .9], kyoto ? '#a8352a' : stone, 'body', [0, -Math.atan2(z2 - z, x2 - x) + Math.PI / 2, 0]);
      if (t.snow) f.box([x, h + 1.2, z], [1.2, .14, 1.2], '#f4f8fc', 'body', [0, -a, 0]);
    } else {
      f.box([x + 1.6, .55, z + .4], [.8, .8, 2.2], stone, 'body', [.2, a, .4]);
      if (t.snow) f.sphere([x, .3 + h + .5, z], [.5, .18, .5], '#f4f8fc');
    }
    if (i % 3 === 0) f.box([x, 1.5, z], [.9, 1.6, .05], moss, 'body', [0, -a + Math.PI / 2, 0]);
    if (t.snow && i % 2 === 0) for (let k = 0; k < 3; k++) f.cone([x + Math.cos(a) * .44, h - .2 - k * .9, z + Math.sin(a) * .44], .07, .6 - k * .12, '#cfeaff', 'glow', 4, [Math.PI, 0, 0]);
  }
  // entrances (north and south): stone arches, a torii in Kyoto
  for (const a of [Math.PI / 2, -Math.PI / 2]) {
    const x = Math.cos(a) * (radius - .4), z = Math.sin(a) * (radius - .4);
    if (kyoto) {
      for (const s of [-1, 1]) { f.cyl([x + s * 2.5, 3.4, z], .3, 6.8, '#c23b2c', 'body', 12, [0, 0, 0], true); f.cyl([x + s * 2.5, .35, z], .42, .7, '#2a2522', 'metal', 12); }
      f.box([x, 5.6, z], [6.0, .3, .4], '#c23b2c'); f.box([x, 6.9, z], [7.4, .42, .6], '#2a2522', 'body', [0, 0, 0], true);
      f.box([x, 7.2, z], [7.8, .16, .7], '#2a2522'); f.box([x, 6.2, z], [.4, 1.1, .3], '#c23b2c');
      f.box([x, 6.2, z + Math.sign(z) * .17], [.3, .8, .02], '#f1ece0', 'glow');
      continue;
    }
    for (const s of [-1, 1]) f.box([x + s * 2.4, 3.3, z], [.9, 6.6, 1.2], stone, 'body', [0, 0, 0], true);
    f.box([x, 6.9, z], [6.0, .9, 1.3], dark, 'body', [0, 0, 0], true);
    f.torus([x, 6.0, z], 1.9, .22, stone, 'body', [0, 0, 0], Math.PI);
    if (t.snow) f.box([x, 7.42, z], [6.2, .16, 1.45], '#f4f8fc');
    f.gem([x, 7.6, z], .3, region === 'blacksail' ? '#7fffd4' : '#ffe39a');
  }
  // central monument on a two-step plinth
  f.cyl([0, .7, 0], 2.6, .8, dark, 'body', 8, [0, Math.PI / 8, 0], true);
  f.cyl([0, 1.5, 0], 2.0, .8, stone, 'body', 8, [0, 0, 0], true);
  f.box([0, 2.6, 0], [2.4, 1.4, 2.4], t.trim, 'body', [0, Math.PI / 4, 0], true);
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; f.box([Math.cos(a) * 1.22, 2.6, Math.sin(a) * 1.22], [.5, .8, .02], '#9ff0ff', 'glow', [0, -a + Math.PI / 2, 0]); }
  if (region === 'blacksail') anchorMonument(f, gold);
  else if (region === 'winter') bellMonument(f, gold);
  else if (kyoto) lanternMonument(f);
  else swordMonument(f, gold);
  // braziers at the four diagonals (Kyoto: hanging paper lanterns on posts)
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4, x = Math.cos(a) * radius * .55, z = Math.sin(a) * radius * .55;
    if (kyoto) {
      f.cyl([x, 1.5, z], .1, 3, '#2a2522', 'body', 8); f.box([x, 2.95, z], [.9, .08, .08], '#2a2522');
      f.sphere([x + .35, 2.35, z], [.32, .45, .32], '#ffcf8a', 'glow'); f.cyl([x + .35, 2.83, z], .18, .1, '#2a2522', 'metal', 8); f.cyl([x + .35, 1.88, z], .18, .1, '#2a2522', 'metal', 8);
      continue;
    }
    f.cyl([x, .9, z], .16, 1.4, '#4b4a46', 'metal', 8);
    f.lathe([[0, 0], [.45, .05], [.6, .35], [.55, .4], [0, .1]], [x, 1.6, z], '#5a5853', 'metal', 12);
    f.cone([x, 2.2, z], .32, .8, t.snow ? '#9fe0ff' : '#ffb347', 'glow', 8);
  }
}

function swordMonument(f: Frame, gold: string) {
  f.box([0, 5.6, 0], [.34, 4.8, .07], '#dfe6ee', 'metal');
  f.box([0, 5.6, 0], [.06, 4.6, .09], '#aeb8c4', 'metal');
  f.box([0, 3.45, 0], [1.6, .2, .24], gold, 'metal');
  f.cyl([0, 2.95, 0], .09, .8, '#5a3b26', 'body', 8);
  f.sphere([0, 2.5, 0], [.16, .16, .16], gold, 'metal');
  f.gem([0, 3.45, .14], .1, '#7fd8ff');
}

/** Blackbeard's sunken-vault anchor driven into the plinth, chain coiled around it, spilled coins. */
function anchorMonument(f: Frame, gold: string) {
  const iron = '#3f4447', rust = '#6b4a35';
  f.box([0, 5.4, 0], [.42, 5.2, .42], iron, 'metal');
  f.box([0, 7.4, 0], [2.0, .3, .34], rust, 'body');
  f.torus([0, 8.35, 0], .5, .12, iron, 'metal', [0, 0, 0]);
  f.torus([0, 4.2, 0], 1.75, .2, iron, 'metal', [0, 0, Math.PI], Math.PI);
  for (const s of [-1, 1]) { f.cone([s * 1.75, 4.45, 0], .38, .9, iron, 'metal', 4, [0, 0, s * .5]); f.box([s * 1.65, 4.05, 0], [.5, .5, .2], iron, 'metal', [0, 0, s * .7]); }
  for (let i = 0; i < 14; i++) { const a = i * .9, y = 3.4 + i * .28; f.torus([Math.cos(a) * .4, y, Math.sin(a) * .4], .14, .04, '#5d6366', 'metal', [Math.PI / 2, a, 0]); }
  for (let i = 0; i < 12; i++) { const a = i * 2.4, r = 1.3 + (i % 3) * .25; f.cyl([Math.cos(a) * r, 3.36, Math.sin(a) * r], .14, .04, gold, 'metal', 8, [(i % 4) * .2, 0, 0]); }
  f.gem([0, 8.35, 0], .22, '#7fffd4');
}

/** A cracked bronze bell hung in an iced frame: the chapel stopped ringing in 1812. */
function bellMonument(f: Frame, gold: string) {
  const bronze = '#8a6a3a', ice = '#cfeaff';
  for (const s of [-1, 1]) f.box([s * 1.5, 5.4, 0], [.3, 5.2, .3], '#4f3a2a');
  f.box([0, 8.0, 0], [3.6, .34, .44], '#4f3a2a'); f.box([0, 8.25, 0], [3.8, .16, .6], '#f4f8fc');
  f.lathe([[0, 0], [.95, 0], [.9, .25], [.72, .9], [.62, 1.6], [.36, 1.95], [0, 2.0]], [0, 5.3, 0], bronze, 'metal', 16);
  f.torus([0, 5.42, 0], .9, .06, gold, 'metal', [Math.PI / 2, 0, 0]);
  f.sphere([0, 5.15, 0], [.18, .18, .18], '#4a3a22', 'metal');
  f.box([.2, 6.0, .7], [.05, 1.1, .05], '#2b2318', 'body', [0, 0, .3]);
  for (let i = 0; i < 9; i++) { const a = i * 2.1, r = .9 + (i % 3) * .35, h = 1.0 + (i % 4) * .55; f.cone([Math.cos(a) * r, 3.3 + h / 2, Math.sin(a) * r], .18 + (i % 2) * .08, h, ice, 'glow', 4, [(i % 3 - 1) * .2, a, (i % 2 - .5) * .3]); }
}

/** Lotus Hall's great stone lantern (tōrō) with a lotus-petal cap. */
function lanternMonument(f: Frame) {
  const st = '#a9a497', dk = '#6c6a62';
  f.cyl([0, 4.3, 0], .38, 2.4, st, 'body', 8);
  f.cyl([0, 5.6, 0], 1.0, .3, dk, 'body', 8);
  f.box([0, 6.35, 0], [1.3, 1.2, 1.3], st);
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; f.box([Math.cos(a) * .62, 6.35, Math.sin(a) * .62], [.55, .6, .02], '#ffd28a', 'glow', [0, -a + Math.PI / 2, 0]); }
  f.cone([0, 7.45, 0], 1.45, 1.0, dk, 'body', 4, [0, Math.PI / 4, 0]);
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; f.box([Math.cos(a) * .45, 8.05, Math.sin(a) * .45], [.32, .5, .08], '#f2c6d6', 'glow', [.5, -a + Math.PI / 2, 0]); }
  f.sphere([0, 8.25, 0], [.22, .3, .22], st);
}

// ─────────────────────────────── regional signature mechanics ───────────────────────────────
/** 黑帆：a corked bottle washed up against a driftwood log, map rolled inside. */
export function messageBottle(f: Frame) {
  f.cyl([0, .22, .5], .2, 2.2, '#7a5a3a', 'body', 8, [0, 0, Math.PI / 2]);
  f.cyl([1.15, .22, .5], .21, .05, '#9b7a55', 'body', 8, [0, 0, Math.PI / 2]);
  f.box([-.4, .1, .9], [.5, .12, .18], '#6a4a2c', 'body', [0, .5, .2]);
  for (const [x, z, s] of [[-.6, -.3, .25], [.7, -.4, .18], [.2, .9, .14]] as const) f.sphere([x, s * .5, z], [s, s * .6, s * 1.2], '#cfc6b0');
}
export function bottleGlass(): THREE.Group {
  const g = new THREE.Group();
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(.11, .14, .42, 12), new THREE.MeshStandardMaterial({ color: '#8fd6c4', transparent: true, opacity: .55, roughness: .05, metalness: .1 }));
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(.045, .07, .14, 10), glass.material); neck.position.y = .27;
  const cork = new THREE.Mesh(new THREE.CylinderGeometry(.05, .045, .07, 8), new THREE.MeshStandardMaterial({ color: '#a9845a' })); cork.position.y = .37;
  const scroll = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, .3, 10), new THREE.MeshStandardMaterial({ color: '#efe1bd', emissive: '#6b5530', emissiveIntensity: .4 }));
  const s = glint('#fff1c0', .7); s.position.y = .5;
  g.add(glass, neck, cork, scroll, s); g.rotation.z = 1.25; return g;
}
/** Loose sand mound marking a dig site; only noticeable up close. */
export function digMound(f: Frame) {
  f.sphere([0, -.05, 0], [1.25, .28, 1.05], '#c8b383');
  for (let i = 0; i < 5; i++) { const a = i * 1.3; f.sphere([Math.cos(a) * 1.1, -.02, Math.sin(a) * .9], [.3, .12, .3], '#b39d6e'); }
  f.box([.95, .45, -.35], [.05, .9, .05], '#5a3d26', 'body', [.35, 0, -.3]);
  f.box([1.12, .02, -.52], [.22, .04, .3], '#6d6d6d', 'metal', [.35, 0, -.3]);
}
/** 永冬：a campfire brazier that never goes out (the ember source). */
export function emberBrazier(f: Frame) {
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; f.sphere([Math.cos(a) * .95, .14, Math.sin(a) * .95], [.26, .2, .24], '#6e6a64'); }
  for (let i = 0; i < 5; i++) f.box([0, .28, 0], [.16, .16, 1.4], '#3b2a1c', 'body', [0, i * .63, .25]);
  f.cyl([0, .05, 0], .85, .1, '#2b2724', 'body', 12);
  for (const [x, z] of [[-1.9, .4], [1.7, -.8]] as const) { f.box([x, .3, z], [.9, .6, .7], '#efeff2'); f.box([x, .62, z], [.95, .1, .75], '#ffffff'); }
  f.cyl([-1.5, .45, 1.3], .07, .9, '#4f3a2a', 'body', 8, [0, 0, .3]);
}
/** 永冬：a stone beacon with an iron fire-basket, frosted until kindled. */
export function emberBeacon(f: Frame) {
  f.cyl([0, .25, 0], .9, .5, '#7d8696', 'body', 8, [0, 0, 0], true);
  f.cyl([0, 1.6, 0], .42, 2.3, '#aeb6c2', 'body', 8, [0, Math.PI / 8, 0], true);
  f.box([0, 2.85, 0], [1.1, .22, 1.1], '#7d8696', 'body', [0, Math.PI / 4, 0]);
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; f.box([Math.cos(a) * .55, 3.35, Math.sin(a) * .55], [.06, .8, .06], '#2b2a2a', 'metal', [Math.sin(a) * .25, 0, -Math.cos(a) * .25]); }
  f.torus([0, 3.7, 0], .72, .05, '#2b2a2a', 'metal', [Math.PI / 2, 0, 0]);
  f.cyl([0, 3.0, 0], .42, .1, '#2b2a2a', 'metal', 8);
  f.box([0, .9, .43], [.5, .6, .04], '#1f3a6b', 'body');
  f.sphere([0, 3.0, 0], [.75, .12, .75], '#f4f8fc');
}
export function beaconFlame(): THREE.Group {
  const g = new THREE.Group();
  const flame = new THREE.Mesh(G.cone8, new THREE.MeshBasicMaterial({ color: '#ffb347', transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false }));
  flame.scale.set(.45, 1.2, .45); flame.position.y = .6; flame.name = 'Flame';
  const core = new THREE.Mesh(G.cone8, new THREE.MeshBasicMaterial({ color: '#fff1b0', transparent: true, opacity: .95, blending: THREE.AdditiveBlending, depthWrite: false }));
  core.scale.set(.22, .7, .22); core.position.y = .38;
  const s = glint('#ffb347', 2.6); s.position.y = .7;
  g.add(flame, core, s); return g;
}
export function emberCarry(): THREE.Group {
  const g = new THREE.Group();
  const core = new THREE.Mesh(G.sphere, new THREE.MeshBasicMaterial({ color: '#ffcf70' })); core.scale.setScalar(.12);
  g.add(core, glint('#ff9a3c', 1.1)); return g;
}
/** 京都：a fox shrine — two kitsune statues before a small vermilion torii. */
export function foxShrine(f: Frame) {
  f.box([0, .1, 0], [5.2, .2, 3.6], '#a9a497', 'body', [0, 0, 0], true);
  for (const s of [-1, 1]) {
    f.cyl([s * 1.25, 1.6, -1.2], .13, 3.2, '#c23b2c', 'body', 8); f.cyl([s * 1.25, .2, -1.2], .18, .3, '#2a2522', 'metal', 8);
    // kitsune on a plinth
    f.box([s * 1.9, .55, .9], [.8, .7, .8], '#8f8a7e');
    f.sphere([s * 1.9, 1.15, .9], [.3, .4, .26], '#e8e2d2');
    f.sphere([s * 1.9, 1.62, .98], [.2, .2, .2], '#e8e2d2');
    for (const e of [-1, 1]) f.cone([s * 1.9 + e * .1, 1.86, .98], .06, .2, '#e8e2d2', 'body', 4);
    f.box([s * 1.9, 1.38, 1.1], [.3, .12, .05], '#c23b2c');
    f.cone([s * 1.9 - s * .28, 1.0, .7], .1, .55, '#e8e2d2', 'body', 4, [-.6, 0, s * .5]);
  }
  f.box([0, 3.05, -1.2], [3.2, .14, .26], '#c23b2c'); f.box([0, 3.32, -1.2], [3.7, .2, .32], '#2a2522');
  f.box([0, .45, -1.4], [.9, .5, .6], '#6c6a62');
  f.gem([0, .9, -1.4], .14, '#9fe8ff');
}
/** 京都：a forgotten hokora deep in the bamboo. */
export function hokora(f: Frame) {
  f.box([0, .3, 0], [1.8, .6, 1.5], '#7f7a6e', 'body', [0, 0, 0], true);
  f.box([0, 1.1, 0], [1.1, 1.0, .9], '#5a3b26');
  f.box([0, 1.1, .46], [.6, .7, .02], '#f1ece0', 'glow');
  f.box([0, 1.75, 0], [1.6, .12, 1.4], '#2a2522', 'body', [0, 0, 0]);
  f.cone([0, 2.0, 0], 1.0, .5, '#3b3632', 'body', 4, [0, Math.PI / 4, 0]);
  for (const s of [-1, 1]) f.box([s * .6, .9, .9], [.12, 1.2, .12], '#c23b2c');
  f.box([0, 1.55, .9], [1.5, .1, .14], '#c23b2c');
  for (let i = 0; i < 9; i++) { const a = i * .7 + .3, r = 2.4 + (i % 3) * .6; f.cyl([Math.cos(a) * r, 3.5, Math.sin(a) * r], .07, 7, '#7a9a4a', 'body', 8); }
}
export function foxWisp(): THREE.Group {
  const g = new THREE.Group();
  const outer = new THREE.Mesh(G.sphere, new THREE.MeshBasicMaterial({ color: '#7fd8ff', transparent: true, opacity: .55, blending: THREE.AdditiveBlending, depthWrite: false })); outer.scale.setScalar(.45);
  const core = new THREE.Mesh(G.sphere, new THREE.MeshBasicMaterial({ color: '#fff4dc' })); core.scale.setScalar(.16);
  const tail = new THREE.Mesh(G.cone8, new THREE.MeshBasicMaterial({ color: '#ffb36b', transparent: true, opacity: .6, blending: THREE.AdditiveBlending, depthWrite: false }));
  tail.scale.set(.25, .9, .25); tail.rotation.x = -Math.PI / 2; tail.position.z = -.55; tail.name = 'Tail';
  g.add(outer, core, tail, glint('#9fe8ff', 2.2)); return g;
}
/** Build layered parts into their own small SiteArt so the result can move or hide (buried chests). */
export function dynamicArt(build: (f: Frame) => void): { group: THREE.Group; art: SiteArt } {
  const art = new SiteArt(); build(new Frame(art, [0, 0, 0])); art.finish('britain');
  const group = new THREE.Group(); group.add(art.root); return { group, art };
}
/** 落日王国：a tourney ring — trodden sand, a low stone kerb, pennant poles and the challenger's stake. */
export function duelRing(f: Frame, r: number, seed: number) {
  const colors = [['#2a3f7a', '#d9b25a'], ['#f1ece0', '#9b1c1c'], ['#1d4a2e', '#c9c9c9']][seed % 3];
  f.cyl([0, .03, 0], r, .06, '#b49a6a', 'body', 20);
  f.torus([0, .08, 0], r * .55, .04, '#9c8458', 'body', [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2; if (i % 10 === 0) continue; f.box([Math.cos(a) * (r + .3), .18, Math.sin(a) * (r + .3)], [1.45, .36, .5], i % 2 ? '#a39c89' : '#948d7a', 'body', [0, -a + Math.PI / 2, 0]); }
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2 + Math.PI / 8, x = Math.cos(a) * (r + 1.4), z = Math.sin(a) * (r + 1.4);
    f.cyl([x, 2.4, z], .07, 4.8, '#4a3424', 'body', 8); f.sphere([x, 4.85, z], [.12, .12, .12], '#d9b25a', 'metal');
    f.box([x + .5, 4.3, z], [1.0, .55, .03], colors[i % 2], 'body', [0, 0, 0]); f.cone([x + 1.15, 4.3, z], .28, .5, colors[i % 2], 'body', 4, [0, 0, -Math.PI / 2]);
  }
  // challenger's stake with a hanging shield, on the south edge
  f.cyl([0, 1.2, r + .9], .1, 2.4, '#4a3424', 'body', 8, [0, 0, 0], true);
  f.cyl([0, 1.55, r + .78], .42, .08, colors[0], 'body', 12, [Math.PI / 2, 0, 0]);
  f.torus([0, 1.55, r + .74], .42, .04, colors[1], 'metal', [0, 0, 0]);
  f.box([0, 1.55, r + .72], [.08, .6, .02], colors[1], 'metal'); f.box([0, 1.6, r + .72], [.5, .08, .02], colors[1], 'metal');
}

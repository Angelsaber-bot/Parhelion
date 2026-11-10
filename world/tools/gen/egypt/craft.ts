import * as THREE from 'three';
import { Batch, BOX, T } from '../geo';
import { Frame } from '../orleans/craft';
import { Shell } from '../qin/craft';

/** Egypt palette: bedded sandstone, limestone, mudbrick, painted plaster, gold and faience. */
export const E = {
  sand: '#d8b77a', sandstone: '#c99a5e', sandstoneDark: '#a9784a', limestone: '#e6d8b8', limestoneDark: '#cdbb94',
  brick: '#9a6f48', brickDark: '#7f5a3a', plaster: '#efe4c8', blue: '#2f5f8f', red: '#a8432f', green: '#4f8a5a', yellow: '#d8a94a',
  gold: '#dba93a', faience: '#3fa2a0', lapis: '#24477a', trunk: '#7a5c3c', leaf: '#5d8a3e', leafDark: '#4a7333', linen: '#ece2c6',
  wood: '#6b4a2f', black: '#2a2622', water: '#4c9fae', ember: '#ffb04a', light: '#fff1c4', reed: '#8a9a52',
};
export const EMAT = 'M_EgyptCraft';
export const CYL = new THREE.CylinderGeometry(1, 1, 1, 14), CYL8 = new THREE.CylinderGeometry(1, 1, 1, 8);
/** A leaf blade: widest a third of the way along, pointed at the tip (unit length on +Y). */
const FROND = (() => { const v = [0, -.5, 0, .5, -.15, 0, .3, .25, 0, 0, .5, 0, -.3, .25, 0, -.5, -.15, 0], idx = [0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 5]; const all = [...idx, ...idx.slice().reverse()]; const g = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.setIndex(all); return g; })();
type V = [number, number, number];

/** A battered block (walls lean inward as they rise): the basic Egyptian mass. */
export function batter(f: Frame, x: number, z: number, w: number, d: number, y0: number, h: number, lean: number, color: string, collide = true) {
  const sh = new Shell(f), bw = w / 2, bd = d / 2, tw = bw - lean * h, td = bd - lean * h, y1 = y0 + h;
  const B: V[] = [[x - bw, y0, z - bd], [x + bw, y0, z - bd], [x + bw, y0, z + bd], [x - bw, y0, z + bd]];
  const U: V[] = [[x - tw, y1, z - td], [x + tw, y1, z - td], [x + tw, y1, z + td], [x - tw, y1, z + td]];
  const hint: V[] = [[0, 0, -1], [1, 0, 0], [0, 0, 1], [-1, 0, 0]];
  for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; sh.quad(B[i], B[j], U[j], U[i], hint[i]); }
  sh.quad(U[0], U[1], U[2], U[3], [0, 1, 0]); sh.done(color, collide);
  return { tw, td, y1 };
}
/** 凹弧檐口: the flared cavetto cornice with its torus roll beneath, over a battered mass. */
export function cornice(f: Frame, x: number, z: number, w: number, d: number, y: number, color = E.limestone) {
  const sh = new Shell(f), steps = 4;
  for (let k = 0; k < steps; k++) {
    const a0 = k / steps, a1 = (k + 1) / steps, o0 = Math.sin(a0 * Math.PI / 2) * .9, o1 = Math.sin(a1 * Math.PI / 2) * .9, y0 = y + a0 * 1.1, y1 = y + a1 * 1.1;
    const P = (o: number, yy: number): V[] => [[x - w / 2 - o, yy, z - d / 2 - o], [x + w / 2 + o, yy, z - d / 2 - o], [x + w / 2 + o, yy, z + d / 2 + o], [x - w / 2 - o, yy, z + d / 2 + o]];
    const A = P(o0, y0), Bv = P(o1, y1), hint: V[] = [[0, -.3, -1], [1, -.3, 0], [0, -.3, 1], [-1, -.3, 0]];
    for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; sh.quad(A[i], A[j], Bv[j], Bv[i], hint[i]); }
  }
  const top = (o: number, yy: number): V[] => [[x - w / 2 - o, yy, z - d / 2 - o], [x + w / 2 + o, yy, z - d / 2 - o], [x + w / 2 + o, yy, z + d / 2 + o], [x - w / 2 - o, yy, z + d / 2 + o]];
  const T0 = top(.9, y + 1.1), T1 = top(.9, y + 1.45); const hint: V[] = [[0, 0, -1], [1, 0, 0], [0, 0, 1], [-1, 0, 0]];
  for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; sh.quad(T0[i], T0[j], T1[j], T1[i], hint[i]); }
  sh.quad(T1[0], T1[1], T1[2], T1[3], [0, 1, 0]); sh.done(color);
  // torus roll and a painted band of alternating palm-leaf colours under the lip
  for (const s of [-1, 1]) { f.beam([x - w / 2 - .05, y - .1, z + s * (d / 2 + .05)], [x + w / 2 + .05, y - .1, z + s * (d / 2 + .05)], .22, E.limestoneDark); f.beam([x + s * (w / 2 + .05), y - .1, z - d / 2], [x + s * (w / 2 + .05), y - .1, z + d / 2], .22, E.limestoneDark); }
  for (let i = 0; i < Math.floor(w / .5); i++) for (const s of [-1, 1]) f.box(x - w / 2 + .25 + i * .5, y + .35, z + s * (d / 2 + .3), .22, .5, .05, [E.blue, E.green, E.red][i % 3], false);
}

/** 塔门: a battered pylon tower with flagpole niches, relief panels and cornice. */
export function pylonTower(f: Frame, x: number, z: number, w: number, d: number, y: number, h: number, face = 1) {
  const { tw, td, y1 } = batter(f, x, z, w, d, y, h, .12, E.sandstone);
  cornice(f, x, z, tw * 2, td * 2, y1);
  // two flagpoles in niches on the front face with long streamers
  for (const k of [-1, 1]) {
    const px = x + k * w * .22, pz = z + face * (d / 2 + .4);
    f.box(px, y + h / 2, pz - face * .3, 1.1, h, .3, E.sandstoneDark, false);
    f.cyl(px, y + (h + 6) / 2, pz, .22, h + 6, E.wood, false);
    f.box(px + .9, y + h + 4.6, pz, 1.8, 2.8, .05, k > 0 ? E.red : E.blue, false);
  }
  // incised and painted relief panels: a king smiting, offerings, columns of glyphs
  const panelY = y + h * .45;
  f.box(x, panelY, z + face * (d / 2 - h * .12 * .45 + .05), w * .62, h * .5, .08, E.plaster, false);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 9; c++) if ((r * 7 + c * 3) % 5 !== 0) f.box(x - w * .27 + c * w * .068, panelY - h * .18 + r * h * .11, z + face * (d / 2 - h * .054 + .11), w * .05, h * .07, .04, [E.blue, E.red, E.yellow, E.green][(r + c) % 4], false);
  const fig = (ox: number, s: number) => { f.box(x + ox, panelY + h * .05, z + face * (d / 2 - h * .054 + .12), 1.1 * s, 4 * s, .05, E.red, false); f.box(x + ox, panelY + h * .2, z + face * (d / 2 - h * .054 + .13), .9 * s, 1.1 * s, .05, E.blue, false); };
  fig(-w * .12, 1.2); fig(w * .1, .9);
}

/** Papyrus column: bundled shaft, banded neck, open bell capital and abacus. */
export function papyrusColumn(f: Frame, x: number, z: number, y: number, h: number, r = .9, painted = true) {
  f.cyl(x, y + .25, z, r * 1.5, .5, E.limestoneDark);
  const shaftH = h - 2.4;
  f.cyl(x, y + .5 + shaftH / 2, z, r, shaftH, E.limestone);
  for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; f.cyl(x + Math.cos(a) * r * .92, y + .5 + shaftH / 2, z + Math.sin(a) * r * .92, r * .22, shaftH * .96, E.limestone, false); }
  for (let k = 0; k < 5; k++) f.cyl(x, y + .5 + shaftH - .2 - k * .22, z, r * 1.06, .12, painted ? [E.blue, E.yellow, E.red, E.green, E.blue][k] : E.limestoneDark, false);
  const p = f.point(x, y + .5 + shaftH + .8, z);
  f.b.add(new THREE.CylinderGeometry(r * 1.9, r * 1.05, 1.6, 16), E.limestone, T(p.x, p.y, p.z));
  if (painted) for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; f.box(x + Math.cos(a) * r * 1.55, y + .5 + shaftH + .85, z + Math.sin(a) * r * 1.55, .3, 1.2, .06, k % 2 ? E.green : E.blue, false, -a + Math.PI / 2); }
  f.box(x, y + h - .3, z, r * 2.1, .6, r * 2.1, E.limestoneDark);
}

/** Closed-bud lotus column for colonnades. */
export function lotusColumn(f: Frame, x: number, z: number, y: number, h: number, r = .7) {
  f.cyl(x, y + .2, z, r * 1.4, .4, E.limestoneDark);
  f.cyl(x, y + .4 + (h - 1.6) / 2, z, r, h - 1.6, E.sandstone);
  for (let k = 0; k < 3; k++) f.cyl(x, y + h - 1.4 + k * .16, z, r * 1.04, .1, [E.blue, E.red, E.blue][k], false);
  const p = f.point(x, y + h - .6, z); f.b.add(new THREE.SphereGeometry(r * 1.25, 12, 8), E.sandstone, T(p.x, p.y, p.z, 0, 1, .8, 1));
  f.box(x, y + h - .1, z, r * 1.8, .4, r * 1.8, E.sandstoneDark);
}

/** Obelisk: a tapering granite shaft with a gilded pyramidion on a stepped base. */
export function obelisk(b: Batch, x: number, y: number, z: number, h: number, yaw = 0) {
  const base = h * .09;
  b.add(BOX, E.limestoneDark, T(x, y + .4, z, yaw, base * 3, .8, base * 3));
  b.add(BOX, E.limestone, T(x, y + 1.1, z, yaw, base * 2.2, .6, base * 2.2));
  b.add(new THREE.CylinderGeometry(base * .55, base * .78, h, 4, 1), '#8f6f6a', T(x, y + 1.4 + h / 2, z, yaw + Math.PI / 4));
  b.add(new THREE.ConeGeometry(base * .55 * 1.0, base * 1.1, 4), E.gold, T(x, y + 1.4 + h + base * .55, z, yaw + Math.PI / 4), false);
  // three columns of small incised signs on the two faces toward the avenue
  for (let k = 0; k < 22; k++) for (const s of [-1, 1]) for (const c of [-1, 0, 1]) {
    const yy = 2.6 + k * h * .04, r = base * (.78 - (.23 * (yy - 1.4) / h)) + .01, off = c * r * .42;
    b.add(BOX, '#5e4640', T(x + Math.sin(yaw) * s * r + Math.cos(yaw) * off, y + yy, z + Math.cos(yaw) * s * r - Math.sin(yaw) * off, yaw, base * .16, h * .022, .02), false);
  }
}

/** A seated colossus (~18 m) on its throne block, nemes headdress, hands on knees. */
export function seatedColossus(b: Batch, x: number, y: number, z: number, yaw: number, s = 1) {
  const f = new Frame(b, x, y, z, yaw), st = E.sandstone, dk = E.sandstoneDark;
  f.box(0, 1 * s, -1 * s, 9 * s, 2 * s, 12 * s, E.limestoneDark);
  f.box(0, 5.5 * s, -3.2 * s, 8 * s, 7 * s, 6 * s, dk);
  for (const k of [-1, 1]) {
    f.box(k * 1.9 * s, 4.5 * s, 2.4 * s, 2.2 * s, 5 * s, 2.4 * s, st);           // shin
    f.box(k * 1.9 * s, 7.4 * s, .1 * s, 2.4 * s, 1.9 * s, 6.2 * s, st);          // thigh
    f.box(k * 1.9 * s, 2.2 * s, 3.4 * s, 2.2 * s, .6 * s, 3.2 * s, st);           // foot
    f.box(k * 3.1 * s, 10.6 * s, -.6 * s, 1.4 * s, 4.6 * s, 1.6 * s, st);       // upper arm
    f.box(k * 2.8 * s, 8.7 * s, 2 * s, 1.3 * s, 1 * s, 4.2 * s, st);              // forearm on thigh
    f.box(k * 2.8 * s, 8.9 * s, 3.9 * s, 1.3 * s, 1 * s, 1 * s, st);              // fist
  }
  f.box(0, 8.6 * s, .2 * s, 4.2 * s, 2.2 * s, 5.4 * s, E.linen);                 // kilt
  f.box(0, 8.6 * s, 2.95 * s, 1.4 * s, 2 * s, .2 * s, E.gold);
  const torso = f.point(0, 11.4 * s, -.8 * s); b.add(new THREE.CylinderGeometry(2.6 * s, 2 * s, 5.2 * s, 10), st, T(torso.x, torso.y, torso.z, yaw, 1, 1, .62));
  f.box(0, 13.6 * s, -.4 * s, 5.4 * s, .7 * s, 2.2 * s, E.faience);           // broad collar
  // head with the striped nemes and lappets, and the false beard
  const head = f.point(0, 15.4 * s, -.5 * s); b.add(new THREE.BoxGeometry(2.2 * s, 2.6 * s, 2.3 * s), st, T(head.x, head.y, head.z, yaw));
  const nemes = f.point(0, 16 * s, -.8 * s); b.add(new THREE.CylinderGeometry(1.2 * s, 2.3 * s, 2.6 * s, 4, 1), E.yellow, T(nemes.x, nemes.y, nemes.z, yaw + Math.PI / 4, 1, 1, .8));
  for (let k = 0; k < 6; k++) f.box(0, 15 * s + k * .38 * s, -1.6 * s, 3.6 * s - k * .35 * s, .14 * s, .1 * s, E.blue, false);
  for (const k of [-1, 1]) f.box(k * 1.45 * s, 13.6 * s, .3 * s, .9 * s, 3 * s, .5 * s, E.yellow);
  f.box(0, 13.4 * s, .9 * s, .6 * s, 1.6 * s, .5 * s, dk);
  f.box(0, 17.6 * s, -.4 * s, .5 * s, .6 * s, .5 * s, E.gold, false);           // uraeus
  for (const k of [-1, 1]) f.box(k * .5 * s, 15.6 * s, .66 * s, .4 * s, .14 * s, .06 * s, E.black, false);
  // a queen beside each leg, at knee height: the scale of the king made legible
  for (const k of [-1, 1]) { f.box(k * 4.4 * s, 3.6 * s, 2 * s, 1 * s, 3.6 * s, 1 * s, st); f.box(k * 4.4 * s, 6 * s, 2 * s, .8 * s, 1 * s, .8 * s, E.black); }
}

/** 羊首狮身像: a ram-headed sphinx couchant on its pedestal, a small king between its paws. */
export function criosphinx(b: Batch, x: number, y: number, z: number, yaw: number) {
  const f = new Frame(b, x, y, z, yaw);
  f.box(0, .5, 0, 2.6, 1, 6, E.limestoneDark);
  f.box(0, 1.6, -.6, 2, 1.4, 4, E.sandstone);
  for (const k of [-1, 1]) f.box(k * .65, 1.2, 2, .55, .55, 1.8, E.sandstone);
  f.box(0, 2.2, -1.4, 1.8, .8, 2.2, E.sandstone);
  const head = f.point(0, 2.9, 1.6); b.add(new THREE.SphereGeometry(.8, 10, 8), E.sandstone, T(head.x, head.y, head.z, yaw, .9, 1, 1.3));
  for (const k of [-1, 1]) { const h = f.point(k * .75, 2.95, 1.3); b.add(new THREE.TorusGeometry(.42, .14, 6, 12, Math.PI * 1.6), E.sandstoneDark, T(h.x, h.y, h.z, yaw + Math.PI / 2, 1, 1, 1, 0, 0), false); }
  f.box(0, 1.6, 2.6, .5, 1.2, .4, E.sandstoneDark);
  f.box(0, 3.4, 1.2, 1.5, .2, 1.4, E.yellow, false);
}

/** Date palm: a gently curved ringed trunk, drooping fronds and hanging date clusters. */
export function palm(trunks: Batch, leaves: Batch, x: number, y: number, z: number, h: number, lean: number, dir: number, seed: number) {
  let px = x, py = y, pz = z; const segs = 6;
  for (let i = 0; i < segs; i++) {
    const t = (i + 1) / segs, nx = x + Math.sin(dir) * lean * h * t * t, nz = z + Math.cos(dir) * lean * h * t * t, ny = y + h * t;
    const a = new THREE.Vector3(px, py, pz), c = new THREE.Vector3(nx, ny, nz), m = new THREE.Matrix4().compose(a.clone().add(c).multiplyScalar(.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), c.clone().sub(a).normalize()), new THREE.Vector3(.32 - i * .02, a.distanceTo(c), .32 - i * .02));
    trunks.add(CYL8, i % 2 ? E.trunk : '#6d5134', m); px = nx; py = ny; pz = nz;
  }
  // pinnate fronds: a rising inner half and a drooping, tapering outer half, each a
  // flattened leaf blade with a darker rib, in two tiers so the crown reads full
  for (let k = 0; k < 14; k++) {
    const a = k / 14 * Math.PI * 2 + seed + (k % 2) * .2, upper = k % 2 === 0, len = (upper ? 3.4 : 4.2) + (k % 3) * .4, droop = upper ? .35 : .9;
    const base = new THREE.Vector3(px, py + (upper ? .35 : .1), pz), mid = new THREE.Vector3(px + Math.cos(a) * len * .45, py + (upper ? 1.1 : .55), pz + Math.sin(a) * len * .45), tip = new THREE.Vector3(px + Math.cos(a) * len, py - droop * 1.8, pz + Math.sin(a) * len);
    for (const [p0, p1, w] of [[base, mid, .95], [mid, tip, .75]] as const) {
      const dir = p1.clone().sub(p0), m = new THREE.Matrix4().compose(p0.clone().add(p1).multiplyScalar(.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()), new THREE.Vector3(w, p0.distanceTo(p1), .07));
      leaves.add(FROND, k % 3 === 0 ? E.leafDark : k % 3 === 1 ? E.leaf : '#6f9a46', m, false);
      leaves.add(BOX, '#5c7a34', new THREE.Matrix4().compose(p0.clone().add(p1).multiplyScalar(.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()), new THREE.Vector3(.06, p0.distanceTo(p1), .09)), false);
    }
  }
  for (let k = 0; k < 3; k++) { const a = k * 2.1 + seed; leaves.add(new THREE.SphereGeometry(.28, 6, 4), '#a8642c', T(px + Math.cos(a) * .5, py - .5, pz + Math.sin(a) * .5, 0, 1, 1.4, 1), false); }
}

/** Felucca: a planked hull with a tall lateen sail. */
export function felucca(b: Batch, x: number, y: number, z: number, yaw: number, s = 1) {
  const f = new Frame(b, x, y, z, yaw), sh = new Shell(f), L = 4.5 * s, W = 1.1 * s;
  const ring = (zz: number, w: number, yy: number): V[] => [[-w, yy + .55 * s, zz], [w, yy + .55 * s, zz], [w * .6, yy, zz], [-w * .6, yy, zz]];
  const A = ring(-L, .15, .3 * s), B = ring(-L * .5, W, 0), C = ring(L * .5, W, 0), D = ring(L, .15, .4 * s);
  for (const [p, q] of [[A, B], [B, C], [C, D]] as const) { sh.quad(p[0], q[0], q[3], p[3], [-1, -.3, 0]); sh.quad(p[1], q[1], q[2], p[2], [1, -.3, 0]); sh.quad(p[3], q[3], q[2], p[2], [0, -1, 0]); }
  sh.done(E.wood);
  f.box(0, .45 * s, 0, W * 1.7, .06, L * 1.6, '#8a6a46', false);
  f.cyl(0, 3.2 * s, -.6 * s, .07 * s, 6 * s, E.wood, false);
  f.beam([0, .9 * s, -L * .9], [0, 7.6 * s, L * .4], .08 * s, E.wood);
  f.mesh([0, .95 * s, -L * .85, 0, 7.4 * s, L * .38, 0, 1.1 * s, L * .35], [0, 1, 2, 0, 2, 1], E.linen, false);
}

/** Dromedary, kneeling or standing, with a striped saddle blanket. */
export function camel(b: Batch, x: number, y: number, z: number, yaw: number, kneel = false) {
  const f = new Frame(b, x, y, z, yaw), c = '#c49a64', lift = kneel ? -1.1 : 0;
  f.box(0, 2.1 + lift, 0, .9, .9, 2.2, c); f.box(0, 2.75 + lift, -.1, .7, .6, .9, c);
  f.beam([0, 2.3 + lift, 1], [0, 3.2 + lift, 1.7], .36, c); f.box(0, 3.25 + lift, 1.95, .34, .34, .7, c);
  f.box(0, 2.62 + lift, -.1, 1.02, .4, 1.4, E.red, false); for (let k = -2; k <= 2; k++) f.box(0, 2.62 + lift, -.1 + k * .25, 1.04, .41, .06, E.yellow, false);
  if (kneel) for (const sx of [-1, 1]) for (const sz of [-.8, .8]) f.box(sx * .35, .3, sz, .25, .5, .9, c);
  else for (const sx of [-1, 1]) for (const sz of [-.8, .8]) f.beam([sx * .32, 1.75, sz], [sx * .32, 0, sz + .05], .17, c);
  f.beam([0, 2.2 + lift, -1.1], [0, 1.4 + lift, -1.3], .07, c);
}

/** 汲水吊杆 (shaduf): a counterweighted sweep lifting a bucket from the channel. */
export function shaduf(b: Batch, x: number, y: number, z: number, yaw: number) {
  const f = new Frame(b, x, y, z, yaw);
  for (const s of [-1, 1]) f.box(s * .5, 1.3, 0, .25, 2.6, .25, E.brick);
  f.beam([-.6, 2.5, 0], [.6, 2.5, 0], .15, E.wood); f.beam([0, 2.6, -2.2], [0, 3.3, 2.6], .12, E.wood);
  f.box(0, 2.45, -2.2, .6, .6, .6, E.brickDark, false); f.beam([0, 3.3, 2.6], [0, 1.1, 2.6], .03, '#b9a77d'); f.cyl(0, .95, 2.6, .25, .35, E.black, false);
}

/** True pyramid with polished casing, a gilded capstone and its north entrance. */
export function pyramid(b: Batch, x: number, y: number, z: number, base: number, h: number) {
  const f = new Frame(b, x, y, z), sh = new Shell(f), r = base / 2, cap = h * .1, rc = r * cap / h;
  const B: V[] = [[-r, 0, -r], [r, 0, -r], [r, 0, r], [-r, 0, r]], U: V[] = [[-rc, h - cap, -rc], [rc, h - cap, -rc], [rc, h - cap, rc], [-rc, h - cap, rc]];
  const hint: V[] = [[0, .5, -1], [1, .5, 0], [0, .5, 1], [-1, .5, 0]];
  for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; sh.quad(B[i], B[j], U[j], U[i], hint[i]); }
  sh.done(E.limestone, true);
  const gs = new Shell(f), apex: V = [0, h, 0];
  for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; gs.tri(U[i], U[j], apex, hint[i]); } gs.done(E.gold);
  // stepped core showing where the casing has been robbed on one corner
  for (let k = 0; k < 6; k++) { const t = k / 6, rr = r * (1 - t) - 1.5; f.box(r - rr * .25 - 1, t * h + h / 12, r - rr * .25 - 1, rr * .5, h / 6 - .2, rr * .5, E.sandstone, false); }
  f.box(0, h * .12, -r * .86, 2.4, 3, 2, E.black, false);
}

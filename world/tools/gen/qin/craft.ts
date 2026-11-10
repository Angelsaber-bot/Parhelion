import * as THREE from 'three';
import { Batch, BOX } from '../geo';
import { Frame } from '../orleans/craft';
import type { QinPoint } from '../../../src/map/qinPlan';

/** Qin palette: rammed loess, black fired tile, vermilion lacquer, patinated bronze. */
export const Q = {
  earth: '#b39a73', earthDark: '#9c845f', earthPale: '#c8b28a', loess: '#c9b48c',
  tile: '#2e3236', tileEdge: '#3d4247', ridge: '#24272b', plaster: '#ddd2b8',
  red: '#a63a2c', redDark: '#7e2c24', bronze: '#5f7c66', bronzeBright: '#a8854a', lacquer: '#201e1d',
  wood: '#5c4532', woodPale: '#8c6c4b', stone: '#8f9089', stoneDark: '#6c6e69', paving: '#9d9784',
  terracotta: '#9b7b5d', terracottaDark: '#7f6249', clay: '#b07a57', water: '#4f8fa0',
  ember: '#ff9a3c', molten: '#ffc463', mercury: '#c9d7e6', star: '#e8ecff', jade: '#6f9c86',
};
export const CYL = new THREE.CylinderGeometry(1, 1, 1, 12), CYL8 = new THREE.CylinderGeometry(1, 1, 1, 8);

/** A closed hip roof with deep Qin eaves: the long ridge and a visible fascia band. */
export function qinRoof(f: Frame, w: number, d: number, eave: number, rise: number, color = Q.tile, overhang = 1.8, collide = false) {
  const x = w / 2 + overhang, z = d / 2 + overhang, rz = Math.max(.6, d / 2 - (w > d ? 0 : d / 2 - .6)), rx = Math.max(.6, w / 2 - d / 2);
  const ridgeX = w >= d ? rx : .6, ridgeZ = w >= d ? .6 : rz;
  // Slight droop toward the corners reads as the tile's weight without curved geometry.
  f.mesh([
    -x, eave - .35, -z, x, eave - .35, -z, x, eave - .35, z, -x, eave - .35, z,
    -ridgeX, eave + rise, -ridgeZ, ridgeX, eave + rise, -ridgeZ, ridgeX, eave + rise, ridgeZ, -ridgeX, eave + rise, ridgeZ,
    -x, eave - .7, -z, x, eave - .7, -z, x, eave - .7, z, -x, eave - .7, z,
  ], [
    0, 4, 1, 1, 4, 5, 1, 5, 2, 2, 5, 6, 2, 6, 3, 3, 6, 7, 3, 7, 0, 0, 7, 4, 4, 7, 5, 5, 7, 6,
    // fascia band and soffit close the eave so the roof never reads as paper
    0, 1, 9, 0, 9, 8, 1, 2, 10, 1, 10, 9, 2, 3, 11, 2, 11, 10, 3, 0, 8, 3, 8, 11, 8, 9, 10, 8, 10, 11,
  ], color, collide);
  f.beam([-ridgeX - .4, eave + rise + .18, 0], [ridgeX + .4, eave + rise + .18, 0], .55, Q.ridge);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) f.beam([sx * ridgeX, eave + rise, sz * ridgeZ], [sx * x, eave - .3, sz * z], .3, Q.ridge);
  // Round tile-end discs along the front and back eaves.
  for (let i = -Math.floor(x); i <= Math.floor(x); i += 2) for (const sz of [-1, 1]) f.box(i, eave - .55, sz * (z + .05), .5, .5, .12, Q.tileEdge, false);
}

/** Rammed-earth platform: courses of loess with a paved top and dark stone kerb. */
export function rammedPlatform(b: Batch, x0: number, x1: number, z0: number, z1: number, bottom: number, top: number, kerb = true) {
  const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  b.box(cx, bottom, cz, w, top - bottom, d, Q.earth);
  for (let y = bottom + 1.2, k = 0; y < top - .4; y += 1.2, k++) {
    const c = k % 2 ? Q.earthDark : Q.earthPale;
    b.box(cx, y, z0 - .03, w, .14, .1, c, 0, false); b.box(cx, y, z1 + .03, w, .14, .1, c, 0, false);
    b.box(x0 - .03, y, cz, .1, .14, d, c, 0, false); b.box(x1 + .03, y, cz, .1, .14, d, c, 0, false);
  }
  if (kerb) {
    b.box(cx, top - .1, z0 + .25, w, .2, .5, Q.stoneDark, 0, false); b.box(cx, top - .1, z1 - .25, w, .2, .5, Q.stoneDark, 0, false);
    b.box(x0 + .25, top - .1, cz, .5, .2, d, Q.stoneDark, 0, false); b.box(x1 - .25, top - .1, cz, .5, .2, d, Q.stoneDark, 0, false);
  }
}

/** Rammed-earth wall with a small black-tile coping. Length along local Z. */
export function earthWall(f: Frame, length: number, height: number, thick = 2.2, bottom = 0) {
  f.box(0, bottom + (height - bottom) / 2, 0, thick, height - bottom, length, Q.earth);
  for (let y = bottom + 1.1, k = 0; y < height - .4; y += 1.1, k++) for (const s of [-1, 1]) f.box(s * (thick / 2 + .03), y, 0, .08, .12, length, k % 2 ? Q.earthDark : Q.earthPale, false);
  f.box(0, height + .15, 0, thick + 1, .3, length + .2, Q.tile, false);
  f.box(0, height + .45, 0, .45, .3, length + .2, Q.ridge, false);
}

/** Vermilion column on a bronze-capped stone base. */
export function column(f: Frame, x: number, z: number, h: number, r = .45, bottom = 0) {
  f.cyl(x, bottom + .25, z, r + .35, .5, Q.stoneDark);
  f.cyl(x, bottom + .65, z, r + .12, .3, Q.bronze, false);
  f.cyl(x, bottom + h / 2, z, r, h, Q.red);
  f.cyl(x, bottom + h - .25, z, r + .1, .3, Q.bronze, false);
}

/** Open-fronted columned hall on a plinth; rammed walls on three sides. */
export function palaceHall(b: Batch, x: number, y: number, z: number, w: number, d: number, h: number, a = 0, open: 'front' | 'all' = 'front') {
  const f = new Frame(b, x, y, z, a);
  f.box(0, -.3, 0, w + 2, .6, d + 2, Q.paving);
  const bays = Math.max(1, Math.round(w / 4.5)) | 1; // odd: the central axis stays open
  for (let i = 0; i <= bays; i++) {
    const xx = -w / 2 + w * i / bays;
    column(f, xx, d / 2, h);
    if (open === 'all') column(f, xx, -d / 2, h);
  }
  if (open === 'front') {
    f.box(0, h / 2, -d / 2 + .8, w, h, 1.6, Q.earth);
    for (const s of [-1, 1]) {
      f.box(s * (w / 2 - .8), h / 2, -1.2, 1.6, h, d - 2.4, Q.earth);
      for (let k = 0; k < 3; k++) f.box(s * (w / 2 - .78), h * .3 + k * 1.5, -1.2, 1.7, .12, d - 2.6, k % 2 ? Q.earthDark : Q.earthPale, false);
    }
    // painted dado and bronze wall fittings (金釭) across the inner walls
    f.box(0, 1.1, -d / 2 + 1.65, w - 3.4, 2.2, .1, Q.redDark, false);
    for (let i = -2; i <= 2; i++) f.box(i * w / 6, 2.6, -d / 2 + 1.7, .9, .25, .1, Q.bronzeBright, false);
  }
  f.box(0, h + .2, d / 2, w + .6, .5, .6, Q.redDark, false);
  f.box(0, h + .2, -d / 2, w + .6, .5, .6, Q.redDark, false);
  f.box(0, h + .5, 0, w + .6, .3, d + .6, Q.wood);
  qinRoof(f, w, d, h + .7, Math.min(w, d) * .38, Q.tile, 2.6, true);
}

/** Paired gate piers (阙) with a lintel pavilion over an opening of `gap`. */
export function gateHouse(b: Batch, x: number, y: number, z: number, gap: number, h: number, a = 0, depth = 8, pier = 7) {
  const f = new Frame(b, x, y, z, a);
  for (const s of [-1, 1]) {
    const px = s * (gap / 2 + pier / 2);
    f.box(px, h / 2, 0, pier, h, depth, Q.earth);
    for (let yy = 1.2, k = 0; yy < h - .3; yy += 1.2, k++) for (const sz of [-1, 1]) f.box(px, yy, sz * (depth / 2 + .03), pier, .14, .08, k % 2 ? Q.earthDark : Q.earthPale, false);
    f.box(px, h + .3, 0, pier + 1, .6, depth + 1, Q.stoneDark, false);
    const tower = new Frame(b, x + Math.cos(a) * px, y, z - Math.sin(a) * px, a);
    tower.box(0, h + 2.4, 0, pier - 1.4, 3.6, depth - 1.4, Q.plaster, false);
    for (const sx of [-1, 1]) tower.box(sx * (pier / 2 - .75), h + 2.4, depth / 2 - .6, .45, 3.6, .45, Q.red, false);
    qinRoof(tower, pier - 1.4, depth - 1.4, h + 4.3, 2.4, Q.tile, 1.6);
  }
  // lintel beam and pavilion over the passage, clear of the road below
  f.box(0, h - 1, 0, gap + 1, 2, depth - 1, Q.wood);
  f.box(0, h + .5, 0, gap + pier * 2, .8, depth + .4, Q.earthDark, false);
  f.box(0, h + 2.6, 0, gap - 1, 3.6, depth - 2, Q.plaster, false);
  for (let i = -1; i <= 1; i++) f.box(i * gap / 3, h + 2.6, depth / 2 - .9, .5, 3.6, .5, Q.red, false);
  qinRoof(f, gap + pier * 2 - 2, depth - 1, h + 4.5, 3.4, Q.tile, 2);
  // heavy bronze-studded door leaves stand open against the piers
  for (const s of [-1, 1]) {
    f.box(s * (gap / 2 - .3), (h - 2) / 2, depth / 2 - .9, .5, h - 2, gap / 2 - .4, Q.lacquer, false, s * .0);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) f.box(s * (gap / 2 - .02), 1.4 + r * (h - 3.4) / 4, depth / 2 - 1.6 - c * (gap / 2 - 1.6) / 3, .12, .25, .25, Q.bronzeBright, false);
  }
}

/** Corridor/wall-plane helper: a box spanning two points (centre line), thickness and height. */
export function slabBetween(b: Batch, a: QinPoint, c: QinPoint, width: number, thickness: number, color: string, collide = true) {
  const p = new THREE.Vector3(...a), q = new THREE.Vector3(...c), dir = q.clone().sub(p), len = dir.length();
  const yaw = Math.atan2(dir.x, dir.z), pitch = -Math.atan2(dir.y, Math.hypot(dir.x, dir.z));
  const m = new THREE.Matrix4().compose(p.clone().add(q).multiplyScalar(.5), new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ')), new THREE.Vector3(width, thickness, len));
  b.add(BOX, color, m, collide);
}

/** Open-top walking surface along a polyline (no snagging end caps). */
export function walkStrip(b: Batch, points: readonly QinPoint[], width: number, color: string, lift = 0) {
  const v: number[] = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], q = points[i], dx = q[0] - a[0], dz = q[2] - a[2], l = Math.hypot(dx, dz) || 1, ox = -dz / l * width / 2, oz = dx / l * width / 2;
    const p = [[a[0] + ox, a[1] + lift, a[2] + oz], [a[0] - ox, a[1] + lift, a[2] - oz], [q[0] + ox, q[1] + lift, q[2] + oz], [q[0] - ox, q[1] + lift, q[2] - oz]];
    v.push(...p[0], ...p[2], ...p[1], ...p[1], ...p[2], ...p[3]);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); b.add(g, color, new THREE.Matrix4()); g.dispose();
}

/** Standing terracotta warrior; ~1.9 m tall. `kind` varies armour and stance. */
export function warrior(b: Batch, x: number, y: number, z: number, a: number, kind: number, collide = false) {
  const f = new Frame(b, x, y, z, a), body = kind % 3 === 0 ? Q.terracotta : kind % 3 === 1 ? '#a3846a' : Q.terracottaDark;
  f.box(0, .08, 0, .8, .16, .7, Q.terracottaDark, collide);
  for (const s of [-1, 1]) f.box(s * .15, .55, 0, .2, .8, .24, body, false);
  f.box(0, 1.2, 0, .66, .78, .4, kind % 2 ? '#8d6f55' : body, collide);
  // armour plates as two rows of lamellae
  for (let r = 0; r < 2; r++) f.box(0, 1.05 + r * .28, .21, .6, .1, .04, Q.terracottaDark, false);
  for (const s of [-1, 1]) f.beam([s * .38, 1.5, 0], [s * .42, kind === 2 ? 1.62 : 1.02, .16], .15, body);
  f.box(0, 1.66, 0, .16, .12, .16, body, false);
  f.box(0, 1.82, 0, .3, .32, .3, '#ab8b70', false);
  f.box(.06, 2.02, -.06, .16, .14, .16, Q.terracottaDark, false);
  if (kind === 2) f.beam([.42, .3, .24], [.42, 2.4, .24], .05, Q.wood);
}

import * as THREE from 'three';
import { Batch, BOX } from '../geo';
import { Frame } from '../orleans/craft';
import type { QinPoint } from '../../../src/map/qinPlan';
import { placeFigure, warriorPrims, horsePrims, type QinPrim, type WarriorKind } from '../../../src/map/qinFigures';

/** Qin palette: rammed loess, black fired tile, vermilion lacquer, patinated bronze. */
export const Q = {
  earth: '#b39a73', earthDark: '#9c845f', earthPale: '#c8b28a', loess: '#c9b48c',
  tile: '#2e3236', tileEdge: '#3d4247', ridge: '#24272b', plaster: '#ddd2b8',
  red: '#a63a2c', redDark: '#7e2c24', bronze: '#5f7c66', bronzeBright: '#a8854a', lacquer: '#201e1d',
  wood: '#5c4532', woodPale: '#8c6c4b', stone: '#8f9089', stoneDark: '#6c6e69', paving: '#9d9784',
  terracotta: '#9b7b5d', terracottaDark: '#7f6249', clay: '#b07a57', water: '#4f8fa0',
  ember: '#ff9a3c', molten: '#ffc463', mercury: '#c9d7e6', star: '#e8ecff', jade: '#6f9c86',
  ochre: '#b8823f', azure: '#3f6f8a', cinnabar: '#c0452f', gold: '#c9a25a', silk: '#c9b991',
};
export const MAT = 'M_QinCraft';
export const CYL = new THREE.CylinderGeometry(1, 1, 1, 12), CYL8 = new THREE.CylinderGeometry(1, 1, 1, 8);
const DISC = new THREE.CylinderGeometry(1, 1, 1, 10).rotateX(Math.PI / 2);

type V = [number, number, number];
/** 瓦当: a round tile end facing out of the eave. */
function tileEnd(f: Frame, x: number, y: number, z: number, turn: number, r: number) {
  const p = f.point(x, y, z); f.b.add(DISC, Q.tileEdge, new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), f.a + turn), new THREE.Vector3(r, r, .1)), false);
}
/** Free-form mesh in a Frame whose triangles are flipped to face each hint direction. */
export class Shell {
  v: number[] = []; idx: number[] = [];
  constructor(public f: Frame) {}
  quad(a: V, b: V, c: V, d: V, hint: V) { this.tri(a, b, c, hint); this.tri(a, c, d, hint); }
  tri(a: V, b: V, c: V, hint: V) {
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
    const k = this.v.length / 3; this.v.push(...a, ...(n[0] * hint[0] + n[1] * hint[1] + n[2] * hint[2] >= 0 ? [...b, ...c] : [...c, ...b])); this.idx.push(k, k + 1, k + 2);
  }
  done(color: string, collide = false) { if (this.idx.length) this.f.mesh(this.v, this.idx, color, collide); this.v = []; this.idx = []; }
}

/** 鸱尾: a ridge-end fin sweeping up and curling inward. */
function ridgeFin(f: Frame, x: number, y: number, z: number, side: number, s = 1) {
  const pts: V[] = [[x, y, z], [x + side * .15 * s, y + .7 * s, z], [x - side * .15 * s, y + 1.25 * s, z], [x - side * .65 * s, y + 1.5 * s, z]];
  for (let i = 1; i < pts.length; i++) f.beam(pts[i - 1], pts[i], (.42 - i * .07) * s, Q.ridge);
  f.box(x - side * .2 * s, y + .5 * s, z, .22 * s, .9 * s, .5 * s, Q.ridge, false);
}

export interface RoofOpts { color?: string; overhang?: number; collide?: boolean; fins?: boolean; ends?: boolean; rafters?: boolean; finScale?: number }
/** Hip roof (庑殿) with deep eaves: rafter ends, round tile ends (瓦当), banded ridges and fins. */
export function qinRoof(f: Frame, w: number, d: number, eave: number, rise: number, color = Q.tile, overhang = 1.8, collide = false, opts: RoofOpts = {}) {
  const x = w / 2 + overhang, z = d / 2 + overhang;
  const ridgeX = w >= d ? Math.max(.6, (w - d) / 2) : .6, ridgeZ = w >= d ? .6 : Math.max(.6, (d - w) / 2);
  const sh = new Shell(f), top = eave + rise, lo = eave - .35;
  const c0: V = [-x, lo, -z], c1: V = [x, lo, -z], c2: V = [x, lo, z], c3: V = [-x, lo, z];
  const r0: V = [-ridgeX, top, -ridgeZ], r1: V = [ridgeX, top, -ridgeZ], r2: V = [ridgeX, top, ridgeZ], r3: V = [-ridgeX, top, ridgeZ];
  sh.quad(c0, c1, r1, r0, [0, 1, -1]); sh.quad(c1, c2, r2, r1, [1, 1, 0]); sh.quad(c2, c3, r3, r2, [0, 1, 1]); sh.quad(c3, c0, r0, r3, [-1, 1, 0]); sh.quad(r0, r1, r2, r3, [0, 1, 0]);
  // Thick eave: fascia board and soffit, so the edge reads as heavy timber and tile.
  const dn = (p: V, k = .45): V => [p[0], p[1] - k, p[2]];
  sh.quad(c0, c1, dn(c1), dn(c0), [0, 0, -1]); sh.quad(c1, c2, dn(c2), dn(c1), [1, 0, 0]); sh.quad(c2, c3, dn(c3), dn(c2), [0, 0, 1]); sh.quad(c3, c0, dn(c0), dn(c3), [-1, 0, 0]);
  sh.quad(dn(c0), dn(c1), dn(c2), dn(c3), [0, -1, 0]);
  sh.done(color, collide);
  // Banded main ridge (two courses) and hip ridges that stand proud of the tile.
  f.beam([-ridgeX - .5, top + .16, 0], [ridgeX + .5, top + .16, 0], .62, Q.ridge);
  f.beam([-ridgeX - .4, top + .48, 0], [ridgeX + .4, top + .48, 0], .4, Q.tileEdge);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    f.beam([sx * ridgeX, top + .1, sz * ridgeZ], [sx * x, lo + .05, sz * z], .36, Q.ridge);
    f.box(sx * (x - .15), lo + .25, sz * (z - .15), .55, .5, .55, Q.tileEdge, false);
  }
  if (opts.fins !== false) for (const s of [-1, 1]) ridgeFin(f, s * (ridgeX + .4), top + .3, 0, s, opts.finScale ?? Math.min(1.6, .55 + Math.min(w, d) * .05));
  const step = .68;
  if (opts.ends !== false) {
    for (let i = -x + .4; i <= x - .4; i += step) for (const sz of [-1, 1]) tileEnd(f, i, lo - .2, sz * (z + .04), 0, .17);
    for (let i = -z + .4; i <= z - .4; i += step) for (const sx of [-1, 1]) tileEnd(f, sx * (x + .04), lo - .2, i, Math.PI / 2, .17);
  }
  if (opts.rafters !== false) {
    // Round rafter ends (椽头) in a dark row just under the fascia.
    for (let i = -x + .6; i <= x - .6; i += .55) for (const sz of [-1, 1]) f.box(i, lo - .62, sz * (z - .25), .15, .15, .55, Q.woodPale, false);
    for (let i = -z + .6; i <= z - .6; i += .55) for (const sx of [-1, 1]) f.box(sx * (x - .25), lo - .62, i, .55, .15, .15, Q.woodPale, false);
  }
}

/** Single-pitch skirt roof (腰檐) ringing a hall below its upper storey. */
export function pentRoof(f: Frame, w: number, d: number, y: number, out: number, drop: number, color = Q.tile) {
  const sh = new Shell(f), ix = w / 2, iz = d / 2, ox = ix + out, oz = iz + out, lo = y - drop;
  const I: V[] = [[-ix, y, -iz], [ix, y, -iz], [ix, y, iz], [-ix, y, iz]], O: V[] = [[-ox, lo, -oz], [ox, lo, -oz], [ox, lo, oz], [-ox, lo, oz]];
  const hints: V[] = [[0, 1, -1], [1, 1, 0], [0, 1, 1], [-1, 1, 0]];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4, dn = (p: V): V => [p[0], p[1] - .4, p[2]];
    sh.quad(O[i], O[j], I[j], I[i], hints[i]);
    sh.quad(O[i], O[j], dn(O[j]), dn(O[i]), [hints[i][0], 0, hints[i][2]]);
    sh.quad(dn(O[i]), dn(O[j]), [I[j][0], I[j][1] - .6, I[j][2]], [I[i][0], I[i][1] - .6, I[i][2]], [0, -1, 0]);
  }
  sh.done(color);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) f.beam([sx * ix, y + .05, sz * iz], [sx * ox, lo + .05, sz * oz], .3, Q.ridge);
  for (let i = -ox + .4; i <= ox - .4; i += .68) for (const sz of [-1, 1]) tileEnd(f, i, lo - .25, sz * (oz + .04), 0, .14);
  for (let i = -oz + .4; i <= oz - .4; i += .68) for (const sx of [-1, 1]) tileEnd(f, sx * (ox + .04), lo - .25, i, Math.PI / 2, .14);
}

/** 斗拱: a bracket set on a column head, carrying the eave purlin. */
export function bracket(f: Frame, x: number, z: number, y: number, s = 1, along = 0) {
  f.box(x, y + .18 * s, z, .75 * s, .36 * s, .75 * s, Q.woodPale, false);
  f.box(x, y + .5 * s, z, along ? .32 * s : 2 * s, .28 * s, along ? 2 * s : .32 * s, Q.redDark, false);
  f.box(x, y + .5 * s, z, along ? 1.3 * s : .32 * s, .28 * s, along ? .32 * s : 1.3 * s, Q.redDark, false);
  for (const k of [-1, 0, 1]) f.box(x + (along ? 0 : k * .85 * s), y + .78 * s, z + (along ? k * .85 * s : 0), .38 * s, .26 * s, .38 * s, Q.woodPale, false);
  f.box(x, y + 1.02 * s, z, along ? .3 * s : 2.4 * s, .22 * s, along ? 2.4 * s : .3 * s, Q.azure, false);
}

/** Rammed-earth platform: pounded loess with a stone kerb, wooden tie-beams and drainage spouts. */
export function rammedPlatform(b: Batch, x0: number, x1: number, z0: number, z1: number, bottom: number, top: number, kerb = true) {
  const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  b.box(cx, bottom, cz, w, top - bottom, d, Q.earth);
  // Timber lacing (纴木) every few courses, with pole ends showing.
  for (let y = bottom + 2.4; y < top - 1; y += 2.5) {
    for (const [zz, len] of [[z0 - .04, w], [z1 + .04, w]] as const) { b.box(cx, y, zz, len, .22, .1, Q.wood, 0, false); for (let xx = x0 + 1.5; xx < x1; xx += 3) b.box(xx, y - .05, zz, .32, .32, .16, Q.woodPale, 0, false); }
    for (const [xx, len] of [[x0 - .04, d], [x1 + .04, d]] as const) { b.box(xx, y, cz, .1, .22, len, Q.wood, 0, false); for (let zz = z0 + 1.5; zz < z1; zz += 3) b.box(xx, y - .05, zz, .16, .32, .32, Q.woodPale, 0, false); }
  }
  // Stone plinth course where the platform meets the ground.
  b.box(cx, bottom, cz, w + .6, Math.min(1.6, top - bottom), d + .6, Q.stoneDark);
  if (kerb) {
    b.box(cx, top - .12, z0 + .3, w, .24, .6, Q.stone, 0, false); b.box(cx, top - .12, z1 - .3, w, .24, .6, Q.stone, 0, false);
    b.box(x0 + .3, top - .12, cz, .6, .24, d, Q.stone, 0, false); b.box(x1 - .3, top - .12, cz, .6, .24, d, Q.stone, 0, false);
    // Pottery drain spouts under the kerb (陶水管).
    for (let xx = x0 + 4; xx < x1 - 2; xx += 9) for (const zz of [z0 - .3, z1 + .3]) b.add(CYL8, Q.clay, new THREE.Matrix4().compose(new THREE.Vector3(xx, top - .55, zz), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2), new THREE.Vector3(.16, .7, .16)), false);
  }
}

/** Rammed-earth wall with tile coping. Length along local Z. */
export function earthWall(f: Frame, length: number, height: number, thick = 2.2, bottom = 0, crenel = false) {
  f.box(0, bottom + (height - bottom) / 2, 0, thick, height - bottom, length, Q.earth);
  f.box(0, bottom + .5, 0, thick + .4, 1, length, Q.stoneDark);
  f.box(0, height + .15, 0, thick + 1, .3, length + .2, Q.tile, false);
  f.box(0, height + .45, 0, .45, .3, length + .2, Q.ridge, false);
  if (crenel) for (let zz = -length / 2 + .8; zz < length / 2 - .4; zz += 2.4) f.box(thick / 2 - .3, height + .9, zz, .6, 1.2, 1.2, Q.earth);
}

/**
 * A wall that follows the ground: continuous sloped top, stone foot, coping and battlements
 * (雉堞) on the outer face. `points` are [x,z] in world space.
 */
export function terrainWall(b: Batch, points: readonly (readonly [number, number])[], ground: (x: number, z: number) => number, height: number, thick: number, outward = 1, minTop = -Infinity) {
  const f = new Frame(b, 0, 0, 0), sh = new Shell(f), coping = new Shell(f), foot = new Shell(f), samples: { x: number; z: number; nx: number; nz: number; g: number; top: number }[] = [];
  for (let i = 1; i < points.length; i++) {
    const [ax, az] = points[i - 1], [bx, bz] = points[i], len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(len / 2));
    for (let k = i === 1 ? 0 : 1; k <= n; k++) { const x = ax + (bx - ax) * k / n, z = az + (bz - az) * k / n, g = ground(x, z); samples.push({ x, z, nx: -(bz - az) / len, nz: (bx - ax) / len, g, top: Math.max(g + height, minTop) }); }
  }
  const hw = thick / 2;
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1], c = samples[i];
    const L = (s: typeof a, y: number, o = hw): V => [s.x + s.nx * o, y, s.z + s.nz * o], R = (s: typeof a, y: number, o = hw): V => [s.x - s.nx * o, y, s.z - s.nz * o];
    const n: V = [a.nx, 0, a.nz], m: V = [-a.nx, 0, -a.nz];
    sh.quad(L(a, a.g - 1.5), L(c, c.g - 1.5), L(c, c.top), L(a, a.top), n);
    sh.quad(R(a, a.g - 1.5), R(c, c.g - 1.5), R(c, c.top), R(a, a.top), m);
    sh.quad(L(a, a.top), L(c, c.top), R(c, c.top), R(a, a.top), [0, 1, 0]);
    foot.quad(L(a, a.g - 1, hw + .3), L(c, c.g - 1, hw + .3), L(c, c.g + .9, hw + .3), L(a, a.g + .9, hw + .3), n);
    foot.quad(R(a, a.g - 1, hw + .3), R(c, c.g - 1, hw + .3), R(c, c.g + .9, hw + .3), R(a, a.g + .9, hw + .3), m);
    coping.quad(L(a, a.top + .1, hw + .5), L(c, c.top + .1, hw + .5), R(c, c.top + .1, hw + .5), R(a, a.top + .1, hw + .5), [0, 1, 0]);
    coping.quad(L(a, a.top - .2, hw + .5), L(c, c.top - .2, hw + .5), L(c, c.top + .1, hw + .5), L(a, a.top + .1, hw + .5), n);
    coping.quad(R(a, a.top - .2, hw + .5), R(c, c.top - .2, hw + .5), R(c, c.top + .1, hw + .5), R(a, a.top + .1, hw + .5), m);
    if (i % 2 === 0) { const o = outward * (hw - .3), p: V = [a.x + a.nx * o, a.top + .7, a.z + a.nz * o]; b.add(BOX, Q.earth, new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(a.nx, a.nz)), new THREE.Vector3(1.2, 1.2, .6))); }
  }
  sh.done(Q.earth, true); foot.done(Q.stoneDark, true); coping.done(Q.tile);
}

/** Vermilion column on a two-stage stone base with bronze collars (金釭). */
export function column(f: Frame, x: number, z: number, h: number, r = .45, bottom = 0) {
  f.box(x, bottom + .14, z, (r + .5) * 2, .28, (r + .5) * 2, Q.stone);
  f.cyl(x, bottom + .42, z, r + .3, .3, Q.stoneDark);
  f.cyl(x, bottom + .7, z, r + .1, .26, Q.bronze, false);
  f.cyl(x, bottom + h / 2, z, r, h, Q.red);
  for (const yy of [h * .55, h - .3]) f.cyl(x, bottom + yy, z, r + .08, .22, Q.bronzeBright, false);
}

/** Columned hall on a plinth; rammed walls on three sides, bracket sets and optional double eaves. */
export function palaceHall(b: Batch, x: number, y: number, z: number, w: number, d: number, h: number, a = 0, open: 'front' | 'all' = 'front', double = false) {
  const f = new Frame(b, x, y, z, a);
  f.box(0, -.3, 0, w + 2, .6, d + 2, Q.paving);
  const bays = Math.max(1, Math.round(w / 4.5)) | 1; // odd: the central axis stays open
  for (let i = 0; i <= bays; i++) {
    const xx = -w / 2 + w * i / bays;
    column(f, xx, d / 2, h); bracket(f, xx, d / 2, h, Math.min(1.2, .6 + w * .015));
    if (open === 'all') { column(f, xx, -d / 2, h); bracket(f, xx, -d / 2, h, Math.min(1.2, .6 + w * .015)); }
    // lattice transom between the front columns
    if (i < bays) { const mid = -w / 2 + w * (i + .5) / bays; f.box(mid, h - .7, d / 2, w / bays - 1, .9, .12, Q.redDark, false); for (let k = -3; k <= 3; k++) f.box(mid + k * (w / bays - 1) / 7, h - .7, d / 2 + .05, .06, .9, .06, Q.gold, false); }
  }
  if (open === 'front') {
    f.box(0, h / 2, -d / 2 + .8, w, h, 1.6, Q.earth);
    for (const s of [-1, 1]) f.box(s * (w / 2 - .8), h / 2, -1.2, 1.6, h, d - 2.4, Q.earth);
    // Painted wall: cinnabar dado, a band of cloud scroll panels and bronze fittings.
    f.box(0, 1.1, -d / 2 + 1.65, w - 3.4, 2.2, .1, Q.redDark, false);
    for (let i = -5; i <= 5; i++) { f.box(i * (w - 4) / 11, 3.4, -d / 2 + 1.66, (w - 4) / 11 - .3, 1.4, .08, i % 2 ? Q.azure : Q.ochre, false); f.box(i * (w - 4) / 11, 3.4, -d / 2 + 1.7, .5, .5, .06, Q.gold, false); }
    for (let i = -2; i <= 2; i++) f.box(i * w / 6, 2.4, -d / 2 + 1.72, .9, .25, .1, Q.bronzeBright, false);
  }
  const ring = h + 1.1;
  f.box(0, ring, d / 2, w + .6, .5, .6, Q.redDark, false);
  f.box(0, ring, -d / 2, w + .6, .5, .6, Q.redDark, false);
  f.box(0, ring + .35, 0, w + .6, .3, d + .6, Q.wood);
  if (double) {
    pentRoof(f, w + 1, d + 1, ring + .6, 3, 1.8);
    const uw = w - 5, ud = d - 4, uh = 3.6;
    f.box(0, ring + .6 + uh / 2, 0, uw, uh, ud, Q.plaster, false);
    for (let i = 0; i <= 6; i++) for (const s of [-1, 1]) { f.box(-uw / 2 + uw * i / 6, ring + .6 + uh / 2, s * ud / 2, .45, uh, .45, Q.red, false); if (i < 6) { const mx = -uw / 2 + uw * (i + .5) / 6; for (let k = -2; k <= 2; k++) f.box(mx + k * .35, ring + .6 + uh / 2, s * (ud / 2 + .02), .07, uh * .7, .05, Q.redDark, false); } }
    for (let i = 0; i <= 6; i++) bracket(f, -uw / 2 + uw * i / 6, ud / 2, ring + .6 + uh, .8);
    qinRoof(f, uw, ud, ring + .6 + uh + 1.1, Math.min(uw, ud) * .42, Q.tile, 3.2, true);
  } else qinRoof(f, w, d, ring + .8, Math.min(w, d) * .38, Q.tile, 2.6, true);
}

/** 阙: a stepped tower pair, each with a lower outer 子阙, flanking a roofed gate passage. */
export function gateHouse(b: Batch, x: number, y: number, z: number, gap: number, h: number, a = 0, depth = 8, pier = 7) {
  const f = new Frame(b, x, y, z, a);
  for (const s of [-1, 1]) {
    const px = s * (gap / 2 + pier / 2);
    f.box(px, .6, 0, pier + .6, 1.2, depth + .6, Q.stoneDark);
    f.box(px, h / 2, 0, pier, h, depth, Q.earth);
    for (let yy = 2.2; yy < h - .5; yy += 2.4) for (const sz of [-1, 1]) f.box(px, yy, sz * (depth / 2 + .04), pier, .2, .1, Q.wood, false);
    const tower = new Frame(b, x + Math.cos(a) * px, y, z - Math.sin(a) * px, a);
    // upper storey: timber-framed body on bracket sets, then a wide hip roof
    tower.box(0, h + .3, 0, pier + .8, .6, depth + .8, Q.wood, false);
    for (const bx of [-pier / 2 + .5, 0, pier / 2 - .5]) for (const bz of [-1, 1]) bracket(tower, bx, bz * (depth / 2 - .2), h + .6, .7, 1);
    tower.box(0, h + 3.1, 0, pier - 1.2, 3.4, depth - 1.2, Q.plaster, false);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) tower.box(sx * (pier / 2 - .6), h + 3.1, sz * (depth / 2 - .6), .45, 3.4, .45, Q.red, false);
    for (const sz of [-1, 1]) { tower.box(0, h + 3.4, sz * (depth / 2 - .55), pier - 2.4, 1.6, .08, Q.lacquer, false); for (let k = -3; k <= 3; k++) tower.box(k * .55, h + 3.4, sz * (depth / 2 - .5), .07, 1.6, .06, Q.redDark, false); }
    qinRoof(tower, pier - 1.2, depth - 1.2, h + 5.2, 2.6, Q.tile, 1.9);
    // 子阙: the lower outer tower stepping down from the main one
    const cx = s * (gap / 2 + pier + 2.4), sub = new Frame(b, x + Math.cos(a) * cx, y, z - Math.sin(a) * cx, a);
    sub.box(0, h * .35, 0, 4.4, h * .7, depth - 2, Q.earth); sub.box(0, .5, 0, 5, 1, depth - 1.4, Q.stoneDark);
    sub.box(0, h * .7 + 1.1, 0, 3.4, 2.2, depth - 3, Q.plaster, false);
    qinRoof(sub, 3.4, depth - 3, h * .7 + 2.4, 1.6, Q.tile, 1.3, false, { fins: false });
  }
  // lintel and the gate pavilion over the passage, clear of the road below
  f.box(0, h - 1, 0, gap + 1, 2, depth - 1, Q.wood);
  for (let k = -2; k <= 2; k++) f.box(k * gap / 5, h - 1.1, depth / 2 - .4, .7, .7, .2, Q.bronzeBright, false);
  f.box(0, h + .5, 0, gap + pier * 2, .8, depth + .4, Q.earthDark, false);
  f.box(0, h + 2.9, 0, gap - 1, 4, depth - 2, Q.plaster, false);
  for (let i = -1; i <= 1; i++) f.box(i * gap / 3, h + 2.9, depth / 2 - .9, .5, 4, .5, Q.red, false);
  for (let i = -1; i <= 1; i++) bracket(f, i * gap / 3, depth / 2 - .9, h + 4.9, .8);
  qinRoof(f, gap + pier * 2 - 2, depth - 1, h + 6, 3.6, Q.tile, 2.2);
  // heavy bronze-studded door leaves stand open against the piers
  for (const s of [-1, 1]) {
    f.box(s * (gap / 2 - .3), (h - 2) / 2, depth / 2 - gap / 4 - .7, .5, h - 2, gap / 2 - .4, Q.lacquer, false);
    for (let r = 0; r < 5; r++) for (let c = 0; c < 4; c++) f.box(s * (gap / 2 - .02), 1.2 + r * (h - 3.4) / 5, depth / 2 - 1.1 - c * (gap / 2 - 1.2) / 4, .12, .2, .2, Q.bronzeBright, false);
    f.cyl(s * (gap / 2 - .02), h * .42, depth / 2 - 1.2 - (gap / 2 - 1.6) / 2, .28, .1, Q.bronzeBright, false);
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

/** Place a primitive figure into a batch. Only parts marked solid collide. */
export function figure(b: Batch, prims: QinPrim[], x: number, y: number, z: number, yaw: number, collide = false, scale = 1) {
  placeFigure(prims, x, y, z, yaw, (g, color, m, solid) => b.add(g, color, m, collide && solid), scale);
}
/** Terracotta warrior; kind sets the role, variant the clay tone and pigment traces. */
export function warrior(b: Batch, x: number, y: number, z: number, a: number, kind: number, collide = false) {
  figure(b, warriorPrims((kind % 5) as WarriorKind, kind), x, y, z, a, collide);
}
export function horse(b: Batch, x: number, y: number, z: number, a: number, variant = 0) { figure(b, horsePrims(variant), x, y, z, a, false); }

/** 悬山: a two-slope roof whose purlins run past the gable walls, with bargeboards. */
export function gableRoof(f: Frame, w: number, d: number, eave: number, rise: number, color = Q.tile, overhang = 1.2, over = .9) {
  const sh = new Shell(f), x = w / 2 + over, z = d / 2 + overhang, lo = eave - .3, top = eave + rise;
  sh.quad([-x, lo, -z], [x, lo, -z], [x, top, 0], [-x, top, 0], [0, 1, -1]);
  sh.quad([-x, lo, z], [x, lo, z], [x, top, 0], [-x, top, 0], [0, 1, 1]);
  for (const s of [-1, 1]) {
    sh.quad([-x, lo, s * z], [x, lo, s * z], [x, lo - .4, s * z], [-x, lo - .4, s * z], [0, 0, s]);
    sh.quad([-x, lo - .4, s * z], [x, lo - .4, s * z], [x, top - .5, 0], [-x, top - .5, 0], [0, -1, 0]);
    sh.tri([s * x, lo, -z], [s * x, top, 0], [s * x, lo, z], [s, 0, 0]);
  }
  sh.done(color);
  // gable infill set back under the overhang, and the bargeboards over it
  const gs = new Shell(f);
  for (const s of [-1, 1]) gs.tri([s * w / 2, eave - .1, -d / 2], [s * w / 2, top - .3, 0], [s * w / 2, eave - .1, d / 2], [s, 0, 0]);
  gs.done(Q.plaster);
  for (const s of [-1, 1]) for (const sz of [-1, 1]) f.beam([s * (x + .02), lo - .1, sz * z], [s * (x + .02), top + .05, 0], .22, Q.wood);
  f.beam([-x - .2, top + .15, 0], [x + .2, top + .15, 0], .45, Q.ridge);
  for (const s of [-1, 1]) f.box(s * (x + .1), top + .38, 0, .3, .55, .3, Q.ridge, false);
  for (let i = -x + .4; i <= x - .4; i += .68) for (const sz of [-1, 1]) tileEnd(f, i, lo - .2, sz * (z + .04), 0, .15);
}

/** 直棂窗: a framed window of vertical bars; `z` is the wall's outer face. */
export function barWindow(f: Frame, x: number, y: number, z: number, w = 1.2, h = .9, bars = 5) {
  f.box(x, y, z, w + .2, h + .2, .1, Q.wood, false);
  f.box(x, y, z + .02, w, h, .06, Q.lacquer, false);
  for (let i = 0; i < bars; i++) f.box(x - w / 2 + w * (i + .5) / bars, y, z + .07, .07, h, .07, Q.woodPale, false);
}

/** Stone balustrade (勾栏): solid carved panels between posts, with a rounded top rail. */
export function balustrade(b: Batch, ax: number, az: number, bx: number, bz: number, y: number) {
  const len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(len / 2.2)), yaw = Math.atan2(bx - ax, bz - az);
  for (let i = 0; i <= n; i++) {
    const x = ax + (bx - ax) * i / n, z = az + (bz - az) * i / n;
    b.box(x, y, z, .38, 1.25, .38, Q.stone, yaw); b.add(new THREE.SphereGeometry(.2, 8, 6), Q.stone, new THREE.Matrix4().makeTranslation(x, y + 1.38, z), false);
    if (i < n) {
      const mx = ax + (bx - ax) * (i + .5) / n, mz = az + (bz - az) * (i + .5) / n, seg = len / n - .38;
      b.box(mx, y, mz, .18, .95, seg, Q.stone, yaw);
      const f = new Frame(b, mx, y, mz, yaw);
      for (const s of [-1, 1]) { f.box(s * .1, .5, 0, .03, .5, seg * .7, Q.stoneDark, false); f.box(s * .11, .5, 0, .02, .2, seg * .25, Q.stone, false); }
      f.cyl(0, 1.02, 0, .1, .1, Q.stone, false); f.beam([0, 1.02, -seg / 2], [0, 1.02, seg / 2], .16, Q.stone);
    }
  }
}

/** 鼎: a bronze tripod cauldron with upright handles. */
export function ding(b: Batch, x: number, y: number, z: number, s = 1, a = 0) {
  const f = new Frame(b, x, y, z, a);
  for (let k = 0; k < 3; k++) { const t = k / 3 * Math.PI * 2; f.beam([Math.cos(t) * .55 * s, 0, Math.sin(t) * .55 * s], [Math.cos(t) * .5 * s, .75 * s, Math.sin(t) * .5 * s], .16 * s, Q.bronze); }
  b.add(new THREE.SphereGeometry(.75 * s, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), Q.bronze, new THREE.Matrix4().compose(new THREE.Vector3(x, y + 1.35 * s, z), new THREE.Quaternion(), new THREE.Vector3(1, .9, 1)));
  f.cyl(0, 1.38 * s, 0, .78 * s, .14 * s, Q.bronzeBright, false);
  for (let k = 0; k < 8; k++) { const t = k / 8 * Math.PI * 2; f.box(Math.cos(t) * .72 * s, 1.05 * s, Math.sin(t) * .72 * s, .12 * s, .3 * s, .12 * s, Q.bronzeBright, false, -t); }
  for (const sx of [-1, 1]) { f.box(sx * .55 * s, 1.75 * s, 0, .1 * s, .55 * s, .45 * s, Q.bronze, false); f.box(sx * .55 * s, 2.0 * s, 0, .12 * s, .1 * s, .45 * s, Q.bronze, false); }
}

/** Black Qin standard on a pole: a tall swallow-tailed banner with a cinnabar border. */
export function banner(b: Batch, x: number, y: number, z: number, a = 0, h = 7) {
  const f = new Frame(b, x, y, z, a);
  f.box(0, .3, 0, .7, .6, .7, Q.stone); f.cyl(0, h / 2, 0, .09, h, Q.wood, false); f.cyl(0, h + .15, 0, .14, .3, Q.bronzeBright, false);
  f.box(0, h - .3, .55, .06, .1, 1.1, Q.wood, false);
  f.box(0, h - 1.55, .6, .03, 2.4, .95, Q.lacquer, false);
  for (const zz of [.2, 1]) f.box(0, h - 3.05, zz, .03, .6, .32, Q.lacquer, false);
  f.box(0, h - 1.55, .6, .04, 2.5, .08, Q.cinnabar, false); f.box(0, h - .4, .6, .04, .08, 1, Q.cinnabar, false);
}

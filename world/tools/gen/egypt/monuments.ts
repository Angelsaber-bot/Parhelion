import * as THREE from 'three';
import { Batch, T } from '../geo';
import { mulberry32 } from '../rng';
import { Frame } from '../orleans/craft';
import { Shell, walkStrip, slabBetween } from '../qin/craft';
import {
  EGYPT_MORTUARY, EGYPT_SACRED_LAKE, EGYPT_QUARRY, EGYPT_VILLAGE, EGYPT_FALLEN, EGYPT_ROOMS, EGYPT_TREASURY_DOOR, EGYPT_RIVER, EGYPT_TEMPLE, type EgyptPoint,
} from '../../../src/map/egyptPlan';
import { E, CYL8, batter, cornice, lotusColumn, obelisk, criosphinx, camel, pyramid } from './craft';
import { egyptRiver } from './landscape';
import { egyptRiverworksClearance } from '../../../src/map/egyptRiverworksPlan';

type V = [number, number, number];
type Height = (x: number, z: number) => number;
export interface MonumentKit {
  make: (name: string, material?: string, outline?: boolean) => Batch;
  heightAt: Height;
  roadDistance: (x: number, z: number) => number;
  glow: Batch; water: Batch; leaves: Batch; trunks: Batch; beams: Batch;
}
const BOXG = new THREE.BoxGeometry(1, 1, 1), SPH = new THREE.SphereGeometry(1, 12, 8), SPH6 = new THREE.SphereGeometry(1, 7, 5);
const DISC = new THREE.CircleGeometry(1, 16).rotateX(-Math.PI / 2), PLANE = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
const GRANITE = '#6f6560', GRANITE_RED = '#8f6f6a', SKIN = '#b0603c', PAVE = '#e1d2ae', PAVE2 = '#d4c39c';

/** Axis-aligned block between two corners, bottom at y0. */
function blk(b: Batch, x0: number, x1: number, z0: number, z1: number, y0: number, y1: number, color: string, collide = true) {
  if (x1 - x0 <= 0 || z1 - z0 <= 0 || y1 - y0 <= 0) return;
  b.box((x0 + x1) / 2, y0, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0, color, 0, collide);
}

// ───────────── sculpture and small architecture ─────────────

/** 奥西里斯柱像: a mummiform king, arms crossed with crook and flail, double crown; faces local +Z. */
export function osiride(b: Batch, x: number, y: number, z: number, yaw: number, h: number) {
  const f = new Frame(b, x, y, z, yaw), s = h / 6;
  f.box(0, .25 * s, 0, 1.4 * s, .5 * s, 1.3 * s, E.limestoneDark);
  const body = f.point(0, 2.6 * s, 0); b.add(new THREE.CylinderGeometry(.66 * s, .44 * s, 4.2 * s, 10), E.plaster, T(body.x, body.y, body.z, yaw, 1, 1, .72));
  f.box(0, 4.45 * s, 0, 1.55 * s, .55 * s, .92 * s, E.plaster);
  for (const k of [-1, 1]) f.beam([k * .66 * s, 4.3 * s, .18 * s], [-k * .22 * s, 3.65 * s, .56 * s], .24 * s, E.plaster);
  f.beam([-.12 * s, 3.3 * s, .64 * s], [.36 * s, 4.7 * s, .7 * s], .08 * s, E.gold); f.beam([.12 * s, 3.3 * s, .66 * s], [-.36 * s, 4.7 * s, .72 * s], .08 * s, E.lapis);
  f.box(0, 4.82 * s, .34 * s, 1.3 * s, .32 * s, .3 * s, E.faience, false);
  f.box(0, 5.25 * s, .05 * s, .72 * s, .82 * s, .76 * s, SKIN);
  for (const k of [-1, 1]) { f.box(k * .17 * s, 5.35 * s, .44 * s, .16 * s, .07 * s, .03 * s, E.black, false); f.box(k * .4 * s, 5.2 * s, .02 * s, .1 * s, .9 * s, .6 * s, E.blue, false); }
  f.box(0, 4.75 * s, .44 * s, .2 * s, .48 * s, .2 * s, E.black, false);
  const crown = f.point(0, 6.1 * s, 0); b.add(new THREE.CylinderGeometry(.16 * s, .4 * s, 1.15 * s, 8), E.plaster, T(crown.x, crown.y, crown.z), false);
  f.box(0, 5.68 * s, 0, .86 * s, .3 * s, .86 * s, E.red, false);
  f.box(0, 6.72 * s, 0, .2 * s, .2 * s, .2 * s, E.plaster, false);
}

/** A striding king with a back pillar, white kilt and nemes; faces local +Z. */
export function standingKing(b: Batch, x: number, y: number, z: number, yaw: number, s = 1, stone = E.sandstone) {
  const f = new Frame(b, x, y, z, yaw);
  f.box(0, .3 * s, .2 * s, 1.4 * s, .6 * s, 2.6 * s, E.limestoneDark);
  f.box(0, 3.3 * s, -.62 * s, .9 * s, 5.4 * s, .3 * s, stone);
  for (const [k, fw] of [[-1, .55], [1, -.25]] as const) { f.beam([k * .3 * s, 2.5 * s, 0], [k * .3 * s, .65 * s, fw * s], .36 * s, stone, true); f.box(k * .3 * s, .7 * s, fw * s + .25 * s, .34 * s, .2 * s, .8 * s, stone); }
  f.box(0, 2.85 * s, 0, 1.1 * s, .9 * s, .8 * s, E.linen);
  f.box(0, 2.85 * s, .41 * s, .3 * s, .8 * s, .04 * s, E.gold, false);
  f.box(0, 4.1 * s, 0, 1.2 * s, 1.7 * s, .66 * s, stone);
  f.box(0, 4.75 * s, .3 * s, 1.15 * s, .3 * s, .14 * s, E.faience, false);
  for (const k of [-1, 1]) { f.box(k * .72 * s, 3.9 * s, 0, .26 * s, 1.9 * s, .32 * s, stone); f.box(k * .72 * s, 2.9 * s, .02 * s, .3 * s, .3 * s, .36 * s, stone); }
  f.box(0, 5.35 * s, .02 * s, .62 * s, .72 * s, .62 * s, stone);
  const nem = f.point(0, 5.55 * s, -.06 * s); b.add(new THREE.CylinderGeometry(.34 * s, .62 * s, .9 * s, 4, 1), E.yellow, T(nem.x, nem.y, nem.z, yaw + Math.PI / 4, 1, 1, .85), false);
  for (let k = 0; k < 4; k++) f.box(0, 5.2 * s + k * .16 * s, -.4 * s, 1 * s - k * .1 * s, .05 * s, .04 * s, E.blue, false);
  f.box(0, 4.95 * s, .34 * s, .14 * s, .34 * s, .14 * s, E.black, false);
  f.box(0, 6.05 * s, .22 * s, .14 * s, .2 * s, .14 * s, E.gold, false);
}

/** 哈托尔柱: a round shaft under a four-faced Hathor capital with cow ears and a naos on top. */
export function hathorColumn(f: Frame, x: number, z: number, y: number, h: number) {
  f.box(x, y + .2, z, 1.3, .4, 1.3, E.limestoneDark);
  f.cyl(x, y + .4 + (h - 2.4) / 2, z, .5, h - 2.4, E.limestone);
  f.box(x, y + h - 1.2, z, 1.5, 1.6, 1.5, E.limestone);
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2, dx = Math.sin(a), dz = Math.cos(a);
    f.box(x + dx * .76, y + h - 1.25, z + dz * .76, .86, 1.15, .04, '#dcb48c', false, a);
    for (const s of [-1, 1]) { f.box(x + dx * .78 + Math.cos(a) * s * .52, y + h - 1.35, z + dz * .78 - Math.sin(a) * s * .52, .2, 1.3, .04, E.blue, false, a); f.box(x + dx * .78 + Math.cos(a) * s * .62, y + h - .7, z + dz * .78 - Math.sin(a) * s * .62, .3, .22, .03, '#dcb48c', false, a); }
    f.box(x + dx * .79, y + h - 1.1, z + dz * .79, .5, .07, .02, E.black, false, a);
  }
  f.box(x, y + h - .2, z, 1.1, .4, 1.1, E.limestoneDark);
  f.box(x, y + h + .25, z, .8, .5, .8, E.yellow, false);
}

/** Square pillar with a painted figure panel on its front face. */
function squarePillar(f: Frame, x: number, z: number, y: number, h: number, face: number, seed: number) {
  f.box(x, y + h / 2, z, 1.25, h, 1.25, E.limestone);
  f.box(x, y + h * .52, z + face * .64, .86, h * .62, .03, E.plaster, false);
  f.box(x - .12, y + h * .5, z + face * .66, .3, h * .36, .02, seed % 2 ? E.red : SKIN, false);
  f.box(x - .12, y + h * .74, z + face * .66, .22, .26, .02, E.black, false);
  f.box(x + .24, y + h * .52, z + face * .66, .14, h * .5, .02, E.blue, false);
  f.box(x, y + h * .86, z + face * .66, .7, .1, .02, E.yellow, false);
  f.box(x, y + h - .12, z, 1.45, .24, 1.45, E.limestoneDark);
}

/** A painted relief band on a wall face: boats, trees, offering bearers and glyph columns. */
function reliefBand(b: Batch, x0: number, x1: number, y: number, z: number, face: number, seed: number, axis: 'x' | 'z' = 'x') {
  const r = mulberry32(seed), put = (u: number, yy: number, w: number, h: number, c: string, out = .03) => {
    if (axis === 'x') b.box(u, yy, z + face * out, w, h, .02, c, 0, false); else b.box(z + face * out, yy, u, .02, h, w, c, 0, false);
  };
  put((x0 + x1) / 2, y, x1 - x0, 2.8, E.plaster, .015);
  put((x0 + x1) / 2, y + 2.7, x1 - x0, .12, E.blue); put((x0 + x1) / 2, y + .05, x1 - x0, .1, E.red);
  for (let u = x0 + .8; u < x1 - .8; u += 1.6) {
    const kind = Math.floor(r() * 4);
    if (kind === 0) { put(u, y + .6, 1.4, .3, E.wood); put(u, y + .9, .05, 1.1, E.wood); put(u + .15, y + 1.1, .7, .8, E.linen); }
    else if (kind === 1) { put(u, y + .4, .14, .9, E.trunk); put(u, y + 1.4, .9, .7, E.leaf); }
    else if (kind === 2) { put(u, y + .5, .34, 1.2, r() < .5 ? E.red : SKIN); put(u, y + 1.8, .26, .28, E.black); put(u + .3, y + 1.5, .36, .3, r() < .5 ? E.yellow : E.faience); }
    else for (let k = 0; k < 4; k++) put(u, y + .4 + k * .52, .3, .3, [E.blue, E.red, E.green, E.yellow][(k + Math.floor(u)) % 4]);
  }
}

/** Barrel vault of mudbrick along local Z (open half cylinder with end caps). */
function vault(f: Frame, x: number, z: number, y: number, w: number, len: number, color: string) {
  const sh = new Shell(f), n = 10, r = w / 2;
  const ring = (zz: number): V[] => Array.from({ length: n + 1 }, (_, i) => { const a = Math.PI * i / n; return [x + Math.cos(a) * r, y + Math.sin(a) * r, zz] as V; });
  const A = ring(z - len / 2), B = ring(z + len / 2);
  for (let i = 0; i < n; i++) sh.quad(A[i], A[i + 1], B[i + 1], B[i], [Math.cos(Math.PI * (i + .5) / n), Math.sin(Math.PI * (i + .5) / n), 0]);
  for (let i = 1; i < n - 1; i++) { sh.tri(A[0], A[i], A[i + 1], [0, 0, -1]); sh.tri(B[0], B[i], B[i + 1], [0, 0, 1]); }
  sh.done(color, true);
}

function sycamore(trunks: Batch, leaves: Batch, x: number, y: number, z: number, s: number, seed: number) {
  if (egyptRiverworksClearance(x, z, 3.9 * s)) return;
  const r = mulberry32(seed);
  trunks.add(CYL8, '#6b5238', T(x, y + 1.6 * s, z, 0, .45 * s, 3.2 * s, .45 * s));
  for (let k = 0; k < 3; k++) { const a = k * 2.1 + r(); trunks.add(CYL8, '#6b5238', T(x + Math.cos(a) * .9 * s, y + 3.4 * s, z + Math.sin(a) * .9 * s, 0, .22 * s, 1.6 * s, .22 * s, Math.sin(a) * .5, Math.cos(a) * .5), false); }
  for (let k = 0; k < 6; k++) { const a = k * 1.05 + r(), d = k ? 1.7 * s : 0; leaves.add(SPH6, k % 2 ? '#56763a' : '#4b6a34', T(x + Math.cos(a) * d, y + (4.4 + r() * .8) * s, z + Math.sin(a) * d, a, 2 * s, 1.3 * s, 2 * s), false); }
}

function silo(b: Batch, x: number, y: number, z: number, r: number, h: number, color = E.plaster) {
  b.add(new THREE.CylinderGeometry(r, r * 1.06, h, 12), color, T(x, y + h / 2, z));
  b.add(new THREE.SphereGeometry(r, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), color, T(x, y + h, z, 0, 1, .85, 1));
  b.add(BOXG, E.black, T(x, y + h * .3, z + r * .98, 0, .5, .6, .06), false);
  b.add(CYL8, E.brickDark, T(x, y + h + r * .85, z, 0, .25, .2, .25), false);
}

/** Black goat-hair tent: a sagging ridge on poles, open at the front (local +Z). */
function tent(b: Batch, x: number, y: number, z: number, yaw: number, w = 6) {
  const f = new Frame(b, x, y, z, yaw), sh = new Shell(f), hw = w / 2;
  const ridge = (u: number): V => [u, 2.2 - .25 * Math.cos(u / hw * Math.PI / 2 * 0) - .2 * Math.abs(u / hw), 0];
  const xs = [-hw, -hw / 2, 0, hw / 2, hw];
  for (let i = 0; i < xs.length - 1; i++) for (const s of [-1, 1]) {
    const a = ridge(xs[i]), c = ridge(xs[i + 1]);
    sh.quad(a, c, [xs[i + 1], 1.05, s * 2.4], [xs[i], 1.05, s * 2.4], [0, 1, s]);
  }
  sh.done('#3a302a');
  sh.quad([-hw, 1.05, -2.4], [hw, 1.05, -2.4], [hw, 0, -2.6], [-hw, 0, -2.6], [0, 0, -1]); sh.done('#4a3d33');
  for (const u of xs) { f.beam([u, 0, 0], ridge(u), .08, E.wood); }
  for (let k = 0; k < 3; k++) f.box(-hw + 1 + k * (w - 2) / 2, 1.06, 2.3, .9, .04, .3, [E.red, E.yellow, E.blue][k], false);
  f.box(0, .03, -.2, w - 1.4, .06, 3.6, E.red, false);
  for (let k = 0; k < 5; k++) f.box(-hw + 1.2 + k * (w - 2.4) / 4, .065, -.2, .2, .02, 3.6, E.yellow, false);
}

/** A dark, cut-away boat-shaped pit outline lying on the ground. */
function boatOutline(b: Batch, x: number, y: number, z: number, len: number, wid: number, yaw: number, color: string) {
  const v: number[] = [], n = 12, f = new Frame(b, x, y, z, yaw);
  for (let i = 0; i < n; i++) {
    const t0 = -1 + 2 * i / n, t1 = -1 + 2 * (i + 1) / n, w0 = wid / 2 * Math.sqrt(1 - t0 * t0), w1 = wid / 2 * Math.sqrt(1 - t1 * t1);
    const p = [f.point(-w0, 0, t0 * len / 2), f.point(w0, 0, t0 * len / 2), f.point(w1, 0, t1 * len / 2), f.point(-w1, 0, t1 * len / 2)];
    v.push(p[0].x, p[0].y, p[0].z, p[2].x, p[2].y, p[2].z, p[1].x, p[1].y, p[1].z, p[0].x, p[0].y, p[0].z, p[3].x, p[3].y, p[3].z, p[2].x, p[2].y, p[2].z);
  }
  const g = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); b.add(g, color, new THREE.Matrix4(), false); g.dispose();
}

// ───────────── the monuments ─────────────

/** Builds the second ring of Egypt: cliff temple, sacred lake, village, quarry, necropolis and the treasury.
 * Returns ground footprints [x, z, r] that vegetation keeps clear of. */
export function buildEgyptMonuments(k: MonumentKit): [number, number, number][] {
  const { make, heightAt, glow, water, leaves, trunks, beams } = k, keep: [number, number, number][] = [];
  const minGround = (x0: number, x1: number, z0: number, z1: number) => { let y = Infinity; for (let x = x0; x <= x1 + .01; x += Math.max(1, (x1 - x0) / 8)) for (let z = z0; z <= z1 + .01; z += Math.max(1, (z1 - z0) / 8)) y = Math.min(y, heightAt(x, z)); return y; };
  const maxGround = (x0: number, x1: number, z0: number, z1: number) => { let y = -Infinity; for (let x = x0; x <= x1 + .01; x += Math.max(1, (x1 - x0) / 8)) for (let z = z0; z <= z1 + .01; z += Math.max(1, (z1 - z0) / 8)) y = Math.max(y, heightAt(x, z)); return y; };
  const lamp = (b: Batch, x: number, y: number, z: number) => { b.add(CYL8, E.gold, T(x, y + .6, z, 0, .12, 1.2, .12), false); b.add(CYL8, E.gold, T(x, y + 1.25, z, 0, .32, .12, .32), false); glow.add(new THREE.SphereGeometry(.2, 8, 6), E.ember, T(x, y + 1.42, z), false); };
  const stars = (b: Batch, x0: number, x1: number, z0: number, z1: number, y: number, n: number) => { blk(b, x0, x1, z0, z1, y - .06, y - .01, E.lapis, false); for (let i = 0; i < n; i++) glow.add(new THREE.OctahedronGeometry(.13, 0), E.yellow, T(x0 + .6 + (i * 37 % 97) / 97 * (x1 - x0 - 1.2), y - .12, z0 + .6 + (i * 53 % 89) / 89 * (z1 - z0 - 1.2)), false); };

  cliffTemple(); sacredLake(); templeDetails(); magazines(); village(); granary(); fields(); camp(); quarry(); necropolis(); fallenColossus(); desertRuin(); treasury();
  return keep;

  // 崖壁祭庙: three terraces, porticoes, Hathor kiosks, Osiride colonnade and the rock-cut sanctuary
  function cliffTemple() {
    const b = make('CliffTemple'), M = EGYPT_MORTUARY, ax = M.axis, g = new Frame(b, 0, 0, 0);
    const [fx0, fx1, fz0, fz1, fy] = M.forecourt, [mx0, mx1, mz0, mz1, my] = M.middle, [ux0, ux1, uz0, uz1, uy] = M.upper, P = M.portico;
    keep.push([ax, (fz0 + fz1) / 2 - 10, 46]);
    // forecourt: paving skin on the levelled ground, an enclosure wall and a small gate
    for (let x = fx0 + 2; x < fx1 - 1; x += 4) for (let z = fz0 + 2; z < fz1 - 1; z += 4) b.box(x, fy + .01, z, 3.85, .04, 3.85, (Math.round(x + z) & 4) ? PAVE : PAVE2, 0, false);
    const wallBase = (x0: number, x1: number, z0: number, z1: number) => minGround(x0, x1, z0, z1) - .4;
    for (const [x0, x1] of [[fx0, ax - 6], [ax + 6, fx1]] as const) { blk(b, x0, x1, fz1, fz1 + .9, wallBase(x0, x1, fz1, fz1 + .9), fy + 2.2, E.limestoneDark); for (let x = x0 + 1; x < x1 - .5; x += 2) b.box(x, fy + 2.2, fz1 + .45, 1.2, .5, .9, E.limestone, 0, false); }
    for (const x of [fx0 - .9, fx1]) blk(b, x, x + .9, fz0, fz1 + .9, wallBase(x, x + .9, fz0, fz1), fy + 2.2, E.limestoneDark);
    for (const s of [-1, 1]) { const { tw, td, y1 } = batter(g, ax + s * 9.5, fz1 + .45, 7, 3.2, fy - .4, 5.2, .1, E.sandstone); cornice(g, ax + s * 9.5, fz1 + .45, tw * 2, td * 2, y1, E.sandstone); b.box(ax + s * 9.5, fy + 1.2, fz1 + 2.0, 4.6, 2.6, .05, E.plaster, 0, false); for (let i = 0; i < 3; i++) b.box(ax + s * 9.5 - 1.4 + i * 1.4, fy + 1.9, fz1 + 2.04, .6, 1.5, .04, [E.red, E.blue, E.yellow][i], 0, false); }
    for (const s of [-1, 1]) criosphinx(b, ax + s * 7, heightAt(ax + s * 7, 24), 24, s * Math.PI / 2 + Math.PI);
    for (const s of [-1, 1]) obelisk(b, ax + s * 9, fy, 8, 10, 0);
    // papyrus pools and myrrh trees in round pits
    for (const s of [-1, 1]) {
      const px = ax + s * 22, pz = -5; b.box(px, fy - .05, pz, 7.4, .35, 6.4, E.limestoneDark, 0, false); water.add(PLANE, E.water, T(px, fy + .12, pz, 0, 6.6, 1, 5.6), false);
      for (let i = 0; i < 26; i++) { const x = px - 3 + (i * 37 % 60) / 10, z = pz - 2.6 + (i * 23 % 52) / 10; leaves.add(CYL8, E.reed, T(x, fy + .9, z, 0, .04, 1.6, .04), false); leaves.add(new THREE.ConeGeometry(.3, .3, 6), E.leaf, T(x, fy + 1.8, z, 0, 1, 1, 1, Math.PI), false); }
      for (const tz of [-16, 6]) { const tx = ax + s * 13; b.add(new THREE.CylinderGeometry(1.4, 1.5, .5, 12), E.limestoneDark, T(tx, fy + .2, tz), false); b.add(DISC, '#7a5c3c', T(tx, fy + .46, tz, 0, 1.2, 1, 1.2), false); trunks.add(CYL8, '#6b5238', T(tx, fy + 1.4, tz, 0, .16, 2.2, .16), false); leaves.add(SPH6, '#5f7d3c', T(tx, fy + 3, tz, 0, 1.6, 1.1, 1.6), false); leaves.add(SPH6, '#6f8d45', T(tx + .5, fy + 3.5, tz - .3, 0, 1, .8, 1), false); }
    }
    // the terraces themselves: plain dressed retaining walls of pale limestone
    const bot = minGround(mx0, mx1, mz0, uz1) - 1.5;
    blk(b, mx0, mx1, mz0, mz1, bot, my, E.limestone); blk(b, ux0, ux1, uz0, uz1, bot, uy, E.limestone);
    for (let x = mx0 + 2; x < mx1 - 1; x += 4) for (let z = mz0 + 2; z < mz1 - 1; z += 4) b.box(x, my + .01, z, 3.85, .03, 3.85, (Math.round(x + z) & 4) ? PAVE : PAVE2, 0, false);
    for (let x = ux0 + 2; x < ux1 - 1; x += 4) for (let z = uz0 + 2; z < uz1 - 1; z += 4) b.box(x, uy + .01, z, 3.85, .03, 3.85, (Math.round(x + z) & 4) ? PAVE : PAVE2, 0, false);
    // ramps on the axis, with stepped bodies, balustrades and lion-headed ends
    for (const r of M.ramps) {
      const n = 8; for (let i = 0; i < n; i++) { const a = r.z0 + (r.z1 - r.z0) * i / n, c = r.z0 + (r.z1 - r.z0) * (i + 1) / n, y = r.y0 + (r.y1 - r.y0) * i / n - .06; blk(b, ax - 4, ax + 4, Math.min(a, c), Math.max(a, c), r.y0 - (r.y0 === fy ? .6 : 0), Math.max(r.y0 + .01, y), E.limestoneDark, false); }
      walkStrip(b, [[ax, r.y0, r.z0], [ax, r.y1, r.z1 - .05]], 8, PAVE);
      for (const s of [-1, 1]) { slabBetween(b, [ax + s * 4.3, r.y0 + .5, r.z0], [ax + s * 4.3, r.y1 + .5, r.z1], .6, 1, E.limestone); const f = new Frame(b, ax + s * 4.3, r.y0, r.z0 + .6); f.box(0, .7, 0, .9, 1.4, 1.4, E.limestoneDark); const hd = f.point(0, 1.6, .4); b.add(SPH, E.sandstone, T(hd.x, hd.y, hd.z, 0, .45, .5, .55), false); }
    }
    // porticoes: square pillars under a roof that continues the terrace above
    const portico = (x0: number, x1: number, zBack: number, yFloor: number, yRoof: number, seed: number) => {
      for (const [a, c] of [[x0, ax - 5], [ax + 5, x1]] as const) {
        blk(b, a, c, zBack - .4, zBack + P, yRoof - .8, yRoof, E.limestone);
        b.box((a + c) / 2, yRoof - .8, zBack + P - .02, c - a, .8, .06, E.limestoneDark, 0, false);
        for (let x = a + 1.4; x < c - .9; x += 3.2) squarePillar(g, x, zBack + P - .7, yFloor, yRoof - .8 - yFloor, 1, Math.round(x));
        reliefBand(b, a + .4, c - .4, yFloor + .7, zBack, 1, seed + Math.round(a));
      }
    };
    portico(mx0, mx1, mz1, fy, my, 61); portico(ux0, ux1, uz1, my, uy, 67);
    // Hathor kiosks on the middle terrace
    for (const s of [-1, 1]) {
      const kx = ax + s * 19, kz = -34, f = new Frame(b, kx, my, kz);
      for (const cx of [-2.3, 2.3]) for (const cz of [-2.3, 2.3]) hathorColumn(f, cx, cz, 0, 5);
      f.box(0, 5.85, 0, 6.2, .7, 6.2, E.limestone); cornice(f, 0, 0, 6, 6, 6.2, E.limestone);
      f.box(0, .25, 0, 3.4, .5, 2, E.limestoneDark);
      f.box(0, 1.2, 0, 1, 1.1, 2.2, '#8a6a46'); f.box(0, 1.55, 1.25, .7, .7, .8, '#8a6a46'); for (const e of [-1, 1]) f.beam([e * .3, 1.9, 1.3], [e * .55, 2.6, 1.15], .08, E.gold);
      f.cyl(0, 2.7, 1.2, .3, .06, E.gold, false);
      for (const lx of [-1, 1]) for (const lz of [-1, 1]) f.box(lx * .35, .55, lz * .8, .2, .6, .2, '#8a6a46', false);
    }
    // upper terrace: Osiride colonnade over the ramp head, a granite gateway, side colonnades and the court
    for (let x = ux0 + 2; x < ux1 - 1.5; x += 3.6) { if (Math.abs(x - ax) < 4) continue; g.box(x, uy + 2.6, uz1 - 2.6, 1.2, 5.2, 1.2, E.limestone); osiride(b, x, uy, uz1 - 1.75, 0, 5); }
    blk(b, ux0 + .5, ux1 - .5, uz1 - 3.6, uz1 - .4, uy + 5.2, uy + 6, E.limestone); cornice(g, ax, uz1 - 2, ux1 - ux0 - 1.2, 3.2, uy + 6, E.limestone);
    for (const s of [-1, 1]) blk(b, ax + s * 3 - .7, ax + s * 3 + .7, uz1 - 3.2, uz1 - 1.6, uy, uy + 5.2, GRANITE_RED);
    b.box(ax, uy + 4.4, uz1 - 1.55, 4.6, .8, .06, E.gold, 0, false);
    for (const x of [ux0 + 3, ux1 - 3]) for (let z = uz1 - 7; z > uz0 + 2.5; z -= 3.6) { g.cyl(x, uy + 2.6, z, .55, 5.2, E.limestone); g.box(x, uy + 5.35, z, 1.4, .3, 1.4, E.limestoneDark); }
    for (const x of [ux0 + .5, ux1 - 3.9]) blk(b, x, x + 3.4, uz0 + 1, uz1 - 4.5, uy + 5.2, uy + 5.9, E.limestone);
    { const f = new Frame(b, ax - 12, uy, -60); f.box(0, .4, 0, 5, .8, 4, E.limestoneDark); f.box(0, 1.1, 0, 3.6, .6, 2.6, E.limestone); f.box(0, 1.5, 0, 2.4, .2, 1.6, E.gold, false); for (let i = 0; i < 3; i++) f.box(0, .15 + i * .27, 2.3 + i * .35, 2, .27, .35, E.limestoneDark, false); glow.add(new THREE.ConeGeometry(.3, .6, 8), E.ember, T(ax - 12, uy + 1.95, -60), false); }
    // back cliff revetment with statue niches either side of the sanctuary facade
    const S = M.sanctuary;
    for (const [a, c] of [[ux0, S.x0 - 2], [S.x1 + 2, ux1]] as const) {
      blk(b, a, c, uz0 - 1.4, uz0, uy - .5, uy + 9, E.sandstone);
      for (let x = a + 1.8; x < c - 1.2; x += 3.2) { b.box(x, uy + 1.2, uz0 + .02, 1.6, 3.2, .06, E.black, 0, false); standingKing(b, x, uy + .5, uz0 + .45, 0, .52, E.limestone); b.box(x, uy + .5, uz0 + .45, 1.8, .5, 1, E.limestoneDark, 0, false); }
      cornice(g, (a + c) / 2, uz0 - .7, c - a, 1.4, uy + 9, E.sandstone);
    }
    // the rock-cut sanctuary: facade with winged disc, two colossal Osirides, starry halls inside
    const sf = S.floor, st = S.floor + S.height;
    blk(b, S.x0, S.x1, S.z0, S.z1, sf - 1.2, sf, '#cdbb94');
    blk(b, S.x0 - 2.4, S.x0, S.z0 - 1.4, S.z1, sf - 1.2, st + 1.4, E.sandstone); blk(b, S.x1, S.x1 + 2.4, S.z0 - 1.4, S.z1, sf - 1.2, st + 1.4, E.sandstone);
    blk(b, S.x0 - 2.4, S.x1 + 2.4, S.z0 - 1.4, S.z0, sf - 1.2, st + 1.4, E.sandstone);
    blk(b, S.x0 - 2.4, S.x1 + 2.4, S.z0 - 1.4, S.z1 + 1.2, st, st + 1.4, E.sandstone);
    const fz = S.z1, dw = 2.1, dh = 4.6;
    blk(b, S.x0 - 4, ax - dw, fz, fz + 1.2, sf, st + 4, E.sandstone); blk(b, ax + dw, S.x1 + 4, fz, fz + 1.2, sf, st + 4, E.sandstone); blk(b, ax - dw, ax + dw, fz, fz + 1.2, sf + dh, st + 4, E.sandstone);
    cornice(g, ax, fz + .6, S.x1 - S.x0 + 8, 1.2, st + 4, E.sandstone);
    for (const s of [-1, 1]) { blk(b, ax + s * (dw + .35) - .35, ax + s * (dw + .35) + .35, fz + 1.2, fz + 1.5, sf, sf + dh + .4, GRANITE_RED, false); }
    blk(b, ax - dw - .7, ax + dw + .7, fz + 1.2, fz + 1.5, sf + dh, sf + dh + .7, GRANITE_RED, false);
    b.box(ax, sf + dh + 1.4, fz + 1.23, 2.2, 1, .05, E.gold, 0, false); for (const s of [-1, 1]) b.box(ax + s * 2.6, sf + dh + 1.5, fz + 1.23, 3, .7, .04, E.blue, 0, false);
    reliefBand(b, S.x0 - 3.6, ax - dw - .8, sf + 3, fz + 1.2, 1, 71); reliefBand(b, ax + dw + .8, S.x1 + 3.6, sf + 3, fz + 1.2, 1, 73);
    for (const s of [-1, 1]) osiride(b, ax + s * 12.2, uy, fz + 2.2, 0, 8.4);
    // inside: front hall with two pillars, inner shrine with a barque stand and the god's niche
    for (const s of [-1, 1]) squarePillar(g, ax + s * 3.2, -75, sf, S.height, 1, s + 3);
    stars(b, S.x0, S.x1, S.z0, S.z1, st, 70);
    for (const x of [S.x0 + .03, S.x1 - .03]) { const face = x < ax ? 1 : -1; for (let z = S.z0 + 1.5; z < S.z1 - 1; z += 3.2) { b.box(x + face * .02, sf + 1.6, z, .02, 2.6, 2.6, E.plaster, 0, false); for (let i = 0; i < 3; i++) b.box(x + face * .04, sf + 1.6 + i * .7, z - .6 + i * .6, .02, .6, .5, [E.red, E.blue, E.yellow][i], 0, false); } }
    blk(b, ax - 1.6, ax + 1.6, -82.6, -77.4, sf, sf + 1, E.limestoneDark); b.box(ax, sf + .55, -77.37, 3, .3, .04, E.blue, 0, false); b.box(ax, sf + .25, -77.37, 3, .2, .04, E.red, 0, false); blk(b, ax - 1.9, ax + 1.9, -82.9, -77.1, sf, sf + .2, E.limestone);
    { const f = new Frame(b, ax, sf + 1, -80, Math.PI / 2), sh = new Shell(f), L = 2.4; const ring = (zz: number, w: number, yy: number): V[] => [[-w, yy + .4, zz], [w, yy + .4, zz], [w * .5, yy, zz], [-w * .5, yy, zz]]; const sec = [ring(-L, .1, .9), ring(-L * .5, .55, .1), ring(L * .5, .55, .1), ring(L, .1, .9)]; for (let i = 1; i < sec.length; i++) { const p = sec[i - 1], q = sec[i]; sh.quad(p[0], q[0], q[3], p[3], [-1, -.3, 0]); sh.quad(p[1], q[1], q[2], p[2], [1, -.3, 0]); sh.quad(p[3], q[3], q[2], p[2], [0, -1, 0]); } sh.done(E.gold); f.box(0, .9, 0, .7, .7, 1, E.lapis, false); }
    b.box(ax, sf + .6, S.z0 + .02, 3.2, 4.4, .05, E.black, 0, false);
    standingKing(b, ax, sf, S.z0 + .9, 0, .66, E.gold);
    for (const [x, z] of [[S.x0 + 1.4, S.z1 - 2], [S.x1 - 1.4, S.z1 - 2], [S.x0 + 1.4, S.z0 + 2], [S.x1 - 1.4, S.z0 + 2]] as const) lamp(b, x, sf, z);
  }

  // 圣湖: the paved precinct, stepped basin, kiosk and the great granite scarab
  function sacredLake() {
    const b = make('SacredLake'), L = EGYPT_SACRED_LAKE, [px0, px1, pz0, pz1, py] = L.precinct, [bx0, bx1, bz0, bz1] = L.basin, bot = minGround(px0, px1, pz0, pz1) - 1.2, g = new Frame(b, 0, 0, 0);
    keep.push([(px0 + px1) / 2, (pz0 + pz1) / 2, 30]);
    blk(b, px0, px1, pz0, bz0, bot, py, E.limestoneDark); blk(b, px0, px1, bz1, pz1, bot, py, E.limestoneDark);
    blk(b, px0, bx0, bz0, bz1, bot, py, E.limestoneDark); blk(b, bx1, px1, bz0, bz1, bot, py, E.limestoneDark);
    for (let x = px0 + 1; x < px1; x += 2) for (let z = pz0 + 1; z < pz1; z += 2) if (x < bx0 - .5 || x > bx1 + .5 || z < bz0 - .5 || z > bz1 + .5) b.box(x, py + .005, z, 1.94, .03, 1.94, (Math.round(x + z) & 2) ? PAVE : '#d8c8a2', 0, false);
    // four flights of steps down to the bed; the lowest are under water
    for (let s = 0; s < 4; s++) { const i = s * 1.2, j = i + 1.2, y = py - (s + 1) * .7; for (const [a, c, d, e] of [[bx0 + i, bx1 - i, bz0 + i, bz0 + j], [bx0 + i, bx1 - i, bz1 - j, bz1 - i], [bx0 + i, bx0 + j, bz0 + j, bz1 - j], [bx1 - j, bx1 - i, bz0 + j, bz1 - j]] as const) blk(b, a, c, d, e, L.bed - 1, y, s % 2 ? E.limestone : E.limestoneDark); }
    blk(b, bx0 + 4.8, bx1 - 4.8, bz0 + 4.8, bz1 - 4.8, L.bed - 1, L.bed, '#8a8468');
    water.add(PLANE, E.water, T((bx0 + bx1) / 2, L.surface, (bz0 + bz1) / 2, 0, bx1 - bx0 - 2.4, 1, bz1 - bz0 - 2.4), false);
    // kerb round the rim, with gaps at the middle of each side for the stairs
    for (const [a, c, d, e] of [[bx0 - .6, bx1 + .6, bz0 - .6, bz0], [bx0 - .6, bx1 + .6, bz1, bz1 + .6], [bx0 - .6, bx0, bz0, bz1], [bx1, bx1 + .6, bz0, bz1]] as const) {
      const alongX = c - a > e - d, mid = alongX ? (a + c) / 2 : (d + e) / 2;
      if (alongX) { blk(b, a, mid - 2, d, e, py, py + .55, E.limestone); blk(b, mid + 2, c, d, e, py, py + .55, E.limestone); } else { blk(b, a, c, d, mid - 2, py, py + .55, E.limestone); blk(b, a, c, mid + 2, e, py, py + .55, E.limestone); }
    }
    // lotus pads and flowers, papyrus in the corners, geese
    const r = mulberry32(441);
    for (let i = 0; i < 46; i++) { const x = bx0 + 2.6 + r() * (bx1 - bx0 - 5.2), z = bz0 + 2.6 + r() * (bz1 - bz0 - 5.2); if (Math.abs(x - (bx0 + bx1) / 2) < 4 && Math.abs(z - (bz0 + bz1) / 2) < 5) continue; leaves.add(DISC, i % 3 ? '#4f7a3a' : '#5f8a44', T(x, L.surface + .03, z, r() * 6, .55 + r() * .4, 1, .55 + r() * .4), false); if (i % 4 === 0) leaves.add(new THREE.ConeGeometry(.18, .25, 6), i % 8 ? '#f1e6f0' : '#dc8fb0', T(x + .2, L.surface + .18, z, 0, 1, 1, 1, Math.PI), false); }
    for (const [cx, cz] of [[bx0 + 2.4, bz0 + 2.4], [bx1 - 2.4, bz0 + 2.4], [bx0 + 2.4, bz1 - 2.4], [bx1 - 2.4, bz1 - 2.4]] as const) for (let i = 0; i < 14; i++) { const x = cx + (r() - .5) * 2.4, z = cz + (r() - .5) * 2.4; leaves.add(CYL8, E.reed, T(x, L.surface + .8, z, 0, .04, 1.6, .04), false); leaves.add(new THREE.ConeGeometry(.3, .3, 6), E.leaf, T(x, L.surface + 1.7, z, 0, 1, 1, 1, Math.PI), false); }
    for (const [x, z, a] of [[148, -110, .6], [151, -122, 2.4]] as const) { const f = new Frame(b, x, L.surface, z, a); f.box(0, .12, 0, .5, .32, .9, E.plaster, false); f.beam([0, .2, .35], [0, .7, .55], .12, E.plaster); f.box(0, .74, .6, .14, .1, .22, E.ember, false); }
    // 圣甲虫: the colossal granite scarab on its pedestal at the lake's corner
    { const x = px0 + 4, z = pz0 + 3.6, f = new Frame(b, x, py, z, Math.PI * .1); f.box(0, .9, 0, 3.4, 1.8, 4.4, GRANITE_RED); cornice(f, 0, 0, 3.2, 4.2, 1.8, GRANITE_RED);
      const top = 1.8 + 1.45; const bd = f.point(0, top + .55, -.3); b.add(SPH, GRANITE, T(bd.x, bd.y, bd.z, Math.PI * .1, 1.15, .62, 1.55)); const hd = f.point(0, top + .3, 1.3); b.add(SPH, GRANITE, T(hd.x, hd.y, hd.z, Math.PI * .1, .7, .38, .45), false);
      f.box(0, top + 1.05, -.4, .04, .08, 2.6, '#4e4642', false);
      for (const s of [-1, 1]) for (let i = 0; i < 3; i++) f.beam([s * .7, top + .2, .5 - i * .7], [s * 1.35, top - .05, .8 - i * .8], .12, GRANITE);
      f.cyl(0, top + .35, 1.95, .38, .1, E.gold, false); }
    // kiosk of four lotus columns on the far side
    { const x = (bx1 + px1) / 2, z = (bz0 + bz1) / 2, f = new Frame(b, x, py, z); for (const cx of [-1.9, 1.9]) for (const cz of [-1.9, 1.9]) lotusColumn(f, cx, cz, 0, 4.2, .34); f.box(0, 4.45, 0, 5, .5, 5, E.limestone, false); cornice(f, 0, 0, 4.8, 4.8, 4.7); f.box(0, .5, 0, 1.3, 1, 1.3, E.limestoneDark); f.cyl(0, 1.1, 0, .45, .18, E.gold, false); }
    // shade over the west walk: a reed awning for the priests on duty
    for (const z of [-104, -128]) { const f = new Frame(b, px0 + 4.5, py, z); for (const cx of [-1.6, 1.6]) for (const cz of [-1.4, 1.4]) f.box(cx, 1.3, cz, .14, 2.6, .14, E.wood, false); f.box(0, 2.62, 0, 3.6, .06, 3.2, E.reed, false); f.box(0, .4, 0, 1.6, .8, .7, E.wood, false); }
    void g;
  }

  // temple additions: hall reliefs, kings at the hall portico, flag masts on the inner pylon
  function templeDetails() {
    const b = make('TempleDetails'), [hx0, hx1, hz0, hz1] = EGYPT_TEMPLE.hall, top = EGYPT_TEMPLE.terrace[4];
    for (const [x, face] of [[hx0 + 1, 1], [hx1 - 1, -1]] as const) { reliefBand(b, hz0 + 1.5, hz1 - 1.5, top + 1.4, x, face, 101 + x, 'z'); reliefBand(b, hz0 + 1.5, hz1 - 1.5, top + 4.6, x, face, 141 + x, 'z'); }
    for (const s of [-1, 1]) standingKing(b, 80 + s * 7.2, top, EGYPT_TEMPLE.court[2] + 3.4, 0, .95);
  }

  // 拱顶仓库: twelve barrel-vaulted mudbrick storerooms behind the temple
  function magazines() {
    const b = make('Magazines'), g = new Frame(b, 0, 0, 0);
    // Retain the twelve working storerooms west of the excavated service court.
    const shift = -44;
    keep.push([15 + shift, -176, 26]);
    for (const [z0, z1, door] of [[-196, -178, 1], [-174, -156, -1]] as const) for (let i = 0; i < 6; i++) {
      const x = 3.4 + i * 4.6 + shift, w = 4.2, base = minGround(x - w / 2, x + w / 2, z0, z1) - .6, top = maxGround(x - w / 2, x + w / 2, z0, z1) + 2.6;
      blk(b, x - w / 2, x + w / 2, z0, z1, base, top, i % 2 ? E.brick : E.brickDark);
      vault(g, x, (z0 + z1) / 2, top, w, z1 - z0, E.brick);
      const dz = door > 0 ? z1 : z0;
      for (const ez of [z0, z1]) { const o = ez === z1 ? 1 : -1; b.box(x, base, ez + o * .06, w - .1, top - base - .05, .1, ez === dz ? '#e8d6b0' : E.brickDark, 0, false); }
      b.box(x, top - 2.4, dz + door * .03, 1.3, 2.1, .05, E.black, 0, false); b.box(x, top - .3, dz + door * .04, 1.9, .25, .06, E.wood, 0, false);
      if (i % 2 === 0) for (let j = 0; j < 3; j++) b.add(new THREE.SphereGeometry(.35, 8, 6), '#b86e45', T(x - .9 + j * .9, heightAt(x, dz + door * 1.2) + .4, dz + door * 1.2, 0, 1, 1.3, 1), false);
    }
    // the open lane between the rows holds a scribe's table and stacked amphorae
    const y = heightAt(12 + shift, -176); b.box(12 + shift, y, -176, 2.2, .8, 1, E.wood, 0, false); b.box(12 + shift, y + .82, -176, .5, .05, .7, E.linen, 0, false);
    for (let j = 0; j < 8; j++) b.add(new THREE.CylinderGeometry(.22, .14, .9, 8), '#b86e45', T(18 + shift + (j % 4) * .5, heightAt(18 + shift, -176) + .45 + Math.floor(j / 4) * .5, -175.4 - (j % 2) * .4), false);
  }

  // 工匠村: a walled village of row houses on one street, a chapel at its end, granaries and tomb-chapels outside
  function village() {
    const b = make('Village'), V = EGYPT_VILLAGE, [x0, x1, z0, z1] = V.rect, y = V.ground, g = new Frame(b, 0, 0, 0), sz = V.gate[1];
    keep.push([(x0 + x1) / 2, (z0 + z1) / 2, 30]);
    const wb = minGround(x0, x1, z0, z1) - .5, wt = y + 3.4;
    // The hydraulic works have a real south service gate and a lane from the
    // village street. Keep the wall and row houses out of that opening.
    blk(b, x0, -60.5, z1, z1 + .8, wb, wt, E.brick);
    blk(b, -51.5, x1, z1, z1 + .8, wb, wt, E.brick);
    for (const x of [-60.5, -51.5]) b.box(x, y + 1.8, z1 + .4, .6, 3.6, 1.2, E.brickDark);
    blk(b, x0, x1, z0 - .8, z0, wb, wt, E.brick); blk(b, x1, x1 + .8, z0 - .8, z1 + .8, wb, wt, E.brick);
    blk(b, x0 - .8, x0, z0 - .8, sz - 2.2, wb, wt, E.brick); blk(b, x0 - .8, x0, sz + 2.2, z1 + .8, wb, wt, E.brick);
    for (const s of [-1, 1]) blk(b, x0 - 1.2, x0 + .4, sz + s * 2.2 - .6, sz + s * 2.2 + .6, wb, wt + .8, E.brickDark);
    blk(b, x0 - 1.2, x0 + .4, sz - 2.8, sz + 2.8, wt + .2, wt + 1, E.brickDark);
    for (let x = x0 + .5; x < x1; x += 4) b.box(x, y + .01, sz, 3.95, .03, 3.9, '#cdb88a', 0, false);
    const rng = mulberry32(611);
    for (const [row, front, yaw] of [[1, sz + 2, Math.PI], [-1, sz - 2, 0]] as const) for (let i = 0; i < 7; i++) {
      if (row === 1 && i === 4) continue;
      const cx = x0 + 3.5 + i * 5.4, d = 10.6, cz = front + row * d / 2, lime = (i + (row > 0 ? 0 : 1)) % 3 !== 1, wall = lime ? ((i % 2) ? E.plaster : '#e8d6b0') : E.brick, h = 3.1 + (i % 3) * .25;
      const f = new Frame(b, cx, y, cz, yaw);
      f.box(0, (h + 1) / 2 - 1, 0, 5, h + 1, d, wall);
      f.box(0, h + .1, 0, 5.2, .2, d + .2, '#c4a676');
      for (let j = 0; j < 7; j++) f.cyl(-2.2 + j * .73, h - .12, d / 2 + .08, .08, .16, E.trunk, false);
      if (i % 3 === 0) { f.box(-1.2, h + 1.1, -d / 2 + 2.2, 2.2, 2, 2.8, wall); f.box(-1.2, h + 1, -d / 2 + 3.62, .7, 1.3, .04, E.black, false); }
      if (i % 3 === 2) for (let j = 0; j < 4; j++) f.box(-1.4 + j * .9, h + .23, -1, .7, .06, 2.2, ['#d6b65e', '#c74b2e', '#d6b65e', '#8a9a52'][j], false);
      if (i % 4 === 1) for (let j = 0; j < 3; j++) { const p = f.point(1.4, 0, -d / 2 + 1.4 + j * .9); b.add(new THREE.CylinderGeometry(.35, .3, .5, 8), E.reed, T(p.x, y + h + .45, p.z), false); }
      for (const s of [-1, 1]) f.box(s * 2.5, h + .5, 0, .2, .6, d, wall, false);
      f.box(0, h + .5, -d / 2, 5, .6, .2, wall, false);
      f.box(-.6, 1.05, d / 2 + .02, 1.1, 2.1, .05, E.black, false); f.box(-.6, 2.2, d / 2 + .06, 1.6, .2, .12, E.wood, false);
      f.box(1.4, 2.4, d / 2 + .02, .7, .4, .04, E.black, false);
      if (lime) f.box(-.6, 2.55, d / 2 + .04, 1.3, .18, .03, E.red, false);
      if (i % 2 === 0) { for (const s of [-1, 1]) f.box(1 + s * 1.1, h + 1.4, d / 2 - 1.4, .1, 2, .1, E.wood, false); f.box(1, h + 2.4, d / 2 - 2.2, 2.6, .05, 2.2, E.reed, false); }
      if (i % 3 === 1) { const ov = f.point(1.6, 0, d / 2 + .9); b.add(new THREE.SphereGeometry(.7, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), E.brick, T(ov.x, y, ov.z), false); }
      for (let j = 0; j < 2; j++) { const p = f.point(1 + j * .6, 0, d / 2 + .5); b.add(new THREE.SphereGeometry(.26, 8, 6), '#b86e45', T(p.x, y + .3, p.z, 0, 1, 1.3, 1), false); }
      if (rng() < .5) { const p = f.point(-1.8, 0, d / 2 + .6); b.add(BOXG, E.reed, T(p.x, y + .3, p.z, yaw, .9, .6, .6), false); }
    }
    // the village chapel closes the street: a little pylon gate with painted jambs
    { const cx = x1 - .2; const { tw, td, y1 } = batter(g, cx - .2, sz, 1.4, 7.6, y - .2, 5.4, .05, E.plaster); cornice(g, cx - .2, sz, tw * 2, td * 2, y1, E.plaster); b.box(cx - .95, y, sz, .05, 2.6, 1.6, E.black, 0, false); for (const s of [-1, 1]) b.box(cx - .96, y + 1.4, sz + s * 1.3, .04, 2.6, .5, s > 0 ? E.red : E.blue, 0, false); b.box(cx - .96, y + 3.4, sz, .04, .7, 2.6, E.yellow, 0, false); lamp(b, cx - 2, y, sz + 1.6); }
    // the back yard: granary silos, a well and a bread oven
    for (let i = 0; i < 4; i++) silo(b, x0 + 4 + i * 3.4, y - .2, z0 + 2.4, 1.3, 2.6, i % 2 ? E.plaster : '#cfb48a');
    { const f = new Frame(b, x1 - 8, y, z0 + 3); f.cyl(0, .45, 0, 1.1, .9, E.limestone); f.cyl(0, .92, 0, .8, .05, E.water, false); for (const s of [-1, 1]) f.box(s * 1.3, 1.3, 0, .2, 2.6, .2, E.trunk); f.beam([-1.3, 2.6, 0], [1.3, 2.6, 0], .12, E.trunk); }
    // tomb-chapels with small pyramids on the slope outside
    for (let i = 0; i < 5; i++) {
      const tx = x0 - 18 - (i % 2) * 7, tz = z0 - 6 + i * 6, gy = minGround(tx - 2, tx + 2, tz - 2, tz + 2) - .3;
      blk(b, tx - 1.6, tx + 1.6, tz - 1.6, tz + 1.6, gy, gy + 2.4, E.plaster);
      b.add(new THREE.ConeGeometry(1.75 * Math.SQRT2, 3.4, 4, 1), '#e8d6b0', T(tx, gy + 4.1, tz, Math.PI / 4));
      b.add(new THREE.ConeGeometry(.42 * Math.SQRT2, .55, 4, 1), E.gold, T(tx, gy + 5.6, tz, Math.PI / 4), false);
      b.box(tx + 1.62, gy + .3, tz, .05, 1.5, .8, E.black, 0, false); b.box(tx + 1.63, gy + 1.9, tz, .04, .25, 1.6, E.red, 0, false);
      blk(b, tx + 1.6, tx + 4, tz - 1.9, tz - 1.5, gy, gy + 1.2, E.brick); blk(b, tx + 1.6, tx + 4, tz + 1.5, tz + 1.9, gy, gy + 1.2, E.brick);
      keep.push([tx + 1, tz, 4]);
    }
  }

  // 粮仓: the temple's granary by the quay, a walled yard of beehive silos
  function granary() {
    const b = make('Granary'), cx = -62, cz = 108, w = 18, d = 12, gy = minGround(cx - w / 2, cx + w / 2, cz - d / 2, cz + d / 2), y = gy - .4;
    keep.push([cx, cz, 13]);
    for (const [a, c, e, h] of [[cx - w / 2, cx + w / 2, cz - d / 2 - .6, cz - d / 2], [cx - w / 2, cx + w / 2, cz + d / 2, cz + d / 2 + .6]] as const) blk(b, a, c, e, h, y, gy + 2.2, E.brick);
    blk(b, cx - w / 2 - .6, cx - w / 2, cz - d / 2 - .6, cz + d / 2 + .6, y, gy + 2.2, E.brick);
    blk(b, cx + w / 2, cx + w / 2 + .6, cz - d / 2 - .6, cz - 1.5, y, gy + 2.2, E.brick); blk(b, cx + w / 2, cx + w / 2 + .6, cz + 1.5, cz + d / 2 + .6, y, gy + 2.2, E.brick);
    for (let i = 0; i < 3; i++) for (const s of [-1, 1]) silo(b, cx - 5.5 + i * 5, heightAt(cx - 5.5 + i * 5, cz + s * 3) - .2, cz + s * 3, 1.9, 3.6, (i + s) % 2 ? E.plaster : '#d9c49a');
    for (let k = 0; k < 4; k++) b.box(cx - 5.5 + 2.3, gy + k * .9, cz - .6 + k * .01, 1.2, .9, 1.2 - k * .1, E.brickDark, 0, false);
    for (let j = 0; j < 6; j++) b.add(SPH6, '#cbb27a', T(cx + 6.6 + (j % 3) * .7, gy + .35, cz - 4 + Math.floor(j / 3) * .7, j, .45, .35, .4), false);
    b.box(cx + 6.8, gy, cz + 4, 1.6, .8, .8, E.wood, 0, false); b.box(cx + 6.8, gy + .8, cz + 4, .4, .04, .5, E.linen, 0, false);
  }

  // irrigation: canals cut from the river into the fields, dykes, grain stacks and sycamore figs
  function fields() {
    const b = make('Fields'), r = mulberry32(733);
    for (let i = 1; i < EGYPT_RIVER.length - 3; i++) {
      const a = EGYPT_RIVER[i - 1], c = EGYPT_RIVER[i], len = Math.hypot(c[0] - a[0], c[2] - a[2]), nx = -(c[2] - a[2]) / len, nz = (c[0] - a[0]) / len;
      for (let t = 9; t < len - 4; t += 15) for (const s of [-1, 1]) {
        const ox = a[0] + (c[0] - a[0]) * t / len, oz = a[2] + (c[2] - a[2]) * t / len;
        if (ox < -132 || ox > 34) continue;
        const pts: EgyptPoint[] = []; let ok = true;
        for (let u = 6; u <= 30; u += 3) { const x = ox + nx * s * u, z = oz + nz * s * u; if (k.roadDistance(x, z) < 5.5 || egyptRiver(x, z).d < 5) { ok = u > 12; break; } pts.push([x, heightAt(x, z) + .06, z]); }
        if (!ok || pts.length < 3) continue;
        const v: number[] = [];
        for (let j = 1; j < pts.length; j++) { const p = pts[j - 1], q = pts[j], dx = q[0] - p[0], dz = q[2] - p[2], l = Math.hypot(dx, dz) || 1, ox2 = -dz / l * .55, oz2 = dx / l * .55; v.push(p[0] + ox2, p[1], p[2] + oz2, q[0] + ox2, q[1], q[2] + oz2, p[0] - ox2, p[1], p[2] - oz2, p[0] - ox2, p[1], p[2] - oz2, q[0] + ox2, q[1], q[2] + oz2, q[0] - ox2, q[1], q[2] - oz2); }
        const geo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); water.add(geo, E.water, new THREE.Matrix4(), false); geo.dispose();
        for (const side of [-1, 1]) for (let j = 1; j < pts.length; j++) { const p = pts[j - 1], q = pts[j], dx = q[0] - p[0], dz = q[2] - p[2], l = Math.hypot(dx, dz) || 1; b.add(BOXG, '#8f7a52', T((p[0] + q[0]) / 2 - dz / l * side * .95, (p[1] + q[1]) / 2 + .05, (p[2] + q[2]) / 2 + dx / l * side * .95, Math.atan2(dx, dz), .5, .25, l + .1), false); }
        const end = pts[pts.length - 1];
        if (r() < .45 && k.roadDistance(end[0], end[2]) > 8) { for (let j = 0; j < 3; j++) b.add(new THREE.ConeGeometry(.9, 1.6, 8), '#d6b65e', T(end[0] + 1.6 + j * 1.9, end[1] + .8, end[2] + (j % 2) * 1.2), false); keep.push([end[0] + 3, end[2], 3]); }
        if (r() < .3 && k.roadDistance(end[0] - 4, end[2] - 4) > 9) { sycamore(trunks, leaves, end[0] - 4, heightAt(end[0] - 4, end[2] - 4), end[2] - 4, 1, Math.round(r() * 999)); keep.push([end[0] - 4, end[2] - 4, 4]); }
      }
    }
  }

  // 商队营地: black tents, kneeling camels, bales and a fire by the western road
  function camp() {
    const b = make('Camp'), cx = -212, cz = 24;
    keep.push([cx, cz, 18]);
    for (const [x, z, a] of [[-218, 18, .5], [-206, 14, -.3], [-214, 32, 2.6]] as const) tent(b, x, heightAt(x, z), z, a);
    for (const [x, z, a] of [[-202, 26, 1.2], [-205, 30, 2.4], [-222, 26, -1.4], [-200, 20, .2]] as const) camel(b, x, heightAt(x, z), z, a, true);
    const fy = heightAt(cx, cz + 2); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; b.add(SPH6, '#7f6a54', T(cx + Math.cos(a) * 1.1, fy + .15, cz + 2 + Math.sin(a) * 1.1, a, .3, .22, .26), false); }
    glow.add(new THREE.ConeGeometry(.45, .9, 7), E.ember, T(cx, fy + .45, cz + 2), false);
    for (let i = 0; i < 6; i++) { const x = cx - 3 + i * 1.2, z = cz - 4; b.add(BOXG, i % 2 ? '#a88a5a' : '#8a6a46', T(x, heightAt(x, z) + .4, z, i * .3, .9, .8, .7), false); }
    for (const [x, z] of [[-208, 34], [-222, 12]] as const) b.add(BOXG, E.wood, T(x, heightAt(x, z) + 1, z, 0, .12, 2, .12), false);
  }

  // 方尖碑采石场: cut benches, the unfinished obelisk in its trench, pounders, a sledge and a shrine
  function quarry() {
    const b = make('Quarry'), Q = EGYPT_QUARRY, [x0, x1, z0, z1, top] = Q.pit, floor = top - .35, O = Q.obelisk, g = new Frame(b, 0, 0, 0);
    keep.push([(x0 + x1) / 2, (z0 + z1) / 2, 30]);
    // stepped quarry faces along the far sides
    // Stepped quarry faces climb from the floor out to the plateau on the far sides; the near sides slope.
    for (let s = 0; s < 3; s++) { const y = floor + 1.35 * (s + 1), c = s % 2 ? '#a98274' : '#9c7c74';
      blk(b, x0 - 8, x0 - s * 2.6, z0 - 8, z1 - 5, floor - 1.2, y, c); blk(b, x0 - 8, x1 - 12, z0 - 8, z0 - s * 2.6, floor - 1.2, y, c);
      for (let z = z0 - s * 2.6 + 1; z < z1 - 6; z += 1.4) b.box(x0 - s * 2.6 + .03, y - 1.25, z, .04, 1.1, .06, '#5d4a44', 0, false);
      for (let x = x0 - s * 2.6 + 1; x < x1 - 13; x += 1.4) b.box(x, y - 1.25, z0 - s * 2.6 + .03, .06, 1.1, .04, '#5d4a44', 0, false); }
    // the obelisk: a tapering shaft lying in its trench between ridges of uncut rock
    { const f = new Frame(b, O.x, floor, O.z, O.yaw), L = O.length, bw = 2.6;
      const p = f.point(0, bw / 2 + .1, 0); b.add(new THREE.CylinderGeometry(bw * .5, bw * .72, L, 4, 1), GRANITE_RED, T(p.x, p.y, p.z, O.yaw, 1, 1, 1, Math.PI / 4, Math.PI / 2));
      for (const s of [-1, 1]) { f.box(0, .8, s * (bw + 1.6), L + 4, 1.6, 1.8, '#9c7c74'); f.box(L / 2 + 1.6, .8, 0, 1.8, 1.6, bw * 2 + 5, '#9c7c74'); }
      f.box(-L / 2 - .2, .02, 0, 1.6, .04, bw * 1.6, '#5d4a44', false);
      for (let i = 0; i < 7; i++) f.box(-L / 2 + 3 + i * 4, bw + .25, 0, .1, .05, bw * .9, '#5d4a44', false);
      const crack = f.point(4, bw + .26, .3); b.add(BOXG, '#3e3632', T(crack.x, crack.y, crack.z, O.yaw + .4, 2.6, .04, .08), false);
      for (let i = 0; i < 16; i++) { const q = f.point(-L / 2 + 1 + i * 1.9, 0, (i % 2 ? 1 : -1) * (bw + .45)); b.add(SPH, '#3e3a38', T(q.x, floor + .35, q.z, 0, .35, .33, .35), false); }
      for (let i = 0; i < 4; i++) { const q = f.point(-L / 2 + 4 + i * 7, 0, -(bw + 1.6)); slabBetween(b, [q.x, floor + 2.2, q.z], [q.x, floor + 4.4, q.z], .14, .14, E.wood, false); } }
    // cut blocks, a sledge with a block on wooden rollers, ramp of rubble, the overseer's shrine
    for (let i = 0; i < 6; i++) { const x = x1 - 8 - (i % 3) * 2.6, z = z1 - 4 - Math.floor(i / 3) * 2.2; b.box(x, floor, z, 2.2, 1.4, 1.8, i % 2 ? E.sandstone : GRANITE_RED); if (i < 2) b.box(x, floor + 1.4, z, 2, 1.2, 1.6, E.sandstoneDark); }
    { const f = new Frame(b, x1 - 16, floor, z0 + 12, .3); for (const s of [-1, 1]) f.box(s * .8, .2, 0, .3, .4, 4.4, E.wood); f.box(0, .45, 0, 2, .1, 3.6, E.wood, false); f.box(0, 1.25, 0, 1.8, 1.5, 2.6, GRANITE_RED); for (let i = 0; i < 4; i++) { const q = f.point(0, .1, -2.6 - i * .9); b.add(CYL8, E.wood, T(q.x, q.y, q.z, .3, .12, 2, .12, 0, Math.PI / 2), false); } f.beam([0, .5, 2.2], [0, .3, 6], .05, '#b9a77d'); }
    { const f = new Frame(b, x0 + 6, floor, z1 - 3, Math.PI); f.box(0, 1.4, 0, 2.2, 2.8, 1.4, E.limestone); cornice(f, 0, 0, 2, 1.2, 2.8); f.box(0, 1.4, .72, 1.4, 1.8, .04, E.plaster, false); f.box(0, 1.6, .74, .5, 1, .02, E.red, false); f.cyl(0, 2.2, .74, .25, .04, E.gold, false); }
    for (let i = 0; i < 40; i++) { const x = x0 + 3 + (i * 37 % 100) / 100 * (x1 - x0 - 6), z = z0 + 3 + (i * 61 % 100) / 100 * (z1 - z0 - 6); b.add(SPH6, i % 2 ? '#a88272' : '#b9917c', T(x, floor + .08, z, i, .25 + (i % 3) * .1, .12, .2), false); }
    void g;
  }

  // the pyramid's field: mastabas of the court, a queen's pyramid and the boat pit
  function necropolis() {
    const b = make('Necropolis'), g = new Frame(b, 0, 0, 0);
    for (const x of [178, 196, 214]) for (const z of [-157, -143]) {
      const w = 12, d = 7, y0 = minGround(x - w / 2, x + w / 2, z - d / 2, z + d / 2) - .6, h = maxGround(x - w / 2, x + w / 2, z - d / 2, z + d / 2) - y0 + 3.6;
      const { tw, td, y1 } = batter(g, x, z, w, d, y0, h, .16, E.limestone);
      b.box(x, y1, z, tw * 2 + .2, .3, td * 2 + .2, E.limestoneDark, 0, false);
      for (const s of [-1, 1]) { const zz = z + s * (td + .12 + .16 * (y1 - y0) * .2); b.box(x - 3, y1 - 3, z + s * (d / 2 - .55), 1.1, 2.6, .06, E.black, 0, false); b.box(x - 3, y1 - .7, z + s * (d / 2 - .5), 1.8, .3, .06, E.limestoneDark, 0, false); void zz; }
      keep.push([x, z, 8]);
    }
    { const x = 238, z = -166, y = heightAt(x, z) - .5; pyramid(b, x, y, z, 16, 12); keep.push([x, z, 11]); }
    { const x = 201, z = -170, y = heightAt(x, z); blk(b, x - 17, x + 17, z - 3.2, z + 3.2, y - .6, y + .12, E.limestoneDark, false); boatOutline(b, x, y + .14, z, 30, 4.6, Math.PI / 2, '#3b3029'); for (let i = 0; i < 9; i++) { const sx = x - 13 + i * 3.2; if (i % 4 === 3) slabBetween(b, [sx, y + .3, z - 2.6], [sx + .8, y + 1.6, z + 2.6], 1.4, .45, E.limestone, false); else b.box(sx, y + .14, z, 1.5, .5, 5.6, i % 2 ? E.limestone : E.limestoneDark, 0, false); } for (let i = 0; i < 5; i++) b.add(BOXG, '#7a5432', T(x + 12 + i * .4, y + .4 + i * .12, z + 4.2, .1 * i, 6, .2, .3), false); keep.push([x, z, 18]); }
  }

  // 沙中残像: two vast trunkless legs on their pedestal, the shattered visage half sunk nearby
  function fallenColossus() {
    const b = make('FallenColossus'), F = EGYPT_FALLEN, y0 = minGround(F.x - 6, F.x + 6, F.z - 4, F.z + 4), top = y0 + 2.6, s = 1.6;
    keep.push([F.x, F.z + 4, 16]);
    blk(b, F.x - 6, F.x + 6, F.z - 4, F.z + 4, y0 - 1, top, E.sandstone);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 16; c++) if ((r * 5 + c * 3) % 4) b.box(F.x - 4.5 + c * .6, y0 + .55 + r * .55, F.z + 4.02, .34, .32, .03, (r + c) % 3 ? E.sandstoneDark : '#7e5a3a', 0, false);
    b.box(F.x, y0 + 2.3, F.z + 4.02, 11, .14, .04, E.sandstoneDark, 0, false); b.box(F.x, y0 + .3, F.z + 4.02, 11, .14, .04, E.sandstoneDark, 0, false);
    const f = new Frame(b, F.x, top, F.z, 0);
    for (const kx of [-1, 1]) {
      f.box(kx * 1.9 * s, .55 * s, 1.4 * s, 1.7 * s, 1.1 * s, 3.4 * s, E.sandstone);
      for (let t = 0; t < 4; t++) f.box(kx * 1.9 * s - .6 * s + t * .4 * s, .5 * s, 3.15 * s, .32 * s, .5 * s, .3 * s, E.sandstoneDark, false);
      const hh = (kx > 0 ? 6.2 : 5.1) * s, leg = f.point(kx * 1.9 * s, 1.0 * s + hh / 2, .1 * s);
      b.add(new THREE.CylinderGeometry(.95 * s, .62 * s, hh, 10), E.sandstone, T(leg.x, leg.y, leg.z, 0, 1, 1, .9));
      const calf = f.point(kx * 1.9 * s, 1.0 * s + hh * .62, -.25 * s); b.add(SPH, E.sandstone, T(calf.x, calf.y, calf.z, 0, .8 * s, 1.6 * s, .7 * s), false);
      const ank = f.point(kx * 1.9 * s, 1.15 * s, .15 * s); b.add(SPH, E.sandstone, T(ank.x, ank.y, ank.z, 0, .72 * s, .5 * s, .8 * s), false);
      for (let j = 0; j < 4; j++) { const q = f.point(kx * 1.9 * s + (j - 1.5) * .42 * s, 1.0 * s + hh + .05, .1 * s + ((j * 7) % 3 - 1) * .3 * s); b.add(new THREE.ConeGeometry(.42 * s, (.5 + (j * 5 % 4) * .25) * s, 5), E.sandstoneDark, T(q.x, q.y, q.z, j, 1, 1, 1), false); }
    }
    { const hx = F.x + 9, hz = F.z + 12, hy = heightAt(hx, hz) - 1.1, hf = new Frame(b, hx, hy, hz, -.7);
      const head = hf.point(0, 1.8, 0); b.add(new THREE.BoxGeometry(3.4, 3.8, 3.6), E.sandstone, T(head.x, head.y, head.z, -.7, 1, 1, 1, 0, Math.PI / 2 - .25));
      const nem = hf.point(-1.4, 2.2, -.5); b.add(new THREE.CylinderGeometry(2, 3.4, 3.4, 4, 1), E.sandstoneDark, T(nem.x, nem.y, nem.z, -.7 + Math.PI / 4, 1, 1, .8, 0, Math.PI / 2 - .25));
      for (let i = 0; i < 5; i++) hf.box(-1.6 - i * .35, 1.9, 1.3, .14, 3.6 - i * .3, .9, '#c79a52', false);
      hf.box(.6, 2.75, 1.82, .8, .3, .1, E.black, false); hf.box(.6, 1.05, 1.82, .8, .3, .1, E.black, false); hf.box(.75, 2.75, 1.84, .3, .3, .06, E.limestone, false); hf.box(.75, 1.05, 1.84, .3, .3, .06, E.limestone, false);
      hf.box(1.3, 1.9, 1.95, .7, 1.1, .5, E.sandstone, false); hf.box(1.95, 1.9, 1.86, .4, 1.6, .3, '#9c6a46', false); hf.box(2.35, 1.9, 1.7, .6, .8, .5, E.sandstoneDark, false);
      for (let i = 0; i < 6; i++) b.add(SPH6, E.sand, T(hx - 2 + i * .9, hy + .9, hz + (i % 2 ? 1.6 : -1.6), i, 1.6, .6, 1.2), false); }
    for (const [x, z, a, w, h, d] of [[F.x - 9, F.z + 7, .4, 3, 1.6, 2.2], [F.x + 4, F.z + 9, 1.2, 2.2, 1.2, 1.6], [F.x - 4, F.z - 7, 2, 4, 1.4, 2]] as const) b.add(BOXG, E.sandstone, T(x, heightAt(x, z) + h * .35, z, a, w, h, d));
    for (let i = 0; i < 5; i++) b.add(SPH6, E.sand, T(F.x - 6 + i * 3, y0 + .3, F.z - 4.6, 0, 2.4, 1.2, 1.6), false);
  }

  // a ruined chapel on the dunes: broken drums, a fallen lintel, a half-buried sphinx
  function desertRuin() {
    const b = make('DesertRuin'), cx = 112, cz = 212, r = mulberry32(919);
    keep.push([cx, cz, 16]);
    for (let i = 0; i < 8; i++) { const x = cx - 7 + (i % 4) * 4.6, z = cz - 3 + Math.floor(i / 4) * 6, y = heightAt(x, z) - .4, h = .8 + r() * 5.4; b.add(new THREE.CylinderGeometry(.75, .8, h, 12), E.sandstone, T(x, y + h / 2, z)); for (let k = 0; k < Math.floor(h / 1.2); k++) b.add(new THREE.CylinderGeometry(.81, .81, .06, 12), E.sandstoneDark, T(x, y + 1.2 * (k + 1), z), false); }
    for (let i = 0; i < 4; i++) { const x = cx - 5 + r() * 12, z = cz + 6 + r() * 4; b.add(new THREE.CylinderGeometry(.75, .75, 1.1, 12), E.sandstone, T(x, heightAt(x, z) + .5, z, r() * 3, 1, 1, 1, Math.PI / 2, 0)); }
    b.add(BOXG, E.limestone, T(cx + 2, heightAt(cx + 2, cz + 1) + .5, cz + 1, .35, 7, 1, 1.4, 0, .12));
    { const x = cx - 12, z = cz + 2; criosphinx(b, x, heightAt(x, z) - 1.1, z, 2.2); for (let i = 0; i < 4; i++) b.add(SPH6, E.sand, T(x - 2 + i * 1.3, heightAt(x, z), z + (i % 2 ? 1 : -1.6), i, 2, .9, 1.4), false); }
    { const x = cx + 11, z = cz - 6, y = heightAt(x, z); b.add(new THREE.CylinderGeometry(.6, .85, 9, 4, 1), GRANITE_RED, T(x, y + .6, z, .7 + Math.PI / 4, 1, 1, 1, 0, Math.PI / 2 - .08)); }
  }

  // 太阳船墓宝库: the gilded inner shrine, its guardians, Anubis on his chest, couches, chariot and chests
  function treasury() {
    const b = make('Treasury'), r = EGYPT_ROOMS.find(rm => rm.id === 'treasury')!, D = EGYPT_TREASURY_DOOR, g = new Frame(b, 0, 0, 0);
    const fl = r.floor, rt = fl + r.height, hw = D.width / 2;
    blk(b, r.x0, r.x1, r.z0, r.z1, fl - 1.2, fl, '#cdbb94');
    blk(b, r.x0 - 2.4, r.x1 + 2.4, r.z0 - 2.4, r.z1 + 2.4, rt, rt + 1.4, E.limestone);
    blk(b, r.x1, r.x1 + 2.4, r.z0 - 2.4, r.z1 + 2.4, fl - 1.2, rt, E.limestoneDark);
    blk(b, r.x0 - 2.4, r.x1, r.z0 - 2.4, r.z0, fl - 1.2, rt, E.limestoneDark); blk(b, r.x0 - 2.4, r.x1, r.z1, r.z1 + 2.4, fl - 1.2, rt, E.limestoneDark);
    blk(b, r.x0 - 2.4, r.x0, r.z0, D.z - hw, fl - 1.2, rt, E.limestoneDark); blk(b, r.x0 - 2.4, r.x0, D.z + hw, r.z1, fl - 1.2, rt, E.limestoneDark); blk(b, r.x0 - 2.4, r.x0, D.z - hw, D.z + hw, fl + D.height, rt, E.limestoneDark);
    // the short passage from the barque tomb
    blk(b, D.x0, D.x1, D.z - hw, D.z + hw, fl - 1.2, fl, '#cdbb94');
    for (const s of [-1, 1]) blk(b, D.x0 + 2, D.x1 - 2, s < 0 ? D.z - hw - 1.2 : D.z + hw, s < 0 ? D.z - hw : D.z + hw + 1.2, fl - 1.2, fl + D.height + 1.4, E.limestoneDark);
    blk(b, D.x0 + 2, D.x1 - 2, D.z - hw - 1.2, D.z + hw + 1.2, fl + D.height, fl + D.height + 1.4, E.limestone);
    for (const x of [D.x0 + .02, D.x1 - .02]) { const face = x < (D.x0 + D.x1) / 2 ? -1 : 1; b.box(x + face * .02, fl + D.height - .6, D.z, .04, .5, D.width + .6, E.gold, 0, false); for (const s of [-1, 1]) b.box(x + face * .02, fl, D.z + s * (hw + .15), .04, D.height - .6, .3, E.faience, 0, false); }
    stars(b, r.x0, r.x1, r.z0, r.z1, rt, 60);
    for (const [z, face] of [[r.z0 + .03, 1], [r.z1 - .03, -1]] as const) reliefBand(b, r.x0 + 1, r.x1 - 1, fl + 2.2, z, face, 211 + face);
    // inner shrine against the east wall, gilded, with faience panels and its doors standing open
    const sx0 = r.x1 - 6, sx1 = r.x1 - .4, sz0 = D.z - 3.2, sz1 = D.z + 3.2;
    blk(b, sx0, sx1, sz0, sz1, fl, fl + 4, E.gold); cornice(g, (sx0 + sx1) / 2, (sz0 + sz1) / 2, sx1 - sx0, sz1 - sz0, fl + 4, E.gold);
    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) b.box(sx0 + .8 + i * 1.4, fl + 1.2, s < 0 ? sz0 - .02 : sz1 + .02, .9, 1.8, .03, i % 2 ? E.faience : E.lapis, 0, false);
    b.box(sx0 - .02, fl + .2, D.z, .03, 3.2, 2.4, E.black, 0, false);
    for (const s of [-1, 1]) b.add(BOXG, E.gold, T(sx0 - .7, fl + 1.8, D.z + s * 1.9, s * .9, 1.2, 3.2, .1), false);
    { const p = [sx0 - 1.5, fl, D.z] as const; blk(b, p[0] - .5, p[0] + .5, p[2] - .5, p[2] + .5, fl, fl + 1.1, E.limestone); const m = new Frame(b, p[0], fl + 1.1, p[2], -Math.PI / 2); const hd = m.point(0, .55, 0); b.add(SPH, E.gold, T(hd.x, hd.y, hd.z, -Math.PI / 2, .34, .42, .36), false); const ne = m.point(0, .5, -.08); b.add(new THREE.CylinderGeometry(.3, .55, .8, 4, 1), E.gold, T(ne.x, ne.y, ne.z, -Math.PI / 2 + Math.PI / 4, 1, 1, .7), false); for (let i = 0; i < 4; i++) m.box(0, .3 + i * .14, -.36, .9 - i * .08, .05, .04, E.lapis, false); m.box(0, .05, .1, .7, .2, .5, E.faience, false); m.box(0, .32, .36, .08, .22, .08, E.lapis, false); glow.add(new THREE.SphereGeometry(.12, 6, 4), E.light, T(p[0], fl + 2.3, p[2]), false); }
    for (const s of [-1, 1]) standingKing(b, sx0 - 1.2, fl, D.z + s * 4.4, -Math.PI / 2, .5, E.black);
    // Anubis couchant on his gilded shrine-chest
    { const f = new Frame(b, r.x0 + 6, fl, r.z1 - 3.2, -Math.PI / 2); f.box(0, .55, 0, 1.4, 1.1, 2.6, E.gold); for (const s of [-1, 1]) f.box(0, .8, s * 1.31, 1, .4, .03, E.lapis, false); for (let i = 0; i < 4; i++) f.box(s4(i), .1, 0, .18, .2, 2.7, E.wood, false);
      f.box(0, 1.45, -.2, .72, .7, 1.7, E.black); f.box(0, 2.05, .75, .5, .55, .6, E.black); f.box(0, 1.95, 1.2, .26, .26, .5, E.black); for (const s of [-1, 1]) { f.box(s * .16, 2.55, .7, .12, .5, .2, E.black, false); f.box(s * .2, 1.2, .9, .2, .2, .8, E.black, false); }
      f.box(0, 1.85, .5, .56, .14, .3, E.gold, false); for (const s of [-1, 1]) f.box(s * .13, 2.12, 1.03, .08, .05, .03, E.gold, false); }
    // ritual couches with animal heads along the south wall, a chariot by the door, chests and jars
    for (const [x, col] of [[r.x0 + 3, E.gold], [r.x0 + 9, '#c9952e']] as const) { const f = new Frame(b, x, fl, r.z0 + 1.6, 0); f.box(0, .9, 0, 4.2, .14, 1.2, col); for (const sx of [-1.8, 1.8]) for (const sz of [-.45, .45]) f.box(sx, .45, sz, .18, .9, .18, col); f.box(2.3, 1.3, 0, .5, .8, .5, col); const h = f.point(2.55, 1.75, 0); b.add(SPH, col, T(h.x, h.y, h.z, 0, .32, .3, .26), false); f.box(-2.2, 1.2, 0, .12, .7, 1, col, false); f.box(0, .98, 0, 3.8, .04, 1, E.linen, false); }
    { const f = new Frame(b, r.x0 + 4, fl, D.z - 6.4, .4); for (const s of [-1, 1]) { const w = f.point(0, .62, s * .75); b.add(new THREE.TorusGeometry(.6, .05, 6, 18), E.gold, T(w.x, w.y, w.z, .4 + Math.PI / 2), false); } f.beam([0, .62, -.8], [0, .62, .8], .07, E.wood); f.box(-.2, .95, 0, .7, .5, 1.3, E.gold); f.beam([.2, .7, 0], [2.6, 1, 0], .06, E.wood); }
    for (let i = 0; i < 7; i++) { const x = r.x0 + 1 + i * 1.3, z = r.z1 - 1.1; b.box(x, fl, z, 1.1, .7 + (i % 2) * .3, .9, i % 3 ? E.wood : E.gold, 0, false); b.box(x, fl + .7 + (i % 2) * .3, z, 1.15, .06, .95, E.faience, 0, false); }
    for (let i = 0; i < 9; i++) { const x = r.x1 - 7.5 + (i % 3) * .55, z = r.z0 + 1 + Math.floor(i / 3) * .55; b.add(new THREE.CylinderGeometry(.2, .14, .7, 8), i % 2 ? E.limestone : E.faience, T(x, fl + .35, z), false); }
    { const f = new Frame(b, r.x0 + 9, fl + 1, r.z1 - 1.1, 0); f.box(0, .55, 0, 1.4, .12, .32, E.wood, false); f.beam([0, .6, 0], [0, 1.5, 0], .04, E.wood); f.box(.15, 1.1, 0, .6, .7, .02, E.linen, false); }
    for (const [x, z] of [[r.x0 + 1.2, r.z0 + 4.5], [r.x0 + 1.2, r.z1 - 4.5], [r.x1 - 1.2, r.z0 + 1.2], [r.x1 - 1.2, r.z1 - 1.2]] as const) lamp(b, x, fl, z);
    void beams;
    function s4(i: number) { return -.6 + i * .4; }
  }
}

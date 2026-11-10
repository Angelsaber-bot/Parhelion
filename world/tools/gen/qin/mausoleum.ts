// 秦帝陵: the walled mausoleum park on the plain north of Mount Li, and the furnished burial
// pits and royal-city details beneath it. All coordinates are Qin's authored frame (-Z north).
import * as THREE from 'three';
import { Batch, BOX, T } from '../geo';
import { Frame } from '../orleans/craft';
import { mulberry32 } from '../rng';
import { Q, CYL8, Shell, qinRoof, bracket, rammedPlatform, terrainWall, palaceHall, gateHouse, figure, walkStrip } from './craft';
import { QIN_MAUSOLEUM as M, type QinPoint } from '../../../src/map/qinPlan';
import { horsePrims, warriorPrims, type QinPrim } from '../../../src/map/qinFigures';

type Height = (x: number, z: number) => number;
type V = [number, number, number];
const PAINT = { white: '#dcd5c2', bone: '#cfc6ae', azure: '#4d7b96', jade: '#6f9c86', cinnabar: '#b8452f', silver: '#c8ccd0' };
const tint = (prims: QinPrim[], map: (c: string) => string) => prims.map(p => ({ ...p, color: map(p.color) }));

// ─────────────────────────── surface: 骊山陵园 ───────────────────────────

/** A three-tier rammed mound (覆斗形封土): each tier a battered frustum with a planted ledge. */
function mound(b: Batch, cx: number, cz: number, base: number, skirt: number) {
  const f = new Frame(b, cx, base, cz), sides = new Shell(f), ledges = new Shell(f);
  let y = 0;
  for (const [i, [half, rise]] of M.mound.tiers.entries()) {
    const top = half - rise * .55, y0 = y, y1 = y + rise;
    const ring = (h: number, yy: number): V[] => [[-h, yy, -h], [h, yy, -h], [h, yy, h], [-h, yy, h]];
    const lo = ring(half, y0), hi = ring(top, y1);
    // the first tier also drops a plain skirt into lower ground on the downhill sides
    if (i === 0) { const deep = ring(half, skirt - base); for (let k = 0; k < 4; k++) sides.quad(deep[k], deep[(k + 1) % 4], lo[(k + 1) % 4], lo[k], [(deep[k][0] + deep[(k + 1) % 4][0]) / 2, 0, (deep[k][2] + deep[(k + 1) % 4][2]) / 2]); }
    for (let k = 0; k < 4; k++) {
      const a = lo[k], b2 = lo[(k + 1) % 4], c = hi[(k + 1) % 4], d = hi[k];
      const out: V = [(a[0] + b2[0]) / 2, 0, (a[2] + b2[2]) / 2];
      sides.quad(a, b2, c, d, out);
    }
    const next = M.mound.tiers[i + 1]?.[0];
    if (next !== undefined) {
      // the ledge between tiers: a planted terrace ring
      const inner = ring(next, y1);
      for (let k = 0; k < 4; k++) ledges.quad(hi[k], hi[(k + 1) % 4], inner[(k + 1) % 4], inner[k], [0, 1, 0]);
    } else ledges.quad(hi[0], hi[1], hi[2], hi[3], [0, 1, 0]);
    y = y1;
  }
  sides.done(Q.loess, true); ledges.done('#6d8a52', true);
  return y;
}

/** A wall around a rectangle with a gate gap in the middle of every side. */
function walledRect(b: Batch, r: readonly [number, number, number, number], gap: number, heightAt: Height, height: number, thick: number) {
  const [x0, x1, z0, z1] = r, mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, g = gap / 2 + 7.5;
  const corners: [number, number][][] = [
    [[mx - g, z0], [x0, z0], [x0, mz - g]], [[x0, mz + g], [x0, z1], [mx - g, z1]],
    [[mx + g, z1], [x1, z1], [x1, mz + g]], [[x1, mz - g], [x1, z0], [mx + g, z0]],
  ];
  for (const line of corners) terrainWall(b, line, heightAt, height, thick, 1);
  return { n: [mx, z0] as const, s: [mx, z1] as const, w: [x0, mz] as const, e: [x1, mz] as const };
}

/** A single-roofed gate: two rammed piers, a timber lintel and a hip roof over the passage. */
function plainGate(b: Batch, x: number, y: number, z: number, gap: number, h: number, a: number, pier = 5, depth = 6) {
  const f = new Frame(b, x, y, z, a);
  for (const s of [-1, 1]) { const px = s * (gap / 2 + pier / 2); f.box(px, h / 2 - .5, 0, pier, h + 1, depth, Q.earth); f.box(px, .3, 0, pier + .6, 1.2, depth + .6, Q.stoneDark); }
  f.box(0, h + .4, 0, gap + pier * 2, .8, depth + .4, Q.wood, false);
  for (let k = -2; k <= 2; k++) f.box(k * gap / 5, h - .2, depth / 2 + .1, .5, .5, .15, Q.bronzeBright, false);
  qinRoof(f, gap + pier * 2 - 1, depth - .6, h + .8, 2.4, Q.tile, 1.6, false, { finScale: .6, rafters: false });
}

/** 角楼: a square corner tower of rammed earth with a timber pavilion. */
function cornerTower(b: Batch, x: number, z: number, y: number, h: number) {
  const f = new Frame(b, x, y, z);
  f.box(0, h / 2 - 1, 0, 8, h + 2, 8, Q.earth); f.box(0, .2, 0, 8.6, 1.4, 8.6, Q.stoneDark);
  for (let yy = 2; yy < h - .5; yy += 2.4) for (const s of [-1, 1]) { f.box(s * 4.03, yy, 0, .1, .2, 8, Q.wood, false); f.box(0, yy, s * 4.03, 8, .2, .1, Q.wood, false); }
  f.box(0, h + .3, 0, 8.6, .6, 8.6, Q.wood, false);
  f.box(0, h + 2, 0, 5.6, 2.8, 5.6, Q.plaster, false);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) f.box(sx * 2.6, h + 2, sz * 2.6, .4, 2.8, .4, Q.red, false);
  for (const s of [-1, 1]) for (const k of [-1, 0, 1]) bracket(f, k * 2.2, s * 2.7, h + 3.4, .6);
  qinRoof(f, 5.6, 5.6, h + 4.1, 2.4, Q.tile, 1.6, false, { finScale: .7 });
}

/** 陪葬墓: a small truncated tumulus with a stone stele. */
function companionTomb(b: Batch, x: number, z: number, y: number, r: number, h: number, a: number) {
  const f = new Frame(b, x, y, z, a), s = new Shell(f), top = new Shell(f), n = 10;
  for (let k = 0; k < n; k++) {
    const t0 = k / n * Math.PI * 2, t1 = (k + 1) / n * Math.PI * 2;
    const p = (t: number, rr: number, yy: number): V => [Math.cos(t) * rr, yy, Math.sin(t) * rr];
    s.quad(p(t0, r, -1.5), p(t1, r, -1.5), p(t1, r * .45, h), p(t0, r * .45, h), [Math.cos((t0 + t1) / 2), .4, Math.sin((t0 + t1) / 2)]);
    top.tri([0, h + .2, 0], p(t0, r * .45, h), p(t1, r * .45, h), [0, 1, 0]);
  }
  s.done('#7f9257', true); top.done('#7a8d55');
  f.box(0, .9, r + .9, 1, 1.8, .3, Q.stone); f.box(0, 1.85, r + .9, 1.2, .2, .4, Q.stoneDark, false);
}

/** 柏: a columnar cypress (trunk and stacked cones). */
export function cypress(trunks: Batch, leaves: Batch, x: number, y: number, z: number, h = 1) {
  trunks.add(CYL8, '#4a3a2c', T(x, y + 1.5 * h, z, 0, .3 * h, 3 * h, .3 * h));
  for (let j = 0; j < 3; j++) leaves.add(new THREE.ConeGeometry((1.5 - j * .3) * h, (4 - j * .6) * h, 8), j % 2 ? '#2f4a36' : '#38553d', T(x, y + (3.2 + j * 2.1) * h, z, j), false);
}

export function buildMausoleumPark(b: Batch, trunks: Batch, leaves: Batch, glow: Batch, heightAt: Height) {
  const { x: cx, z: cz } = M.mound, foot = M.mound.tiers[0][0];
  let low = Infinity, high = -Infinity;
  for (let x = -foot; x <= foot; x += 4) for (let z = -foot; z <= foot; z += 4) { const y = heightAt(cx + x, cz + z); low = Math.min(low, y); high = Math.max(high, y); }
  // The mound rises from the ground at its centre; uphill it runs into the foothill, downhill a skirt reaches the ground.
  const base = heightAt(cx, cz), summit = base + mound(b, cx, cz, base, Math.min(low, base) - 2);
  // A rammed altar terrace on the summit.
  b.box(cx, summit - .1, cz, 9, .6, 9, Q.earthDark); b.box(cx, summit + .5, cz, 4, .4, 4, Q.stone, 0, false);
  // A sealed stone portal on the east face: the 墓道 the buried city once took.
  { const half = M.mound.tiers[0][0], px = cx + half - 2.4, f = new Frame(b, px, heightAt(px + 3, cz), cz, Math.PI / 2);
    f.box(0, 3, 0, 9, 6, 2.2, Q.stoneDark); f.box(0, 2.6, 1.15, 5, 5.2, .2, Q.stone, false);
    for (let k = -2; k <= 2; k++) f.box(k * .9, 2.6, 1.28, .12, 5.2, .06, Q.bronze, false);
    for (const s of [-1, 1]) for (let r = 0; r < 4; r++) f.box(s * 1.2, 1 + r * 1.2, 1.3, .22, .22, .12, Q.bronzeBright, false);
    f.box(0, 6.3, .2, 9.6, .6, 2.8, Q.tile, false); }

  // 内城 and 外城 with gate towers; the east gates carry the full three-part 阙 on the ceremonial axis.
  const inner = walledRect(b, M.inner, M.gateGap, heightAt, 7.5, 4), outer = walledRect(b, M.outer, M.gateGap, heightAt, 6, 3.4);
  for (const [gates, h, isInner] of [[inner, 8.5, true], [outer, 7, false]] as const) {
    for (const [key, p] of Object.entries(gates)) {
      const y = Math.min(heightAt(p[0] - 3, p[1] - 3), heightAt(p[0] + 3, p[1] + 3), heightAt(p[0], p[1])), a = key === 'e' || key === 'w' ? Math.PI / 2 : 0;
      // the inner east gate on the ceremonial axis carries the full towers and outer 子阙
      if (isInner && key === 'e') gateHouse(b, p[0], y, p[1], M.gateGap, h + 2, a, 8, 7);
      else plainGate(b, p[0], y, p[1], M.gateGap, h, a);
    }
  }
  for (const x of [M.inner[0], M.inner[1]]) for (const z of [M.inner[2], M.inner[3]]) cornerTower(b, x, z, heightAt(x, z), 9);

  // 寝殿 north-west of the mound, and two 便殿 beside it; each on a rammed platform with a front stair.
  for (const [hall, big] of [[M.sleepingHall, true], ...M.sideHalls.map(h => [h, false] as const)] as const) {
    const x0 = hall.x - hall.w / 2 - 4, x1 = hall.x + hall.w / 2 + 4, z0 = hall.z - hall.d / 2 - 3, z1 = hall.z + hall.d / 2 + 3;
    let g = Infinity; for (let x = x0; x <= x1; x += 4) for (let z = z0; z <= z1; z += 4) g = Math.min(g, heightAt(x, z));
    rammedPlatform(b, x0, x1, z0, z1, g - 1.5, hall.top);
    palaceHall(b, hall.x, hall.top, hall.z, hall.w, hall.d, big ? 7.5 : 5.5, 0, 'front', big);
    // stair from the apron down to the court, toward the mound
    const steps = Math.max(1, Math.ceil((hall.top - heightAt(hall.x, z1 + 4)) / .3));
    for (let k = 0; k < steps; k++) b.box(hall.x, hall.top - (k + 1) * .3, z1 + .5 + k * .45, 6, .3, .45, Q.stone, 0, true);
    for (const s of [-1, 1]) b.box(hall.x + s * 3.3, hall.top - steps * .3, z1 + steps * .225, .5, steps * .3 + .2, steps * .45 + .6, Q.stoneDark, 0, true);
    // bronze lamps and a ding on the apron
    for (const s of [-1, 1]) { const lx = hall.x + s * (hall.w / 2 - 1), lz = z1 - 1.2; b.add(CYL8, Q.bronze, T(lx, hall.top + .9, lz, 0, .1, 1.8, .1)); b.add(new THREE.CylinderGeometry(.35, .2, .3, 10), Q.bronzeBright, T(lx, hall.top + 1.9, lz), false); glow.add(new THREE.ConeGeometry(.14, .4, 8), Q.molten, T(lx, hall.top + 2.25, lz), false); }
  }

  // Paved ways: the east spirit way to the outer gate, on through both gates to the mound portal;
  // and a north-south walk from the sleeping hall court to the north gates.
  const pave = (pts: [number, number][], w: number) => walkStrip(b, pts.map(([x, z]) => [x, heightAt(x, z) + .06, z] as QinPoint).flatMap((p, i, a) => i ? subdivide(a[i - 1], p, heightAt) : [p]), w, Q.paving);
  pave([[M.spiritWay.x1, M.spiritWay.z], [M.spiritWay.x0, M.spiritWay.z], [M.inner[1], cz], [cx + foot + 1, cz]], 7);
  pave([[M.sleepingHall.x, M.sleepingHall.z + M.sleepingHall.d / 2 + 8], [cx, M.sleepingHall.z + M.sleepingHall.d / 2 + 8], [cx, M.outer[2]]], 5);
  // 神道 双阙 where the spirit way begins, and paired bronze lamp posts along it.
  for (const s of [-1, 1]) {
    const qx = M.spiritWay.x1 - 6, qz = M.spiritWay.z + s * 9, y = heightAt(qx, qz), f = new Frame(b, qx, y, qz, Math.PI / 2);
    f.box(0, 4, 0, 4, 8, 3, Q.earth); f.box(0, .5, 0, 4.8, 1, 3.8, Q.stoneDark);
    f.box(s * 2.6, 2.8, 0, 2, 5.6, 2.4, Q.earth); qinRoof(new Frame(b, f.point(s * 2.6, 0, 0).x, y, f.point(s * 2.6, 0, 0).z, f.a), 2, 2.4, 6.1, .9, Q.tile, 1, false, { fins: false });
    f.box(0, 9, 0, 3.2, 2, 2.2, Q.plaster, false); qinRoof(f, 3.2, 2.2, 10.3, 1.4, Q.tile, 1.3, false, { finScale: .5 });
    for (let x = M.spiritWay.x0 + 10; x < M.spiritWay.x1 - 12; x += 14) {
      const lz = M.spiritWay.z + s * 5.5, ly = heightAt(x, lz);
      b.add(CYL8, Q.bronze, T(x, ly + 1.6, lz, 0, .14, 3.2, .14)); b.add(new THREE.CylinderGeometry(.5, .25, .4, 10), Q.bronzeBright, T(x, ly + 3.3, lz), false);
      glow.add(new THREE.ConeGeometry(.18, .5, 8), Q.molten, T(x, ly + 3.7, lz), false);
    }
  }
  // 陪葬墓 in a row between the north walls, clear of the north gates.
  const C = M.companions, rnd = mulberry32(5101);
  for (let i = 0; i < C.count; i++) {
    const x = C.x0 + (C.x1 - C.x0) * i / (C.count - 1);
    if (Math.abs(x - cx) < 15) continue;
    companionTomb(b, x, C.z, heightAt(x, C.z), 4.2 + rnd() * 1.4, 3 + rnd() * 1.6, rnd() * Math.PI);
  }
  // 柏: rows along the spirit way and the inner walls; a grove on the mound's ledges.
  for (let x = M.spiritWay.x0 + 4; x < M.spiritWay.x1 - 14; x += 9) for (const s of [-1, 1]) cypress(trunks, leaves, x + 4.5, heightAt(x + 4.5, M.spiritWay.z + s * 9), M.spiritWay.z + s * 9);
  for (let z = M.inner[2] + 10; z < M.inner[3] - 6; z += 12) for (const x of [M.inner[0] + 6, M.inner[1] - 6]) if (Math.abs(z - cz) > 14 && !(x < 35 && z < M.sleepingHall.z + 14)) cypress(trunks, leaves, x, heightAt(x, z), z, .9);
  let ledgeY = base;
  for (const [i, [half, rise]] of M.mound.tiers.entries()) {
    ledgeY += rise; const next = M.mound.tiers[i + 1]?.[0]; if (next === undefined) break;
    const r = (half - rise * .55 + next) / 2;
    for (let k = -2; k <= 2; k++) for (const [sx, sz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      if (sx === 1 && k === 0) continue; // the east axis stays open above the portal
      const along = k * r / 2.6; cypress(trunks, leaves, cx + sx * r + (sx ? 0 : along), ledgeY, cz + sz * r + (sz ? 0 : along), .8 - i * .1);
    }
  }
}

function subdivide(a: QinPoint, b: QinPoint, heightAt: Height): QinPoint[] {
  const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[2] - a[2]) / 3)), out: QinPoint[] = [];
  for (let k = 1; k <= n; k++) { const x = a[0] + (b[0] - a[0]) * k / n, z = a[2] + (b[2] - a[2]) * k / n; out.push([x, heightAt(x, z) + .06, z]); }
  return out;
}

// ─────────────────────────── underground: 陪葬坑 ───────────────────────────

/** A spoked chariot wheel in the frame's x-y plane (axle along z). */
function wheel(f: Frame, x: number, y: number, z: number, r: number, spokes: number, rim: string, spoke: string) {
  const p = f.point(x, y, z), q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), f.a);
  f.b.add(new THREE.TorusGeometry(r, .05, 6, 28), rim, new THREE.Matrix4().compose(p, q, new THREE.Vector3(1, 1, 1)), false);
  f.b.add(new THREE.TorusGeometry(r - .05, .03, 4, 28), PAINT.azure, new THREE.Matrix4().compose(p, q, new THREE.Vector3(1, 1, 1)), false);
  f.b.add(CYL8, rim, new THREE.Matrix4().compose(p, q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2)), new THREE.Vector3(.12, .5, .12)), false);
  for (let k = 0; k < spokes; k++) {
    const t = k / spokes * Math.PI * 2, mid = f.point(x + Math.cos(t) * r / 2, y + Math.sin(t) * r / 2, z);
    f.b.add(BOX, spoke, new THREE.Matrix4().compose(mid, q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), t - Math.PI / 2)), new THREE.Vector3(.025, r, .025)), false);
  }
}

/**
 * 铜车马: a painted bronze chariot and its team of four, facing the frame's +x.
 * kind 'tall' is the 立车 (open box under a parasol, crossbow and shield);
 * kind 'closed' is the 安车 (a windowed carriage under a turtle-back roof).
 */
function bronzeChariot(b: Batch, x: number, y: number, z: number, kind: 'tall' | 'closed') {
  const f = new Frame(b, x, y, z), white = PAINT.white, metal = Q.bronzeBright;
  for (const s of [-1, 1]) wheel(f, 0, .92, s * 1.02, .9, 15, metal, PAINT.bone);
  f.beam([0, .92, -1.3], [0, .92, 1.3], .09, metal);
  // single curved shaft (辀) rising to the yoke beam (衡) and two yoke saddles (轭)
  const shaft: V[] = [[-.5, 1.0, 0], [.8, 1.05, 0], [1.9, 1.3, 0], [2.8, 1.62, 0], [3.25, 1.72, 0]];
  for (let i = 1; i < shaft.length; i++) f.beam(shaft[i - 1], shaft[i], .1, white);
  f.beam([3.2, 1.72, -1.5], [3.2, 1.72, 1.5], .08, white);
  for (const s of [-.45, .45]) { f.beam([3.2, 1.72, s], [3.3, 1.35, s - .2], .05, metal); f.beam([3.2, 1.72, s], [3.3, 1.35, s + .2], .05, metal); f.box(3.2, 1.86, s, .12, .14, .12, Q.gold, false); }
  if (kind === 'tall') {
    // open box with silver-capped rails; parasol on a jointed pole
    f.box(.05, 1.12, 0, 1.15, .1, 1.5, white);
    for (const s of [-1, 1]) { f.box(.05, 1.42, s * .74, 1.15, .5, .05, white, false); f.box(.05, 1.68, s * .74, 1.2, .05, .07, PAINT.silver, false); }
    f.box(.62, 1.42, 0, .05, .5, 1.5, white, false); f.box(-.52, 1.3, .45, .05, .26, .5, white, false);
    for (let k = -3; k <= 3; k++) f.box(.64, 1.42, k * .2, .02, .38, .07, k % 2 ? PAINT.azure : PAINT.jade, false);
    f.beam([0, 1.15, 0], [0, 3.15, 0], .05, metal);
    const p = f.point(0, 3.18, 0); b.add(new THREE.ConeGeometry(1.45, .42, 20, 1, true), white, T(p.x, p.y, p.z), false);
    b.add(new THREE.CircleGeometry(1.45, 20).rotateX(Math.PI / 2), PAINT.azure, T(p.x, p.y - .21, p.z), false);
    for (let k = 0; k < 10; k++) { const t = k / 10 * Math.PI * 2; f.beam([0, 3.36, 0], [Math.cos(t) * 1.42, 2.98, Math.sin(t) * 1.42], .025, metal); }
    // crossbow and shield on the right rail, quiver on the left
    f.box(.1, 1.75, .76, .9, .06, .08, Q.wood, false); f.beam([-.1, 1.78, .55], [-.1, 1.78, .97], .04, metal);
    f.box(-.25, 1.55, -.79, .5, .7, .04, PAINT.cinnabar, false); f.box(-.25, 1.55, -.81, .3, .4, .02, Q.gold, false);
    // standing charioteer, painted
    figure(b, tint(warriorPrims(3, 4), c => c === '#a88b70' || c === '#bba085' || c === '#86705a' ? PAINT.white : c === '#9a4b3c' ? PAINT.cinnabar : c), f.point(.05, 1.17, 0).x, y + 1.17, f.point(.05, 1.17, 0).z, f.a + Math.PI / 2, false, .78);
  } else {
    // front driver's box and rear chamber with lattice windows, under an oval turtle-back roof
    f.box(.1, 1.12, 0, 2.3, .1, 1.6, white);
    f.box(.95, 1.38, 0, .45, .44, 1.5, white, false);
    for (const s of [-1, 1]) f.box(-.35, 1.75, s * .78, 1.5, 1.2, .06, white, false);
    f.box(-1.12, 1.75, 0, .06, 1.2, 1.6, white, false); f.box(.42, 1.75, 0, .06, 1.2, 1.6, white, false);
    for (const s of [-1, 1]) { f.box(-.35, 1.85, s * .81, .9, .55, .02, '#3d4f5c', false); for (let k = -3; k <= 3; k++) f.box(-.35 + k * .12, 1.85, s * .83, .02, .55, .02, PAINT.silver, false); }
    f.box(-1.15, 1.6, 0, .02, .8, .7, PAINT.azure, false);
    const p = f.point(-.35, 2.4, 0); b.add(new THREE.SphereGeometry(1, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), white, new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), f.a), new THREE.Vector3(1.35, .45, 1.05)), false);
    for (let k = 0; k < 8; k++) { const t = k / 8 * Math.PI; f.beam([-.35 + Math.cos(t) * 1.3, 2.42, 0], [-.35 + Math.cos(t) * 1.3, 2.42 + Math.sin(t) * .02, 0], .02, PAINT.jade); }
    f.box(-.35, 2.86, 0, 1.6, .03, .12, PAINT.cinnabar, false);
    // kneeling charioteer in the front box
    figure(b, tint(warriorPrims(4, 2), c => c === '#a88b70' || c === '#bba085' || c === '#86705a' ? PAINT.white : c), f.point(.95, 1.17, 0).x, y + 1.17, f.point(.95, 1.17, 0).z, f.a + Math.PI / 2, false, .72);
  }
  // the team: two inner horses under the yoke, two outer trace horses, silver and gold harness
  for (const [k, s] of [-1.25, -.45, .45, 1.25].entries()) {
    const hx = 3.65, prims = tint(horsePrims(k), c => c === '#5f5047' ? '#4a4c50' : PAINT.white);
    figure(b, prims, f.point(hx - 1.05, 0, s).x, y, f.point(hx - 1.05, 0, s).z, f.a + Math.PI / 2, k === 1 || k === 2);
    f.box(hx - 1.05, 1.62, s, .12, .05, .74, PAINT.silver, false);
    f.box(hx - .2, 1.98, s, .05, .2, .3, Q.gold, false);
    f.box(hx - .6, 1.45, s, 1.1, .04, .05, Q.gold, false);
  }
}

export function furnishChariotPit(b: Batch, g: Batch, x0: number, x1: number, z0: number, z1: number, y: number) {
  // timber-floored display plinth along the north side, the walkway to the south
  const pz0 = z0 + 1, pz1 = z0 + 12;
  b.box((x0 + 4 + x1 - 1) / 2, y, (pz0 + pz1) / 2, x1 - x0 - 5, .35, pz1 - pz0, Q.stoneDark);
  for (let x = x0 + 4.4; x < x1 - 1; x += .9) b.box(x, y + .35, (pz0 + pz1) / 2, .86, .04, pz1 - pz0 - .4, x % 1.8 < .9 ? Q.woodPale : Q.wood, 0, false);
  bronzeChariot(b, x0 + 9, y + .39, (pz0 + pz1) / 2, 'tall');
  bronzeChariot(b, x0 + 23, y + .39, (pz0 + pz1) / 2, 'closed');
  // lacquered rail along the plinth edge, with bronze posts
  for (let x = x0 + 4; x <= x1 - 1; x += 2) { b.box(x, y + .35, pz1 + .1, .14, .7, .14, Q.bronze, 0, true); }
  b.box((x0 + 4 + x1 - 1) / 2, y + .95, pz1 + .1, x1 - x0 - 5, .1, .1, Q.redDark, 0, false);
  lampRow(b, g, x0 + 6, x1 - 4, z1 - .9, y, 6);
  wallPanels(b, x0, x1, z0, z1, y + 2.6, 'z');
}

/** 石铠甲: a suit of linked stone plates on a timber stand, with its helmet above. */
function stoneArmour(b: Batch, x: number, y: number, z: number, a: number, seed: number) {
  const f = new Frame(b, x, y, z, a), r = mulberry32(seed), plate = (px: number, py: number, pz: number, t: number, w: number, h: number) => {
    const p = f.point(px, py, pz); b.add(BOX, r() < .5 ? '#8b8e87' : '#7d807a', new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), f.a + t), new THREE.Vector3(w, h, .025)), false);
  };
  f.box(0, .15, 0, .7, .3, .5, Q.wood); f.box(0, 1.0, 0, .08, 1.7, .08, Q.wood, false); f.box(0, 1.58, 0, .9, .07, .07, Q.wood, false);
  // torso: overlapping rows around an ellipse, flaring into the skirt
  for (let row = 0; row < 5; row++) {
    const yy = .95 + row * .14, rx = .27 + (row < 2 ? (2 - row) * .03 : 0), rz = .17, n = 11;
    for (let k = 0; k < n; k++) { const t = k / n * Math.PI * 2 + (row % 2) * .2; plate(Math.cos(t) * rx, yy, Math.sin(t) * rz, -t + Math.PI / 2, .1, .11); }
  }
  { const n = 13; for (let k = 0; k < n; k++) { const t = k / n * Math.PI * 2; plate(Math.cos(t) * .33, .78, Math.sin(t) * .21, -t + Math.PI / 2, .12, .16); } }
  // 披膊: shoulder guards in three hanging rows
  for (const s of [-1, 1]) for (let row = 0; row < 2; row++) for (let k = 0; k < 4; k++) plate(s * (.33 + row * .03), 1.6 - row * .1, -.12 + k * .08, Math.PI / 2, .08, .1);
  // 胄: a domed helmet of plates on its own peg, with a neck guard
  for (let row = 0; row < 3; row++) { const n = 10 - row * 2, rr = .15 - row * .04, yy = 1.82 + row * .07; for (let k = 0; k < n; k++) { const t = k / n * Math.PI * 2; plate(Math.cos(t) * rr, yy, Math.sin(t) * rr, -t + Math.PI / 2, .06, .07); } }
  f.box(0, 2.06, 0, .05, .05, .05, '#7d807a', false);
}

export function furnishArmourPit(b: Batch, g: Batch, x0: number, x1: number, z0: number, z1: number, y: number) {
  b.box((x0 + x1) / 2, y, (z0 + z1) / 2, x1 - x0 - .4, .02, z1 - z0 - .4, '#7a7366', 0, false);
  const cx = (x0 + x1) / 2;
  let seed = 31;
  for (const rz of [z0 + 4.5, z0 + 9, z0 + 13.5]) {
    for (const s of [-1, 1]) {
      // timber racks either side of the central aisle
      b.box(cx + s * 11, y, rz - .55, 13, .12, .2, Q.wood, 0, false);
      for (let k = 0; k < 3; k++) stoneArmour(b, cx + s * (5.5 + k * 4.4), y, rz, s < 0 ? 0 : Math.PI, seed++);
    }
  }
  // spare helmets on low shelves along the long walls
  for (const s of [-1, 1]) {
    const sz = s < 0 ? z0 + .9 : z1 - .9;
    // two shelf runs, leaving the doorway on the central aisle clear
    const run = (x1 - x0 - 4) / 2 - 3; for (const k of [-1, 1]) b.box(cx + k * (3 + run / 2), y, sz, run, .9, .8, Q.wood, 0, true);
    for (let x = x0 + 3; x < x1 - 2; x += 1.6) { if (Math.abs(x - cx) < 4) continue; const p = new THREE.Vector3(x, y + 1.15, sz); b.add(new THREE.SphereGeometry(.17, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), '#868982', T(p.x, p.y, p.z, 0, 1, 1.25, 1), false); b.add(new THREE.CylinderGeometry(.18, .2, .14, 10, 1, true), '#7d807a', T(p.x, p.y - .06, p.z), false); }
  }
  lampRow(b, g, x0 + 4, x1 - 4, z0 + .9, y + .9, 5);
  wallPanels(b, x0, x1, z0, z1, y + 2.2, 'x');
}

/** Bronze waterbirds (水禽): 'goose', 'swan' and 'crane' (one crane stoops to the water). */
function waterbird(b: Batch, kind: 'goose' | 'swan' | 'crane', x: number, y: number, z: number, a: number, stoop = false) {
  const f = new Frame(b, x, y, z, a), metal = kind === 'crane' ? '#7a8c78' : Q.bronze, paint = kind === 'swan' ? '#d8d6cc' : kind === 'goose' ? '#a8a08a' : '#e1ddd0';
  const s = kind === 'swan' ? 1.15 : kind === 'goose' ? .85 : .9, legs = kind === 'crane' ? .85 : .12;
  const body = f.point(0, legs + .28 * s, 0);
  b.add(new THREE.SphereGeometry(1, 12, 8), paint, new THREE.Matrix4().compose(body, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), a), new THREE.Vector3(.24 * s, .2 * s, .42 * s)), false);
  b.add(new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), metal, new THREE.Matrix4().compose(body.clone().add(new THREE.Vector3(0, .04, 0)), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), a), new THREE.Vector3(.22 * s, .14 * s, .38 * s)), false);
  if (kind === 'crane') for (const sx of [-1, 1]) f.beam([sx * .07, 0, .02], [sx * .07, legs + .1, 0], .035, metal);
  else for (const sx of [-1, 1]) f.box(sx * .08, .06, .08, .1, .12, .14, metal, false);
  const neck: V[] = kind === 'swan' ? [[0, legs + .4 * s, .32 * s], [0, legs + .78 * s, .42 * s], [0, legs + 1.0 * s, .3 * s], [0, legs + 1.02 * s, .44 * s]]
    : kind === 'goose' ? [[0, legs + .38 * s, .32 * s], [0, legs + .7 * s, .44 * s], [0, legs + .78 * s, .5 * s]]
    : stoop ? [[0, legs + .4, .3], [0, legs + .3, .62], [0, legs - .25, .8], [0, -.02 + .05, .86]] : [[0, legs + .4, .3], [0, legs + .85, .38], [0, legs + 1.15, .36]];
  for (let i = 1; i < neck.length; i++) f.beam(neck[i - 1], neck[i], kind === 'crane' ? .05 : .07 * s, i === neck.length - 1 ? metal : paint);
  const head = neck[neck.length - 1], hp = f.point(head[0], head[1], head[2]);
  b.add(new THREE.SphereGeometry(kind === 'crane' ? .06 : .08 * s, 8, 6), kind === 'crane' ? PAINT.cinnabar : paint, T(hp.x, hp.y, hp.z), false);
  const beak: V = stoop ? [head[0], head[1] - .02, head[2] + .14] : [head[0], head[1] - (kind === 'crane' ? .02 : .01), head[2] + (kind === 'crane' ? .3 : .14 * s)];
  f.beam(head, beak, kind === 'crane' ? .025 : .04, kind === 'goose' ? Q.ochre : '#4a4c50');
  if (stoop) { const w = f.point(beak[0], beak[1], beak[2]); b.add(new THREE.CylinderGeometry(.012, .012, .12, 5), Q.gold, T(w.x, w.y - .03, w.z, 0, 1, 1, 1, Math.PI / 2), false); }
}

export function furnishWaterfowlPit(b: Batch, g: Batch, water: Batch, x0: number, x1: number, z0: number, z1: number, y: number) {
  // the riverbank: a sunk channel with stone kerbs and gilt reeds, running the length of the pit
  const cz = z0 + 8;
  water.add(new THREE.PlaneGeometry(x1 - x0 - 3, 3.6).rotateX(-Math.PI / 2), '#4f8fa0', T((x0 + x1) / 2, y + .08, cz), false);
  for (const s of [-1, 1]) b.box((x0 + x1) / 2, y, cz + s * 2.05, x1 - x0 - 2.6, .3, .5, Q.stone, 0, true);
  const r = mulberry32(611);
  for (let x = x0 + 2.4; x < x1 - 2; x += 1.1) for (const s of [-1, 1]) if (r() < .55) { const zz = cz + s * (2.5 + r() * .6); b.add(new THREE.ConeGeometry(.04, .9 + r() * .5, 4), r() < .3 ? Q.gold : '#8c8a5a', T(x, y + .5, zz, r() * 3, 1, 1, 1, (r() - .5) * .3), false); }
  // birds on both banks, all turned to the water; one crane stoops to catch a gilt worm
  const north = cz - 3.4, south = cz + 3.4;
  const line = (zz: number, a: number, kinds: ('goose' | 'swan' | 'crane')[]) => kinds.forEach((k, i) => waterbird(b, k, x0 + 4 + i * (x1 - x0 - 8) / (kinds.length - 1), y, zz, a, k === 'crane' && i === 3));
  line(north, 0, ['goose', 'swan', 'goose', 'crane', 'goose', 'swan', 'goose', 'swan', 'goose']);
  line(south, Math.PI, ['swan', 'goose', 'crane', 'goose', 'swan', 'goose', 'crane', 'goose', 'swan']);
  // kneeling musicians (跽坐俑) facing the birds, between the bank and the doorway, leaving the aisle
  for (const x of [x0 + 6, x0 + 11, x0 + 16, x1 - 16, x1 - 11, x1 - 6]) {
    figure(b, tint(warriorPrims(4, Math.round(x)), c => c === '#9a4b3c' ? PAINT.azure : c === '#5f7a5c' ? PAINT.cinnabar : c), x, y, south + 3, Math.PI, true, .9);
    b.add(new THREE.CylinderGeometry(.16, .18, .3, 10), Q.bronzeBright, T(x + .45, y + .15, south + 2.6), false);
  }
  lampRow(b, g, x0 + 5, x1 - 5, z1 - .9, y, 5);
  wallPanels(b, x0, x1, z0, z1, y + 2.6, 'z');
}

/** Wall-standing bronze lamps with lit dishes along one wall. */
function lampRow(b: Batch, g: Batch, xa: number, xb: number, z: number, y: number, n: number) {
  for (let i = 0; i < n; i++) {
    const x = xa + (xb - xa) * i / Math.max(1, n - 1);
    b.add(CYL8, Q.bronze, T(x, y + 1, z, 0, .08, 2, .08)); b.add(new THREE.CylinderGeometry(.3, .14, .2, 10), Q.bronzeBright, T(x, y + 2.05, z), false);
    g.add(new THREE.ConeGeometry(.11, .32, 8), Q.molten, T(x, y + 2.3, z), false);
  }
}
/** A painted frieze of cloud-scroll panels with gilt bosses on two facing walls. */
function wallPanels(b: Batch, x0: number, x1: number, z0: number, z1: number, y: number, along: 'x' | 'z') {
  const colors = [Q.cinnabar, Q.azure, Q.ochre, Q.jade];
  if (along === 'z') for (const zz of [z0 + .04, z1 - .04]) for (let x = x0 + 1.5, i = 0; x < x1 - 1; x += 2.2, i++) { b.box(x, y, zz, 2, .9, .05, colors[i % 4], 0, false); b.box(x, y + .32, zz, .25, .25, .08, Q.gold, 0, false); }
  else for (const xx of [x0 + .04, x1 - .04]) for (let z = z0 + 1.5, i = 0; z < z1 - 1; z += 2.2, i++) { b.box(xx, y, z, .05, .9, 2, colors[i % 4], 0, false); b.box(xx, y + .32, z, .08, .25, .25, Q.gold, 0, false); }
}

// ─────────────────────────── the royal city: added detail ───────────────────────────

/** 机弩: a mounted bronze crossbow on a timber trestle, aimed along the frame's +x. */
function crossbow(b: Batch, x: number, y: number, z: number, a: number) {
  const f = new Frame(b, x, y, z, a);
  for (const s of [-1, 1]) { f.beam([-.5, 0, s * .4], [-.2, 1.1, 0], .08, Q.wood); f.beam([.5, 0, s * .4], [.2, 1.1, 0], .08, Q.wood); }
  f.box(0, 1.15, 0, 1.6, .1, .12, Q.wood, false); f.box(-.55, 1.2, 0, .3, .12, .1, Q.bronzeBright, false);
  const bow: V[] = []; for (let k = 0; k <= 8; k++) { const t = (k / 8 - .5) * 1.9; bow.push([.62 - (1 - Math.cos(t)) * .4, 1.2, Math.sin(t) * .78]); }
  for (let k = 1; k < bow.length; k++) f.beam(bow[k - 1], bow[k], .05, Q.lacquer);
  f.beam(bow[0], [-.35, 1.22, 0], .01, PAINT.bone); f.beam(bow[bow.length - 1], [-.35, 1.22, 0], .01, PAINT.bone);
  f.beam([-.3, 1.24, 0], [.95, 1.24, 0], .02, Q.bronze); f.box(1, 1.24, 0, .1, .05, .05, Q.bronzeBright, false);
}

/** 连枝灯: a bronze lamp tree of three tiers of curling branches, each holding a lit dish. */
function lampTree(b: Batch, g: Batch, x: number, y: number, z: number, h = 4.2) {
  b.add(new THREE.CylinderGeometry(.6, .8, .5, 12), Q.bronze, T(x, y + .25, z)); b.add(CYL8, Q.bronze, T(x, y + h / 2, z, 0, .1, h, .1));
  for (let tier = 0; tier < 3; tier++) {
    const yy = y + 1.6 + tier * 1.05, rr = 1.05 - tier * .28, n = 6 - tier;
    for (let k = 0; k < n; k++) {
      const t = k / n * Math.PI * 2 + tier * .5, ex = x + Math.cos(t) * rr, ez = z + Math.sin(t) * rr;
      const mid = new THREE.Vector3(x + Math.cos(t) * rr * .55, yy - .2, z + Math.sin(t) * rr * .55);
      for (const [p, q] of [[new THREE.Vector3(x, yy - .35, z), mid], [mid, new THREE.Vector3(ex, yy, ez)]] as const) {
        const m = new THREE.Matrix4().compose(p.clone().add(q).multiplyScalar(.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), q.clone().sub(p).normalize()), new THREE.Vector3(.05, p.distanceTo(q), .05));
        b.add(BOX, Q.bronzeBright, m, false);
      }
      b.add(new THREE.CylinderGeometry(.16, .07, .1, 8), Q.bronzeBright, T(ex, yy + .04, ez), false);
      g.add(new THREE.ConeGeometry(.07, .22, 6), Q.molten, T(ex, yy + .2, ez), false);
    }
  }
  b.add(new THREE.CylinderGeometry(.22, .08, .12, 8), Q.bronzeBright, T(x, y + h + .05, z), false); g.add(new THREE.ConeGeometry(.09, .3, 6), Q.molten, T(x, y + h + .27, z), false);
}

/** 编钟: a lacquered rack of graded bronze bells. */
function bellRack(b: Batch, x: number, y: number, z: number, a: number) {
  const f = new Frame(b, x, y, z, a);
  for (const s of [-1, 1]) { f.box(s * 1.9, 1.1, 0, .14, 2.2, .14, Q.lacquer); f.box(s * 1.9, .1, 0, .5, .2, .5, Q.bronze, false); }
  for (const yy of [2.15, 1.35]) f.box(0, yy, 0, 4, .12, .14, Q.redDark, false);
  for (const [row, yy] of [[0, 2.1], [1, 1.3]] as const) for (let k = 0; k < 7; k++) {
    const sz = .32 - k * .025 - row * .05, p = f.point(-1.55 + k * .52, yy - .3 - sz, 0);
    b.add(new THREE.CylinderGeometry(sz * .55, sz * .8, sz * 1.4, 8), Q.bronze, T(p.x, p.y, p.z, f.a, 1, 1, .7), false);
  }
}

/** Gilt-tipped relief mountains (九州山川) set into the floor between the mercury rivers. */
function reliefMountains(b: Batch, cx: number, y: number, cz: number) {
  const r = mulberry32(1777);
  // two sectors between the rivers, each clear of the walkways to the pit doors
  for (const [a0, a1, r0, dr] of [[.35, 1.25, 16, 2.8], [-.42, -.12, 15, 2]] as const) for (let k = 0; k < 7; k++) {
    const t = a0 + (a1 - a0) * r(), rr = r0 + r() * dr, x = cx + Math.cos(t) * rr, z = cz + Math.sin(t) * rr, h = .7 + r() * 1.3, w = .9 + r() * .9;
    b.add(new THREE.ConeGeometry(w, h, 6), r() < .5 ? '#6c7468' : '#7a8270', T(x, y + h / 2, z, r() * 3), true);
    b.add(new THREE.ConeGeometry(w * .28, h * .26, 6), Q.gold, T(x, y + h * .87, z, r() * 3), false);
  }
}

export function royalCityDetails(b: Batch, g: Batch, cx: number, y: number, cz: number, doorX: number, doorZ: number) {
  // 机弩 flank the inner face of the tomb door, aimed at whoever enters.
  for (const s of [-1, 1]) for (let k = 0; k < 2; k++) crossbow(b, doorX + 2.6 + k * 1.8, y, doorZ + s * (5.4 + k * 1.2), Math.PI + s * .35);
  // A bronze-sheathed door frame and open leaves on the hall side of the tomb door.
  const f = new Frame(b, doorX + .35, y, doorZ, Math.PI / 2);
  for (const s of [-1, 1]) { f.box(s * 3.6, 3.5, 0, 1.2, 7, 1, Q.stoneDark); f.box(s * 3.6, 3.5, .52, .8, 6.6, .06, Q.bronze, false); }
  f.box(0, 7.4, 0, 8.4, 1, 1.2, Q.stoneDark); f.box(0, 7.4, .62, 7.8, .7, .06, Q.bronzeBright, false);
  for (const s of [-1, 1]) { const leaf = new Frame(b, f.point(s * 2.9, 0, .7).x, y, f.point(s * 2.9, 0, .7).z, f.a + s * 1.25); leaf.box(-s * 1.4, 3.1, 0, 2.8, 6.2, .3, Q.bronze, false); for (let r = 0; r < 6; r++) for (let c = 0; c < 4; c++) leaf.box(-s * (.4 + c * .65), .7 + r * .95, .17, .16, .16, .08, Q.bronzeBright, false); }
  // 连枝灯 in the four corners of the hall.
  for (const [x, z] of [[cx - 19, cz - 19], [cx + 19, cz - 19], [cx - 19, cz + 19], [cx + 19, cz + 19]] as const) lampTree(b, g, x, y, z);
  // 九州山川 relief between the rivers, clear of every walkway.
  reliefMountains(b, cx, y, cz);
  // On the coffin terrace: jade bi discs, a pair of ding and a bell rack beside the canopy.
  const top = y + 3.3;
  for (let k = 0; k < 8; k++) { const t = k / 8 * Math.PI * 2 + Math.PI / 8, x = cx + Math.cos(t) * 3.9, z = cz + Math.sin(t) * 3.9; b.add(new THREE.TorusGeometry(.32, .1, 6, 16), Q.jade, T(x, top + .45, z, -t, 1, 1, 1), false); b.add(CYL8, Q.stoneDark, T(x, top + .12, z, 0, .12, .24, .12), false); }
  for (const s of [-1, 1]) {
    const x = cx + 3.2, z = cz + s * 1.9;
    b.add(new THREE.CylinderGeometry(.45, .35, .55, 14), Q.bronze, T(x, top + .5, z), false);
    for (const k of [-1, 1]) b.add(new THREE.TorusGeometry(.14, .035, 4, 10), Q.bronzeBright, T(x, top + .86, z + k * .38, Math.PI / 2), false);
    for (let k = 0; k < 3; k++) { const t = k / 3 * Math.PI * 2; b.add(CYL8, Q.bronze, T(x + Math.cos(t) * .28, top + .14, z + Math.sin(t) * .28, 0, .05, .28, .05), false); }
  }
  bellRack(b, cx - 2.6, top, cz + 5.2, 0);
  // Gilt bands on the outer coffin (椁) and a gilt-edged canopy cloth (华盖) under the roof.
  b.box(cx, top + .35, cz, 2.46, .06, 4.26, Q.gold, 0, false); b.box(cx, top + .85, cz, 2.46, .06, 4.26, Q.gold, 0, false);
  b.box(cx, top + 3.05, cz, 4.4, .08, 6, Q.redDark, 0, false); b.box(cx, top + 3.12, cz, 4.6, .04, 6.2, Q.gold, 0, false);
}

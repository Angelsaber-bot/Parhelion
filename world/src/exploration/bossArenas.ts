/**
 * Boss arena dressing. Camlann first: the field where the Vacant King waits is the last battle
 * of the old kingdom, so it is staged as one — a sea of swords left standing in the earth,
 * a broken ring of standing stones, torn war banners, dropped shields and spears, and behind the
 * king the throne nobody sits on. Swords, banners and debris are visual only; stones and the
 * throne dais are solid. Everything stays clear of the core and of the fight's centre.
 */
import * as THREE from 'three';
import { Frame, type V3 } from './models';
import type { SiteArt } from '../story/campaignSites';
import { SHIP_INTERIOR, flagshipPoint } from '../map/shipInteriorCut';

type Terrain = (x: number, z: number) => number;
export const CAMLANN = Object.freeze({ boss: [-940, 202] as const, core: [-926, 212] as const, clear: 7.5, stones: 33, swords: 70 });

/**
 * The region art already rings the core mound with ten plain blocks (region-local, radius 10 around
 * the core; their tops measured above the terrain). Those blocks are cut out of the streamed art
 * and re-hewn here; their colliders stay in the region's collision mesh, so the new stones are
 * visual only and sized to cover them.
 */
export const CORE_RING = Object.freeze({ local: [-206, 212] as const, offsetX: -720, radius: 10, reach: 1.35, tops: [.9, 2.82, 5.07, .9, 4.22, 2.77, .89, 3.38, 3.34, .9] as const });
const ringCentre = (k: number, cx: number, cz: number) => { const a = k / CORE_RING.tops.length * Math.PI * 2; return [cx + Math.cos(a) * CORE_RING.radius, cz + Math.sin(a) * CORE_RING.radius, a] as const; };

/** Streamed Britain art minus the core ring's blocks, or null when this mesh holds none of them. */
export function carveCoreRing(region: string, name: string, geometry: THREE.BufferGeometry): THREE.BufferGeometry | null {
  if (region !== 'britain' || !/Limestone/.test(name)) return null;
  const pos = geometry.getAttribute('position'); if (!pos) return null;
  const [lx, lz] = CORE_RING.local, centres = CORE_RING.tops.map((_, k) => ringCentre(k, lx, lz));
  const near = (i: number) => { const x = pos.getX(i), z = pos.getZ(i); for (let k = 0; k < centres.length; k++) if (Math.hypot(x - centres[k][0], z - centres[k][1]) < CORE_RING.reach) return k + 1; return 0; };
  const index = geometry.index, count = index ? index.count : pos.count, keep: number[] = [];
  let cut = 0;
  for (let t = 0; t < count; t += 3) {
    const a = index ? index.getX(t) : t, b = index ? index.getX(t + 1) : t + 1, c = index ? index.getX(t + 2) : t + 2;
    const k = near(a);
    if (k && near(b) === k && near(c) === k) { cut++; continue; }
    keep.push(a, b, c);
  }
  if (!cut) return null;
  const out = geometry.clone(); out.setIndex(keep); out.computeBoundingSphere(); return out;
}

function rng(seed: number) { let s = seed >>> 0; return () => { s = Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9 >>> 0; s ^= s >>> 13; return (s >>> 0) / 4294967296; }; }

/** A point h metres up an axis tilted by `lean` towards local +z. */
const along = (lean: number, h: number, x = 0): V3 => [x, h * Math.cos(lean), h * Math.sin(lean)];
/** A sword driven into the ground at an angle: blade, fuller, crossguard, wrapped grip, pommel. */
function sword(f: Frame, lean: number, rusted: boolean) {
  const steel = rusted ? '#7d6a58' : '#b9c0c8', guard = rusted ? '#5d4a36' : '#a7894f';
  const rot: V3 = [lean, 0, 0], up = (h: number) => along(lean, h);
  f.box(up(.45), [.07, 1.05, .018], steel, 'metal', rot);
  f.box(up(.5), [.016, .9, .024], rusted ? '#6a5848' : '#8e969f', 'metal', rot);
  f.box(up(1.0), [.36, .05, .06], guard, 'metal', rot);
  f.box(up(1.15), [.045, .24, .045], '#3b2a1e', 'body', rot);
  f.sphere(up(1.3), [.05, .05, .05], guard, 'metal');
}

/** A hewn stone: a six-sided column whose corners are knocked about, with a sloped, chipped top. */
function hewn(seed: number) {
  const g = new THREE.CylinderGeometry(.74, 1, 1, 6, 3), pos = g.attributes.position, v = new THREE.Vector3();
  const hash = (x: number, y: number, z: number) => { const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + seed * 19.3) * 43758.5453; return h - Math.floor(h); };
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const k = hash(+v.x.toFixed(3), +v.y.toFixed(3), +v.z.toFixed(3)), radial = .84 + k * .3;
    v.x *= radial; v.z *= radial;
    if (v.y > .49) v.y += v.x * .22 - .06 * k; // a slanted, broken-off crown
    else v.y += (k - .5) * .06;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  const flat = g.toNonIndexed(); g.dispose(); flat.computeVertexNormals(); return flat; // faceted, chiselled light
}
let HEWN: THREE.BufferGeometry[] | null = null;
const hewnStone = (i: number) => (HEWN ??= [1, 2, 3, 4].map(hewn))[i % 4];
const STONE = ['#8f8a80', '#878278', '#999389', '#7e7a71'], LICHEN = ['#7b8a54', '#9aa064', '#c2b56a'];

/** A standing stone, sometimes snapped: hewn faceted body, damp moss skirt, lichen, carved notches, rubble. */
function menhir(f: Frame, h: number, w: number, lean: number, broken: boolean, r: () => number, solid = true) {
  const height = broken ? h * .55 : h, d = w * .62, rot: V3 = [lean, 0, lean * .5], tone = STONE[Math.floor(r() * STONE.length)];
  f.part(hewnStone(Math.floor(r() * 4)), [0, height / 2 - .1, 0], [w / 2, height, d / 2], tone, 'body', rot, solid);
  f.cyl([0, .1, 0], w * .62, .26, '#5d6a42', 'body', 8);
  f.cyl([0, .02, 0], w * .9, .1, '#6c6448', 'body', 8);
  for (let i = 0; i < 4; i++) {
    const y = .5 + r() * height * .7, side = r() < .5 ? 1 : -1;
    f.sphere([(r() - .5) * w * .5, y, side * d * .46], [.18 + r() * .22, .1 + r() * .14, .05], LICHEN[i % 3]);
  }
  for (let i = 0; i < 3; i++) f.box([w * .42, 1.1 + i * .45, d * .2], [.05, .03, .1 + (i % 2) * .08], '#55514a', 'body', [0, 0, lean * .5]);
  for (let i = 0; i < 3; i++) { const a = r() * Math.PI * 2, s = .22 + r() * .3; f.part(hewnStone(i), [Math.cos(a) * w * .9, s * .3, Math.sin(a) * w * .9], [s, s * .7, s * .8], tone, 'body', [r(), r(), r()]); }
  if (broken) f.part(hewnStone(2), [w * 1.1, w * .32, .9], [w * .48, h * .42, d * .48], tone, 'body', [0, .4, Math.PI / 2 - .1], solid);
}

/** A torn war banner on a leaning pole: sun disc on crimson, ragged lower edge. */
function banner(f: Frame, lean: number) {
  const rot: V3 = [lean, 0, 0];
  f.cyl(along(lean, 2.6), .06, 5.2, '#4a3424', 'body', 8, rot);
  f.box(along(lean, 5.0), [1.3, .06, .06], '#4a3424', 'body', rot);
  f.box(along(lean, 4.15), [1.2, 1.6, .03], '#7c1d1d', 'body', rot);
  for (let i = 0; i < 5; i++) f.box(along(lean, 3.25 - (i % 2) * .18, -.48 + i * .24), [.2, .35 + (i % 2) * .3, .03], '#6a1818', 'body', [lean, 0, (i - 2) * .06]);
  const disc = along(lean, 4.25); disc[2] += .03;
  f.cyl(disc, .32, .02, '#e0b45a', 'metal', 20, [Math.PI / 2 + lean, 0, 0]);
}

/** The Vacant Throne: a stepped dais, a tall cracked back, armrests with lion caps, a crown left on the seat. */
function throne(f: Frame) {
  const stone = '#9c968c', dark = '#6f6a62', gold = '#d7ae5a';
  f.box([0, .2, 0], [7.2, .4, 6], dark, 'body', [0, 0, 0], true);
  f.box([0, .55, -.5], [5.6, .3, 4.4], stone, 'body', [0, 0, 0], true);
  f.box([0, .85, -1], [4.2, .3, 3], dark, 'body', [0, 0, 0], true);
  f.box([0, 1.45, -1.3], [2.2, .9, 1.6], stone, 'body', [0, 0, 0], true);
  f.box([0, 3.6, -2.05], [2.4, 4.2, .4], stone, 'body', [0, 0, 0], true);
  f.box([0, 5.9, -2.05], [1.6, .5, .42], dark, 'body');
  f.cone([0, 6.45, -2.05], .55, .7, dark, 'body', 4);
  f.box([.35, 4.4, -1.83], [.06, 1.9, .02], '#3e3a35', 'body', [0, 0, .25]);
  for (const s of [-1, 1]) {
    f.box([s * 1.25, 2.15, -1.2], [.3, .5, 1.7], dark, 'body');
    f.sphere([s * 1.25, 2.5, -.4], [.24, .24, .24], gold, 'metal');
    f.cyl([s * 2.6, 1.6, .4], .32, 1.5, stone, 'body', 12, [0, 0, 0], true);
    f.cyl([s * 2.6, 2.45, .4], .5, .2, dark, 'body', 12);
    f.cyl([s * 2.6, 2.6, .4], .38, .12, '#2b1a10', 'body', 12);
    f.gem([s * 2.6, 2.95, .4], .3, '#ff9a3a', [0, s * .4, 0], 1.6);
  }
  // the crown nobody wears, tipped on the seat
  f.torus([.25, 2.0, -1.0], .28, .05, gold, 'metal', [Math.PI / 2 - .5, 0, .3]);
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; f.cone([.25 + Math.cos(a) * .28, 2.14 + Math.sin(a) * .1, -1.0 + Math.sin(a) * .2], .05, .18, gold, 'metal', 4, [-.5, 0, .3]); }
  f.gem([.25, 2.08, -1.24], .06, '#ff5a5a');
}

export function camlannArena(art: SiteArt, terrain: Terrain) {
  const [bx, bz] = CAMLANN.boss, [cx, cz] = CAMLANN.core;
  const r = rng(537);
  const at = (x: number, z: number, yaw = 0, sink = 0) => new Frame(art, [x, terrain(x, z) - sink, z], yaw);
  const clearOf = (x: number, z: number, margin: number) => Math.hypot(x - cx, z - cz) > margin && Math.hypot(x - bx, z - bz) > CAMLANN.clear;
  // the throne sits behind the king as seen from the core, facing the challenger
  const dx = bx - cx, dz = bz - cz, d = Math.hypot(dx, dz), tx = bx + dx / d * 15, tz = bz + dz / d * 15;
  throne(at(tx, tz, Math.atan2(-dx, -dz), .25));
  // sea of swords
  let placed = 0;
  for (let i = 0; i < 400 && placed < CAMLANN.swords; i++) {
    const a = r() * Math.PI * 2, rad = 9 + Math.sqrt(r()) * 24, x = bx + Math.cos(a) * rad, z = bz + Math.sin(a) * rad;
    if (!clearOf(x, z, 5) || Math.hypot(x - tx, z - tz) < 5) continue;
    sword(at(x, z, r() * Math.PI * 2, .35), .12 + r() * .42, r() < .45); placed++;
  }
  // broken ring of standing stones, with a gap facing the core so the way in reads at once
  const gate = Math.atan2(cz - bz, cx - bx);
  for (let i = 0; i < 14; i++) {
    const a = i / 14 * Math.PI * 2 + .11;
    if (Math.abs(Math.atan2(Math.sin(a - gate), Math.cos(a - gate))) < .38) continue;
    const rad = CAMLANN.stones + (r() - .5) * 2.4, x = bx + Math.cos(a) * rad, z = bz + Math.sin(a) * rad;
    menhir(at(x, z, -a, .3), 3.0 + r() * 2.2, 1.1 + r() * .7, (r() - .5) * .14, r() < .3, r);
    if (i % 2 === 0) banner(at(bx + Math.cos(a + .12) * (rad - 2.2), bz + Math.sin(a + .12) * (rad - 2.2), -a + Math.PI, .2), (r() - .5) * .3);
  }
  // the core mound's own ring, re-hewn over the region's plain blocks
  const ring = rng(212);
  CORE_RING.tops.forEach((top, k) => {
    const [x, z, a] = ringCentre(k, cx, cz), stub = top < 1.2;
    menhir(at(x, z, -a, .3), stub ? (top + .4) / .55 : top + .4, 1.5, (ring() - .5) * .08, stub, ring, false);
  });
  // dropped shields and broken spears
  for (let i = 0; i < 26; i++) {
    const a = r() * Math.PI * 2, rad = 10 + r() * 22, x = bx + Math.cos(a) * rad, z = bz + Math.sin(a) * rad;
    if (!clearOf(x, z, 5)) continue;
    const f = at(x, z, r() * Math.PI * 2);
    if (i % 2) { f.cyl([0, .06, 0], .5, .07, i % 4 === 1 ? '#2a3f7a' : '#7c1d1d', 'body', 12, [.05, 0, .08]); f.cyl([0, .1, 0], .14, .05, '#a7894f', 'metal', 12); }
    else { f.cyl([0, .05, 0], .035, 2.2, '#5a4030', 'body', 8, [0, 0, Math.PI / 2]); f.cone([1.15, .05, 0], .06, .3, '#8e969f', 'metal', 4, [0, 0, -Math.PI / 2]); }
  }
  return { throne: [tx, tz] as const, swords: placed };
}

// ───────────────────────── Red Square: the frozen retreat ─────────────────────────
/**
 * The Winter Warden keeps watch over an army that never got home: snow drifted over abandoned guns,
 * eagle standards frozen stiff, musket stacks and drums left where they fell, blue watch-fires that give
 * no heat, and behind the Warden a great cracked bell on its plinth. Everything but the bell is visual.
 */
export const RED_SQUARE = Object.freeze({ boss: [96, -924] as const, core: [96, -948] as const, clear: 7.5 });

function drift(f: Frame, s: number) {
  f.sphere([0, 0, 0], [s * 1.6, s * .42, s], '#eef3f8');
  f.sphere([s * .7, -.02, s * .25], [s * .9, s * .3, s * .7], '#dbe5f0');
}
function frozenCannon(f: Frame) {
  const iron = '#3c4249', wood = '#5b4636', snow = '#f1f5fa';
  f.cyl([0, .95, .2], .2, 2.4, iron, 'metal', 12, [Math.PI / 2 - .12, 0, 0]);
  f.cyl([0, 1.06, -1.0], .27, .3, iron, 'metal', 12, [Math.PI / 2 - .12, 0, 0]);
  f.box([0, .55, -.4], [.7, .3, 1.8], wood, 'body', [-.1, 0, 0]);
  for (const s of [-1, 1]) { f.torus([s * .5, .55, -.1], .5, .07, wood, 'body', [0, Math.PI / 2, 0]); f.cyl([s * .5, .55, -.1], .1, .12, iron, 'metal', 8, [0, 0, Math.PI / 2]); }
  f.box([0, .2, -1.6], [.25, .2, 1.4], wood, 'body', [.15, 0, 0]);
  f.sphere([0, 1.12, .3], [.24, .08, 1.0], snow);
  f.sphere([0, .72, -.5], [.4, .08, .8], snow);
  f.sphere([.4, 0, .2], [1.5, .4, .9], snow);
  for (let i = 0; i < 3; i++) f.sphere([-.7 - i * .26, .12, .6 + (i % 2) * .2], [.13, .13, .13], iron, 'metal');
}
function eagleStandard(f: Frame, lean: number) {
  const rot: V3 = [lean, 0, 0], gold = '#c9a24a';
  f.cyl(along(lean, 1.8), .04, 3.6, '#4a3626', 'body', 8, rot);
  const top = along(lean, 3.75);
  f.box(top, [.22, .12, .1], gold, 'metal', rot);
  f.sphere([top[0], top[1] + .2, top[2]], [.12, .16, .1], gold, 'metal');
  for (const s of [-1, 1]) f.box([top[0] + s * .2, top[1] + .26, top[2]], [.3, .05, .06], gold, 'metal', [lean, 0, s * .5]);
  // a tricolour frozen stiff mid-flap, icicles on the hem
  const c = along(lean, 3.05);
  ['#2c3f8f', '#e8e6e0', '#a3262a'].forEach((col, i) => f.box([c[0] + .2 + i * .3, c[1], c[2]], [.3, .7, .03], col, 'body', [lean, 0, .06]));
  for (let i = 0; i < 6; i++) f.cone([c[0] + .1 + i * .16, c[1] - .42, c[2]], .03, .16 + (i % 3) * .06, '#cfeeff', 'glow', 4, [Math.PI, 0, 0]);
  f.sphere([c[0] + .5, c[1] + .36, c[2]], [.48, .05, .06], '#f1f5fa');
}
function musketStack(f: Frame) {
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; f.cyl([Math.cos(a) * .22, .75, Math.sin(a) * .22], .025, 1.6, '#4a3626', 'body', 8, [Math.sin(a) * .28, 0, -Math.cos(a) * .28]); }
  f.sphere([0, 1.52, 0], [.16, .06, .16], '#f1f5fa');
  f.cyl([.7, .2, .3], .22, .34, '#2c3f8f', 'body', 12, [Math.PI / 2 - .3, 0, .4]);
  f.torus([.7, .2, .3], .22, .02, '#c9a24a', 'metal', [.3, 0, .4]);
  f.cyl([-.6, .13, -.4], .12, .26, '#20242c', 'body', 8, [.4, 0, Math.PI / 2]);
}
function coldWatchFire(f: Frame) {
  f.cyl([0, .5, 0], .07, 1.0, '#2c3036', 'metal', 8);
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; f.cyl([Math.cos(a) * .3, .4, Math.sin(a) * .3], .03, .9, '#2c3036', 'metal', 8, [Math.sin(a) * .35, 0, -Math.cos(a) * .35]); }
  f.cyl([0, 1.05, 0], .42, .2, '#3c4249', 'metal', 12);
  f.gem([0, 1.4, 0], .22, '#8fe6ff', [0, .3, 0], 2.2);
  f.gem([.12, 1.3, .08], .12, '#c9f6ff', [0, .9, .2], 2);
}
/** The great bell that cracked in the fire and never rang again, on a stepped granite plinth. */
function crackedBell(f: Frame) {
  const granite = '#8d939b', bronze = '#86a28c', dark = '#5b7363';
  f.cyl([0, .3, 0], 3.4, .6, granite, 'body', 8, [0, 0, 0], true);
  f.cyl([0, .8, 0], 2.7, .4, '#7a8088', 'body', 8, [0, 0, 0], true);
  f.lathe([[0, 5.6], [.9, 5.6], [1.1, 5.35], [1.25, 4.6], [1.4, 3.6], [1.7, 2.4], [2.15, 1.5], [2.45, 1.08], [2.5, 1.0], [2.2, 1.0]], [0, 0, 0], bronze, 'metal', 20, true);
  f.torus([0, 5.95, 0], .45, .12, dark, 'metal', [0, 0, 0]);
  f.torus([0, 4.2, 0], 1.33, .05, '#c9a24a', 'metal', [Math.PI / 2, 0, 0]);
  f.torus([0, 1.55, 0], 2.13, .06, '#c9a24a', 'metal', [Math.PI / 2, 0, 0]);
  f.box([1.05, 2.8, 1.65], [.05, 2.2, .04], '#20242c', 'body', [0, -.55, .18]);
  // the broken-off piece rests against the plinth, its edge rimed with frost
  f.box([2.6, 1.25, 1.4], [1.4, 1.6, .22], bronze, 'metal', [.1, -.6, .55], true);
  f.box([2.6, 2.0, 1.4], [1.3, .08, .26], '#e8f6ff', 'body', [.1, -.6, .55]);
  f.sphere([0, 5.65, 0], [1.0, .25, 1.0], '#f1f5fa');
  f.sphere([0, 1.06, 0], [2.4, .12, 2.4], '#eef3f8');
}

export function redSquareArena(art: SiteArt, terrain: Terrain) {
  const [bx, bz] = RED_SQUARE.boss, [cx, cz] = RED_SQUARE.core, r = rng(1812);
  const at = (x: number, z: number, yaw = 0, sink = 0) => new Frame(art, [x, terrain(x, z) - sink, z], yaw);
  const clearOf = (x: number, z: number) => Math.hypot(x - cx, z - cz) > 6 && Math.hypot(x - bx, z - bz) > RED_SQUARE.clear;
  const dx = bx - cx, dz = bz - cz, d = Math.hypot(dx, dz), tx = bx + dx / d * 14, tz = bz + dz / d * 14;
  crackedBell(at(tx, tz, Math.atan2(-dx, -dz), .1));
  const away = (x: number, z: number) => clearOf(x, z) && Math.hypot(x - tx, z - tz) > 5;
  const ring = (n: number, rMin: number, rMax: number, place: (x: number, z: number, a: number) => void) => {
    for (let i = 0, k = 0; i < n * 6 && k < n; i++) {
      const a = r() * Math.PI * 2, rad = rMin + r() * (rMax - rMin), x = bx + Math.cos(a) * rad, z = bz + Math.sin(a) * rad;
      if (away(x, z)) { place(x, z, a); k++; }
    }
  };
  ring(18, 9, 24, (x, z) => drift(at(x, z, r() * 6.28, .25), .8 + r() * 1.4));
  ring(4, 13, 20, (x, z, a) => frozenCannon(at(x, z, a + Math.PI / 2 + (r() - .5), .05)));
  ring(6, 7, 18, (x, z) => musketStack(at(x, z, r() * 6.28, .05)));
  // eagle standards and cold watch-fires alternate round the duel, the gap left towards the core
  const gate = Math.atan2(cz - bz, cx - bx);
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2 + .2; if (Math.abs(Math.atan2(Math.sin(a - gate), Math.cos(a - gate))) < .45) continue;
    const x = bx + Math.cos(a) * 16, z = bz + Math.sin(a) * 16; if (!away(x, z)) continue;
    if (i % 2) eagleStandard(at(x, z, -a + Math.PI / 2, .1), (r() - .5) * .3); else coldWatchFire(at(x, z, r() * 6.28));
  }
  return { bell: [tx, tz] as const };
}

// ───────────────────────── Honnō-ji: the temple that burned ─────────────────────────
/**
 * The Hellfire Lord stands in the courtyard of a temple already burning: scorched earth, fallen beams
 * still glowing, volleys of arrows in the ground, torn nobori of the attacking army, and behind the Lord a
 * gold-leaf folding screen half eaten by fire. All visual; the courtyard's own lanterns keep their places.
 */
export const HONNOJI = Object.freeze({ boss: [-86, 765] as const, core: [-74, 765] as const, clear: 6.5 });

function scorch(f: Frame, s: number) {
  f.cyl([0, .02, 0], s, .03, '#2a1c17', 'body', 12);
  f.cyl([s * .3, .035, -s * .2], s * .55, .03, '#1c1210', 'body', 12);
  for (let i = 0; i < 3; i++) f.gem([(i - 1) * s * .4, .06, (i % 2 - .5) * s * .5], .05, '#ff7a3a', [Math.PI / 2, 0, 0], .6);
}
function fallenBeam(f: Frame, len: number) {
  f.box([0, .22, 0], [.34, .34, len], '#2b1d16', 'body', [.04, 0, .1]);
  f.box([0, .4, 0], [.2, .04, len * .8], '#ff6a2a', 'glow', [.04, 0, .1]);
  f.box([.18, .2, len * .3], [.04, .18, len * .25], '#ff8a3a', 'glow', [.04, 0, .1]);
  f.box([0, .28, len / 2 + .05], [.4, .4, .1], '#18100c', 'body');
}
function arrowVolley(f: Frame, r: () => number) {
  for (let i = 0; i < 7; i++) {
    const x = (r() - .5) * 1.6, z = (r() - .5) * 1.6, t = .3 + r() * .25, yaw = .2 + r() * .4, rot: V3 = [t, yaw, 0];
    f.cyl([x, .38, z - .1], .012, .8, '#6b5236', 'body', 8, rot);
    f.box([x, .74, z - .3], [.07, .12, .01], '#e8e2d4', 'body', rot);
  }
}
function nobori(f: Frame, lean: number, burnt: boolean) {
  const rot: V3 = [lean, 0, 0];
  f.cyl(along(lean, 2.4), .035, 4.8, '#3a2a1e', 'body', 8, rot);
  f.box(along(lean, 4.75, .32), [.66, .04, .04], '#3a2a1e', 'body', rot);
  const h = burnt ? 2.1 : 3.0, mid = along(lean, 4.7 - h / 2, .32);
  f.box(mid, [.6, h, .02], '#a9cde0', 'body', rot);
  const mon = along(lean, 4.15, .32); mon[2] += .02;
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; f.sphere([mon[0] + Math.cos(a) * .1, mon[1] + Math.sin(a) * .1, mon[2]], [.08, .08, .01], '#f4f6f8'); }
  if (burnt) { const e = along(lean, 4.7 - h, .32); f.box(e, [.6, .06, .03], '#ff6a2a', 'glow', rot); }
}
/** A six-panel gold-leaf screen standing in a zigzag, its lower panels eaten by fire. */
function burningByobu(f: Frame) {
  const w = 1.05, h = 3.3;
  for (let i = 0; i < 6; i++) {
    const x = (i - 2.5) * w * .92, z = i % 2 ? .22 : -.22, yaw = i % 2 ? .45 : -.45, burnt = i === 1 || i === 4;
    const ph = burnt ? h * .62 : h;
    f.box([x, .1 + (h - ph) + ph / 2, z], [w, ph, .04], '#d9b45a', 'metal', [0, yaw, 0]);
    f.box([x, .1 + h - .05, z], [w + .04, .08, .07], '#2a1a12', 'body', [0, yaw, 0]);
    f.box([x, .1 + (h - ph), z], [w, .06, .06], '#ff6a2a', 'glow', [0, yaw, 0]);
    // painted pines and cloud bands
    f.box([x, 2.5, z + (i % 2 ? .03 : -.03)], [w * .8, .22, .01], '#f2e2b0', 'body', [0, yaw, 0]);
    if (!burnt) f.cone([x, 1.6, z + (i % 2 ? .03 : -.03)], .26, .6, '#3f6a3a', 'body', 4, [Math.PI / 2, yaw, 0]);
  }
  f.box([0, .05, 0], [6.8, .1, 1.4], '#1c1210', 'body');
}

export function honnojiArena(art: SiteArt, terrain: Terrain) {
  const [bx, bz] = HONNOJI.boss, [cx, cz] = HONNOJI.core, r = rng(1582);
  const at = (x: number, z: number, yaw = 0, sink = 0) => new Frame(art, [x, terrain(x, z) - sink, z], yaw);
  const dx = bx - cx, dz = bz - cz, d = Math.hypot(dx, dz), tx = bx + dx / d * 9, tz = bz + dz / d * 9;
  burningByobu(at(tx, tz, Math.atan2(dx, dz) + Math.PI, 0));
  const away = (x: number, z: number) => Math.hypot(x - cx, z - cz) > 5 && Math.hypot(x - bx, z - bz) > HONNOJI.clear && Math.hypot(x - tx, z - tz) > 3.5;
  const scatter = (n: number, rMin: number, rMax: number, place: (x: number, z: number) => void) => {
    for (let i = 0, k = 0; i < n * 6 && k < n; i++) {
      const a = r() * Math.PI * 2, rad = rMin + r() * (rMax - rMin), x = bx + Math.cos(a) * rad, z = bz + Math.sin(a) * rad;
      if (away(x, z)) { place(x, z); k++; }
    }
  };
  scatter(12, 3, 16, (x, z) => scorch(at(x, z), 1 + r() * 1.6));
  scatter(5, 7, 14, (x, z) => fallenBeam(at(x, z, r() * 6.28, .05), 3 + r() * 2.5));
  scatter(8, 7, 15, (x, z) => arrowVolley(at(x, z, r() * 6.28, .1), r));
  for (let i = 0; i < 6; i++) {
    const a = Math.atan2(dz, dx) + (i - 2.5) * .42, x = bx + Math.cos(a) * 8.5, z = bz + Math.sin(a) * 8.5;
    if (Math.hypot(x - tx, z - tz) < 3.5) continue;
    nobori(at(x, z, -a + Math.PI / 2, .1), (r() - .5) * .3, i % 2 === 0);
  }
  return { screen: [tx, tz] as const };
}

// ───────────────────────── the flagship: a deck that came back from the sea ─────────────────────────
/**
 * The Drowned Admiral fights on his own main deck, which has been under water a long time: barnacles
 * and coral crusting the rails, kelp hanging inboard, glowing brine pooled on the planks, shot stacked
 * for guns that will never be served, ghost-lit lanterns, and on the quarterdeck the chart table with
 * the sealed order that never made port. Placed in ship coordinates (u sternward, v starboard) so it
 * rides the hull, clear of the hatches and of the fight's centre line. All visual.
 */
export const FLAGSHIP_DECK = Object.freeze({ main: 7, quarter: 9.6, rail: 5.6, lane: 2.1 });

export function flagshipDeckArena(art: SiteArt) {
  const r = rng(1718), yaw = SHIP_INTERIOR.yaw;
  const at = (u: number, v: number, y: number = FLAGSHIP_DECK.main, turn = 0) => new Frame(art, flagshipPoint(u, v, y), yaw + turn);
  const onHatch = (u: number, v: number) => SHIP_INTERIOR.hatches.some(([u0, u1, v0, v1]) => u > u0 - .6 && u < u1 + .6 && v > v0 - .6 && v < v1 + .6);
  let props = 0;
  // barnacles, coral and kelp along both rails
  for (let u = -16; u <= 10; u += 2.2) for (const side of [-1, 1]) {
    const f = at(u + (r() - .5), side * FLAGSHIP_DECK.rail, 8);
    for (let i = 0; i < 4; i++) f.sphere([(r() - .5) * .3, .05 + r() * .1, (r() - .5) * .9], [.07 + r() * .07, .05, .07 + r() * .07], i % 2 ? '#c9c2ae' : '#9fb4a8');
    if (r() < .5) f.cone([0, .18, (r() - .5) * .6], .09, .32, '#e07a6a', 'body', 4, [0, r() * 3, .2]);
    for (let i = 0; i < 3; i++) f.box([-side * .16, -.62 - i * .06, (i - 1) * .22], [.05, .5 + r() * .3, .1], i % 2 ? '#2f5d3c' : '#3f7448', 'body', [0, 0, side * .1]);
    props++;
  }
  // glowing brine pooled on the planks
  for (let i = 0, k = 0; i < 60 && k < 12; i++) {
    const u = -17 + r() * 27, v = (r() - .5) * 9.4;
    if (onHatch(u, v) || Math.abs(v) < .4) continue;
    const f = at(u, v, FLAGSHIP_DECK.main + .02, r() * 6);
    const w = .35 + r() * .4; f.sphere([0, 0, 0], [w * 1.4, .015, w], '#2c8a86'); f.sphere([.08, .01, .04], [w * .5, .012, w * .35], '#8ff0dc', 'glow');
    k++; props++;
  }
  // round shot stacked for guns nobody serves, and coiled hawsers
  for (const [u, v] of [[8, 4.4], [8, -4.4], [-14, 4.2], [-14, -4.2]] as const) {
    const f = at(u, v);
    for (let layer = 0; layer < 3; layer++) for (let i = 0; i < 3 - layer; i++) for (let j = 0; j < 3 - layer; j++)
      f.sphere([(i - (2 - layer) / 2) * .26, .13 + layer * .21, (j - (2 - layer) / 2) * .26], [.13, .13, .13], '#2a2e33', 'metal');
    const coil = at(u - 2.2, v * .85);
    for (let i = 0; i < 4; i++) coil.torus([0, .06 + i * .07, 0], .42 - i * .05, .05, '#8a7656', 'body', [Math.PI / 2, 0, 0]);
    props += 2;
  }
  // ghost-lit lanterns on the rail posts
  for (const [u, side] of [[-12, 1], [-12, -1], [8, 1], [8, -1], [-2, 1], [-2, -1]] as const) {
    const f = at(u, side * (FLAGSHIP_DECK.rail - .1), 8);
    f.cyl([0, .35, 0], .03, .7, '#2a2e33', 'metal', 8); f.box([0, .85, 0], [.26, .34, .26], '#2a2e33', 'metal');
    f.gem([0, .85, 0], .1, '#7dffcf', [0, .4, 0], 1.6); props++;
  }
  // on the quarterdeck: the chart table and the order that never made port
  const q = at(16.5, 2.2, FLAGSHIP_DECK.quarter, .2);
  q.box([0, .8, 0], [1.6, .08, 1.0], '#4a3424', 'body');
  for (const [x, z] of [[-.7, -.4], [.7, -.4], [-.7, .4], [.7, .4]]) q.box([x, .4, z], [.08, .8, .08], '#3a2a1e', 'body');
  q.box([.1, .85, 0], [1.2, .01, .8], '#d9c9a0', 'body', [0, .1, 0]);
  q.box([-.35, .87, .1], [.3, .02, .2], '#efe4c4', 'body', [0, -.3, 0]);
  q.sphere([-.35, .9, .1], [.05, .02, .05], '#9b1d1d');
  q.gem([-.35, 1.05, .1], .06, '#7dffcf', [0, 0, 0], 1.2);
  q.cyl([.5, .95, .2], .06, .18, '#c9a24a', 'metal', 8, [0, 0, Math.PI / 2 - .2]);
  q.box([0, .2, -1.1], [1.0, .5, .6], '#3f2c1e', 'body'); q.box([0, .48, -1.1], [1.04, .08, .64], '#c9a24a', 'metal');
  props++;
  return { props };
}

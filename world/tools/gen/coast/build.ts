// Structures, props and vegetation for 星落海岸.
import * as THREE from 'three';
import { Batch, T, BOX, distToPolyline } from '../geo.js';
import { mulberry32, range, fbm } from '../rng.js';
import { PAL, type Piece } from '../structures.js';
import { canopy, conifer } from '../vegetation.js';
import type { Marker } from '../layout.js';
import {
  COAST, CRATER, LIGHTHOUSE, PLATEAU, TEMPLE, STAIRS, VILLAGE, PIER, ARCH, ISLES, STACKS, PATHS, UPDRAFTS,
} from './layout.js';
import { coastD } from './terrain.js';

type HeightAt = (x: number, z: number) => number;

const CYL8 = new THREE.CylinderGeometry(1, 1, 1, 8);
const CYL20 = new THREE.CylinderGeometry(1, 1, 1, 20);
const ROCK = new THREE.DodecahedronGeometry(1, 0);
const CRYSTAL = new THREE.OctahedronGeometry(1, 0);
const BALL = new THREE.IcosahedronGeometry(1, 0);
const BLOB = new THREE.IcosahedronGeometry(1, 1);
const CONE = new THREE.ConeGeometry(1, 1, 12);
const ROOF = new THREE.CylinderGeometry(1, 1, 1, 3, 1, false, Math.PI / 2); // apex up after rz = π/2
const WL = COAST.waterLevel;

const C = {
  ...PAL,
  red: '#e2574c',
  redDark: '#b8443d',
  cream: '#f4ead2',
  roofTeal: '#3fa7a8',
  roofOrange: '#e98545',
  roofBlue: '#4f7fd0',
  violet: '#5b4a8a',
  violetDark: '#3c3263',
  crystalA: '#8ff1ff',
  crystalB: '#c9a2ff',
  crystalC: '#ffb3e6',
  palm: '#5fbf62',
  palmDark: '#3f9e58',
  palmTrunk: '#b98e5e',
  dirt: '#c99a63',
  sea: '#7a7ea6',
  flowerA: '#ff9ed2',
  flowerB: '#ffe27a',
  flowerC: '#ffffff',
  flowerD: '#a7c7ff',
};

const _v = new THREE.Vector3();
const _col = new THREE.Color();
/** Add a piece with normals pointing away from `centre` (soft, volumetric toon shading). */
function soft(out: Batch, geo: THREE.BufferGeometry, m: THREE.Matrix4, centre: THREE.Vector3, color: string, grad = 0.35, yScale = 1) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k);
  g.applyMatrix4(m);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const nor = new Float32Array(pos.count * 3), col = new Float32Array(pos.count * 3);
  _col.set(color);
  for (let i = 0; i < pos.count; i++) {
    _v.set(pos.getX(i) - centre.x, (pos.getY(i) - centre.y) * yScale, pos.getZ(i) - centre.z).normalize();
    nor[i * 3] = _v.x; nor[i * 3 + 1] = _v.y; nor[i * 3 + 2] = _v.z;
    const k = 1 - grad + grad * (0.5 + 0.5 * _v.y) * 1.6;
    col[i * 3] = _col.r * k; col[i * 3 + 1] = _col.g * k; col[i * 3 + 2] = _col.b * k;
  }
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.vis.push(g);
}

export function buildCoast(heightAt: HeightAt) {
  const pieces: Piece[] = [];
  const markers: Marker[] = [];
  const mk = (m: Marker) => markers.push(m);
  const rng = mulberry32(COAST.seed + 5);
  const glow = new Batch('Glow_Props', 'M_Emissive');
  const rocks = new Batch('Rocks');
  const leaves = new Batch('Trees_Leaves', 'M_Foliage');
  const trunks = new Batch('Trees_Trunks');
  const bushes = new Batch('Bushes', 'M_Foliage');
  const falls = new Batch('Waterfall', 'M_Waterfall');
  pieces.push({ name: 'Glow_Props', material: 'M_Emissive', batch: glow });

  const slope = (x: number, z: number) => {
    const e = 1.5;
    return Math.hypot(heightAt(x + e, z) - heightAt(x - e, z), heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e);
  };
  const lowest = (x: number, z: number, r: number) =>
    Math.min(heightAt(x, z), heightAt(x + r, z), heightAt(x - r, z), heightAt(x, z + r), heightAt(x, z - r));

  // ───────────────────────── Tide Pier village (spawn) ─────────────────────────
  {
    const b = new Batch('Village');
    const [vx, vz] = VILLAGE.c;
    // pier: starts where the beach drops below deck height, runs south into the sea
    const { x: px, y: py } = PIER;
    let zs = 140;
    while (zs < PIER.z1 && heightAt(px, zs) > py - 0.25) zs += 0.5;
    const z1 = PIER.z1;
    b.box(px, py - 0.35, (zs + z1) / 2, 4, 0.35, z1 - zs, C.wood);
    for (let z = zs + 1; z < z1; z += 4)
      for (const s of [-1.8, 1.8]) b.add(CYL8, C.woodDark, T(px + s, (py - 4) / 2 - 0.2, z, 0, 0.18, py + 4, 0.18), false);
    // planks texture: darker cross strips (visual only)
    for (let z = zs + 0.5; z < z1; z += 1.2) b.box(px, py - 0.01, z, 4.02, 0.02, 0.12, C.woodDark, 0, false);
    // end platform + bollards + lamp posts
    b.box(px, py - 0.35, z1 + 3, 10, 0.35, 6, C.wood);
    for (const [dx, dz] of [[-4.5, 0.5], [4.5, 0.5], [-4.5, 5.5], [4.5, 5.5]]) {
      b.add(CYL8, C.woodDark, T(px + dx, (py - 4) / 2, z1 + dz, 0, 0.25, py + 4, 0.25), false);
      b.add(CYL8, C.metalDark, T(px + dx, py + 0.3, z1 + dz, 0, 0.22, 0.6, 0.22));
    }
    for (let z = zs + 6; z <= z1 + 4; z += 12) {
      b.add(CYL8, C.metalDark, T(px - 2.2, py + 1.6, z, 0, 0.08, 3.2, 0.08), false);
      glow.add(BALL, C.glowGold, T(px - 2.2, py + 3.3, z, 0, 0.28, 0.36, 0.28), false);
    }
    // moored boats
    for (const [bx, bz, ry, hc] of [[px + 6.5, z1 - 6, 0.08, C.red], [px - 6, z1 - 14, -0.1, C.roofBlue], [px + 7, zs + 10, 0.2, C.cream]] as const) {
      b.add(BOX, hc, T(bx, WL + 0.15, bz, ry, 2.6, 1.0, 7));
      b.add(BOX, C.wood, T(bx, WL + 0.7, bz, ry, 2.2, 0.15, 6.4), false);
      b.add(ROOF, C.white, T(bx, WL + 0.6, bz + 3.6, ry, 0.9, 2.6, 0.7, 0, Math.PI / 2), false);
      b.add(BOX, C.cream, T(bx, WL + 1.4, bz - 1, ry, 1.6, 1.2, 2));
    }

    // stilt houses with colourful roofs
    const roofs = [C.roofTeal, C.roofOrange, C.red, C.roofBlue, C.roofTeal, C.roofOrange];
    const homes: [number, number, number][] = [[-18, -6, 0.3], [-12, 10, -0.2], [12, -12, 0.15], [18, 6, -0.4], [-2, 18, 0.05], [24, 20, 0.6]];
    homes.forEach(([dx, dz, ry], i) => {
      const x = vx + dx, z = vz + dz, g = lowest(x, z, 3.5);
      const floor = Math.max(g + 0.7, WL + 1.6);
      const w = 6 + (i % 2), d = 5;
      const cos = Math.cos(ry), sin = Math.sin(ry);
      const at = (lx: number, lz: number): [number, number] => [x + lx * cos + lz * sin, z - lx * sin + lz * cos];
      b.add(BOX, C.wood, T(x, floor - 0.2, z, ry, w + 2, 0.4, d + 2)); // deck
      for (const [lx, lz] of [[-(w / 2 + 0.8), -(d / 2 + 0.8)], [w / 2 + 0.8, -(d / 2 + 0.8)], [-(w / 2 + 0.8), d / 2 + 0.8], [w / 2 + 0.8, d / 2 + 0.8]]) {
        const [sx, sz] = at(lx, lz);
        b.add(CYL8, C.woodDark, T(sx, (floor + g - 1) / 2, sz, 0, 0.2, floor - g + 1, 0.2), false);
      }
      b.add(BOX, C.cream, T(x, floor + 1.6, z, ry, w, 3.2, d));
      b.add(ROOF, roofs[i], T(x, floor + 3.2 + 0.6, z, ry, 1.6, w + 1.2, (d + 1.6) / 1.732, 0, Math.PI / 2));
      { const [ax, az] = at(0, d / 2 + 0.03); b.add(BOX, C.woodDark, T(ax, floor + 1.05, az, ry, 1.1, 2.1, 0.06), false); }
      for (const lx of [-w / 2 + 1.2, w / 2 - 1.2]) {
        const [wx, wz] = at(lx, d / 2 + 0.04);
        glow.add(BOX, C.glowGold, T(wx, floor + 1.9, wz, ry, 0.9, 0.7, 0.05), false);
      }
      // ramp from the sand up to the deck
      const [rx, rz] = at(0, d / 2 + 3.2);
      const rg = heightAt(rx, rz);
      if (floor - rg > 0.3) b.ramp(rx, rz, rg - 0.1, floor, 3.2, 1.8, C.wood, ry);
      // paper lantern on a pole
      const [lxp, lzp] = at(w / 2 + 0.6, d / 2 + 0.6);
      b.add(CYL8, C.woodDark, T(lxp, floor + 1.2, lzp, 0, 0.06, 2.4, 0.06), false);
      glow.add(CYL8, i % 2 ? C.glowPink : C.glowGold, T(lxp, floor + 2.2, lzp, 0, 0.26, 0.42, 0.26), false);
    });
    // drying racks, crates, nets
    for (let i = 0; i < 6; i++) {
      const x = vx + range(rng, -22, 26), z = vz + range(rng, -18, 22);
      if (distToPolyline(x, z, PATHS[0]) < 3) continue;
      b.box(x, heightAt(x, z) - 0.05, z, 1.1, 1.1, 1.1, C.crate, range(rng, 0, 3));
    }
    for (const [dx, dz] of [[4, -2], [-6, 2]]) {
      const x = vx + dx, z = vz + dz, g = heightAt(x, z);
      for (const s of [-1.5, 1.5]) b.add(CYL8, C.woodDark, T(x + s, g + 1, z, 0, 0.07, 2, 0.07), false);
      b.add(CYL8, C.woodDark, T(x, g + 1.9, z, 0, 0.05, 3.2, 0.05, 0, Math.PI / 2), false);
      for (let k = -1; k <= 1; k++) b.add(BOX, C.canvas, T(x + k * 0.9, g + 1.4, z, 0, 0.7, 0.9, 0.04), false);
    }
    pieces.push({ name: 'Village', material: 'M_Toon', batch: b, outline: true });

    const sy = heightAt(64, 146);
    mk({ id: 'spawn_p1', type: 'spawn', label: '玩家1出生点', p: [64, sy, 146] });
    mk({ id: 'spawn_p2', type: 'spawn', label: '玩家2出生点', p: [68, heightAt(68, 146), 146] });
    mk({ id: 'pier_end', type: 'poi', label: '码头尽头', p: [px, py, z1 + 3] });
  }


  // ───────────────────────── Watch Lighthouse ─────────────────────────
  {
    const b = new Batch('Lighthouse');
    const [cx, cz] = LIGHTHOUSE.c;
    const base = heightAt(cx, cz) - 0.3;
    const H = LIGHTHOUSE.h;
    // tower: tapered, white with red bands
    const bands = 6;
    for (let i = 0; i < bands; i++) {
      const y0 = base + (H * i) / bands, h = H / bands;
      const r0 = 4.2 - (1.0 * i) / bands, r1 = 4.2 - (1.0 * (i + 1)) / bands;
      b.add(new THREE.CylinderGeometry(r1, r0, 1, 24), i % 2 ? C.red : C.white, T(cx, y0 + h / 2, cz, 0, 1, h, 1));
    }
    b.add(CYL20, C.stone, T(cx, base + 0.4, cz, 0, 5.4, 0.8, 5.4));
    // door + windows
    b.box(cx + 4.05, base + 0.8, cz, 0.3, 2.2, 1.3, C.woodDark, 0, false);
    // spiral ramp around the outside
    const R = 5.65, seg = 24, turns = 4, rise = H / (seg * turns);
    const segLen = (2 * Math.PI * R) / seg;
    const slopeA = Math.atan2(rise, segLen);
    let lastA = 0;
    for (let k = 0; k < seg * turns; k++) {
      const a = ((k + 0.5) / seg) * Math.PI * 2;
      const y = base + 0.8 + (k + 0.5) * rise;
      const x = cx + Math.cos(a) * R, z = cz + Math.sin(a) * R;
      b.add(BOX, k % 2 ? C.stone : C.concrete, T(x, y - 0.15, z, -a, 2.3, 0.3, segLen + 0.35, -slopeA));
      // rail
      const rx = cx + Math.cos(a) * (R + 1.1), rz = cz + Math.sin(a) * (R + 1.1);
      b.add(BOX, C.woodDark, T(rx, y + 0.35, rz, -a, 0.12, 0.9, segLen + 0.3, -slopeA));
      if (k % 3 === 0) b.add(CYL8, C.woodDark, T(cx + Math.cos(a) * (R - 0.4), y - 1.4, cz + Math.sin(a) * (R - 0.4), 0, 0.12, 2.4, 0.12), false);
      lastA = a;
    }
    // gallery: ring sectors, leaving an opening above the last flight of the ramp
    const top = base + 0.8 + H;
    const nSec = 24;
    for (let s = 0; s < nSec; s++) {
      const a = ((s + 0.5) / nSec) * Math.PI * 2;
      let da = ((lastA - a) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
      if (da < 3.1) continue; // stairwell opening: keeps > 2.4 m headroom over the ramp below
      const w = (2 * Math.PI * 5.4) / nSec + 0.3;
      b.add(BOX, C.concrete, T(cx + Math.cos(a) * 5.4, top - 0.2, cz + Math.sin(a) * 5.4, -a, 4.2, 0.4, w));
      b.add(BOX, C.red, T(cx + Math.cos(a) * 7.35, top + 0.5, cz + Math.sin(a) * 7.35, -a, 0.15, 1.0, w));
    }
    b.add(CYL20, C.concrete, T(cx, top - 0.2, cz, 0, 3.4, 0.4, 3.4));
    // lamp room + roof
    glow.add(new THREE.CylinderGeometry(2.3, 2.3, 2.8, 16), '#e9fbff', T(cx, top + 1.4, cz), true);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      b.add(BOX, C.metalDark, T(cx + Math.cos(a) * 2.35, top + 1.4, cz + Math.sin(a) * 2.35, -a, 0.18, 2.8, 0.18), false);
    }
    b.add(CONE, C.red, T(cx, top + 3.8, cz, 0, 3.0, 2.2, 3.0));
    b.add(BALL, C.gold, T(cx, top + 5.1, cz, 0, 0.4, 0.4, 0.4), false);
    pieces.push({ name: 'Lighthouse', material: 'M_Toon', batch: b, outline: true });

    // rotating beacon beams, shown once the lamp is lit
    const beam = new Batch('Beacon', 'M_Beam');
    for (const s of [0, Math.PI]) {
      const g = new THREE.ConeGeometry(5, 90, 16, 1, true).translate(0, -45, 0); // apex at origin, opening along -Y
      beam.add(g, C.glowGold, T(cx, top + 1.4, cz, s, 1, 1, 1, Math.PI / 2 + 0.05), false);
    }
    pieces.push({ name: 'Beacon', material: 'M_Beam', batch: beam, userData: { showWhen: 'lighthouse_lamp', spin: 0.55, pivot: [cx, cz] } });
    mk({ id: 'lighthouse_lamp', type: 'interact', label: '灯塔明灯', p: [cx + 4.4, top, cz + 0.5], radius: 3.2, requires: ['temple_altar'] });
    mk({ id: 'disc_lighthouse_top', type: 'discovery', label: '灯塔之巅', p: [cx, top, cz + 4.6], radius: 3, note: '从这里可以滑翔到海蚀柱' });
  }

  // ───────────────────────── Whitesand Bay: sea arch + stepping stones ─────────────────────────
  {
    const [ax, az] = ARCH.c, y0 = WL - 1.4;
    const arch = new THREE.TorusGeometry(9, 3, 8, 18, Math.PI);
    rocks.add(arch, C.sea, T(ax, y0, az, 0, 1, 1, 1.05));
    // knobbly rock skin over the arch
    for (let i = 0; i <= 14; i++) {
      const p = (i / 14) * Math.PI;
      const s = range(rng, 1.6, 2.6);
      rocks.add(ROCK, i % 2 ? C.rock : C.rockDark, T(ax + Math.cos(p) * 9 + range(rng, -0.6, 0.6), y0 + Math.sin(p) * 9 + 1.4, az + range(rng, -1.6, 1.6), range(rng, 0, 6), s, s * 0.8, s), false);
    }
    // grassy cap on the crown
    rocks.add(CYL20, C.moss, T(ax, y0 + 12.05, az, 0, 2.2, 0.25, 2.6), false);
    // stepping stones: low lead-in stones rise out of the sand, then climb to the crown
    const stone = (x: number, z: number, h: number, i: number) => {
      const g = Math.min(heightAt(x, z), WL - 0.5);
      rocks.add(CYL8, i % 2 ? C.rock : C.stone, T(x, (h - 0.35 + g - 1) / 2, z, i, 1.1, h - 0.35 - g + 1, 1.1));
      rocks.add(new THREE.CylinderGeometry(1.0, 1.25, 0.5, 8), C.rockDark, T(x, h - 0.25, z, i * 0.7));
      rocks.add(CYL8, C.moss, T(x, h + 0.02, z, i * 0.7, 0.95, 0.06, 0.95), false);
    };
    for (let i = 0; i <= 10; i++) stone(ax + 22 - 2.05 * i, az - 4.7 - Math.sin(i * 0.6) * 0.4, WL + 1.2 + 1.0 * i, i);
    for (let m = 1; m <= 14; m++) {
      const x = ax + 22 + 2.0 * m, z = az - 4.7 + m * 0.6, h = WL + 1.2 - 0.25 * m;
      if (heightAt(x, z) > h - 0.3) break; // reached the beach
      stone(x, z, h, m + 20);
    }
    // tide pools and shells on the beach
    for (let i = 0; i < 18; i++) {
      const a = range(rng, 0, Math.PI * 2), d = range(rng, 18, 34);
      const x = ax + Math.cos(a) * d, z = az + Math.sin(a) * d * 0.7;
      const h = heightAt(x, z);
      if (h < WL - 0.8 || h > WL + 2) continue;
      const s = range(rng, 0.5, 1.4);
      rocks.add(ROCK, C.rockDark, T(x, h - s * 0.3, z, range(rng, 0, 6), s * 1.4, s * 0.6, s));
    }
    mk({ id: 'shard_arch', type: 'interact', label: '星之碎片·潮', p: [ax, y0 + 12.3, az], radius: 3.2 });
    const shard = new Batch('Shard_arch', 'M_Emissive');
    shard.add(CRYSTAL, C.crystalA, T(ax, y0 + 13.6, az, 0.4, 0.5, 1.0, 0.5), false);
    pieces.push({ name: 'Shard_arch', material: 'M_Emissive', batch: shard, userData: { hideWhen: 'shard_arch', bob: true } });
    mk({ id: 'disc_tidepool', type: 'discovery', label: '潮池星螺', p: [ax + 20, heightAt(ax + 20, az + 12), az + 12], radius: 4 });
  }

  // ───────────────────────── Sea stacks ─────────────────────────
  STACKS.forEach((s, i) => {
    const [x, z] = s.c;
    const g = Math.min(heightAt(x, z), WL - 2);
    let y = g;
    while (y < WL + s.h - 1) {
      const r = s.r * range(rng, 0.85, 1.1);
      rocks.add(ROCK, (Math.round(y) % 2) ? C.rock : C.sea, T(x + range(rng, -0.5, 0.5), y + r * 0.7, z + range(rng, -0.5, 0.5), range(rng, 0, 6), r, r * 0.9, r));
      y += r * 1.1;
    }
    const top = WL + s.h;
    rocks.add(CYL20, C.rock, T(x, top - 1.2, z, 0, s.r * 0.95, 2.4, s.r * 0.95));
    rocks.add(CYL20, C.moss, T(x, top + 0.05, z, 0, s.r * 0.9, 0.2, s.r * 0.9), false);
    if (i === 0) mk({ id: 'disc_stack_top', type: 'discovery', label: '海蚀柱之巅', p: [x, top, z], radius: 4, note: '从灯塔滑翔而来' });
  });

  // ───────────────────────── Starfall Crater ─────────────────────────
  {
    const b = new Batch('Crater');
    const [cx, cz] = CRATER.c, f = heightAt(cx, cz);
    // meteor core: dark faceted rock wrapped in glowing crystal
    b.add(ROCK, C.violetDark, T(cx, f + 3.2, cz, 0.7, 6, 5, 6, 0.2));
    b.add(ROCK, C.violet, T(cx + 3.5, f + 1.5, cz - 2, 1.4, 3, 2.6, 3));
    b.add(ROCK, C.violet, T(cx - 3.2, f + 1.2, cz + 2.8, 2.1, 2.6, 2.2, 2.8));
    const cols = [C.crystalA, C.crystalB, C.crystalC];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + range(rng, -0.2, 0.2);
      const r = range(rng, 3.4, 5.2), h = range(rng, 2.5, 5);
      glow.add(CRYSTAL, cols[i % 3], T(cx + Math.cos(a) * r, f + 3 + h * 0.4, cz + Math.sin(a) * r, a, 0.7, h, 0.7, Math.cos(a) * 0.5, -Math.sin(a) * 0.5), false);
    }
    // crystal clusters across the bowl (collide: good cover)
    for (let i = 0; i < 26; i++) {
      const a = range(rng, 0, Math.PI * 2), d = range(rng, 9, CRATER.R - 6);
      const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      const g = heightAt(x, z), c = cols[i % 3];
      const n = 2 + Math.floor(rng() * 3);
      for (let k = 0; k < n; k++) {
        const h = range(rng, 1.2, 3.6), t = range(rng, -0.5, 0.5);
        glow.add(CRYSTAL, c, T(x + range(rng, -1, 1), g + h * 0.35, z + range(rng, -1, 1), range(rng, 0, 6), h * 0.28, h, h * 0.28, t, range(rng, -0.5, 0.5)), k === 0);
      }
      b.add(ROCK, C.violet, T(x, g, z, range(rng, 0, 6), 1.3, 0.6, 1.1), false);
    }
    // floating debris orbiting the core (visual; the runtime spins it)
    const debris = new Batch('Crater_Debris');
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2, r = range(rng, 9, 15), s = range(rng, 0.5, 1.4);
      debris.add(ROCK, i % 3 ? C.violet : C.violetDark, T(cx + Math.cos(a) * r, f + range(rng, 8, 16), cz + Math.sin(a) * r, range(rng, 0, 6), s, s, s), false);
    }
    pieces.push({ name: 'Crater_Debris', material: 'M_Toon', batch: debris, outline: true, userData: { spin: 0.08, pivot: [cx, cz] } });
    // rim boulders
    for (let i = 0; i < 22; i++) {
      const a = range(rng, 0, Math.PI * 2), d = CRATER.R + range(rng, -2, 4);
      const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d, s = range(rng, 1.2, 3);
      b.add(ROCK, rng() > 0.5 ? C.rock : C.violet, T(x, lowest(x, z, s) + s * 0.3, z, range(rng, 0, 6), s * 1.2, s * 0.8, s));
    }
    pieces.push({ name: 'Crater', material: 'M_Toon', batch: b, outline: true });
    mk({ id: 'shard_crater', type: 'interact', label: '星之碎片·陨', p: [cx + 7.5, heightAt(cx + 7.5, cz), cz], radius: 4 });
    const shard = new Batch('Shard_crater', 'M_Emissive');
    shard.add(CRYSTAL, C.crystalB, T(cx + 7.5, heightAt(cx + 7.5, cz) + 1.6, cz, 0, 0.5, 1.0, 0.5), false);
    pieces.push({ name: 'Shard_crater', material: 'M_Emissive', batch: shard, userData: { hideWhen: 'shard_crater', bob: true } });
    mk({ id: 'disc_crater_rim', type: 'discovery', label: '陨坑北缘', p: [cx, heightAt(cx, cz - CRATER.R - 2), cz - CRATER.R - 2], radius: 5 });
    for (const [dx, dz] of [[-14, 6], [12, 14], [16, -12]])
      mk({ id: `enemy_crater_${dx}`, type: 'enemy', label: '晶化守卫（占位）', p: [cx + dx, heightAt(cx + dx, cz + dz), cz + dz], note: '巡逻/掩体战 AI 训练场景' });
  }

  // ───────────────────────── Floating Isles ─────────────────────────
  {
    const b = new Batch('Isles');
    for (const isle of ISLES) {
      const [x, z] = isle.c, y = isle.y, r = isle.r;
      b.add(new THREE.CylinderGeometry(r, r * 0.94, 1.6, 22), C.moss, T(x, y - 0.8, z));
      b.add(new THREE.CylinderGeometry(r * 0.95, r * 0.8, 2.2, 14), C.dirt, T(x, y - 2.6, z), false);
      b.add(new THREE.ConeGeometry(r * 0.82, r * 1.7, 10), C.rock, T(x, y - 3.7 - r * 0.85, z, 0, 1, 1, 1, Math.PI));
      for (let k = 0; k < 6; k++) {
        const a = range(rng, 0, Math.PI * 2), d = range(rng, 0.2, 0.6) * r, s = range(rng, 0.8, 1.8) * r * 0.22;
        b.add(ROCK, k % 2 ? C.rockDark : C.sea, T(x + Math.cos(a) * d, y - 4 - range(rng, 0, r * 0.9), z + Math.sin(a) * d, range(rng, 0, 6), s, s * 1.3, s), false);
      }
      // hanging roots / vines
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2 + range(rng, -0.3, 0.3), L = range(rng, 1.5, 4.5);
        bushes.add(BOX, C.palmDark, T(x + Math.cos(a) * r * 0.92, y - 1.6 - L / 2, z + Math.sin(a) * r * 0.92, -a, 0.12, L, 0.12), false);
      }
      // a couple of small trees and flowers on top
      const nt = isle.r > 9 ? 3 : 1;
      for (let k = 0; k < nt; k++) {
        const a = range(rng, 0, Math.PI * 2), d = range(rng, 0.3, 0.6) * r, s = range(rng, 0.7, 1.0);
        const tx = x + Math.cos(a) * d, tz = z + Math.sin(a) * d, th = 2.6 * s;
        trunks.add(CYL8, C.wood, T(tx, y + th / 2, tz, 0, 0.3 * s, th, 0.3 * s), false);
        trunks.addCol(BOX, T(tx, y + 2, tz, 0, 0.6 * s, 4, 0.6 * s));
        canopy(leaves, rng, tx, y + th + 1.1 * s, tz, 2.1 * s, 1.7 * s, k % 2 ? '#7fd06f' : '#f7b2cf');
      }
      for (let k = 0; k < 14; k++) {
        const a = range(rng, 0, Math.PI * 2), d = range(rng, 0, 0.85) * r, s = range(rng, 0.12, 0.22);
        bushes.add(BALL, [C.flowerA, C.flowerB, C.flowerC, C.flowerD][k % 4], T(x + Math.cos(a) * d, y + 0.15, z + Math.sin(a) * d, 0, s, s, s), false);
      }
    }
    // i4: ruined sky gazebo holding the second shard
    {
      const i4 = ISLES.find((i) => i.id === 'i4')!;
      const [x, z] = i4.c, y = i4.y;
      b.add(CYL20, C.white, T(x, y + 0.2, z, 0, 5, 0.4, 5));
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2, h = k === 2 ? 2.2 : 5.2;
        b.add(CYL8, C.white, T(x + Math.cos(a) * 4.2, y + 0.4 + h / 2, z + Math.sin(a) * 4.2, 0, 0.38, h, 0.38));
        if (k !== 2) b.add(BOX, C.gold, T(x + Math.cos(a) * 4.2, y + 0.4 + h + 0.15, z + Math.sin(a) * 4.2, -a, 0.9, 0.3, 0.9), false);
      }
      b.add(new THREE.TorusGeometry(4.2, 0.3, 6, 24, Math.PI * 1.3), C.gold, T(x, y + 5.9, z, 0.6, 1, 1, 1, Math.PI / 2), false);
      mk({ id: 'shard_isle', type: 'interact', label: '星之碎片·空', p: [x, y + 0.4, z], radius: 3 });
      const shard = new Batch('Shard_isle', 'M_Emissive');
      shard.add(CRYSTAL, C.crystalC, T(x, y + 2.0, z, 0, 0.5, 1.0, 0.5), false);
      pieces.push({ name: 'Shard_isle', material: 'M_Emissive', batch: shard, userData: { hideWhen: 'shard_isle', bob: true } });
      // waterfall spilling off i2 (the big one) into the crater wind
      const i2 = ISLES.find((i) => i.id === 'i2')!;
      const fx = i2.c[0] + i2.r * 0.95, fz = i2.c[1], top = i2.y - 0.2;
      const bottom = heightAt(fx + 1.5, fz);
      falls.add(BOX, '#ffffff', T(fx + 1.2, (top + bottom) / 2, fz, Math.PI / 2, 3.2, top - bottom, 0.25), false);
      bushes.add(CYL20, '#e8fbff', T(fx + 1.2, bottom + 0.4, fz, 0, 3.4, 0.8, 3.4), false); // splash
    }
    {
      const i6 = ISLES.find((i) => i.id === 'i6')!;
      const [x, z] = i6.c, y = i6.y;
      b.box(x, y, z, 2.2, 1.6, 1.4, C.stone);
      b.add(ROOF, C.red, T(x, y + 2.0, z, 0, 0.8, 2.8, 1.3, 0, Math.PI / 2), false);
      glow.add(BALL, C.glowCyan, T(x, y + 1.0, z + 0.75, 0, 0.25, 0.25, 0.1), false);
      mk({ id: 'disc_isle6', type: 'discovery', label: '孤岛秘庭', p: [x, y, z + 2], radius: 4, note: '从陨坑上升气流滑翔可达' });
    }
    pieces.push({ name: 'Isles', material: 'M_Toon', batch: b, outline: true });
    for (const isle of ISLES) mk({ id: `isle_${isle.id}`, type: 'poi', label: `浮空岛 ${isle.id.toUpperCase()}`, p: [isle.c[0], isle.y, isle.c[1]] });
  }

  // ───────────────────────── Cliff stairs ─────────────────────────
  {
    const b = new Batch('Stairs');
    const [laneA, laneB] = STAIRS.lanes;
    const zN = STAIRS.z0 + 3, zS = STAIRS.z1 - 3; // flights run between these, landings outside
    const L = zS - zN;
    const g = Math.max(heightAt(laneA, zS + 2), heightAt(laneB, zS + 2), heightAt(laneA, zN - 2), heightAt(laneB, zN - 2)) + 0.1;
    const nFl = 4;
    const zTop = nFl % 2 ? zN - 1.5 : zS + 1.5;
    const topY = heightAt(PLATEAU.edge + 6, zTop);
    const rise = (topY - g) / nFl;
    for (let k = 0; k < nFl; k++) {
      const north = k % 2 === 0;
      const x = north ? laneA : laneB;
      const y0 = g + k * rise, y1 = y0 + rise;
      b.ramp(x, (zN + zS) / 2, y0, y1, L, 4, C.stone, north ? Math.PI : 0);
      // landing at the far end, spanning both lanes
      const zl = north ? zN - 1.5 : zS + 1.5;
      b.box((laneA + laneB) / 2, y1 - 0.3, zl, 9, 0.3, 3, C.concrete);
      // supports + rails
      for (const zz of [zN + 1, (zN + zS) / 2, zS - 1]) {
        const t = north ? (zS - zz) / L : (zz - zN) / L;
        const yy = y0 + rise * t;
        const gg = heightAt(x, zz);
        if (yy - gg > 1) b.add(CYL8, C.concreteDark, T(x, (yy + gg) / 2 - 0.3, zz, 0, 0.35, yy - gg, 0.35), false);
      }
      const rail = x + (north ? -2.1 : 2.1);
      if (!north) {
        // inner lane rail on the cliff side is unnecessary; rail the outer lane only
      } else b.ramp(rail, (zN + zS) / 2, y0 + 0.9, y1 + 0.9, L, 0.12, C.woodDark, Math.PI);
    }
    // top: bridge from the last landing onto the plateau
    const x0 = laneA - 2, x1 = PLATEAU.edge + 8;
    b.box((x0 + x1) / 2, topY - 0.3, zTop, x1 - x0, 0.3, 3, C.concrete);
    const r0 = laneB + 2.4; // rails start past the stair lanes so the last flight can step onto the bridge
    for (const s of [-1.6, 1.6]) b.box((r0 + x1) / 2, topY, zTop + s, x1 - r0, 0.8, 0.15, C.gold, 0, true);
    glow.add(BALL, C.glowGold, T(laneA - 2, topY + 1.2, zTop, 0, 0.3, 0.3, 0.3), false);
    pieces.push({ name: 'Stairs', material: 'M_Toon', batch: b, outline: true });
    mk({ id: 'stairs_foot', type: 'poi', label: '断崖石阶', p: [laneA, g, zS + 3] });
  }

  // ───────────────────────── Cliff Temple ─────────────────────────
  {
    const b = new Batch('Temple');
    const [cx, cz] = TEMPLE.c, g = lowest(cx, cz, 14) - 0.2;
    const tiers = [[16, 1], [12, 1], [8, 1]] as const;
    let y = g;
    tiers.forEach(([r, h], i) => {
      b.add(new THREE.CylinderGeometry(r, r + 0.4, h + (i === 0 ? 2 : 0), 28), i === 1 ? C.stone : C.white, T(cx, y + (h - (i === 0 ? 2 : 0)) / 2, cz));
      // west ramp into each tier
      b.ramp(cx - r - 1.6, cz, y - 0.05, y + h, 3.4, 4, C.stone, -Math.PI / 2);
      b.add(CYL20, C.gold, T(cx, y + h + 0.02, cz, 0, r - 0.3, 0.06, r - 0.3), false);
      y += h;
    });
    const floor = y;
    // pillar ring on tier 2, gold capitals
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2;
      if (Math.abs(Math.cos(a) + 1) < 0.1) continue; // keep the west approach open
      const px = cx + Math.cos(a) * 10.5, pz = cz + Math.sin(a) * 10.5;
      const h = k === 3 ? 3.5 : 7.5;
      b.add(CYL8, C.white, T(px, g + 2 + h / 2, pz, 0, 0.6, h, 0.6));
      if (k !== 3) b.add(BOX, C.gold, T(px, g + 2 + h + 0.2, pz, -a, 1.5, 0.4, 1.5));
      else b.add(ROCK, C.white, T(px + 1.6, g + 2.4, pz, 1, 0.9, 0.5, 0.7), false); // fallen capital
    }
    // floating halo rings
    glow.add(new THREE.TorusGeometry(10.5, 0.22, 6, 64), C.glowGold, T(cx, g + 11, cz, 0, 1, 1, 1, Math.PI / 2), false);
    b.add(new THREE.TorusGeometry(7.5, 0.35, 6, 48), C.gold, T(cx, g + 13.5, cz, 0, 1, 1, 1, Math.PI / 2 - 0.12), false);
    // altar with three sockets
    b.add(CYL20, C.stone, T(cx, floor + 0.6, cz, 0, 2.2, 1.2, 2.2));
    b.add(CYL20, C.gold, T(cx, floor + 1.25, cz, 0, 1.8, 0.1, 1.8), false);
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + Math.PI / 2;
      glow.add(CRYSTAL, [C.crystalA, C.crystalB, C.crystalC][k], T(cx + Math.cos(a) * 1.2, floor + 1.7, cz + Math.sin(a) * 1.2, 0, 0.22, 0.45, 0.22), false);
    }
    pieces.push({ name: 'Temple', material: 'M_Toon', batch: b, outline: true });
    const beam = new Batch('Temple_Beam', 'M_Beam');
    beam.add(new THREE.CylinderGeometry(1.1, 1.6, 160, 20, 1, true), C.glowGold, T(cx, floor + 80, cz), false);
    pieces.push({ name: 'Temple_Beam', material: 'M_Beam', batch: beam, userData: { showWhen: 'temple_altar' } });
    mk({ id: 'temple_altar', type: 'interact', label: '星辉祭坛', p: [cx - 2.6, floor, cz], radius: 3.5, requires: ['shard_crater', 'shard_isle', 'shard_arch'] });
    mk({ id: 'disc_temple_view', type: 'discovery', label: '断崖观景台', p: [PLATEAU.edge + 6, heightAt(PLATEAU.edge + 6, -36), -36], radius: 5 });
    for (const [dx, dz] of [[-6, 12], [8, -10]])
      mk({ id: `enemy_temple_${dx}`, type: 'enemy', label: '神殿守卫（占位）', p: [cx + dx, floor, cz + dz] });
  }

  // ───────────────────────── Updraft bases (stone vents) ─────────────────────────
  {
    const b = new Batch('Vents');
    for (const u of UPDRAFTS) {
      const g = u.y0 < 10 ? heightAt(u.x, u.z) : u.y0 + 1; // isle vents sit on the isle top
      b.add(CYL20, C.stone, T(u.x, g + 0.1, u.z, 0, u.r * 0.7, 0.3, u.r * 0.7), false);
      glow.add(new THREE.TorusGeometry(u.r * 0.62, 0.08, 6, 32), C.glowCyan, T(u.x, g + 0.28, u.z, 0, 1, 1, 1, Math.PI / 2), false);
    }
    pieces.push({ name: 'Vents', material: 'M_Toon', batch: b, outline: true });
  }

  // ───────────────────────── Vegetation ─────────────────────────
  const blocked = (x: number, z: number) => {
    const near = (c: readonly [number, number], r: number) => Math.hypot(x - c[0], z - c[1]) < r;
    if (near(VILLAGE.c, 30) || near(LIGHTHOUSE.c, 12) || near(TEMPLE.c, TEMPLE.r + 4) || near(CRATER.c, CRATER.R + 3)) return true;
    if (x > STAIRS.lanes[0] - 5 && x < PLATEAU.edge + 10 && z > STAIRS.z0 - 4 && z < STAIRS.z1 + 4) return true;
    if (Math.abs(x - PIER.x) < 6 && z > 150) return true;
    for (const u of UPDRAFTS) if (near([u.x, u.z], u.r + 2)) return true;
    for (const p of PATHS) if (distToPolyline(x, z, p) < 3.5) return true;
    return false;
  };
  let nPalm = 0, nTree = 0;
  const STEP = 6;
  for (let gz = -COAST.half; gz < COAST.half; gz += STEP)
    for (let gx = -COAST.half; gx < COAST.half; gx += STEP) {
      const x = gx + range(rng, 0, STEP), z = gz + range(rng, 0, STEP);
      const roll = rng(), s = range(rng, 0.8, 1.3), ry = range(rng, 0, Math.PI * 2);
      if (Math.abs(x) > COAST.playHalf + 12 || Math.abs(z) > COAST.playHalf + 12) continue;
      const h = heightAt(x, z);
      if (h < WL + 0.7 || blocked(x, z) || slope(x, z) > 0.8) continue;
      const d = coastD(x, z);
      const n = fbm(x * 0.02, z * 0.02, 3, COAST.seed + 40);
      const y = h - 0.3;
      if (d > 3 && d < 44 && h < 9) {
        // palm: leaning segmented trunk + drooping fronds
        if (roll > 0.16 + Math.max(0, n) * 0.25) continue;
        nPalm++;
        const lean = range(rng, 0.12, 0.32), segs = 6, segH = 1.05 * s;
        let px = x, py = y, pz = z;
        for (let k = 0; k < segs; k++) {
          const tilt = lean * (k / segs) * 1.6;
          const dx = Math.sin(tilt) * segH, dy = Math.cos(tilt) * segH;
          const mx = px + Math.cos(ry) * dx / 2, mz = pz + Math.sin(ry) * dx / 2;
          trunks.add(new THREE.CylinderGeometry(0.2 * s, 0.26 * s, 1, 7), k % 2 ? C.palmTrunk : '#a57d52', T(mx, py + dy / 2, mz, -ry + Math.PI / 2, 1, segH * 1.04, 1, tilt), false);
          px += Math.cos(ry) * dx; pz += Math.sin(ry) * dx; py += dy;
        }
        trunks.addCol(BOX, T(x, y + 2, z, 0, 0.5, 4, 0.5));
        const crown = new THREE.Vector3(px, py + 0.2, pz);
        const fronds = 8;
        for (let k = 0; k < fronds; k++) {
          const a = (k / fronds) * Math.PI * 2 + range(rng, -0.2, 0.2);
          const col = k % 2 ? C.palm : C.palmDark;
          for (let seg = 0; seg < 2; seg++) {
            const L = 2.1 * s, droop = 0.25 + seg * 0.75;
            const off = (seg * 1.9 + 1.0) * s;
            const fx = crown.x + Math.cos(a) * off, fz = crown.z + Math.sin(a) * off;
            const fy = crown.y - seg * 0.85 * s - 0.1;
            soft(leaves, BOX, T(fx, fy, fz, -a + Math.PI / 2, 0.9 * s * (seg ? 0.75 : 1), 0.07, L, droop), crown, col, 0.3, 2.5);
          }
        }
        for (let k = 0; k < 3; k++) bushes.add(BALL, '#8a6a3e', T(crown.x + Math.cos(k * 2.1) * 0.35, crown.y - 0.3, crown.z + Math.sin(k * 2.1) * 0.35, 0, 0.22, 0.22, 0.22), false);
        continue;
      }
      const highland = h > 30 || x > PLATEAU.edge;
      const dens = h > 55 ? 0.03 : highland ? 0.28 + n * 0.25 : 0.05 + Math.max(0, n) * 0.35;
      if (roll > dens) continue;
      nTree++;
      if (highland || rng() < 0.3) {
        const th = 2.6 * s;
        trunks.add(new THREE.CylinderGeometry(0.22, 0.34, 1, 6), C.woodDark, T(x, y + th / 2, z, ry, s, th, s), false);
        conifer(leaves, x, y + th * 0.75, z, s, ['#3f9a5a', '#4aa863', '#368c55'][Math.floor(rng() * 3)], ry);
      } else {
        const th = 3.0 * s;
        trunks.add(new THREE.CylinderGeometry(0.22, 0.34, 1, 6), C.wood, T(x, y + th / 2, z, ry, s * 1.2, th, s * 1.2), false);
        canopy(leaves, rng, x, y + th + 1.3 * s, z, 2.5 * s, 2.0 * s, n > 0.25 ? '#f7b2cf' : ['#6cc56a', '#5bb85f', '#7fd06f'][Math.floor(rng() * 3)]);
      }
      trunks.addCol(BOX, T(x, y + 2, z, ry, 0.6 * s, 4, 0.6 * s));
    }

  // meadow flowers + bushes
  for (let i = 0; i < 2600; i++) {
    const x = range(rng, -COAST.playHalf, COAST.playHalf), z = range(rng, -COAST.playHalf, COAST.playHalf);
    const h = heightAt(x, z);
    if (blocked(x, z) || h < WL + 1.5 || h > 30 || coastD(x, z) < 26) continue;
    const n = fbm(x * 0.03, z * 0.03, 2, COAST.seed + 60);
    if (n < 0.05) continue;
    if (i % 9 === 0) {
      const s = range(rng, 0.6, 1.2);
      bushes.add(BALL, ['#6cc56a', '#5bb85f', '#7fd06f'][i % 3], T(x, h + 0.3 * s, z, range(rng, 0, 6), s * 1.3, s * 0.8, s * 1.3), false);
    } else {
      const s = range(rng, 0.1, 0.18);
      const c = [C.flowerA, C.flowerB, C.flowerC, C.flowerD][Math.floor((n * 7 + i * 0.001) % 4)];
      bushes.add(BALL, c, T(x, h + 0.25, z, 0, s, s * 0.7, s), false);
    }
  }

  // shoreline and slope rocks
  let nRocks = 0;
  for (let i = 0; i < 2400 && nRocks < 280; i++) {
    const x = range(rng, -COAST.playHalf, COAST.playHalf), z = range(rng, -COAST.playHalf, COAST.playHalf);
    const h = heightAt(x, z), sl = slope(x, z), d = coastD(x, z);
    if (blocked(x, z) || h < WL - 1.2) continue;
    const want = sl > 0.5 ? 0.5 : d > -4 && d < 6 ? 0.35 : 0.04;
    if (rng() > want) continue;
    const s = range(rng, 0.6, sl > 0.5 ? 3.0 : 1.8);
    rocks.add(ROCK, rng() > 0.5 ? C.rock : C.rockDark, T(x, lowest(x, z, s) + s * 0.15, z, range(rng, 0, 6), s * range(rng, 0.9, 1.5), s * range(rng, 0.6, 1.0), s, range(rng, -0.3, 0.3)));
    nRocks++;
  }

  pieces.push(
    { name: 'Trees_Trunks', material: 'M_Toon', batch: trunks, outline: true, userData: { count: nTree + nPalm, palms: nPalm } },
    { name: 'Trees_Leaves', material: 'M_Foliage', batch: leaves, outline: true },
    { name: 'Rocks', material: 'M_Toon', batch: rocks, outline: true, userData: { count: nRocks } },
    { name: 'Bushes', material: 'M_Foliage', batch: bushes },
    { name: 'Waterfall', material: 'M_Waterfall', batch: falls },
  );

  return { pieces, markers };
}

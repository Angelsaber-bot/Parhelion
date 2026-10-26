// Structures, props and vegetation for 落日王国 (whitebox v1: real collision, blockout-level art).
import * as THREE from 'three';
import { Batch, T, BOX, distToPolyline } from '../geo.js';
import { mulberry32, range, fbm } from '../rng.js';
import { PAL, type Piece } from '../structures.js';
import { canopy, conifer } from '../vegetation.js';
import type { Marker } from '../layout.js';
import {
  BRITAIN, SEAM_Z, LAKE, ISLET, KCAMP, CASTLE, KEEP, HALL, CAMLANN, CORE, CAMELOT_FAR, PATHS, AREAS,
} from './layout.js';

type HeightAt = (x: number, z: number) => number;

const CYL8 = new THREE.CylinderGeometry(1, 1, 1, 8);
const CYL20 = new THREE.CylinderGeometry(1, 1, 1, 20);
const ROCK = new THREE.DodecahedronGeometry(1, 0);
const CRYSTAL = new THREE.OctahedronGeometry(1, 0);
const BALL = new THREE.IcosahedronGeometry(1, 0);
const CONE8 = new THREE.ConeGeometry(1, 1, 8);
const CONE16 = new THREE.ConeGeometry(1, 1, 16);
const ROOF = new THREE.CylinderGeometry(1, 1, 1, 3, 1, false, Math.PI / 2); // apex up after rz = π/2
const WL = BRITAIN.waterLevel;

const C = {
  ...PAL,
  wall: '#d9cdb4',
  wallDark: '#b3a68c',
  timber: '#6b4a32',
  plaster: '#f1e6cf',
  roofRed: '#b9554a',
  roofSlate: '#5d6b8a',
  roofGold: '#e7b44c',
  blue: '#3f62b8',
  blueDark: '#2d4688',
  red: '#c8443c',
  banner: '#e8d9a8',
  iron: '#5a5f6e',
  ash: '#4a3d3a',
  ember: '#ff9a4a',
  sunset: '#ffb36b',
  coreDark: '#3a1f33',
  pine: ['#3f7d5a', '#4a8a60', '#36704f'],
  oak: ['#7fae55', '#8fb85a', '#a6b850'],
  autumn: ['#e8a24a', '#d9783e', '#f0c060'],
};

export function buildBritain(heightAt: HeightAt) {
  const pieces: Piece[] = [];
  const markers: Marker[] = [];
  const mk = (m: Marker) => markers.push(m);
  const rng = mulberry32(BRITAIN.seed + 5);
  const glow = new Batch('Glow_Props', 'M_Emissive');
  const lamps = new Batch('Lamps');
  const rocks = new Batch('Rocks');
  const leaves = new Batch('Trees_Leaves', 'M_Foliage');
  const trunks = new Batch('Trees_Trunks');
  const bushes = new Batch('Bushes', 'M_Foliage');
  pieces.push({ name: 'Glow_Props', material: 'M_Emissive', batch: glow });

  const slope = (x: number, z: number) => {
    const e = 1.5;
    return Math.hypot(heightAt(x + e, z) - heightAt(x - e, z), heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e);
  };
  const lowest = (x: number, z: number, r: number) =>
    Math.min(heightAt(x, z), heightAt(x + r, z), heightAt(x - r, z), heightAt(x, z + r), heightAt(x, z - r));
  /** Torch on a pole: wooden post + warm flame. */
  const torch = (x: number, z: number, y = heightAt(x, z)) => {
    lamps.add(CYL8, C.timber, T(x, y + 1.2, z, 0, 0.09, 2.4, 0.09));
    lamps.add(CYL8, C.iron, T(x, y + 2.45, z, 0, 0.2, 0.18, 0.2), false);
    glow.add(CONE8, C.ember, T(x, y + 2.8, z, 0, 0.18, 0.5, 0.18), false);
  };
  const banner = (b: Batch, x: number, y: number, z: number, ry: number, color: string, h = 3) => {
    b.add(CYL8, C.timber, T(x, y + h / 2 + 0.5, z, 0, 0.07, h + 1, 0.07), false);
    b.add(BOX, color, T(x + Math.cos(ry) * 0.5, y + h - 0.3, z - Math.sin(ry) * 0.5, ry, 0.9, 1.8, 0.05), false);
    b.add(BOX, C.gold, T(x + Math.cos(ry) * 0.5, y + h - 0.3, z - Math.sin(ry) * 0.5 + 0.03 * Math.cos(ry), ry, 0.35, 0.35, 0.06), false);
  };

  // ───────────────────────── Seam arrival (east edge) ─────────────────────────
  {
    const b = new Batch('Seam_Arrival');
    // a ring of weathered standing stones where the seam gorge opens into Britain
    const cx = 312, cz = SEAM_Z;
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      if (Math.abs(Math.sin(a)) < 0.35) continue; // keep the road through the ring open (east–west)
      const x = cx + Math.cos(a) * 13, z = cz + Math.sin(a) * 13, g = lowest(x, z, 1.2);
      const h = range(rng, 3.8, 5.6);
      b.add(BOX, i % 2 ? C.stone : C.wallDark, T(x, g + h / 2 - 0.4, z, -a + range(rng, -0.2, 0.2), 1.4, h, 0.9, range(rng, -0.06, 0.06)));
    }
    glow.add(new THREE.TorusGeometry(2.6, 0.08, 6, 32), C.sunset, T(cx, heightAt(cx, cz) + 0.12, cz, 0, 1, 1, 1, Math.PI / 2), false);
    banner(b, cx - 18, heightAt(cx - 18, cz - 6), cz - 6, Math.PI, C.blue);
    pieces.push({ name: 'Seam_Arrival', material: 'M_Toon', batch: b, outline: true });
    const sx = 300, sz = SEAM_Z;
    mk({ id: 'spawn_p1', type: 'spawn', label: '玩家1出生点（西部时层）', p: [sx, heightAt(sx, sz), sz] });
    mk({ id: 'spawn_p2', type: 'spawn', label: '玩家2出生点（西部时层）', p: [sx, heightAt(sx, sz + 4), sz + 4] });
    mk({ id: 'disc_seam_stones', type: 'discovery', label: '黄昏石环', p: [cx, heightAt(cx, cz), cz], radius: 6, note: '从幻日谷走进来的第一步' });
  }

  // ───────────────────────── Mistwood: glowing mushrooms, a hermit shrine ─────────────────────────
  {
    const [mx, mz] = AREAS[0].c;
    for (let i = 0; i < 60; i++) {
      const a = range(rng, 0, Math.PI * 2), d = range(rng, 8, 64);
      const x = mx + Math.cos(a) * d, z = mz + Math.sin(a) * d;
      if (Math.min(...PATHS.map((p) => distToPolyline(x, z, p))) < 3) continue;
      const g = heightAt(x, z), s = range(rng, 0.25, 0.6);
      lamps.add(CYL8, C.plaster, T(x, g + s * 0.6, z, 0, s * 0.18, s * 1.2, s * 0.18), false);
      glow.add(new THREE.SphereGeometry(1, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), i % 3 ? '#8ff1ff' : '#c9a2ff', T(x, g + s * 1.15, z, 0, s * 0.6, s * 0.4, s * 0.6), false);
    }
    const b = new Batch('Mistwood_Shrine');
    const x = 252, z = 14, g = lowest(x, z, 3);
    b.add(CYL20, C.stone, T(x, g + 0.2, z, 0, 3.4, 0.6, 3.4));
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      b.add(BOX, C.wallDark, T(x + Math.cos(a) * 2.6, g + 1.8, z + Math.sin(a) * 2.6, -a, 0.5, 3.2, 0.5));
    }
    b.add(CONE8, C.roofSlate, T(x, g + 4.2, z, Math.PI / 8, 3.8, 1.8, 3.8));
    glow.add(CRYSTAL, '#8ff1ff', T(x, g + 1.6, z, 0, 0.35, 0.7, 0.35), false);
    pieces.push({ name: 'Mistwood_Shrine', material: 'M_Toon', batch: b, outline: true });
    mk({ id: 'disc_mistwood_shrine', type: 'discovery', label: '隐士的林中祠', p: [x, g + 0.5, z], radius: 4 });
    for (const [dx, dz] of [[-20, 30], [24, -34]])
      mk({ id: `enemy_mist_${dx}`, type: 'enemy', label: '雾中幽影（占位）', p: [mx + dx, heightAt(mx + dx, mz + dz), mz + dz] });
  }

  // ───────────────────────── Lake of the Sword: causeway, islet, sword in the stone ─────────────────────────
  {
    const b = new Batch('Sword_Lake');
    const [ix, iz] = ISLET.c;
    const deck = WL + 0.7;
    // causeway from the north shore: plank bridge on posts until it meets the islet
    let z0 = LAKE.c[1] - LAKE.r - 10;
    while (z0 < iz && heightAt(ix, z0) > deck - 0.2) z0 += 0.5;
    let z1 = iz - 2;
    while (z1 > z0 && heightAt(ix, z1) > deck - 0.2) z1 -= 0.5;
    z0 -= 1.5; z1 += 1.5;
    b.box(ix, deck - 0.3, (z0 + z1) / 2, 3.2, 0.3, z1 - z0, C.wood);
    for (let z = z0 + 1; z < z1; z += 3.5)
      for (const s of [-1.4, 1.4]) b.add(CYL8, C.woodDark, T(ix + s, (deck - 4) / 2, z, 0, 0.16, deck + 4, 0.16), false);
    for (let z = z0 + 0.4; z < z1; z += 1.1) b.box(ix, deck - 0.01, z, 3.22, 0.02, 0.1, C.woodDark, 0, false);
    for (const s of [-1.55, 1.55]) b.box(ix + s, deck, (z0 + z1) / 2, 0.1, 0.8, z1 - z0, C.woodDark, 0, false);
    for (let z = z0 + 4; z < z1; z += 10) {
      lamps.add(CYL8, C.iron, T(ix - 1.6, deck + 1.1, z, 0, 0.06, 2.2, 0.06), false);
      glow.add(BALL, C.sunset, T(ix - 1.6, deck + 2.3, z, 0, 0.22, 0.3, 0.22), false);
    }
    // islet: stone ring + the sword
    const top = heightAt(ix, iz);
    b.add(CYL20, C.stone, T(ix, top - 0.2, iz, 0, 4.2, 0.6, 4.2));
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + 0.2;
      if (Math.abs(a - Math.PI * 1.5) < 0.5) continue; // gap toward the causeway (north)
      const h = 1.6 + (k % 3) * 0.5;
      b.add(BOX, C.wallDark, T(ix + Math.cos(a) * 4.8, top + h / 2 - 0.2, iz + Math.sin(a) * 4.8, -a, 0.8, h, 0.6));
    }
    b.add(ROCK, C.rock, T(ix, top + 0.5, iz + 0.6, 0.4, 1.3, 0.9, 1.1));
    b.add(BOX, '#dfe8f4', T(ix, top + 2.0, iz + 0.6, 0, 0.14, 2.2, 0.04), false); // blade
    b.add(BOX, C.gold, T(ix, top + 3.1, iz + 0.6, 0, 0.9, 0.12, 0.14), false); // guard
    b.add(CYL8, C.blueDark, T(ix, top + 3.5, iz + 0.6, 0, 0.06, 0.7, 0.06), false); // grip
    glow.add(BALL, C.glowGold, T(ix, top + 3.95, iz + 0.6, 0, 0.13, 0.13, 0.13), false);
    pieces.push({ name: 'Sword_Lake', material: 'M_Toon', batch: b, outline: true });
    const beam = new Batch('Sword_Beam', 'M_Beam');
    beam.add(new THREE.CylinderGeometry(0.7, 1.2, 120, 16, 1, true), C.glowGold, T(ix, top + 60, iz + 0.6), false);
    pieces.push({ name: 'Sword_Beam', material: 'M_Beam', batch: beam, userData: { showWhen: 'saber_contract' } });
    mk({ id: 'saber_contract', type: 'interact', label: '湖中之剑（与 Saber 缔结契约）', p: [ix, top, iz - 1.6], radius: 3.4, note: 'Saber 成为同伴' });
    mk({ id: 'disc_lake_lady', type: 'discovery', label: '湖中仙女的倒影', p: [LAKE.c[0] + 30, heightAt(LAKE.c[0] + 30, LAKE.c[1] + 46), LAKE.c[1] + 46], radius: 5 });
  }

  // ───────────────────────── Knights' camp: tents, palisade, training dummies ─────────────────────────
  {
    const b = new Batch('Knights_Camp');
    const [kx, kz] = KCAMP.c;
    const g0 = heightAt(kx, kz);
    // palisade ring with a gate toward the forest road (south)
    const R = KCAMP.r - 2, nPost = 72;
    for (let i = 0; i < nPost; i++) {
      const a = (i / nPost) * Math.PI * 2;
      if (Math.abs(a - Math.PI / 2) < 0.16) continue; // gate gap (+z = south)
      const x = kx + Math.cos(a) * R, z = kz + Math.sin(a) * R, g = lowest(x, z, 0.5);
      const h = 3.2 + (i % 2) * 0.4;
      b.add(CYL8, i % 2 ? C.wood : C.woodDark, T(x, g + h / 2 - 0.3, z, 0, 0.32, h, 0.32), true);
      b.add(CONE8, C.woodDark, T(x, g + h - 0.1, z, 0, 0.32, 0.6, 0.32), false);
    }
    for (const s of [-1, 1]) {
      const a = Math.PI / 2 + s * 0.2, x = kx + Math.cos(a) * R, z = kz + Math.sin(a) * R;
      b.add(BOX, C.timber, T(x, heightAt(x, z) + 2.5, z, 0, 0.6, 5, 0.6));
      banner(b, x + s * 0.8, heightAt(x, z), z + 0.6, -Math.PI / 2, C.blue, 4);
      torch(x + s * 1.6, z + 2);
    }
    // tents: blue/white pavilions around the fire
    const tents: [number, number, string][] = [[-16, -10, C.blue], [0, -18, C.plaster], [16, -10, C.red], [-18, 8, C.plaster], [18, 8, C.blue]];
    tents.forEach(([dx, dz, col], i) => {
      const x = kx + dx, z = kz + dz, g = heightAt(x, z);
      const r = i === 1 ? 4.6 : 3.4;
      if (i === 1) {
        // the commander's pavilion is open-sided: posts under the roof, the war table inside
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2;
          b.add(CYL8, C.timber, T(x + Math.cos(a) * (r - 0.3), g + 1.2, z + Math.sin(a) * (r - 0.3), 0, 0.12, 2.4, 0.12));
        }
      } else b.add(CYL20, col, T(x, g + 1.1, z, 0, r, 2.2, r));
      b.add(CONE16, i % 2 ? C.blue : C.red, T(x, g + 2.2 + r * 0.45, z, 0, r * 1.08, r * 0.9, r * 1.08));
      b.add(CYL8, C.gold, T(x, g + 2.2 + r * 0.9 + 0.5, z, 0, 0.05, 1.2, 0.05), false);
      b.add(BOX, C.banner, T(x + 0.35, g + 2.2 + r * 0.9 + 0.9, z, 0, 0.7, 0.4, 0.03), false);
    });
    // campfire + war table in the commander's pavilion
    b.add(CYL20, C.stone, T(kx, g0 + 0.15, kz, 0, 1.6, 0.3, 1.6), false);
    glow.add(CONE8, C.ember, T(kx, g0 + 0.9, kz, 0, 0.9, 1.4, 0.9), false);
    const [tx, tz] = [kx, kz - 18];
    b.box(tx, heightAt(tx, tz), tz, 3, 1.0, 1.8, C.timber);
    b.box(tx, heightAt(tx, tz) + 1.0, tz, 2.6, 0.05, 1.4, C.canvas, 0, false);
    // training yard: three straw dummies (shoot them to pass the trial)
    [-8, 0, 8].forEach((dx, i) => {
      const x = kx + 24 + dx * 0.3, z = kz - 4 + dx, g = heightAt(x, z);
      b.add(CYL8, C.timber, T(x, g + 1.0, z, 0, 0.1, 2.0, 0.1), false);
      b.add(BOX, C.timber, T(x, g + 1.55, z, 0, 1.4, 0.1, 0.1), false);
      const t = new Batch(`TGT_camp_dummy_${i + 1}`, 'M_Target');
      t.add(CYL8, '#e2c27a', T(x, g + 1.6, z, 0, 0.42, 1.0, 0.42), true);
      t.add(BALL, '#e2c27a', T(x, g + 2.4, z, 0, 0.32, 0.36, 0.32), true);
      pieces.push({ name: `TGT_camp_dummy_${i + 1}`, material: 'M_Target', batch: t, dynamic: true, userData: { target: `camp_dummy_${i + 1}` } });
      mk({ id: `camp_dummy_${i + 1}`, type: 'objective', label: `试炼木人 ${i + 1}`, p: [x, g + 1.8, z] });
    });
    mk({ id: 'camp_line', type: 'poi', label: '试炼射击位', p: [kx + 12, heightAt(kx + 12, kz - 4), kz - 4] });
    pieces.push({ name: 'Knights_Camp', material: 'M_Toon', batch: b, outline: true });
    const shard = new Batch('Shard_camp', 'M_Emissive');
    shard.add(CRYSTAL, C.sunset, T(tx, heightAt(tx, tz) + 1.9, tz, 0.4, 0.35, 0.7, 0.35), false);
    pieces.push({ name: 'Shard_camp', material: 'M_Emissive', batch: shard, userData: { showWhen: ['camp_dummy_1', 'camp_dummy_2', 'camp_dummy_3'], hideWhen: 'shard_camp', bob: true } });
    mk({ id: 'shard_camp', type: 'interact', label: '王之碎片·誓约', p: [tx, heightAt(tx, tz), tz + 1.6], radius: 3.2, requires: ['camp_dummy_1', 'camp_dummy_2', 'camp_dummy_3'] });
    for (const [dx, dz] of [[-6, 20], [10, 22]])
      mk({ id: `enemy_camp_${dx}`, type: 'enemy', label: '迷失骑士（占位）', p: [kx + dx, heightAt(kx + dx, kz + dz), kz + dz] });
  }

  // ───────────────────────── Camelot outskirts: walls, town, keep, round table hall ─────────────────────────
  {
    const b = new Batch('Camelot');
    const [cx, cz] = CASTLE.c, y = CASTLE.top;
    const R = CASTLE.r - 2, wallH = 7, gateHalf = 0.11;
    const nSeg = 64;
    const segLen = (2 * Math.PI * R) / nSeg + 0.3;
    const angDiff = (a: number, b2: number) => Math.abs(Math.atan2(Math.sin(a - b2), Math.cos(a - b2)));
    for (let i = 0; i < nSeg; i++) {
      const a = ((i + 0.5) / nSeg) * Math.PI * 2;
      if (angDiff(a, CASTLE.gateA) < gateHalf) continue;
      const x = cx + Math.cos(a) * R, z = cz + Math.sin(a) * R;
      const g = Math.min(y, lowest(x, z, 1.5));
      b.add(BOX, i % 2 ? C.wall : C.wallDark, T(x, (g - 2 + y + wallH) / 2, z, -a, 2.4, y + wallH - g + 2, segLen));
      if (i % 2) b.add(BOX, C.wall, T(x + Math.cos(a) * 0.7, y + wallH + 0.5, z + Math.sin(a) * 0.7, -a, 0.8, 1.0, segLen * 0.5), false);
    }
    // wall towers
    for (let k = 0; k < 8; k++) {
      const a = CASTLE.gateA + (k / 8) * Math.PI * 2 + (k === 0 ? 0 : 0);
      const aa = k === 0 ? CASTLE.gateA - gateHalf - 0.05 : a;
      const towers = k === 0 ? [aa, CASTLE.gateA + gateHalf + 0.05] : [a];
      for (const t of towers) {
        const x = cx + Math.cos(t) * R, z = cz + Math.sin(t) * R, g = Math.min(y, lowest(x, z, 3));
        const h = y + wallH + 4 - g;
        b.add(CYL20, C.wallDark, T(x, g + h / 2 - 1, z, 0, 3.4, h + 2, 3.4));
        b.add(CONE16, C.roofSlate, T(x, g + h + 1.6, z, 0, 3.9, 3.4, 3.9));
        b.add(CYL8, C.timber, T(x, g + h + 4.3, z, 0, 0.05, 2, 0.05), false);
        b.add(BOX, C.blue, T(x + 0.45, g + h + 4.8, z, 0, 0.9, 0.5, 0.03), false);
      }
    }
    // gatehouse arch over the opening
    {
      const gx = cx + Math.cos(CASTLE.gateA) * R, gz = cz + Math.sin(CASTLE.gateA) * R;
      b.add(BOX, C.wallDark, T(gx, y + wallH + 1.2, gz, -CASTLE.gateA, 2.6, 3.2, 2 * R * gateHalf + 1.5));
      glow.add(BOX, C.sunset, T(gx + Math.cos(CASTLE.gateA) * 1.32, y + wallH + 1.2, gz + Math.sin(CASTLE.gateA) * 1.32, -CASTLE.gateA, 0.05, 0.8, 1.6), false);
      torch(gx + Math.cos(CASTLE.gateA) * 4 - Math.sin(CASTLE.gateA) * 5, gz + Math.sin(CASTLE.gateA) * 4 + Math.cos(CASTLE.gateA) * 5);
      torch(gx + Math.cos(CASTLE.gateA) * 4 + Math.sin(CASTLE.gateA) * 5, gz + Math.sin(CASTLE.gateA) * 4 - Math.cos(CASTLE.gateA) * 5);
    }
    // the road up: torches every 14 m along the last path
    const road = PATHS[2];
    for (let i = 1; i < road.length; i++) {
      const [ax, az] = road[i - 1], [bx, bz] = road[i];
      const L = Math.hypot(bx - ax, bz - az), nx = -(bz - az) / L, nz = (bx - ax) / L;
      for (let s = 7; s < L; s += 14) {
        const x = ax + ((bx - ax) * s) / L, z = az + ((bz - az) * s) / L, side = (Math.floor(s / 14) % 2) * 2 - 1;
        torch(x + nx * 3.4 * side, z + nz * 3.4 * side);
      }
    }
    // town houses: timber-framed, gabled, along a main street from the gate to the keep square
    const houses: [number, number, number][] = [];
    for (let i = 0; i < 70 && houses.length < 26; i++) {
      const a = range(rng, 0, Math.PI * 2), d = range(rng, 14, R - 9);
      const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      if (Math.hypot(x - KEEP.c[0], z - KEEP.c[1]) < 18 || Math.hypot(x - HALL.c[0], z - HALL.c[1]) < HALL.r + 8) continue;
      if (Math.hypot(x - cx, z - cz) < 12) continue; // market square
      // keep the gate street clear: distance to the line gate -> centre
      const gx = cx + Math.cos(CASTLE.gateA) * R, gz = cz + Math.sin(CASTLE.gateA) * R;
      if (distToPolyline(x, z, [[gx, gz], [cx, cz], [KEEP.c[0], KEEP.c[1]]]) < 7) continue;
      if (houses.some(([hx, hz]) => Math.hypot(hx - x, hz - z) < 9.5)) continue;
      houses.push([x, z, Math.atan2(x - cx, z - cz)]);
    }
    houses.forEach(([x, z, ry], i) => {
      const w = 5 + (i % 3), d = 4.5, h = 3.4 + (i % 2) * 1.6;
      b.add(BOX, C.plaster, T(x, y + h / 2, z, ry, w, h, d));
      for (const s of [-1, 1]) b.add(BOX, C.timber, T(x + Math.cos(ry) * s * (w / 2), y + h / 2, z - Math.sin(ry) * s * (w / 2), ry, 0.2, h, d + 0.05), false);
      b.add(BOX, C.timber, T(x, y + h - 0.1, z, ry, w + 0.05, 0.2, d + 0.05), false);
      b.add(ROOF, i % 3 ? C.roofRed : C.roofSlate, T(x, y + h + 1.0, z, ry, 1.9, w + 0.8, (d + 1.4) / 1.732, 0, Math.PI / 2));
      const fx = x + Math.sin(ry) * (d / 2 + 0.03), fz = z + Math.cos(ry) * (d / 2 + 0.03);
      b.add(BOX, C.woodDark, T(fx, y + 1.0, fz, ry, 1.0, 2.0, 0.06), false);
      glow.add(BOX, C.sunset, T(fx + Math.cos(ry) * 1.5, y + 2.2, fz - Math.sin(ry) * 1.5, ry, 0.7, 0.6, 0.05), false);
    });
    // market square: well + stalls
    b.add(CYL20, C.stone, T(cx, y + 0.5, cz, 0, 1.6, 1.0, 1.6));
    b.add(CYL20, '#4f8fa8', T(cx, y + 0.95, cz, 0, 1.3, 0.1, 1.3), false);
    for (const s of [-1, 1]) b.add(CYL8, C.timber, T(cx + s * 1.4, y + 1.8, cz, 0, 0.08, 2.6, 0.08), false);
    b.add(ROOF, C.roofRed, T(cx, y + 3.4, cz, 0, 0.7, 3.4, 1.4, 0, Math.PI / 2), false);
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + 0.6, x = cx + Math.cos(a) * 8, z = cz + Math.sin(a) * 8;
      b.box(x, y, z, 2.6, 1.0, 1.4, C.timber, -a);
      b.add(BOX, [C.red, C.blue, C.banner, C.roofGold][k], T(x, y + 2.3, z, -a, 3.0, 0.08, 1.8), false);
      for (const s of [-1.2, 1.2]) b.add(CYL8, C.timber, T(x - Math.sin(a) * s, y + 1.15, z - Math.cos(a) * s, 0, 0.05, 2.3, 0.05), false);
    }
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      torch(cx + Math.cos(a) * 12, cz + Math.sin(a) * 12, y);
    }
    pieces.push({ name: 'Camelot', material: 'M_Toon', batch: b, outline: true });
    mk({ id: 'disc_camelot_well', type: 'discovery', label: '许愿井', p: [cx, y, cz + 2], radius: 4 });

    // ── keep: a tall round tower; a spiral ramp climbs the outside to the shard at the top
    {
      const k = new Batch('Camelot_Keep');
      const [kx, kz] = KEEP.c, H = KEEP.h, base = y;
      k.add(CYL20, C.wallDark, T(kx, base + H / 2, kz, 0, KEEP.r, H, KEEP.r));
      k.add(CYL20, C.stone, T(kx, base + 0.4, kz, 0, KEEP.r + 1.6, 0.8, KEEP.r + 1.6));
      k.box(kx + KEEP.r + 0.05, base + 0.8, kz, 0.3, 2.4, 1.4, C.woodDark, 0, false);
      const R2 = KEEP.r + 1.65, seg = 24, turns = 4, rise = H / (seg * turns);
      const sl = (2 * Math.PI * R2) / seg, slopeA = Math.atan2(rise, sl);
      let lastA = 0;
      for (let s = 0; s < seg * turns; s++) {
        const a = ((s + 0.5) / seg) * Math.PI * 2;
        const yy = base + 0.8 + (s + 0.5) * rise;
        k.add(BOX, s % 2 ? C.stone : C.wall, T(kx + Math.cos(a) * R2, yy - 0.15, kz + Math.sin(a) * R2, -a, 2.3, 0.3, sl + 0.35, -slopeA));
        k.add(BOX, C.timber, T(kx + Math.cos(a) * (R2 + 1.1), yy + 0.35, kz + Math.sin(a) * (R2 + 1.1), -a, 0.12, 0.9, sl + 0.3, -slopeA));
        if (s % 3 === 0) k.add(CYL8, C.timber, T(kx + Math.cos(a) * (R2 - 0.4), yy - 1.4, kz + Math.sin(a) * (R2 - 0.4), 0, 0.12, 2.4, 0.12), false);
        lastA = a;
      }
      const top = base + 0.8 + H;
      const nSec = 24;
      for (let s = 0; s < nSec; s++) {
        const a = ((s + 0.5) / nSec) * Math.PI * 2;
        const da = ((lastA - a) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
        if (da < 3.1) continue; // stairwell opening above the last flight
        const w = (2 * Math.PI * (KEEP.r + 1.4)) / nSec + 0.3;
        k.add(BOX, C.wall, T(kx + Math.cos(a) * (KEEP.r + 1.4), top - 0.2, kz + Math.sin(a) * (KEEP.r + 1.4), -a, 4.2, 0.4, w));
        k.add(BOX, C.wallDark, T(kx + Math.cos(a) * (KEEP.r + 3.35), top + 0.6, kz + Math.sin(a) * (KEEP.r + 3.35), -a, 0.4, 1.2, w));
      }
      k.add(CYL20, C.wall, T(kx, top - 0.2, kz, 0, KEEP.r + 0.1, 0.4, KEEP.r + 0.1));
      k.add(CONE16, C.roofSlate, T(kx, top + 6.5, kz, 0, 3.0, 5, 3.0), false);
      for (let s = 0; s < 4; s++) {
        const a = (s / 4) * Math.PI * 2;
        k.add(CYL8, C.timber, T(kx + Math.cos(a) * 2.6, top + 2, kz + Math.sin(a) * 2.6, 0, 0.14, 4, 0.14));
      }
      k.add(CYL8, C.gold, T(kx, top + 10, kz, 0, 0.06, 2, 0.06), false);
      k.add(BOX, C.blue, T(kx + 0.7, top + 10.5, kz, 0, 1.4, 0.8, 0.03), false);
      pieces.push({ name: 'Camelot_Keep', material: 'M_Toon', batch: k, outline: true });
      const shard = new Batch('Shard_tower', 'M_Emissive');
      shard.add(CRYSTAL, C.sunset, T(kx, top + 1.4, kz, 0.4, 0.4, 0.8, 0.4), false);
      pieces.push({ name: 'Shard_tower', material: 'M_Emissive', batch: shard, userData: { hideWhen: 'shard_tower', bob: true } });
      mk({ id: 'shard_tower', type: 'interact', label: '王之碎片·王座', p: [kx, top, kz], radius: 3.4 });
      mk({ id: 'disc_keep_top', type: 'discovery', label: '主塔之巅', p: [kx + KEEP.r + 1.6, top, kz], radius: 3, note: '远处的卡美洛在山脊上发光' });
    }

    // ── round table hall: round, conical roof, door toward the market square; three braziers to light
    {
      const h = new Batch('Round_Hall');
      const [hx, hz] = HALL.c, r = HALL.r, wallT = 1.0, hH = 7;
      const doorA = Math.atan2(cz - hz, cx - hx);
      const n = 40;
      for (let i = 0; i < n; i++) {
        const a = ((i + 0.5) / n) * Math.PI * 2;
        if (angDiff(a, doorA) < 0.16) continue;
        const sl = (2 * Math.PI * r) / n + 0.25;
        h.add(BOX, i % 2 ? C.wall : C.wallDark, T(hx + Math.cos(a) * r, y + hH / 2, hz + Math.sin(a) * r, -a, wallT, hH, sl));
        if (i % 4 === 2) glow.add(BOX, C.sunset, T(hx + Math.cos(a) * (r + 0.52), y + 4.4, hz + Math.sin(a) * (r + 0.52), -a, 0.05, 1.8, 0.7), false);
      }
      h.add(BOX, C.wallDark, T(hx + Math.cos(doorA) * r, y + hH - 1, hz + Math.sin(doorA) * r, -doorA, wallT + 0.4, 2, 5));
      h.add(CONE16, C.roofGold, T(hx, y + hH + 4, hz, 0, r + 1.8, 8, r + 1.8));
      h.add(CYL20, C.stone, T(hx, y + 0.08, hz, 0, r - 0.4, 0.16, r - 0.4), false);
      // the table: a ring, thirteen seats (one left empty: 危险席)
      h.add(new THREE.TorusGeometry(5, 0.75, 6, 40), C.timber, T(hx, y + 1.0, hz, 0, 1, 1, 0.6, Math.PI / 2));
      for (let s = 0; s < 6; s++) {
        const a = (s / 6) * Math.PI * 2;
        h.add(CYL8, C.timber, T(hx + Math.cos(a) * 5, y + 0.45, hz + Math.sin(a) * 5, 0, 0.18, 0.9, 0.18), false);
      }
      for (let s = 0; s < 13; s++) {
        const a = (s / 13) * Math.PI * 2;
        const x = hx + Math.cos(a) * 6.7, z = hz + Math.sin(a) * 6.7;
        const col = s === 0 ? C.red : C.timber;
        h.box(x, y, z, 0.8, 0.5, 0.8, col, -a);
        h.add(BOX, col, T(x + Math.cos(a) * 0.4, y + 1.1, z + Math.sin(a) * 0.4, -a, 0.15, 1.2, 0.8), false);
      }
      for (let s = 0; s < 6; s++) {
        const a = (s / 6) * Math.PI * 2 + 0.3;
        banner(h, hx + Math.cos(a) * (r - 1.0), y, hz + Math.sin(a) * (r - 1.0), -a + Math.PI, s % 2 ? C.blue : C.red, 4.5);
      }
      pieces.push({ name: 'Round_Hall', material: 'M_Toon', batch: h, outline: true });
      // three braziers between the seats: interact to light, then the shard rises from the table centre
      for (let i = 0; i < 3; i++) {
        const a = doorA + Math.PI + (i - 1) * 1.6;
        const x = hx + Math.cos(a) * (r - 2.4), z = hz + Math.sin(a) * (r - 2.4);
        h.add(CYL8, C.iron, T(x, y + 0.6, z, 0, 0.12, 1.2, 0.12));
        h.add(new THREE.CylinderGeometry(0.6, 0.3, 0.5, 8), C.iron, T(x, y + 1.35, z), false);
        const f = new Batch(`Hall_Fire_${i + 1}`, 'M_Emissive');
        f.add(CONE8, C.ember, T(x, y + 2.0, z, 0, 0.45, 0.9, 0.45), false);
        pieces.push({ name: `Hall_Fire_${i + 1}`, material: 'M_Emissive', batch: f, userData: { showWhen: `hall_brazier_${i + 1}` } });
        mk({ id: `hall_brazier_${i + 1}`, type: 'interact', label: `圆桌火盆 ${i + 1}`, p: [x, y, z], radius: 2.6 });
      }
      const shard = new Batch('Shard_table', 'M_Emissive');
      shard.add(CRYSTAL, C.sunset, T(hx, y + 2.6, hz, 0.4, 0.4, 0.8, 0.4), false);
      pieces.push({ name: 'Shard_table', material: 'M_Emissive', batch: shard, userData: { showWhen: ['hall_brazier_1', 'hall_brazier_2', 'hall_brazier_3'], hideWhen: 'shard_table', bob: true } });
      // reachable from the inner ring of the table (radius ~4)
      mk({ id: 'shard_table', type: 'interact', label: '王之碎片·圆桌', p: [hx, y, hz], radius: 7.2, requires: ['hall_brazier_1', 'hall_brazier_2', 'hall_brazier_3'] });
      mk({ id: 'disc_siege_perilous', type: 'discovery', label: '危险席', p: [hx + 6.7, y, hz], radius: 2.2, note: '空着的第十三个座位' });
    }
    for (const [dx, dz] of [[20, 24], [-24, 10], [6, -30]])
      mk({ id: `enemy_camelot_${dx}`, type: 'enemy', label: '王城守卫（占位）', p: [cx + dx, y, cz + dz] });
  }

  // ───────────────────────── Far Camelot: the true capital, glowing on the north-west ridge ─────────────────────────
  {
    const b = new Batch('Camelot_Far');
    const [fx, fz] = CAMELOT_FAR.c, g = lowest(fx, fz, 20);
    const spires: [number, number, number, number][] = [[0, 0, 48, 6], [-16, 10, 34, 4.5], [16, 8, 36, 4.5], [-8, -14, 30, 4], [12, -12, 28, 4], [-26, -2, 24, 3.5], [26, -4, 26, 3.5]];
    b.add(BOX, C.wall, T(fx, g + 6, fz, 0.6, 62, 14, 34));
    for (const [dx, dz, h, r] of spires) {
      const x = fx + dx, z = fz + dz;
      b.add(CYL20, C.wall, T(x, g + h / 2, z, 0, r, h, r));
      b.add(CONE16, C.roofGold, T(x, g + h + r * 1.2, z, 0, r * 1.2, r * 2.4, r * 1.2));
      for (let k = 0; k < 3; k++) glow.add(BOX, C.glowGold, T(x + r + 0.02, g + h * (0.45 + k * 0.17), z, 0, 0.05, 1.6, 0.9), false);
    }
    pieces.push({ name: 'Camelot_Far', material: 'M_Toon', batch: b, outline: true });
  }

  // ───────────────────────── Camlann: ash field, broken spears, the eclipsed sun core ─────────────────────────
  {
    const b = new Batch('Camlann');
    const [ox, oz] = CAMLANN.c;
    for (let i = 0; i < 220; i++) {
      const a = range(rng, 0, Math.PI * 2), d = Math.sqrt(rng()) * (CAMLANN.r - 6);
      const x = ox + Math.cos(a) * d, z = oz + Math.sin(a) * d;
      if (Math.hypot(x - CORE.c[0], z - CORE.c[1]) < 16) continue;
      if (distToPolyline(x, z, PATHS[3]) < 3) continue;
      const g = heightAt(x, z), roll = rng();
      if (roll < 0.55) {
        // spear or sword stuck in the ground at an angle
        const L = range(rng, 1.6, 3.4), tilt = range(rng, 0.1, 0.5), ry = range(rng, 0, 6.28);
        b.add(CYL8, roll < 0.3 ? C.timber : C.iron, T(x, g + L * 0.4, z, ry, 0.05, L, 0.05, tilt), false);
      } else if (roll < 0.7) {
        banner(b, x, g - 0.4, z, range(rng, 0, 6.28), rng() < 0.5 ? C.red : '#5a4a6a', range(rng, 2, 3.4));
      } else if (roll < 0.8) {
        const s = range(rng, 0.6, 1.4);
        b.add(ROCK, C.ash, T(x, g + s * 0.2, z, range(rng, 0, 6), s * 1.4, s * 0.6, s), true);
      } else if (roll < 0.84) {
        // burnt cart
        const ry = range(rng, 0, 6.28);
        b.box(x, g + 0.5, z, 1.8, 0.7, 3.2, '#3d302b', ry);
        b.add(new THREE.TorusGeometry(0.6, 0.1, 6, 12), '#2b2220', T(x + Math.cos(ry) * 1.0, g + 0.55, z - Math.sin(ry) * 1.0, ry + Math.PI / 2, 1, 1, 1), false);
      } else if (roll < 0.86) {
        glow.add(CONE8, C.ember, T(x, g + 0.3, z, 0, 0.35, 0.6, 0.35), false);
      }
    }
    // the core mound: broken stone ring, steps, and a dark sun over it
    const [qx, qz] = CORE.c, top = heightAt(qx, qz);
    b.add(CYL20, C.stone, T(qx, top - 0.3, qz, 0, 7.5, 1.0, 7.5));
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2;
      const h = k % 3 === 0 ? 1.2 : range(rng, 3, 5.5);
      b.add(BOX, C.wallDark, T(qx + Math.cos(a) * 10, heightAt(qx + Math.cos(a) * 10, qz + Math.sin(a) * 10) + h / 2 - 0.3, qz + Math.sin(a) * 10, -a, 1.2, h, 1.0, range(rng, -0.08, 0.08)));
    }
    b.add(CYL8, C.stone, T(qx, top + 0.9, qz, 0, 1.1, 1.4, 1.1));
    pieces.push({ name: 'Camlann', material: 'M_Toon', batch: b, outline: true });
    const sun = new Batch('Dark_Sun', 'M_Emissive');
    sun.add(new THREE.IcosahedronGeometry(1, 2), C.coreDark, T(qx, top + 18, qz, 0, 4, 4, 4), false);
    sun.add(new THREE.TorusGeometry(5.2, 0.25, 6, 48), C.ember, T(qx, top + 18, qz, 0, 1, 1, 1, Math.PI / 2 - 0.3), false);
    pieces.push({ name: 'Dark_Sun', material: 'M_Emissive', batch: sun, userData: { hideWhen: 'sun_core', bob: true } });
    const lit = new Batch('Sun_Core', 'M_Emissive');
    lit.add(new THREE.IcosahedronGeometry(1, 2), C.sunset, T(qx, top + 18, qz, 0, 4.4, 4.4, 4.4), false);
    pieces.push({ name: 'Sun_Core', material: 'M_Emissive', batch: lit, userData: { showWhen: 'sun_core', bob: true } });
    const beam = new Batch('Sun_Core_Beam', 'M_Beam');
    beam.add(new THREE.CylinderGeometry(1.4, 2.2, 160, 20, 1, true), C.sunset, T(qx, top + 80, qz), false);
    pieces.push({ name: 'Sun_Core_Beam', material: 'M_Beam', batch: beam, userData: { showWhen: 'sun_core' } });
    mk({ id: 'sun_core', type: 'interact', label: '落日之核', p: [qx, top + 1.6, qz], radius: 3.6, requires: ['saber_contract', 'shard_camp', 'shard_tower', 'shard_table'] });
    mk({ id: 'boss_vacant_king', type: 'enemy', label: '空位之王（Boss 占位）', p: [qx - 14, heightAt(qx - 14, qz - 10), qz - 10] });
    mk({ id: 'disc_camlann_hill', type: 'discovery', label: '最后的山丘', p: [qx + 30, heightAt(qx + 30, qz + 30), qz + 30], radius: 5, note: '王在这里倒下' });
  }

  // ───────────────────────── Vegetation ─────────────────────────
  const blocked = (x: number, z: number) => {
    const near = (c: readonly [number, number], r: number) => Math.hypot(x - c[0], z - c[1]) < r;
    if (near(CASTLE.c, CASTLE.r + 6) || near(KCAMP.c, KCAMP.r + 4) || near(ISLET.c, ISLET.r + 2)) return true;
    if (near(CAMELOT_FAR.c, 44) || near([312, SEAM_Z], 18)) return true;
    if (Math.abs(x - ISLET.c[0]) < 4 && z > LAKE.c[1] - LAKE.r - 14 && z < ISLET.c[1]) return true;
    for (const p of PATHS) if (distToPolyline(x, z, p) < 3.5) return true;
    return false;
  };
  let nTree = 0;
  const STEP = 6;
  const mistC = AREAS[0].c;
  for (let gz = -BRITAIN.half; gz < BRITAIN.half; gz += STEP)
    for (let gx = -BRITAIN.half; gx < BRITAIN.half; gx += STEP) {
      const x = gx + range(rng, 0, STEP), z = gz + range(rng, 0, STEP);
      const roll = rng(), s = range(rng, 0.8, 1.35), ry = range(rng, 0, Math.PI * 2);
      if (Math.abs(x) > BRITAIN.playHalf + 12 || Math.abs(z) > BRITAIN.playHalf + 12) continue;
      const h = heightAt(x, z);
      if (h < WL + 0.8 || blocked(x, z) || slope(x, z) > 0.8) continue;
      const n = fbm(x * 0.02, z * 0.02, 3, BRITAIN.seed + 40);
      const dMist = Math.hypot(x - mistC[0], z - mistC[1]);
      const inMist = dMist < 78;
      const inCam = Math.hypot(x - CAMLANN.c[0], z - CAMLANN.c[1]) < CAMLANN.r;
      const dens = inCam ? 0.012 : inMist ? 0.42 : h > 50 ? 0.03 : 0.06 + Math.max(0, n) * 0.22;
      if (roll > dens) continue;
      nTree++;
      const y = h - 0.3;
      if (inCam) {
        // dead, leafless trunk
        const th = 3.4 * s;
        trunks.add(new THREE.CylinderGeometry(0.12, 0.3, 1, 6), '#3a2f2a', T(x, y + th / 2, z, ry, s, th, s, range(rng, -0.12, 0.12)), false);
        trunks.add(new THREE.CylinderGeometry(0.05, 0.12, 1, 5), '#3a2f2a', T(x + 0.5, y + th * 0.75, z, ry, s, 1.6 * s, s, 0.8), false);
      } else if (inMist || h > 34 || rng() < 0.25) {
        const th = 2.8 * s;
        trunks.add(new THREE.CylinderGeometry(0.22, 0.34, 1, 6), C.woodDark, T(x, y + th / 2, z, ry, s, th, s), false);
        conifer(leaves, x, y + th * 0.75, z, s * (inMist ? 1.25 : 1), C.pine[Math.floor(rng() * 3)], ry);
      } else {
        const th = 3.0 * s;
        trunks.add(new THREE.CylinderGeometry(0.22, 0.34, 1, 6), C.wood, T(x, y + th / 2, z, ry, s * 1.2, th, s * 1.2), false);
        const pal = n > 0.18 ? C.autumn : C.oak;
        canopy(leaves, rng, x, y + th + 1.3 * s, z, 2.6 * s, 2.0 * s, pal[Math.floor(rng() * 3)]);
      }
      trunks.addCol(BOX, T(x, y + 2, z, ry, 0.6 * s, 4, 0.6 * s));
    }

  // meadow flowers + bushes (none on the ash field)
  for (let i = 0; i < 2400; i++) {
    const x = range(rng, -BRITAIN.playHalf, BRITAIN.playHalf), z = range(rng, -BRITAIN.playHalf, BRITAIN.playHalf);
    const h = heightAt(x, z);
    if (blocked(x, z) || h < WL + 1.2 || h > 34) continue;
    if (Math.hypot(x - CAMLANN.c[0], z - CAMLANN.c[1]) < CAMLANN.r + 4) continue;
    const n = fbm(x * 0.03, z * 0.03, 2, BRITAIN.seed + 60);
    if (n < 0.05) continue;
    if (i % 8 === 0) {
      const s = range(rng, 0.6, 1.2);
      bushes.add(BALL, C.oak[i % 3], T(x, h + 0.3 * s, z, range(rng, 0, 6), s * 1.3, s * 0.8, s * 1.3), false);
    } else {
      const s = range(rng, 0.1, 0.18);
      bushes.add(BALL, ['#ffffff', '#ffd76a', '#c9a2ff', '#ff9ed2'][i % 4], T(x, h + 0.25, z, 0, s, s * 0.7, s), false);
    }
  }

  // slope and shore rocks
  let nRocks = 0;
  for (let i = 0; i < 2600 && nRocks < 300; i++) {
    const x = range(rng, -BRITAIN.playHalf, BRITAIN.playHalf), z = range(rng, -BRITAIN.playHalf, BRITAIN.playHalf);
    const h = heightAt(x, z), sl = slope(x, z);
    if (blocked(x, z) || h < WL - 1.2) continue;
    const shore = Math.abs(Math.hypot(x - LAKE.c[0], z - LAKE.c[1]) - LAKE.r) < 8;
    const want = sl > 0.5 ? 0.45 : shore ? 0.3 : 0.03;
    if (rng() > want) continue;
    const s = range(rng, 0.6, sl > 0.5 ? 3.0 : 1.8);
    rocks.add(ROCK, rng() > 0.5 ? C.rock : C.rockDark, T(x, lowest(x, z, s) + s * 0.15, z, range(rng, 0, 6), s * range(rng, 0.9, 1.5), s * range(rng, 0.6, 1.0), s, range(rng, -0.3, 0.3)));
    nRocks++;
  }

  pieces.push(
    { name: 'Lamps', material: 'M_Toon', batch: lamps, outline: true },
    { name: 'Trees_Trunks', material: 'M_Toon', batch: trunks, outline: true, userData: { count: nTree } },
    { name: 'Trees_Leaves', material: 'M_Foliage', batch: leaves, outline: true },
    { name: 'Rocks', material: 'M_Toon', batch: rocks, outline: true, userData: { count: nRocks } },
    { name: 'Bushes', material: 'M_Foliage', batch: bushes },
  );

  return { pieces, markers };
}

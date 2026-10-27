// Structures, props and vegetation for 业火京都 (Kyoto Ablaze, 1582).
import * as THREE from 'three';
import { Batch, T, BOX, distToPolyline } from '../geo.js';
import { mulberry32, range } from '../rng.js';
import { PAL, type Piece } from '../structures.js';
import { conifer, canopy } from '../vegetation.js';
import type { Marker } from '../layout.js';
import {
  KYOTO, CITY_Y, TORII_PATH, INARI, STREETS_X, STREETS_Z, STREET_W, SANJO_Z, HONNOJI, CORE, KAMO, KAMO_W, KAMO_BANK,
  SANJO, TOBI_Z, YASAKA, YASAKA_SHRINE, SANNEN, KIYOMIZU, OTOWA, POND, PAVILION, ISLES, STONE_ROUTE, AKECHI, BANNERS,
  RASHOMON, PATHS,
} from './layout.js';
import { kamoD, pondD, inHonnoji, sannen, CITY_RECT } from './terrain.js';

type HeightAt = (x: number, z: number) => number;

const CYL6 = new THREE.CylinderGeometry(1, 1, 1, 6);
const CYL8 = new THREE.CylinderGeometry(1, 1, 1, 8);
const CYL16 = new THREE.CylinderGeometry(1, 1, 1, 16);
const ROCK = new THREE.DodecahedronGeometry(1, 0);
const CRYSTAL = new THREE.OctahedronGeometry(1, 0);
const BALL = new THREE.IcosahedronGeometry(1, 0);
const SPHERE = new THREE.IcosahedronGeometry(1, 2);
const FLAME = new THREE.ConeGeometry(1, 1, 6);
const ROOF = new THREE.CylinderGeometry(1, 1, 1, 3, 1, false, Math.PI / 2); // gable prism: apex up after rz = π/2
/** Hipped roof: a square frustum, axis-aligned, 1 × 1 at the eaves (scale x/z to the footprint). */
const HIP = new THREE.CylinderGeometry(0.22, 0.7071, 1, 4, 1, false, Math.PI / 4);

const C = {
  ...PAL,
  vermilion: '#d8452b',
  vermilionDark: '#a8331f',
  black: '#2a2422',
  tile: '#4a4d58',
  tileDark: '#383a44',
  plaster: '#ece6d6',
  wood: '#8a5a3a',
  woodDark: '#5a3a26',
  lattice: '#4a2e1e',
  bark: '#6b4a3a',
  charred: '#2e2626',
  ember: '#ff6a2a',
  fire: '#ffa040',
  fireCore: '#fff0b0',
  gold: '#f2c14a',
  goldDeep: '#d9a332',
  kikyo: '#5f8fd0',
  cloth: '#f2efe6',
  stoneLight: '#cfc9bc',
  lantern: '#ffcf7a',
};

export function buildKyoto(heightAt: HeightAt) {
  const pieces: Piece[] = [];
  const markers: Marker[] = [];
  const mk = (m: Marker) => markers.push(m);
  const rng = mulberry32(KYOTO.seed + 5);
  const glow = new Batch('Glow_Props', 'M_Emissive');
  const flames = new Batch('Kyoto_Flames', 'M_Emissive');
  const lamps = new Batch('Lamps');
  const rocks = new Batch('Rocks');
  const leaves = new Batch('Trees_Leaves', 'M_Foliage');
  const trunks = new Batch('Trees_Trunks');
  const bushes = new Batch('Bushes', 'M_Foliage');
  pieces.push({ name: 'Glow_Props', material: 'M_Emissive', batch: glow });
  // the fires of that night go out once the core is relit
  pieces.push({ name: 'Kyoto_Flames', material: 'M_Emissive', batch: flames, userData: { hideWhen: 'fire_core' } });

  const slope = (x: number, z: number) => {
    const e = 1.5;
    return Math.hypot(heightAt(x + e, z) - heightAt(x - e, z), heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e);
  };
  const lowest = (x: number, z: number, r: number) =>
    Math.min(heightAt(x, z), heightAt(x + r, z), heightAt(x - r, z), heightAt(x, z + r), heightAt(x, z - r));
  /** A paper lantern on a post. */
  const chochin = (x: number, z: number, y = heightAt(x, z)) => {
    lamps.add(CYL6, C.woodDark, T(x, y + 1.4, z, 0, 0.07, 2.8, 0.07));
    lamps.add(BOX, C.woodDark, T(x, y + 2.8, z, 0, 0.7, 0.07, 0.07), false);
    glow.add(CYL8, C.lantern, T(x + 0.3, y + 2.4, z, 0, 0.22, 0.55, 0.22), false);
  };
  /** A stone lantern (tōrō). */
  const toro = (b: Batch, x: number, z: number, y = heightAt(x, z), s = 1) => {
    b.add(CYL8, C.stoneLight, T(x, y + 0.5 * s, z, 0, 0.18 * s, 1.0 * s, 0.18 * s));
    b.box(x, y + 1.0 * s, z, 0.7 * s, 0.5 * s, 0.7 * s, C.stoneLight, 0, false);
    glow.add(BOX, C.lantern, T(x, y + 1.25 * s, z, 0, 0.42 * s, 0.3 * s, 0.42 * s), false);
    b.add(HIP, C.stoneLight, T(x, y + 1.65 * s, z, 0, 1.2 * s, 0.4 * s, 1.2 * s), false);
  };
  /** A fire on a roof or a heap: a few flame cones. */
  const blaze = (x: number, y: number, z: number, s = 1) => {
    for (let k = 0; k < 3; k++) {
      const a = rng() * Math.PI * 2, r = k === 0 ? 0 : 0.8 * s;
      const h = range(rng, 1.6, 3.2) * s;
      flames.add(FLAME, C.fire, T(x + Math.cos(a) * r, y + h / 2, z + Math.sin(a) * r, a, 0.7 * s, h, 0.7 * s), false);
      flames.add(FLAME, C.fireCore, T(x + Math.cos(a) * r, y + h * 0.35, z + Math.sin(a) * r, a, 0.38 * s, h * 0.6, 0.38 * s), false);
    }
  };
  /** A torii across heading ry (local x spans the opening). */
  const torii = (b: Batch, x: number, y: number, z: number, ry: number, w: number, h: number, t: number, collide = true) => {
    const ax = Math.cos(ry), az = -Math.sin(ry);
    for (const s of [-1, 1]) {
      b.add(CYL16, C.vermilion, T(x + ax * s * w / 2, y + h / 2, z + az * s * w / 2, 0, t, h, t), collide);
      b.add(CYL16, C.black, T(x + ax * s * w / 2, y + 0.4, z + az * s * w / 2, 0, t * 1.15, 0.8, t * 1.15), false);
    }
    b.add(BOX, C.vermilion, T(x, y + h * 0.78, z, ry, w + t * 2, t * 0.9, t * 1.1), false); // nuki
    b.add(BOX, C.vermilion, T(x, y + h, z, ry, w + t * 5, t * 1.1, t * 1.6), false); // kasagi
    b.add(BOX, C.black, T(x, y + h + t * 1.1, z, ry, w + t * 6, t * 0.5, t * 1.8), false);
  };
  /** A gable roof over a w × d footprint along heading ry, eaves at y. */
  const gable = (b: Batch, x: number, y: number, z: number, ry: number, w: number, d: number, rh: number, color: string) =>
    b.add(ROOF, color, T(x, y + rh / 3, z, ry, rh / 1.5, w, d / 1.732, 0, Math.PI / 2), false);
  /** A hipped roof over a w × d footprint, eaves at y. */
  const hip = (b: Batch, x: number, y: number, z: number, ry: number, w: number, d: number, rh: number, color: string, collide = false) =>
    b.add(HIP, color, T(x, y + rh / 2, z, ry, w, rh, d), collide);
  /** A two-storey town house (machiya) facing heading ry; burnt ones are charred, some still burning. */
  const machiya = (b: Batch, x: number, z: number, ry: number, w: number, d: number, state: 'whole' | 'burnt' | 'burning') => {
    const y = lowest(x, z, Math.min(w, d) / 2), h = range(rng, 4.6, 6.0), fx = Math.sin(ry), fz = Math.cos(ry);
    const burnt = state !== 'whole';
    b.add(BOX, burnt ? C.charred : C.plaster, T(x, y + h / 2, z, ry, w, h, d));
    b.add(BOX, burnt ? '#1e1818' : C.lattice, T(x + fx * (d / 2 + 0.05), y + 1.4, z + fz * (d / 2 + 0.05), ry, w - 0.4, 2.6, 0.12), false);
    b.add(BOX, burnt ? '#1e1818' : C.woodDark, T(x, y + h * 0.5, z, ry, w + 0.1, 0.18, d + 0.1), false);
    if (!burnt) {
      b.add(BOX, C.tileDark, T(x + fx * (d / 2 + 0.5), y + 3.0, z + fz * (d / 2 + 0.5), ry, w, 0.14, 1.2, -0.3), false); // hisashi
      b.add(BOX, C.lattice, T(x + fx * (d / 2 + 0.03), y + h - 1.2, z + fz * (d / 2 + 0.03), ry, w * 0.6, 0.6, 0.06), false); // mushiko
      gable(b, x, y + h, z, ry, w + 0.4, d + 1.2, 2.0, rng() < 0.85 ? C.tile : C.tileDark);
      if (rng() < 0.3) glow.add(BOX, C.lantern, T(x + fx * (d / 2 + 0.1), y + 1.2, z + fz * (d / 2 + 0.1), ry, 0.8, 1.6, 0.04), false);
      if (rng() < 0.25) b.add(BOX, ['#3a4a8a', '#8a2a2a', '#3a6a4a'][Math.floor(rng() * 3)], T(x + fx * (d / 2 + 0.2), y + 2.0, z + fz * (d / 2 + 0.2), ry, 1.6, 0.9, 0.03), false); // noren
    } else {
      for (let k = 0; k < 3; k++) glow.add(BALL, C.ember, T(x + range(rng, -w / 3, w / 3), y + h + 0.05, z + range(rng, -d / 3, d / 3), rng() * 6, range(rng, 0.4, 0.8), 0.22, range(rng, 0.4, 0.8)), false);
      b.add(BOX, C.charred, T(x, y + h + 0.7, z, ry + 0.3, 0.25, 1.4, d * 0.7, 0.5), false); // a fallen beam
      if (state === 'burning') blaze(x, y + h, z, range(rng, 0.9, 1.5));
    }
  };

  // ───────────────────────── 千本鸟居: the torii tunnel through Inari-yama ─────────────────────────
  {
    const b = new Batch('Inari');
    // walk the path at even spacing and stand a torii across it every 2.2 m (the valley side has its own)
    let carry = 0, n = 0;
    for (let i = 0; i < TORII_PATH.length - 1; i++) {
      const [x0, z0] = TORII_PATH[i], [x1, z1] = TORII_PATH[i + 1], L = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0);
      let s = carry;
      for (; s < L; s += 2.2) {
        const x = x0 + ((x1 - x0) * s) / L, z = z0 + ((z1 - z0) * s) / L;
        if (z < -359 || z > -254) continue;
        torii(b, x, heightAt(x, z) - 0.1, z, ry, 3.4, 3.8, 0.22);
        if (++n % 9 === 0) for (const side of [-1, 1]) toro(b, x + Math.cos(ry) * side * 3.4, z - Math.sin(ry) * side * 3.4, undefined, 0.8);
      }
      carry = s - L;
    }
    // the rōmon gate at the foot of the hill, and two stone foxes
    const [gx, gz] = INARI.gate, y = heightAt(gx, gz);
    for (const s of [-1, 1]) {
      b.box(gx + s * 5.5, y, gz, 3.4, 5.2, 5.4, C.vermilion);
      b.box(gx + s * 5.5, y + 0.3, gz, 3.6, 0.6, 5.6, C.plaster, 0, false);
    }
    b.box(gx, y + 5.2, gz, 14.6, 2.6, 5.8, C.vermilion, 0, false);
    b.box(gx, y + 7.0, gz, 15, 0.6, 6.2, C.plaster, 0, false);
    hip(b, gx, y + 7.6, gz, 0, 18, 9, 3.4, C.tile);
    hip(b, gx, y + 5.0, gz, 0, 18, 9.6, 0.5, C.tile);
    for (const s of [-1, 1]) {
      const fx = gx + s * 9, fz = gz + 5;
      b.box(fx, y, fz, 1.6, 1.6, 1.6, C.stone);
      b.box(fx, y + 1.6, fz, 0.8, 1.4, 1.2, C.plaster, 0, false);
      b.add(new THREE.ConeGeometry(1, 1, 6), C.plaster, T(fx, y + 3.2, fz + 0.4, 0, 0.32, 0.8, 0.32), false);
      b.add(BOX, C.vermilion, T(fx, y + 2.5, fz + 0.5, 0, 0.9, 0.3, 0.1), false); // red bib
      glow.add(BOX, C.ember, T(fx, y + 2.9, fz + 0.66, 0, 0.24, 0.1, 0.05), false);
    }
    pieces.push({ name: 'Inari', material: 'M_Toon', batch: b, outline: true });
    mk({ id: 'spawn_p1', type: 'spawn', label: '玩家1出生点（南方鸟居断面）', p: [gx - 1.5, heightAt(gx - 1.5, gz + 10), gz + 10] });
    mk({ id: 'spawn_p2', type: 'spawn', label: '玩家2出生点（南方鸟居断面）', p: [gx + 1.5, heightAt(gx + 1.5, gz + 10), gz + 10] });
    mk({ id: 'disc_senbon', type: 'discovery', label: '千本鸟居', p: [TORII_PATH[3][0], heightAt(TORII_PATH[3][0], TORII_PATH[3][1]), TORII_PATH[3][1]], radius: 5, note: '每一座鸟居，都是有人许下的一个愿望' });
  }

  // ───────────────────────── 洛中: the chessboard city ─────────────────────────
  const nearKamo = (x: number, z: number, pad: number) => kamoD(x, z) < KAMO_BANK + pad;
  const fireDist = (x: number, z: number) => Math.hypot(x - HONNOJI.c[0], z - HONNOJI.c[1]);
  {
    const city = new Batch('Rakuchu');
    const cityB = new Batch('Rakuchu_B');
    let nHouse = 0;
    for (let i = 0; i < STREETS_X.length - 1; i++)
      for (let j = 0; j < STREETS_Z.length - 1; j++) {
        const x0 = STREETS_X[i] + STREET_W / 2 + 0.5, x1 = STREETS_X[i + 1] - STREET_W / 2 - 0.5;
        const z0 = STREETS_Z[j] + STREET_W / 2 + 0.5, z1 = STREETS_Z[j + 1] - STREET_W / 2 - 0.5;
        const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
        if (inHonnoji(cx, cz, HONNOJI.moat + 16)) continue;
        const b = (i + j) % 2 ? city : cityB;
        const D = 8.5;
        const row = (ax: number, az: number, bx: number, bz: number, ry: number) => {
          const L = Math.hypot(bx - ax, bz - az);
          let s = 0;
          while (s < L - 3.5) {
            const w = Math.min(range(rng, 4.6, 6.4), L - s);
            const t = (s + w / 2) / L, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
            s += w + 0.15;
            if (nearKamo(x, z, 4)) continue;
            const f = fireDist(x, z);
            const state = f < 95 ? (rng() < 0.45 ? 'burning' : 'burnt') : f < 140 && rng() < 0.35 ? 'burnt' : 'whole';
            const fx = Math.sin(ry), fz = Math.cos(ry);
            machiya(b, x - fx * D / 2, z - fz * D / 2, ry, w, D, state);
            nHouse++;
          }
        };
        row(x0, z0, x1, z0, Math.PI); // north side faces north
        row(x0, z1, x1, z1, 0); // south side faces south
        row(x0, z0 + D + 0.5, x0, z1 - D - 0.5, -Math.PI / 2); // west side faces west
        row(x1, z0 + D + 0.5, x1, z1 - D - 0.5, Math.PI / 2); // east side faces east
        // a garden tree in some courtyards
        if (rng() < 0.5) {
          const tx = cx + range(rng, -2, 2), tz = cz + range(rng, -2, 2), ty = heightAt(tx, tz);
          trunks.add(new THREE.CylinderGeometry(0.18, 0.28, 1, 6), C.woodDark, T(tx, ty + 1.6, tz, 0, 1, 3.2, 1), false);
          canopy(leaves, rng, tx, ty + 4.2, tz, 2.4, 1.8, rng() < 0.3 ? '#b8452e' : '#5f8a4a');
        }
      }
    // paper lanterns at the crossings of the main avenues
    for (const sx of STREETS_X) for (const sz of STREETS_Z) {
      if (inHonnoji(sx, sz, HONNOJI.moat + 3) || nearKamo(sx, sz, 2)) continue;
      if (sz !== SANJO_Z && sx !== -15 && sx !== 45 && rng() < 0.6) continue;
      chochin(sx + STREET_W / 2 + 0.6, sz + STREET_W / 2 + 0.6);
    }
    pieces.push({ name: 'Rakuchu', material: 'M_Toon', batch: city, outline: true, userData: { count: nHouse } });
    pieces.push({ name: 'Rakuchu_B', material: 'M_Toon', batch: cityB, outline: true });
    mk({ id: 'disc_sanjo_dori', type: 'discovery', label: '三条通', p: [15, CITY_Y, SANJO_Z], radius: 6, note: '平安京的街道横平竖直，像一张棋盘' });
    for (const [x, z] of [[-15, -20], [45, 30], [-45, -45]] as const) mk({ id: `enemy_rakuchu_${x}_${z}`, type: 'enemy', label: '燃烧的亡武者（占位）', p: [x, CITY_Y, z] });
  }

  // ───────────────────────── 本能寺: the temple fortress on fire ─────────────────────────
  {
    const b = new Batch('Honnoji');
    const [hx, hz] = HONNOJI.c, H = HONNOJI.half, y = CITY_Y + 0.6;
    // earthen walls (tsuijibei) on all four sides; the east side opens on a gate over the moat
    const wall = (ax: number, az: number, bx: number, bz: number) => {
      const L = Math.hypot(bx - ax, bz - az), ry = Math.atan2(bx - ax, bz - az), mx = (ax + bx) / 2, mz = (az + bz) / 2;
      b.add(BOX, C.plaster, T(mx, y + 1.6, mz, ry, 1.3, 3.2, L));
      for (let k = 1; k <= 3; k++) b.add(BOX, '#d8cfb8', T(mx, y + 0.6 + k * 0.6, mz, ry, 1.34, 0.08, L), false);
      b.add(BOX, C.tileDark, T(mx, y + 3.4, mz, ry, 2.2, 0.4, L + 0.4), false);
    };
    const gateHalf = 3.5;
    wall(hx - H, hz - H, hx + H, hz - H);
    wall(hx - H, hz + H, hx + H, hz + H);
    wall(hx - H, hz - H, hx - H, hz + H);
    wall(hx + H, hz - H, hx + H, hz - gateHalf);
    wall(hx + H, hz + gateHalf, hx + H, hz + H);
    // the gate: a four-legged gate house and a plank bridge over the moat
    for (const s of [-1, 1]) b.add(CYL8, C.woodDark, T(hx + H, y + 2.6, hz + s * (gateHalf + 0.4), 0, 0.35, 5.2, 0.35));
    gable(b, hx + H, y + 5.2, hz, Math.PI / 2, 10, 6, 2.4, C.tileDark);
    b.box(hx + H + HONNOJI.moat / 2, CITY_Y + 0.25, hz, HONNOJI.moat + 3, 0.35, 5, C.wood);
    for (const s of [-1, 1]) b.box(hx + H + HONNOJI.moat / 2, CITY_Y + 0.6, hz + s * 2.4, HONNOJI.moat + 2, 0.9, 0.15, C.woodDark);
    // corner watch platforms (yagura) with banners of the Oda: black on yellow
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      const x = hx + sx * (H - 3), z = hz + sz * (H - 3);
      for (const [px, pz] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) b.add(CYL6, C.woodDark, T(x + px, y + 3, z + pz, 0, 0.2, 6, 0.2));
      b.box(x, y + 6, z, 4.4, 0.3, 4.4, C.wood, 0, false);
      hip(b, x, y + 8.6, z, 0, 6, 6, 1.6, C.charred);
      b.add(CYL6, C.woodDark, T(x, y + 11, z, 0, 0.06, 4, 0.06), false);
      b.add(BOX, '#f2c94a', T(x + 0.5, y + 11.4, z, 0, 1.0, 2.4, 0.03), false);
      glow.add(CYL16, '#1c1a1a', T(x + 0.5, y + 11.6, z + 0.02, 0, 0.35, 0.02, 0.35, Math.PI / 2), false);
      blaze(x, y + 8.6, z, 0.8);
    }
    // the main hall, burning: a raised floor, charred posts and walls, a great roof broken open
    const mx = hx - 18, mw = 22, md = 30;
    b.box(mx, y, hz, mw + 4, 1.0, md + 4, C.stone);
    for (const s of [-1, 1]) b.box(mx + mw / 2 + 2.6, y, hz + s * 6, 1.2, 0.5, 8, C.stone); // steps
    b.box(mx, y + 1.0, hz, mw, 7, md, C.charred);
    for (let k = 0; k < 7; k++) b.add(CYL8, '#1e1818', T(mx + mw / 2 + 0.6, y + 4.5, hz - md / 2 + 1 + k * (md - 2) / 6, 0, 0.32, 7, 0.32), false);
    hip(b, mx, y + 8, hz, 0, mw + 8, md + 8, 9, '#3a3232');
    for (let k = 0; k < 6; k++) blaze(mx + range(rng, -mw / 3, mw / 3), y + 12 + range(rng, -1, 2), hz + range(rng, -md / 3, md / 3), range(rng, 1.6, 2.6));
    for (let k = 0; k < 14; k++) glow.add(BALL, C.ember, T(mx + range(rng, -mw / 2, mw / 2), y + 8.2 + range(rng, 0, 4), hz + range(rng, -md / 2, md / 2), rng() * 6, range(rng, 0.6, 1.2), 0.3, range(rng, 0.6, 1.2)), false);
    // the kuri (priests' quarters) and a bell tower, half burnt; pines; stone lanterns lining the court
    b.box(hx - 22, y, hz + 35, 26, 5, 10, C.charred);
    gable(b, hx - 22, y + 5, hz + 35, 0, 27, 12, 3.2, C.tileDark);
    blaze(hx - 30, y + 6.5, hz + 35, 1.4);
    {
      const bx = hx + 28, bz = hz - 32;
      b.box(bx, y, bz, 6, 1.2, 6, C.stone);
      for (const [px, pz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) b.add(CYL8, C.woodDark, T(bx + px, y + 4, bz + pz, 0, 0.22, 6, 0.22));
      hip(b, bx, y + 7.2, bz, 0, 7, 7, 2.4, C.tileDark);
      b.add(CYL16, '#6e5a3a', T(bx, y + 5.0, bz, 0, 0.8, 1.8, 0.8), false);
    }
    for (let k = 0; k < 6; k++) for (const s of [-1, 1]) toro(b, hx + 6 + k * 6, hz + s * 9);
    for (const [px, pz] of [[hx + 30, hz + 30], [hx + 34, hz - 14], [hx - 4, hz - 34], [hx + 12, hz + 36]] as const) {
      const ty = heightAt(px, pz);
      trunks.add(new THREE.CylinderGeometry(0.3, 0.45, 1, 6), C.woodDark, T(px, ty + 2.5, pz, 0, 1, 5, 1));
      canopy(leaves, rng, px + 1.4, ty + 6, pz, 3.6, 1.4, '#3f6a3a');
    }
    pieces.push({ name: 'Honnoji', material: 'M_Toon', batch: b, outline: true });
    // the Kyoto core in the courtyard: where the boss rises
    const [cx, cz] = CORE.c;
    b.add(CYL16, C.stone, T(cx, y + 0.35, cz, 0, 2.4, 0.7, 2.4));
    const core = new Batch('Kyoto_Core_Dark', 'M_Emissive');
    core.add(SPHERE, '#ff5a2a', T(cx, y + 3, cz, 0, 1.4, 1.4, 1.4), false);
    for (const a of [0, 1.1, 2.2]) core.add(new THREE.TorusGeometry(2, 0.1, 6, 40), C.ember, T(cx, y + 3, cz, a, 1, 1, 1, Math.PI / 2 - 0.4), false);
    pieces.push({ name: 'Kyoto_Core_Dark', material: 'M_Emissive', batch: core, userData: { hideWhen: 'fire_core', bob: true } });
    const lit = new Batch('Kyoto_Core', 'M_Emissive');
    lit.add(SPHERE, '#bfe9ff', T(cx, y + 3, cz, 0, 1.6, 1.6, 1.6), false);
    pieces.push({ name: 'Kyoto_Core', material: 'M_Emissive', batch: lit, userData: { showWhen: 'fire_core', bob: true } });
    const beam = new Batch('Kyoto_Core_Beam', 'M_Beam');
    beam.add(new THREE.CylinderGeometry(1.2, 2.0, 160, 20, 1, true), '#bfe9ff', T(cx, y + 80, cz), false);
    pieces.push({ name: 'Kyoto_Core_Beam', material: 'M_Beam', batch: beam, userData: { showWhen: 'fire_core' } });
    mk({ id: 'fire_core', type: 'interact', label: '京之核', p: [cx, y, cz], radius: 3.6, requires: ['shard_kinkaku', 'shard_kiyomizu', 'shard_kikyo'] });
    mk({ id: 'boss_hellfire_lord', type: 'enemy', label: '业火之主（Boss）', p: [cx - 12, y, cz] });
    mk({ id: 'disc_honnoji', type: 'discovery', label: '本能寺', p: [hx + H + 4, CITY_Y, hz + 10], radius: 6, note: '「敌在本能寺！」天亮之前，这座寺被大火吞没' });
    for (const s of [-1, 1]) mk({ id: `enemy_honnoji_${s}`, type: 'enemy', label: '燃烧的亡武者（占位）', p: [hx + H + 10, CITY_Y, hz + s * 14] });
  }

  // ───────────────────────── 鸭川: the Kamo River, the Sanjō bridge and the turtle stones ─────────────────────────
  {
    const b = new Batch('Kamo');
    const { z, x0, x1, y } = SANJO, W = 6;
    const deck0 = x0 + 4, deck1 = x1 - 4;
    b.box((deck0 + deck1) / 2, y - 0.4, z, deck1 - deck0, 0.4, W, C.wood);
    for (const [x, dir] of [[deck0, -1], [deck1, 1]] as const) {
      const g = heightAt(x + dir * 9, z);
      b.ramp(x + dir * 4.5, z, g, y, 9, W, C.wood, dir > 0 ? -Math.PI / 2 : Math.PI / 2);
    }
    for (let x = deck0 + 2; x < deck1; x += 8)
      for (const s of [-1, 1]) b.add(CYL8, C.woodDark, T(x, y / 2 - 0.2, z + s * (W / 2 - 0.4), 0, 0.3, y + 0.4, 0.3), false);
    for (const s of [-1, 1]) {
      b.box((deck0 + deck1) / 2, y, z + s * (W / 2 - 0.1), deck1 - deck0, 1.0, 0.2, C.wood);
      for (let x = deck0; x <= deck1 + 0.1; x += (deck1 - deck0) / 6) {
        b.add(CYL8, C.woodDark, T(x, y + 0.6, z + s * (W / 2 - 0.1), 0, 0.16, 1.2, 0.16), false);
        b.add(SPHERE, '#b88a3a', T(x, y + 1.3, z + s * (W / 2 - 0.1), 0, 0.22, 0.26, 0.22), false); // giboshi
        b.add(new THREE.ConeGeometry(1, 1, 8), '#b88a3a', T(x, y + 1.62, z + s * (W / 2 - 0.1), 0, 0.08, 0.36, 0.08), false);
      }
    }
    for (const x of [deck0 - 2, deck1 + 2]) chochin(x, z + 4.2);
    // the turtle stones (tobi-ishi): stepping stones straight across the stream
    for (let x = 126; x <= 176; x += 1.7) {
      if (kamoD(x, TOBI_Z) > KAMO_W + 1) continue;
      const turtle = Math.round((x - 126) / 1.7) % 4 === 1;
      b.add(CYL8, '#b7b0a2', T(x, 1.1, TOBI_Z, Math.PI / 8, 0.95, 1.5, 1.3)); // top 1.85: a low step up from the bank
      if (turtle) b.add(SPHERE, '#a49c8c', T(x, 2.05, TOBI_Z + 1.25, 0, 0.3, 0.2, 0.3), false);
    }
    // river-bank willows and moored boats
    for (let z2 = -300; z2 <= 300; z2 += 22) {
      const [cx] = KAMO.reduce((a, p) => (Math.abs(p[1] - z2) < Math.abs(a[1] - z2) ? p : a));
      const x = cx - KAMO_BANK - 2 + range(rng, -2, 2), ty = heightAt(x, z2);
      if (Math.abs(z2 - SANJO.z) < 8 || Math.abs(z2 - TOBI_Z) < 6) continue;
      trunks.add(new THREE.CylinderGeometry(0.2, 0.35, 1, 6), C.woodDark, T(x, ty + 1.8, z2, 0, 1, 3.6, 1));
      canopy(leaves, rng, x, ty + 4.2, z2, 2.4, 2.6, '#8fbf5a');
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        leaves.add(BOX, '#7fae4e', T(x + Math.cos(a) * 1.8, ty + 2.6, z2 + Math.sin(a) * 1.8, a, 0.4, 3.2, 0.1), false); // trailing fronds
      }
    }
    for (const [x, z2, ry] of [[160, -40, 0.2], [146, 110, -0.1]] as const) {
      b.add(BOX, C.wood, T(x, 1.15, z2, ry, 1.8, 0.4, 7));
      b.add(BOX, C.woodDark, T(x, 1.5, z2, ry, 1.9, 0.3, 0.3), false);
    }
    pieces.push({ name: 'Kamo', material: 'M_Toon', batch: b, outline: true });
    mk({ id: 'musashi_meet', type: 'interact', label: '宫本武藏（三条大桥）', p: [(deck0 + deck1) / 2 - 2, y, z], radius: 3.4, note: '武藏说：点亮京之核，我就陪你打到天亮' });
    mk({ id: 'musashi_contract', type: 'interact', label: '与宫本武藏缔结契约', p: [(deck0 + deck1) / 2 + 2, y, z], radius: 3, requires: ['fire_core'], note: 'Saber 职阶从者 · 二天一流' });
    mk({ id: 'disc_tobiishi', type: 'discovery', label: '鸭川跳石', p: [150, 1.9, TOBI_Z], radius: 4, note: '踩着乌龟形状的石头过河' });
  }

  // ───────────────────────── 东山: Yasaka, Sannenzaka, Kiyomizu ─────────────────────────
  {
    const b = new Batch('Higashiyama');
    // Yasaka shrine's vermilion west gate
    {
      const [gx, gz] = YASAKA_SHRINE.c, y = heightAt(gx, gz);
      for (const s of [-1, 1]) b.box(gx, y, gz + s * 4.5, 4.6, 5.0, 3.0, C.vermilion, 0);
      b.box(gx, y + 5.0, gz, 5.0, 2.2, 12, C.vermilion, 0, false);
      hip(b, gx, y + 7.2, gz, 0, 8, 16, 3, C.tile);
      for (const s of [-1, 1]) for (let k = 0; k < 4; k++) glow.add(CYL8, C.lantern, T(gx - 2.6, y + 4.2, gz + s * (2.3 + k * 0.9), 0, 0.28, 0.6, 0.28), false);
      mk({ id: 'disc_yasaka', type: 'discovery', label: '八坂神社', p: [gx - 6, y, gz], radius: 5, note: '祇园祭的山鉾从这里出发' });
    }
    // the five-storey pagoda (Hōkan-ji)
    {
      const [px, pz] = YASAKA.c;
      let y = heightAt(px, pz);
      b.box(px, y - 0.6, pz, 9, 1.4, 9, C.stone);
      y += 0.8;
      for (let k = 0; k < 5; k++) {
        const s = 6.4 - k * 0.55, h = 4.2;
        b.box(px, y, pz, s, h, s, k === 0 ? C.vermilionDark : C.vermilion, 0, k === 0);
        b.box(px, y + h * 0.4, pz, s + 0.1, 0.18, s + 0.1, C.plaster, 0, false);
        hip(b, px, y + h - 0.2, pz, 0, s + 4.6, s + 4.6, 1.3, C.tileDark);
        y += h + 0.6;
      }
      b.add(CYL8, '#6e5a3a', T(px, y + 4, pz, 0, 0.18, 8, 0.18), false);
      for (let k = 0; k < 7; k++) b.add(CYL16, '#8a7448', T(px, y + 1.4 + k * 0.8, pz, 0, 0.55, 0.12, 0.55), false);
      mk({ id: 'disc_yasaka_pagoda', type: 'discovery', label: '八坂塔', p: [px - 7, heightAt(px - 7, pz), pz], radius: 5, note: '法观寺五重塔，东山的地标' });
    }
    // Sannenzaka: stone steps, lanterns and little shops on both sides
    for (let i = 0; i < SANNEN.length - 1; i++) {
      const [ax, az] = SANNEN[i], [bx, bz] = SANNEN[i + 1], L = Math.hypot(bx - ax, bz - az), ry = Math.atan2(bx - ax, bz - az);
      for (let s = 0; s < L; s += 1.2) {
        const x = ax + ((bx - ax) * s) / L, z = az + ((bz - az) * s) / L, y = sannen(x, z).y;
        b.add(BOX, '#b8b0a0', T(x, y + 0.02, z, ry, 3.8, 0.08, 0.5), false);
      }
      for (let s = 3; s < L - 2; s += 7)
        for (const side of [-1, 1]) {
          const x = ax + ((bx - ax) * s) / L + Math.cos(ry) * side * 7.5, z = az + ((bz - az) * s) / L - Math.sin(ry) * side * 7.5;
          machiya(b, x, z, ry + (side > 0 ? -Math.PI / 2 : Math.PI / 2), 5.6, 7, 'whole');
        }
      if (i % 2 === 0) chochin(ax + Math.cos(ry) * 3, az - Math.sin(ry) * 3, sannen(ax, az).y);
    }
    // the Niōmon: a vermilion gate across the road near the top
    {
      const [ax, az] = SANNEN[3], [bx, bz] = SANNEN[4], ry = Math.atan2(bx - ax, bz - az);
      const gx = (ax + bx) / 2, gz = (az + bz) / 2, y = sannen(gx, gz).y;
      const cx = Math.cos(ry), cz = -Math.sin(ry);
      for (const s of [-1, 1]) b.box(gx + cx * s * 4.6, y - 1, gz + cz * s * 4.6, 3.2, 7, 5, C.vermilion, ry);
      b.add(BOX, C.vermilion, T(gx, y + 7.2, gz, ry, 13, 2.4, 5.4), false);
      hip(b, gx, y + 8.4, gz, ry, 16, 9, 3.6, C.bark);
    }
    // Kiyomizu-dera: the main hall on the terrace and its stage on a lattice of pillars over the ravine
    {
      const Y = KIYOMIZU.y, { c: [hx, hz], w, d } = KIYOMIZU.hall, { c: [sx, sz], w: sw, d: sd } = KIYOMIZU.stage;
      b.box(hx, Y, hz, w, 7, d, C.vermilionDark);
      for (let k = 0; k < 6; k++) b.add(CYL8, C.vermilion, T(hx - w / 2 - 0.3, Y + 3.5, hz - d / 2 + 1 + k * (d - 2) / 5, 0, 0.32, 7, 0.32), false);
      hip(b, hx, Y + 7, hz, 0, w + 8, d + 8, 8, C.bark);
      // the stage: deck, railing on three sides (it joins the terrace on the east)
      b.box(sx, Y - 0.4, sz, sw, 0.4, sd, C.wood);
      const sx0 = sx - sw / 2, sx1 = sx + sw / 2, sz0 = sz - sd / 2, sz1 = sz + sd / 2;
      b.box(sx, Y, sz0 + 0.1, sw, 1.0, 0.2, C.wood);
      b.box(sx, Y, sz1 - 0.1, sw, 1.0, 0.2, C.wood);
      b.box(sx0 + 0.1, Y, sz, 0.2, 1.0, sd, C.wood);
      for (let x = sx0 + 1.2; x <= sx1 - 1; x += 3.4)
        for (let z = sz0 + 1.2; z <= sz1 - 1; z += 3.2) {
          const g = heightAt(x, z);
          if (g > Y - 1.5) continue;
          b.add(CYL8, '#7a5a3a', T(x, (g + Y - 0.4) / 2, z, 0, 0.36, Y - 0.4 - g + 0.6, 0.36));
          for (let yy = g + 4; yy < Y - 1; yy += 5) {
            b.add(BOX, '#6a4a2e', T(x + 1.7, yy, z, 0, 3.4, 0.28, 0.24), false);
            b.add(BOX, '#6a4a2e', T(x, yy, z + 1.6, 0, 0.24, 0.28, 3.2), false);
          }
        }
      // the three-storey pagoda on the terrace
      {
        const px = 306, pz = 32;
        let y = Y;
        for (let k = 0; k < 3; k++) {
          const s = 4.6 - k * 0.5;
          b.box(px, y, pz, s, 3.6, s, C.vermilion, 0, k === 0);
          hip(b, px, y + 3.4, pz, 0, s + 3.6, s + 3.6, 1.1, C.bark);
          y += 4.2;
        }
        b.add(CYL8, '#8a7448', T(px, y + 3, pz, 0, 0.14, 6, 0.14), false);
      }
      for (const [x, z] of [[280, 40], [280, 56], [292, 66], [312, 66]] as const) toro(b, x, z, Y);
      // the Otowa falls: three thin streams down the cliff below the stage
      const [ox, oz] = OTOWA.c, oy = heightAt(ox, oz);
      // three bamboo spouts under a little roof, as at the real falls
      b.box(ox, oy, oz - 1.6, 7, 4.4, 1.2, C.rockDark);
      gable(b, ox, oy + 4.4, oz - 1, 0, 7.6, 3, 1.2, C.bark);
      for (const s of [-1.8, 0, 1.8]) {
        b.add(CYL6, '#9fbf6a', T(ox + s, oy + 3.4, oz - 0.6, 0, 0.1, 1.4, 0.1, Math.PI / 2), false);
        glow.add(CYL6, '#cfefff', T(ox + s, oy + 1.7, oz + 0.1, 0, 0.07, 3.4, 0.07), false);
      }
      const shard = new Batch('Shard_kiyomizu', 'M_Emissive');
      const top: [number, number, number] = [sx0 + 2.5, Y, sz1 - 2.5];
      shard.add(CRYSTAL, '#ffb3c8', T(top[0], top[1] + 1.8, top[2], 0.4, 0.4, 0.8, 0.4), false);
      pieces.push({ name: 'Shard_kiyomizu', material: 'M_Emissive', batch: shard, userData: { hideWhen: 'shard_kiyomizu', bob: true } });
      mk({ id: 'shard_kiyomizu', type: 'interact', label: '京之碎片·舞台', p: top, radius: 3.4 });
      mk({ id: 'disc_kiyomizu_stage', type: 'discovery', label: '清水舞台', p: [sx, Y, sz], radius: 5, note: '「从清水舞台跳下去」，意思是下了天大的决心' });
      mk({ id: 'disc_otowa', type: 'discovery', label: '音羽瀑布', p: [ox, oy, oz], radius: 5, note: '三道泉水：学业、恋爱、长寿' });
    }
    pieces.push({ name: 'Higashiyama', material: 'M_Toon', batch: b, outline: true });
    for (const [x, z] of [[214, 40], [236, 26]] as const) mk({ id: `enemy_higashiyama_${x}`, type: 'enemy', label: '燃烧的亡武者（占位）', p: [x, heightAt(x, z), z] });
  }

  // ───────────────────────── 金阁寺: the Golden Pavilion on its pond ─────────────────────────
  {
    const b = new Batch('Kinkaku');
    const gold = new Batch('Kinkaku_Gold', 'M_Emissive');
    const [px, pz] = PAVILION.c, { w, d } = PAVILION;
    const y0 = 1.8, f1 = y0 + 0.6, f2 = f1 + 4.2, f3 = f2 + 4.0;
    // the stone footing and the first floor (Hōsui-in): natural wood, open verandas
    b.box(px, y0 - 1.6, pz, w + 1, 2.2, d + 1, C.stone);
    b.box(px, y0 + 0.2, pz, w + 1.4, 0.4, d + 1.4, C.wood);
    b.box(px, f1, pz - 1, w - 2, 3.8, d - 4, C.plaster); // the closed rooms at the back
    for (let k = 0; k <= 6; k++) b.add(CYL8, C.woodDark, T(px - w / 2 + 0.2 + (k * (w - 0.4)) / 6, f1 + 1.9, pz + d / 2 - 0.3, 0, 0.14, 3.8, 0.14), false);
    b.box(px, f1 + 3.8, pz, w + 0.6, 0.4, d + 0.6, C.woodDark, 0, false);
    hip(b, px, f1 + 4.0, pz, 0, w + 3.4, d + 3.4, 0.5, C.bark);
    // second and third floors in gold leaf
    gold.add(BOX, C.gold, T(px, f2 + 1.8, pz, 0, w - 0.6, 3.6, d - 0.6), false);
    b.add(BOX, C.woodDark, T(px, f2 + 1.0, pz, 0, w + 0.6, 0.15, d + 0.6), false);
    hip(b, px, f2 + 3.6, pz, 0, w + 3.4, d + 3.4, 0.6, C.bark);
    gold.add(BOX, C.gold, T(px, f3 + 1.7, pz, 0, w - 5, 3.4, d - 4), false);
    hip(b, px, f3 + 3.4, pz, 0, w - 0.8, d + 0.4, 3.0, C.bark);
    gold.add(CRYSTAL, C.goldDeep, T(px, f3 + 7.0, pz, 0, 0.5, 1.0, 0.9), false); // the phoenix
    gold.add(BOX, C.goldDeep, T(px, f3 + 7.2, pz - 0.4, 0, 1.8, 0.1, 0.5, 0.3), false);
    b.addCol(BOX, T(px, f2 + 3.5, pz, 0, w, 7, d));
    // the fishing deck (tsuri-dono) over the water, with a low step from the stones
    const dz = pz + d / 2 + 2;
    b.box(px, y0 - 0.2, dz, 6, 0.4, 4, C.wood); // deck top 2.0, one low step (1.82) above the stones (1.65)
    b.box(px, y0 - 0.38, dz + 2.5, 3, 0.4, 1.2, C.wood);
    b.addCol(BOX, T(px, y0 - 2.0, dz + 0.5, 0, 6, 3.6, 6)); // solid under the deck and step: nothing to slip beneath
    for (const s of [-1, 1]) b.add(CYL8, C.woodDark, T(px + s * 2.8, y0 - 0.6, dz + 1.8, 0, 0.14, 2.4, 0.14), false);
    // bamboo fence round the back: the only way in is across the water
    const fence = (ax: number, az: number, bx: number, bz: number) => {
      const L = Math.hypot(bx - ax, bz - az), ry = Math.atan2(bx - ax, bz - az);
      b.add(BOX, '#b8a46a', T((ax + bx) / 2, heightAt((ax + bx) / 2, (az + bz) / 2) + 0.8, (az + bz) / 2, ry, 0.15, 1.6, L));
      for (let s = 0; s < L; s += 1.5) b.add(CYL6, '#8a7a4a', T(ax + ((bx - ax) * s) / L, heightAt(ax + ((bx - ax) * s) / L, az + ((bz - az) * s) / L) + 0.9, az + ((bz - az) * s) / L, 0, 0.06, 1.8, 0.06), false);
    };
    const fz = POND.c[1] - POND.rz * 0.92;
    fence(px - w / 2 - 6, fz + 4, px - w / 2 - 6, pz - d / 2 - 6);
    fence(px - w / 2 - 6, pz - d / 2 - 6, px + w / 2 + 6, pz - d / 2 - 6);
    fence(px + w / 2 + 6, pz - d / 2 - 6, px + w / 2 + 6, fz + 4);
    // stepping stones along the route, wherever there is water under them
    for (let i = 0; i < STONE_ROUTE.length - 1; i++) {
      const [ax, az] = STONE_ROUTE[i], [bx, bz] = STONE_ROUTE[i + 1], L = Math.hypot(bx - ax, bz - az);
      for (let s = 0; s < L; s += 1.6) {
        const x = ax + ((bx - ax) * s) / L, z = az + ((bz - az) * s) / L;
        if (heightAt(x, z) > 1.55) continue;
        b.add(CYL8, '#a8a294', T(x, (heightAt(x, z) - 0.3 + 1.65) / 2, z, rng() * 3, 0.9, 1.95 - heightAt(x, z), 0.9));
      }
    }
    // pines on the islands, and rocks
    for (const isle of ISLES) {
      const [ix, iz] = isle.c, ty = heightAt(ix, iz);
      trunks.add(new THREE.CylinderGeometry(0.25, 0.4, 1, 6), C.woodDark, T(ix + 1.5, ty + 1.6, iz - 1, 0, 1, 3.2, 1, 0.2));
      canopy(leaves, rng, ix + 2.2, ty + 3.6, iz - 1, 3.0, 1.1, '#3f6a3a');
      rocks.add(ROCK, C.rock, T(ix - 1.5, ty + 0.3, iz + 1, rng() * 6, 1.2, 0.8, 1.0));
    }
    pieces.push({ name: 'Kinkaku', material: 'M_Toon', batch: b, outline: true });
    pieces.push({ name: 'Kinkaku_Gold', material: 'M_Emissive', batch: gold });
    const shard = new Batch('Shard_kinkaku', 'M_Emissive');
    const top: [number, number, number] = [px, y0 + 0.2, dz - 0.5];
    shard.add(CRYSTAL, '#ffe08a', T(top[0], top[1] + 1.8, top[2], 0.4, 0.4, 0.8, 0.4), false);
    pieces.push({ name: 'Shard_kinkaku', material: 'M_Emissive', batch: shard, userData: { hideWhen: 'shard_kinkaku', bob: true } });
    mk({ id: 'shard_kinkaku', type: 'interact', label: '京之碎片·金阁', p: top, radius: 3.4 });
    mk({ id: 'disc_kinkaku', type: 'discovery', label: '金阁', p: [px, y0 + 0.2, dz], radius: 4, note: '上面两层贴满了金箔，倒映在镜湖池里' });
    mk({ id: 'disc_kyokochi', type: 'discovery', label: '镜湖池', p: [STONE_ROUTE[0][0], heightAt(...STONE_ROUTE[0]), STONE_ROUTE[0][1]], radius: 5, note: '踩着池中的石头走过去' });
  }

  // ───────────────────────── 明智军阵: the Akechi camp on the western hills ─────────────────────────
  {
    const b = new Batch('Akechi');
    const [ax, az] = AKECHI.c, y = AKECHI.y;
    // the curtained HQ (jinmaku): white cloth with the bellflower crest, open to the east
    const cw = 30, cd = 22;
    const curtain = (x0: number, z0: number, x1: number, z1: number) => {
      const L = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0);
      b.add(BOX, C.cloth, T((x0 + x1) / 2, y + 1.6, (z0 + z1) / 2, ry, 0.08, 2.2, L));
      b.add(BOX, '#2a2a3a', T((x0 + x1) / 2, y + 2.2, (z0 + z1) / 2, ry, 0.1, 0.3, L), false);
      for (let s = 0; s <= L; s += 4) {
        const x = x0 + ((x1 - x0) * s) / L, z = z0 + ((z1 - z0) * s) / L;
        b.add(CYL6, C.woodDark, T(x, y + 1.4, z, 0, 0.06, 2.8, 0.06), false);
        if (s > 0 && s < L) glow.add(CYL16, C.kikyo, T(x + ((x1 - x0) / L) * 2, y + 1.4, z + ((z1 - z0) / L) * 2, ry, 0.45, 0.02, 0.45, 0, Math.PI / 2), false);
      }
    };
    curtain(ax - cw / 2, az - cd / 2, ax + cw / 2, az - cd / 2);
    curtain(ax - cw / 2, az + cd / 2, ax + cw / 2, az + cd / 2);
    curtain(ax - cw / 2, az - cd / 2, ax - cw / 2, az + cd / 2);
    curtain(ax + cw / 2, az - cd / 2, ax + cw / 2, az - 4);
    curtain(ax + cw / 2, az + 4, ax + cw / 2, az + cd / 2);
    b.box(ax - 4, y, az, 3.6, 0.9, 2, C.woodDark); // the field table
    b.add(BOX, C.canvas, T(ax - 4, y + 0.95, az, 0.1, 3.0, 0.02, 1.6), false);
    for (const s of [-1, 1]) b.add(CYL8, '#2a2a3a', T(ax - 4, y + 0.4, az + s * 2.2, 0, 0.35, 0.8, 0.35), false); // camp stools
    b.add(CYL16, '#8a3a2a', T(ax - 11, y + 1.0, az + 6, 0, 1.1, 1.4, 1.1, Math.PI / 2)); // war drum
    // tents and camp fires round the curtain, spear racks, small banners
    for (let k = 0; k < 9; k++) {
      const a = 0.6 + (k / 9) * 5.0, r = range(rng, 26, 36), x = ax + Math.cos(a) * r, z = az + Math.sin(a) * r * 0.9;
      if (Math.hypot(x - (ax + 30), z - az) < 12) continue; // keep the approach clear
      const ty = lowest(x, z, 2);
      b.add(ROOF, k % 2 ? C.cloth : '#d8d2c0', T(x, ty + 0.9, z, a, 1.3, 3.6, 1.5, 0, Math.PI / 2));
      b.add(CYL6, C.woodDark, T(x + 2, ty + 2, z, 0, 0.05, 4, 0.05), false);
      b.add(BOX, C.cloth, T(x + 2.35, ty + 3, z, 0, 0.7, 1.8, 0.03), false);
      glow.add(CYL16, C.kikyo, T(x + 2.35, ty + 3.3, z + 0.02, 0, 0.25, 0.02, 0.25, Math.PI / 2), false);
    }
    for (const [x, z] of [[ax + 18, az - 14], [ax + 20, az + 14], [ax - 20, az + 18]] as const) {
      const ty = heightAt(x, z);
      for (let k = 0; k < 6; k++) b.add(CYL6, C.charred, T(x, ty + 0.25, z, k, 0.1, 1.4, 0.1, Math.PI / 2 - 0.3), false);
      glow.add(FLAME, C.fire, T(x, ty + 0.8, z, 0, 0.5, 1.3, 0.5), false);
    }
    // the three great bellflower banners on the ridge: shoot them down
    BANNERS.forEach(([bx, bz], i) => {
      const gy = heightAt(bx, bz);
      b.add(CYL8, C.woodDark, T(bx, gy + 5, bz, 0, 0.16, 10, 0.16));
      b.add(BOX, C.woodDark, T(bx, gy + 9.8, bz + 1.8, 0, 0.1, 0.1, 3.8), false);
      const t = new Batch(`TGT_kikyo_banner_${i + 1}`, 'M_Target');
      t.add(BOX, C.cloth, T(bx, gy + 6.8, bz + 1.8, 0, 0.12, 6.0, 3.6), true);
      t.add(CYL16, C.kikyo, T(bx - 0.08, gy + 7.6, bz + 1.8, 0, 1.2, 0.03, 1.2, 0, Math.PI / 2), true);
      t.add(CYL16, C.kikyo, T(bx + 0.08, gy + 7.6, bz + 1.8, 0, 1.2, 0.03, 1.2, 0, Math.PI / 2), true);
      pieces.push({ name: `TGT_kikyo_banner_${i + 1}`, material: 'M_Target', batch: t, dynamic: true, userData: { target: `kikyo_banner_${i + 1}` } });
      mk({ id: `kikyo_banner_${i + 1}`, type: 'objective', label: `桔梗大旗 ${i + 1}`, p: [bx, gy + 6.8, bz + 1.8] });
    });
    pieces.push({ name: 'Akechi', material: 'M_Toon', batch: b, outline: true });
    const banners = ['kikyo_banner_1', 'kikyo_banner_2', 'kikyo_banner_3'];
    const shard = new Batch('Shard_kikyo', 'M_Emissive');
    const top: [number, number, number] = [ax + 2, y, az];
    shard.add(CRYSTAL, '#9fc4ff', T(top[0], top[1] + 1.8, top[2], 0.4, 0.4, 0.8, 0.4), false);
    pieces.push({ name: 'Shard_kikyo', material: 'M_Emissive', batch: shard, userData: { showWhen: banners, hideWhen: 'shard_kikyo', bob: true } });
    mk({ id: 'shard_kikyo', type: 'interact', label: '京之碎片·桔梗', p: top, radius: 3.4, requires: banners });
    mk({ id: 'disc_akechi', type: 'discovery', label: '明智本阵', p: [ax + 8, y, az + 6], radius: 5, note: '「敌在本能寺」——明智光秀在这里调转了马头' });
    for (const [dx, dz] of [[30, -18], [26, 20]] as const) mk({ id: `enemy_akechi_${dx}`, type: 'enemy', label: '桔梗足轻（占位）', p: [ax + dx, heightAt(ax + dx, az + dz), az + dz] });
  }

  // ───────────────────────── 罗城门: the ruined south gate of the old capital ─────────────────────────
  {
    const b = new Batch('Rashomon');
    const [rx, rz] = RASHOMON.c, y = heightAt(rx, rz);
    b.box(rx, y - 0.5, rz, 34, 1.4, 12, C.stone);
    for (let k = 0; k < 7; k++)
      for (const s of [-1, 1]) {
        const h = rng() < 0.4 ? range(rng, 1, 3) : range(rng, 5, 8);
        b.add(CYL8, '#6a4a3a', T(rx - 15 + k * 5, y + 0.9 + h / 2, rz + s * 4, 0, 0.4, h, 0.4));
      }
    b.add(BOX, '#5a3e2e', T(rx - 3, y + 1.6, rz + 6, 0.4, 14, 0.6, 0.8, 0, 0.12), false); // a fallen beam
    for (let k = 0; k < 10; k++) b.add(BOX, C.tileDark, T(rx + range(rng, -14, 14), y + 1.0, rz + range(rng, -5, 5), rng() * 3, range(rng, 0.8, 1.6), 0.15, range(rng, 0.6, 1.2), range(rng, -0.3, 0.3)), false);
    pieces.push({ name: 'Rashomon', material: 'M_Toon', batch: b, outline: true });
    mk({ id: 'disc_rashomon', type: 'discovery', label: '罗城门遗迹', p: [rx, y + 0.9, rz - 8], radius: 6, note: '平安京的正门，这时只剩下基石和乌鸦' });
  }

  // ───────────────────────── Vegetation: cedars on the hills, maples, bamboo groves ─────────────────────────
  const inCity = (x: number, z: number, pad: number) => x > CITY_RECT[0] - pad && x < CITY_RECT[1] + pad && z > CITY_RECT[2] - pad && z < CITY_RECT[3] + pad;
  const onPath = (x: number, z: number, pad: number) => PATHS.some((p) => distToPolyline(x, z, p) < pad) || distToPolyline(x, z, TORII_PATH) < pad + 2 || sannen(x, z).d < pad + 8;
  const blocked = (x: number, z: number) =>
    inCity(x, z, 4) || onPath(x, z, 4) || kamoD(x, z) < KAMO_BANK + 1 || pondD(x, z) < 1.25 ||
    Math.hypot(x - AKECHI.c[0], (z - AKECHI.c[1]) * 0.85) < 40 || Math.hypot(x - PAVILION.c[0], z - PAVILION.c[1]) < 16 ||
    (x > KIYOMIZU.terrace[0] - 22 && x < KIYOMIZU.terrace[1] + 2 && z > KIYOMIZU.terrace[2] - 4 && z < KIYOMIZU.terrace[3] + 22) ||
    Math.hypot(x - YASAKA.c[0], z - YASAKA.c[1]) < 12 || Math.hypot(x - YASAKA_SHRINE.c[0], z - YASAKA_SHRINE.c[1]) < 12 ||
    BANNERS.some(([bx, bz]) => Math.hypot(x - bx, z - bz) < 12) || Math.hypot(x - RASHOMON.c[0], z - RASHOMON.c[1]) < 22 ||
    Math.hypot(x - INARI.gate[0], z - INARI.gate[1]) < 16;
  let nTree = 0;
  for (let i = 0; i < 12000 && nTree < 1000; i++) {
    const x = range(rng, -KYOTO.playHalf, KYOTO.playHalf), z = range(rng, -KYOTO.playHalf, KYOTO.playHalf);
    if (blocked(x, z)) continue;
    const y = heightAt(x, z), sl = slope(x, z);
    if (sl > 0.85 || y > 80 || y < 1.6) continue;
    const dens = y > 16 ? 0.5 : 0.12;
    if (rng() > dens) continue;
    const s = range(rng, 0.8, 1.4), ry = rng() * 6;
    nTree++;
    const r = rng();
    if (y > 16 ? r < 0.8 : r < 0.3) { // sugi cedars on the hills
      const th = 3 * s;
      trunks.add(new THREE.CylinderGeometry(0.22, 0.34, 1, 6), C.woodDark, T(x, y + th / 2, z, ry, s, th, s), false);
      conifer(leaves, x, y + th * 0.75, z, s * 1.1, ['#2f5a3c', '#36654a', '#2a4f38'][Math.floor(rng() * 3)], ry);
    } else if (r < 0.88) { // maples, some already turning
      const th = 2.4 * s;
      trunks.add(new THREE.CylinderGeometry(0.18, 0.28, 1, 6), C.woodDark, T(x, y + th / 2, z, ry, s, th, s), false);
      canopy(leaves, rng, x, y + th + 1.2 * s, z, 2.6 * s, 1.6 * s, rng() < 0.25 ? '#c24a2e' : rng() < 0.5 ? '#6f9a42' : '#5a8a3e');
    } else { // a clump of bamboo
      for (let k = 0; k < 7; k++) {
        const bx = x + range(rng, -1.6, 1.6), bz = z + range(rng, -1.6, 1.6), h = range(rng, 7, 11) * s;
        trunks.add(CYL6, '#7fa85a', T(bx, y + h / 2, bz, 0, 0.09, h, 0.09, range(rng, -0.06, 0.06)), false);
        leaves.add(new THREE.ConeGeometry(1, 1, 5), '#8fbf5a', T(bx, y + h * 0.8, bz, rng() * 6, 0.9, h * 0.4, 0.9), false);
      }
    }
    trunks.addCol(BOX, T(x, y + 2, z, ry, 0.6 * s, 4, 0.6 * s));
  }
  let nRocks = 0;
  for (let i = 0; i < 2400 && nRocks < 220; i++) {
    const x = range(rng, -KYOTO.playHalf, KYOTO.playHalf), z = range(rng, -KYOTO.playHalf, KYOTO.playHalf);
    if (blocked(x, z)) continue;
    const sl = slope(x, z);
    if (rng() > (sl > 0.5 ? 0.45 : 0.03)) continue;
    const s = range(rng, 0.6, sl > 0.5 ? 2.8 : 1.4);
    rocks.add(ROCK, rng() > 0.5 ? C.rock : C.rockDark, T(x, lowest(x, z, s) + s * 0.15, z, range(rng, 0, 6), s * range(rng, 0.9, 1.5), s * range(rng, 0.6, 1.0), s, range(rng, -0.3, 0.3)));
    nRocks++;
  }
  for (let i = 0; i < 1400; i++) { // shrubs
    const x = range(rng, -KYOTO.playHalf, KYOTO.playHalf), z = range(rng, -KYOTO.playHalf, KYOTO.playHalf);
    if (blocked(x, z) || slope(x, z) > 0.5 || heightAt(x, z) < 1.6) continue;
    const s = range(rng, 0.5, 1.2);
    bushes.add(BALL, rng() < 0.5 ? '#5f8a4a' : '#6f9a52', T(x, heightAt(x, z) + s * 0.4, z, rng() * 6, s * 1.4, s * 0.8, s * 1.2), false);
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


// Structures, props and vegetation for 永冬之城 (Everwinter City, 1812).
import * as THREE from 'three';
import { Batch, T, BOX, distToPolyline } from '../geo.js';
import { mulberry32, range, fbm } from '../rng.js';
import { PAL, type Piece } from '../structures.js';
import { conifer } from '../vegetation.js';
import type { Marker, V2 } from '../layout.js';
import {
  WINTER, ICE_Y, RIVER, RIVER_W, CROSSING, BIVOUAC, IMPERIAL_TENT, BEACONS, EAGLE, CITY, KREMLIN, BELL, REDSQ, BASIL,
  CORE, ICE_GATE, CAVERN, PATHS,
} from './layout.js';
import { riverD } from './terrain.js';

type HeightAt = (x: number, z: number) => number;

const CYL6 = new THREE.CylinderGeometry(1, 1, 1, 6);
const CYL8 = new THREE.CylinderGeometry(1, 1, 1, 8);
const CYL16 = new THREE.CylinderGeometry(1, 1, 1, 16);
const ROCK = new THREE.DodecahedronGeometry(1, 0);
const CRYSTAL = new THREE.OctahedronGeometry(1, 0);
const BALL = new THREE.IcosahedronGeometry(1, 0);
const SPHERE = new THREE.IcosahedronGeometry(1, 2);
const CONE4 = new THREE.ConeGeometry(1, 1, 4, 1, false, Math.PI / 4);
const CONE8 = new THREE.ConeGeometry(1, 1, 8);
const ROOF = new THREE.CylinderGeometry(1, 1, 1, 3, 1, false, Math.PI / 2); // apex up after rz = π/2
/** Onion dome: a squashed sphere under a spike. */
const ONION = (() => {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12, y = t * 2.2;
    const r = t < 0.55 ? Math.sin((t / 0.55) * Math.PI * 0.62) * 1.0 / Math.sin(Math.PI * 0.62) : Math.max(0.02, (1 - t) / 0.45) ** 1.6;
    pts.push(new THREE.Vector2(Math.max(0.02, r), y));
  }
  return new THREE.LatheGeometry(pts, 12);
})();

const C = {
  ...PAL,
  snow: '#f4f7fc',
  snowShade: '#dfe8f4',
  ice: '#cfeeff',
  iceGlow: '#8fe4ff',
  brick: '#b5463c',
  brickDark: '#8e342e',
  roofGreen: '#3f7f68',
  whiteStone: '#eee8dc',
  goldDome: '#f2c35a',
  charred: '#3b3032',
  logs: '#6e5242',
  ember: '#ff7a3a',
  fire: '#ffb347',
  tentA: '#e8e0cc',
  tentB: '#d2c6aa',
  imperial: '#3a5ea8',
  iron: '#3f434e',
  blueUniform: '#3d5a9c',
  basil: ['#d8473c', '#3f9d5c', '#3f6fc4', '#f2c35a', '#e98a3c', '#7d4fb0', '#2fa8a0', '#c94f8f'],
};

export function buildWinter(heightAt: HeightAt) {
  const pieces: Piece[] = [];
  const markers: Marker[] = [];
  const mk = (m: Marker) => markers.push(m);
  const rng = mulberry32(WINTER.seed + 5);
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
  const lantern = (x: number, z: number, y = heightAt(x, z)) => {
    lamps.add(CYL8, C.iron, T(x, y + 1.3, z, 0, 0.08, 2.6, 0.08));
    glow.add(BOX, C.fire, T(x, y + 2.75, z, 0, 0.3, 0.45, 0.3), false);
  };
  /** A campfire; every fire is a warm spot against the cold. */
  let nWarm = 0;
  const campfire = (b: Batch, x: number, z: number, opts: { y?: number; r?: number; lit?: string; big?: boolean } = {}) => {
    const y = opts.y ?? heightAt(x, z), s = opts.big ? 1.6 : 1;
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      b.add(ROCK, C.rockDark, T(x + Math.cos(a) * 0.9 * s, y + 0.15, z + Math.sin(a) * 0.9 * s, a, 0.35 * s, 0.25 * s, 0.3 * s), false);
    }
    for (let k = 0; k < 3; k++) b.add(CYL6, C.logs, T(x, y + 0.25, z, (k / 3) * Math.PI, 0.12 * s, 1.5 * s, 0.12 * s, Math.PI / 2 - 0.3), false);
    const flame = opts.lit ? new Batch(`Fire_${opts.lit}`, 'M_Emissive') : glow;
    flame.add(new THREE.ConeGeometry(0.55 * s, 1.4 * s, 6), C.fire, T(x, y + 0.9 * s, z), false);
    flame.add(new THREE.ConeGeometry(0.3 * s, 0.9 * s, 5), '#fff1b8', T(x, y + 0.75 * s, z), false);
    if (opts.lit) pieces.push({ name: `Fire_${opts.lit}`, material: 'M_Emissive', batch: flame, userData: { showWhen: opts.lit } });
    mk({ id: `warm_${++nWarm}`, type: 'poi', label: '篝火（取暖）', p: [x, y, z], radius: opts.r ?? 7, requires: opts.lit ? [opts.lit] : undefined });
  };
  /** A soldier's A-frame tent along heading ry. */
  const tent = (b: Batch, x: number, z: number, ry: number, w = 3, d = 4, color = C.tentA) => {
    const y = lowest(x, z, 2);
    b.add(ROOF, color, T(x, y + w * 0.25, z, ry, w * 0.5, d, w * 0.5, 0, Math.PI / 2));
    b.add(CYL6, C.woodDark, T(x + Math.sin(ry) * (d / 2), y + w * 0.45, z + Math.cos(ry) * (d / 2), 0, 0.05, w * 0.9, 0.05), false);
  };
  /** A log house (izba); `burnt` blackens it, leaves the roof open and adds glowing embers. */
  const izba = (b: Batch, x: number, z: number, ry: number, burnt: boolean) => {
    const y = lowest(x, z, 3), w = range(rng, 6, 8), d = range(rng, 5, 7), h = range(rng, 3.2, 4.2);
    b.add(BOX, burnt ? C.charred : C.logs, T(x, y + h / 2, z, ry, w, h, d));
    for (let k = 1; k < 5; k++) b.add(BOX, burnt ? '#2a2224' : C.woodDark, T(x, y + (h * k) / 5, z, ry, w + 0.1, 0.08, d + 0.1), false);
    if (!burnt) {
      b.add(ROOF, C.snow, T(x, y + h + 1.2, z, ry, 2.4, w + 0.6, (d + 1) / 1.732, 0, Math.PI / 2));
      glow.add(BOX, C.fire, T(x + Math.sin(ry) * (d / 2 + 0.04), y + 1.6, z + Math.cos(ry) * (d / 2 + 0.04), ry, 0.9, 0.7, 0.05), false);
    } else {
      for (let k = 0; k < 3; k++) {
        const ex = x + range(rng, -w / 3, w / 3), ez = z + range(rng, -d / 3, d / 3);
        glow.add(BALL, C.ember, T(ex, y + h + 0.1, ez, range(rng, 0, 6), range(rng, 0.4, 0.8), 0.25, range(rng, 0.4, 0.8)), false);
      }
      b.add(BOX, C.charred, T(x - Math.cos(ry) * w * 0.3, y + h + 0.8, z + Math.sin(ry) * w * 0.3, ry, 0.25, 1.6, d * 0.6, 0.4), false);
    }
  };
  /** Onion dome on a drum. */
  const dome = (b: Batch, x: number, y: number, z: number, r: number, drumH: number, color: string, drum = C.whiteStone) => {
    b.add(CYL16, drum, T(x, y + drumH / 2, z, 0, r * 0.75, drumH, r * 0.75));
    b.add(ONION, color, T(x, y + drumH, z, 0, r, r, r), false);
    b.add(CYL6, C.goldDome, T(x, y + drumH + r * 2.6, z, 0, 0.06, r * 1.2, 0.06), false);
    b.add(BOX, C.goldDome, T(x, y + drumH + r * 2.8, z, 0, r * 0.5, 0.08, 0.08), false);
  };

  // ───────────────────────── Berezina crossing (arrival from the ice seam) ─────────────────────────
  {
    const b = new Batch('Crossing');
    // Eblé's pontoon bridges: trestles on the ice, a plank deck; the downstream one is broken mid-river
    for (const [i, z] of CROSSING.bridges.entries()) {
      const x0 = CROSSING.c[0] - 34, x1 = CROSSING.c[0] + 28, y = ICE_Y + 1.3;
      for (let x = x0; x < x1; x += 4) {
        if (i === 0 && Math.abs(x - CROSSING.c[0]) < 6) continue;
        b.box(x + 2, y - 0.25, z, 4.05, 0.25, 4.2, C.wood);
        for (const s of [-1.8, 1.8]) b.add(CYL6, C.woodDark, T(x + 2, (y + ICE_Y) / 2, z + s, 0, 0.14, y - ICE_Y, 0.14), false);
        b.add(BOX, C.snow, T(x + 2, y + 0.02, z, 0, 3.6, 0.05, 3.6), false);
      }
      for (const [x, dir] of [[x0, 1], [x1, -1]] as const) {
        const g = heightAt(x - dir * 8, z);
        b.ramp(x - dir * 4, z, g, y, 8, 4.2, C.wood, dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      }
    }
    // abandoned wagons, a cannon and chests on the ice
    for (const [x, z, ry] of [[-14, 244, 0.4], [10, 238, -0.3], [-2, 284, 1.2], [18, 300, 0.2], [-20, 296, -0.8]] as const) {
      b.add(BOX, C.wood, T(x, ICE_Y + 0.9, z, ry, 2.2, 0.9, 3.6));
      b.add(BOX, C.snow, T(x, ICE_Y + 1.4, z, ry, 2.0, 0.15, 3.3), false);
      for (const s of [-1, 1]) for (const u of [-1.2, 1.2]) b.add(CYL16, C.woodDark, T(x + Math.cos(ry) * s * 1.2 + Math.sin(ry) * u, ICE_Y + 0.55, z - Math.sin(ry) * s * 1.2 + Math.cos(ry) * u, ry, 0.55, 0.12, 0.55, 0, Math.PI / 2), false);
    }
    b.add(BOX, C.woodDark, T(24, ICE_Y + 0.4, 252, 0.5, 1.4, 0.6, 2.2));
    b.add(CYL8, C.iron, T(24.6, ICE_Y + 0.9, 251, 0.5, 0.3, 2.6, 0.3, Math.PI / 2 - 0.1), false);
    campfire(b, 34, 278, { big: true, r: 9 });
    lantern(26, 300);
    pieces.push({ name: 'Crossing', material: 'M_Toon', batch: b, outline: true });
    mk({ id: 'spawn_p1', type: 'spawn', label: '玩家1出生点（北方冰海断面）', p: [0, ICE_Y, 330] });
    mk({ id: 'spawn_p2', type: 'spawn', label: '玩家2出生点（北方冰海断面）', p: [3, ICE_Y, 330] });
    mk({ id: 'disc_berezina', type: 'discovery', label: '断桥', p: [CROSSING.c[0], ICE_Y, CROSSING.bridges[0]], radius: 6, note: '1812 年 11 月，大军在这里渡过了别列津纳河' });
  }

  // ───────────────────────── Grande Armée bivouac: tents, fires, Napoleon's tent ─────────────────────────
  {
    const b = new Batch('Bivouac');
    const [bx, bz] = BIVOUAC.c;
    for (let row = 0; row < 4; row++)
      for (let k = 0; k < 6; k++) {
        const x = bx - 40 + k * 13 + (row % 2) * 6, z = bz + 8 + row * 11;
        if (Math.hypot(x - IMPERIAL_TENT.c[0], z - IMPERIAL_TENT.c[1]) < 16) continue;
        tent(b, x, z, Math.PI / 2 + range(rng, -0.15, 0.15), 3.2, 4.2, k % 3 ? C.tentA : C.tentB);
      }
    for (const [x, z] of [[-205, 176], [-170, 186], [-222, 200], [-186, 208], [-150, 168]] as const) campfire(b, x, z);
    // Napoleon's tent: striped blue and white, an eagle standard at the door, a map table inside
    {
      const [tx, tz] = IMPERIAL_TENT.c, w = IMPERIAL_TENT.w, d = IMPERIAL_TENT.d, y = BIVOUAC.y;
      for (const s of [-1, 1]) b.box(tx + s * (w / 2), y, tz, 0.3, 3.2, d, C.imperial);
      b.box(tx, y, tz - d / 2, w, 3.2, 0.3, C.imperial);
      for (const s of [-1, 1]) b.box(tx + s * (w / 2 - 2), y, tz + d / 2, 4, 3.2, 0.3, C.imperial); // door in the middle
      b.add(ROOF, C.tentA, T(tx, y + 4.2, tz, 0, 2.0, w + 0.6, (d + 0.8) / 1.732, 0, Math.PI / 2), false);
      for (let k = -2; k <= 2; k++) b.add(BOX, C.white, T(tx + k * 2.4, y + 1.6, tz - d / 2 - 0.02, 0, 0.8, 3.2, 0.04), false);
      b.box(tx, y, tz - 1.5, 3.6, 0.9, 1.8, C.woodDark);
      b.add(BOX, C.canvas, T(tx, y + 0.95, tz - 1.5, 0.1, 3.0, 0.02, 1.4), false);
      const [sx, sz] = [tx + 3, tz + d / 2 + 1.5];
      b.add(CYL8, C.woodDark, T(sx, y + 1.8, sz, 0, 0.06, 3.6, 0.06), false);
      b.add(BOX, C.goldDome, T(sx, y + 3.8, sz, 0, 0.5, 0.45, 0.2), false);
      b.add(BOX, C.imperial, T(sx + 0.55, y + 3.0, sz, 0, 1.0, 0.8, 0.03), false);
      campfire(b, tx - 4, tz + d / 2 + 4, { r: 9 });
      glow.add(BOX, C.fire, T(tx, y + 2.6, tz, 0, 0.3, 0.4, 0.3), false);
      mk({ id: 'warm_tent', type: 'poi', label: '皇帝帐篷（取暖）', p: [tx, y, tz], radius: 9 });
      mk({ id: 'napoleon_meet', type: 'interact', label: '拿破仑（皇帝帐篷）', p: [tx, y, tz + 0.5], radius: 3.4, note: '皇帝说：点亮冬之核，我的大军就能回家' });
      mk({ id: 'napoleon_contract', type: 'interact', label: '与拿破仑缔结契约', p: [tx + 3, y, tz + 0.5], radius: 3, requires: ['winter_core'], note: 'Rider 职阶从者 · 法兰西皇帝' });
    }
    // artillery park and supply wagons
    for (let k = 0; k < 4; k++) {
      const x = bx + 34, z = bz - 20 + k * 7, y = heightAt(x, z);
      b.add(BOX, C.woodDark, T(x, y + 0.4, z, Math.PI / 2, 1.3, 0.6, 2.2));
      b.add(CYL8, '#6a6f78', T(x - 1.0, y + 0.95, z, Math.PI / 2, 0.28, 2.4, 0.28, 0, Math.PI / 2 - 0.15), false);
      b.add(BOX, C.snow, T(x, y + 0.75, z, Math.PI / 2, 1.2, 0.08, 2.0), false);
    }
    pieces.push({ name: 'Bivouac', material: 'M_Toon', batch: b, outline: true });
    mk({ id: 'disc_old_guard', type: 'discovery', label: '老近卫军的营火', p: [-222, heightAt(-222, 200), 200], radius: 5, note: '「近卫军可以死，但绝不投降」' });
    for (const [dx, dz] of [[40, -30], [-50, -20]]) mk({ id: `enemy_bivouac_${dx}`, type: 'enemy', label: '冰封幽兵（占位）', p: [bx + dx, heightAt(bx + dx, bz + dz), bz + dz] });
  }

  // ───────────────────────── Beacon snowfield: three watch fires and the cairn of eagles ─────────────────────────
  {
    const b = new Batch('Snowfield');
    BEACONS.forEach(([x, z], i) => {
      const id = `beacon_${i + 1}`, y = lowest(x, z, 3);
      b.add(CYL8, C.rockDark, T(x, y + 0.6, z, 0, 2.6, 1.2, 2.6));
      for (let k = 0; k < 8; k++) b.add(CYL6, C.logs, T(x, y + 1.9, z, (k / 8) * Math.PI, 0.18, 3.2, 0.18, 0.5), false);
      const unlit = new Batch(`Beacon_Frost_${i + 1}`, 'M_Emissive');
      unlit.add(CRYSTAL, C.iceGlow, T(x, y + 2.4, z, 0.3, 0.5, 0.9, 0.5), false);
      pieces.push({ name: `Beacon_Frost_${i + 1}`, material: 'M_Emissive', batch: unlit, userData: { hideWhen: id, bob: true } });
      campfire(b, x, z, { y: y + 1.2, lit: id, big: true, r: 14 });
      mk({ id, type: 'interact', label: `烽火 ${i + 1}`, p: [x, y + 1.2, z], radius: 3.6 });
      lantern(x + 4, z + 3);
    });
    // the cairn: lost eagle standards planted in a ring of stones
    const [ex, ez] = EAGLE.c, y = heightAt(ex, ez);
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2;
      b.add(ROCK, C.rock, T(ex + Math.cos(a) * 4.5, y + 0.4, ez + Math.sin(a) * 4.5, a, 0.9, 0.7, 0.8));
    }
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + 0.3, x = ex + Math.cos(a) * 2.2, z = ez + Math.sin(a) * 2.2;
      b.add(CYL6, C.woodDark, T(x, y + 1.6, z, 0, 0.05, 3.2, 0.05, range(rng, -0.25, 0.25), range(rng, -0.25, 0.25)), false);
      b.add(BOX, C.goldDome, T(x, y + 3.3, z, a, 0.4, 0.35, 0.15), false);
      b.add(BOX, ['#3d5a9c', '#ece9e1', '#c8443c'][k % 3], T(x + 0.4, y + 2.7, z, a, 0.8, 0.6, 0.03), false);
    }
    const shard = new Batch('Shard_eagle', 'M_Emissive');
    shard.add(CRYSTAL, C.goldDome, T(ex, y + 2.0, ez, 0.4, 0.4, 0.8, 0.4), false);
    const beacons = BEACONS.map((_, i) => `beacon_${i + 1}`);
    pieces.push({ name: 'Shard_eagle', material: 'M_Emissive', batch: shard, userData: { showWhen: beacons, hideWhen: 'shard_eagle', bob: true } });
    mk({ id: 'shard_eagle', type: 'interact', label: '冬之碎片·鹰旗', p: [ex, y, ez], radius: 3.4, requires: beacons });
    // a column frozen where it halted: snow-covered figures in a line
    for (let k = 0; k < 12; k++) {
      const x = -300 + k * 3.2, z = 140 + Math.sin(k * 0.7) * 1.5, g = heightAt(x, z);
      b.add(CYL8, C.snowShade, T(x, g + 0.85, z, 0, 0.32, 1.7, 0.32));
      b.add(BALL, C.snow, T(x, g + 1.85, z, k, 0.28, 0.3, 0.28), false);
    }
    pieces.push({ name: 'Snowfield', material: 'M_Toon', batch: b, outline: true });
    mk({ id: 'disc_frozen_column', type: 'discovery', label: '冻住的行军队列', p: [-282, heightAt(-282, 140), 140], radius: 6, note: '他们停下来休息，就再也没有起来' });
    mk({ id: 'disc_eagles', type: 'discovery', label: '鹰旗冢', p: [ex, y, ez], radius: 7, note: '每一面军旗都属于一支没能回家的团' });
  }

  // ───────────────────────── Burning Moscow: the burnt quarter around the hill ─────────────────────────
  const inKremlin = (x: number, z: number, pad = 0) => Math.hypot(x - KREMLIN.c[0], z - KREMLIN.c[1]) < KREMLIN.r + pad;
  const onSquare = (x: number, z: number, pad = 0) => Math.abs(x - REDSQ.c[0]) < REDSQ.w / 2 + pad && Math.abs(z - REDSQ.c[1]) < REDSQ.d / 2 + pad;
  const onPath = (x: number, z: number, pad: number) => PATHS.some((p) => distToPolyline(x, z, p) < pad);
  {
    const b = new Batch('Moscow');
    let n = 0, w = 0;
    for (let i = 0; i < 400 && n < 46; i++) {
      const x = range(rng, -80, 150), z = range(rng, -290, -110);
      if (inKremlin(x, z, 14) || onSquare(x, z, 12) || onPath(x, z, 7) || Math.hypot(x - BASIL.c[0], z - BASIL.c[1]) < 24) continue;
      if (Math.abs(heightAt(x, z) - CITY.y) > 3 || slope(x, z) > 0.25) continue;
      const burnt = rng() < 0.7;
      izba(b, x, z, range(rng, -0.3, 0.3) + (rng() < 0.5 ? 0 : Math.PI / 2), burnt);
      if (burnt && w < 6 && rng() < 0.35) { mk({ id: `warm_ember_${++w}`, type: 'poi', label: '余烬（取暖）', p: [x, heightAt(x, z), z], radius: 8 }); }
      n++;
    }
    for (const [x, z] of [[40, -100], [30, -130], [60, -130], [70, -160]] as const) lantern(x + 3, z);
    pieces.push({ name: 'Moscow', material: 'M_Toon', batch: b, outline: true });
    mk({ id: 'disc_moscow_fire', type: 'discovery', label: '大火之后', p: [40, heightAt(40, -112), -112], radius: 7, note: '1812 年 9 月，莫斯科烧了整整六天' });
    for (const [x, z] of [[20, -120], [70, -150], [-60, -150]]) mk({ id: `enemy_moscow_${x}`, type: 'enemy', label: '冰封幽兵（占位）', p: [x, heightAt(x, z), z] });
  }

  // ───────────────────────── The Kremlin: walls, towers, cathedrals, the bell tower scaffold ─────────────────────────
  {
    const b = new Batch('Kremlin');
    const [kx, kz] = KREMLIN.c, R = KREMLIN.r, y = CITY.y, wallH = 8, N = 16;
    const gates = [Math.PI / 2, 0]; // south gate (towards the outskirts) and the Spasskaya gate (Red Square)
    const near = (a: number, g: number, w: number) => Math.abs(Math.atan2(Math.sin(a - g), Math.cos(a - g))) < w;
    for (let k = 0; k < N; k++) {
      const a0 = (k / N) * Math.PI * 2, a1 = ((k + 1) / N) * Math.PI * 2;
      const p0: V2 = [kx + Math.cos(a0) * R, kz + Math.sin(a0) * R], p1: V2 = [kx + Math.cos(a1) * R, kz + Math.sin(a1) * R];
      const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), ry = Math.atan2(p1[0] - p0[0], p1[1] - p0[1]);
      const n = Math.ceil(len / 4);
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n, x = p0[0] + (p1[0] - p0[0]) * t, z = p0[1] + (p1[1] - p0[1]) * t;
        const a = Math.atan2(z - kz, x - kx);
        if (gates.some((g) => near(a, g, 0.075))) continue;
        const g = Math.min(y, lowest(x, z, 1.5));
        b.add(BOX, C.brick, T(x, (g - 2 + y + wallH) / 2, z, ry, 2.4, y + wallH - g + 2, len / n + 0.3));
        // swallowtail merlons
        b.add(BOX, C.brickDark, T(x, y + wallH + 0.6, z, ry, 2.4, 1.2, (len / n) * 0.45), false);
      }
      // towers at every other vertex (not where a gate opens)
      if (k % 2 === 0 && !gates.some((g) => near(a0, g, 0.2))) {
        const [tx, tz] = p0;
        b.add(BOX, C.brick, T(tx, y + (wallH + 6) / 2 - 1, tz, a0, 6, wallH + 8, 6));
        b.add(CONE4, C.roofGreen, T(tx, y + wallH + 9.5, tz, a0, 4.3, 7, 4.3), false);
        b.add(CYL6, C.goldDome, T(tx, y + wallH + 14, tz, 0, 0.08, 2, 0.08), false);
      }
    }
    // gate towers: the Spasskaya with its clock, and the south gate
    for (const g of gates) {
      const gx = kx + Math.cos(g) * R, gz = kz + Math.sin(g) * R, spass = g === 0;
      const H = spass ? 26 : 18;
      for (const s of [-1, 1]) {
        const ox = gx - Math.sin(g) * s * 4.2, oz = gz + Math.cos(g) * s * 4.2;
        b.add(BOX, C.brick, T(ox, y + H / 2 - 1, oz, -g, 6, H + 2, 3.6));
      }
      b.add(BOX, C.brick, T(gx, y + H - 3, gz, -g, 6, 6, 12)); // over the arch (clear below y + H - 6)
      b.add(CONE4, C.roofGreen, T(gx, y + H + 4, gz, -g, 4.8, 8, 4.8), false);
      if (spass) {
        glow.add(CYL16, '#fff4d6', T(gx + Math.cos(g) * 2.45, y + H - 2, gz, 0, 1.4, 0.1, 1.4, 0, Math.PI / 2), false);
        b.add(BOX, C.whiteStone, T(gx, y + H + 9, gz, -g, 2.4, 3, 2.4), false);
        b.add(CONE4, C.roofGreen, T(gx, y + H + 13, gz, -g, 2.0, 6, 2.0), false);
        glow.add(CRYSTAL, '#ff5a4a', T(gx, y + H + 16.6, gz, 0, 0.7, 0.9, 0.25), false);
      }
    }
    // Assumption Cathedral (five gold domes) and the Archangel Cathedral
    for (const [cx, cz, w, d, gold] of [[22, -192, 18, 14, true], [24, -232, 14, 12, false]] as const) {
      b.box(cx, y, cz, w, 11, d, C.whiteStone);
      b.add(BOX, C.whiteStone, T(cx, y + 11.4, cz, 0, w - 1, 0.8, d - 1), false);
      dome(b, cx, y + 11.8, cz, 2.6, 4, gold ? C.goldDome : '#c9ced8');
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) dome(b, cx + sx * (w / 2 - 3), y + 11.8, cz + sz * (d / 2 - 3), 1.6, 2.6, gold ? C.goldDome : '#c9ced8');
    }
    // the palace along the west side
    b.box(-30, y, -232, 14, 12, 22, '#e8d9b8');
    b.add(BOX, C.roofGreen, T(-30, y + 12.4, -232, 0, 14.4, 0.8, 22.4), false);
    // Tsar Cannon and the Tsar Bell
    b.add(BOX, '#7a7466', T(-30, y + 0.7, -186, 0.3, 2.2, 1.4, 4.2));
    b.add(CYL16, '#7d7a6c', T(-30, y + 1.9, -186, 0.3, 0.9, 5.4, 0.9, Math.PI / 2), false);
    for (let k = 0; k < 3; k++) b.add(BALL, '#5f5c55', T(-27 + k * 1.1, y + 0.5, -181, k, 0.5, 0.5, 0.5));
    b.add(new THREE.CylinderGeometry(1.6, 2.6, 4, 16), '#9c8a62', T(10, y + 2.0, -246), true);
    b.add(BOX, '#9c8a62', T(11.8, y + 0.5, -244.5, 0.5, 1.4, 1.0, 0.9), false); // the broken-off piece
    mk({ id: 'disc_tsar_bell', type: 'discovery', label: '沙皇钟', p: [10, y, -242], radius: 4, note: '世界上最大的钟，从来没有响过' });
    mk({ id: 'disc_tsar_cannon', type: 'discovery', label: '沙皇炮', p: [-30, y, -182], radius: 4, note: '世界上最大的炮，从来没有开过火' });

    // Ivan the Great bell tower: white octagonal tiers; scaffolding switchbacks up its south face
    const [bx, bz] = BELL.c;
    const tiers: [number, number][] = [[6.5, 12], [5.5, 10], [4.5, 8], [3.6, 7]];
    let ty = y;
    for (const [r, h] of tiers) {
      b.add(new THREE.CylinderGeometry(r * 0.94, r, h, 8), C.whiteStone, T(bx, ty + h / 2, bz, Math.PI / 8));
      b.add(new THREE.CylinderGeometry(r + 0.3, r + 0.3, 0.6, 8), '#d8cdb8', T(bx, ty + h - 0.1, bz, Math.PI / 8), false);
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        b.add(BOX, '#3b4256', T(bx + Math.cos(a) * r * 0.93, ty + h * 0.6, bz + Math.sin(a) * r * 0.93, -a + Math.PI / 2, 1.2, h * 0.4, 0.1), false);
      }
      ty += h;
    }
    dome(b, bx, ty, bz, 3.0, 2.5, C.goldDome);
    const bellTop = y + 30; // floor of the third tier's gallery: the belfry
    b.add(new THREE.CylinderGeometry(0.9, 1.6, 2.2, 16), '#b8894a', T(bx, bellTop + 3.2, bz + 2.4), false);
    // scaffold: two lanes of flights along x, landings at both ends, 3 m per flight, rails outside
    const zs = bz + 8.0, L = 10, rise = 3, flights = 10;
    const lane = (k: number) => zs + (k % 2) * 2.6;
    for (let k = 0; k < flights; k++) {
      const dir = k % 2 === 0 ? 1 : -1, y0 = y + k * rise;
      b.ramp(bx, lane(k), y0, y0 + rise, L, 2.2, C.wood, dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      // rail on the outer side of the outer lane and between the lanes on the upper flights
      if (k % 2 === 1) b.add(BOX, C.woodDark, T(bx, y0 + rise / 2 + 1.0, lane(k) + 1.2, Math.PI / 2, 0.12, 1.0, Math.hypot(L, rise), Math.atan2(rise, L) * dir), true);
    }
    for (let k = 1; k <= flights; k++) {
      const end = k % 2 === 1 ? 1 : -1, ly = y + k * rise;
      const lx = bx + end * (L / 2 + 1.2);
      b.box(lx, ly - 0.3, zs + 1.3, 2.4, 0.3, 5.0, C.wood);
      // the belfry deck runs back over the outer lane only, so the last flight never hits its underside
      if (k === flights) b.box(bx - 1.2, ly - 0.3, zs, L + 2.4, 0.3, 2.4, C.wood);
      b.add(BOX, C.woodDark, T(lx, ly + 0.5, zs + 3.95, 0, 2.4, 1.0, 0.12)); // outer rail at the landing
    }
    b.box(bx - (L / 2 + 1.2), y - 0.3, zs + 1.3, 2.4, 0.3, 5.0, C.wood); // ground landing
    for (let k = 0; k <= flights; k += 2)
      for (const x of [bx - L / 2 - 2.4, bx + L / 2 + 2.4]) for (const z of [zs - 1.2, zs + 3.8])
        b.add(CYL6, C.woodDark, T(x, y + (k * rise) / 2 + 0.1, z, 0, 0.1, k * rise + 0.2, 0.1), false);
    const top: [number, number, number] = [bx - 2, bellTop, zs];
    const shard = new Batch('Shard_bell', 'M_Emissive');
    shard.add(CRYSTAL, C.iceGlow, T(top[0], top[1] + 1.8, top[2], 0.4, 0.4, 0.8, 0.4), false);
    pieces.push({ name: 'Shard_bell', material: 'M_Emissive', batch: shard, userData: { hideWhen: 'shard_bell', bob: true } });
    mk({ id: 'shard_bell', type: 'interact', label: '冬之碎片·钟声', p: top, radius: 3.4 });
    mk({ id: 'disc_bell_view', type: 'discovery', label: '钟楼之上', p: [bx + 4, bellTop, zs], radius: 3, note: '整座燃烧的城市都在脚下' });
    pieces.push({ name: 'Kremlin', material: 'M_Toon', batch: b, outline: true });
    for (const [dx, dz] of [[20, 20], [-24, 10]]) mk({ id: `enemy_kremlin_${dx}`, type: 'enemy', label: '冰封近卫（占位）', p: [kx + dx, y, kz + dz] });
  }

  // ───────────────────────── Red Square and the cathedral: the winter core ─────────────────────────
  {
    const b = new Batch('Red_Square');
    const y = CITY.y, [qx, qz] = BASIL.c;
    // St Basil's: a central tent spire ringed by eight towers with patterned onion domes
    b.add(new THREE.CylinderGeometry(4.2, 4.8, 18, 8), '#c9573f', T(qx, y + 9, qz, Math.PI / 8));
    b.add(new THREE.ConeGeometry(3.4, 10, 8), '#e7c46a', T(qx, y + 23, qz, Math.PI / 8), false);
    dome(b, qx, y + 27.5, qz, 1.1, 1, C.goldDome);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2, r = k % 2 ? 9 : 10.5, x = qx + Math.cos(a) * r, z = qz + Math.sin(a) * r;
      const h = k % 2 ? 10 : 13;
      b.add(new THREE.CylinderGeometry(2.4, 2.6, h, 8), k % 2 ? '#d86a4a' : '#e8d3b0', T(x, y + h / 2, z, Math.PI / 8));
      dome(b, x, y + h, z, k % 2 ? 2.0 : 2.5, 1.2, C.basil[k]);
    }
    b.box(qx, y, qz - 2, 26, 2.4, 22, '#c9573f'); // gallery base linking the towers
    // Lobnoye Mesto and the Minin–Pozharsky plinth
    b.add(CYL16, C.whiteStone, T(qx + 14, y + 0.6, qz + 22, 0, 4, 1.2, 4));
    b.box(qx - 10, y, qz + 30, 3, 3, 5, '#9c8a62');
    // the winter core in front of the cathedral
    const [cx, cz] = CORE.c;
    b.add(CYL16, '#7f8fa8', T(cx, y + 0.35, cz, 0, 2.2, 0.7, 2.2));
    const core = new Batch('Winter_Core_Dark', 'M_Emissive');
    core.add(SPHERE, '#7fb8e8', T(cx, y + 3, cz, 0, 1.4, 1.4, 1.4), false);
    for (const a of [0, 1.1, 2.2]) core.add(new THREE.TorusGeometry(2, 0.1, 6, 40), C.iceGlow, T(cx, y + 3, cz, a, 1, 1, 1, Math.PI / 2 - 0.4), false);
    pieces.push({ name: 'Winter_Core_Dark', material: 'M_Emissive', batch: core, userData: { hideWhen: 'winter_core', bob: true } });
    const lit = new Batch('Winter_Core', 'M_Emissive');
    lit.add(SPHERE, '#ffd27a', T(cx, y + 3, cz, 0, 1.6, 1.6, 1.6), false);
    pieces.push({ name: 'Winter_Core', material: 'M_Emissive', batch: lit, userData: { showWhen: 'winter_core', bob: true } });
    const beam = new Batch('Winter_Core_Beam', 'M_Beam');
    beam.add(new THREE.CylinderGeometry(1.2, 2.0, 160, 20, 1, true), '#ffd27a', T(cx, y + 80, cz), false);
    pieces.push({ name: 'Winter_Core_Beam', material: 'M_Beam', batch: beam, userData: { showWhen: 'winter_core' } });
    // frozen braziers around the square: warm once the core is lit
    for (const [dx, dz] of [[-16, -30], [16, -30], [-16, 20], [16, 20]]) {
      const x = REDSQ.c[0] + dx, z = REDSQ.c[1] + dz;
      b.add(CYL8, C.iron, T(x, y + 0.8, z, 0, 0.5, 1.6, 0.5));
      glow.add(CRYSTAL, C.iceGlow, T(x, y + 1.9, z, 0, 0.5, 0.6, 0.5), false);
    }
    mk({ id: 'winter_core', type: 'interact', label: '冬之核', p: [cx, y, cz], radius: 3.6, requires: ['shard_eagle', 'shard_bell', 'shard_frost'] });
    mk({ id: 'boss_winter_warden', type: 'enemy', label: '执冬者（Boss）', p: [REDSQ.c[0], y, REDSQ.c[1] - 4] });
    mk({ id: 'disc_basil', type: 'discovery', label: '圣瓦西里大教堂', p: [qx, y, qz + 14], radius: 6, note: '九座穹顶，没有一座颜色相同' });
    pieces.push({ name: 'Red_Square', material: 'M_Toon', batch: b, outline: true });
  }

  // ───────────────────────── Frozen gorge: three frost seals, the ice wall, the cavern ─────────────────────────
  {
    const b = new Batch('Gorge');
    const [gx, gz] = ICE_GATE.c, ry = ICE_GATE.ry;
    // the ice wall across the river (opens once all three seals are shattered)
    const seals = ['frost_seal_1', 'frost_seal_2', 'frost_seal_3'];
    const wall = new Batch('Ice_Gate', 'M_Emissive');
    const across: V2 = [Math.cos(ry), -Math.sin(ry)];
    for (let k = -6; k <= 6; k++) {
      const x = gx + across[0] * k * 4, z = gz + across[1] * k * 4, h = 16 - Math.abs(k) * 0.6 + range(rng, -1, 1);
      wall.add(CRYSTAL, k % 2 ? C.ice : '#b3e6fb', T(x, ICE_Y + h / 2 - 1, z, ry + range(rng, -0.3, 0.3), 3.2, h / 1.8, 3.0), true);
    }
    wall.addCol(BOX, T(gx, ICE_Y + 20, gz, ry, 80, 40, 2)); // a solid sheet behind the crystals, wall to wall
    pieces.push({ name: 'Ice_Gate', material: 'M_Emissive', batch: wall, dynamic: true, userData: { opensWhen: seals } });
    // the seals: glowing frost sigils high on the gorge walls and on the ice wall itself, shot from the river
    const sealAt: [number, number, number][] = [
      [gx + across[0] * (RIVER_W + 9) + Math.sin(ry) * 8, 0, gz + across[1] * (RIVER_W + 9) + Math.cos(ry) * 8],
      [gx - across[0] * (RIVER_W + 9) + Math.sin(ry) * 8, 0, gz - across[1] * (RIVER_W + 9) + Math.cos(ry) * 8],
      [gx + Math.sin(ry) * 1.6, ICE_Y + 15, gz + Math.cos(ry) * 1.6],
    ];
    sealAt.forEach(([x, yy, z], i) => {
      const y = i < 2 ? heightAt(x, z) + 2.5 : yy;
      const t = new Batch(`TGT_frost_seal_${i + 1}`, 'M_Target');
      t.add(new THREE.TorusGeometry(1.4, 0.22, 6, 18), C.iceGlow, T(x, y, z, ry, 1, 1, 1), true);
      t.add(CRYSTAL, '#e8fbff', T(x, y, z, ry, 0.6, 0.9, 0.3), true);
      pieces.push({ name: `TGT_frost_seal_${i + 1}`, material: 'M_Target', batch: t, dynamic: true, userData: { target: `frost_seal_${i + 1}` } });
      mk({ id: `frost_seal_${i + 1}`, type: 'objective', label: `冰封印 ${i + 1}`, p: [x, y, z] });
    });
    // icicles and frozen falls down the gorge walls
    for (let i = 0; i < 40; i++) {
      const t = rng(), k = 6 + t * 3, a = Math.floor(k), f = k - a;
      if (a >= RIVER.length - 1) continue;
      const [x0, z0] = RIVER[a], [x1, z1] = RIVER[a + 1], dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz);
      const side = rng() < 0.5 ? -1 : 1, off = RIVER_W + range(rng, 3, 8);
      const x = x0 + dx * f + (dz / L) * off * side, z = z0 + dz * f - (dx / L) * off * side, y = heightAt(x, z);
      const h = range(rng, 3, 9);
      b.add(new THREE.ConeGeometry(0.7, 1, 5), '#d9f2ff', T(x, y - h / 2 + 0.5, z, rng() * 6, range(rng, 0.6, 1.4), h, range(rng, 0.6, 1.4), Math.PI), false);
    }
    // the cavern: a ring of great rocks with a mouth towards the river and a roof of ice overhead
    const [cx, cz] = CAVERN.c, mouth = Math.atan2(RIVER[RIVER.length - 2][1] - cz, RIVER[RIVER.length - 2][0] - cx);
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2;
      if (Math.abs(Math.atan2(Math.sin(a - mouth), Math.cos(a - mouth))) < 0.45) continue;
      const x = cx + Math.cos(a) * (CAVERN.r + 2), z = cz + Math.sin(a) * (CAVERN.r + 2);
      b.add(ROCK, C.rockDark, T(x, ICE_Y + 6, z, a, 7, 12, 6));
    }
    b.add(new THREE.SphereGeometry(CAVERN.r + 6, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2.6), '#9fb6cf', T(cx, ICE_Y + 4, cz, 0, 1, 0.55, 1), false);
    for (let k = 0; k < 9; k++) {
      const a = mouth + Math.PI + (k - 4) * 0.22, x = cx + Math.cos(a) * (CAVERN.r - 4), z = cz + Math.sin(a) * (CAVERN.r - 4);
      glow.add(CYL6, '#bdf0ff', T(x, ICE_Y + 7, z, a, 1.1, 14, 1.1), false); // the frozen falls at the back
    }
    for (let k = 0; k < 10; k++) {
      const a = rng() * Math.PI * 2, r = range(rng, 6, CAVERN.r - 6);
      glow.add(CRYSTAL, C.iceGlow, T(cx + Math.cos(a) * r, ICE_Y + 0.8, cz + Math.sin(a) * r, a, 0.5, range(rng, 1.2, 2.4), 0.5), false);
    }
    const shard = new Batch('Shard_frost', 'M_Emissive');
    shard.add(CRYSTAL, '#e8fbff', T(cx, ICE_Y + 2.0, cz, 0.4, 0.4, 0.8, 0.4), false);
    pieces.push({ name: 'Shard_frost', material: 'M_Emissive', batch: shard, userData: { hideWhen: 'shard_frost', bob: true } });
    mk({ id: 'shard_frost', type: 'interact', label: '冬之碎片·霜晶', p: [cx, ICE_Y, cz], radius: 3.4, requires: seals });
    mk({ id: 'disc_frozen_falls', type: 'discovery', label: '冻结的瀑布', p: [cx + Math.cos(mouth + Math.PI) * 10, ICE_Y, cz + Math.sin(mouth + Math.PI) * 10], radius: 5, note: '水还没落地就结成了冰' });
    pieces.push({ name: 'Gorge', material: 'M_Toon', batch: b, outline: true });
    for (const [x, z] of [[230, 50], [262, 10]]) mk({ id: `enemy_gorge_${x}`, type: 'enemy', label: '冰晶守卫（占位）', p: [x, ICE_Y, z] });
  }

  // ───────────────────────── Vegetation: snowy firs and bare birches ─────────────────────────
  const blocked = (x: number, z: number) =>
    riverD(x, z) < RIVER_W + 3 || onPath(x, z, 4) || Math.hypot(x - BIVOUAC.c[0], (z - BIVOUAC.c[1]) * 0.9) < 56 ||
    inKremlin(x, z, 10) || onSquare(x, z, 10) || Math.hypot(Math.max(0, Math.abs(x - 30) - 92), Math.max(0, Math.abs(z + 206) - 70)) < 6 ||
    BEACONS.some(([bx, bz]) => Math.hypot(x - bx, z - bz) < 10) || Math.hypot(x - EAGLE.c[0], z - EAGLE.c[1]) < 10 ||
    Math.hypot(x - CAVERN.c[0], z - CAVERN.c[1]) < CAVERN.r + 10 || Math.hypot(x - CROSSING.c[0], z - 260) < 30;
  let nTree = 0;
  for (let i = 0; i < 9000 && nTree < 1500; i++) {
    const x = range(rng, -WINTER.playHalf, WINTER.playHalf), z = range(rng, -WINTER.playHalf, WINTER.playHalf);
    if (blocked(x, z)) continue;
    const y = heightAt(x, z), sl = slope(x, z);
    if (sl > 0.8 || y > 70) continue;
    const n = fbm(x * 0.012, z * 0.012, 3, WINTER.seed + 50);
    const dens = y > 30 ? 0.22 : 0.06 + Math.max(0, n) * 0.5;
    if (rng() > dens) continue;
    const s = range(rng, 0.8, 1.5), ry = rng() * 6;
    nTree++;
    if (rng() < 0.78) {
      const th = 2.4 * s;
      trunks.add(new THREE.CylinderGeometry(0.22, 0.34, 1, 6), C.woodDark, T(x, y + th / 2, z, ry, s, th, s), false);
      conifer(leaves, x, y + th * 0.75, z, s, ['#2f5d4f', '#36695a', '#2a5347'][Math.floor(rng() * 3)], ry);
      // snow resting on the tiers
      for (const [r, yy] of [[1.9, 1.7], [1.4, 3.1], [0.9, 4.4]] as const)
        bushes.add(new THREE.ConeGeometry(1, 0.5, 6), C.snow, T(x, y + th * 0.75 + yy * s, z, ry, r * s, 0.5 * s, r * s), false);
    } else {
      const th = 6 * s;
      trunks.add(new THREE.CylinderGeometry(0.14, 0.22, 1, 6), '#efece4', T(x, y + th / 2, z, ry, s, th, s), false);
      for (let k = 0; k < 4; k++) {
        const a = ry + k * 1.6, bh = th * range(rng, 0.45, 0.85);
        trunks.add(CYL6, '#d9d4c8', T(x + Math.cos(a) * 0.6 * s, y + bh, z + Math.sin(a) * 0.6 * s, -a, 0.05 * s, 1.8 * s, 0.05 * s, 0.6), false);
      }
    }
    trunks.addCol(BOX, T(x, y + 2, z, ry, 0.6 * s, 4, 0.6 * s));
  }
  let nRocks = 0;
  for (let i = 0; i < 2600 && nRocks < 260; i++) {
    const x = range(rng, -WINTER.playHalf, WINTER.playHalf), z = range(rng, -WINTER.playHalf, WINTER.playHalf);
    if (blocked(x, z)) continue;
    const sl = slope(x, z);
    if (rng() > (sl > 0.5 ? 0.45 : 0.04)) continue;
    const s = range(rng, 0.6, sl > 0.5 ? 3.0 : 1.6);
    rocks.add(ROCK, rng() > 0.5 ? C.rock : C.rockDark, T(x, lowest(x, z, s) + s * 0.15, z, range(rng, 0, 6), s * range(rng, 0.9, 1.5), s * range(rng, 0.6, 1.0), s, range(rng, -0.3, 0.3)));
    if (sl < 0.6) bushes.add(BALL, C.snow, T(x, lowest(x, z, s) + s * 0.75, z, 0, s * 0.9, s * 0.25, s * 0.9), false);
    nRocks++;
  }
  // snow drifts
  for (let i = 0; i < 900; i++) {
    const x = range(rng, -WINTER.playHalf, WINTER.playHalf), z = range(rng, -WINTER.playHalf, WINTER.playHalf);
    if (blocked(x, z) || slope(x, z) > 0.3) continue;
    const s = range(rng, 0.8, 2.2);
    bushes.add(BALL, i % 2 ? C.snow : C.snowShade, T(x, heightAt(x, z) + 0.05, z, range(rng, 0, 6), s * 2.2, s * 0.35, s * 1.3), false);
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

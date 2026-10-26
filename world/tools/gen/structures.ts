import * as THREE from 'three';
import { Batch, T, BOX } from './geo.js';
import {
  WORLD, CAMP, STATION, RUIN, TOWER, FALLS, CAVE, ISLAND, BRIDGE, LOG_BRIDGE, RIVER, RIVER_OUT, PATHS,
  CAMPUS, PLAZA, HQ, ARMORY, SUMMON, SEAM_W, SEAM_N, SEAM_E, BAY_N,
  type Marker, type V2,
} from './layout.js';
import { mulberry32, range } from './rng.js';

export const PAL = {
  white: '#ece9e1',
  concrete: '#d6d2c8',
  concreteDark: '#a9a7a3',
  teal: '#3fb6b0',
  orange: '#f08a4b',
  metal: '#6f7a8c',
  metalDark: '#4b5466',
  crate: '#c98b4a',
  wood: '#a8754a',
  woodDark: '#7a5233',
  rock: '#8f95ae',
  rockDark: '#626886',
  gold: '#f4c95d',
  stone: '#c7c2b4',
  moss: '#7fb069',
  glowCyan: '#6ff4ff',
  glowGold: '#ffe08a',
  glowPink: '#ff9ed2',
  canvas: '#f2e6c9',
};

export interface Piece {
  name: string;
  material: string;
  batch: Batch;
  outline?: boolean;
  /** Dynamic collision (kept as its own collision node so the game can toggle it). */
  dynamic?: boolean;
  userData?: Record<string, unknown>;
}

type HeightAt = (x: number, z: number) => number;

const CYL6 = new THREE.CylinderGeometry(1, 1, 1, 8);
const CYL16 = new THREE.CylinderGeometry(1, 1, 1, 20);
const ROCKG = new THREE.DodecahedronGeometry(1, 0);

export function buildStructures(heightAt: HeightAt) {
  const pieces: Piece[] = [];
  const markers: Marker[] = [];
  const mk = (m: Marker) => markers.push(m);
  const glow = new Batch('Glow_Props', 'M_Emissive');
  pieces.push({ name: 'Glow_Props', material: 'M_Emissive', batch: glow });

  // ───────────────────────── Landing Camp ─────────────────────────
  {
    const b = new Batch('Camp');
    const [cx, cz] = CAMP.c, y = CAMP.top;
    b.add(CYL16, PAL.white, T(cx, y + 0.15, cz - 6, 0, 8, 0.5, 8));
    b.add(CYL16, PAL.teal, T(cx, y + 0.2, cz - 6, 0, 6.5, 0.5, 6.5));
    b.add(CYL16, PAL.white, T(cx, y + 0.25, cz - 6, 0, 5, 0.5, 5));
    // dropship hull (crash-landed, tilted)
    b.add(BOX, PAL.white, T(cx + 16, y + 1.6, cz + 9, 0.5, 5, 3.2, 11, 0, 0.12));
    b.add(BOX, PAL.orange, T(cx + 16, y + 3.4, cz + 9, 0.5, 3.6, 0.6, 9, 0, 0.12));
    b.add(BOX, PAL.metal, T(cx + 19.5, y + 1.2, cz + 7.5, 0.5, 4, 0.5, 2.4, 0, 0.5));
    b.add(BOX, PAL.metal, T(cx + 12.5, y + 1.2, cz + 10.5, 0.5, 4, 0.5, 2.4, 0, -0.5));
    // tents (triangular prisms)
    const prism = new THREE.CylinderGeometry(1, 1, 1, 3);
    for (const [tx, tz, r] of [[-13, 4, 0.2], [-16, 12, -0.3], [-6, 16, 0.6]] as const) {
      b.add(prism, PAL.canvas, T(cx + tx, y + 1.1, cz + tz, r, 2.2, 4.2, 2.2, 0, Math.PI / 2));
    }
    // crates + terminal + antenna
    for (const [x, z, s, r] of [[8, -16, 1.2, 0.2], [9.4, -16.2, 1.0, 0.7], [-8, -14, 1.3, 0.1], [-9, -12.5, 0.9, 0.9], [4, 10, 1.4, 0.4]] as const)
      b.box(cx + x, y, cz + z, s, s, s, PAL.crate, r);
    b.box(cx - 13, y, cz - 8, 1.2, 1.4, 0.7, PAL.metal);
    glow.box(cx - 13, y + 1.0, cz - 8.36, 0.9, 0.5, 0.05, PAL.glowCyan, 0, false);
    b.add(CYL6, PAL.metal, T(cx + 22, y + 5, cz - 6, 0, 0.18, 10, 0.18));
    glow.add(new THREE.IcosahedronGeometry(0.6, 0), PAL.glowGold, T(cx + 22, y + 10.4, cz - 6), false);
    pieces.push({ name: 'Camp', material: 'M_Toon', batch: b, outline: true });

    mk({ id: 'spawn_p1', type: 'spawn', label: '玩家1出生点', p: [cx - 2, y, cz - 6] });
    mk({ id: 'spawn_p2', type: 'spawn', label: '玩家2出生点', p: [cx + 2, y, cz - 6] });
    mk({ id: 'camp_terminal', type: 'poi', label: '营地终端（存档点）', p: [cx - 13, y, cz - 8] });

  }

  // ───────────────────────── Old Observatory station (PvE stronghold) ─────────────────────────
  {
    const b = new Batch('Station');
    const { x0, x1, z0, z1, y } = STATION;
    const H = 5, t = 1;
    const wallX = (xa: number, xb: number, z: number) => b.box((xa + xb) / 2, y, z, xb - xa, H, t, PAL.concrete);
    const wallZ = (za: number, zb: number, x: number) => b.box(x, y, (za + zb) / 2, t, H, zb - za, PAL.concrete);
    wallX(x0, -145, z1); wallX(-135, x1, z1); // south, main gate -145..-135
    wallX(x0, -160, z0); wallX(-152, x1, z0); // north, back door -160..-152
    wallZ(z0, z1, x0); // west
    wallZ(z0, -60, x1); wallZ(-48, z1, x1); // east, breach -60..-48
    // teal cap stripe on walls
    for (const [xa, xb, z] of [[x0, -145, z1], [-135, x1, z1], [x0, -160, z0], [-152, x1, z0]] as const)
      b.box((xa + xb) / 2, y + H, z, xb - xa, 0.3, t + 0.2, PAL.teal);
    // breach rubble
    const rng = mulberry32(WORLD.seed + 77);
    for (let i = 0; i < 7; i++)
      b.box(x1 + range(rng, -2, 2), y, range(rng, -59, -49), range(rng, 1, 2.4), range(rng, 0.6, 1.6), range(rng, 1, 2.4), PAL.concreteDark, range(rng, 0, 3));
    // gate frame
    b.box(-146.5, y, z1, 2, 7.5, 2, PAL.white); b.box(-133.5, y, z1, 2, 7.5, 2, PAL.white);
    b.box(-140, y + 7.5, z1, 15, 1.2, 2, PAL.orange);

    // main building (2 levels: interior + roof)
    const bx0 = -161, bx1 = -135, bz0 = -63, bz1 = -47, bh = 4.5, bt = 0.6;
    b.box((bx0 - 151) / 2 + 0, y, bz1, -151 - bx0, bh, bt, PAL.white); // south-left
    b.box((-147 + bx1) / 2, y, bz1, bx1 + 147, bh, bt, PAL.white); // south-right (door -151..-147)
    b.box(-149, y + 3.2, bz1, 4, bh - 3.2, bt, PAL.white); // lintel over door
    b.box((bx0 + bx1) / 2, y, bz0, bx1 - bx0, bh, bt, PAL.white); // north
    b.box(bx0, y, (bz0 + bz1) / 2, bt, bh, bz1 - bz0, PAL.white); // west
    b.box(bx1, y, (bz0 - 57) / 2, bt, bh, -57 - bz0, PAL.white); // east lower (door -57..-53)
    b.box(bx1, y, (-53 + bz1) / 2, bt, bh, bz1 + 53, PAL.white);
    b.box(bx1, y + 3.2, -55, bt, bh - 3.2, 4, PAL.white);
    b.box((bx0 + bx1) / 2, y + bh, (bz0 + bz1) / 2, bx1 - bx0 + 0.6, 0.4, bz1 - bz0 + 0.6, PAL.teal); // roof slab
    const ry = y + bh + 0.4;
    // roof parapets (cover for the high-ground fight); gap at NW corner for the ramp landing
    b.box((bx0 + bx1) / 2, ry, bz1, bx1 - bx0, 1, 0.4, PAL.concrete);
    b.box((-157 + bx1) / 2, ry, bz0, bx1 + 157, 1, 0.4, PAL.concrete);
    b.box(bx1, ry, (bz0 + bz1) / 2, 0.4, 1, bz1 - bz0, PAL.concrete);
    b.box(bx0, ry, (-57 + bz1) / 2, 0.4, 1, bz1 + 57, PAL.concrete);
    b.ramp(-162.6, -51, y, ry, 17, 3, PAL.metal, Math.PI); // west ramp rising north
    b.box(-162.6, ry - 0.4, -61.4, 3, 0.4, 3.8, PAL.metal); // landing that joins the roof's NW corner
    // interior pillars + relay B console
    b.box(-155, y, -55, 1, bh, 1, PAL.concreteDark); b.box(-141, y, -55, 1, bh, 1, PAL.concreteDark);
    b.box(-148, y, -59, 2.2, 1.1, 1, PAL.metalDark);
    glow.box(-148, y + 1.1, -59, 1.8, 0.08, 0.7, PAL.glowCyan, 0, false);
    // satellite dish landmark on the roof
    b.add(CYL6, PAL.metal, T(-139, ry + 2, -59, 0, 0.35, 4, 0.35));
    const dish = new THREE.CylinderGeometry(4.2, 1.2, 1.4, 18);
    b.add(dish, PAL.white, T(-139, ry + 4.4, -59, 0.6, 1, 1, 1, -0.9), false);

    // watchtowers
    const tower = (tx: number, tz: number, side: 'S' | 'E') => {
      const top = y + 6;
      for (const [lx, lz] of [[-1.7, -1.7], [1.7, -1.7], [-1.7, 1.7], [1.7, 1.7]]) b.box(tx + lx, y, tz + lz, 0.4, 6, 0.4, PAL.metal);
      b.box(tx, top, tz, 4.4, 0.4, 4.4, PAL.wood);
      // parapets on every side except the one the ramp arrives at
      if (side !== 'S') b.box(tx, top + 0.4, tz + 2.1, 4.4, 1.1, 0.25, PAL.wood);
      b.box(tx, top + 0.4, tz - 2.1, 4.4, 1.1, 0.25, PAL.wood);
      b.box(tx - 2.1, top + 0.4, tz, 0.25, 1.1, 4.4, PAL.wood);
      if (side !== 'E') b.box(tx + 2.1, top + 0.4, tz, 0.25, 1.1, 4.4, PAL.wood);
      b.box(tx, top + 2.6, tz, 5, 0.3, 5, PAL.orange, 0, false);
      if (side === 'S') b.ramp(tx, tz + 2.2 + 6.5, y, top + 0.4, 13, 1.6, PAL.woodDark, Math.PI);
      else b.ramp(tx + 2.2 + 6.5, tz, y, top + 0.4, 13, 1.6, PAL.woodDark, -Math.PI / 2);
      return top + 0.4;
    };
    const t1 = tower(-168, -30, 'E');
    const t2 = tower(-112, -74, 'S');

    // containers + crates + barriers (cover)
    const covers: [number, number, number, number, number, string][] = [
      // x, z, w, h, d, color  (ry in separate list)
      [-124, -34, 6, 2.6, 2.5, PAL.teal], [-123, -38, 6, 2.6, 2.5, PAL.orange], [-168, -70, 6, 2.6, 2.5, PAL.orange],
      [-119, -60, 2.5, 2.6, 6, PAL.teal], [-146, -33, 6, 2.6, 2.5, PAL.white],
      [-140, -28, 1.4, 1.4, 1.4, PAL.crate], [-131, -30, 1.4, 1.4, 1.4, PAL.crate], [-155, -38, 1.4, 1.4, 1.4, PAL.crate],
      [-128, -47, 1.4, 1.4, 1.4, PAL.crate], [-114, -52, 1.4, 1.4, 1.4, PAL.crate], [-117, -28, 1.4, 1.4, 1.4, PAL.crate],
      [-160, -73, 1.4, 1.4, 1.4, PAL.crate], [-141, -72, 1.4, 1.4, 1.4, PAL.crate], [-130, -70, 1.4, 1.4, 1.4, PAL.crate],
      [-170, -45, 1.4, 1.4, 1.4, PAL.crate], [-112, -40, 1.4, 1.4, 1.4, PAL.crate], [-146, -40, 1.4, 1.4, 1.4, PAL.crate],
      [-136, -40, 3, 1, 0.6, PAL.concreteDark], [-160, -40, 3, 1, 0.6, PAL.concreteDark], [-128, -76, 3, 1, 0.6, PAL.concreteDark],
    ];
    const rr = mulberry32(WORLD.seed + 91);
    covers.forEach(([x, z, w, h, d, c], i) => {
      const r = w > 4 || d > 4 ? (i % 2) * 0.25 - 0.12 : range(rr, 0, 1.5);
      b.box(x, y, z, w, h, d, c, r);
      mk({ id: `station_cover_${i}`, type: 'cover', label: '掩体', p: [x, y, z], radius: Math.max(w, d) / 2 });
    });
    b.box(-140, y + 1.4, -28, 1.1, 1.1, 1.1, PAL.crate, 0.6); // stacked crate
    pieces.push({ name: 'Station', material: 'M_Toon', batch: b, outline: true });

    mk({ id: 'relay_b', type: 'interact', label: '中继器 B（前哨站）', p: [-148, y, -58], radius: 3, note: '清除据点后启动' });
    mk({ id: 'station_gate_s', type: 'poi', label: '正门', p: [-140, y, z1 + 2] });
    mk({ id: 'station_breach_e', type: 'poi', label: '东侧破墙（侧翼入口）', p: [x1 + 3, y, -54] });
    mk({ id: 'station_door_n', type: 'poi', label: '北侧后门（撤离路线）', p: [-156, y, z0 - 2] });
    const enemies: [number, number, number][] = [
      [-140, ry, -50], [-168, t1, -30], [-112, t2, -74], [-125, y, -45], [-150, y, -34], [-155, y, -52], [-130, y, -66],
    ];
    enemies.forEach((p, i) => mk({ id: `station_enemy_${i}`, type: 'enemy', label: '敌人刷新点', p }));
  }

  // ───────────────────────── Forest ruin (environment puzzle → relay A) ─────────────────────────
  {
    const b = new Batch('Ruin');
    const [cx, cz] = RUIN.c, y = heightAt(cx, cz);
    b.add(CYL16, PAL.stone, T(cx, y - 0.1, cz, 0, 12, 0.6, 12));
    b.add(CYL16, PAL.moss, T(cx, y + 0.0, cz, 0, 9, 0.6, 9));
    const rng = mulberry32(WORLD.seed + 5);
    const tops: [number, number, number][] = [];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + 0.2;
      if (Math.abs(a - Math.PI * 1.5) < 0.5) continue; // leave the shrine side open
      const h = range(rng, 1.5, 6.5);
      const px = cx + Math.cos(a) * 11, pz = cz + Math.sin(a) * 11;
      b.box(px, y, pz, 1.4, h, 1.4, PAL.stone, a);
      tops.push([px, y + h, pz]);
    }
    // broken arch
    b.box(cx - 12, y, cz + 8, 1.2, 6, 1.2, PAL.stone); b.box(cx - 7, y, cz + 12, 1.2, 4, 1.2, PAL.stone);
    b.box(cx - 10.5, y + 6, cz + 9.5, 5, 0.9, 1.2, PAL.stone, -0.75);
    // shrine (north side)
    const sz = cz - 9;
    b.box(cx - 3, y, sz, 0.8, 4, 6, PAL.stone); b.box(cx + 3, y, sz, 0.8, 4, 6, PAL.stone);
    b.box(cx, y, sz - 3, 6.8, 4, 0.8, PAL.stone);
    b.box(cx, y + 4, sz, 7.6, 0.6, 7.2, PAL.teal);
    b.box(cx, y, sz - 1.6, 1.6, 1.0, 0.8, PAL.metalDark);
    glow.box(cx, y + 1.0, sz - 1.6, 1.2, 0.08, 0.6, PAL.glowCyan, 0, false);
    pieces.push({ name: 'Ruin', material: 'M_Toon', batch: b, outline: true });

    const door = new Batch('Ruin_Door');
    door.box(cx, y, sz + 3, 5.2, 3.8, 0.5, PAL.gold);
    pieces.push({ name: 'Ruin_Door', material: 'M_Toon', batch: door, outline: true, dynamic: true, userData: { opensWhen: ['ruin_target_1', 'ruin_target_2', 'ruin_target_3'] } });

    // three shootable targets: low pillar, tall pillar, shrine roof
    const sorted = [...tops].sort((a, b2) => a[1] - b2[1]);
    const tgt = [sorted[1], sorted[sorted.length - 1], [cx, y + 4.6, sz] as [number, number, number]];
    tgt.forEach((p, i) => {
      const t = new Batch(`TGT_ruin_target_${i + 1}`, 'M_Target');
      t.add(new THREE.CylinderGeometry(0.7, 0.7, 0.2, 16), PAL.glowPink, T(p[0], p[1] + 0.9, p[2], 0, 1, 1, 1, Math.PI / 2), true);
      pieces.push({ name: `TGT_ruin_target_${i + 1}`, material: 'M_Target', batch: t, dynamic: true, userData: { target: `ruin_target_${i + 1}` } });
      mk({ id: `ruin_target_${i + 1}`, type: 'objective', label: `机关靶 ${i + 1}`, p: [p[0], p[1] + 0.9, p[2]] });
    });
    mk({ id: 'relay_a', type: 'interact', label: '中继器 A（森林遗迹）', p: [cx, y, sz - 1.6], radius: 3, requires: ['ruin_target_1', 'ruin_target_2', 'ruin_target_3'] });
    mk({ id: 'ruin_enemy_0', type: 'enemy', label: '巡逻敌人', p: [cx + 8, y, cz + 6] });
    mk({ id: 'ruin_enemy_1', type: 'enemy', label: '巡逻敌人', p: [cx - 6, y, cz + 10] });
  }

  // ───────────────────────── Parhelion Tower (final objective + landmark) ─────────────────────────
  {
    const b = new Batch('Tower');
    const [cx, cz] = TOWER.c, y = TOWER.top;
    b.add(new THREE.CylinderGeometry(14, 15.8, 0.8, 24), PAL.white, T(cx, y + 0.1, cz));
    b.add(new THREE.CylinderGeometry(10, 10, 0.3, 24), PAL.teal, T(cx, y + 0.5, cz), false);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      b.box(cx + Math.cos(a) * 12.5, y + 0.5, cz + Math.sin(a) * 12.5, 1, 2.4, 1, PAL.white, -a);
    }
    let yy = y + 0.5;
    for (const [w, h] of [[9, 10], [7, 12], [5, 10]] as const) {
      b.box(cx, yy, cz, w, h, w, PAL.white);
      b.box(cx, yy + h - 0.6, cz, w + 0.5, 0.6, w + 0.5, PAL.gold);
      yy += h;
    }
    b.add(new THREE.ConeGeometry(2.2, 9, 8), PAL.gold, T(cx, yy + 4.5, cz));
    b.box(cx, y + 0.5, cz + 10, 2.4, 1.2, 1.2, PAL.metalDark);
    glow.box(cx, y + 1.7, cz + 10, 2.0, 0.08, 0.9, PAL.glowGold, 0, false);
    pieces.push({ name: 'Tower', material: 'M_Toon', batch: b, outline: true });

    // The halo + two sundogs: the world's signature landmark, lit when the objective completes.
    const halo = new Batch('Tower_Halo', 'M_Halo');
    halo.add(new THREE.TorusGeometry(17, 0.8, 8, 72), PAL.glowGold, T(cx, y + 28, cz), false);
    halo.add(new THREE.TorusGeometry(12, 0.35, 6, 64), PAL.glowGold, T(cx, y + 28, cz), false);
    halo.add(new THREE.OctahedronGeometry(2.4, 0), PAL.glowGold, T(cx - 26, y + 28, cz, 0, 1, 1.6, 1), false);
    halo.add(new THREE.OctahedronGeometry(2.4, 0), PAL.glowGold, T(cx + 26, y + 28, cz, 0, 1, 1.6, 1), false);
    pieces.push({ name: 'Tower_Halo', material: 'M_Halo', batch: halo, userData: { litWhen: 'tower_console' } });

    mk({ id: 'tower_console', type: 'interact', label: '幻日塔控制台', p: [cx, y + 0.5, cz + 11.5], radius: 3.5, requires: ['relay_a', 'relay_b'] });
    mk({ id: 'tower_enemy_0', type: 'enemy', label: '守卫（精英）', p: [cx - 6, y + 0.5, cz + 6] });
    mk({ id: 'tower_enemy_1', type: 'enemy', label: '守卫', p: [cx + 7, y + 0.5, cz + 4] });
  }

  // ───────────────────────── Mist Falls + hidden cave ─────────────────────────
  {
    const b = new Batch('Cave');
    const { x0, x1, z0, z1, floor, ceil } = CAVE;
    const cxA = FALLS.x - 2; // corridor start (just behind the falls)
    // corridor through the cliff
    b.box((cxA + x0) / 2, floor - 0.6, (z0 + z1) / 2, x0 - cxA, 0.6, z1 - z0, PAL.rockDark);
    b.box((cxA + x0) / 2, floor, -64.6, x0 - cxA, 36, 1.2, PAL.rock);
    b.box((cxA + x0) / 2, floor, -55.4, x0 - cxA, 36, 1.2, PAL.rock);
    b.box((cxA + x0) / 2 + 0.5, floor + 6, (z0 + z1) / 2, x0 - cxA + 1, 30, 9, PAL.rock);
    // chamber
    b.box((x0 + x1) / 2, floor - 0.6, (z0 + z1) / 2, x1 - x0, 0.6, z1 - z0, PAL.rockDark);
    b.box((x0 + x1) / 2, ceil, (z0 + z1) / 2, x1 - x0, 0.8, z1 - z0, PAL.rockDark);
    b.box((x0 + x1) / 2, floor, z0, x1 - x0, ceil - floor, 1, PAL.rock);
    b.box((x0 + x1) / 2, floor, z1, x1 - x0, ceil - floor, 1, PAL.rock);
    b.box(x1, floor, (z0 + z1) / 2, 1, ceil - floor, z1 - z0, PAL.rock);
    b.box(x0, floor, (z0 - 64) / 2, 1, ceil - floor, -64 - z0, PAL.rock);
    b.box(x0, floor, (-56 + z1) / 2, 1, ceil - floor, z1 + 56, PAL.rock);
    // chest + data log
    b.box(188, floor, -60, 1.6, 1, 1, PAL.gold);
    b.box(188, floor + 1, -60, 1.6, 0.3, 1, PAL.orange);
    pieces.push({ name: 'Cave', material: 'M_Toon', batch: b, outline: true });
    const rng = mulberry32(WORLD.seed + 13);
    for (let i = 0; i < 9; i++) {
      const px = range(rng, x0 + 2, x1 - 2), pz = i % 2 ? z0 + 1.5 : z1 - 1.5;
      glow.add(new THREE.OctahedronGeometry(1, 0), PAL.glowCyan, T(px, floor + 0.6, pz, range(rng, 0, 3), 0.5, range(rng, 1.2, 2.6), 0.5, range(rng, -0.4, 0.4)), false);
    }
    // waterfall sheet in front of the entrance
    const fall = new Batch('Waterfall', 'M_Waterfall');
    fall.add(new THREE.PlaneGeometry(1, 1), '#ffffff', T(FALLS.x - 2.6, 18, (z0 + z1) / 2, -Math.PI / 2, 14, 34, 1), false);
    pieces.push({ name: 'Waterfall', material: 'M_Waterfall', batch: fall });
    // glowing flower trail along the shore = the visual clue
    for (let i = 0; i < 14; i++) {
      const t = i / 13;
      const px = 132 + t * 30, pz = -44 - t * 14 + Math.sin(i * 1.7) * 1.2;
      glow.add(new THREE.IcosahedronGeometry(0.22, 0), PAL.glowCyan, T(px, heightAt(px, pz) + 0.35, pz), false);
    }
    mk({ id: 'secret_cave', type: 'discovery', label: '瀑布后的观测日志', p: [186, floor, -60], radius: 6, note: '奖励：故事碎片 + 武器外观' });
  }

  // ───────────────────────── Mirror Lake island pillar (second discovery) ─────────────────────────
  {
    const b = new Batch('Island');
    const [cx, cz] = ISLAND.c, y = WORLD.waterLevel + 1.6;
    const top = y + 9;
    b.box(cx, y - 1, cz, 3, top - y + 1, 3, PAL.rock);
    for (let k = 1; k <= 10; k++) {
      const a = k * 0.72;
      b.box(cx + Math.cos(a) * 4.6, y + 0.85 * k - 0.45, cz + Math.sin(a) * 4.6, 1.9, 0.45, 1.9, k % 3 ? PAL.stone : PAL.moss, a);
    }
    b.box(cx, top, cz, 1.2, 0.8, 0.8, PAL.gold);
    pieces.push({ name: 'Island', material: 'M_Toon', batch: b, outline: true });
    mk({ id: 'secret_pillar', type: 'discovery', label: '湖心石柱宝箱', p: [cx, top, cz], radius: 2.5, note: '跳台小挑战' });
  }

  // ───────────────────────── Crossings ─────────────────────────
  {
    const b = new Batch('Crossings');
    const perpAt = (pts: V2[], c: V2): [number, number] => {
      let best = 0, bd = Infinity;
      for (let i = 0; i < pts.length - 1; i++) {
        const m = [(pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2];
        const d = Math.hypot(m[0] - c[0], m[1] - c[1]);
        if (d < bd) { bd = d; best = i; }
      }
      const dx = pts[best + 1][0] - pts[best][0], dz = pts[best + 1][1] - pts[best][1];
      const l = Math.hypot(dx, dz);
      return [-dz / l, dx / l];
    };
    // West Ford bridge
    {
      const [px, pz] = perpAt(RIVER_OUT, BRIDGE.c);
      const ry = Math.atan2(px, pz);
      const L = 40;
      const hA = heightAt(BRIDGE.c[0] - px * L / 2, BRIDGE.c[1] - pz * L / 2);
      const hB = heightAt(BRIDGE.c[0] + px * L / 2, BRIDGE.c[1] + pz * L / 2);
      const deck = Math.max(WORLD.waterLevel + 2.2, Math.min(hA, hB) + 0.3);
      const at = (s: number): [number, number] => [BRIDGE.c[0] + px * s, BRIDGE.c[1] + pz * s];
      const [mx, mz] = at(0);
      b.add(BOX, PAL.wood, T(mx, deck - 0.2, mz, ry, 4, 0.4, L - 8));
      for (const side of [-1, 1]) {
        const ox = Math.cos(ry) * 1.9 * side, oz = -Math.sin(ry) * 1.9 * side;
        b.add(BOX, PAL.woodDark, T(mx + ox, deck + 0.55, mz + oz, ry, 0.2, 0.9, L - 8));
        for (let s = -14; s <= 14; s += 7) {
          const [sx, sz] = at(s);
          b.add(BOX, PAL.woodDark, T(sx + ox, (deck - 3) / 2, sz + oz, ry, 0.5, deck + 3, 0.5));
        }
      }
      for (const e of [-1, 1]) {
        const [ex, ez] = at(e * (L / 2 - 4));
        const [gx, gz] = at(e * (L / 2 + 2));
        const g = heightAt(gx, gz);
        if (deck - g > 0.25) b.ramp((ex + gx) / 2, (ez + gz) / 2, g - 0.1, deck, 6, 4, PAL.wood, e > 0 ? ry + Math.PI : ry);
      }
    }
    // Log bridge in the forest
    {
      const [px, pz] = perpAt(RIVER, LOG_BRIDGE.c);
      const ry = Math.atan2(px, pz);
      const hA = heightAt(LOG_BRIDGE.c[0] - px * 13, LOG_BRIDGE.c[1] - pz * 13);
      const hB = heightAt(LOG_BRIDGE.c[0] + px * 13, LOG_BRIDGE.c[1] + pz * 13);
      const y = (hA + hB) / 2;
      b.add(CYL6, PAL.wood, T(LOG_BRIDGE.c[0], y + 0.3, LOG_BRIDGE.c[1], ry, 0.9, 30, 0.9, Math.PI / 2), false);
      b.addCol(BOX, T(LOG_BRIDGE.c[0], y + 0.6, LOG_BRIDGE.c[1], ry, 1.6, 0.6, 30, Math.atan2(hA - hB, 26)));
    }
    // stepping stones at the lake outlet
    {
      const c: V2 = [-30, 21];
      const [px, pz] = perpAt(RIVER_OUT, c);
      for (let i = -4; i <= 4; i++)
        b.add(CYL6, i % 2 ? PAL.stone : PAL.rock, T(c[0] + px * i * 2.6, WORLD.waterLevel - 0.4, c[1] + pz * i * 2.6, i, 1.2, 1.4, 1.2));
    }
    pieces.push({ name: 'Crossings', material: 'M_Toon', batch: b, outline: true });
  }

  // ───────────────────────── Guide lamps along trails ─────────────────────────
  {
    const b = new Batch('Lamps');
    let n = 0;
    for (const path of PATHS) {
      let acc = 18;
      for (let i = 0; i < path.length - 1; i++) {
        const [ax, az] = path[i], [bx, bz] = path[i + 1];
        const L = Math.hypot(bx - ax, bz - az);
        while (acc < L) {
          const t = acc / L;
          const x = ax + (bx - ax) * t + (bz - az) / L * 3.2, z = az + (bz - az) * t - (bx - ax) / L * 3.2;
          const g = heightAt(x, z);
          if (g > WORLD.waterLevel + 0.4) {
            b.box(x, g - 0.2, z, 0.25, 2.8, 0.25, PAL.metalDark);
            glow.add(new THREE.OctahedronGeometry(0.32, 0), PAL.glowGold, T(x, g + 2.85, z), false);
            n++;
          }
          acc += 34;
        }
        acc -= L;
      }
    }
    pieces.push({ name: 'Lamps', material: 'M_Toon', batch: b, outline: true, userData: { count: n } });
  }

  // ───────────────────────── Observatory HQ campus (2026 hub) ─────────────────────────
  {
    const b = new Batch('Campus');
    const y = CAMPUS.y;
    // plaza: paved disc with the parhelion emblem (halo ring + two sundog diamonds)
    const [px, pz] = PLAZA.c;
    b.add(CYL16, PAL.concrete, T(px, y, pz, 0, PLAZA.r, 0.3, PLAZA.r));
    b.add(CYL16, PAL.white, T(px, y + 0.02, pz, 0, PLAZA.r - 1.2, 0.3, PLAZA.r - 1.2), false);
    glow.add(new THREE.TorusGeometry(6, 0.18, 4, 48), PAL.glowGold, T(px, y + 0.2, pz, 0, 1, 1, 1, Math.PI / 2), false);
    for (const s of [-1, 1]) glow.add(new THREE.OctahedronGeometry(0.9, 0), PAL.glowGold, T(px + s * 9, y + 0.2, pz, 0, 1, 0.12, 1.6), false);
    // walkways joining the plaza to each building
    b.box(px, y - 0.1, (HQ.z1 + pz - PLAZA.r) / 2, 6, 0.25, pz - PLAZA.r - HQ.z1 + 1, PAL.concreteDark);
    b.box((ARMORY.x0 + px + PLAZA.r) / 2, y - 0.1, pz + 4, ARMORY.x0 - px - PLAZA.r + 1, 0.25, 6, PAL.concreteDark);
    b.box((SUMMON.c[0] + SUMMON.r + px - PLAZA.r) / 2, y - 0.1, SUMMON.c[1], px - PLAZA.r - SUMMON.c[0] - SUMMON.r + 1, 0.25, 6, PAL.concreteDark);

    // ── B. 幻日观测所: two-storey white block, teal glass band, observatory dome, entrance canopy
    {
      const cx = (HQ.x0 + HQ.x1) / 2, cz = (HQ.z0 + HQ.z1) / 2, w = HQ.x1 - HQ.x0, d = HQ.z1 - HQ.z0;
      b.box(cx, y, cz, w, 8, d, PAL.white);
      b.box(cx, y + 2.2, HQ.z1 + 0.15, w - 4, 3.2, 0.4, PAL.teal, 0, false);
      b.box(cx, y + 6.4, HQ.z1 + 0.15, w - 4, 0.5, 0.5, PAL.gold, 0, false);
      b.box(cx, y, HQ.z1 + 0.2, 5, 3.4, 0.3, PAL.metalDark, 0, false); // doors
      b.box(cx, y + 8, cz, w + 0.6, 0.5, d + 0.6, PAL.teal);
      b.box(cx - 7, y + 8.5, cz - 1, 22, 5, 15, PAL.white);
      b.box(cx - 7, y + 10.3, cz + 6.6, 20, 1.6, 0.4, PAL.teal, 0, false);
      b.box(cx - 7, y + 13.5, cz - 1, 22.6, 0.5, 15.6, PAL.gold);
      // dome with its observing slit and telescope
      const dome = new THREE.SphereGeometry(7, 22, 10, 0, Math.PI * 2, 0, Math.PI / 2);
      b.add(CYL16, PAL.concrete, T(cx + 11, y + 8.5, cz - 1, 0, 7.3, 1.6, 7.3));
      b.add(dome, PAL.white, T(cx + 11, y + 9.3, cz - 1));
      b.add(BOX, PAL.metalDark, T(cx + 11, y + 13.6, cz + 1.2, 0, 1.8, 6.8, 5, -0.55), false);
      b.add(CYL6, PAL.metal, T(cx + 11, y + 15, cz + 3.5, 0, 0.8, 6, 0.8, -0.9), false);
      // rooftop dish + antenna mast
      b.add(CYL6, PAL.metal, T(cx - 14, y + 16, cz - 2, 0, 0.3, 5, 0.3));
      b.add(new THREE.CylinderGeometry(3.4, 1, 1.2, 18), PAL.white, T(cx - 14, y + 18.6, cz - 2, 0.7, 1, 1, 1, -0.9), false);
      b.add(CYL6, PAL.metal, T(cx + 2, y + 18, cz - 4, 0, 0.12, 9, 0.12), false);
      glow.add(new THREE.IcosahedronGeometry(0.45, 0), PAL.glowCyan, T(cx + 2, y + 22.6, cz - 4), false);
      // entrance canopy on two pillars
      b.box(cx, y + 5, HQ.z1 + 4, 16, 0.45, 8, PAL.teal);
      for (const s of [-1, 1]) b.box(cx + s * 7, y, HQ.z1 + 7.4, 0.7, 5, 0.7, PAL.white);
      // observation terminal + world-map hologram under the canopy
      b.box(cx, y, HQ.z1 + 4.5, 2.4, 1.2, 0.9, PAL.metalDark);
      glow.box(cx, y + 1.2, HQ.z1 + 4.5, 2.0, 0.08, 0.7, PAL.glowCyan, 0, false);
      b.add(CYL16, PAL.metalDark, T(cx - 5, y + 0.4, HQ.z1 + 5, 0, 1.6, 0.8, 1.6));
      glow.add(new THREE.TorusGeometry(1.4, 0.06, 4, 32), PAL.glowCyan, T(cx - 5, y + 1.6, HQ.z1 + 5, 0, 1, 1, 1, Math.PI / 2), false);
      glow.add(new THREE.IcosahedronGeometry(0.7, 1), PAL.glowCyan, T(cx - 5, y + 2.4, HQ.z1 + 5, 0, 1, 1, 1), false);
      mk({ id: 'hq_terminal', type: 'interact', label: '观测终端（幻日观测所）', p: [cx, y, HQ.z1 + 5.6], radius: 3.5, note: '登记调查员身份，打开世界地图与历史档案' });
      mk({ id: 'hq_archive', type: 'poi', label: '历史档案 · 世界地图全息台', p: [cx - 5, y, HQ.z1 + 5] });
    }

    // ── C. 枪械工坊: hangar open to the plaza, weapon racks inside, a three-lane range behind
    {
      const { x0, x1, z0, z1 } = ARMORY;
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, H = 7;
      b.box(cx, y, z0, x1 - x0, H, 0.8, PAL.white);
      b.box(cx, y, z1, x1 - x0, H, 0.8, PAL.white);
      b.box(x1, y, cz, 0.8, H, z1 - z0, PAL.white);
      for (const s of [-1, 1]) b.box(x0, y, cz + s * 9.5, 0.8, H, 5, PAL.white); // west front, 14 m opening
      b.box(x0, y + H - 1.2, cz, 0.8, 1.2, 14, PAL.orange);
      b.box(cx, y + H, cz, x1 - x0 + 1, 0.5, z1 - z0 + 1, PAL.metalDark);
      b.box(cx, y + H + 0.5, cz, x1 - x0 - 4, 1.4, z1 - z0 - 6, PAL.white);
      b.box(cx, y, cz, x1 - x0 - 1, 0.12, z1 - z0 - 1, PAL.concreteDark, 0, false);
      // racks along the back wall: frames with the three Arena guns as silhouettes
      for (const [i, dz] of [-6, 0, 6].entries()) {
        b.box(x1 - 1.2, y, cz + dz, 0.8, 3.2, 4.4, PAL.metal);
        for (let k = 0; k < 3; k++) b.box(x1 - 1.7, y + 0.8 + k * 0.9, cz + dz, 0.2, 0.22, 3.2 - i * 0.4, PAL.metalDark, 0, false);
        glow.box(x1 - 1.66, y + 3.0, cz + dz, 0.06, 0.12, 4.0, i === 1 ? PAL.glowGold : PAL.glowCyan, 0, false);
      }
      b.box(cx, y, cz, 6, 1.0, 2.2, PAL.metalDark); // workbench
      glow.box(cx, y + 1.0, cz, 5.4, 0.06, 1.6, PAL.glowCyan, 0, false);
      for (const [x, z] of [[x0 + 4, z0 + 3], [x0 + 5.6, z0 + 3.2], [x1 - 4, z1 - 3]] as const) b.box(x, y, z, 1.3, 1.3, 1.3, PAL.crate, 0.3);
      mk({ id: 'armory_rack', type: 'interact', label: '武器架（枪械工坊）', p: [x1 - 3, y, cz], radius: 3.5, note: '领取 Lumen AR 与弹药' });
      // range: firing line on the south side, lanes run south to a backstop
      const fz = z1 + 4, tz = fz + 20;
      b.box(cx - 1, y, fz, 18, 1.0, 0.6, PAL.concrete);
      for (const lx of [-9, -3, 3, 9]) b.box(cx - 1 + lx, y, (fz + tz) / 2, 0.4, 1.4, tz - fz - 2, PAL.teal);
      b.box(cx - 1, y, tz + 2.5, 22, 4.5, 1.2, PAL.concreteDark);
      [-6, 0, 6].forEach((lx, i) => {
        const x = cx - 1 + lx;
        b.box(x, y, tz, 0.3, 1.5, 0.3, PAL.metal);
        const t = new Batch(`TGT_range_target_${i + 1}`, 'M_Target');
        t.add(new THREE.CylinderGeometry(0.6, 0.6, 0.15, 16), PAL.glowPink, T(x, y + 2.0, tz, 0, 1, 1, 1, Math.PI / 2), true);
        pieces.push({ name: `TGT_range_target_${i + 1}`, material: 'M_Target', batch: t, dynamic: true, userData: { target: `range_target_${i + 1}` } });
        mk({ id: `range_target_${i + 1}`, type: 'objective', label: `练习靶 ${i + 1}`, p: [x, y + 2.0, tz] });
      });
      mk({ id: 'range_line', type: 'poi', label: '靶场射击线', p: [cx - 1, y, fz - 1.5] });
    }

    // ── D. 召唤大厅: open rotunda, ring of columns, summoning circle that lights once the seams are read
    {
      const [cx, cz] = SUMMON.c, r = SUMMON.r;
      b.add(CYL16, PAL.white, T(cx, y, cz, 0, r + 1, 0.5, r + 1));
      b.add(CYL16, '#5b4f86', T(cx, y + 0.03, cz, 0, r - 2, 0.5, r - 2), false);
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.3) continue; // doorway faces the plaza (east)
        b.box(cx + Math.cos(a) * (r - 0.4), y, cz + Math.sin(a) * (r - 0.4), 1.2, 9, 1.2, PAL.white, -a);
      }
      b.add(new THREE.TorusGeometry(r - 0.4, 0.55, 6, 48), PAL.gold, T(cx, y + 9.2, cz, 0, 1, 1, 1, Math.PI / 2), false);
      b.add(new THREE.TorusGeometry(r - 0.4, 0.3, 6, 48), PAL.white, T(cx, y + 8.2, cz, 0, 1, 1, 1, Math.PI / 2), false);
      glow.add(new THREE.TorusGeometry(6, 0.14, 4, 64), PAL.glowPink, T(cx, y + 0.35, cz, 0, 1, 1, 1, Math.PI / 2), false);
      glow.add(new THREE.TorusGeometry(4, 0.1, 4, 64), PAL.glowPink, T(cx, y + 0.35, cz, 0, 1, 1, 1, Math.PI / 2), false);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        glow.add(new THREE.OctahedronGeometry(0.35, 0), PAL.glowPink, T(cx + Math.cos(a) * 5, y + 0.6, cz + Math.sin(a) * 5, a, 1, 1.8, 1), false);
      }
      b.add(CYL16, PAL.stone, T(cx, y + 0.4, cz, 0, 1.4, 0.8, 1.4));
      const beam = new Batch('Summon_Beam', 'M_Beam');
      beam.add(new THREE.CylinderGeometry(4, 6, 60, 24, 1, true), '#d8a6ff', T(cx, y + 30.4, cz), false);
      pieces.push({ name: 'Summon_Beam', material: 'M_Beam', batch: beam, userData: { showWhen: 'summon_circle' } });
      mk({ id: 'summon_circle', type: 'interact', label: '召唤阵（召唤大厅）', p: [cx, y + 0.8, cz], radius: 4, requires: ['seam_west', 'seam_north', 'seam_east'], note: '稳定召唤阵，为第一份 Servant 契约做准备' });
    }

    // helipad + hedges + flags around the plaza
    b.add(CYL16, PAL.concreteDark, T(-58, y, 212, 0, 8, 0.3, 8));
    b.box(-58, y + 0.1, 212, 1, 0.12, 6, PAL.white, 0, false); b.box(-56, y + 0.1, 212, 1, 0.12, 6, PAL.white, 0, false);
    b.box(-57, y + 0.1, 212, 1.4, 0.12, 1, PAL.white, 0, false);
    for (const [x, z] of [[-140, 236], [-96, 236], [-140, 262], [-96, 262]] as const) {
      b.add(CYL6, PAL.metal, T(x, y + 4, z, 0, 0.12, 8, 0.12), false);
      b.box(x + 1.1, y + 6, z, 2, 1.3, 0.08, PAL.teal, 0, false);
    }
    pieces.push({ name: 'Campus', material: 'M_Toon', batch: b, outline: true });
  }

  // ───────────────────────── Era seams: where another era bleeds into 2026 ─────────────────────────
  {
    const b = new Batch('Seams');
    const seam = (id: string, cx: number, cz: number, y: number, ry: number, veil: string, label: string, note: string) => {
      // two observatory pylons hold the seam open; the veil appears once the tower is restarted
      const ax = Math.cos(ry), az = -Math.sin(ry);
      for (const s of [-1, 1]) {
        b.box(cx + ax * 10 * s, y, cz + az * 10 * s, 1.8, 15, 1.8, PAL.white, ry);
        b.box(cx + ax * 10 * s, y + 15, cz + az * 10 * s, 2.4, 0.6, 2.4, PAL.teal, ry);
        glow.box(cx + ax * 10.95 * s, y + 2, cz + az * 10.95 * s, 0.1, 11, 0.5, PAL.glowCyan, ry, false);
      }
      const v = new Batch(`Seam_${id}_Veil`, 'M_Beam');
      v.add(new THREE.PlaneGeometry(18.2, 15), veil, T(cx, y + 7.5, cz, ry), false);
      v.add(new THREE.PlaneGeometry(14, 11), veil, T(cx, y + 5.5, cz, ry), false);
      pieces.push({ name: `Seam_${id}_Veil`, material: 'M_Beam', batch: v, userData: { showWhen: 'tower_console' } });
      const fx = Math.sin(ry), fz = Math.cos(ry); // towards the valley side of the gate
      mk({ id: `seam_${id}`, type: 'interact', label, p: [cx + fx * 4, y, cz + fz * 4], radius: 4.5, requires: ['tower_console'], note });
    };

    // west → 落日王国 (~537, Britain): trilithons and a sword in the stone, eternal-dusk veil
    {
      const [cx, cz] = SEAM_W.c, y = heightAt(cx, cz);
      const rng = mulberry32(WORLD.seed + 201);
      for (let i = 0; i < 9; i++) {
        const a = Math.PI / 2 + (i / 8 - 0.5) * 2.6;
        const sx = cx + 4 + Math.cos(a) * 17, sz = cz + Math.sin(a) * 17;
        const gy = heightAt(sx, sz) - 0.4, h = range(rng, 4, 7);
        if (i % 3 === 1) { // trilithon: two uprights and a lintel
          b.box(sx, gy, sz - 1.6, 1.4, h, 1.1, PAL.stone, a);
          b.box(sx, gy, sz + 1.6, 1.4, h, 1.1, PAL.stone, a);
          b.box(sx, gy + h, sz, 1.6, 0.9, 4.6, PAL.stone, a);
        } else b.box(sx, gy, sz, 1.5, h * 0.8, 1.1, rng() > 0.5 ? PAL.stone : PAL.moss, a + range(rng, -0.2, 0.2));
      }
      const sxw = cx + 12, szw = cz + 8, sy = heightAt(sxw, szw);
      b.add(ROCKG, PAL.rock, T(sxw, sy + 0.4, szw, 0.4, 1.6, 1.0, 1.4));
      b.box(sxw, sy + 1.2, szw, 0.12, 1.6, 0.45, '#dfe7f2', 0, false); // blade
      b.box(sxw, sy + 2.8, szw, 0.2, 0.18, 1.3, PAL.gold, 0, false); // crossguard
      b.box(sxw, sy + 2.9, szw, 0.16, 0.7, 0.16, '#2c3f8f', 0, false); // grip
      seam('west', cx, cz, y, Math.PI / 2, '#ffb36b', '西部时层断面 · 落日王国', '约 537 年 · 不列颠：永恒黄昏');
      // the gorge runs on into 落日王国; this invisible gate holds until the summoning circle is stable
      const gate = new Batch('Seam_west_Gate');
      gate.addCol(BOX, T(cx - 24.5, y + 30, cz, 0, 1, 80, 40)); // across the link at x = -334
      pieces.push({ name: 'Seam_west_Gate', material: 'M_Toon', batch: gate, dynamic: true, userData: { opensWhen: ['summon_circle'] } });
    }
    // north → 永冬之城 (1812): the frozen bay, ice spikes and two frost-bound field guns
    {
      const [bx, bz] = BAY_N.c, top = WORLD.waterLevel + 0.12;
      const ice = new Batch('Ice_Bay');
      ice.add(new THREE.CylinderGeometry(1, 1, 1, 48), '#e3f4ff', T(bx, top - 0.5, bz, 0, BAY_N.rx * 0.98, 1, BAY_N.rz * 0.98));
      const rng = mulberry32(WORLD.seed + 202);
      for (let i = 0; i < 14; i++) {
        const a = range(rng, 0, Math.PI * 2), r = range(rng, 0.2, 0.8);
        ice.add(BOX, '#b9dcf2', T(bx + Math.cos(a) * BAY_N.rx * r, top + 0.01, bz + Math.sin(a) * BAY_N.rz * r, range(rng, 0, 3), range(rng, 4, 12), 0.04, 0.25), false);
      }
      for (let i = 0; i < 26; i++) {
        const a = range(rng, 0, Math.PI * 2);
        const x = bx + Math.cos(a) * BAY_N.rx * range(rng, 0.9, 1.05), z = bz + Math.sin(a) * BAY_N.rz * range(rng, 0.9, 1.05);
        const h = range(rng, 2, 6);
        ice.add(new THREE.ConeGeometry(0.8, 1, 5), '#cfeaff', T(x, Math.max(top, heightAt(x, z)) + h / 2 - 0.3, z, a, range(rng, 0.8, 1.6), h, range(rng, 0.8, 1.6), range(rng, -0.25, 0.25)), true);
      }
      for (const [gx, gz, r] of [[-16, -300, 0.5], [14, -306, -0.4]] as const) {
        ice.add(BOX, '#d9e6ee', T(gx, top + 0.5, gz, r, 1.6, 1.0, 2.6));
        ice.add(CYL6, '#c5d3dd', T(gx + Math.sin(r) * 1.2, top + 1.3, gz + Math.cos(r) * 1.2, r, 0.3, 3.2, 0.3, Math.PI / 2 - 0.15), false);
        for (const s of [-1, 1]) ice.add(CYL16, '#d9e6ee', T(gx + Math.cos(r) * s, top + 0.7, gz - Math.sin(r) * s, r, 0.7, 0.2, 0.7, 0, Math.PI / 2), false);
      }
      pieces.push({ name: 'Ice_Bay', material: 'M_Toon', batch: ice, outline: true });
      seam('north', SEAM_N.c[0], SEAM_N.c[1], top, 0, '#bfe9ff', '北方冰海断面 · 永冬之城', '1812 年 · 俄罗斯：不会结束的冬天');
    }
    // east → the coast (星落海岸, later 黑帆尽头, 1718): a mast with a black sail at the pass
    {
      const [cx, cz] = SEAM_E.c, y = heightAt(cx, cz);
      for (const s of [-1, 1]) {
        const mx = cx - 6, mz = cz + s * 12, my = heightAt(mx, mz);
        b.add(CYL6, PAL.woodDark, T(mx, my + 6, mz, 0, 0.35, 12, 0.35));
        b.box(mx, my + 10, mz, 0.3, 0.3, 4, PAL.woodDark, 0, false);
        b.box(mx + 0.2, my + 7.4, mz, 0.06, 2.6, 3.6, '#22252e', 0, false);
      }
      seam('east', cx, cz, y, -Math.PI / 2, '#7fb0ff', '东部山口断面 · 黑帆尽头', '1718 年 · 大西洋：海盗黄金时代（现为星落海岸）');
    }
    pieces.push({ name: 'Seams', material: 'M_Toon', batch: b, outline: true });
  }

  // Boundary walls are built at runtime from the union of all regions (see src/regions.ts).
  return { pieces, markers };
}

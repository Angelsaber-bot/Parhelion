/** Arashiyama: an optional, traversable western landscape composed for Kyoto's 1582 chapter.
 * Historical abstraction: a timber river crossing and a Zen garden evoke the district;
 * neither the modern concrete bridge nor today's reconstructed Tenryū-ji halls are replicated. */
import * as THREE from 'three';
import { Batch, BOX, T } from '../geo.js';
import type { Piece } from '../structures.js';
import type { Marker } from '../layout.js';
import { mulberry32, range } from '../rng.js';
import { ARASHIYAMA as A, KYOTO } from './layout.js';
import { arashiyamaRiverZ, arashiyamaRiverWidth } from './terrain.js';
import { addKyotoRoof } from './architecture.js';

const CYL = new THREE.CylinderGeometry(1, 1, 1, 8);
const ROCK = new THREE.DodecahedronGeometry(1, 0);
const LEAF = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([
  0, 0, 0, -0.18, 0.03, 0.48, 0, 0, 1.3, 0, 0, 0, 0, 0, 1.3, 0.18, 0.03, 0.48,
  0, 0, 0, 0, 0, 1.3, -0.18, 0.03, 0.48, 0, 0, 0, 0.18, 0.03, 0.48, 0, 0, 1.3,
], 3));
const C = { wood: '#927053', dark: '#554039', worn: '#b49a72', pale: '#e5d7b6', roof: '#46545e', roofDark: '#303f48', stone: '#9d9f8e', moss: '#708f62', bamboo: '#72946a', node: '#a0b781', leaf: '#54856a', jade: '#83aa74', water: '#609f99' };
type HeightAt = (x: number, z: number) => number;

/** Excludes the generic random forest from authored buildings, river and broad walking routes. */
export const isArashiyamaReserved = (x: number, z: number) => x > -334 && x < -190 && z > -114 && z < 104;

function beam(b: Batch, a: [number, number, number], c: [number, number, number], width: number, depth: number, color: string, collide = false) {
  const start = new THREE.Vector3(...a), end = new THREE.Vector3(...c), delta = end.clone().sub(start);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.clone().normalize());
  b.add(BOX, color, new THREE.Matrix4().compose(start.add(end).multiplyScalar(0.5), q, new THREE.Vector3(width, delta.length(), depth)), collide);
}

export function buildArashiyama(heightAt: HeightAt): { pieces: Piece[]; markers: Marker[] } {
  const rng = mulberry32(KYOTO.seed + 817);
  const timber = new Batch('Arashiyama_Timber', 'M_KyotoTimber');
  const roof = new Batch('Arashiyama_Roofs', 'M_KyotoRoof');
  const plaster = new Batch('Arashiyama_PaperAndPlaster', 'M_KyotoPlaster');
  const stone = new Batch('Arashiyama_GardenStone', 'M_KyotoStone');
  const bamboo = new Batch('Arashiyama_Bamboo', 'M_KyotoBamboo');
  const foliage = new Batch('Arashiyama_Foliage', 'M_Foliage');
  const cloth = new Batch('Arashiyama_RiverfrontCloth', 'M_KyotoFabric');
  const water = new Batch('Arashiyama_GardenWater');
  const glow = new Batch('Arashiyama_Lanterns', 'M_Emissive');
  const markers: Marker[] = [];
  const discovery = (id: string, label: string, x: number, z: number, note: string, y = heightAt(x, z)) => markers.push({ id, type: 'discovery', label, p: [x, y, z], radius: 6, note });

  // A broad pegged timber bridge. Continuous sloped collision under separate boards avoids stair traps.
  const { x: bx, z0, z1, width, deckY } = A.bridge;
  const deck = (z: number) => deckY + Math.sin(Math.PI * (z - z0) / (z1 - z0)) * 0.72;
  // Rough-cut stone abutments are embedded below the timber approaches, not concrete road piers.
  for (const z of [z0 + 0.35, z1 - 0.35]) {
    stone.box(bx, 3.8, z, width + 1.5, 1.95, 1.5, '#929b8e');
    for (let row = 0; row < 3; row++) for (let k = 0; k < 7; k++) {
      const x = bx - 4.5 + k * 1.5 + (row % 2) * 0.18;
      stone.add(ROCK, k % 3 ? '#9fa696' : '#b4b6a0', T(x, 4.1 + row * 0.55, z, 0.1 * k, 0.84, 0.35, 0.88), false);
    }
  }
  for (let z = z0; z < z1; z += 1) {
    timber.ramp(bx, z + 0.5, deck(z) - 0.15, deck(z + 1) - 0.15, 1, width, C.wood);
    for (let strip = 0; strip < 3; strip++) {
      const x = bx + (strip - 1) * width / 3;
      timber.add(BOX, [C.wood, C.worn, '#a28663'][(z + strip) % 3], T(x, deck(z + 0.5) + 0.018, z + 0.5, 0, width / 3 - 0.025, 0.045, 0.95, -Math.atan2(deck(z + 1) - deck(z), 1)), false);
      // Recessed square wooden fastening heads, never metal highway hardware.
      for (const s of [-1, 1]) timber.box(x + s * width / 8, deck(z + 0.5) + 0.044, z + 0.5, 0.07, 0.015, 0.07, C.dark, 0, false);
    }
  }
  for (const end of [z0, z1]) {
    const outer = end === z0 ? end - 4 : end + 4;
    timber.ramp(bx, (end + outer) / 2, end === z0 ? A.bankY - 0.15 : deckY - 0.15, end === z0 ? deckY - 0.15 : A.bankY - 0.15, 4, width, C.worn);
  }
  for (let z = z0; z <= z1; z += 4.6) {
    const y = deck(z);
    for (const side of [-1, 1]) {
      const x = bx + side * (width / 2 - 0.16);
      timber.box(x, y - 0.4, z, 0.28, 1.75, 0.28, C.dark, 0, false);
      timber.box(x, y + 1.35, z, 0.38, 0.12, 0.38, C.worn, 0, false);
      if (z + 4.6 <= z1 + 0.01) {
        for (const rh of [0.48, 1.16]) beam(timber, [x, y + rh, z], [x, deck(z + 4.6) + rh, z + 4.6], 0.14, 0.19, C.wood);
        beam(timber, [x, y - 0.32, z], [x, deck(z + 4.6) - 0.32, z + 4.6], 0.3, 0.4, C.dark);
      }
    }
  }
  for (const z of [19, 29.5, 40, 50.5]) {
    const y = deck(z);
    for (const side of [-1, 1]) {
      const x = bx + side * 3.35;
      timber.add(CYL, C.dark, T(x, (y + 0.2) / 2, z, 0, 0.32, y - 0.2, 0.32));
      beam(timber, [x, 1.2, z - 1.9], [x, y - 0.3, z + 1.9], 0.23, 0.23, C.wood);
      beam(timber, [x, 1.2, z + 1.9], [x, y - 0.3, z - 1.9], 0.23, 0.23, C.wood);
    }
    timber.box(bx, y - 0.7, z, width + 0.8, 0.35, 0.5, C.dark, 0, false);
  }
  discovery('disc_arashiyama', '岚山·木构渡月桥', bx, 35, '山影与桂川之间的木桥。此处为1582年氛围的地理压缩，并非现代渡月桥复原。', deck(35));

  // Zen temple hall: asymmetrical open veranda, visible timber bays, paper screens and curved ceramic eaves.
  const [hx, hz] = A.hall.c, hy = A.bankY;
  stone.box(hx, hy - 0.35, hz, A.hall.w + 1.2, 0.55, A.hall.d + 1, C.stone);
  timber.box(hx, hy + 0.2, hz + 1.2, A.hall.w + 2.8, 0.26, A.hall.d + 3.8, C.wood);
  // Solid back volume; front veranda and its walking floor are open.
  plaster.box(hx, hy + 0.46, hz - 1.5, A.hall.w - 1, 4.7, A.hall.d - 4.5, C.pale);
  for (let i = -3; i <= 3; i++) {
    const x = hx + i * 3.9;
    for (const z of [hz - 6.9, hz + 7.6]) {
      stone.box(x, hy + 0.1, z, 0.68, 0.3, 0.65, '#a3a697', 0, false);
      timber.box(x, hy + 0.4, z, 0.34, 5.0, 0.34, C.dark);
      timber.box(x, hy + 4.8, z, 1.08, 0.2, 0.58, C.wood, 0, false);
      timber.box(x, hy + 5.0, z, 0.65, 0.2, 0.9, C.worn, 0, false);
    }
  }
  for (const z of [hz + 4, hz - 6.9]) {
    for (const y of [hy + 0.6, hy + 3.9, hy + 5.1]) timber.box(hx, y, z, A.hall.w + 1, 0.18, 0.2, C.dark, 0, false);
  }
  for (let i = -3; i <= 3; i++) {
    const x = hx + i * 3.8;
    plaster.box(x, hy + 0.65, hz + 4.05, 3.48, 3.2, 0.05, i % 3 ? '#d7d2b6' : '#b9bba5', 0, false);
    for (let k = 0; k <= 5; k++) timber.box(x - 1.74 + k * 0.696, hy + 0.65, hz + 4.1, 0.055, 3.2, 0.055, C.dark, 0, false);
    for (let k = 0; k <= 4; k++) timber.box(x, hy + 0.65 + k * 0.8, hz + 4.1, 3.48, 0.05, 0.055, C.dark, 0, false);
  }
  for (let i = 0; i < 30; i++) timber.box(hx - 13 + i * 0.88, hy + 0.46, hz + 6.2, 0.018, 0.018, 4.4, C.dark, 0, false);
  timber.ramp(hx, hz + 11.2, hy + 0.31, hy - 0.15, 3.0, 6.2, C.worn);
  addKyotoRoof(roof, hx, hy + 5.4, hz, 0, 30, 23, 5.1, C.roof, 'hip', true);
  // Small side roof breaks the silhouette without cloning the grand hall.
  timber.box(hx + 15.4, hy + 0.1, hz - 1, 5, 3.4, 7.5, C.wood);
  addKyotoRoof(roof, hx + 15.4, hy + 3.5, hz - 1, 0, 7.1, 10, 2.0, C.roofDark, 'gable', true);
  discovery('disc_tenryu_garden', '天龙寺意境·借景庭园', -267, -47, '池石与西山相映的禅寺庭园意境。殿宇为游戏化构作，不冒充现存建筑的16世纪原貌。');

  // Sōgen-inspired pond: a curved shore, separate jade water, stone composition and a dry viewing path.
  const [px, pz] = A.garden.c;
  const disk = new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2);
  water.add(disk, C.water, T(px, A.garden.waterY, pz, 0, A.garden.rx * 1.13, 1, A.garden.rz * 1.13), false);
  // Unequal rock groups leave broad soft moss/gravel shore between them: no necklace ring.
  const shoreAngles = [0.08, 0.25, 0.43, 1.05, 1.24, 2.07, 2.31, 2.53, 3.10, 3.28, 3.51, 4.35, 4.54, 5.12, 5.28, 5.47];
  shoreAngles.forEach((a, i) => {
    const radius = 1 / (1 + 0.065 * Math.sin(a * 3) + 0.04 * Math.cos(a * 5));
    const x = px + Math.cos(a) * A.garden.rx * radius, z = pz + Math.sin(a) * A.garden.rz * radius;
    const size = [0.55, 1.55, 0.8, 1.1, 0.5, 1.85, 0.65, 1.0][i % 8];
    stone.add(ROCK, i % 3 ? '#8d9989' : '#b3b2a0', T(x, heightAt(x, z) + size * 0.06, z, a + i * 0.7, size * 1.35, size * (i % 4 === 0 ? 0.85 : 0.38), size * 0.8, (i % 3 - 1) * 0.15), false);
  });
  for (const [dx, dz, sx, sy, sz] of [[-6, -2, 2.1, 2.5, 1.5], [-3.4, -1, 1.6, 1.1, 1.8], [-7.6, 0.8, 1.1, 1.3, 1.1], [6, 4, 2.3, 0.55, 1.8]]) {
    stone.add(ROCK, '#737f78', T(px + dx, 4.85 + sy * 0.5, pz + dz, dx, sx, sy, sz), false);

  }
  // Flat, broken pale-jade crescents avoid the dark outlines/shadows of wire-like 3D hoops.
  for (let i = 0; i < 5; i++) {
    const x = px + range(rng, -9, 9), z = pz + range(rng, -5, 5), radius = range(rng, 0.65, 1.3);
    water.add(new THREE.RingGeometry(radius, radius + 0.035, 28, 1, rng() * 6, Math.PI * 1.1).rotateX(-Math.PI / 2), '#80aaa1', T(x, A.garden.waterY + 0.006, z, 0, 1, 1, 0.5), false);
  }

  const lantern = (x: number, z: number, size = 1) => {
    const y = heightAt(x, z);
    stone.box(x, y, z, 1.05 * size, 0.18 * size, 1.05 * size, C.stone);
    stone.add(CYL, C.stone, T(x, y + 0.7 * size, z, 0, 0.18 * size, 1.2 * size, 0.18 * size), false);
    stone.box(x, y + 1.2 * size, z, 0.72 * size, 0.56 * size, 0.72 * size, C.stone, 0, false);
    for (const side of [-1, 1]) glow.box(x, y + 1.34 * size, z + side * 0.365 * size, 0.35 * size, 0.27 * size, 0.018, '#d7bc83', 0, false);
    addKyotoRoof(stone, x, y + 1.76 * size, z, 0, 1.25 * size, 1.25 * size, 0.35 * size, '#8a9586', 'hip', false);
    stone.add(CYL, C.stone, T(x, y + 2.18 * size, z, 0, 0.1 * size, 0.2 * size, 0.1 * size), false);
  };
  lantern(-272, -19, 1.1); lantern(-298, -51, 0.9); lantern(-274, 6, 1); lantern(-260, 65, 1);

  // Bamboo grove: authored meandering 6.8 m lane; culms lean away from it, knots and lanceolate leaves.
  for (let i = 0; i < A.bambooPath.length - 1; i++) {
    const a = A.bambooPath[i], c = A.bambooPath[i + 1], L = Math.hypot(c[0] - a[0], c[1] - a[1]);
    const nx = -(c[1] - a[1]) / L, nz = (c[0] - a[0]) / L;
    for (let t = 1; t < L; t += 3.6) for (const side of [-1, 1]) {
      if (rng() < 0.16) continue; // uneven openings distinguish groves from a plantation grid
      const distance = range(rng, 4.5, 8.3), cx = a[0] + (c[0] - a[0]) * t / L + nx * distance * side, cz = a[1] + (c[1] - a[1]) * t / L + nz * distance * side;
      if (cx < -321 || Math.hypot((cx - px) / 18, (cz - pz) / 14) < 1 || cz > 14) continue;
      for (let n = 0; n < 3; n++) {
        const x = cx + range(rng, -1.05, 1.05), z = cz + range(rng, -1.05, 1.05), y = heightAt(x, z), h = range(rng, 8.8, 14), leanX = nx * side * range(rng, 0.35, 1.65) + range(rng, -0.35, 0.35), leanZ = nz * side * range(rng, 0.35, 1.65) + range(rng, -0.35, 0.35);
        beam(bamboo, [x, y, z], [x + leanX, y + h, z + leanZ], 0.16, 0.17, n % 2 ? C.bamboo : '#8da46e');
        for (let q = 1; q < h; q += 1.08) bamboo.add(CYL, C.node, T(x + leanX * q / h, y + q, z + leanZ * q / h, 0, 0.115, 0.08, 0.115), false);
        const boughCount = 5 + n;
        for (let k = 0; k < boughCount; k++) {
          const angle = rng() * Math.PI * 2, by = y + h * (0.55 + k * 0.4 / (boughCount - 1)), ex = x + leanX + Math.cos(angle) * 1.9, ez = z + leanZ + Math.sin(angle) * 1.9;
          beam(bamboo, [x + leanX, by, z + leanZ], [ex, by + 0.35, ez], 0.025, 0.025, C.bamboo);
          // Small flattened foliage masses hold the canopy at a distance; pointed blades
          // break their contours in close-up instead of reading as bare sticks.
          foliage.add(ROCK, k % 3 ? '#5f8e6c' : '#7da076', T(ex, by + 0.37, ez, angle, 0.6, 0.09, 0.3), false);
          for (let leaf = 0; leaf < 13; leaf++) {
            const t = leaf / 13, lx = x + leanX + (ex - x - leanX) * t, lz = z + leanZ + (ez - z - leanZ) * t;
            foliage.add(LEAF, leaf % 3 ? C.leaf : C.jade, T(lx, by + 0.35 * t, lz, angle + (leaf % 2 ? 0.65 : -0.65), 1.2, 1, range(rng, 0.85, 1.35), range(rng, 0.45, 1.05)), false);
          }
        }
      }
    }
  }
  // Irregular hillside copses soften the mountain shoulder behind the designed grove.
  for (const [x, z, s] of [[-325, -96, 1.3], [-327, -77, 1.1], [-322, -52, 1.4], [-328, -27, 1.2], [-326, 1, 1.35], [-321, 67, 1.2], [-324, 87, 1.4]]) {
    const y = heightAt(x, z);
    beam(timber, [x, y, z], [x + 0.4, y + 5.2 * s, z], 0.4, 0.4, C.dark);
    for (let k = 0; k < 4; k++) {
      const a = k * 2.4 + z, cx = x + Math.cos(a) * 1.5 * s, cz = z + Math.sin(a) * 1.4 * s;
      foliage.add(new THREE.IcosahedronGeometry(1, 1), k % 2 ? '#527858' : '#719166', T(cx, y + (4.1 + k * 0.55) * s, cz, a, 2.7 * s, 1.2 * s, 2.2 * s), false);
    }
  }
  // Low woven bamboo screens accent the grove entrance, never close the lane.
  for (const x of [-312, -297]) {
    const z = -91, y = heightAt(x, z);
    for (let k = 0; k < 11; k++) bamboo.add(CYL, C.worn, T(x + (k - 5) * 0.27, y + 0.65, z, 0, 0.035, 1.3, 0.035), false);
    for (const h of [0.4, 1.0]) beam(bamboo, [x - 1.5, y + h, z], [x + 1.5, y + h, z], 0.06, 0.07, C.dark);
  }
  discovery('disc_arashiyama_bamboo', '岚山·竹径', -306, -66, '竹节、疏叶与山间土径；步道保持宽阔，可从寺庭环行回到木桥。');

  // Three different riverfront crafts/buildings: open tea pavilion, fisher's lean-to and raised storehouse.
  // 1. Hipped tea pavilion with an open river view and low benches, no solid room to trap the player.
  const tx = -291, tz = 71, ty = heightAt(tx, tz);
  stone.box(tx, ty - 0.1, tz, 13, 0.23, 10.5, C.stone);
  for (const dx of [-5.5, 5.5]) for (const dz of [-4.2, 4.2]) timber.box(tx + dx, ty + 0.13, tz + dz, 0.22, 3.7, 0.22, C.dark);
  addKyotoRoof(roof, tx, ty + 3.85, tz, 0, 15.2, 12.2, 2.3, '#62716b', 'hip', true);
  for (const x of [tx - 4.4, tx + 4.4]) { timber.box(x, ty + 0.13, tz, 0.18, 0.65, 5.8, C.dark); timber.box(x, ty + 0.78, tz, 1.3, 0.12, 6.0, C.worn); }
  for (let k = 0; k < 5; k++) cloth.box(tx - 2 + k, ty + 2.9, tz + 4.3, 0.94, 0.75 + (k % 2) * 0.08, 0.04, '#789d95', 0, false);
  timber.box(tx, ty + 0.13, tz + 2.5, 2.4, 0.6, 1.0, C.wood);
  for (const dx of [-0.65, 0.2, 0.75]) stone.add(CYL, '#b7bbae', T(tx + dx, ty + 0.81, tz + 2.5, 0, 0.12, 0.15, 0.12), false);
  // 2. Uneven boat shelter: single-slope split-wood roof, baskets and fishing rods.
  const fx = -240, fz = 64, fy = heightAt(fx, fz);
  for (const dx of [-4.4, 4.4]) for (const dz of [-3.2, 3.2]) timber.box(fx + dx, fy, fz + dz, 0.19, dz < 0 ? 3.2 : 2.6, 0.19, C.dark);
  for (let k = 0; k < 19; k++) timber.add(BOX, k % 3 ? '#8a7754' : '#a18d64', T(fx - 4.7 + k * 0.52, fy + 3.03, fz, 0, 0.5, 0.14, 8.5, 0.09), false);
  for (let k = 0; k < 9; k++) timber.box(fx + 4.4, fy + 0.3 + k * 0.25, fz, 0.1, 0.12, 6.2, C.wood, 0, false);
  for (const dx of [-2.7, -1.4]) {
    timber.add(CYL, '#ab956a', T(fx + dx, fy + 0.55, fz + 1.8, 0, 0.52, 1.1, 0.52), false);
    for (const h of [0.2, 0.5, 0.85]) timber.add(new THREE.TorusGeometry(0.52, 0.035, 3, 12), C.dark, T(fx + dx, fy + h, fz + 1.8, 0, 1, 1, 1, Math.PI / 2), false);
  }
  for (let k = 0; k < 3; k++) beam(bamboo, [fx + 1 + k * 0.25, fy + 0.1, fz + 2.8], [fx + 2.8 + k * 0.25, fy + 4.3, fz + 1], 0.045, 0.045, C.worn);
  // 3. Compact raised storehouse with earth plaster, black battens and high gable.
  const sx = -222, sz = 82, sy = heightAt(sx, sz);
  stone.box(sx, sy, sz, 10, 0.65, 8, C.stone);
  plaster.box(sx, sy + 0.65, sz, 9.3, 4.9, 7.4, '#ddd4b7');
  timber.box(sx, sy + 0.65, sz - 3.75, 3.1, 3.6, 0.13, C.dark, 0, false);
  for (let k = 0; k < 8; k++) timber.box(sx - 4.5 + k * 1.28, sy + 0.65, sz - 3.78, 0.1, 4.9, 0.12, C.wood, 0, false);
  addKyotoRoof(roof, sx, sy + 5.55, sz, 0, 12.1, 10.3, 3.0, C.roofDark, 'gable', true);

  // Narrow wooden skiff moored against a gravel bank. No modern hull, engine or tourism signage.
  const boatX = -246, boatZ = 48, boatY = 1.25;
  timber.box(boatX, boatY, boatZ, 2.2, 0.15, 7.4, '#7e6850', -0.2, false);
  for (const side of [-1, 1]) timber.add(BOX, C.wood, T(boatX + side * 1.0, boatY + 0.45, boatZ, -0.2, 0.14, 0.8, 7.3, 0, side * -0.15), false);
  for (const z of [boatZ - 3.5, boatZ + 3.5]) timber.box(boatX, boatY + 0.15, z, 2.0, 0.65, 0.18, C.dark, -0.2, false);
  for (const z of [boatZ - 2, boatZ, boatZ + 2]) timber.box(boatX, boatY + 0.45, z, 2.1, 0.15, 0.5, C.worn, -0.2, false);
  beam(timber, [boatX - 0.2, boatY + 0.7, boatZ - 3], [boatX + 1.5, boatY + 0.8, boatZ + 2], 0.09, 0.09, C.dark);

  // River shoals and designed bank stones stay off the bridge approaches and circulation loop.
  for (let i = 0; i < 70; i++) {
    const x = range(rng, -324, -201), side = i % 2 ? 1 : -1, z = arashiyamaRiverZ(x) + side * (arashiyamaRiverWidth(x) + range(rng, 0.5, 6.5));
    if (Math.abs(x - bx) < 7 || (x > -250 && x < -234 && side > 0) || x > -215) continue;
    const r = range(rng, 0.3, 1.1);
    stone.add(ROCK, ['#a5ac9c', '#8e9b93', '#bdbaa5'][i % 3], T(x, heightAt(x, z) + r * 0.2, z, rng() * 6, r * 1.4, r * 0.6, r), false);
  }
  // A small broken shoal makes downstream current legible without a stylized neon water stripe.
  for (let i = 0; i < 8; i++) {
    const x = -311 + i * 0.62, z = arashiyamaRiverZ(x) + Math.sin(i * 1.7) * 3.8;
    stone.add(ROCK, '#a0afa2', T(x, 0.8, z, i, 0.6, 0.35, 0.8), false);
    water.box(x + 0.6, 1.035, z + 0.4, 0.9, 0.015, 0.18, '#b7cbc2', -0.2, false);
  }
  // Two sculptural pines frame the borrowed mountain view, rather than a uniform tree grid.
  for (const [x, z, scale, angle] of [[-313, -15, 1.0, 0.3], [-281, -70, 0.8, -0.4], [-312, 71, 1.1, 0.5]]) {
    const y = heightAt(x, z);
    beam(timber, [x, y, z], [x + 1.3 * scale, y + 5.2 * scale, z], 0.55 * scale, 0.5 * scale, C.dark);
    for (let k = 0; k < 4; k++) {
      const a = angle + k * 2.2, ex = x + Math.cos(a) * 3.3 * scale, ez = z + Math.sin(a) * 3.3 * scale, ey = y + (3.4 + k * 0.65) * scale;
      beam(timber, [x + 0.8 * scale, y + 3.0 * scale, z], [ex, ey, ez], 0.16 * scale, 0.18 * scale, C.dark);
      foliage.add(new THREE.IcosahedronGeometry(1, 1), k % 2 ? '#457360' : '#5b8260', T(ex, ey + 0.5, ez, a, 3.1 * scale, 0.85 * scale, 2.25 * scale), false);
    }
  }
  discovery('disc_arashiyama_riverfront', '桂川河畔', -267, 76, '茶棚、舟具小屋与土藏各循其用，西山脚下仍有未被战火吞没的日常。');

  const batches = [timber, roof, plaster, stone, bamboo, foliage, cloth, water, glow];
  return { pieces: batches.map(batch => ({ name: batch.name, material: batch.material, batch, outline: ![water, glow, foliage].includes(batch), userData: { district: 'arashiyama', historicalAbstraction: true } })), markers };
}

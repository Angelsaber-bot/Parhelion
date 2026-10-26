import * as THREE from 'three';
import { Batch, T, distToPolyline } from './geo.js';
import { mulberry32, range, fbm } from './rng.js';
import { WORLD, PATHS, CAMP, STATION, TOWER, RUIN, LAKE, ISLAND, FALLS, BRIDGE, POND } from './layout.js';
import { PAL, type Piece } from './structures.js';

type HeightAt = (x: number, z: number) => number;

const TRUNK = new THREE.CylinderGeometry(0.22, 0.34, 1, 6);
const BALL = new THREE.IcosahedronGeometry(1, 0);
const ROCK = new THREE.DodecahedronGeometry(1, 0);
const BOXG = new THREE.BoxGeometry(1, 1, 1);

const LEAF_PINE = ['#3f9a5a', '#4aa863', '#368c55'];
const LEAF_ROUND = ['#6cc56a', '#5bb85f', '#7fd06f'];
const LEAF_BLOSSOM = ['#f7b2cf', '#f39fc2'];


const BLOB = new THREE.IcosahedronGeometry(1, 1); // already non-indexed: clone, never toNonIndexed()
const CONE_T = new THREE.ConeGeometry(1, 1, 9, 1, true);
const _c = new THREE.Color(), _c2 = new THREE.Color();

/**
 * Anime canopy: a cluster of blobs whose normals point away from the canopy centre
 * ("normal transfer", the trick Genshin-style foliage uses) so the toon terminator reads as one
 * soft volume instead of facets. Vertex colours run from a cool shadow tone at the bottom to a
 * warm highlight on top.
 */
function canopy(out: Batch, rng: () => number, cx: number, cy: number, cz: number, rx: number, ry: number, color: string) {
  const parts: THREE.BufferGeometry[] = [];
  const blobs = 4 + Math.floor(rng() * 2);
  for (let i = 0; i < blobs; i++) {
    const a = rng() * Math.PI * 2, e = (rng() - 0.35) * 1.1;
    const d = i === 0 ? 0 : 0.55 + rng() * 0.25;
    const r = (i === 0 ? 0.8 : 0.48 + rng() * 0.22);
    const g = BLOB.clone();
    g.applyMatrix4(T(cx + Math.cos(a) * Math.cos(e) * rx * d, cy + Math.sin(e) * ry * d, cz + Math.sin(a) * Math.cos(e) * rx * d, rng() * 6, rx * r, ry * r * 0.9, rx * r));
    parts.push(g);
  }
  _c.set(color);
  for (const g of parts) {
    for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const nor = new Float32Array(pos.count * 3), col = new Float32Array(pos.count * 3);
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.set(pos.getX(i) - cx, (pos.getY(i) - cy) * (rx / ry), pos.getZ(i) - cz).normalize();
      nor[i * 3] = v.x; nor[i * 3 + 1] = v.y; nor[i * 3 + 2] = v.z;
      const t = THREE.MathUtils.clamp((pos.getY(i) - (cy - ry)) / (2 * ry), 0, 1);
      _c2.copy(_c).multiplyScalar(0.72 + 0.4 * t);
      _c2.offsetHSL(-0.02 * (1 - t), 0, 0);
      col[i * 3] = _c2.r; col[i * 3 + 1] = _c2.g; col[i * 3 + 2] = _c2.b;
    }
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    out.vis.push(g);
  }
}

/** Layered conifer tiers with cylindrical (axis-outward, up-tilted) normals. */
function conifer(out: Batch, cx: number, base: number, cz: number, s: number, color: string, ry: number) {
  _c.set(color);
  const tiers: [number, number, number][] = [[2.3, 2.4, 0], [1.8, 2.2, 1.5], [1.25, 2.0, 2.9], [0.7, 1.6, 4.1]];
  for (const [r, h, y0] of tiers) {
    const g = CONE_T.index ? CONE_T.toNonIndexed() : CONE_T.clone();
    for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k);
    g.applyMatrix4(T(cx, base + (y0 + h / 2) * s, cz, ry, r * s, h * s, r * s));
    const pos = g.attributes.position as THREE.BufferAttribute;
    const nor = new Float32Array(pos.count * 3), col = new Float32Array(pos.count * 3);
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      const ly = (pos.getY(i) - base) / (5.7 * s);
      v.set(pos.getX(i) - cx, 0.55, pos.getZ(i) - cz).normalize();
      nor[i * 3] = v.x; nor[i * 3 + 1] = v.y; nor[i * 3 + 2] = v.z;
      _c2.copy(_c).multiplyScalar(0.75 + 0.35 * ly);
      col[i * 3] = _c2.r; col[i * 3 + 1] = _c2.g; col[i * 3 + 2] = _c2.b;
    }
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    out.vis.push(g);
  }
}

/** Exclusion zones where nothing should grow (structures, water, trails). */
function blocked(x: number, z: number) {
  const near = (c: readonly [number, number], r: number) => Math.hypot(x - c[0], z - c[1]) < r;
  if (near(CAMP.c, 30) || near(TOWER.c, 20) || near(RUIN.c, 17) || near(LAKE.c, LAKE.r + 4) || near(POND.c, POND.r + 6)) return true;
  if (near(ISLAND.c, ISLAND.r + 2) || near(BRIDGE.c, 24)) return true;
  if (Math.abs(x - CAMP.c[0]) < 26 && z > CAMP.c[1] - 70 && z < CAMP.c[1]) return true; // keep the camp's view of the tower open
  if (x > STATION.x0 - 8 && x < STATION.x1 + 8 && z > STATION.z0 - 8 && z < STATION.z1 + 8) return true;
  if (x > FALLS.x - 14 && x < FALLS.x + 4 && z > -72 && z < -48) return true;
  for (const p of PATHS) if (distToPolyline(x, z, p) < 4) return true;
  return false;
}

function forestDensity(x: number, z: number) {
  const inForest = Math.hypot((x - 112) * 0.9, (z - 30) * 0.75) < 78 && x > 45;
  const nwGrove = Math.hypot(x + 120, z - 140) < 40; // grove SW of the station
  const towerSlope = Math.hypot(x - 60, z + 120) < 38;
  const n = fbm(x * 0.02, z * 0.02, 3, WORLD.seed + 40);
  if (inForest) return 0.62 + n * 0.3;
  if (nwGrove || towerSlope) return 0.35 + n * 0.3;
  return 0.05 + Math.max(0, n) * 0.12;
}

export function buildVegetation(heightAt: HeightAt): Piece[] {
  const rng = mulberry32(WORLD.seed + 1);
  const trunks = new Batch('Trees_Trunks');
  const leaves = new Batch('Trees_Leaves', 'M_Foliage');
  const rocks = new Batch('Rocks');
  const bushes = new Batch('Bushes', 'M_Foliage');

  const slope = (x: number, z: number) => {
    const e = 1.5;
    return Math.hypot(heightAt(x + e, z) - heightAt(x - e, z), heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e);
  };

  const STEP = 6.5;
  let trees = 0;
  for (let gz = -WORLD.half; gz < WORLD.half; gz += STEP)
    for (let gx = -WORLD.half; gx < WORLD.half; gx += STEP) {
      const x = gx + range(rng, 0, STEP), z = gz + range(rng, 0, STEP);
      const roll = rng(), kind = rng(), s = range(rng, 0.8, 1.35), ry = range(rng, 0, Math.PI * 2);
      const h = heightAt(x, z);
      if (Math.abs(x) > WORLD.playHalf + 12 || Math.abs(z) > WORLD.playHalf + 12) continue;
      if (h < WORLD.waterLevel + 0.8 || blocked(x, z)) continue;
      const sl = slope(x, z);
      const dens = h > 46 ? 0.05 : forestDensity(x, z);
      if (sl > 0.9 || roll > dens) continue;
      trees++;
      const y = h - 0.3;
      const blossom = Math.hypot(x - CAMP.c[0], z - CAMP.c[1]) < 60 || Math.hypot(x - RUIN.c[0], z - RUIN.c[1]) < 30;
      if (kind < 0.5 && !blossom) {
        // conifer
        const th = 2.6 * s;
        trunks.add(TRUNK, PAL.woodDark, T(x, y + th / 2, z, ry, s, th, s), false);
        conifer(leaves, x, y + th * 0.75, z, s, LEAF_PINE[Math.floor(rng() * 3)], ry);
      } else {
        // broadleaf / blossom
        const th = 3.0 * s;
        const pal = blossom && kind > 0.4 ? LEAF_BLOSSOM : LEAF_ROUND;
        trunks.add(TRUNK, PAL.wood, T(x, y + th / 2, z, ry, s * 1.2, th, s * 1.2), false);
        canopy(leaves, rng, x, y + th + 1.3 * s, z, 2.5 * s, 2.0 * s, pal[Math.floor(rng() * pal.length)]);
      }
      // trunk collider: simple box
      trunks.addCol(BOXG, T(x, y + 2, z, ry, 0.6 * s, 4, 0.6 * s));
    }

  // rocks: banks, cliffs, and scattered in the open as cover
  let nRocks = 0;
  for (let i = 0; i < 1400 && nRocks < 260; i++) {
    const x = range(rng, -WORLD.playHalf, WORLD.playHalf), z = range(rng, -WORLD.playHalf, WORLD.playHalf);
    const h = heightAt(x, z), sl = slope(x, z);
    if (blocked(x, z) || h < WORLD.waterLevel - 0.3) continue;
    const want = sl > 0.5 ? 0.6 : h < WORLD.waterLevel + 1.5 ? 0.4 : 0.08;
    if (rng() > want) continue;
    const s = range(rng, 0.6, sl > 0.5 ? 3.2 : 1.8);
    // seat on the lowest point under the footprint so rocks never float on slopes
    const low = Math.min(h, heightAt(x + s, z), heightAt(x - s, z), heightAt(x, z + s), heightAt(x, z - s));
    rocks.add(ROCK, rng() > 0.5 ? PAL.rock : PAL.rockDark, T(x, low + s * 0.15, z, range(rng, 0, 6), s * range(rng, 0.9, 1.5), s * range(rng, 0.6, 1.0), s, range(rng, -0.3, 0.3)));
    nRocks++;
  }

  // bushes (no collision)
  for (let i = 0; i < 700; i++) {
    const x = range(rng, -WORLD.playHalf, WORLD.playHalf), z = range(rng, -WORLD.playHalf, WORLD.playHalf);
    const h = heightAt(x, z);
    if (blocked(x, z) || h < WORLD.waterLevel + 0.6 || h > 40 || rng() > forestDensity(x, z) + 0.15) continue;
    const s = range(rng, 0.6, 1.2);
    bushes.add(BALL, LEAF_ROUND[i % 3], T(x, h + 0.3 * s, z, range(rng, 0, 6), s * 1.3, s * 0.8, s * 1.3), false);
  }

  return [
    { name: 'Trees_Trunks', material: 'M_Toon', batch: trunks, outline: true, userData: { count: trees } },
    { name: 'Trees_Leaves', material: 'M_Foliage', batch: leaves, outline: true },
    { name: 'Rocks', material: 'M_Toon', batch: rocks, outline: true, userData: { count: nRocks } },
    { name: 'Bushes', material: 'M_Foliage', batch: bushes },
  ];
}

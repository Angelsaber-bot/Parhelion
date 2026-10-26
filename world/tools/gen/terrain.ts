import * as THREE from 'three';
import { fbm, lerp, smoothstep, clamp } from './rng.js';
import { distToPolyline } from './geo.js';
import {
  WORLD, RIVER, RIVER_OUT, POND, LAKE, ISLAND, PATHS, CAMP, STATION, TOWER, RUIN, CAVE, FALLS, PASS,
  CAMPUS, SEAM_W, BAY_N, PLAZA, HQ, ARMORY, SUMMON,
} from './layout.js';

const S = WORLD.seed;

function bump(x: number, z: number, cx: number, cz: number, r: number) {
  const d = Math.hypot(x - cx, z - cz) / r;
  return d >= 1 ? 0 : 0.5 + 0.5 * Math.cos(Math.PI * d);
}

/** Signed distance to an axis rect (negative inside). */
function rectDist(x: number, z: number, x0: number, x1: number, z0: number, z1: number) {
  const dx = Math.max(x0 - x, 0, x - x1), dz = Math.max(z0 - z, 0, z - z1);
  const outside = Math.hypot(dx, dz);
  const inside = Math.min(Math.min(x - x0, x1 - x), Math.min(z - z0, z1 - z));
  return outside > 0 ? outside : -inside;
}

// Natural height before the designed flatten/carve passes (used to seat the ruin).
function natural(x: number, z: number) {
  let h = 5 + fbm(x * 0.007, z * 0.007, 4, S) * 9 + fbm(x * 0.04, z * 0.04, 2, S + 9) * 1.2;
  // gentle bowl towards the lake
  h -= (1 - smoothstep(0, 170, Math.hypot(x, z))) * 4;
  // forest rolling hills
  h += bump(x, z, 95, 70, 60) * 6 + bump(x, z, 70, -100, 50) * 7;
  // outer hills of the enlarged valley: SE downs, NE highland, NW crags, the knoll west of the HQ
  h += bump(x, z, 236, 190, 95) * 20 + bump(x, z, 210, -250, 90) * 26 + bump(x, z, -232, -214, 85) * 22
    + bump(x, z, -262, 186, 70) * 14 + bump(x, z, 120, 250, 60) * 9 + bump(x, z, 280, 66, 40) * 7;
  // ring of mountains (superellipse so the corners stay playable), notched where the era seams open
  const se = Math.pow(Math.pow(Math.abs(x), 4) + Math.pow(Math.abs(z), 4), 0.25);
  // (the west notch runs on into 落日王国; the north one closes past the boundary, backed by a cliff)
  const notch = Math.max(
    (1 - smoothstep(18, 46, Math.abs(z - SEAM_W.c[1]))) * smoothstep(-200, -260, x),
    (1 - smoothstep(60, 100, Math.abs(x - BAY_N.c[0]))) * smoothstep(-200, -250, z) * smoothstep(-362, -340, z),
  );
  const ring = smoothstep(296, 356, se) * (1 - notch * 0.9);
  h += ring * (52 + fbm(x * 0.018 + 7, z * 0.018, 4, S + 3) * 26);
  // east ridge with a near-vertical cliff behind the falls, sloping away into the eastern downs
  const ridgeZ = smoothstep(-160, -128, z) * (1 - smoothstep(0, 40, z));
  const ridgeX = smoothstep(FALLS.x - 1, FALLS.x + 4, x) * (1 - smoothstep(205 + fbm(z * 0.03, 1.3, 2, S + 6) * 30, 270, x));
  h = Math.max(h, lerp(h, 34 + fbm(x * 0.05, z * 0.05, 2, S + 5) * 3, ridgeZ * ridgeX));
  // north-west ridge overlooking the station (sniper high ground)
  h += bump(x, z, -150, -128, 40) * 16;
  // northern ice bay: the valley floor falls away to a frozen sea arm under the north seam
  {
    const d = Math.hypot((x - BAY_N.c[0]) / BAY_N.rx, (z - BAY_N.c[1]) / BAY_N.rz) + fbm(x * 0.03, z * 0.03, 2, S + 41) * 0.15;
    h = lerp(WORLD.waterLevel - 3, h, smoothstep(0.85, 1.6, d));
  }
  return h;
}

export function heightFn(x: number, z: number): number {
  let h = natural(x, z);

  // Landing camp plateau: steep S/E/W edges, gentle north slope down into the valley.
  {
    const dx = x - CAMP.c[0], dz = z - CAMP.c[1];
    const d = Math.hypot(dx, dz);
    const north = clamp(-dz / Math.max(d, 1e-3), 0, 1);
    h = lerp(h, CAMP.top, 1 - smoothstep(30, lerp(42, 100, north * north), d));
  }
  // Parhelion Tower hill
  {
    const d = Math.hypot(x - TOWER.c[0], z - TOWER.c[1]);
    h = lerp(h, TOWER.top + (h - TOWER.top) * 0.15, 1 - smoothstep(16, 70, d));
    h = lerp(h, TOWER.top, 1 - smoothstep(15, 18, d));
  }
  // Observatory HQ campus terrace
  {
    const d = rectDist(x, z, CAMPUS.x0, CAMPUS.x1, CAMPUS.z0, CAMPUS.z1);
    h = lerp(h, CAMPUS.y, 1 - smoothstep(2, 30, d));
  }
  // western seam terrace: a level shelf of old stones where the era seam stands
  {
    const d = Math.hypot(x - SEAM_W.c[0], (z - SEAM_W.c[1]) * 0.8);
    h = lerp(h, natural(SEAM_W.c[0] + 30, SEAM_W.c[1]), 1 - smoothstep(16, 40, d));
  }
  // Station pad
  {
    const d = rectDist(x, z, STATION.x0, STATION.x1, STATION.z0, STATION.z1);
    h = lerp(h, STATION.y, 1 - smoothstep(4, 26, d));
  }
  // Forest ruin plaza (seated at its natural height)
  {
    const d = Math.hypot(x - RUIN.c[0], z - RUIN.c[1]);
    h = lerp(h, natural(RUIN.c[0], RUIN.c[1]), 1 - smoothstep(14, 24, d));
  }

  // Water carving
  const bed = WORLD.waterLevel - 2.2;
  const dRiver = Math.min(distToPolyline(x, z, RIVER), distToPolyline(x, z, RIVER_OUT));
  h = Math.min(h, lerp(bed, h, smoothstep(5, 17, dRiver)));
  const dLake = Math.hypot(x - LAKE.c[0], z - LAKE.c[1]) + fbm(x * 0.05, z * 0.05, 2, S + 11) * 6;
  h = Math.min(h, lerp(bed - 1.5, h, smoothstep(LAKE.r - 6, LAKE.r + 14, dLake)));
  const dPond = Math.hypot(x - POND.c[0], z - POND.c[1]);
  h = Math.min(h, lerp(bed, h, smoothstep(POND.r - 2, POND.r + 8, dPond)));

  // Shore ledge leading behind the falls (the hidden route)
  if (x < FALLS.x - 1) {
    const d = rectDist(x, z, FALLS.x - 12, FALLS.x - 1, CAVE.z0 - 1, CAVE.z1 + 1);
    h = lerp(CAVE.floor, h, smoothstep(0, 4, d));
  }

  // East pass to 星落海岸 (the coast region continues past x = 240)
  {
    const band = 1 - smoothstep(8, 16, Math.abs(z - PASS.z));
    const floor = lerp(14, PASS.y, smoothstep(170, 330, x)) + fbm(x * 0.05, z * 0.05, 2, S + 31) * 0.8;
    // past the eastern downs the road climbs steadily up to the saddle (never a step)
    const climb = lerp(-50, lerp(3, PASS.y, smoothstep(250, 330, x)), smoothstep(230, 250, x));
    h = lerp(h, Math.max(Math.min(h, floor), climb), band * smoothstep(165, 195, x));
  }

  // Island in Mirror Lake
  {
    const d = Math.hypot(x - ISLAND.c[0], z - ISLAND.c[1]);
    h = Math.max(h, lerp(WORLD.waterLevel + 1.6, h, smoothstep(ISLAND.r - 2, ISLAND.r + 4, d)));
  }
  return h;
}

/** Paved ground on the HQ campus (no grass grows there). */
function paved(x: number, z: number) {
  if (Math.hypot(x - CAMP.c[0], z - CAMP.c[1] + 6) < 8.5) return true; // camp landing pad
  if (x < CAMPUS.x0 || x > CAMPUS.x1 || z < CAMPUS.z0 || z > CAMPUS.z1 + 4) return false;
  const [px, pz] = PLAZA.c;
  if (Math.hypot(x - px, z - pz) < PLAZA.r + 1.5) return true;
  if (Math.abs(x - px) < 4 && z > HQ.z0 - 2 && z < pz) return true; // HQ front + walkway
  if (x > HQ.x0 - 2 && x < HQ.x1 + 2 && z > HQ.z0 - 2 && z < HQ.z1 + 10) return true;
  if (Math.abs(z - pz - 4) < 4 && x > px && x < ARMORY.x1 + 2) return true; // walkway east
  if (x > ARMORY.x0 - 2 && x < ARMORY.x1 + 2 && z > ARMORY.z0 - 2 && z < ARMORY.z1 + 30) return true; // hangar + range
  if (Math.abs(z - SUMMON.c[1]) < 4 && x > SUMMON.c[0] && x < px) return true; // walkway west
  if (Math.hypot(x - SUMMON.c[0], z - SUMMON.c[1]) < SUMMON.r + 2.5) return true;
  return Math.hypot(x + 58, z - 212) < 9; // helipad
}

const C = {
  pave: new THREE.Color('#d8d3c6'),
  grassA: new THREE.Color('#86cf6c'),
  grassB: new THREE.Color('#62b65c'),
  grassDry: new THREE.Color('#b4d470'),
  dirt: new THREE.Color('#d0aa72'),
  sand: new THREE.Color('#ecd9a0'),
  rock: new THREE.Color('#9097b2'),
  rockDark: new THREE.Color('#6e7493'),
  snow: new THREE.Color('#f1f5ff'),
  bed: new THREE.Color('#6fa7a3'),
};

export interface TerrainOut {
  vis: THREE.BufferGeometry;
  col: THREE.BufferGeometry;
  heights: Float32Array;
  n: number;
  heightAt: (x: number, z: number) => number;
}

/** True where a grid cell is cut out (cave entrance through the cliff). */
function isHole(cx: number, cz: number) {
  return cx > FALLS.x - 3 && cx < CAVE.x0 + 1 && cz > CAVE.z0 + 3 && cz < CAVE.z1 - 3;
}

export function buildTerrain(): TerrainOut {
  const { half, cell } = WORLD;
  const n = Math.round((half * 2) / cell) + 1;
  const heights = new Float32Array(n * n);
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) heights[j * n + i] = heightFn(-half + i * cell, -half + j * cell);

  const pos = new Float32Array(n * n * 3);
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const k = j * n + i;
      pos[k * 3] = -half + i * cell;
      pos[k * 3 + 1] = heights[k];
      pos[k * 3 + 2] = -half + j * cell;
    }

  const idx: number[] = [];
  for (let j = 0; j < n - 1; j++)
    for (let i = 0; i < n - 1; i++) {
      const cx = -half + (i + 0.5) * cell, cz = -half + (j + 0.5) * cell;
      if (isHole(cx, cz)) continue;
      const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }

  const vis = new THREE.BufferGeometry();
  vis.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  vis.setIndex(idx);
  vis.computeVertexNormals();

  // Vertex colours: slope/height/paths, in bold flat bands for the toon look.
  const nor = vis.attributes.normal as THREE.BufferAttribute;
  const col = new Float32Array(n * n * 3);
  const tmp = new THREE.Color();
  for (let k = 0; k < n * n; k++) {
    const x = pos[k * 3], y = pos[k * 3 + 1], z = pos[k * 3 + 2];
    const ny = nor.getY(k);
    const v = fbm(x * 0.03, z * 0.03, 3, S + 21);
    if (y < WORLD.waterLevel - 0.6) tmp.copy(C.bed);
    else if (y < WORLD.waterLevel + 0.9) tmp.copy(C.sand);
    else tmp.copy(v > 0.12 ? C.grassB : v < -0.25 ? C.grassDry : C.grassA);
    const dPath = Math.min(...PATHS.map((p) => distToPolyline(x, z, p)));
    if (dPath < 2.2 + v && y > WORLD.waterLevel + 0.5) tmp.copy(C.dirt);
    if (paved(x, z)) tmp.copy(C.pave);
    if (ny < 0.72) tmp.copy(ny < 0.5 ? C.rockDark : C.rock);
    if (y > 58 + v * 10 && ny > 0.55) tmp.copy(C.snow);
    // the north seam leaks winter into the valley: snow creeps south from the ice bay
    if (z < -238 + v * 18 && ny > 0.6 && y > WORLD.waterLevel - 0.6) tmp.copy(C.snow);
    col[k * 3] = tmp.r; col[k * 3 + 1] = tmp.g; col[k * 3 + 2] = tmp.b;
  }
  vis.setAttribute('color', new THREE.BufferAttribute(col, 3));

  const colGeo = new THREE.BufferGeometry();
  colGeo.setAttribute('position', new THREE.BufferAttribute(pos.slice(), 3));
  colGeo.setIndex(idx.slice());

  const heightAt = (x: number, z: number) => {
    const fi = clamp((x + half) / cell, 0, n - 1.001), fj = clamp((z + half) / cell, 0, n - 1.001);
    const i = Math.floor(fi), j = Math.floor(fj), u = fi - i, w = fj - j;
    const h00 = heights[j * n + i], h10 = heights[j * n + i + 1];
    const h01 = heights[(j + 1) * n + i], h11 = heights[(j + 1) * n + i + 1];
    return lerp(lerp(h00, h10, u), lerp(h01, h11, u), w);
  };
  return { vis, col: colGeo, heights, n, heightAt };
}

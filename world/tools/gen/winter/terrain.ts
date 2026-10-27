import * as THREE from 'three';
import { fbm, lerp, smoothstep, clamp } from '../rng.js';
import { distToPolyline } from '../geo.js';
import { heightFn as alphaHeight, type TerrainOut } from '../terrain.js';
import { WINTER, OFFSET, ICE_Y, RIVER, RIVER_W, BIVOUAC, BEACONS, EAGLE, CITY, KREMLIN, REDSQ, GORGE, CAVERN, PATHS } from './layout.js';

const S = WINTER.seed;
const WL = WINTER.waterLevel;
const GORGE_LINE = RIVER.slice(GORGE.from, GORGE.to + 1);

function bump(x: number, z: number, cx: number, cz: number, r: number) {
  const d = Math.hypot(x - cx, z - cz) / r;
  return d >= 1 ? 0 : 0.5 + 0.5 * Math.cos(Math.PI * d);
}

/** Distance from the frozen river's centre line. */
export const riverD = (x: number, z: number) => distToPolyline(x, z, RIVER) + fbm(x * 0.03, z * 0.03, 2, S + 7) * 3;

function natural(x: number, z: number) {
  let h = 6 + fbm(x * 0.006, z * 0.006, 4, S) * 7 + fbm(x * 0.04, z * 0.04, 2, S + 9) * 0.9;
  // snowfield knolls under each beacon, and a low ridge the beacons look along
  for (const [bx, bz] of BEACONS) h += bump(x, z, bx, bz, 36) * 9;
  h += bump(x, z, -240, 10, 110) * 6;
  // Borovitsky hill under the city
  h += bump(x, z, CITY.c[0], CITY.c[1], 170) * 6;
  // mountains around all four edges; the south one is notched for the river from the ice seam
  const m = Math.max(Math.abs(x), Math.abs(z));
  const notch = (1 - smoothstep(30, 70, Math.abs(x))) * smoothstep(200, 300, z);
  h += smoothstep(292, 352, m) * (1 - notch) * (50 + fbm(x * 0.018 + 7, z * 0.018, 4, S + 3) * 26);
  return h;
}

export function heightFn(x: number, z: number): number {
  let h = natural(x, z);
  // the gorge: cliffs crowd in on both sides of the river's last reach
  {
    const dg = distToPolyline(x, z, GORGE_LINE);
    const k = smoothstep(RIVER_W + 2, RIVER_W + 10, dg) * (1 - smoothstep(RIVER_W + 40, RIVER_W + 90, dg));
    h = Math.max(h, lerp(h, 30 + fbm(x * 0.05, z * 0.05, 3, S + 11) * 8, k));
  }
  // the ice cavern at the head of the gorge: a bowl of ice under a rock roof (the roof is a structure)
  {
    const d = Math.hypot(x - CAVERN.c[0], z - CAVERN.c[1]);
    h = lerp(ICE_Y, h, smoothstep(CAVERN.r - 4, CAVERN.r + 6, d));
  }
  // the frozen river: a flat sheet of ice with snowy banks
  {
    const d = riverD(x, z);
    h = lerp(ICE_Y, h, smoothstep(RIVER_W - 4, RIVER_W + 6, d));
  }
  // the bivouac shelf
  {
    const d = Math.hypot(x - BIVOUAC.c[0], (z - BIVOUAC.c[1]) * 0.9);
    h = lerp(h, BIVOUAC.y + fbm(x * 0.05, z * 0.05, 2, S + 4) * 0.4, 1 - smoothstep(50, 80, d));
  }
  // the eagle cairn sits in a hollow between the beacons
  h = lerp(h, natural(EAGLE.c[0], EAGLE.c[1]) - 1, (1 - smoothstep(6, 22, Math.hypot(x - EAGLE.c[0], z - EAGLE.c[1]))));
  // the city terrace: Kremlin, Red Square and the burnt quarter around them
  {
    const dx = Math.max(0, Math.abs(x - 30) - 92), dz = Math.max(0, Math.abs(z + 206) - 70);
    const d = Math.hypot(dx, dz);
    h = lerp(h, CITY.y + fbm(x * 0.04, z * 0.04, 2, S + 13) * 0.3 * smoothstep(0, 10, d), 1 - smoothstep(4, 60, d));
    const dk = Math.hypot(x - KREMLIN.c[0], z - KREMLIN.c[1]), dr = Math.max(Math.abs(x - REDSQ.c[0]) - REDSQ.w / 2, Math.abs(z - REDSQ.c[1]) - REDSQ.d / 2);
    h = lerp(h, CITY.y, Math.max(1 - smoothstep(KREMLIN.r + 2, KREMLIN.r + 8, dk), 1 - smoothstep(0, 6, dr)));
  }
  // south edge: meet 幻日谷's heights exactly where the regions join
  {
    const k = smoothstep(316, 360, z);
    if (k > 0) {
      const v = alphaHeight(x + OFFSET[0], z + OFFSET[1]);
      // in the river channel keep the ice level (the valley side is its frozen bay under an ice sheet)
      const ice = 1 - smoothstep(RIVER_W - 4, RIVER_W + 6, riverD(x, z));
      h = lerp(h, lerp(v, ICE_Y, ice), k);
    }
  }
  return h;
}

const C = {
  snowA: new THREE.Color('#f4f7fc'),
  snowB: new THREE.Color('#e3ebf6'),
  snowBlue: new THREE.Color('#cddcf0'),
  ice: new THREE.Color('#bfe3f4'),
  iceDeep: new THREE.Color('#8fc8e6'),
  rock: new THREE.Color('#8a90a8'),
  rockDark: new THREE.Color('#5c627c'),
  road: new THREE.Color('#b9b2aa'),
  cobble: new THREE.Color('#a7a2a6'),
  ash: new THREE.Color('#6d6566'),
  camp: new THREE.Color('#d8d2c8'),
};

export function buildWinterTerrain(): TerrainOut {
  const { half, cell } = WINTER;
  const n = Math.round((half * 2) / cell) + 1;
  const heights = new Float32Array(n * n);
  const pos = new Float32Array(n * n * 3);
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const k = j * n + i, x = -half + i * cell, z = -half + j * cell;
      heights[k] = heightFn(x, z);
      pos[k * 3] = x; pos[k * 3 + 1] = heights[k]; pos[k * 3 + 2] = z;
    }
  const idx: number[] = [];
  for (let j = 0; j < n - 1; j++)
    for (let i = 0; i < n - 1; i++) {
      const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  const vis = new THREE.BufferGeometry();
  vis.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  vis.setIndex(idx);
  vis.computeVertexNormals();

  const nor = vis.attributes.normal as THREE.BufferAttribute;
  const col = new Float32Array(n * n * 3);
  const tmp = new THREE.Color();
  for (let k = 0; k < n * n; k++) {
    const x = pos[k * 3], y = pos[k * 3 + 1], z = pos[k * 3 + 2];
    const ny = nor.getY(k);
    const v = fbm(x * 0.03, z * 0.03, 3, S + 21);
    tmp.copy(v > 0.15 ? C.snowB : v < -0.2 ? C.snowBlue : C.snowA);
    if (y < ICE_Y + 0.3) tmp.copy(C.ice).lerp(C.iceDeep, clamp(0.5 + fbm(x * 0.05, z * 0.05, 2, S + 22), 0, 1) * 0.6);
    const dCity = Math.hypot(Math.max(0, Math.abs(x - 30) - 92), Math.max(0, Math.abs(z + 206) - 70));
    if (dCity < 2 + v * 6 && y > ICE_Y + 1) tmp.copy(C.cobble).lerp(C.ash, clamp(0.5 - v, 0, 1) * 0.6);
    if (Math.hypot(x - BIVOUAC.c[0], (z - BIVOUAC.c[1]) * 0.9) < 46 + v * 8) tmp.lerp(C.camp, 0.6);
    const dPath = Math.min(...PATHS.map((p) => distToPolyline(x, z, p)));
    if (dPath < 2.2 + v && y > ICE_Y + 0.4) tmp.copy(C.road);
    if (ny < 0.72) tmp.copy(ny < 0.5 ? C.rockDark : C.rock);
    if (ny < 0.72 && v > 0.1 && ny > 0.45) tmp.lerp(C.snowB, 0.5); // snow caught on ledges
    col[k * 3] = tmp.r; col[k * 3 + 1] = tmp.g; col[k * 3 + 2] = tmp.b;
  }
  vis.setAttribute('color', new THREE.BufferAttribute(col, 3));

  const colGeo = new THREE.BufferGeometry();
  colGeo.setAttribute('position', new THREE.BufferAttribute(pos.slice(), 3));
  colGeo.setIndex(idx.slice());
  const heightAt = (x: number, z: number) => {
    const fi = clamp((x + half) / cell, 0, n - 1.001), fj = clamp((z + half) / cell, 0, n - 1.001);
    const i = Math.floor(fi), j = Math.floor(fj), u = fi - i, w = fj - j;
    return lerp(lerp(heights[j * n + i], heights[j * n + i + 1], u), lerp(heights[(j + 1) * n + i], heights[(j + 1) * n + i + 1], u), w);
  };
  return { vis, col: colGeo, heights, n, heightAt };
}

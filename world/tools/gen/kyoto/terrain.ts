import * as THREE from 'three';
import { fbm, lerp, smoothstep, clamp } from '../rng.js';
import { distToPolyline } from '../geo.js';
import { heightFn as alphaHeight, type TerrainOut } from '../terrain.js';
import {
  KYOTO, OFFSET, CITY_Y, TORII_PATH, SEAM_Y, STREETS_X, STREETS_Z, STREET_W, HONNOJI, KAMO, KAMO_W, KAMO_BANK,
  SANNEN, KIYOMIZU, POND, ISLES, PAVILION, AKECHI, PATHS, YASAKA, INARI,
} from './layout.js';

const S = KYOTO.seed;

function bump(x: number, z: number, cx: number, cz: number, r: number) {
  const d = Math.hypot(x - cx, z - cz) / r;
  return d >= 1 ? 0 : 0.5 + 0.5 * Math.cos(Math.PI * d);
}

/** Distance from the Kamo River's centre line. */
export const kamoD = (x: number, z: number) => distToPolyline(x, z, KAMO) + fbm(x * 0.03, z * 0.03, 2, S + 7) * 2;
/** Normalised distance from the pond's centre (1 = the waterline). */
export const pondD = (x: number, z: number) =>
  Math.hypot((x - POND.c[0]) / POND.rx, (z - POND.c[1]) / POND.rz) + fbm(x * 0.06, z * 0.06, 2, S + 17) * 0.06;
/** Inside the Honnō-ji compound walls (pad widens the square). */
export const inHonnoji = (x: number, z: number, pad = 0) =>
  Math.max(Math.abs(x - HONNOJI.c[0]), Math.abs(z - HONNOJI.c[1])) < HONNOJI.half + pad;
/** The city's walled square of streets (洛中). */
export const CITY_RECT = [STREETS_X[0] - 10, STREETS_X[STREETS_X.length - 1] + 10, STREETS_Z[0] - 10, STREETS_Z[STREETS_Z.length - 1] + 10] as const;
export const onStreet = (x: number, z: number, pad = 0) =>
  x > CITY_RECT[0] && x < CITY_RECT[1] && z > CITY_RECT[2] && z < CITY_RECT[3] &&
  (STREETS_X.some((sx) => Math.abs(x - sx) < STREET_W / 2 + pad) || STREETS_Z.some((sz) => Math.abs(z - sz) < STREET_W / 2 + pad));

/** Sannenzaka: road height along its points, and distance from it. */
export function sannen(x: number, z: number): { d: number; y: number } {
  let best = { d: Infinity, y: 0 };
  for (let i = 0; i < SANNEN.length - 1; i++) {
    const [ax, az, ay] = SANNEN[i], [bx, bz, by] = SANNEN[i + 1];
    const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
    const t = clamp(((x - ax) * dx + (z - az) * dz) / l2, 0, 1);
    const d = Math.hypot(x - ax - dx * t, z - az - dz * t);
    if (d < best.d) best = { d, y: lerp(ay, by, t) };
  }
  return best;
}
/** Floor of the torii tunnel: the seam height at the boundary, down to street level at the Inari gate. */
export const toriiFloor = (z: number) => lerp(SEAM_Y, CITY_Y + 0.4, smoothstep(-360, -246, z));

function natural(x: number, z: number) {
  let h = CITY_Y + 1 + fbm(x * 0.006, z * 0.006, 4, S) * 4 + fbm(x * 0.04, z * 0.04, 2, S + 9) * 0.6;
  // the basin: Higashiyama to the east, the western hills (Nishiyama), Kitayama and Kinugasa to the north
  h += smoothstep(186, 330, x) * (34 + fbm(x * 0.02, z * 0.02, 3, S + 2) * 10);
  h += smoothstep(-200, -320, x) * (26 + fbm(x * 0.02, z * 0.02, 3, S + 4) * 8);
  h += smoothstep(-230, -330, z) * (20 + fbm(x * 0.02 + 3, z * 0.02, 3, S + 5) * 8);
  h += bump(x, z, -215, -268, 70) * 18; // Kinugasa-yama behind the Golden Pavilion
  h += bump(x, z, 40, -296, 70) * 14; // Inari-yama around the torii tunnel
  // mountains around all four edges, notched where the torii tunnel comes in from the valley
  const m = Math.pow(Math.pow(Math.abs(x), 4) + Math.pow(Math.abs(z), 4), 0.25);
  const notch = (1 - smoothstep(16, 40, Math.abs(x - 40))) * smoothstep(-250, -300, z);
  h += smoothstep(296, 352, m) * (1 - notch * 0.75) * (48 + fbm(x * 0.018 + 7, z * 0.018, 4, S + 3) * 24);
  return h;
}

export function heightFn(x: number, z: number): number {
  let h = natural(x, z);
  // the torii tunnel: a narrow floor between the slopes of Inari-yama
  {
    const d = distToPolyline(x, z, TORII_PATH);
    h = lerp(toriiFloor(z), h, smoothstep(3.5, 12, d));
    const dg = Math.hypot(x - INARI.gate[0], z - INARI.gate[1]);
    h = lerp(CITY_Y + 0.4, h, smoothstep(10, 24, dg));
  }
  // the city: a level grid of streets and blocks
  {
    const dx = Math.max(0, CITY_RECT[0] - x, x - CITY_RECT[1]), dz = Math.max(0, CITY_RECT[2] - z, z - CITY_RECT[3]);
    const d = Math.hypot(dx, dz);
    h = lerp(CITY_Y + fbm(x * 0.05, z * 0.05, 2, S + 13) * 0.15 * smoothstep(0, 10, d), h, smoothstep(2, 36, d));
  }
  // Higashiyama: the Sannenzaka steps, the Yasaka pagoda's pad, Kiyomizu's terrace and the ravine under the stage
  {
    const r = sannen(x, z);
    h = lerp(r.y, h, smoothstep(3.5, 12, r.d));
    h = lerp(h, natural(YASAKA.c[0], YASAKA.c[1]), 1 - smoothstep(8, 14, Math.hypot(x - YASAKA.c[0], z - YASAKA.c[1])));
    const [x0, x1, z0, z1] = KIYOMIZU.terrace;
    const dt = Math.hypot(Math.max(0, x0 - x, x - x1), Math.max(0, z0 - z, z - z1));
    h = lerp(KIYOMIZU.y, h, smoothstep(1, 14, dt));
    const dr = Math.hypot(x - 256, z - 78);
    h = Math.min(h, lerp(14, h, smoothstep(6, 22, dr)));
  }
  // the Akechi camp: a shelf on the western hills
  {
    const d = Math.hypot(x - AKECHI.c[0], (z - AKECHI.c[1]) * 0.85);
    h = lerp(AKECHI.y + fbm(x * 0.05, z * 0.05, 2, S + 4) * 0.3, h, smoothstep(30, 56, d));
  }
  // Honnō-ji: a raised platform inside its walls, ringed by a moat
  {
    const c = Math.max(Math.abs(x - HONNOJI.c[0]), Math.abs(z - HONNOJI.c[1])) - HONNOJI.half;
    if (c < 0) h = CITY_Y + 0.6;
    else if (c < HONNOJI.moat) h = lerp(lerp(-0.6, CITY_Y + 0.6, 1 - smoothstep(0, 0.6, c)), CITY_Y, smoothstep(HONNOJI.moat - 0.6, HONNOJI.moat, c));
  }
  // Kinkaku-ji: the pond (with its islands) at the foot of Kinugasa
  {
    const d = pondD(x, z);
    h = lerp(-0.8, lerp(1.7, h, smoothstep(1.15, 1.9, d)), smoothstep(0.82, 1.0, d));
    for (const isle of ISLES) h = Math.max(h, lerp(2.0, -1, smoothstep(isle.r - 1.5, isle.r + 2, Math.hypot(x - isle.c[0], z - isle.c[1]))));
    // the pavilion stands on a stone footing at the north shore
    const dp = Math.max(Math.abs(x - PAVILION.c[0]) - PAVILION.w / 2 - 2, Math.abs(z - PAVILION.c[1]) - PAVILION.d / 2 - 2);
    h = Math.max(h, lerp(1.8, -1, smoothstep(0, 1.5, dp)));
  }
  // the Kamo River: a wide gravel riverbed with a shallow, wadeable stream down the middle
  {
    const d = kamoD(x, z);
    h = lerp(1.7 + smoothstep(KAMO_W, KAMO_BANK, d) * 0.6, h, smoothstep(KAMO_BANK - 2, KAMO_BANK + 10, d));
    h = Math.min(h, lerp(0.35, h, smoothstep(KAMO_W - 3, KAMO_W + 1, d)));
  }
  // north edge: meet 幻日谷's heights exactly where the regions join
  {
    const k = smoothstep(-316, -360, z);
    if (k > 0) {
      const v = alphaHeight(x + OFFSET[0], z + OFFSET[1]);
      const tunnel = 1 - smoothstep(3.5, 12, distToPolyline(x, z, TORII_PATH));
      h = lerp(h, lerp(v, toriiFloor(z), tunnel), k);
    }
  }
  return h;
}

const C = {
  grassA: new THREE.Color('#7f9a5e'),
  grassB: new THREE.Color('#6d8a52'),
  moss: new THREE.Color('#5f8a5a'),
  earth: new THREE.Color('#b49a78'),
  street: new THREE.Color('#a89878'),
  gravel: new THREE.Color('#c9c2b2'),
  stone: new THREE.Color('#a39d92'),
  rock: new THREE.Color('#7d7a86'),
  rockDark: new THREE.Color('#5d5a66'),
  ash: new THREE.Color('#5a5050'),
  forest: new THREE.Color('#4d6e48'),
};

export function buildKyotoTerrain(): TerrainOut {
  const { half, cell } = KYOTO;
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
    tmp.copy(v > 0.15 ? C.grassB : C.grassA);
    if (y > 18 && v < 0.1) tmp.lerp(C.forest, 0.6);
    if (onStreet(x, z) || inHonnoji(x, z, 0.5)) tmp.copy(C.street).lerp(C.ash, inHonnoji(x, z) ? 0.35 : clamp(-v, 0, 0.3));
    const dk = kamoD(x, z);
    if (dk < KAMO_BANK - 1 + v * 3) tmp.copy(C.gravel).lerp(C.stone, clamp(0.5 + v, 0, 1) * 0.5);
    if (pondD(x, z) < 1.12 && y > 1.2) tmp.copy(C.moss);
    const dPath = Math.min(...PATHS.map((p) => distToPolyline(x, z, p)), distToPolyline(x, z, TORII_PATH), sannen(x, z).d);
    if (dPath < 2.6 + v && y > 1.4) tmp.copy(C.earth);
    if (ny < 0.72) tmp.copy(ny < 0.5 ? C.rockDark : C.rock);
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

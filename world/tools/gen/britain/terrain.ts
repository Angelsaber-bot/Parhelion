import * as THREE from 'three';
import { fbm, lerp, smoothstep, clamp } from '../rng.js';
import { distToPolyline } from '../geo.js';
import { heightFn as alphaHeight, type TerrainOut } from '../terrain.js';
import { BRITAIN, OFFSET, SEAM_Z, LAKE, ISLET, KCAMP, CASTLE, CAMLANN, CORE, PATHS } from './layout.js';

const S = BRITAIN.seed;
const WL = BRITAIN.waterLevel;

function bump(x: number, z: number, cx: number, cz: number, r: number) {
  const d = Math.hypot(x - cx, z - cz) / r;
  return d >= 1 ? 0 : 0.5 + 0.5 * Math.cos(Math.PI * d);
}

function natural(x: number, z: number) {
  let h = 6 + fbm(x * 0.006, z * 0.006, 4, S) * 10 + fbm(x * 0.04, z * 0.04, 2, S + 9) * 1.2;
  h += bump(x, z, -40, -60, 70) * 8 + bump(x, z, 250, 150, 80) * 14 + bump(x, z, 80, -260, 70) * 12 + bump(x, z, 250, -150, 60) * 10;
  // mountain ring, opened on the east where the seam gorge comes in from 幻日谷
  const se = Math.pow(Math.pow(Math.abs(x), 4) + Math.pow(Math.abs(z), 4), 0.25);
  const notch = (1 - smoothstep(18, 46, Math.abs(z - SEAM_Z))) * smoothstep(250, 320, x);
  h += smoothstep(296, 356, se) * (1 - notch * 0.9) * (52 + fbm(x * 0.018 + 7, z * 0.018, 4, S + 3) * 26);
  return h;
}

export function heightFn(x: number, z: number): number {
  let h = natural(x, z);
  // Camelot plateau: walled town on a flat top, slopes all round (the road climbs from the south-east)
  {
    const d = Math.hypot(x - CASTLE.c[0], z - CASTLE.c[1]);
    h = lerp(h, CASTLE.top + fbm(x * 0.05, z * 0.05, 2, S + 4) * 0.6, 1 - smoothstep(CASTLE.r + 4, CASTLE.r + 72, d));
    h = lerp(h, CASTLE.top, 1 - smoothstep(CASTLE.r + 1, CASTLE.r + 6, d));
  }
  // knights' camp meadow
  {
    const d = Math.hypot(x - KCAMP.c[0], z - KCAMP.c[1]);
    h = lerp(h, natural(KCAMP.c[0], KCAMP.c[1]), 1 - smoothstep(KCAMP.r, KCAMP.r + 22, d));
  }
  // Camlann: a wide, low, burnt basin with a mound for the sun core
  {
    const d = Math.hypot(x - CAMLANN.c[0], z - CAMLANN.c[1]);
    h = lerp(h, 4.5 + fbm(x * 0.03, z * 0.03, 2, S + 5) * 1.8, 1 - smoothstep(CAMLANN.r - 25, CAMLANN.r + 25, d));
    h += bump(x, z, CORE.c[0], CORE.c[1], 26) * 2.5;
  }
  // Lake of the Sword with its islet
  {
    const d = Math.hypot(x - LAKE.c[0], z - LAKE.c[1]) + fbm(x * 0.04, z * 0.04, 2, S + 11) * 7;
    h = Math.min(h, lerp(WL - 3, h, smoothstep(LAKE.r - 10, LAKE.r + 14, d)));
    const di = Math.hypot(x - ISLET.c[0], z - ISLET.c[1]);
    h = Math.max(h, lerp(WL + 1.8, h, smoothstep(ISLET.r - 2, ISLET.r + 5, di)));
  }
  // east edge: meet 幻日谷's heights exactly so the seam gorge has no step
  {
    const k = smoothstep(316, 360, x);
    if (k > 0) h = lerp(h, alphaHeight(x + OFFSET[0], z + OFFSET[1]), k);
  }
  return h;
}

const C = {
  grassA: new THREE.Color('#a8c46a'),
  grassB: new THREE.Color('#8db45f'),
  grassDry: new THREE.Color('#c8b878'),
  dirt: new THREE.Color('#c69563'),
  sand: new THREE.Color('#e2cc98'),
  rock: new THREE.Color('#a093ad'),
  rockDark: new THREE.Color('#6f6488'),
  snow: new THREE.Color('#f4e8ee'),
  bed: new THREE.Color('#6c9c97'),
  ash: new THREE.Color('#6b5853'),
  ashLight: new THREE.Color('#8a766c'),
  pave: new THREE.Color('#cdbfa8'),
};

export function buildBritainTerrain(): TerrainOut {
  const { half, cell } = BRITAIN;
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
  const _ash = new THREE.Color();
  for (let k = 0; k < n * n; k++) {
    const x = pos[k * 3], y = pos[k * 3 + 1], z = pos[k * 3 + 2];
    const ny = nor.getY(k);
    const v = fbm(x * 0.03, z * 0.03, 3, S + 21);
    if (y < WL - 0.6) tmp.copy(C.bed);
    else if (y < WL + 0.9) tmp.copy(C.sand);
    else tmp.copy(v > 0.12 ? C.grassB : v < -0.25 ? C.grassDry : C.grassA);
    const dCam = Math.hypot(x - CAMLANN.c[0], z - CAMLANN.c[1]);
    const burn = 1 - smoothstep(CAMLANN.r - 30 + v * 24, CAMLANN.r + 4 + v * 24, dCam);
    if (burn > 0) tmp.lerp(_ash.copy(C.ash).lerp(C.ashLight, smoothstep(-0.3, 0.3, v)), burn);
    if (Math.hypot(x - CASTLE.c[0], z - CASTLE.c[1]) < CASTLE.r - 1) tmp.copy(C.pave);
    const dPath = Math.min(...PATHS.map((p) => distToPolyline(x, z, p)));
    if (dPath < 2.2 + v && y > WL + 0.5) tmp.copy(C.dirt);
    if (ny < 0.72) tmp.copy(ny < 0.5 ? C.rockDark : C.rock);
    if (y > 60 + v * 10 && ny > 0.55) tmp.copy(C.snow);
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

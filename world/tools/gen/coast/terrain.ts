import * as THREE from 'three';
import { fbm, lerp, smoothstep, clamp } from '../rng.js';
import { distToPolyline, distToSegment } from '../geo.js';
import { heightFn as alphaHeight, type TerrainOut } from '../terrain.js';
import { COAST, OFFSET, shoreX, shoreZ, BAY, CRATER, HEADLAND, PLATEAU, TEMPLE, STAIRS, VILLAGE, PATHS } from './layout.js';

const S = COAST.seed;
const WL = COAST.waterLevel;

function bump(x: number, z: number, cx: number, cz: number, r: number) {
  const d = Math.hypot(x - cx, z - cz) / r;
  return d >= 1 ? 0 : 0.5 + 0.5 * Math.cos(Math.PI * d);
}

/** Distance inland from the coastline (negative = sea). */
export function coastD(x: number, z: number) {
  let d = Math.min(x - shoreX(z), shoreZ(x) - z) + fbm(x * 0.02, z * 0.02, 3, S + 2) * 8;
  d -= bump(x, z, BAY.c[0], BAY.c[1], BAY.r) * 26; // Whitesand Bay cove
  return d;
}

/** 0 at the cliff foot, 1 on the temple plateau. */
export function plateauMask(x: number, z: number) {
  const inStairs = z > STAIRS.z0 - 12 && z < STAIRS.z1 + 12;
  const edge = inStairs ? PLATEAU.edge : PLATEAU.edge + fbm(z * 0.02, 3.7, 2, S + 6) * 7;
  return smoothstep(edge - 3, edge + 3, x) * (1 - smoothstep(96, 150, z));
}

function natural(x: number, z: number) {
  const d = coastD(x, z);
  let h: number;
  if (d < 0) h = Math.max(-12, WL - 0.8 + d * 0.1);
  else {
    const beach = WL - 0.8 + smoothstep(0, 26, d) * 3.4;
    const inland = smoothstep(18, 140, d) * 10 + fbm(x * 0.008, z * 0.008, 4, S) * 7 * smoothstep(10, 60, d)
      + fbm(x * 0.045, z * 0.045, 2, S + 9) * 1.1 * smoothstep(10, 30, d);
    h = beach + inland;
  }
  // eastern cliff plateau (sky temple)
  h = lerp(h, PLATEAU.top + fbm(x * 0.03, z * 0.03, 2, S + 4) * 2, plateauMask(x, z));
  // mountains along the north and east edges (the sea side stays open)
  const m = Math.max(x, -z * 1.04, Math.pow(Math.pow(Math.max(x, 0), 4) + Math.pow(Math.max(-z, 0), 4), 0.25));
  const ring = smoothstep(176, 236, m) * smoothstep(-60, 0, d);
  h += ring * (50 + fbm(x * 0.018 + 7, z * 0.018, 4, S + 3) * 26);
  return h;
}

export function heightFn(x: number, z: number): number {
  let h = natural(x, z);

  // Starfall crater: bowl with a raised rim
  {
    const dc = Math.hypot(x - CRATER.c[0], z - CRATER.c[1]) + fbm(x * 0.06, z * 0.06, 2, S + 12) * 2.5;
    const R = CRATER.R;
    if (dc < R) h = lerp(CRATER.floor, h + 6, Math.pow(dc / R, 2.2));
    else h += 6 * Math.exp(-Math.pow((dc - R) / 10, 2));
  }
  // lighthouse headland: a ridge that rises out of the sea to a cliff-top
  {
    const [a, b] = [HEADLAND.a, HEADLAND.b];
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const t = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz), 0, 1);
    const dh = distToSegment(x, z, a, b) + fbm(x * 0.05, z * 0.05, 2, S + 14) * 3;
    const r = HEADLAND.r * lerp(0.8, 1.1, smoothstep(0.6, 1, t));
    const top = lerp(4, 13, smoothstep(0.1, 0.75, t)) + fbm(x * 0.04, z * 0.04, 2, S + 15) * 1.2;
    h = Math.max(h, lerp(top, h, smoothstep(r - 7, r + 1, dh)));
  }
  // ridge from the lighthouse west to the mountain pass into 幻日谷
  {
    const a: [number, number] = [HEADLAND.b[0], HEADLAND.b[1]], b: [number, number] = [-246, HEADLAND.b[1]];
    const t = clamp((a[0] - x) / (a[0] - b[0]), 0, 1);
    const dr = distToSegment(x, z, a, b) + fbm(x * 0.05, z * 0.05, 2, S + 16) * 2;
    const top = lerp(13, 16, t);
    h = Math.max(h, lerp(top, h, smoothstep(9, 15, dr)));
  }
  // west edge: blend into 幻日谷's eastern mountains so the two terrains meet without a seam
  {
    const k = smoothstep(-196, -240, x);
    if (k > 0) h = lerp(h, alphaHeight(x + OFFSET[0], z + OFFSET[1]), k);
  }
  // temple terrace on the plateau
  {
    const d = Math.hypot(x - TEMPLE.c[0], z - TEMPLE.c[1]);
    h = lerp(h, PLATEAU.top + 1, 1 - smoothstep(TEMPLE.r, TEMPLE.r + 10, d));
  }
  // pier village flat
  {
    const d = Math.hypot(x - VILLAGE.c[0], z - VILLAGE.c[1]);
    h = lerp(h, Math.max(h, WL + 2.2), (1 - smoothstep(16, 30, d)) * 0.8);
  }
  return h;
}

const C = {
  grassA: new THREE.Color('#8fd36b'),
  grassB: new THREE.Color('#6cc062'),
  grassDry: new THREE.Color('#bcd877'),
  dirt: new THREE.Color('#d6b27a'),
  sand: new THREE.Color('#f3e2b0'),
  sandWet: new THREE.Color('#d9c38f'),
  rock: new THREE.Color('#9a98b8'),
  rockDark: new THREE.Color('#6f6d93'),
  crater: new THREE.Color('#8f7fb6'),
  craterGlow: new THREE.Color('#9fd8f0'),
  snow: new THREE.Color('#f1f5ff'),
  bed: new THREE.Color('#7fc2b8'),
  deep: new THREE.Color('#4f8fa8'),
};

export function buildCoastTerrain(): TerrainOut {
  const { half, cell } = COAST;
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
    const d = coastD(x, z);
    const dc = Math.hypot(x - CRATER.c[0], z - CRATER.c[1]);
    if (y < WL - 3) tmp.copy(C.deep);
    else if (y < WL - 0.5) tmp.copy(C.bed);
    else if (y < WL + 0.35) tmp.copy(C.sandWet);
    else if (d < 22 + v * 6 && y < WL + 3.6) tmp.copy(C.sand);
    else tmp.copy(v > 0.12 ? C.grassB : v < -0.25 ? C.grassDry : C.grassA);
    if (dc < CRATER.R - 2) tmp.copy(C.crater).lerp(C.craterGlow, (1 - smoothstep(4, 20, dc)) * 0.6);
    const dPath = Math.min(...PATHS.map((p) => distToPolyline(x, z, p)));
    if (dPath < 2.0 + v && y > WL + 0.5 && dc > CRATER.R - 6) tmp.copy(C.dirt);
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

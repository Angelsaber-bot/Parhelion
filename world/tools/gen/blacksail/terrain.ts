import * as THREE from 'three';
import { fbm, lerp, smoothstep, clamp } from '../rng.js';
import { distToPolyline, distToSegment } from '../geo.js';
import { heightFn as alphaHeight, type TerrainOut } from '../terrain.js';
import {
  BLACKSAIL, OFFSET, PASS_Z, PASS_Y, shoreX, shoreZ, PORT, FORT, VORTEX, REEF, SANDBAR, HEADLAND, PATHS, MEADOW, WRECK_SPIT, fortOutline,
} from './layout.js';

const S = BLACKSAIL.seed;
const OUTLINE = fortOutline();
const OUTLINE_LOOP = [...OUTLINE, OUTLINE[0]];
const WL = BLACKSAIL.waterLevel;

function bump(x: number, z: number, cx: number, cz: number, r: number) {
  const d = Math.hypot(x - cx, z - cz) / r;
  return d >= 1 ? 0 : 0.5 + 0.5 * Math.cos(Math.PI * d);
}

/** Distance inland from the coastline (negative = sea). */
export function coastD(x: number, z: number) {
  return Math.min(shoreZ(x) - z, shoreX(z) - x) + fbm(x * 0.02, z * 0.02, 3, S + 2) * 8;
}

function natural(x: number, z: number) {
  const d = coastD(x, z);
  let h: number;
  if (d < 0) h = Math.max(-14, WL - 0.8 + d * 0.12);
  else {
    const beach = WL - 0.8 + smoothstep(0, 24, d) * 3.6;
    const inland = smoothstep(18, 150, d) * 9 + fbm(x * 0.008, z * 0.008, 4, S) * 6 * smoothstep(10, 60, d)
      + fbm(x * 0.045, z * 0.045, 2, S + 9) * 1.1 * smoothstep(10, 30, d);
    h = beach + inland;
  }
  // rolling downs and a knoll by the windmill
  h += bump(x, z, MEADOW.c[0] + 30, MEADOW.c[1] - 34, 50) * 6 + bump(x, z, 40, -120, 70) * 8 * smoothstep(0, 40, d);
  // mountains along the north and west (land) edges; the pass road notches the west wall at z = 30
  const m = Math.max(-x, -z);
  const notch = (1 - smoothstep(16, 44, Math.abs(z - PASS_Z))) * smoothstep(-260, -330, x);
  h += smoothstep(296, 352, m) * smoothstep(-40, 10, d) * (1 - notch) * (50 + fbm(x * 0.018 + 7, z * 0.018, 4, S + 3) * 26);
  return h;
}

export function heightFn(x: number, z: number): number {
  let h = natural(x, z);
  // pass trail: a steady road from the saddle (y 16) down to the downs
  {
    const band = 1 - smoothstep(7, 15, Math.abs(z - PASS_Z));
    const road = lerp(PASS_Y, natural(-200, PASS_Z), smoothstep(-340, -210, x));
    h = lerp(h, road, band * smoothstep(-150, -230, x));
  }
  // storm vortex: a crater bowl with a raised rim
  {
    const dc = Math.hypot(x - VORTEX.c[0], z - VORTEX.c[1]) + fbm(x * 0.06, z * 0.06, 2, S + 12) * 2.5;
    if (dc < VORTEX.R) h = lerp(VORTEX.floor, h + 5, Math.pow(dc / VORTEX.R, 2.2));
    else h += 5 * Math.exp(-Math.pow((dc - VORTEX.R) / 10, 2));
  }
  // fort plateau on the sea cliff: a long ramp up from the gate side (south-west), sheer cliffs elsewhere
  // so the seaward battery can see down to the water
  {
    // signed distance to the star outline of the walls (negative inside)
    let inside = false;
    for (let i = 0, j = OUTLINE.length - 1; i < OUTLINE.length; j = i++) {
      const [xi, zi] = OUTLINE[i], [xj, zj] = OUTLINE[j];
      if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
    }
    const sd = (inside ? -1 : 1) * distToPolyline(x, z, OUTLINE_LOOP);
    const a = Math.atan2(z - FORT.c[1], x - FORT.c[0]);
    const off = Math.abs(Math.atan2(Math.sin(a - FORT.gateA), Math.cos(a - FORT.gateA)));
    const wide = 1 - smoothstep(0.7, 1.6, off);
    h = lerp(h, FORT.top + fbm(x * 0.05, z * 0.05, 2, S + 4) * 0.5, 1 - smoothstep(4, 10 + 54 * wide, sd));
    h = lerp(h, FORT.top, 1 - smoothstep(2.5, 5, sd));
  }
  // lighthouse headland: a ridge that runs out into the sea to a cliff-top
  {
    const [a, b] = [HEADLAND.a, HEADLAND.b];
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const t = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz), 0, 1);
    const dh = distToSegment(x, z, a, b) + fbm(x * 0.05, z * 0.05, 2, S + 14) * 3;
    const top = lerp(6, 12, smoothstep(0.1, 0.75, t)) + fbm(x * 0.04, z * 0.04, 2, S + 15) * 1.0;
    h = Math.max(h, lerp(top, h, smoothstep(HEADLAND.r - 6, HEADLAND.r + 2, dh)));
  }
  // Nassau terrace
  {
    const d = Math.hypot(x - PORT.c[0], (z - PORT.c[1]) * 1.3);
    h = lerp(h, PORT.y, 1 - smoothstep(48, 70, d));
  }
  // Skull Reef: a rocky islet and the sandbar that reaches it at low water
  {
    const dr = Math.hypot(x - REEF.c[0], z - REEF.c[1]) + fbm(x * 0.07, z * 0.07, 2, S + 17) * 4;
    h = Math.max(h, lerp(WL + 2.6 + fbm(x * 0.1, z * 0.1, 2, S + 18) * 0.8, h, smoothstep(REEF.r - 10, REEF.r, dr)));
    const ds = distToPolyline(x, z, [...SANDBAR, REEF.c]);
    h = Math.max(h, lerp(WL + 0.45, h, smoothstep(4, 9, ds)));
    // a narrower spit from the sandbar out towards the half-sunk merchantman
    const dw = distToPolyline(x, z, WRECK_SPIT);
    h = Math.max(h, lerp(WL + 0.45, h, smoothstep(2.5, 6, dw)));
  }
  // west edge: meet 幻日谷's heights exactly so the pass has no step
  {
    const k = smoothstep(-316, -360, x);
    if (k > 0) h = lerp(h, alphaHeight(x + OFFSET[0], z + OFFSET[1]), k);
  }
  return h;
}

const C = {
  grassA: new THREE.Color('#86c46a'),
  grassB: new THREE.Color('#68ad5f'),
  grassDry: new THREE.Color('#b8c978'),
  dirt: new THREE.Color('#c99f6a'),
  sand: new THREE.Color('#efdcaa'),
  sandWet: new THREE.Color('#cdb784'),
  rock: new THREE.Color('#8f93ac'),
  rockDark: new THREE.Color('#5f6584'),
  vortex: new THREE.Color('#5d6f8f'),
  vortexGlow: new THREE.Color('#9fe3f0'),
  snow: new THREE.Color('#eef2fb'),
  bed: new THREE.Color('#5fa6a4'),
  deep: new THREE.Color('#3b6f8f'),
  cobble: new THREE.Color('#b9a789'),
  reef: new THREE.Color('#d8c9a0'),
};

export function buildBlacksailTerrain(): TerrainOut {
  const { half, cell } = BLACKSAIL;
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
    const dv = Math.hypot(x - VORTEX.c[0], z - VORTEX.c[1]);
    if (y < WL - 3) tmp.copy(C.deep);
    else if (y < WL - 0.5) tmp.copy(C.bed);
    else if (y < WL + 0.35) tmp.copy(C.sandWet);
    else if (d < 22 + v * 6 && y < WL + 3.6) tmp.copy(C.sand);
    else tmp.copy(v > 0.12 ? C.grassB : v < -0.25 ? C.grassDry : C.grassA);
    if (dv < VORTEX.R - 2) tmp.copy(C.vortex).lerp(C.vortexGlow, (1 - smoothstep(4, 22, dv)) * 0.5);
    if (Math.hypot(x - PORT.c[0], (z - PORT.c[1]) * 1.3) < 46 + v * 6 && y > WL + 1.5) tmp.copy(C.cobble);
    if (Math.hypot(x - FORT.c[0], z - FORT.c[1]) < FORT.r - 1) tmp.copy(C.cobble);
    if (Math.hypot(x - REEF.c[0], z - REEF.c[1]) < REEF.r - 4 && y > WL + 1) tmp.copy(C.reef);
    const dPath = Math.min(...PATHS.map((p) => distToPolyline(x, z, p)));
    if (dPath < 2.0 + v && y > WL + 0.5 && dv > VORTEX.R - 6) tmp.copy(C.dirt);
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

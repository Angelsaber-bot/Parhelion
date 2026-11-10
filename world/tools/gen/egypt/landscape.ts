import * as THREE from 'three';
import { fbm, smoothstep, lerp } from '../rng';
import { distToSegment } from '../geo';
import type { ExpansionPlan } from '../../../src/map/worldPlan';
import { EGYPT_LAKE, EGYPT_RIVER, EGYPT_PLATEAU, EGYPT_CANYON, EGYPT_TEMPLE, EGYPT_PADS, EGYPT_ROOMS, EGYPT_CORRIDORS, egyptDistanceToPolyline } from '../../../src/map/egyptPlan';

const BASE = 14;
function inside(x: number, z: number, poly: readonly [number, number][]) {
  let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [ax, az] = poly[j], [bx, bz] = poly[i]; if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) c = !c; } return c;
}
/** Signed distance to the plateau escarpment: positive on top of the plateau. */
export function plateauDepth(x: number, z: number) {
  const poly = EGYPT_PLATEAU.edge; let d = Infinity;
  for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; d = Math.min(d, distToSegment(x, z, a, b)); }
  return inside(x, z, poly) ? d : -d;
}
export const egyptLakeDistance = (x: number, z: number) => Math.hypot((x - EGYPT_LAKE.x) / EGYPT_LAKE.rx, (z - EGYPT_LAKE.z) / EGYPT_LAKE.rz);
export const egyptRiver = (x: number, z: number) => egyptDistanceToPolyline(x, z, EGYPT_RIVER);
export const egyptCanyon = (x: number, z: number) => egyptDistanceToPolyline(x, z, EGYPT_CANYON);
/** Irrigated floodplain: fields either side of the river and round the lake. */
export function egyptGreen(x: number, z: number) {
  const r = egyptRiver(x, z).d, l = egyptLakeDistance(x, z);
  return Math.max(1 - smoothstep(14, 46, r), 1 - smoothstep(1.2, 2.4, l)) * (1 - smoothstep(-6, 4, plateauDepth(x, z)));
}

/** Desert, plateau, canyon, lake and river before roads and architecture. */
export function egyptNaturalHeight(x: number, z: number): number {
  let y = BASE + fbm(x * .007 + 11, z * .007 - 3, 4, 3301) * 3;
  // 台地: a sandstone tableland with banded cliffs; higher toward the north.
  const depth = plateauDepth(x, z), wobble = fbm(x * .03, z * .03, 3, 3307) * 5;
  const top = 30 + 10 * smoothstep(30, 150, depth) + fbm(x * .012, z * .012, 3, 3311) * 1.5;
  // Toward the Black Sail and Kyoto joins the escarpment relaxes into a broken slope,
  // so no straight wall runs parallel to a seam; the southern face stays sheer.
  const soft = Math.max(smoothstep(-210, -290, z), smoothstep(-200, -255, x));
  const cliffW = EGYPT_PLATEAU.cliff + 16 * soft;
  const rise = smoothstep(-cliffW, cliffW, depth + wobble * (1 + soft));
  // strata: the cliff steps in hard bands rather than one smooth ramp
  const banded = rise < .98 && rise > .02 ? Math.round(rise * 5) / 5 * .6 + rise * .4 : rise;
  y = lerp(y, top, banded);
  // 沙丘: wind-shaped dunes in the open desert, crests running north-east
  const open = 1 - smoothstep(-30, 0, depth);
  const dune = Math.pow(Math.abs(Math.sin((x * .6 + z * .8) * .045 + fbm(x * .01, z * .01, 2, 3313) * 3)), 2.2) * 4.5 * smoothstep(-.2, .5, fbm(x * .006, z * .006, 2, 3317));
  y += dune * open * (1 - egyptGreen(x, z));
  // 裂日峡谷: a flat sandy floor between near-vertical walls
  const c = egyptCanyon(x, z), cw = 7 + 3 * Math.sin(c.t * 9);
  y = lerp(y, Math.min(y, c.y), 1 - smoothstep(cw, cw + 4.5, c.d));
  // lake basin and river channel
  const l = egyptLakeDistance(x, z);
  y = lerp(y, EGYPT_LAKE.surface + 1.1, 1 - smoothstep(1, 1.9, l));
  y = lerp(y, EGYPT_LAKE.surface - 1.6, 1 - smoothstep(.75, 1, l));
  const r = egyptRiver(x, z);
  y = lerp(y, r.y + 1.3, 1 - smoothstep(10, 40, r.d) * 1);
  y = lerp(y, r.y - 1.3, 1 - smoothstep(3, 5.5, r.d));
  return y;
}

export function egyptAuthoredHeight(plan: ExpansionPlan, x: number, z: number): number {
  let y = egyptNaturalHeight(x, z);
  for (const [px, py, pz, r] of EGYPT_PADS) y = lerp(y, py, 1 - smoothstep(r, r + 22, Math.hypot(x - px, z - pz)));
  // Temple terrace: ground sits just under the platform top; higher ground is cut back.
  { const [x0, x1, z0, z1, top] = EGYPT_TEMPLE.terrace, d = Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(z0 - z, 0, z - z1));
    if (d === 0) y = top - .35; else if (y > top) y = lerp(top, y, smoothstep(0, 12, d)); else y = lerp(Math.min(y, top - .35), y, smoothstep(0, 5, d)); }
  for (const route of plan.routes.filter(r => r.kind === 'main' || r.kind === 'flank')) for (let i = 1; i < route.points.length; i++) {
    const a = route.points[i - 1], b = route.points[i], dx = b[0] - a[0], dz = b[2] - a[2];
    const t = THREE.MathUtils.clamp(((x - a[0]) * dx + (z - a[2]) * dz) / (dx * dx + dz * dz || 1), 0, 1);
    const d = distToSegment(x, z, [a[0], a[2]], [b[0], b[2]]), target = lerp(a[1], b[1], t) - .05;
    if (egyptRiver(x, z).d < 5 && target > y) continue;
    y = lerp(y, target, 1 - smoothstep(4.5, 13, d));
  }
  // The tomb and its incline stay buried in the plateau.
  for (const r of EGYPT_ROOMS) { const d = Math.hypot(Math.max(r.x0 - x, 0, x - r.x1), Math.max(r.z0 - z, 0, z - r.z1)); if (d < 14) y = Math.max(y, lerp(r.floor + r.height + 6, y, smoothstep(5, 14, d))); }
  for (const c of EGYPT_CORRIDORS) { const half = c.width / 2, zMin = Math.min(c.a[2], c.b[2]), zMax = Math.max(c.a[2], c.b[2]); if (Math.abs(x - c.a[0]) < half + 10 && z > zMin - 4 && z < zMax && z < c.a[2] - 12) y = Math.max(y, lerp(c.a[1] + c.height + 5, y, smoothstep(half + 3, half + 10, Math.abs(x - c.a[0])))); }
  return y;
}

/** Terrain cells over the tomb incline that would sit inside it drop below its floor. */
export function egyptTunnelCut(x: number, z: number): { cut: number; roof: number } | null {
  for (const c of EGYPT_CORRIDORS) {
    const zMin = Math.min(c.a[2], c.b[2]), zMax = Math.max(c.a[2], c.b[2]);
    if (Math.abs(x - c.a[0]) > c.width / 2 + 1.4 || z < zMin || z > zMax) continue;
    const t = (z - c.a[2]) / (c.b[2] - c.a[2]), floor = c.a[1] + (c.b[1] - c.a[1]) * t;
    return { cut: floor - .25, roof: floor + c.height + 1.2 };
  }
  return null;
}

/** Sand, sandstone, irrigated green and paths. */
export function egyptTerrainColor(x: number, y: number, z: number, roadDistance: number): THREE.Color {
  const n = fbm(x * .05, z * .05, 3, 3321), depth = plateauDepth(x, z);
  const c = new THREE.Color(n > .15 ? '#d9b97c' : n < -.2 ? '#c99f62' : '#d3ae70');
  // sandstone faces: banded ochre and rose on the cliffs and canyon walls
  const cliff = Math.max(1 - smoothstep(3, 12, Math.abs(depth)), 1 - smoothstep(6, 11, egyptCanyon(x, z).d)) * smoothstep(16, 20, y);
  c.lerp(new THREE.Color(Math.floor(y / 1.6) % 2 ? '#b9824f' : '#c99a62'), cliff * .85);
  c.lerp(new THREE.Color('#c8a877'), smoothstep(5, 40, depth) * .45);
  // the green: fields in alternating crops by the river and the lake
  const g = egyptGreen(x, z);
  if (g > 0) { const field = (Math.floor((x + 400) / 9) + Math.floor((z + 400) / 7)) % 3; c.lerp(new THREE.Color(field === 0 ? '#7c9a4a' : field === 1 ? '#a6a957' : '#6f8d45'), g * .85); }
  c.lerp(new THREE.Color('#8a7e5e'), (1 - smoothstep(3, 6, egyptRiver(x, z).d)) * .8);
  c.lerp(new THREE.Color('#e6d3a8'), 1 - smoothstep(2.5, 6.5, roadDistance));
  return c.multiplyScalar(1 + n * .08);
}

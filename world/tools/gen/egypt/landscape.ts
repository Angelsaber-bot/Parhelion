import * as THREE from 'three';
import { fbm, smoothstep, lerp } from '../rng';
import { distToSegment } from '../geo';
import type { ExpansionPlan } from '../../../src/map/worldPlan';
import { EGYPT_LAKE, EGYPT_RIVER, EGYPT_PLATEAU, EGYPT_CANYON, EGYPT_TEMPLE, EGYPT_PADS, EGYPT_ROOMS, EGYPT_CORRIDORS, EGYPT_CAPS, EGYPT_MORTUARY, EGYPT_SACRED_LAKE, EGYPT_QUARRY, EGYPT_VILLAGE, egyptDistanceToPolyline } from '../../../src/map/egyptPlan';
import { EGYPT_FIELD_TERRACES, EGYPT_FIELD_WORKSHOP, EGYPT_MAINTENANCE_DESCENT, EGYPT_OVERFLOW, EGYPT_STILLING_BASIN,
  EGYPT_TEMPLE_STAIR_CUT, EGYPT_TEMPLE_WORKS, EGYPT_WEST_DIVERSION, EGYPT_WHEEL_TRENCH, EGYPT_WATER_LIFT_APPROACH } from '../../../src/map/egyptRiverworksPlan';

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
  // 日峰: a natural pyramid of rock over the cliff temple, ridged by the same beds
  { const pk = EGYPT_MORTUARY.peak, pd = Math.hypot(x - pk.x, z - pk.z);
    if (pd < pk.radius) { const ridge = 1 + .18 * Math.abs(Math.sin(Math.atan2(z - pk.z, x - pk.x) * 3)), lift = pk.height * Math.pow(Math.max(0, 1 - pd * ridge / pk.radius), 1.15) * smoothstep(-2, 12, depth) * (.9 + .25 * fbm(x * .05, z * .05, 3, 3331)); y += Math.round(lift / 2.2) * 2.2 * .45 + lift * .55; } }
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
  // Terraces, the sacred lake and the quarry pit: ground stays under their floors.
  for (const [x0, x1, z0, z1, top, blend] of EGYPT_CAPS) { const d = Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(z0 - z, 0, z - z1)), cap = top - .35;
    if (d === 0) y = Math.min(y, cap); else if (y > cap && d < blend) y = lerp(cap, y, smoothstep(0, blend, d)); }
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
  // The cliff sanctuary is rock-cut: behind its facade the mountain closes over it.
  { const r = EGYPT_MORTUARY.sanctuary; if (z < r.z1 - 1) { const d = Math.hypot(Math.max(r.x0 - x, 0, x - r.x1), Math.max(r.z0 - z, 0)); if (d < 14) y = Math.max(y, lerp(r.floor + r.height + 6, y, smoothstep(5, 14, d))); } }
  // Broad, shallow fields settle into the floodplain rather than sitting on
  // multi-storey foundation boxes. Preserve the adjacent river's open bed.
  if (egyptRiver(x, z).d > 7.5) for (const field of [...EGYPT_FIELD_TERRACES, EGYPT_FIELD_WORKSHOP]) {
    const d = Math.hypot(Math.max(Math.abs(x - field.x) - field.width / 2 - .4, 0), Math.max(Math.abs(z - field.z) - field.depth / 2 - .4, 0));
    y = lerp(field.floor - .12, y, smoothstep(0, 10, d));
  }
  // A cut spillway bypasses the central leaf and dissipates into an uninhabited
  // basin. Cut after road grading so no old route fills the new watercourse.
  const overflow = egyptDistanceToPolyline(x, z, EGYPT_OVERFLOW);
  y = lerp(Math.min(y, overflow.y - 1), y, smoothstep(2.6, 7.5, overflow.d));
  // The replaceable old causeway is authored at runtime over this cut. Choosing
  // the west branch removes that road slab and installs the higher crossing.
  const west = egyptDistanceToPolyline(x, z, EGYPT_WEST_DIVERSION);
  y = lerp(Math.min(y, west.y - 2.1), y, smoothstep(5, 8.5, west.d));
  const basin = EGYPT_STILLING_BASIN;
  const bd = Math.hypot(Math.max(Math.abs(x - basin.x) - basin.width / 2, 0), Math.max(Math.abs(z - basin.z) - basin.depth / 2, 0));
  y = lerp(Math.min(y, basin.floor - .18), y, smoothstep(0, 6, bd));
  const descent = egyptDistanceToPolyline(x, z, EGYPT_MAINTENANCE_DESCENT);
  const liftApproach = egyptDistanceToPolyline(x, z, EGYPT_WATER_LIFT_APPROACH);
  y = lerp(Math.min(y, liftApproach.y - .35), y, smoothstep(2.5, 5, liftApproach.d));
  y = lerp(Math.min(y, descent.y - .25), y, smoothstep(3.7, 6.3, descent.d));
  const trench = EGYPT_WHEEL_TRENCH;
  const trenchDistance = Math.hypot(Math.max(trench.x0 - x, 0, x - trench.x1), Math.max(trench.z0 - z, 0, z - trench.z1));
  y = lerp(Math.min(y, trench.floor - .12), y, smoothstep(0, 1.4, trenchDistance));
  const works = EGYPT_TEMPLE_WORKS;
  const wd = Math.hypot(Math.max(works.x0 - x, 0, x - works.x1), Math.max(works.z0 - z, 0, z - works.z1));
  y = lerp(Math.min(y, works.floor - .18), y, smoothstep(0, 2.5, wd));
  const cut = EGYPT_TEMPLE_STAIR_CUT;
  const stairDistance = Math.hypot(Math.max(cut.x0 - x, 0, x - cut.x1), Math.max(cut.z0 - z, 0, z - cut.z1));
  y = lerp(Math.min(y, cut.floor - .18), y, smoothstep(0, 2.5, stairDistance));
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
  { const r = EGYPT_MORTUARY.sanctuary; if (x > r.x0 - 1.4 && x < r.x1 + 1.4 && z > r.z0 && z < r.z1) return { cut: r.floor - .25, roof: r.floor + r.height + 1.2 }; }
  return null;
}

const inRect = (x: number, z: number, r: readonly number[], pad = 0) => x > r[0] - pad && x < r[1] + pad && z > r[2] - pad && z < r[3] + pad;
/** Sand, sandstone, irrigated green and paths. */
export function egyptTerrainColor(x: number, y: number, z: number, roadDistance: number): THREE.Color {
  const n = fbm(x * .05, z * .05, 3, 3321), depth = plateauDepth(x, z), fine = fbm(x * .21, z * .21, 2, 3323);
  const c = new THREE.Color(n > .15 ? '#d9b97c' : n < -.2 ? '#c99f62' : '#d3ae70');
  const open = 1 - smoothstep(-30, 0, depth), g = egyptGreen(x, z), river = egyptRiver(x, z), lake = egyptLakeDistance(x, z);
  // 沙丘: lit windward faces, rose-shadowed slip faces and a pale crest line, following the dune field
  { const ph = (x * .6 + z * .8) * .045 + fbm(x * .01, z * .01, 2, 3313) * 3, s = Math.sin(ph), slope = Math.cos(ph) * Math.sign(s || 1), amount = smoothstep(-.2, .5, fbm(x * .006, z * .006, 2, 3317)) * open * (1 - g);
    c.lerp(new THREE.Color('#e9cf96'), amount * smoothstep(.1, .9, slope) * .45);
    c.lerp(new THREE.Color('#bf8f62'), amount * smoothstep(.1, .9, -slope) * .5);
    c.lerp(new THREE.Color('#f1dcaa'), amount * smoothstep(.9, 1, Math.abs(s)) * .55);
    // wind ripples between the dunes and gravel pans where the sand has blown away
    c.lerp(new THREE.Color('#c7a56c'), open * (1 - g) * (1 - amount) * smoothstep(.25, .6, fine) * .4);
    c.lerp(new THREE.Color('#a98c6a'), open * (1 - g) * smoothstep(.42, .6, fbm(x * .018 + 9, z * .018, 3, 3327)) * (1 - amount) * .55); }
  // sandstone faces: banded ochre and rose on the cliffs and canyon walls
  const cliff = Math.max(1 - smoothstep(3, 12, Math.abs(depth)), 1 - smoothstep(6, 11, egyptCanyon(x, z).d)) * smoothstep(16, 20, y);
  const band = Math.floor(y / 1.6 + fine * .8);
  c.lerp(new THREE.Color(band % 3 === 0 ? '#b9824f' : band % 3 === 1 ? '#c99a62' : '#d0a877'), cliff * .85);
  c.lerp(new THREE.Color('#9c6b47'), cliff * smoothstep(.2, .55, fbm(x * .3, y * .9 + z * .3, 2, 3329)) * .35);
  // plateau top: pale caprock with dark desert varnish in patches, scree at the cliff foot
  c.lerp(new THREE.Color('#c8a877'), smoothstep(5, 40, depth) * .45);
  c.lerp(new THREE.Color('#9b7654'), smoothstep(8, 30, depth) * smoothstep(.1, .5, fbm(x * .03 + 4, z * .03, 3, 3333)) * .4);
  c.lerp(new THREE.Color('#b08a62'), (1 - smoothstep(0, 16, -depth)) * smoothstep(-1, -6, depth) * smoothstep(-.1, .4, fine) * .5);
  // 日峰: the peak darkens upward in rose and umber beds
  { const pk = EGYPT_MORTUARY.peak, pd = Math.hypot(x - pk.x, z - pk.z); if (pd < pk.radius && depth > 0) c.lerp(new THREE.Color(Math.floor(y / 2.2) % 2 ? '#b27a52' : '#c79464'), (1 - smoothstep(pk.radius * .5, pk.radius, pd)) * .8); }
  // the green: fields in alternating crops by the river and the lake, dark earth where freshly watered
  if (g > 0) { const fx = Math.floor((x + 400) / 9), fz = Math.floor((z + 400) / 7), field = (fx + fz) % 4, edge = Math.min(Math.abs(((x + 400) / 9) % 1 - .5), Math.abs(((z + 400) / 7) % 1 - .5));
    c.lerp(new THREE.Color(field === 0 ? '#7c9a4a' : field === 1 ? '#a6a957' : field === 2 ? '#6f8d45' : '#c2b060'), g * .85);
    c.lerp(new THREE.Color('#6b5a3c'), g * smoothstep(.44, .5, edge) * .6); }
  // wet silt along the river and round the lake, then a pale dry rim
  c.lerp(new THREE.Color('#8a7e5e'), (1 - smoothstep(3, 6, river.d)) * .8);
  c.lerp(new THREE.Color('#6f6448'), (1 - smoothstep(4.5, 8.5, river.d)) * .45);
  c.lerp(new THREE.Color('#77705a'), (1 - smoothstep(.95, 1.15, lake)) * .7);
  c.lerp(new THREE.Color('#e3d2a4'), smoothstep(1.1, 1.2, lake) * (1 - smoothstep(1.2, 1.36, lake)) * .5);
  // worked ground: quarry floor chips, village earth, paved precincts
  if (inRect(x, z, EGYPT_QUARRY.pit, 6)) c.lerp(new THREE.Color(fine > .1 ? '#b98f78' : '#a87f6c'), .75);
  if (inRect(x, z, EGYPT_VILLAGE.rect, 5)) c.lerp(new THREE.Color('#c9ab7c'), .7);
  if (inRect(x, z, EGYPT_SACRED_LAKE.precinct, 3) || inRect(x, z, EGYPT_MORTUARY.forecourt, 3)) c.lerp(new THREE.Color('#dccba2'), .7);
  c.lerp(new THREE.Color('#e6d3a8'), 1 - smoothstep(2.5, 6.5, roadDistance));
  return c.multiplyScalar(1 + n * .08 + fine * .04);
}

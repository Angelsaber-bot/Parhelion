import * as THREE from 'three';
import { fbm, smoothstep, lerp } from '../rng';
import { distToSegment } from '../geo';
import type { ExpansionPlan, RoutePoint } from '../../../src/map/worldPlan';
import { QIN_RIDGES, QIN_STREAM, QIN_PADS, QIN_PALACE, QIN_ROOMS, QIN_CORRIDORS, QIN_LIFT, qinDistanceToPolyline, type QinCorridor } from '../../../src/map/qinPlan';

const BASE = 20;
/** Corridor footprint as an axis rectangle [x0,x1,z0,z1]. */
export function corridorRect(c: QinCorridor, pad = 0) {
  const hw = c.width / 2 + pad;
  return c.a[0] === c.b[0]
    ? [c.a[0] - hw, c.a[0] + hw, Math.min(c.a[2], c.b[2]), Math.max(c.a[2], c.b[2])] as const
    : [Math.min(c.a[0], c.b[0]), Math.max(c.a[0], c.b[0]), c.a[2] - hw, c.a[2] + hw] as const;
}
/** Floor height along a corridor at a point inside its footprint. */
export function corridorFloor(c: QinCorridor, x: number, z: number) {
  const along = c.a[0] === c.b[0] ? (z - c.a[2]) / (c.b[2] - c.a[2]) : (x - c.a[0]) / (c.b[0] - c.a[0]);
  return lerp(c.a[1], c.b[1], THREE.MathUtils.clamp(along, 0, 1));
}
const rectDistance = (x: number, z: number, r: readonly number[]) => Math.hypot(Math.max(r[0] - x, 0, x - r[1]), Math.max(r[2] - z, 0, z - r[3]));
const portalPoint = (c: QinCorridor) => c.portal === 'a' ? c.a : c.portal === 'b' ? c.b : null;

/** Mountain massif, valley and stream before any route or architecture grading. */
export function qinNaturalHeight(x: number, z: number): number {
  let y = BASE + fbm(x * .006 + 31, z * .006 - 7, 4, 2241) * 5 + fbm(x * .03, z * .03, 2, 2243) * .7;
  for (const ridge of QIN_RIDGES) {
    const { d, y: crest } = qinDistanceToPolyline(x, z, ridge.points);
    const rise = Math.max(0, crest - BASE);
    // Gullies cut the flanks without lowering the crest line itself.
    const gully = 1 - .16 * Math.max(0, fbm(x * .022 + 3, z * .022, 3, 2251)) * smoothstep(8, 40, d);
    // Sharp crests and concave feet: an exponential flank, softened right at the crest.
    const w = rise * .55 + 18, r0 = 7;
    y = Math.max(y, BASE + rise * gully * Math.exp(-(Math.hypot(d, r0) - r0) / w));
  }
  // 梯田: contour terraces on the valley side of the southern hills.
  const terrace = qinTerraceWeight(x, z, y);
  if (terrace > 0) y = lerp(y, Math.floor(y / 2.2) * 2.2 + .25 + (y % 2.2) * .12, terrace);
  // 骊水 valley: a broad floor with a narrow stream bed in its middle.
  const s = qinDistanceToPolyline(x, z, QIN_STREAM);
  // The valley pinches into a gorge where the road and stream share the pass.
  const gorge = 1 - smoothstep(18, 45, Math.abs(x + 70));
  y = lerp(y, s.y + 1.4, 1 - smoothstep(lerp(9, 4, gorge), lerp(38, 13, gorge), s.d));
  y = lerp(y, s.y - 1.1, 1 - smoothstep(1.6, 3.4, s.d));
  return y;
}

/** Terraced-field zone on the south hills' valley flank, between the fields and crests. */
export function qinTerraceWeight(x: number, z: number, y: number) {
  const zone = (1 - smoothstep(60, 95, Math.abs(x + 60))) * (1 - smoothstep(30, 48, Math.abs(z - 150)));
  return zone * smoothstep(25, 28, y) * (1 - smoothstep(40, 44, y)) * .82;
}
export function qinStreamDistance(x: number, z: number) { return qinDistanceToPolyline(x, z, QIN_STREAM).d; }

export function qinAuthoredHeight(plan: ExpansionPlan, x: number, z: number): number {
  let y = qinNaturalHeight(x, z);
  for (const [px, py, pz, r] of QIN_PADS) y = lerp(y, py, 1 - smoothstep(r, r + 20, Math.hypot(x - px, z - pz)));
  // Rammed-earth platforms: ground inside sits just below each platform top; the
  // mountain behind is cut back to meet it and the slope in front stays natural.
  for (const [x0, x1, z0, z1, top] of [QIN_PALACE.court, QIN_PALACE.terrace]) {
    const d = rectDistance(x, z, [x0, x1, z0, z1]);
    if (d === 0) y = top - .35;
    else if (y > top) y = lerp(top, y, smoothstep(0, 14, d));
    else y = lerp(Math.min(y, top - .35), y, smoothstep(0, 6, d));
  }
  {
    const [x0, x1, z0, z1, top] = QIN_PALACE.pavilion, d = rectDistance(x, z, [x0, x1, z0, z1]);
    if (d === 0) y = Math.min(y, top - .35); else if (y > top) y = lerp(top, y, smoothstep(0, 12, d));
  }
  for (const route of plan.routes.filter(r => r.kind !== 'underground')) {
    for (let i = 1; i < route.points.length; i++) {
      const a = route.points[i - 1], b = route.points[i], dx = b[0] - a[0], dz = b[2] - a[2];
      const t = THREE.MathUtils.clamp(((x - a[0]) * dx + (z - a[2]) * dz) / (dx * dx + dz * dz || 1), 0, 1);
      const d = distToSegment(x, z, [a[0], a[2]], [b[0], b[2]]);
      // The aqueduct cuts through high ground but crosses low ground on its own viaduct.
      const target = lerp(a[1], b[1], t) - .05;
      // Roads bridge the stream instead of damming its bed.
      if (qinStreamDistance(x, z) < 3.6 && target > y) continue;
      y = lerp(y, route.id === 'aqueduct' ? Math.min(y, target) : target, 1 - smoothstep(4.5, 14, d));
    }
  }
  // The buried city keeps a mountain over it; only its portals reach daylight.
  const cover = (rect: readonly number[], top: number, portal: RoutePoint | null) => {
    const d = rectDistance(x, z, rect);
    if (d > 16) return;
    if (portal && Math.hypot(x - portal[0], z - portal[2]) < 16) return;
    y = Math.max(y, lerp(top + 6, y, smoothstep(6, 16, d)));
  };
  for (const r of QIN_ROOMS) cover([r.x0, r.x1, r.z0, r.z1], r.floor + r.height, null);
  // Headframe deck over the lift shaft sits flush with the ridge path.
  { const [x0, x1, z0, z1] = QIN_LIFT.deck, d = rectDistance(x, z, [x0, x1, z0, z1]); y = lerp(QIN_LIFT.top - .03, y, smoothstep(0, 7, d)); }
  // The stream keeps its bed through town and under every bridge deck.
  const stream = qinDistanceToPolyline(x, z, QIN_STREAM);
  y = lerp(y, Math.min(y, stream.y - 1.1), 1 - smoothstep(1.6, 3.4, stream.d));
  for (const c of QIN_CORRIDORS) cover(corridorRect(c), Math.max(c.a[1], c.b[1]) + c.height, portalPoint(c));
  return y;
}

/**
 * Terrain cells over a tunnel that still lie below its roof are lowered beneath the
 * tunnel floor (separate vertices), so the hillside opens only into the tunnel.
 */
export function qinTunnelCut(x: number, z: number): number | null {
  if (Math.abs(x - QIN_LIFT.x) < QIN_LIFT.half + 1 && Math.abs(z - QIN_LIFT.z) < QIN_LIFT.half + 1) return QIN_LIFT.bottom - 1.6; // beneath the garrison floor, never inside the shaft
  for (const c of QIN_CORRIDORS) {
    if (!c.portal) continue;
    const r = corridorRect(c, 1.4);
    if (x < r[0] || x > r[1] || z < r[2] || z > r[3]) continue;
    return corridorFloor(c, x, z) - .25;
  }
  return null;
}
export function qinTunnelRoof(x: number, z: number): number | null {
  if (Math.abs(x - QIN_LIFT.x) < QIN_LIFT.half + 1 && Math.abs(z - QIN_LIFT.z) < QIN_LIFT.half + 1) return QIN_LIFT.top + 50;
  for (const c of QIN_CORRIDORS) {
    if (!c.portal) continue;
    const r = corridorRect(c, 1.4);
    if (x < r[0] || x > r[1] || z < r[2] || z > r[3]) continue;
    return corridorFloor(c, x, z) + c.height + 1.2;
  }
  return null;
}

export function qinTerrainColor(x: number, y: number, z: number, roadDistance: number): THREE.Color {
  const n = fbm(x * .04, z * .04, 3, 2261), slope = fbm(x * .011, z * .011, 2, 2263);
  const c = new THREE.Color(n > .2 ? '#8d9768' : n < -.2 ? '#6f8659' : '#7d8f62');
  // Loess terraces low down, rock and pine-dark scrub high on the mountain.
  c.lerp(new THREE.Color('#a99674'), smoothstep(-.1, .5, slope) * (1 - smoothstep(28, 46, y)) * .35);
  c.lerp(new THREE.Color('#5f6f55'), smoothstep(46, 80, y) * .55);
  c.lerp(new THREE.Color('#8a8c84'), smoothstep(90, 125, y) * .7);
  const terrace = qinTerraceWeight(x, z, y);
  if (terrace > 0) c.lerp(new THREE.Color(Math.floor(y / 2.2) % 2 ? '#a9a85f' : '#7f9a52'), terrace * .8);
  c.lerp(new THREE.Color('#b8a986'), 1 - smoothstep(2.5, 7, roadDistance));
  const s = qinStreamDistance(x, z);
  c.lerp(new THREE.Color('#8a8466'), 1 - smoothstep(2, 6, s));
  return c.multiplyScalar(1 + n * .1);
}

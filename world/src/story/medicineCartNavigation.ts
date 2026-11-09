import type { Point3 } from '../combat/combat';
import type { AdventurePoint } from './openWorldCampaign';

export interface CartSurface {
  cast(origin: Point3, direction: Point3, max: number): unknown;
  ground(x: number, z: number, ceiling: number): { point: Point3; face?: { normal: Point3 } | null } | null;
}

/** Same body-clearance rays as world collision, over a bounded collider subset. */
export function cartBodyClear(surface: CartSurface, point: Point3, radius = 1.6, height = 1.4) {
  if (surface.cast({ x: point.x, y: point.y + .15, z: point.z }, { x: 0, y: 1, z: 0 }, height)) return false;
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4;
    if (surface.cast({ x: point.x, y: point.y + .65, z: point.z }, { x: Math.cos(angle), y: 0, z: Math.sin(angle) }, radius)) return false;
  }
  return true;
}

/** Sweep the actual segment, including both wheels and the centre of the cart. */
export function medicineCartPathClear(surface: CartSurface, from: AdventurePoint, to: AdventurePoint) {
  if (![...from, ...to].every(Number.isFinite)) return false;
  const dx = to[0] - from[0], dy = to[1] - from[1], dz = to[2] - from[2];
  const distance = Math.hypot(dx, dy, dz), horizontal = Math.hypot(dx, dz);
  if (horizontal < 1e-8) return distance < 1e-8;
  const sideX = dz / horizontal, sideZ = -dx / horizontal;
  const samples = Math.max(1, Math.ceil(distance / .2));
  const points: Array<Point3 & { floor: number }> = [];
  for (let i = 1; i <= samples; i++) {
    const t = i / samples, x = from[0] + dx * t, y = from[1] + dy * t, z = from[2] + dz * t;
    const floor = surface.ground(x, z, y + 1.2);
    if (!floor || Math.abs(floor.point.y - y) > .6 || Math.abs(floor.face?.normal.y ?? 0) < .7) return false;
    points.push({ x, y, z, floor: floor.point.y });
  }
  // Also retain world-X wheel support while the rendered cart turns between legs.
  const offsets = [[0, 0], [sideX * .9, sideZ * .9], [-sideX * .9, -sideZ * .9], [.9, 0], [-.9, 0]];
  for (let n = 0; n < offsets.length; n++) {
    const [x, z] = offsets[n];
    if (offsets.slice(0, n).some(([a, b]) => Math.hypot(a - x, b - z) < 1e-8)) continue;
    for (const height of [.35, 1]) {
      if (surface.cast({ x: from[0] + x, y: from[1] + height, z: from[2] + z }, { x: dx, y: dy, z: dz }, distance + .7)) return false;
    }
    for (const point of points) {
      const floor = surface.ground(point.x + x, point.z + z, point.y + 1.2);
      if (!floor || Math.abs(floor.point.y - point.floor) > .6 || Math.abs(floor.face?.normal.y ?? 0) < .7) return false;
      // The cart stays upright: raising each wheel's clearance ray independently
      // would let the low side of the cart intersect a sloping river bank.
      if (!cartBodyClear(surface, { x: point.x + x, y: point.floor + .04, z: point.z + z }, .15, 1.3)) return false;
    }
  }
  for (const point of points) {
    if (!cartBodyClear(surface, { x: point.x, y: point.y + .04, z: point.z })) return false;
  }
  return true;
}

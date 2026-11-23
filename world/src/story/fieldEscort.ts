import type { Localized } from '../settlements/types';

export type EscortPoint = [number, number, number];
export interface EscortTask {
  readonly offsets: readonly (readonly [number, number])[];
  readonly instruction: Localized;
  readonly carry?: boolean;
}
export interface FieldEscortPose {
  point: EscortPoint;
  destination: EscortPoint;
  yaw: number;
  active: boolean;
  waiting?: boolean;
}

export function prepareEscortRoute(points: readonly (readonly [number, number, number])[]) {
  const legs = [];
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    const from = points[i - 1], to = points[i];
    const dx = to[0] - from[0], dz = to[2] - from[2], span = Math.hypot(dx, dz);
    if (span < .01 || ![...from, ...to].every(Number.isFinite)) return null;
    legs.push({ from, to, dx: dx / span, dz: dz / span, start: length, span });
    length += span;
  }
  if (!legs.length) return null;
  return { legs, length, destination: [...points[points.length - 1]] as EscortPoint };
}
export type EscortRoute = NonNullable<ReturnType<typeof prepareEscortRoute>>;

function legAt(route: EscortRoute, distance: number) {
  return route.legs.find(leg => distance < leg.start + leg.span - .0001) ?? route.legs[route.legs.length - 1];
}
export function escortPoseAt(route: EscortRoute, distance: number, active: boolean): FieldEscortPose {
  const leg = legAt(route, distance);
  const offset = Math.min(leg.span, Math.max(0, distance - leg.start));
  // The lead follows the surveyed ground exactly. Round the group's heading across each
  // bend so the stretcher handles and the last family member swing through it continuously.
  const i = route.legs.indexOf(leg);
  const next = offset < leg.span / 2 ? i : i + 1;
  const first = route.legs[next - 1], last = route.legs[next];
  let yaw = Math.atan2(leg.dx, leg.dz);
  if (first && last) {
    const radius = Math.min(1.2, first.span / 2, last.span / 2);
    const t = Math.min(1, Math.max(0, (distance - last.start + radius) / (2 * radius)));
    const start = Math.atan2(first.dx, first.dz), delta = Math.atan2(last.dx, last.dz) - start;
    yaw = start + Math.atan2(Math.sin(delta), Math.cos(delta)) * t * t * (3 - 2 * t);
  }
  return {
    point: [leg.from[0] + leg.dx * offset, leg.from[1] + (leg.to[1] - leg.from[1]) * offset / leg.span, leg.from[2] + leg.dz * offset],
    yaw, destination: route.destination, active,
  };
}
export function advanceEscort(route: EscortRoute, distance: number, player: EscortPoint, dt: number) {
  const pose = escortPoseAt(route, distance, true);
  const leg = legAt(route, distance);
  const dx = player[0] - pose.point[0], dz = player[2] - pose.point[2];
  const besideParty = Math.hypot(dx, dz) <= 3.25 && Math.abs(player[1] - pose.point[1]) < 1.65;
  const inLane = Math.abs(dx * leg.dz - dz * leg.dx) <= 1.65;
  if (!besideParty || !inLane) return { distance, waiting: true };
  const along = dx * leg.dx + dz * leg.dz;
  // Reaching a turn is sufficient to take it; the player need not hit an exact coordinate.
  const atTurn = Math.hypot(player[0] - leg.to[0], player[2] - leg.to[2]) < .65;
  const remaining = leg.start + leg.span - distance;
  return { distance: Math.min(route.length, distance + Math.max(0, Math.min(atTurn ? remaining : along, remaining, dt * 4))), waiting: false };
}

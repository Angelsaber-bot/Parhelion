import { adventureTravelOpen } from './openWorldCampaign';
import { WORLD_REGION_IDS, type WorldRegionId } from '../core/regionIdentity';
import { GATES, REGIONS } from '../map/regions';
import { EXPANSION_CONNECTIONS, type ExpansionConnection, type MapPoint2 } from '../map/worldPlan';

export type RoadPassage = { kind: 'road'; toward: WorldRegionId; road: ExpansionConnection; points: readonly MapPoint2[] };
export type StoryPassage = RoadPassage | { kind: 'gate'; toward: WorldRegionId; gate: (typeof GATES)[string]; centre: MapPoint2 };
const neighbours = new Map<string, StoryPassage[]>(WORLD_REGION_IDS.map(id => [id, []]));
const centres = new Map(REGIONS.map(region => [region.id, region.offset]));
const passes = [
  ['alpha', 'britain'], ['alpha', 'winter'], ['winter', 'blacksail'], ['blacksail', 'kyoto'],
] as const;
for (const [from, to] of passes) {
  const gate = GATES[to];
  neighbours.get(from)!.push({ kind: 'gate', toward: to, gate, centre: centres.get(to)! });
  neighbours.get(to)!.push({ kind: 'gate', toward: from, gate, centre: centres.get(from)! });
}
for (const road of EXPANSION_CONNECTIONS) {
  neighbours.get(road.from)!.push({ kind: 'road', toward: road.to, road, points: road.points });
  neighbours.get(road.to)!.push({ kind: 'road', toward: road.from, road, points: [...road.points].reverse() });
}

// Plan once for each starting region and for both travel states. The guide reads
// these paths each frame. A road wholly on open land can be used before the uplink.
function firstPassages(start: WorldRegionId, allowGates: boolean) {
  const routes = new Map<string, StoryPassage | null>([[start, null]]);
  const queue: WorldRegionId[] = [start];
  for (const id of queue) {
    for (const leg of neighbours.get(id)!) {
      if (routes.has(leg.toward) || (!allowGates && leg.kind === 'gate')) continue;
      routes.set(leg.toward, routes.get(id) ?? leg);
      queue.push(leg.toward);
    }
  }
  return routes;
}
const openRoutes = new Map<string, ReturnType<typeof firstPassages>>(WORLD_REGION_IDS.map(id => [id, firstPassages(id, true)]));
const earlyRoutes = new Map<string, ReturnType<typeof firstPassages>>(WORLD_REGION_IDS.map(id => [id, firstPassages(id, false)]));

export function nextStoryPass(here: string, destination: string, done?: ReadonlySet<string>): StoryPassage | null {
  return ((done && !adventureTravelOpen(done) ? earlyRoutes : openRoutes).get(here)?.get(destination)) ?? null;
}

export function trackedStoryRouteBlocked(here: string, destination: string, done: ReadonlySet<string>): boolean {
  return !!nextStoryPass(here, destination) && !nextStoryPass(here, destination, done);
}

/** Pick a point ahead on the road. Stop at bends until the player is close
 * enough to turn. A player away from the road is first led to its entrance. */
export function roadGuidePoint(passage: RoadPassage, x: number, z: number) {
  const { points, road } = passage;
  let bestDistance = Infinity, segment = 1, progress = 0;
  for (let i = 1; i < points.length; i++) {
    const [ax, az] = points[i - 1], [bx, bz] = points[i];
    const dx = bx - ax, dz = bz - az, squaredLength = dx * dx + dz * dz;
    const t = squaredLength ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / squaredLength)) : 0;
    const distance = Math.hypot(x - ax - dx * t, z - az - dz * t);
    if (distance <= bestDistance) { bestDistance = distance; segment = i; progress = t; }
  }
  const onRoad = bestDistance <= road.width / 2 + 12;
  const end = points[points.length - 1];
  const atEnd = Math.hypot(x - end[0], z - end[1]) <= 12;
  if (!onRoad) return { point: points[0], onRoad, atEnd };
  let [ax, az] = points[segment - 1], [bx, bz] = points[segment];
  let length = Math.hypot(bx - ax, bz - az);
  // A small arrival radius prevents the marker sitting at the player's feet
  // due to slight adjustments the player made while rounding a corner.
  if (segment < points.length - 1 && Math.hypot(x - bx, z - bz) <= 9) {
    [ax, az] = [bx, bz];
    [bx, bz] = points[segment + 1];
    length = Math.hypot(bx - ax, bz - az);
    progress = 0;
  }
  const t = length ? Math.min(1, progress + 32 / length) : 1;
  const point: MapPoint2 = [ax + (bx - ax) * t, az + (bz - az) * t];
  return { point, onRoad, atEnd };
}

/**
 * A seam marker is a point on the way, not the destination. The guide used to keep pointing at it after the
 * player had reached it (the west ridge sign sits exactly on one), so the beacon for the next chapter was under
 * their own feet. From a few strides short of the marker onward, the guide leads on along the line into the
 * region the journey is heading for, always a fixed stretch ahead, until the region changes and its own
 * objectives take over. `toward` is that region's centre (x, z).
 */
export const GATE_LEAD = Object.freeze({ near: 22, ahead: 58, corridor: 120, reach: 420 });
export function gateGuidePoint(gate: readonly [number, number, number], toward: readonly [number, number], from?: readonly [number, number, number] | null): [number, number, number] {
  const dx = toward[0] - gate[0], dz = toward[1] - gate[2], length = Math.hypot(dx, dz);
  if (!from || !(length > 1) || !from.every(Number.isFinite)) return [gate[0], gate[1], gate[2]];
  const ux = dx / length, uz = dz / length, rx = from[0] - gate[0], rz = from[2] - gate[2];
  const along = rx * ux + rz * uz, across = Math.abs(rx * uz - rz * ux);
  if (along < -GATE_LEAD.near || across > GATE_LEAD.corridor) return [gate[0], gate[1], gate[2]];
  const step = Math.min(Math.max(along, 0), GATE_LEAD.reach) + GATE_LEAD.ahead;
  return [gate[0] + ux * step, gate[1], gate[2] + uz * step];
}


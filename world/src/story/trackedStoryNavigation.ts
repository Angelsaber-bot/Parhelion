import {adventureTravelOpen} from './openWorldCampaign';
import { GATES } from '../map/regions';

export function trackedStoryRouteBlocked(here: string, destination: string, done: ReadonlySet<string>): boolean {
  return here !== destination && !adventureTravelOpen(done);
}
/** Resolve live stages every frame. A previously pinned local story may acquire
 * an inaccessible remote objective; return null so original main guidance wins
 * until the real seam opens, without silently deleting the player's pin. */
export function resolveTrackedStoryPoint(here: string, destination: string, done: ReadonlySet<string>, localTarget?: readonly [number, number, number] | null): [number, number, number] | null {
  if (trackedStoryRouteBlocked(here, destination, done)) return null;
  if (here === destination) return localTarget ? [...localTarget] : null;
  const gate = here === 'alpha' ? GATES[destination] : GATES[here];
  return gate ? [...gate.p] : null;
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


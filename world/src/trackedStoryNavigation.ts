import { GATES } from './regions';

export function trackedStoryRouteBlocked(here: string, destination: string, done: ReadonlySet<string>): boolean {
  return here !== destination && !done.has('summon_circle');
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

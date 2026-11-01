import { COMPACT_RELAY_SITE } from './compactRelaySitesData';
import type { StoryEncounterSpec } from './storyEncounters';
export const COMPACT_RELAY_ENCOUNTER = 'compact_relay_training';
/** Native roles only; connecting owns completion, never kills. Director validates
 * actual ground and obstruction anew on every attempt. No stat/reward overrides. */
export function getCompactRelayEncounterSpec(
  anchor: readonly number[] = COMPACT_RELAY_SITE.anchor,
  enemySockets: readonly (readonly number[])[] = COMPACT_RELAY_SITE.enemySockets,
): StoryEncounterSpec {
  if (anchor.length !== 3 || !anchor.every(Number.isFinite) || enemySockets.length !== 2
    || enemySockets.some(p => p.length !== 3 || !p.every(Number.isFinite))) throw new Error('Invalid compact relay site geometry');
  const [x,y,z] = anchor;
  const [gunner,guard] = enemySockets;
  return {id:COMPACT_RELAY_ENCOUNTER,anchor:{x,y,z},actors:[
    {role:'musketeer',offset:[gunner[0]-x,gunner[2]-z],title:['演练燧发哨兵','Drill Musketeer']},
    {role:'breaker',offset:[guard[0]-x,guard[2]-z],title:['演练重击卫士','Drill Breaker']},
  ]};
}

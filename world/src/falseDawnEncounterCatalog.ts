import { FALSE_DAWN_FIELD_ACTOR_OFFSETS, FALSE_DAWN_CENTERS, type FalseDawnFieldId } from './falseDawnSitesData';
import type { FalseDawnEncounterId } from './falseDawnCampaign';
import type { StoryEncounterActor, StoryEncounterSpec, StoryEncounterStartReason } from './storyEncounters';
import type { Localized } from './settlements/types';

export const FALSE_DAWN_START_HINTS: Record<StoryEncounterStartReason, Localized> = {
  started: ['讯号已接通。', 'Signal connected.'],
  active: ['当前遭遇仍在进行；先应对现场威胁。', 'This encounter is already active; deal with the threat first.'],
  busy: ['先结束其他战斗或脱离附近追击，再接通讯号。', 'Finish other combat or escape nearby pursuit before connecting.'],
  'out-of-range': ['请回到控制台附近后重新接通。', 'Return to the console before reconnecting.'],
  blocked: ['守卫落点暂时受阻。请退离工作台一点，再试一次。', 'A guard landing point is blocked. Step back from the console and retry.'],
  invalid: ['这次遭遇请求无效，未改动任务进度。', 'This encounter request is invalid; quest progress is unchanged.'],
  unavailable: ['先落地并结束当前动作，再接通讯号。', 'Land and finish your current action before connecting.'],
};

const FIELD: Record<FalseDawnEncounterId, FalseDawnFieldId> = {
  false_dawn_courier: 'alpha', false_dawn_harbor: 'blacksail', false_dawn_winter_1: 'winter',
  false_dawn_winter_2: 'winter', false_dawn_array: 'alpha', false_dawn_warden: 'alpha',
};
type Actor = Omit<StoryEncounterActor, 'offset'>;
/** Composition changes the tactical question; it does not invent arbitrary stat
 * multipliers, edit old encounters, or grant an ordinary enemy boss rewards. */
const CAST: Record<FalseDawnEncounterId, readonly Actor[]> = {
  false_dawn_courier: [{ role: 'stalker', title: ['回声信使', 'Echo Courier'] }],
  false_dawn_harbor: [
    { role: 'musketeer', title: ['潮汐截讯者', 'Tide Interceptor'] },
    { role: 'musketeer', title: ['伪频哨兵', 'False-Channel Sentry'] },
    { role: 'bombardier', title: ['回声投射手', 'Echo Projector'] },
  ],
  false_dawn_winter_1: [{ role: 'stalker', title: ['雪线追讯者', 'Snowline Pursuer'] }, { role: 'lancer', title: ['中继突击手', 'Repeater Lancer'] }],
  false_dawn_winter_2: [{ role: 'breaker', title: ['断频重卫', 'Signal Breaker'] }, { role: 'duelist', title: ['回声刃卫', 'Echo Duelist'] }, { role: 'stalker', title: ['雪线追讯者', 'Snowline Pursuer'] }],
  false_dawn_array: [{ role: 'lancer', title: ['收讯守卫', 'Receiver Guard'] }, { role: 'musketeer', title: ['转发守卫', 'Relay Guard'] }, { role: 'duelist', title: ['播送守卫', 'Transmitter Guard'] }],
  false_dawn_warden: [{ role: 'breaker', title: ['回声守门者', 'Echo Warden'], pattern: 'echo-warden' }],
};
export function getFalseDawnEncounterSpec(id: string): StoryEncounterSpec | null {
  if (!Object.hasOwn(FIELD, id)) return null;
  const key = id as FalseDawnEncounterId, [x, y, z] = FALSE_DAWN_CENTERS[FIELD[key]];
  return { id: key, anchor: { x, y, z }, actors: CAST[key].map((actor, index) => ({ ...actor,
    title: actor.title ? [...actor.title] : undefined, offset: [...FALSE_DAWN_FIELD_ACTOR_OFFSETS[FIELD[key]][index]],
  })) };
}

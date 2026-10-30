import type { Localized, RegionId, SettlementPlacement } from './settlements/types';
import { ERA_OPTIONALS, isEraId } from './eraStories';
import { VALLEY_STORY } from './valleyStory';

/** Only these five runtime-validated settlement entrances are destinations; never arbitrary map clicks. */
const REGIONS: readonly RegionId[] = ['alpha', 'britain', 'blacksail', 'winter', 'kyoto'];
export interface SafeTravelStop {
  id: string;
  region: RegionId;
  name: Localized;
  position: [number, number, number];
  foundFlag: string;
  radius: number;
}
export function createSafeTravelStops(placements: readonly SettlementPlacement[]): SafeTravelStop[] {
  const seen = new Set<string>();
  return placements.map(placement => {
    if (!REGIONS.includes(placement.id) || seen.has(placement.id) || !placement.entry.every(Number.isFinite)) throw new Error(`Invalid travel settlement: ${placement.id}`);
    seen.add(placement.id);
    return { id: `travel_${placement.id}`, region: placement.id, name: [...placement.name], position: [...placement.entry], foundFlag: `travel_${placement.id}`, radius: 12 };
  });
}
/** No boss/core or whole-region discovery unlocks a settlement the player never visited. */
export function isTravelStopDiscovered(stop: SafeTravelStop, done: ReadonlySet<string>, found: ReadonlySet<string>): boolean {
  if (found.has(stop.foundFlag)) return true;
  // These existing flags prove a physical conversation/interaction at this exact settlement.
  if (stop.region === 'alpha') return done.has(VALLEY_STORY.met) || done.has(VALLEY_STORY.resolved);
  return isEraId(stop.region) && (done.has(`era_${stop.region}_met`) || done.has(ERA_OPTIONALS[stop.region].id));
}
export interface TravelContext {
  sessionReady: boolean;
  defeated: boolean;
  combatActive: boolean;
  threatened: boolean;
  quietSeconds: number;
  flying: boolean;
  gliding: boolean;
  swimming: boolean;
  onGround: boolean;
  mounted: boolean;
  actionActive: boolean;
}
export type TravelBlock = 'unknown' | 'unavailable' | 'undiscovered' | 'seam-locked' | 'defeated' | 'combat' | 'flying' | 'airborne' | 'swimming' | 'busy';
export const TRAVEL_BLOCK_TEXT: Record<TravelBlock, Localized> = {
  unknown: ['只能前往登记过的安全据点。', 'Travel only to a registered safe settlement.'],
  unavailable: ['世界尚未就绪，暂不能旅行。', 'The world is not ready for travel.'],
  undiscovered: ['先亲自到达这个据点，才能快速返回。', 'Visit this settlement in person before returning by fast travel.'],
  'seam-locked': ['先稳定召唤阵，开启时层通路。', 'Stabilize the summoning circle to open the era passages first.'],
  defeated: ['倒地时不能快速旅行。', 'Fast travel is unavailable while defeated.'],
  combat: ['先脱离战斗与追击，并安静等待五秒。', 'Leave combat and pursuit, then remain safe for five seconds.'],
  flying: ['退出调试飞行后才能快速旅行。', 'Leave debug flight before fast travel.'],
  airborne: ['先落到安全地面，再开始旅行。', 'Land on safe ground before traveling.'],
  swimming: ['先回到岸上，再开始旅行。', 'Return to shore before traveling.'],
  busy: ['先收起炮台或结束当前动作。', 'Leave the cannon or finish your current action first.'],
};
/** Discovery requires physical, grounded presence; a flying debug pass never unlocks destinations. */
export function discoverTravelStops(stops: readonly SafeTravelStop[], position: readonly number[], context: TravelContext, found: Set<string>): string[] {
  if (!context.sessionReady || context.defeated || context.flying || context.gliding || context.swimming || !context.onGround || position.length !== 3 || !position.every(Number.isFinite)) return [];
  const added: string[] = [];
  for (const stop of stops) {
    if (found.has(stop.foundFlag) || Math.abs(position[1] - stop.position[1]) > 3) continue;
    if (Math.hypot(position[0] - stop.position[0], position[2] - stop.position[2]) <= stop.radius) {
      found.add(stop.foundFlag); added.push(stop.id);
    }
  }
  return added;
}
export function getTravelBlock(stopId: string, stops: readonly SafeTravelStop[], done: ReadonlySet<string>, found: ReadonlySet<string>, context: TravelContext): TravelBlock | null {
  const stop = stops.find(s => s.id === stopId);
  if (!stop) return 'unknown';
  if (!context.sessionReady) return 'unavailable';
  if (context.defeated) return 'defeated';
  if (context.combatActive || context.threatened || !Number.isFinite(context.quietSeconds) || context.quietSeconds < 5) return 'combat';
  if (context.flying) return 'flying';
  if (context.swimming) return 'swimming';
  if (context.gliding || !context.onGround) return 'airborne';
  if (context.mounted || context.actionActive) return 'busy';
  if (!isTravelStopDiscovered(stop, done, found)) return 'undiscovered';
  if (stop.region !== 'alpha' && !done.has('summon_circle')) return 'seam-locked';
  return null;
}
export type SafeTravelPlan = { ok: false; reason: TravelBlock } | { ok: true; stopId: string; position: [number, number, number]; yaw: number };
/** Recompute immediately before execution. Caller must validate arrival collision, clear input/actions,
 * and use Player.teleport/restartAt to clear airborne velocity; this module never moves the player. */
export function planSafeTravel(stopId: string, stops: readonly SafeTravelStop[], done: ReadonlySet<string>, found: ReadonlySet<string>, context: TravelContext): SafeTravelPlan {
  const reason = getTravelBlock(stopId, stops, done, found, context);
  if (reason) return { ok: false, reason };
  const stop = stops.find(s => s.id === stopId)!;
  return { ok: true, stopId, position: [...stop.position], yaw: 0 };
}

import { enemyIdHash } from './enemyRoles';
import type { Enemy, Point3 } from './combat';

/** Small tactical offsets, never a pathfinder or an omniscient target tracker.
 * Terrain remains authoritative for every candidate; offsets do not cross cover.
 */
export const ENEMY_TACTICS = {
  rangedReset: .65,
  closePressureLimit: 2,
  pressureRadius: 8,
  maxWalkCandidates: 3,
  sightMemory: 3,
  arrivalRadius: .5,
  returnBlocked: 2,
  returnProgress: .25,
  returnTimeout: 14,
  returnDetourStallScale: .22,
  detourDistance: 2.6,
  detourGoalChange: 2,
  wallFollowDistance: 30,
  wallProbe: 1.05,
} as const;
const LEFT = [0, .65, -.65] as const, RIGHT = [0, -.65, .65] as const;
export function enemyWalkTurns(e: Pick<Enemy, 'id'>): readonly number[] {
  return enemyIdHash(e.id) % 2 ? LEFT : RIGHT;
}
const WIDE_LEFT = [1.68, -1.68] as const, WIDE_RIGHT = [-1.68, 1.68] as const;
export function enemyDetourTurns(e: Pick<Enemy, 'id'>): readonly number[] {
  return enemyIdHash(e.id) % 2 ? WIDE_LEFT : WIDE_RIGHT;
}
export function enemyRangedSpacing(e: Pick<Enemy, 'kind' | 'miniboss' | 'role'>): number {
  if (e.kind === 'king' || e.miniboss) return 0;
  return e.role === 'jaeger' ? 14 : e.role === 'musketeer' ? 8 : e.role === 'bombardier' ? 6 : 0;
}
/** At most two ordinary near-field tells overlap. Boss/elite rhythms stay authored.
 * Ready actors wait, not cancel existing attacks, change damage or share hit immunity.
 */
export function hasEnemyPressureSlot(e: Enemy, enemies: readonly Enemy[], target: Point3): boolean {
  if (e.kind === 'king' || e.miniboss) return true;
  let pressure = 0;
  for (const other of enemies) {
    if (other === e || !other.active || other.pacified || other.mode !== 'windup') continue;
    if (Math.hypot(other.target.x - target.x, other.target.z - target.z) > ENEMY_TACTICS.pressureRadius) continue;
    if (++pressure >= ENEMY_TACTICS.closePressureLimit) return false;
  }
  return true;
}

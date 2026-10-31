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
} as const;
const LEFT = [0, .65, -.65] as const, RIGHT = [0, -.65, .65] as const;
export function enemyWalkTurns(e: Pick<Enemy, 'id'>): readonly number[] {
  return enemyIdHash(e.id) % 2 ? LEFT : RIGHT;
}
export function enemyRangedSpacing(e: Pick<Enemy, 'kind' | 'miniboss' | 'role'>): number {
  if (e.kind === 'king' || e.miniboss) return 0;
  return e.role === 'musketeer' ? 8 : e.role === 'bombardier' ? 6 : 0;
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

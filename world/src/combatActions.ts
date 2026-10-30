import { distanceXZ, type CombatTerrain, type Enemy, type Point3 } from './combat';

/** LOS origin and grounded height gate are distinct. Never raise an authored weapon socket again. */
export interface StrikeOriginGeometry {
  /** Feet-origin actions use1; authored muzzle/blade sockets use0. */
  losOffset?: 0 | 1;
  /** Required for socket origins, so a raised weapon cannot extend the allowed floor-to-floor hit band. */
  casterFeetY?: number;
}
export interface StrikeRequest extends StrikeOriginGeometry { origin: Point3; direction: Point3; range: number; halfWidth: number; damage: number; maxTargets: number }
export interface StrikeResult { damage: number; kills: string[]; hits: { id: string; damage: number }[] }
const finitePoint = (p: Point3) => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z);
/** Contact-only work, never run for ambient enemies per frame. Stable nearest-first selection. */
export function collectStrikeTargets(enemies: readonly Enemy[], strike: StrikeRequest, terrain: CombatTerrain): Enemy[] {
  if (!finitePoint(strike.origin) || !finitePoint(strike.direction) ||
    !Number.isFinite(strike.range) || strike.range <= 0 || strike.range > 40 ||
    !Number.isFinite(strike.halfWidth) || strike.halfWidth <= 0 || strike.halfWidth > 15 ||
    !Number.isFinite(strike.damage) || strike.damage <= 0 || strike.damage > 180 ||
    !Number.isInteger(strike.maxTargets) || strike.maxTargets < 1 || strike.maxTargets > 12) return [];
  const losOffset = strike.losOffset ?? 1;
  if ((losOffset !== 0 && losOffset !== 1) ||
    (strike.casterFeetY !== undefined && !Number.isFinite(strike.casterFeetY)) ||
    (losOffset === 0 && strike.casterFeetY === undefined)) return [];
  const heightOriginY = strike.casterFeetY ?? strike.origin.y;
  const length = Math.hypot(strike.direction.x, strike.direction.z);
  if (length < .001) return [];
  const ux = strike.direction.x / length, uz = strike.direction.z / length;
  const from = { ...strike.origin, y: strike.origin.y + losOffset };
  return enemies.filter(e => {
    if (!e.active || e.mode === 'dead' || e.pacified || Math.abs(e.p.y - heightOriginY) > 2.6) return false;
    const dx = e.p.x - strike.origin.x, dz = e.p.z - strike.origin.z;
    const forward = dx * ux + dz * uz, across = dx * uz - dz * ux;
    return forward >= 0 && forward <= strike.range && Math.abs(across) <= strike.halfWidth &&
      terrain.lineOfSight(from, { x: e.p.x, y: e.p.y + 1, z: e.p.z });
  }).sort((a, b) => distanceXZ(a.p, strike.origin) - distanceXZ(b.p, strike.origin) || a.id.localeCompare(b.id))
    .slice(0, strike.maxTargets);
}

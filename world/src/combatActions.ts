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
interface StrikeCorridor { ux: number; uz: number; feetY: number; losOffset: 0 | 1 }
/** One authoritative footprint for skill previews and actual contact selection. */
function corridor(strike: StrikeRequest): StrikeCorridor | null {
  if (!finitePoint(strike.origin) || !finitePoint(strike.direction) ||
    !Number.isFinite(strike.range) || strike.range <= 0 || strike.range > 40 ||
    !Number.isFinite(strike.halfWidth) || strike.halfWidth <= 0 || strike.halfWidth > 15 ||
    !Number.isFinite(strike.damage) || strike.damage <= 0 || strike.damage > 180 ||
    !Number.isInteger(strike.maxTargets) || strike.maxTargets < 1 || strike.maxTargets > 12) return null;
  const losOffset = strike.losOffset ?? 1;
  if ((losOffset !== 0 && losOffset !== 1) ||
    (strike.casterFeetY !== undefined && !Number.isFinite(strike.casterFeetY)) ||
    (losOffset === 0 && strike.casterFeetY === undefined)) return null;
  const length = Math.hypot(strike.direction.x, strike.direction.z);
  if (!Number.isFinite(length) || length < .001) return null;
  return { ux: strike.direction.x / length, uz: strike.direction.z / length,
    feetY: strike.casterFeetY ?? strike.origin.y, losOffset };
}
function contains(strike: StrikeRequest, shape: StrikeCorridor, point: Point3): boolean {
  if (!finitePoint(point) || Math.abs(point.y - shape.feetY) > 2.6) return false;
  const dx = point.x - strike.origin.x, dz = point.z - strike.origin.z;
  const forward = dx * shape.ux + dz * shape.uz, across = dx * shape.uz - dz * shape.ux;
  return forward >= 0 && forward <= strike.range && Math.abs(across) <= strike.halfWidth;
}
/** Geometry only: contact additionally requires a live hostile and clear LOS. */
export function strikeContains(strike: StrikeRequest, point: Point3): boolean {
  const shape = corridor(strike);
  return !!shape && contains(strike, shape, point);
}
/** Contact-only work, never run for ambient enemies per frame. Stable nearest-first selection. */
export function collectStrikeTargets(enemies: readonly Enemy[], strike: StrikeRequest, terrain: CombatTerrain): Enemy[] {
  const shape = corridor(strike);
  if (!shape) return [];
  const from = { ...strike.origin, y: strike.origin.y + shape.losOffset };
  return enemies.filter(e => {
    if (!e.active || e.mode === 'dead' || e.pacified || !contains(strike, shape, e.p)) return false;
    return terrain.lineOfSight(from, { x: e.p.x, y: e.p.y + 1, z: e.p.z });
  }).sort((a, b) => distanceXZ(a.p, strike.origin) - distanceXZ(b.p, strike.origin) || a.id.localeCompare(b.id))
    .slice(0, strike.maxTargets);
}

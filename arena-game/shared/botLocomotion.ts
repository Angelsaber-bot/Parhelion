import { insideMovementBounds, type ArenaMap } from './map.ts';
import { NavGrid } from './nav.ts';
import { canSlideTo, type PlayerState } from './sim.ts';

const navCache = new WeakMap<object, NavGrid>();
export function navFor(match: { map: ArenaMap }): NavGrid {
  let nav = navCache.get(match.map);
  if (!nav) { nav = new NavGrid(match.map); navCache.set(match.map, nav); }
  return nav;
}

export function safeDirection(match: { map: ArenaMap }, me: PlayerState, x: number, z: number, side: number): [number, number] {
  const length = Math.hypot(x, z);
  if (length < .01) return [0, 0];
  x /= length; z /= length;
  const reach = Math.min(.32, Math.max(.14, length));
  const usable = (dx: number, dz: number) => [reach / 2, reach].every(k => {
    const px = me.x + dx * k, pz = me.z + dz * k;
    return insideMovementBounds(match.map, px, pz) && canSlideTo(match.map, me, px, pz);
  });
  if (usable(x, z)) return [x, z];
  for (const angle of [Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2, Math.PI]) {
    const c = Math.cos(angle * side), s = Math.sin(angle * side);
    const dx = x * c - z * s, dz = x * s + z * c;
    if (usable(dx, dz)) return [dx, dz];
  }
  return [0, 0];
}

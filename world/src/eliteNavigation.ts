import { MINIBOSSES } from './minibosses';
import { regionAt } from './regions';
import type { Enemy, Point3 } from './combat';

/** One nearby destination, not a new cloud of enemy map dots. Use actual placed positions. */
export function nearbyElite(enemies: readonly Enemy[], player: Point3) {
  const region = regionAt(player.x, player.z).id;
  let result: { name: [string, string]; distance: number; direction: [string, string] } | null = null;
  const directions: [string, string][] = [['北', 'N'], ['东北', 'NE'], ['东', 'E'], ['东南', 'SE'], ['南', 'S'], ['西南', 'SW'], ['西', 'W'], ['西北', 'NW']];
  for (const enemy of enemies) {
    if (!enemy.miniboss || enemy.mode === 'dead' || enemy.hp <= 0 || regionAt(enemy.home.x, enemy.home.z).id !== region) continue;
    const definition = MINIBOSSES.find(d => d.id === enemy.miniboss);
    if (!definition) continue;
    const dx = enemy.p.x - player.x, dz = enemy.p.z - player.z;
    const distance = Math.hypot(dx, dz);
    if (!Number.isFinite(distance) || distance > 150 || (result && distance >= result.distance)) continue;
    const bearing = (Math.atan2(dx, -dz) + Math.PI * 2) % (Math.PI * 2);
    result = { name: definition.name, distance, direction: directions[Math.round(bearing / (Math.PI / 4)) % 8] };
  }
  return result;
}

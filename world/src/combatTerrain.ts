import * as THREE from 'three';
import type { Collider } from './player';
import type { Layout } from './types';
import type { Point3, CombatTerrain } from './combat';

/** Collision queries are shared with player and include closed gates/quest targets, not just terrain. */
export function makeCombatTerrain(colliders: Collider[], layout: Layout) {
  const cast = (origin: Point3, direction: Point3, max = Infinity, ignore?: (collider: Collider) => boolean) => {
    const ray = new THREE.Ray(new THREE.Vector3(origin.x, origin.y, origin.z), new THREE.Vector3(direction.x, direction.y, direction.z).normalize());
    let best: ReturnType<Collider['bvh']['raycastFirst']> = null;
    for (const c of colliders) if (c.enabled && !ignore?.(c)) {
      const hit = c.bvh.raycastFirst(ray, THREE.DoubleSide);
      if (hit && hit.distance < max && (!best || hit.distance < best.distance)) best = hit;
    }
    return best;
  };
  const ground = (x: number, z: number, ceiling = 180) => cast({ x, y: ceiling, z }, { x: 0, y: -1, z: 0 }, ceiling + 20);
  const clear = (p: Point3, radius = 1.2, height = 2.6) => {
    if (cast({ x: p.x, y: p.y + 0.15, z: p.z }, { x: 0, y: 1, z: 0 }, height)) return false;
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      if (cast({ x: p.x, y: p.y + 0.65, z: p.z }, { x: Math.cos(a), y: 0, z: Math.sin(a) }, radius)) return false;
    }
    return true;
  };
  const hubs = new Set(['camp', 'hq', 'armory', 'summon', 'tower', 'knights', 'camelot', 'roundtable', 'swordlake', 'pier', 'temple', 'light', 'camlann']);
  const safeSpawn = (x: number, z: number): Point3 | null => {
    if (layout.areas.some(a => hubs.has(a.id) && Math.hypot(x - a.c[0], z - a.c[1]) < a.r + 12)) return null;
    if (layout.markers.some(m => ['spawn', 'interact', 'discovery'].includes(m.type) && Math.hypot(x - m.p[0], z - m.p[2]) < Math.max(14, (m.radius ?? 3) + 9))) return null;
    const g = ground(x, z);
    if (!g || Math.abs(g.face?.normal.y ?? 0) < 0.78 || g.point.y < layout.world.waterLevel + 0.45 || g.point.y > 75) return null;
    const p = { x, y: g.point.y + 0.04, z };
    for (const [dx, dz] of [[-1.5, 0], [1.5, 0], [0, -1.5], [0, 1.5]]) {
      const foot = ground(x + dx, z + dz, p.y + 2);
      if (!foot || Math.abs(foot.point.y - p.y) > 0.75) return null;
    }
    return clear(p) ? p : null;
  };
  const terrain: CombatTerrain = {
    walk(from, x, z) {
      const g = ground(x, z, from.y + 1.1);
      if (!g || Math.abs(g.point.y - from.y) > 0.65 || g.point.y < layout.world.waterLevel + 0.1 || Math.abs(g.face?.normal.y ?? 0) < 0.7) return null;
      const p = { x, y: g.point.y + 0.04, z };
      const d = new THREE.Vector3(x - from.x, 0, z - from.z);
      if (d.lengthSq() && cast({ x: from.x, y: from.y + 0.7, z: from.z }, d, d.length() + 0.7)) return null;
      return p;
    },
    lineOfSight(from, to) {
      const d = new THREE.Vector3(to.x - from.x, to.y - from.y, to.z - from.z);
      return !cast(from, d, Math.max(0, d.length() - 0.05));
    },
  };
  return { cast, ground, safeSpawn, clear, terrain };
}

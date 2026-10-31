import * as THREE from 'three';
import type { Collider } from './player';
import type { Layout } from './types';
import type { Point3, CombatTerrain } from './combat';

/** Collision queries are shared with player and include closed gates/quest targets, not just terrain. */
export function makeCombatTerrain(colliders: Collider[], layout: Layout, groundHeight?: (x: number, z: number) => number | null) {
  const cast = (origin: Point3, direction: Point3, max = Infinity, ignore?: (collider: Collider) => boolean) => {
    // A zero direction degenerates BVH slab traversal into an expensive full
    // search. Empty/invalid segments cannot produce a meaningful ray hit.
    const lengthSq = direction.x * direction.x + direction.y * direction.y + direction.z * direction.z;
    if (![origin.x, origin.y, origin.z, direction.x, direction.y, direction.z].every(Number.isFinite)
      || !Number.isFinite(lengthSq) || lengthSq <= 0 || Number.isNaN(max) || max <= 0) return null;
    const ray = new THREE.Ray(new THREE.Vector3(origin.x, origin.y, origin.z), new THREE.Vector3(direction.x, direction.y, direction.z).normalize());
    let best: ReturnType<Collider['bvh']['raycastFirst']> = null;
    for (const c of colliders) if (c.enabled && !ignore?.(c)) {
      const hit = c.bvh.raycastFirst(ray, THREE.DoubleSide, 0, max);
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
  const hubs = new Set(['camp', 'hq', 'armory', 'summon', 'tower', 'knights', 'camelot', 'roundtable', 'swordlake', 'camlann', 'pass_trail', 'port', 'fort', 'reef', 'lighthouse', 'crossing', 'bivouac', 'kremlin', 'redsquare', 'inari', 'kamo', 'honnoji']);
  const placeEnemy = (x: number, z: number, story = false): Point3 | null => {
    if (layout.areas.some(a => (hubs.has(a.id) || a.id.endsWith('_living_hub')) && Math.hypot(x - a.c[0], z - a.c[1]) < a.r + 12)) return null;
    if (layout.markers.some(m => !(story && m.id.startsWith('false_dawn_')) && ['spawn', 'interact', 'discovery'].includes(m.type) && Math.hypot(x - m.p[0], z - m.p[2]) < Math.max(14, (m.radius ?? 3) + 9))) return null;
    const g = ground(x, z);
    if (!g || Math.abs(g.face?.normal.y ?? 0) < 0.78 || g.point.y < layout.world.waterLevel + 0.45 || g.point.y > 75) return null;
    // A downward all-collider ray finds flat roofs before terrain. Their clearance can look
    // valid while enemies are stranded above the route. Raised roads up to 1.5 m remain valid.
    if (groundHeight) {
      const terrainY = groundHeight(x, z);
      if (terrainY === null || !Number.isFinite(terrainY) || g.point.y - terrainY > 1.5) return null;
    }
    const p = { x, y: g.point.y + 0.04, z };
    for (const [dx, dz] of [[-1.5, 0], [1.5, 0], [0, -1.5], [0, 1.5]]) {
      const foot = ground(x + dx, z + dz, p.y + 2);
      if (!foot || Math.abs(foot.point.y - p.y) > 0.75) return null;
    }
    return clear(p) ? p : null;
  };
  const safeSpawn = (x: number, z: number) => placeEnemy(x,z);
  // Explicit authored encounter sockets may neighbor their own False Dawn markers.
  // Every terrain/hub/old-marker rule remains identical; random wilderness never gets this exception.
  const safeStorySpawn = (x: number, z: number) => placeEnemy(x,z,true);
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
      if (![from.x, from.y, from.z, to.x, to.y, to.z].every(Number.isFinite)) return false;
      const d = new THREE.Vector3(to.x - from.x, to.y - from.y, to.z - from.z);
      const length = d.length();
      if (!Number.isFinite(length)) return false;
      if (length === 0) return true; // Same point: no path segment to obstruct.
      return !cast(from, d, Math.max(0, length - 0.05));
    },
  };
  return { cast, ground, safeSpawn, safeStorySpawn, clear, terrain };
}

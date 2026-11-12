import type {StoryEncounterSpec} from '../story/storyEncounters';
import { gateEncounter, KINGDOM_GATE } from '../story/kingdomGate';
import * as THREE from 'three';
import type { Collider } from '../player/player';
import type { Layout } from '../core/types';
import type { Point3, CombatTerrain } from './combat';
import { COMPACT_RELAY_SITE } from '../story/compactRelaySitesData';
import { VALLEY_FIELD, VALLEY_NIGHT_ENCOUNTER } from '../story/valleyField';

/** Collision queries are shared with player and include closed gates/quest targets, not just terrain. */
export function makeCombatTerrain(colliders: Collider[], layout: Layout, groundHeight?: (x: number, z: number) => number | null) {
  const castAgainst = (subset: readonly Collider[], origin: Point3, direction: Point3, max = Infinity, ignore?: (collider: Collider) => boolean) => {
    // A zero direction degenerates BVH slab traversal into an expensive full
    // search. Empty/invalid segments cannot produce a meaningful ray hit.
    const lengthSq = direction.x * direction.x + direction.y * direction.y + direction.z * direction.z;
    if (![origin.x, origin.y, origin.z, direction.x, direction.y, direction.z].every(Number.isFinite)
      || !Number.isFinite(lengthSq) || lengthSq <= 0 || Number.isNaN(max) || max <= 0) return null;
    const ray = new THREE.Ray(new THREE.Vector3(origin.x, origin.y, origin.z), new THREE.Vector3(direction.x, direction.y, direction.z).normalize());
    let best: ReturnType<Collider['bvh']['raycastFirst']> = null;
    for (const c of subset) if (c.enabled && !ignore?.(c)) {
      const hit = c.bvh.raycastFirst(ray, THREE.DoubleSide, 0, max);
      if (hit && hit.distance < max && (!best || hit.distance < best.distance)) best = hit;
    }
    return best;
  };
  const cast = (origin: Point3, direction: Point3, max = Infinity, ignore?: (collider: Collider) => boolean) => castAgainst(colliders,origin,direction,max,ignore);
  const ground = (x: number, z: number, ceiling = 180) => cast({ x, y: ceiling, z }, { x: 0, y: -1, z: 0 }, ceiling + 20);
  const clear = (p: Point3, radius = 1.2, height = 2.6) => {
    if (cast({ x: p.x, y: p.y + 0.15, z: p.z }, { x: 0, y: 1, z: 0 }, height)) return false;
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      if (cast({ x: p.x, y: p.y + 0.65, z: p.z }, { x: Math.cos(a), y: 0, z: Math.sin(a) }, radius)) return false;
    }
    return true;
  };
  const kingdomMarkers = new Set<string>([KINGDOM_GATE.entry,KINGDOM_GATE.latch,KINGDOM_GATE.winch,KINGDOM_GATE.service]);
  const hubs = new Set(['camp', 'hq', 'armory', 'summon', 'tower', 'knights', 'camelot', 'roundtable', 'swordlake', 'camlann', 'pass_trail', 'port', 'fort', 'reef', 'lighthouse', 'crossing', 'bivouac', 'kremlin', 'redsquare', 'inari', 'kamo', 'honnoji']);
  // Wilderness placement ignores the exploration layer entirely (its markers and colliders), so the seeded
  // wild roster is identical whatever exploration content exists; story encounters still respect it.
  const exploration = (c: Collider) => !!c.name?.startsWith('COL_SunwardExploration');
  const placeEnemy = (x: number, z: number, story = false, authoredHub = false, kingdomGate = false): Point3 | null => {
    const wild = !story && !authoredHub && !kingdomGate;
    const ground = (gx: number, gz: number, ceiling = 180) => cast({ x: gx, y: ceiling, z: gz }, { x: 0, y: -1, z: 0 }, ceiling + 20, wild ? exploration : undefined);
    const clear = (p: Point3, radius = 1.2, height = 2.6) => {
      const ignore = wild ? exploration : undefined;
      if (cast({ x: p.x, y: p.y + 0.15, z: p.z }, { x: 0, y: 1, z: 0 }, height, ignore)) return false;
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; if (cast({ x: p.x, y: p.y + 0.65, z: p.z }, { x: Math.cos(a), y: 0, z: Math.sin(a) }, radius, ignore)) return false; }
      return true;
    };
    if (!authoredHub && layout.areas.some(a => (hubs.has(a.id) || a.id.endsWith('_living_hub')) && Math.hypot(x - a.c[0], z - a.c[1]) < a.r + 12)) return null;
    if (layout.markers.some(m => !(kingdomGate && (kingdomMarkers.has(m.id)||m.id.startsWith('resident_britain_witness_'))) && !m.id.startsWith('xpm_') && !(authoredHub && m.id.startsWith('valley_prologue_')) && !(story && (m.id.startsWith('false_dawn_') || ['compact_relay_entry', 'compact_relay_controller', 'compact_relay_deployment'].includes(m.id))) && ['spawn', 'interact', 'discovery'].includes(m.type) && Math.hypot(x - m.p[0], z - m.p[2]) < Math.max(14, (m.radius ?? 3) + 9))) return null;
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
  // Only the two reviewed yard sockets may inhabit the armory hub. This is not
  // a generic story exemption: old quest markers, terrain and clearance still apply.
  const safeCompactRelaySpawn = (x: number, z: number) =>
    COMPACT_RELAY_SITE.enemySockets.some(p => Math.abs(x-p[0]) < 1e-6 && Math.abs(z-p[2]) < 1e-6)
      ? placeEnemy(x,z,true,true) : null;
  const safeKingdomGateSpawn = (x:number,z:number) => {
    const spec=gateEncounter();
    return spec.actors.some(a=>Math.abs(x-spec.anchor.x-a.offset[0])<1e-6&&Math.abs(z-spec.anchor.z-a.offset[1])<1e-6)?placeEnemy(x,z,true,true,true):null;
  };
  const safeAdventureSpawn=(spec:StoryEncounterSpec,x:number,z:number):Point3|null=>{
    const markerId=spec.id===VALLEY_NIGHT_ENCOUNTER?VALLEY_FIELD.nightPatrol:spec.id==='adventure_winter_breach'?'adventure_winter_support':spec.id==='adventure_harbor_alarm'?'adventure_harbor_records':spec.id==='adventure_guardian'?'adventure_guardian':/^adventure_guard_[1-3]$/.test(spec.id)?`adventure_emitter_${spec.id.slice(-1)}`:null;
    const marker=layout.markers.find(m=>m.id===markerId);if(!marker||Math.abs(spec.anchor.x-marker.p[0])>.01||Math.abs(spec.anchor.z-marker.p[2])>.01||Math.abs(spec.anchor.y-(marker.p[1]-.9))>.01)return null;
    if(!spec.actors.some(a=>Math.abs(x-spec.anchor.x-a.offset[0])<1e-6&&Math.abs(z-spec.anchor.z-a.offset[1])<1e-6))return null;
    const g=ground(x,z,spec.anchor.y+2);if(!g||Math.abs(g.point.y-spec.anchor.y)>1.5||Math.abs(g.face?.normal.y??0)<.78)return null;
    const p={x,y:g.point.y+.04,z};for(const[dx,dz]of[[-1.2,0],[1.2,0],[0,-1.2],[0,1.2]]){const foot=ground(x+dx,z+dz,p.y+2);if(!foot||Math.abs(foot.point.y-p.y)>.75)return null;}
    return clear(p)?p:null;
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
      if (![from.x, from.y, from.z, to.x, to.y, to.z].every(Number.isFinite)) return false;
      const d = new THREE.Vector3(to.x - from.x, to.y - from.y, to.z - from.z);
      const length = d.length();
      if (!Number.isFinite(length)) return false;
      if (length === 0) return true; // Same point: no path segment to obstruct.
      return !cast(from, d, Math.max(0, length - 0.05));
    },
  };
  /** Conservative one-contact broadphase, not a persistent spatial cache. Current
   * BVH bounds and enabled flags preserve dynamic gates/refits. Callers keep every
   * query segment inside the supplied XZ box; Y is deliberately unrestricted. */
  const contactSurface = (bounds: { minX:number; maxX:number; minZ:number; maxZ:number }) => {
    const box = new THREE.Box3();
    const subset = colliders.filter(c => { c.bvh.getBoundingBox(box); return box.max.x >= bounds.minX && box.min.x <= bounds.maxX && box.max.z >= bounds.minZ && box.min.z <= bounds.maxZ; });
    const localCast = (origin:Point3,direction:Point3,max:number) => castAgainst(subset,origin,direction,max);
    return { cast:localCast, ground:(x:number,z:number,ceiling=180)=>localCast({x,y:ceiling,z},{x:0,y:-1,z:0},ceiling+20), colliderCount:subset.length, totalColliders:colliders.length };
  };
  return { cast, ground, safeSpawn, safeStorySpawn, safeCompactRelaySpawn, safeKingdomGateSpawn, safeAdventureSpawn, clear, terrain, contactSurface };
}

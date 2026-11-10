import * as THREE from 'three';
import type { Layout, Marker } from '../core/types';
import type { WorldRegionId } from '../core/regionIdentity';
import { EXPANSION_PLANS } from './worldPlan';

export interface RegionDef {
  id: WorldRegionId;
  file: string;
  offset: [number, number];
  /** Half turn in place: the GLB's local (x,z) sits at offset + (-x,-z). */
  rotated?: boolean;
  /** Production/render bounds only: x0, x1, z0, z1; never a movement boundary. */
  play: [number, number, number, number];
}

// 2026-11-10 layout, the journey growing north from 幻日谷:
//   奥尔良 | 古埃及 | 京都      (古埃及、京都、秦 are turned half a circle)
//   秦     | 永冬   | 黑帆
//   落日王国 | 幻日谷 | 主角城镇
export const REGIONS: RegionDef[] = [
  { id: 'alpha', file: 'world_alpha', offset: [0, 0], play: [-360, 360, -360, 360] },
  { id: 'britain', file: 'world_britain', offset: [-720, 0], play: [-360, 360, -360, 360] },
  { id: 'blacksail', file: 'world_blacksail', offset: [720, -720], play: [-360, 360, -360, 360] },
  { id: 'winter', file: 'world_winter', offset: [0, -720], play: [-360, 360, -360, 360] },
  { id: 'kyoto', file: 'world_kyoto', offset: [720, -1440], rotated: true, play: [-360, 360, -360, 360] },
  ...EXPANSION_PLANS.map(plan => ({id:plan.id,file:`world_${plan.id}`,offset:plan.offset,rotated:plan.rotated,
    play:[-360,360,-360,360] as [number,number,number,number]})),
];
/** Region-local (GLB/layout) → world. */
export function regionToWorld(def:Pick<RegionDef,'offset'|'rotated'>,x:number,z:number):[number,number]{
  return def.rotated?[def.offset[0]-x,def.offset[1]-z]:[def.offset[0]+x,def.offset[1]+z];
}
/** World → region-local (GLB/layout). */
export function worldToRegion(def:Pick<RegionDef,'offset'|'rotated'>,x:number,z:number):[number,number]{
  return def.rotated?[def.offset[0]-x,def.offset[1]-z]:[x-def.offset[0],z-def.offset[1]];
}
/** Pre-relayout world → world for content authored in a moved region's old world frame. */
export function legacyToWorld(region:'blacksail'|'kyoto',x:number,z:number):[number,number]{
  return region==='blacksail'?[x,z-720]:[720-x,-720-z];
}
/** The same move as a matrix (for authored art and its colliders). */
export function legacyFrameMatrix(region:'blacksail'|'kyoto'):THREE.Matrix4{
  return region==='blacksail'?new THREE.Matrix4().makeTranslation(0,0,-720):new THREE.Matrix4().makeTranslation(720,0,-720).multiply(new THREE.Matrix4().makeRotationY(Math.PI));
}
/** Put a region's loaded scene at its world place (position and half turn). */
export function placeRegion(object:THREE.Object3D,def:Pick<RegionDef,'offset'|'rotated'>){
  object.position.set(def.offset[0],0,def.offset[1]);object.rotation.set(0,def.rotated?Math.PI:0,0);
}

/** Historical story approach locations; continuous land is walkable outside these roads too. */
// Black Sail's west pass now opens onto 永冬; Kyoto's torii approach (turned south) onto Black Sail.
export const LINKS: [number, number, number, number][] = [[316, 410, -706, -674], [-410, -316, -46, -14], [-46, 46, -410, -316], [634, 726, -1130, -1036]];

/** Where Black Sail's west pass crosses from 永冬 into 黑帆尽头 (world coordinates, ground height). */
export const PASS_POINT: [number, number, number] = [360, 16, -690];

/** Where the journey crosses into each region from the one before it, and what the guide calls it. */
export const GATES: Record<string, { p: [number, number, number]; via: string }> = {
  blacksail: { p: PASS_POINT, via: '东侧山口' },
  britain: { p: [-322, 0, -30], via: '西部时层断面' },
  winter: { p: [0, 1.1, -330], via: '北方冰海断面' },
  kyoto: { p: [680, 10, -1050], via: '南方鸟居断面' },
};

/** Terrain grid covering every region (2 m cells, aligned with each region's own grid). */
export const GRID = { x0: -1080, z0: -1800, span: 2160, spanZ: 2160, cell: 2 };

/** Geographical ownership; transport/grid squares do not define a region's shape. */
export function regionAt(x: number, z = 0): RegionDef {
  // Curved climate/ownership transitions do not constrain movement or ground meshes.
  const wx=x+35*Math.sin(z*.008),wz=z+35*Math.sin(x*.007);
  const distance=(r:RegionDef)=>Math.hypot(wx-r.offset[0],wz-r.offset[1]);
  return REGIONS.reduce((a,b)=>distance(b)<distance(a)?b:a);
}
export function regionContains(r:RegionDef,x:number,z:number):boolean {
  return x>=GRID.x0&&x<=GRID.x0+GRID.span&&z>=GRID.z0&&z<=GRID.z0+GRID.spanZ&&regionAt(x,z).id===r.id;
}
export function regionDistance(r:RegionDef,p:{x:number;z:number}):number {
  const x=p.x-r.offset[0],z=p.z-r.offset[1];
  return Math.hypot(Math.max(-360-x,0,x-360),Math.max(-360-z,0,z-360));
}

export interface RegionLayout { def: RegionDef; layout: Layout }

/**
 * Merge per-region layouts into one world layout in world coordinates. Marker ids that clash
 * across regions (e.g. both have spawn_p1) are prefixed with the region id.
 */
export function mergeLayouts(parts: RegionLayout[]) {
  const seen = new Set<string>();
  const rename = new Map<string, Map<string, string>>();
  for (const { def, layout } of parts) {
    const map = new Map<string, string>();
    for (const m of layout.markers) {
      const id = seen.has(m.id) ? `${def.id}_${m.id}` : m.id;
      seen.add(id);
      map.set(m.id, id);
    }
    rename.set(def.id, map);
  }
  const base = parts[0].layout;
  const out: Layout & { objectives: { region: string; objective: Layout['objective'] }[] } = {
    world: { ...base.world, id: 'parhelion_world', name: parts.map(p=>p.layout.world.name).join(' · '), nameEn: 'Parhelion World' },
    areas: [], paths: [], markers: [], updrafts: [], lights: [],
    objective: base.objective,
    objectives: [],
  };
  for (const { def, layout } of parts) {
    const w = (x: number, z: number) => regionToWorld(def, x, z);
    const ids = rename.get(def.id)!;
    const id = (x: string) => ids.get(x) ?? x;
    out.areas.push(...layout.areas.map((a) => ({ ...a, c: w(a.c[0], a.c[1]), tp: w(a.tp[0], a.tp[1]), region: def.id })));
    out.paths.push(...layout.paths.map((p) => p.map(([x, z]) => w(x, z))));
    out.markers.push(...layout.markers.map((m): Marker => {
      const [x, z] = w(m.p[0], m.p[2]);
      return { ...m, id: id(m.id), p: [x, m.p[1], z], requires: m.requires?.map(id) };
    }));
    out.updrafts!.push(...(layout.updrafts ?? []).map((u) => { const [x, z] = w(u.x, u.z); return { ...u, x, z }; }));
    out.lights!.push(...(layout.lights ?? []).map((l) => { const [x, z] = w(l.p[0], l.p[2]); return { ...l, p: [x, l.p[1], z] as [number, number, number] }; }));
    out.objectives.push({ region: def.id, objective: { ...layout.objective, steps: layout.objective.steps.map((s) => ({ ...s, done: s.done.map(id) })) } });
  }
  return out;
}

/** Only the outside of the entire world has a safety boundary. No interior region walls. */
export function boundaryWalls(): THREE.BufferGeometry {
  const positions:number[]=[];
  for(const [x,z,w,d] of [[-1081,-720,2,2164],[1081,-720,2,2164],[0,-1801,2164,2],[0,361,2164,2]]) {
    const g=new THREE.BoxGeometry(w,300,d).toNonIndexed();g.translate(x,130,z);
    for(const v of g.attributes.position.array)positions.push(v);g.dispose();
  }
  return new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
}

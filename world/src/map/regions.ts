import * as THREE from 'three';
import type { Layout, Marker } from '../core/types';
import type { WorldRegionId } from '../core/regionIdentity';
import { EXPANSION_PLANS } from './worldPlan';

export interface RegionDef {
  id: WorldRegionId;
  file: string;
  offset: [number, number];
  /** Production/render bounds only: x0, x1, z0, z1; never a movement boundary. */
  play: [number, number, number, number];
}

export const REGIONS: RegionDef[] = [
  { id: 'alpha', file: 'world_alpha', offset: [0, 0], play: [-360, 360, -360, 360] },
  { id: 'britain', file: 'world_britain', offset: [-720, 0], play: [-360, 360, -360, 360] },
  { id: 'blacksail', file: 'world_blacksail', offset: [720, 0], play: [-360, 360, -360, 360] },
  { id: 'winter', file: 'world_winter', offset: [0, -720], play: [-360, 360, -360, 360] },
  { id: 'kyoto', file: 'world_kyoto', offset: [0, 720], play: [-360, 360, -360, 360] },
  ...EXPANSION_PLANS.map(plan => ({id:plan.id,file:`world_${plan.id}`,offset:plan.offset,
    play:[-360,360,-360,360] as [number,number,number,number]})),
];

/** Historical story approach locations; continuous land is walkable outside these roads too. */
export const LINKS: [number, number, number, number][] = [[316, 410, 14, 46], [-410, -316, -46, -14], [-46, 46, -410, -316], [-6, 86, 316, 410]];

/** Where the east pass crosses from 幻日谷 into 黑帆尽头 (world coordinates, ground height). */
export const PASS_POINT: [number, number, number] = [360, 16, 30];

/** Where the route from 幻日谷 crosses into each other region, and what the guide calls it. */
export const GATES: Record<string, { p: [number, number, number]; via: string }> = {
  blacksail: { p: PASS_POINT, via: '东侧山口' },
  britain: { p: [-322, 0, -30], via: '西部时层断面' },
  winter: { p: [0, 1.1, -330], via: '北方冰海断面' },
  kyoto: { p: [40, 10, 330], via: '南方鸟居断面' },
};

/** Terrain grid covering every region (2 m cells, aligned with each region's own grid). */
export const GRID = { x0: -1080, z0: -1080, span: 2160, spanZ: 2160, cell: 2 };

/** Geographical ownership; transport/grid squares do not define a region's shape. */
export function regionAt(x: number, z = 0): RegionDef {
  // Curved climate/ownership transitions do not constrain movement or ground meshes.
  const wx=x+35*Math.sin(z*.008),wz=z+35*Math.sin(x*.007);
  const distance=(r:RegionDef)=>Math.min(Math.hypot(wx-r.offset[0],wz-r.offset[1]),
    r.id==='britain'?Math.hypot(wx+720,wz-720):Infinity);
  return REGIONS.reduce((a,b)=>distance(b)<distance(a)?b:a);
}
export function regionContains(r:RegionDef,x:number,z:number):boolean {
  return x>=GRID.x0&&x<=GRID.x0+GRID.span&&z>=GRID.z0&&z<=GRID.z0+GRID.spanZ&&regionAt(x,z).id===r.id;
}
export function regionDistance(r:RegionDef,p:{x:number;z:number}):number {
  const x=p.x-r.offset[0],z=p.z-r.offset[1];
  return Math.hypot(Math.max(-360-x,0,x-360),Math.max(-360-z,0,z-(r.id==='britain'?1080:360)));
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
    const [ox, oz] = def.offset;
    const ids = rename.get(def.id)!;
    const id = (x: string) => ids.get(x) ?? x;
    out.areas.push(...layout.areas.map((a) => ({ ...a, c: [a.c[0] + ox, a.c[1] + oz] as [number, number], tp: [a.tp[0] + ox, a.tp[1] + oz] as [number, number], region: def.id })));
    out.paths.push(...layout.paths.map((p) => p.map(([x, z]) => [x + ox, z + oz] as [number, number])));
    out.markers.push(...layout.markers.map((m): Marker => ({
      ...m, id: id(m.id), p: [m.p[0] + ox, m.p[1], m.p[2] + oz], requires: m.requires?.map(id),
    })));
    out.updrafts!.push(...(layout.updrafts ?? []).map((u) => ({ ...u, x: u.x + ox, z: u.z + oz })));
    out.lights!.push(...(layout.lights ?? []).map((l) => ({ ...l, p: [l.p[0] + ox, l.p[1], l.p[2] + oz] as [number, number, number] })));
    out.objectives.push({ region: def.id, objective: { ...layout.objective, steps: layout.objective.steps.map((s) => ({ ...s, done: s.done.map(id) })) } });
  }
  return out;
}

/** Only the outside of the entire world has a safety boundary. No interior region walls. */
export function boundaryWalls(): THREE.BufferGeometry {
  const positions:number[]=[];
  for(const [x,z,w,d] of [[-1081,0,2,2164],[1081,0,2,2164],[0,-1081,2164,2],[0,1081,2164,2]]) {
    const g=new THREE.BoxGeometry(w,300,d).toNonIndexed();g.translate(x,130,z);
    for(const v of g.attributes.position.array)positions.push(v);g.dispose();
  }
  return new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
}

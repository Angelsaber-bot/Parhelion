// The open world is several generated regions placed side by side in one scene.
// 幻日谷 sits at the origin; 黑帆尽头 continues east through the mountain pass at z ≈ 30, and
// 落日王国 lies west through the era seam gorge at z ≈ -30, 永冬之城 north along the frozen channel at
// x ≈ 0, 业火京都 south through the torii tunnel at x ≈ 40. Three irregular corner
// domains extend the same ~3×3 planning envelope; 720 m is a production spacing only.
import * as THREE from 'three';
import type { Layout, Marker } from '../core/types';
import type { WorldRegionId } from '../core/regionIdentity';
import { EXPANSION_CONNECTIONS, EXPANSION_PLANS, distanceToLine, inPolygon, polygonDistance, type MapPoint2 } from './worldPlan';

export interface RegionDef {
  id: WorldRegionId;
  file: string;
  offset: [number, number];
  /** Local broad-phase bounds: x0, x1, z0, z1. An outline, when supplied, owns the boundary. */
  play: [number, number, number, number];
  outline?: readonly MapPoint2[];
}

export const REGIONS: RegionDef[] = [
  { id: 'alpha', file: 'world_alpha', offset: [0, 0], play: [-334, 334, -334, 334] },
  { id: 'britain', file: 'world_britain', offset: [-720, 0], play: [-334, 334, -334, 334] },
  { id: 'blacksail', file: 'world_blacksail', offset: [720, 0], play: [-334, 334, -334, 334] },
  { id: 'winter', file: 'world_winter', offset: [0, -720], play: [-334, 334, -334, 334] },
  { id: 'kyoto', file: 'world_kyoto', offset: [0, 720], play: [-334, 334, -334, 334] },
  ...EXPANSION_PLANS.map(plan => ({id:plan.id,file:`world_${plan.id}`,offset:plan.offset,
    play:[Math.min(...plan.outline.map(p=>p[0])),Math.max(...plan.outline.map(p=>p[0])),Math.min(...plan.outline.map(p=>p[1])),Math.max(...plan.outline.map(p=>p[1]))] as [number,number,number,number],outline:plan.outline})),
];

/** Extra walkable rects in world coordinates joining regions (the east pass, the west seam gorge). */
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
  const containing=REGIONS.find(r=>regionContains(r,x,z));
  if(containing)return containing;
  const d = (r: RegionDef) => regionDistance(r,{x,z});
  return REGIONS.reduce((a, b) => (d(b) < d(a) ? b : a));
}

export function regionContains(r:RegionDef,x:number,z:number):boolean {
  const lx=x-r.offset[0],lz=z-r.offset[1];
  if(lx<r.play[0]||lx>r.play[1]||lz<r.play[2]||lz>r.play[3])return false;
  return !r.outline||inPolygon(lx,lz,r.outline);
}
export function regionDistance(r:RegionDef,p:{x:number;z:number}):number {
  const x=p.x-r.offset[0],z=p.z-r.offset[1];
  return r.outline?polygonDistance(x,z,r.outline):Math.hypot(Math.max(r.play[0]-x,0,x-r.play[1]),Math.max(r.play[2]-z,0,z-r.play[3]));
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

/** Invisible walls around the union of geographical footprints and actual connecting roads. */
export function boundaryWalls(): THREE.BufferGeometry {
  const rects: [number, number, number, number][] = [
    ...REGIONS.map((r) => [r.play[0] + r.offset[0], r.play[1] + r.offset[0], r.play[2] + r.offset[1], r.play[3] + r.offset[1]] as [number, number, number, number]),
    ...EXPANSION_CONNECTIONS.map(link=>[Math.min(...link.points.map(p=>p[0]))-link.width/2,Math.max(...link.points.map(p=>p[0]))+link.width/2,Math.min(...link.points.map(p=>p[1]))-link.width/2,Math.max(...link.points.map(p=>p[1]))+link.width/2] as [number,number,number,number]),
    ...LINKS,
  ];
  const c = 2;
  const x0 = Math.min(...rects.map((r) => r[0])) - 20, z0 = Math.min(...rects.map((r) => r[2])) - 20;
  const nx = Math.ceil((Math.max(...rects.map((r) => r[1])) + 20 - x0) / c), nz = Math.ceil((Math.max(...rects.map((r) => r[3])) + 20 - z0) / c);
  const playable = (i: number, j: number) => {
    const x = x0 + (i + 0.5) * c, z = z0 + (j + 0.5) * c;
    return REGIONS.some(r=>regionContains(r,x,z)) || LINKS.some(([a,b,d,e])=>x>a&&x<b&&z>d&&z<e)
      || EXPANSION_CONNECTIONS.some(link=>distanceToLine(x,z,link.points)<=link.width/2);
  };
  const occupied=new Uint8Array(nx*nz);
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++)occupied[j*nx+i]=Number(playable(i,j));
  const inside=(i:number,j:number)=>i>=0&&j>=0&&i<nx&&j<nz?occupied[j*nx+i]!==0:false;
  const H = 300, Y = H / 2 - 20;
  const boxes: THREE.BufferGeometry[] = [];
  const wall = (x: number, z: number, w: number, d: number) => {
    const g = new THREE.BoxGeometry(w, H, d).toNonIndexed();
    g.deleteAttribute('normal'); g.deleteAttribute('uv');
    boxes.push(g.translate(x, Y, z));
  };
  // walls along x (between rows j-1 and j), merged into runs
  for (let j = 0; j <= nz; j++) {
    let run = -1;
    for (let i = 0; i <= nx; i++) {
      const edge = i < nx && inside(i, j) !== inside(i, j - 1);
      if (edge && run < 0) run = i;
      if (!edge && run >= 0) { wall(x0 + ((run + i) / 2) * c, z0 + j * c, (i - run) * c, 1); run = -1; }
    }
  }
  for (let i = 0; i <= nx; i++) {
    let run = -1;
    for (let j = 0; j <= nz; j++) {
      const edge = j < nz && inside(i, j) !== inside(i - 1, j);
      if (edge && run < 0) run = j;
      if (!edge && run >= 0) { wall(x0 + i * c, z0 + ((run + j) / 2) * c, 1, (j - run) * c); run = -1; }
    }
  }
  const pos: number[] = [];
  for (const b of boxes) pos.push(...(b.attributes.position.array as Float32Array));
  return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
}

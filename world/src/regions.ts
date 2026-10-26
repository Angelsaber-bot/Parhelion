// The open world is several generated regions placed side by side in one scene.
// 幻日谷 sits at the origin; 星落海岸 continues east through the mountain pass at z ≈ 30, and
// 落日王国 lies west through the era seam gorge at z ≈ -30 (each region is 720 m across).
import * as THREE from 'three';
import type { Layout, Marker } from './types';

export interface RegionDef {
  id: string;
  file: string;
  offset: [number, number];
  /** playable rect in region-local coordinates: x0, x1, z0, z1 */
  play: [number, number, number, number];
}

export const REGIONS: RegionDef[] = [
  { id: 'alpha', file: 'world_alpha', offset: [0, 0], play: [-334, 334, -334, 334] },
  { id: 'britain', file: 'world_britain', offset: [-720, 0], play: [-334, 334, -334, 334] },
  { id: 'coast', file: 'world_coast', offset: [600, 50], play: [-214, 214, -214, 214] },
];

/** Extra walkable rects in world coordinates joining regions (the east pass, the west seam gorge). */
export const LINKS: [number, number, number, number][] = [[316, 410, 14, 46], [-410, -316, -46, -14]];

/** Where the east pass crosses from 幻日谷 into 星落海岸 (world coordinates, ground height). */
export const PASS_POINT: [number, number, number] = [360, 16, 30];

/** Where the route from 幻日谷 crosses into each other region, and what the guide calls it. */
export const GATES: Record<string, { p: [number, number, number]; via: string }> = {
  coast: { p: PASS_POINT, via: '东侧山口' },
  britain: { p: [-322, 0, -30], via: '西部时层断面' },
};

/** Terrain grid covering every region (2 m cells, aligned with each region's own grid). */
export const GRID = { x0: -1080, z0: -360, span: 2040, spanZ: 780, cell: 2 };

export function regionAt(x: number): RegionDef {
  return REGIONS.find((r) => r.id === (x > 360 ? 'coast' : x < -360 ? 'britain' : 'alpha'))!;
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
    world: { ...base.world, id: 'parhelion_world', name: '幻日谷 · 落日王国 · 星落海岸', nameEn: 'Parhelion World' },
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

/** Invisible boundary walls around the union of the regions' playable rects and the links. */
export function boundaryWalls(): THREE.BufferGeometry {
  const rects: [number, number, number, number][] = [
    ...REGIONS.map((r) => [r.play[0] + r.offset[0], r.play[1] + r.offset[0], r.play[2] + r.offset[1], r.play[3] + r.offset[1]] as [number, number, number, number]),
    ...LINKS,
  ];
  const c = 2, x0 = -1080, z0 = -380, nx = 1030, nz = 380;
  const inside = (i: number, j: number) => {
    const x = x0 + (i + 0.5) * c, z = z0 + (j + 0.5) * c;
    return rects.some(([a, b, d, e]) => x > a && x < b && z > d && z < e);
  };
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

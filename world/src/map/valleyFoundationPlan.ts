import * as THREE from 'three';

export type FoundationPoint = [number, number, number];
/** x0, z0, x1, z1. These are the actual openings, shared by art and collision. */
export const VALLEY_FOUNDATION_CUTS = [[-200, 12, -160, 48], [40.8, -114, 47.2, -102]] as const;
// The sea sheet crosses the enclosed descending flights beyond the terrain
// openings. Cut only those crossings; the lake over the deep gallery stays wet.
export const VALLEY_FOUNDATION_WATER_CUTS = [[-164, 26.8, -134, 33.2], [40.8, -114, 47.2, -82]] as const;
export const VALLEY_FOUNDATION_CLEARANCE = [[-202, 10, -158, 50], [-183, 47, -177, 56], [39.5, -122, 48.5, -102]] as const;
export const VALLEY_FOUNDATION_LIGHTS = [
  ...[-143, -116, -88, -60].map(x => ({ p: [x, x < -112 ? 2.4 + (x + 160) / 48 * -11.4 + 2.7 : -6.3, 30] as const, color: '#ffd99d', intensity: 26, distance: 16 })),
  ...[[-40, -6.3, 6], [-15, -6.2, -8], [9, -6.2, -8], [0, -6.3, -39], [0, -6.3, -62], [26, -6.3, -65],
    [44, -2.5, -78], [44, 2.1, -94], [44, 7.2, -112]].map(p => ({p: p as FoundationPoint, color: '#ffd99d', intensity: 26, distance: 17})),
];
export const VALLEY_FOUNDATION_ROUTE: readonly FoundationPoint[] = [
  [-160, 2.4, 30], [-112, -9, 30], [-40, -9, 30], [-40, -9, -6], [-24, -9, -6],
];
export const VALLEY_FOUNDATION_RETURN: readonly FoundationPoint[] = [
  [0, -9, -26], [0, -9, -65], [44, -9, -65], [44, 4.6, -112], [44, 4.6, -114.5],
];

/** A dry volume is limited vertically to the enclosed gallery. Surface water
 * and the lake above it keep their ordinary swimming behaviour. */
export function insideValleyFoundation(p: { x: number; y: number; z: number }) {
  if (p.x >= -24.4 && p.x <= 16.4 && p.z >= -26.4 && p.z <= 12.4 && p.y >= -9.6 && p.y < -4.4) return true;
  for (const route of [VALLEY_FOUNDATION_ROUTE, VALLEY_FOUNDATION_RETURN]) for (const joint of route.slice(1, -1)) {
    if (Math.abs(p.x - joint[0]) <= 3.15 && Math.abs(p.z - joint[2]) <= 3.15 && p.y >= joint[1] - .5 && p.y < joint[1] + 3.8) return true;
  }
  for (const route of [VALLEY_FOUNDATION_ROUTE, VALLEY_FOUNDATION_RETURN]) for (let i = 1; i < route.length; i++) {
    const a = route[i - 1], b = route[i], dx = b[0] - a[0], dz = b[2] - a[2];
    const t = Math.max(0, Math.min(1, ((p.x - a[0]) * dx + (p.z - a[2]) * dz) / (dx * dx + dz * dz)));
    const floor = a[1] + (b[1] - a[1]) * t;
    if (Math.hypot(p.x - a[0] - dx * t, p.z - a[2] - dz * t) < 3.15 && p.y >= floor - .5 && p.y < floor + 3.8) return true;
  }
  return false;
}

/** The height texture is also the water-depth and overview-map source. Keep the
 * new excavated surfaces in it instead of leaving clipped cells at open-sea depth. */
export function applyValleyFoundationGrid(grid: { nx: number; nz: number; x0: number; z0: number; cell: number; h: Float32Array; ny: Float32Array; col: Float32Array }) {
  const tint = new THREE.Color('#8b9186');
  for (const rect of VALLEY_FOUNDATION_CUTS) {
    const ix0 = Math.max(0, Math.ceil((rect[0] - grid.x0) / grid.cell)), ix1 = Math.min(grid.nx - 1, Math.floor((rect[2] - grid.x0) / grid.cell));
    const iz0 = Math.max(0, Math.ceil((rect[1] - grid.z0) / grid.cell)), iz1 = Math.min(grid.nz - 1, Math.floor((rect[3] - grid.z0) / grid.cell));
    for (let iz = iz0; iz <= iz1; iz++) for (let ix = ix0; ix <= ix1; ix++) {
      const z = grid.z0 + iz * grid.cell, at = iz * grid.nx + ix;
      grid.h[at] = rect[0] < 0 ? 2.4 : -9 + THREE.MathUtils.clamp((-65 - z) / 47, 0, 1) * 13.6 + (z > -112 ? 4 : 0);
      grid.ny[at] = 1; grid.col.set([tint.r, tint.g, tint.b], at * 3);
    }
  }
}

/** Clip boundary-crossing triangles, retaining the terrain right up to each
 * retaining wall. Removing whole triangles would leave cracks at the entrances. */
export function carveValleyFoundation(geometry: THREE.BufferGeometry, cuts: readonly (readonly [number, number, number, number])[] = VALLEY_FOUNDATION_CUTS) {
  const pos = geometry.getAttribute('position');
  if (!pos) return null;
  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox!;
  if (!cuts.some(r => bounds.min.x < r[2] && bounds.max.x > r[0] && bounds.min.z < r[3] && bounds.max.z > r[1])) return null;
  const names = Object.keys(geometry.attributes), arrays: Record<string, number[]> = Object.fromEntries(names.map(name => [name, []]));
  type Vertex = Record<string, number[]>;
  const read = (index: number): Vertex => Object.fromEntries(names.map(name => {
    const a = geometry.getAttribute(name); return [name, Array.from({ length: a.itemSize }, (_, n) => a.getComponent(index, n))];
  }));
  const emit = (polygon: Vertex[]) => {
    for (let i = 1; i + 1 < polygon.length; i++) for (const v of [polygon[0], polygon[i], polygon[i + 1]])
      for (const name of names) arrays[name].push(...v[name]);
  };
  let changed = false;
  const count = geometry.index?.count ?? pos.count;
  for (let index = 0; index < count; index += 3) {
    const triangle = [0, 1, 2].map(n => read(geometry.index?.getX(index + n) ?? index + n));
    let polygons = [triangle];
    for (const rect of cuts) {
      if (Math.max(...triangle.map(v => v.position[0])) <= rect[0] || Math.min(...triangle.map(v => v.position[0])) >= rect[2] ||
        Math.max(...triangle.map(v => v.position[2])) <= rect[1] || Math.min(...triangle.map(v => v.position[2])) >= rect[3]) continue;
      changed = true;
      polygons = polygons.flatMap(polygon => {
        let inside = polygon; const outside: Vertex[][] = [];
        for (const [axis, edge, sign] of [[0, rect[0], 1], [0, rect[2], -1], [2, rect[1], 1], [2, rect[3], -1]]) {
          const split = (keep: boolean) => {
            const out: Vertex[] = [];
            for (let i = 0; i < inside.length; i++) {
              const a = inside[i], b = inside[(i + 1) % inside.length];
              const da = (a.position[axis] - edge) * sign, db = (b.position[axis] - edge) * sign;
              const ka = keep ? da >= 0 : da <= 0, kb = keep ? db >= 0 : db <= 0;
              if (ka) out.push(a);
              if (ka !== kb) {
                const t = da / (da - db);
                out.push(Object.fromEntries(names.map(name => [name, a[name].map((value, n) => value + (b[name][n] - value) * t)])));
              }
            }
            return out;
          };
          const piece = split(false), remaining = split(true);
          if (piece.length >= 3) outside.push(piece);
          inside = remaining; if (inside.length < 3) break;
        }
        return outside;
      });
    }
    polygons.forEach(emit);
  }
  if (!changed) return null;
  const result = new THREE.BufferGeometry();
  for (const name of names) result.setAttribute(name, new THREE.Float32BufferAttribute(arrays[name], geometry.getAttribute(name).itemSize));
  result.computeBoundingBox(); result.computeBoundingSphere(); return result;
}


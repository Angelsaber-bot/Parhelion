// Arena map data + collision queries. Pure functions, no Three.js, so the server, the client
// predictor and the bots all run the exact same geometry.
//
// The map itself (../arena/runtime/map.json) is authored by the ASTER map pipeline
// (arena/source/make_map.py). Collision is axis-aligned boxes plus axis-aligned ramps, the same
// model as arena/runtime/physics.js; the solver here is a TypeScript port of that validated 0.2
// solver, extended with jumping, ceilings and dashing.

export type Vec3 = [number, number, number];

export interface MapObject {
  id: string;
  type: 'box' | 'ramp';
  position: Vec3;
  size: Vec3;
  material: string;
  collision: boolean;
  role: string;
  axis?: 'x' | 'z';
  lowAt?: number;
}

export interface MapAnchor {
  id: string;
  kind: string;
  position: Vec3;
  team?: string;
  height?: number;
  [k: string]: unknown;
}

export interface MapData {
  mapId: string;
  version: string;
  bounds: { min: Vec3; max: Vec3 };
  objects: MapObject[];
  anchors: MapAnchor[];
  routes: { id: string; name: string; points: Vec3[] }[];
  player: { radius: number; height: number; eyeHeight: number; walkSpeed: number; stepHeight: number };
  /** Optional lighting mood for the client (see src/atmosphere.ts). */
  presentation?: { preset?: string };
}

/** Collision solids only, with precomputed extents. */
export interface Solid {
  id: string;
  ramp: boolean;
  minX: number; maxX: number;
  minY: number; maxY: number;
  minZ: number; maxZ: number;
  // ramp surface: top(x,z) = baseY + h * (1 - lowAt * (c - centre) / half) / 2, c = x or z
  axisX: boolean;
  lowAt: number;
  centre: number;
  half: number;
}

export interface ArenaMap {
  data: MapData;
  solids: Solid[];
  radius: number;
  height: number;
  eye: number;
  step: number;
}

export function buildMap(data: MapData): ArenaMap {
  const solids: Solid[] = [];
  for (const o of data.objects) {
    if (!o.collision) continue;
    const [px, py, pz] = o.position;
    const [sx, sy, sz] = o.size;
    const ramp = o.type === 'ramp';
    const axisX = o.axis === 'x';
    solids.push({
      id: o.id,
      ramp,
      minX: px - sx / 2, maxX: px + sx / 2,
      // ramps sit on position.y and rise by size.y; boxes are centred
      minY: ramp ? py : py - sy / 2, maxY: ramp ? py + sy : py + sy / 2,
      minZ: pz - sz / 2, maxZ: pz + sz / 2,
      axisX,
      lowAt: o.lowAt ?? 1,
      centre: axisX ? px : pz,
      half: (axisX ? sx : sz) / 2,
    });
  }
  const p = data.player;
  return { data, solids, radius: p.radius, height: p.height, eye: p.eyeHeight, step: p.stepHeight };
}

const EPS = 0.001;

export function topAt(s: Solid, x: number, z: number): number {
  if (!s.ramp) return s.maxY;
  const c = s.axisX ? x : z;
  const t = Math.max(-1, Math.min(1, (c - s.centre) / s.half));
  return s.minY + (s.maxY - s.minY) * (1 - t * s.lowAt) / 2;
}

const inside = (s: Solid, x: number, z: number) =>
  x >= s.minX - EPS && x <= s.maxX + EPS && z >= s.minZ - EPS && z <= s.maxZ + EPS;

function overlaps(s: Solid, x: number, z: number, r: number): boolean {
  const qx = Math.max(s.minX, Math.min(x, s.maxX));
  const qz = Math.max(s.minZ, Math.min(z, s.maxZ));
  return (x - qx) ** 2 + (z - qz) ** 2 < r * r - 1e-6;
}

/** Highest standable surface under (x,z) that is reachable from height y (within step height). */
export function groundAt(m: ArenaMap, x: number, z: number, y: number): number {
  let g = -100;
  for (const s of m.solids) {
    if (!inside(s, x, z)) continue;
    const t = topAt(s, x, z);
    if (t <= y + m.step + EPS && t > g) g = t;
  }
  return g;
}

/** Solid whose side would intersect the player's footprint at (x,z) standing at y, if any. */
export function blockedAt(m: ArenaMap, x: number, z: number, y: number, height = m.height): Solid | null {
  for (const s of m.solids) {
    if (!overlaps(s, x, z, m.radius)) continue;
    const qx = Math.max(s.minX, Math.min(x, s.maxX));
    const qz = Math.max(s.minZ, Math.min(z, s.maxZ));
    if (topAt(s, qx, qz) > y + m.step + EPS && s.minY < y + height - 0.02) return s;
  }
  return null;
}

/** Lowest solid underside above the player's head, for jump ceilings. */
export function ceilingAt(m: ArenaMap, x: number, z: number, y: number, height = m.height): number {
  let c = Infinity;
  for (const s of m.solids) {
    if (!overlaps(s, x, z, m.radius)) continue;
    if (s.minY >= y + height - 0.05 && s.minY < c) c = s.minY;
  }
  return c;
}

/** Push the footprint out of any solid side it already overlaps (e.g. after falling beside a ramp). */
export function recover(m: ArenaMap, p: { x: number; y: number; z: number }, height = m.height): void {
  for (let pass = 0; pass < 8; pass++) {
    let changed = false;
    for (const s of m.solids) {
      if (!overlaps(s, p.x, p.z, m.radius)) continue;
      const qx = Math.max(s.minX, Math.min(p.x, s.maxX));
      const qz = Math.max(s.minZ, Math.min(p.z, s.maxZ));
      if (topAt(s, qx, qz) <= p.y + m.step + EPS || s.minY >= p.y + height - 0.02) continue;
      const dx = p.x - qx, dz = p.z - qz, d = Math.hypot(dx, dz);
      let nx: number, nz: number, depth: number;
      if (d > 1e-7) {
        nx = dx / d; nz = dz / d; depth = m.radius - d;
      } else {
        const faces: [number, number, number][] = [
          [p.x - s.minX, -1, 0], [s.maxX - p.x, 1, 0], [p.z - s.minZ, 0, -1], [s.maxZ - p.z, 0, 1],
        ];
        faces.sort((a, b) => a[0] - b[0]);
        nx = faces[0][1]; nz = faces[0][2]; depth = faces[0][0] + m.radius;
      }
      p.x += nx * (depth + 0.0002);
      p.z += nz * (depth + 0.0002);
      changed = true;
    }
    if (!changed) break;
  }
}

/**
 * Ray vs map. Returns the distance along the (unit) direction to the first solid, or Infinity.
 * Ramps are exact wedges: their box clipped by the sloped top plane.
 */
export function raycastMap(m: ArenaMap, o: Vec3, d: Vec3, maxDist: number): number {
  let best = maxDist;
  let hit = false;
  for (const s of m.solids) {
    const t = raySolid(s, o, d, best);
    if (t < best) { best = t; hit = true; }
  }
  return hit ? best : Infinity;
}

function raySolid(s: Solid, o: Vec3, d: Vec3, maxDist: number): number {
  let lo = 0, hi = maxDist;
  const mins = [s.minX, s.minY, s.minZ], maxs = [s.maxX, s.maxY, s.maxZ];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-12) {
      if (o[i] < mins[i] || o[i] > maxs[i]) return Infinity;
    } else {
      let a = (mins[i] - o[i]) / d[i], b = (maxs[i] - o[i]) / d[i];
      if (a > b) [a, b] = [b, a];
      if (a > lo) lo = a;
      if (b < hi) hi = b;
      if (lo > hi) return Infinity;
    }
  }
  if (s.ramp) {
    // Keep the part of the ray below the slope: n·p <= k
    const h = s.maxY - s.minY, g = (h / 2) * s.lowAt / s.half;
    const n: Vec3 = s.axisX ? [g, 1, 0] : [0, 1, g];
    const k = s.minY + h / 2 + g * s.centre;
    const no = n[0] * o[0] + n[1] * o[1] + n[2] * o[2] - k;
    const nd = n[0] * d[0] + n[1] * d[1] + n[2] * d[2];
    if (Math.abs(nd) < 1e-12) {
      if (no > 0) return Infinity;
    } else {
      const t = -no / nd;
      if (nd > 0) { if (t < hi) hi = t; } else if (t > lo) lo = t;
      if (lo > hi) return Infinity;
    }
  }
  return lo;
}

export function lineOfSight(m: ArenaMap, a: Vec3, b: Vec3): boolean {
  const d: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = Math.hypot(d[0], d[1], d[2]);
  if (len < 1e-6) return true;
  d[0] /= len; d[1] /= len; d[2] /= len;
  return raycastMap(m, a, d, len) === Infinity;
}

export function spawnAnchors(m: ArenaMap, team: 'A' | 'B'): MapAnchor[] {
  const side = team === 'A' ? 'west' : 'east';
  return m.data.anchors.filter((a) => a.kind === 'spawn' && a.team === side);
}

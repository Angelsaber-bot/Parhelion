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
  /** Optional lighting mood for the client (see src/atmosphere.ts and src/chapterEffects.ts). */
  presentation?: MapPresentation;
}

/** Client-only light dressing; never read by collision, bots or the server rules. */
export interface MapPresentation {
  preset?: string;
  /** Flame/lamp halos: x, y, z, world size, colour, flicker 0..1. */
  glows?: [number, number, number, number, string, number?][];
  /** Light thrown on the ground: x, y, z, radius, colour, strength. */
  pools?: [number, number, number, number, string, number?][];
  /** Fires that shed rising embers: x, y, z, spread radius. */
  embers?: [number, number, number, number][];
  /** Slow smoke columns (usually background): x, y, z, scale, colour. */
  smoke?: [number, number, number, number, string?][];
  /** One drifting ambient field inside a box. */
  field?: { kind: 'fireflies' | 'glitter' | 'pollen'; count: number; color: string; size: number; min: Vec3; max: Vec3 };
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
  /** Horizontal capsule-centre limits, inset from the supported/authored map edge. */
  movementBounds: { minX: number; maxX: number; minZ: number; maxZ: number };
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
  // Leave one solver epsilon inside the floor edge so position quantization cannot move
  // the capsule outside it. This is horizontal only: ramps, decks and jumps keep their Y.
  const inset = p.radius + EPS;
  const movementBounds = { minX: data.bounds.min[0] + inset, maxX: data.bounds.max[0] - inset,
    minZ: data.bounds.min[2] + inset, maxZ: data.bounds.max[2] - inset };
  return { data, solids, radius: p.radius, height: p.height, eye: p.eyeHeight, step: p.stepHeight, movementBounds };
}

const EPS = 0.001;

// ---------- broad phase: a uniform XZ grid over the solids ----------
// Every query below used to scan all solids; CAM LANN has ~300. Candidates are visited in
// their original index order, so every result is identical to the full scan.
const CELL = 2;
interface Grid { ox: number; oz: number; nx: number; nz: number; cells: number[][]; mark: Uint32Array; stamp: number; buf: number[] }
const grids = new WeakMap<ArenaMap, Grid | null>();

function gridOf(m: ArenaMap): Grid | null {
  let g = grids.get(m);
  if (g !== undefined) return g;
  g = null;
  if (m.solids.length >= 24) {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const s of m.solids) { x0 = Math.min(x0, s.minX); x1 = Math.max(x1, s.maxX); z0 = Math.min(z0, s.minZ); z1 = Math.max(z1, s.maxZ); }
    const ox = x0 - 1, oz = z0 - 1, nx = Math.ceil((x1 + 1 - ox) / CELL), nz = Math.ceil((z1 + 1 - oz) / CELL);
    const cells: number[][] = Array.from({ length: nx * nz }, () => []);
    m.solids.forEach((s, i) => {
      const a = Math.floor((s.minX - 0.01 - ox) / CELL), b = Math.floor((s.maxX + 0.01 - ox) / CELL);
      const c = Math.floor((s.minZ - 0.01 - oz) / CELL), d = Math.floor((s.maxZ + 0.01 - oz) / CELL);
      for (let cz = c; cz <= d; cz++) for (let cx = a; cx <= b; cx++) cells[cz * nx + cx].push(i);
    });
    g = { ox, oz, nx, nz, cells, mark: new Uint32Array(m.solids.length), stamp: 0, buf: [] };
  }
  grids.set(m, g);
  return g;
}

/** Test hook: force the full scan so the grid can be checked against it. */
export function disableGrid(m: ArenaMap): void { grids.set(m, null); }

/** Indices of solids whose cells touch the square (x±r, z±r), ascending; null = scan everything. */
function near(m: ArenaMap, x: number, z: number, r: number): number[] | null {
  const g = gridOf(m);
  if (!g) return null;
  const out = g.buf; out.length = 0;
  const a = Math.max(0, Math.floor((x - r - g.ox) / CELL)), b = Math.min(g.nx - 1, Math.floor((x + r - g.ox) / CELL));
  const c = Math.max(0, Math.floor((z - r - g.oz) / CELL)), d = Math.min(g.nz - 1, Math.floor((z + r - g.oz) / CELL));
  if (a > b || c > d) return out;
  if (a === b && c === d) { for (const i of g.cells[c * g.nx + a]) out.push(i); return out; }
  const stamp = ++g.stamp;
  for (let cz = c; cz <= d; cz++) for (let cx = a; cx <= b; cx++) for (const i of g.cells[cz * g.nx + cx]) {
    if (g.mark[i] !== stamp) { g.mark[i] = stamp; out.push(i); }
  }
  return out.sort((p, q) => p - q);
}

/** The same playable footprint is used by movement, spawn validation and bot navigation. */
export function insideMovementBounds(m: ArenaMap, x: number, z: number): boolean {
  const b = m.movementBounds;
  return x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ;
}

/** Last-resort horizontal edge correction; never teleport to a spawn or change vertical tiers. */
export function constrainToBounds(m: ArenaMap, p: { x: number; z: number; vx: number; vz: number }): void {
  const b = m.movementBounds;
  p.x = Math.max(b.minX, Math.min(b.maxX, p.x));
  p.z = Math.max(b.minZ, Math.min(b.maxZ, p.z));
  if ((p.x <= b.minX && p.vx < 0) || (p.x >= b.maxX && p.vx > 0)) p.vx = 0;
  if ((p.z <= b.minZ && p.vz < 0) || (p.z >= b.maxZ && p.vz > 0)) p.vz = 0;
}

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
  const ids = near(m, x, z, EPS * 2);
  const n = ids ? ids.length : m.solids.length;
  for (let k = 0; k < n; k++) {
    const s = m.solids[ids ? ids[k] : k];
    if (!inside(s, x, z)) continue;
    const t = topAt(s, x, z);
    if (t <= y + m.step + EPS && t > g) g = t;
  }
  return g;
}

/** Solid whose side would intersect the player's footprint at (x,z) standing at y, if any. */
export function blockedAt(m: ArenaMap, x: number, z: number, y: number, height = m.height): Solid | null {
  const ids = near(m, x, z, m.radius);
  const n = ids ? ids.length : m.solids.length;
  for (let k = 0; k < n; k++) {
    const s = m.solids[ids ? ids[k] : k];
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
  const ids = near(m, x, z, m.radius);
  const n = ids ? ids.length : m.solids.length;
  for (let k = 0; k < n; k++) {
    const s = m.solids[ids ? ids[k] : k];
    if (!overlaps(s, x, z, m.radius)) continue;
    if (s.minY >= y + height - 0.05 && s.minY < c) c = s.minY;
  }
  return c;
}

/** Push the footprint out of any solid side it already overlaps (e.g. after falling beside a ramp). */
export function recover(m: ArenaMap, p: { x: number; y: number; z: number }, height = m.height): void {
  // Nearly always nothing overlaps: confirm that from the grid, else run the exact full passes.
  const ids = near(m, p.x, p.z, m.radius);
  if (ids && !ids.some((i) => {
    const s = m.solids[i];
    if (!overlaps(s, p.x, p.z, m.radius)) return false;
    const qx = Math.max(s.minX, Math.min(p.x, s.maxX));
    const qz = Math.max(s.minZ, Math.min(p.z, s.maxZ));
    return !(topAt(s, qx, qz) <= p.y + m.step + EPS || s.minY >= p.y + height - 0.02);
  })) return;
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
  const g = gridOf(m);
  if (!g) {
    for (const s of m.solids) {
      const t = raySolid(s, o, d, best);
      if (t < best) { best = t; hit = true; }
    }
    return hit ? best : Infinity;
  }
  // Walk the XZ cells the ray crosses (2D DDA), stopping once the next cell starts beyond the
  // nearest hit so far. A minimum distance does not depend on visiting order.
  let t0 = 0, t1 = maxDist;
  const lim: [number, number, number, number][] = [[o[0], d[0], g.ox, g.ox + g.nx * CELL], [o[2], d[2], g.oz, g.oz + g.nz * CELL]];
  for (const [p, v, lo, hi] of lim) {
    if (Math.abs(v) < 1e-12) { if (p < lo || p > hi) return Infinity; continue; }
    let a = (lo - p) / v, b = (hi - p) / v;
    if (a > b) [a, b] = [b, a];
    if (a > t0) t0 = a;
    if (b < t1) t1 = b;
  }
  if (t0 > t1) return Infinity;
  const clampCell = (v: number, n: number) => Math.max(0, Math.min(n - 1, Math.floor(v)));
  let cx = clampCell((o[0] + d[0] * t0 - g.ox) / CELL, g.nx), cz = clampCell((o[2] + d[2] * t0 - g.oz) / CELL, g.nz);
  const sx = d[0] > 0 ? 1 : -1, sz = d[2] > 0 ? 1 : -1;
  const ddx = Math.abs(d[0]) < 1e-12 ? Infinity : CELL / Math.abs(d[0]), ddz = Math.abs(d[2]) < 1e-12 ? Infinity : CELL / Math.abs(d[2]);
  let tx = ddx === Infinity ? Infinity : (g.ox + (cx + (sx > 0 ? 1 : 0)) * CELL - o[0]) / d[0];
  let tz = ddz === Infinity ? Infinity : (g.oz + (cz + (sz > 0 ? 1 : 0)) * CELL - o[2]) / d[2];
  const stamp = ++g.stamp;
  for (;;) {
    for (const i of g.cells[cz * g.nx + cx]) {
      if (g.mark[i] === stamp) continue;
      g.mark[i] = stamp;
      const t = raySolid(m.solids[i], o, d, best);
      if (t < best) { best = t; hit = true; }
    }
    const next = Math.min(tx, tz);
    if (next >= best || next > t1) break;
    if (tx < tz) { cx += sx; tx += ddx; if (cx < 0 || cx >= g.nx) break; }
    else { cz += sz; tz += ddz; if (cz < 0 || cz >= g.nz) break; }
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

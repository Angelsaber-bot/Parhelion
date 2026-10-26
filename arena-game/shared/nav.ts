// Walkable grid + A* over the arena collision model, for bots.
// Nodes are (cell, surface) pairs so the gallery deck and the floor beneath it are separate.

import { blockedAt, topAt, type ArenaMap } from './map.ts';

export interface NavNode { id: number; x: number; y: number; z: number; links: number[]; costs: number[] }

const CELL = 0.5;
const MAX_UP = 0.32; // per 0.5 m cell; ramps rise 0.15
const MAX_DROP = 3.6;

export class NavGrid {
  nodes: NavNode[] = [];
  private cells = new Map<number, number[]>(); // cell key -> node ids
  private nx: number;
  private nz: number;
  private x0: number;
  private z0: number;

  constructor(readonly map: ArenaMap) {
    const { min, max } = map.data.bounds;
    this.x0 = min[0] + CELL / 2;
    this.z0 = min[2] + CELL / 2;
    this.nx = Math.floor((max[0] - min[0]) / CELL);
    this.nz = Math.floor((max[2] - min[2]) / CELL);
    for (let i = 0; i < this.nx; i++) {
      for (let k = 0; k < this.nz; k++) {
        const x = this.x0 + i * CELL, z = this.z0 + k * CELL;
        const ids: number[] = [];
        for (const y of this.surfaces(x, z)) {
          if (blockedAt(map, x, z, y)) continue;
          // need headroom: no solid underside within player height
          if (map.solids.some((s) => s.minY > y + 0.05 && s.minY < y + map.height && x > s.minX - map.radius &&
            x < s.maxX + map.radius && z > s.minZ - map.radius && z < s.maxZ + map.radius)) continue;
          const id = this.nodes.length;
          this.nodes.push({ id, x, y, z, links: [], costs: [] });
          ids.push(id);
        }
        if (ids.length) this.cells.set(i * this.nz + k, ids);
      }
    }
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    for (const [key, ids] of this.cells) {
      const i = Math.floor(key / this.nz), k = key % this.nz;
      for (const id of ids) {
        const a = this.nodes[id];
        for (const [di, dk] of dirs) {
          const nb = this.cells.get((i + di) * this.nz + (k + dk));
          if (!nb || i + di < 0 || i + di >= this.nx || k + dk < 0 || k + dk >= this.nz) continue;
          if (di && dk && (!this.cells.has((i + di) * this.nz + k) || !this.cells.has(i * this.nz + k + dk))) continue;
          for (const bid of nb) {
            const b = this.nodes[bid];
            const dy = b.y - a.y;
            const diag = di && dk ? Math.SQRT2 : 1;
            if (dy > MAX_UP * diag || dy < -MAX_DROP) continue;
            if (dy < -MAX_UP * diag) {
              // drop-down: only off a real edge, never through a solid side
              if (blockedAt(this.map, b.x, b.z, a.y)) continue;
            } else if (blockedAt(this.map, (a.x + b.x) / 2, (a.z + b.z) / 2, Math.max(a.y, b.y))) continue;
            a.links.push(bid);
            a.costs.push(CELL * diag + (dy < -MAX_UP ? 1.5 : 0));
          }
        }
      }
    }
  }

  private surfaces(x: number, z: number): number[] {
    const tops: number[] = [];
    for (const s of this.map.solids) {
      if (x < s.minX || x > s.maxX || z < s.minZ || z > s.maxZ) continue;
      const t = topAt(s, x, z);
      if (!tops.some((v) => Math.abs(v - t) < 0.05)) tops.push(t);
    }
    return tops;
  }

  /** Nearest node to a position, preferring the surface at or just below y. */
  nearest(x: number, y: number, z: number): NavNode | null {
    const ci = Math.round((x - this.x0) / CELL), ck = Math.round((z - this.z0) / CELL);
    let best: NavNode | null = null, bestD = Infinity;
    for (let r = 0; r <= 6 && !best; r++) {
      for (let i = ci - r; i <= ci + r; i++) {
        for (let k = ck - r; k <= ck + r; k++) {
          for (const id of this.cells.get(i * this.nz + k) ?? []) {
            const n = this.nodes[id];
            if (n.links.length === 0) continue;
            const dy = n.y - y;
            const d = Math.hypot(n.x - x, n.z - z) + (dy > 0.4 ? 10 + dy : Math.abs(dy) * 2);
            if (d < bestD) { bestD = d; best = n; }
          }
        }
      }
    }
    return best;
  }

  /** A* path as a list of nodes (start excluded), or null. */
  path(from: NavNode, to: NavNode, maxExpand = 20000): NavNode[] | null {
    const g = new Map<number, number>([[from.id, 0]]);
    const came = new Map<number, number>();
    const open = new MinHeap();
    const h = (n: NavNode) => Math.hypot(n.x - to.x, n.z - to.z) + Math.abs(n.y - to.y);
    open.push(from.id, h(from));
    const closed = new Set<number>();
    let expanded = 0;
    while (open.size) {
      const cur = open.pop()!;
      if (cur === to.id) {
        const out: NavNode[] = [];
        for (let c = cur; c !== from.id; c = came.get(c)!) out.push(this.nodes[c]);
        return out.reverse();
      }
      if (closed.has(cur)) continue;
      closed.add(cur);
      if (++expanded > maxExpand) return null;
      const n = this.nodes[cur];
      const gc = g.get(cur)!;
      for (let i = 0; i < n.links.length; i++) {
        const nb = n.links[i], ng = gc + n.costs[i];
        if (ng < (g.get(nb) ?? Infinity)) {
          g.set(nb, ng);
          came.set(nb, cur);
          open.push(nb, ng + h(this.nodes[nb]));
        }
      }
    }
    return null;
  }
}

class MinHeap {
  private ids: number[] = [];
  private keys: number[] = [];
  get size() { return this.ids.length; }
  push(id: number, key: number) {
    let i = this.ids.length;
    this.ids.push(id); this.keys.push(key);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.keys[p] <= key) break;
      this.ids[i] = this.ids[p]; this.keys[i] = this.keys[p];
      i = p;
    }
    this.ids[i] = id; this.keys[i] = key;
  }
  pop(): number | undefined {
    if (!this.ids.length) return undefined;
    const top = this.ids[0];
    const id = this.ids.pop()!, key = this.keys.pop()!;
    if (this.ids.length) {
      let i = 0;
      const n = this.ids.length;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && this.keys[c + 1] < this.keys[c]) c++;
        if (this.keys[c] >= key) break;
        this.ids[i] = this.ids[c]; this.keys[i] = this.keys[c];
        i = c;
      }
      this.ids[i] = id; this.keys[i] = key;
    }
    return top;
  }
}

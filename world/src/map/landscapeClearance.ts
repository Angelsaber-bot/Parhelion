import * as THREE from 'three';

/** Remove complete small prop components from the excavation, including their
 * collision proxies. Weld positions only for connectivity; leave authored
 * normals, colours and indices intact in the retained geometry. */
export function clearLandscapeProps(name: string, geometry: THREE.BufferGeometry, clearance: readonly (readonly [number, number, number, number])[], treePaths: readonly (readonly (readonly [number, number])[])[] = []) {
  if (!/^(Trees_Trunks|Trees_Leaves|Rocks|Bushes|COL_Props)$/.test(name)) return null;
  const pos = geometry.getAttribute('position'), index = geometry.index;
  if (!pos) return null;
  const count = index?.count ?? pos.count;
  const parents = new Int32Array(pos.count); for (let i = 0; i < parents.length; i++) parents[i] = i;
  const root = (i: number): number => { while (parents[i] !== i) { parents[i] = parents[parents[i]]; i = parents[i]; } return i; };
  const join = (a: number, b: number) => { parents[root(a)] = root(b); };
  const welded = new Map<string, number>();
  for (let i = 0; i < pos.count; i++) {
    const key = `${Math.round(pos.getX(i) * 1000)},${Math.round(pos.getY(i) * 1000)},${Math.round(pos.getZ(i) * 1000)}`;
    const prior = welded.get(key); if (prior === undefined) welded.set(key, i); else join(i, prior);
  }
  const at = (i: number) => index?.getX(i) ?? i;
  for (let i = 0; i < count; i += 3) { join(at(i), at(i + 1)); join(at(i), at(i + 2)); }
  const bounds = new Map<number, [number, number, number, number, number, number]>();
  for (let i = 0; i < pos.count; i++) {
    const id = root(i), x = pos.getX(i), z = pos.getZ(i), b = bounds.get(id);
    if (!b) bounds.set(id, [x, z, x, z, pos.getY(i), pos.getY(i)]);
    else { b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], z); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], z); b[4] = Math.min(b[4], pos.getY(i)); b[5] = Math.max(b[5], pos.getY(i)); }
  }
  const remove = new Set<number>();
  for (const [id, b] of bounds) {
    if (b[2] - b[0] > 14 || b[3] - b[1] > 14) continue;
    const x = (b[0] + b[2]) / 2, z = (b[1] + b[3]) / 2;
    const inBuilding = clearance.some(r => x > r[0] - 3 && x < r[2] + 3 && z > r[1] - 3 && z < r[3] + 3);
    // Shipped tree collision is a 4 m tall, sub-metre box. Along roads remove
    // only trees and their proxies, preserving existing walls, lamps and cover.
    const tree = name.startsWith('Trees_') || (name === 'COL_Props' && Math.abs(b[5] - b[4] - 4) < .08 && b[2] - b[0] < 1.4 && b[3] - b[1] < 1.4);
    const inPath = tree && treePaths.some(path => path.slice(1).some((to, i) => {
      const from = path[i], dx = to[0] - from[0], dz = to[1] - from[1];
      const t = Math.max(0, Math.min(1, ((x - from[0]) * dx + (z - from[1]) * dz) / (dx * dx + dz * dz || 1)));
      return Math.hypot(x - from[0] - dx * t, z - from[1] - dz * t) < 4.5;
    }));
    if (inBuilding || inPath) remove.add(id);
  }
  if (!remove.size) return null;
  const keep: number[] = [];
  for (let i = 0; i < count; i += 3) if (!remove.has(root(at(i)))) keep.push(at(i), at(i + 1), at(i + 2));
  const result = geometry.clone(); result.setIndex(keep); return result;
}

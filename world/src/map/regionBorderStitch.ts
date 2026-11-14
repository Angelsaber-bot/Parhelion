import * as THREE from 'three';

/**
 * Region tiles are authored (and carved at load) separately, and in places the two tiles' edges sit at
 * different heights along their shared border: a straight cliff, up to ten metres high, exactly on the
 * tile line. This stitches every interior border: both edges move to one shared height profile, and the
 * correction fades to nothing over a band either side, so the land rises or falls into its neighbour.
 * Everything standing in the band (terrain, collision, trees, rocks, streamed art) takes the same vertical
 * offset for its position, so nothing is left floating or buried.
 */
export const BORDER_STITCH = Object.freeze({ band: 24, cell: 2, smooth: 3, min: .02 });

type Line = { axis: 'x' | 'z'; at: number; t0: number; low: Float32Array; high: Float32Array };
const fall = (d: number, band: number) => { const k = Math.min(1, Math.max(0, d / band)); return 1 - k * k * (3 - 2 * k); };

export interface BorderStitch {
  /** How many border samples needed moving, and the largest edge mismatch found (m). */
  readonly samples: number; readonly worst: number;
  /** Vertical offset for a world position. `tile` is the centre of the tile the geometry belongs to: it
   * decides the side for points exactly on a border line. */
  offsetAt(x: number, z: number, tile: readonly [number, number]): number;
  /** Shift a geometry's vertices by the offset at each one's world position. `toWorld` maps the geometry's
   * own (x, z) to world. Returns how many vertices moved; refreshes existing bounds when any did. */
  apply(geometry: THREE.BufferGeometry, toWorld: (x: number, z: number) => readonly [number, number], tile: readonly [number, number]): number;
}

/**
 * Read each tile's own edge heights from its terrain mesh and plan the stitch.
 * `tiles`: one terrain mesh per region (world matrices current) with the tile's centre.
 */
export function planBorderStitch(tiles: readonly { terrain: THREE.Mesh; center: readonly [number, number] }[], borders: { xs: readonly number[]; zs: readonly number[] },
  extent: { x0: number; z0: number; span: number; spanZ: number }, band: number = BORDER_STITCH.band): BorderStitch {
  const cell = BORDER_STITCH.cell;
  const lines: Line[] = [
    ...borders.xs.map(at => ({ axis: 'x' as const, at, t0: extent.z0, low: new Float32Array(Math.round(extent.spanZ / cell) + 1).fill(NaN), high: new Float32Array(Math.round(extent.spanZ / cell) + 1).fill(NaN) })),
    ...borders.zs.map(at => ({ axis: 'z' as const, at, t0: extent.x0, low: new Float32Array(Math.round(extent.span / cell) + 1).fill(NaN), high: new Float32Array(Math.round(extent.span / cell) + 1).fill(NaN) })),
  ];
  const v = new THREE.Vector3();
  for (const { terrain, center } of tiles) {
    const pos = (terrain.geometry as THREE.BufferGeometry).attributes.position as THREE.BufferAttribute | undefined; if (!pos) continue;
    for (let k = 0; k < pos.count; k++) {
      v.fromBufferAttribute(pos, k).applyMatrix4(terrain.matrixWorld);
      for (const line of lines) {
        const across = line.axis === 'x' ? v.x : v.z; if (Math.abs(across - line.at) > .05) continue;
        const i = Math.round(((line.axis === 'x' ? v.z : v.x) - line.t0) / cell), side = (line.axis === 'x' ? center[0] : center[1]) < line.at ? line.low : line.high;
        if (i >= 0 && i < side.length) side[i] = v.y;
      }
    }
  }
  // One shared profile per border: the smoothed mean of the two edges. Each side's correction is the
  // distance to it, so the edges meet exactly however the mean was smoothed.
  let samples = 0, worst = 0;
  for (const line of lines) {
    const n = line.low.length, mean = new Float32Array(n).fill(NaN);
    for (let i = 0; i < n; i++) if (!Number.isNaN(line.low[i]) && !Number.isNaN(line.high[i])) { mean[i] = (line.low[i] + line.high[i]) / 2; const gap = Math.abs(line.low[i] - line.high[i]); if (gap > BORDER_STITCH.min) { samples++; worst = Math.max(worst, gap); } }
    for (let i = 0; i < n; i++) {
      if (Number.isNaN(mean[i])) { line.low[i] = line.high[i] = 0; continue; }
      let s = 0, c = 0; for (let k = Math.max(0, i - BORDER_STITCH.smooth); k <= Math.min(n - 1, i + BORDER_STITCH.smooth); k++) if (!Number.isNaN(mean[k])) { s += mean[k]; c++; }
      const target = s / c, lo = target - line.low[i], hi = target - line.high[i];
      line.low[i] = lo; line.high[i] = hi; // now corrections, not heights
    }
  }
  const at = (side: Float32Array, f: number) => { const i = Math.floor(f); if (i < 0 || i >= side.length - 1) return 0; const k = f - i; return side[i] * (1 - k) + side[i + 1] * k; };
  const offsetAt = (x: number, z: number, tile: readonly [number, number]) => {
    if (!samples) return 0;
    let y = 0;
    for (const line of lines) {
      const across = (line.axis === 'x' ? x : z) - line.at, d = Math.abs(across); if (d >= band) continue;
      const low = d < .05 ? (line.axis === 'x' ? tile[0] : tile[1]) < line.at : across < 0;
      y += at(low ? line.low : line.high, ((line.axis === 'x' ? z : x) - line.t0) / cell) * fall(d, band);
    }
    return y;
  };
  return {
    samples, worst, offsetAt,
    apply(geometry, toWorld, tile) {
      if (!samples) return 0;
      const pos = geometry.attributes.position as THREE.BufferAttribute | undefined;
      if (!pos || !(pos.array instanceof Float32Array) || (pos as unknown as { isInterleavedBufferAttribute?: boolean }).isInterleavedBufferAttribute) return 0;
      let moved = 0;
      for (let k = 0; k < pos.count; k++) {
        const [wx, wz] = toWorld(pos.getX(k), pos.getZ(k)), dy = offsetAt(wx, wz, tile);
        if (Math.abs(dy) > 1e-4) { pos.setY(k, pos.getY(k) + dy); moved++; }
      }
      // Bounds are recomputed in place: cullers read `boundingSphere` straight after and must never find null.
      if (moved) { pos.needsUpdate = true; if (geometry.boundingBox) geometry.computeBoundingBox(); if (geometry.boundingSphere) geometry.computeBoundingSphere(); }
      return moved;
    },
  };
}

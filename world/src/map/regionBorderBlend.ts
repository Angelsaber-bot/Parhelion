import * as THREE from 'three';

/**
 * Regions are authored as separate 720 m tiles, each with its own painted terrain colours. Where two
 * tiles meet, the colours used to change along a perfectly straight line (snow to meadow, sand to
 * grass). This softens every interior tile border: inside a band either side of the line the terrain
 * colour is averaged across the border, with the averaging width growing towards the line, so the two
 * palettes run into each other over tens of metres. It rewrites the world grid's colours (which grass
 * and maps read) and the terrain meshes' vertex colours from them. Heights are never touched.
 */
export const BORDER_BLEND = Object.freeze({ band: 30 });

type GridLike = { nx: number; nz: number; x0: number; z0: number; cell: number; h: Float32Array; col: Float32Array };

/** Interior borders between adjacent region tiles: the lines halfway between neighbouring tile centres. */
export function regionBorders(regions: readonly { offset: readonly [number, number] }[]) {
  const mids = (values: number[]) => { const u = [...new Set(values)].sort((a, b) => a - b); return u.slice(1).map((v, i) => (v + u[i]) / 2); };
  return { xs: mids(regions.map(r => r.offset[0])), zs: mids(regions.map(r => r.offset[1])) };
}

/** Blend `grid.col` across the given borders in place. Returns a mask of the cells that changed band (1 = inside a band).
 * Pass `waterLevel` so submerged ground takes no part. */
export function blendGridBorders(grid: GridLike, borders: { xs: readonly number[]; zs: readonly number[] }, band: number = BORDER_BLEND.band, waterLevel = -Infinity) {
  const { nx, nz, cell } = grid, N = nx * nz, mask = new Uint8Array(N), reach = Math.ceil(band / cell);
  // Cells no terrain vertex reached keep the sea default, and ground under water is painted for the lake or
  // sea bed (often near black, never seen): neither is averaged in, and neither is repainted.
  const covered = (q: number) => grid.h[q] > -11.5 && grid.h[q] >= waterLevel - .05;
  const pass = (lines: readonly number[], alongX: boolean) => {
    const src = grid.col.slice();
    for (const line of lines) {
      const li = (line - (alongX ? grid.x0 : grid.z0)) / cell, count = alongX ? nx : nz, other = alongX ? nz : nx;
      for (let a = Math.max(0, Math.ceil(li - reach)); a <= Math.min(count - 1, Math.floor(li + reach)); a++) {
        const d = Math.abs(a - li) * cell; if (d >= band) continue;
        // Averaging half-width shrinks from the full band on the line to nothing at the band's edge.
        const r = Math.round((band - d) / cell); if (r < 1) continue;
        for (let b = 0; b < other; b++) {
          const q = alongX ? b * nx + a : a * nx + b; if (!covered(q)) continue;
          let sr = 0, sg = 0, sb = 0, n = 0;
          for (let k = Math.max(0, a - r); k <= Math.min(count - 1, a + r); k++) {
            const p = alongX ? b * nx + k : k * nx + b; if (!covered(p)) continue;
            sr += src[p * 3]; sg += src[p * 3 + 1]; sb += src[p * 3 + 2]; n++;
          }
          if (n) { grid.col[q * 3] = sr / n; grid.col[q * 3 + 1] = sg / n; grid.col[q * 3 + 2] = sb / n; mask[q] = 1; }
        }
      }
    }
  };
  pass(borders.xs, true); pass(borders.zs, false);
  return mask;
}

/** Write the blended grid colours back onto terrain vertices that fall in a border band. Returns how many changed.
 * Terrain chunks share the source mesh's attributes, so this reaches every chunk. */
export function applyBorderBlend(terrains: readonly THREE.Mesh[], grid: GridLike, mask: Uint8Array) {
  const v = new THREE.Vector3(); let changed = 0;
  for (const t of terrains) {
    const g = t.geometry as THREE.BufferGeometry, pos = g.attributes.position as THREE.BufferAttribute | undefined, col = g.attributes.color as THREE.BufferAttribute | undefined;
    if (!pos || !col) continue;
    let touched = false;
    for (let k = 0; k < pos.count; k++) {
      v.fromBufferAttribute(pos, k).applyMatrix4(t.matrixWorld);
      const i = Math.round((v.x - grid.x0) / grid.cell), j = Math.round((v.z - grid.z0) / grid.cell);
      if (i < 0 || j < 0 || i >= grid.nx || j >= grid.nz) continue;
      const q = j * grid.nx + i; if (!mask[q]) continue;
      col.setXYZ(k, grid.col[q * 3], grid.col[q * 3 + 1], grid.col[q * 3 + 2]); changed++; touched = true;
    }
    if (touched) col.needsUpdate = true;
  }
  return changed;
}

// One terrain grid for the whole world, baked from every region's terrain mesh.
// Grass, water depth and the map all read from it, so regions join without seams.
import * as THREE from 'three';

export class WorldGrid {
  /** cells along x and z (the grid may be a rectangle: regions sit side by side along x) */
  nx: number;
  nz: number;
  spanZ: number;
  h: Float32Array;
  ny: Float32Array;
  col: Float32Array; // linear RGB
  constructor(terrains: THREE.Mesh[], public x0: number, public z0: number, public span: number, public cell = 2, sea = '#4f8fa8', spanZ = span) {
    this.spanZ = spanZ;
    this.nx = Math.round(span / cell) + 1;
    this.nz = Math.round(spanZ / cell) + 1;
    const N = this.nx * this.nz;
    this.h = new Float32Array(N).fill(-12);
    this.ny = new Float32Array(N).fill(1);
    this.col = new Float32Array(N * 3);
    const s = new THREE.Color(sea);
    for (let k = 0; k < N; k++) { this.col[k * 3] = s.r; this.col[k * 3 + 1] = s.g; this.col[k * 3 + 2] = s.b; }
    const v = new THREE.Vector3();
    for (const t of terrains) {
      // matrixWorld was computed while the terrain was still parented (chunking detaches it)
      const g = t.geometry as THREE.BufferGeometry;
      const pos = g.attributes.position as THREE.BufferAttribute;
      const nor = g.attributes.normal as THREE.BufferAttribute;
      const col = g.attributes.color as THREE.BufferAttribute;
      for (let k = 0; k < pos.count; k++) {
        v.fromBufferAttribute(pos, k).applyMatrix4(t.matrixWorld);
        const i = Math.round((v.x - x0) / cell), j = Math.round((v.z - z0) / cell);
        if (i < 0 || j < 0 || i >= this.nx || j >= this.nz) continue;
        const q = j * this.nx + i;
        this.h[q] = v.y;
        this.ny[q] = nor.getY(k);
        this.col[q * 3] = col.getX(k); this.col[q * 3 + 1] = col.getY(k); this.col[q * 3 + 2] = col.getZ(k);
      }
    }
  }

  /** Terrain-only bilinear sample: unlike a collision ray, this cannot hit a house roof. */
  sampleHeight(x: number, z: number): number | null {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
    const fx = (x - this.x0) / this.cell, fz = (z - this.z0) / this.cell;
    if (fx < 0 || fz < 0 || fx > this.nx - 1 || fz > this.nz - 1 || this.nx < 2 || this.nz < 2) return null;
    const ix = Math.min(Math.floor(fx), this.nx - 2), iz = Math.min(Math.floor(fz), this.nz - 2);
    const tx = fx - ix, tz = fz - iz, i = iz * this.nx + ix;
    const height = THREE.MathUtils.lerp(
      THREE.MathUtils.lerp(this.h[i], this.h[i + 1], tx),
      THREE.MathUtils.lerp(this.h[i + this.nx], this.h[i + this.nx + 1], tx), tz,
    );
    return Number.isFinite(height) ? height : null;
  }

  heightTexture() {
    const tex = new THREE.DataTexture(this.h, this.nx, this.nz, THREE.RedFormat, THREE.FloatType);
    tex.magFilter = tex.minFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return tex;
  }
}

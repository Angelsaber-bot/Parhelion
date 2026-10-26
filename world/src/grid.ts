// One terrain grid for the whole world, baked from every region's terrain mesh.
// Grass, water depth and the map all read from it, so regions join without seams.
import * as THREE from 'three';

export class WorldGrid {
  n: number;
  h: Float32Array;
  ny: Float32Array;
  col: Float32Array; // linear RGB
  constructor(terrains: THREE.Mesh[], public x0: number, public z0: number, public span: number, public cell = 2, sea = '#4f8fa8') {
    this.n = Math.round(span / cell) + 1;
    const N = this.n * this.n;
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
        if (i < 0 || j < 0 || i >= this.n || j >= this.n) continue;
        const q = j * this.n + i;
        this.h[q] = v.y;
        this.ny[q] = nor.getY(k);
        this.col[q * 3] = col.getX(k); this.col[q * 3 + 1] = col.getY(k); this.col[q * 3 + 2] = col.getZ(k);
      }
    }
  }

  heightTexture() {
    const tex = new THREE.DataTexture(this.h, this.n, this.n, THREE.RedFormat, THREE.FloatType);
    tex.magFilter = tex.minFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return tex;
  }
}

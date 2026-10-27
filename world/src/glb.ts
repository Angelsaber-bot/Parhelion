// Region GLBs ship meshopt-compressed and quantized (EXT_meshopt_compression + KHR_mesh_quantization),
// which keeps each file far under the 25 MiB per-file limit of Cloudflare Pages.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

export function regionLoader() {
  return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
}

/**
 * Undo quantization: expand every mesh's attributes back to float and fold the node's dequantization
 * transform into the geometry, so meshes are in region space with identity transforms again
 * (chunking, pivots and the terrain grid all expect that).
 */
export function bakeQuantized(root: THREE.Object3D) {
  // identical quantized meshes (same-shaped gates, targets) can share one geometry: give each its own
  // copy before baking, or the shared one would take every node's transform in turn
  const seen = new Set<THREE.BufferGeometry>();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    if (seen.has(m.geometry)) m.geometry = m.geometry.clone();
    seen.add(m.geometry);
  });
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const g = m.geometry as THREE.BufferGeometry;
    for (const [name, attr] of Object.entries(g.attributes) as [string, THREE.BufferAttribute][]) {
      if (attr.array instanceof Float32Array && !attr.normalized) continue;
      const out = new Float32Array(attr.count * attr.itemSize);
      for (let i = 0; i < attr.count; i++) for (let c = 0; c < attr.itemSize; c++) out[i * attr.itemSize + c] = attr.getComponent(i, c);
      g.setAttribute(name, new THREE.BufferAttribute(out, attr.itemSize));
    }
    m.updateMatrix();
    if (!m.matrix.equals(new THREE.Matrix4())) {
      g.applyMatrix4(m.matrix);
      m.position.set(0, 0, 0); m.quaternion.identity(); m.scale.set(1, 1, 1);
      m.updateMatrix();
    }
    g.computeBoundingBox(); g.computeBoundingSphere();
  });
  root.updateMatrixWorld(true);
}

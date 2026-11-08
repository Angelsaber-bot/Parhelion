import * as THREE from 'three';

export interface ConsumedSourceReceipt {
  readonly roots: readonly { name: 'COLLISION' | 'MARKERS'; objects: number; meshes: number }[];
  readonly objects: number; readonly meshes: number; readonly geometries: number;
  /** Unique JS backing stores, not GPU allocation or guaranteed freed memory. */
  readonly backingBytes: number;
  readonly sharedArtGeometryReferences: number;
  readonly sharedProtectedGeometryReferences: number;
  readonly sharedArtBackingBuffers: number;
  readonly sharedProtectedBackingBuffers: number;
}
function buffers(geometries: Iterable<THREE.BufferGeometry>) {
  const result = new Set<ArrayBufferLike>();
  for (const geometry of geometries) {
    for (const attribute of Object.values(geometry.attributes)) {
      const a = attribute as THREE.BufferAttribute | THREE.InterleavedBufferAttribute;
      const array = (a as THREE.InterleavedBufferAttribute).isInterleavedBufferAttribute
        ? (a as THREE.InterleavedBufferAttribute).data.array : (a as THREE.BufferAttribute).array;
      result.add(array.buffer);
    }
    if (geometry.index) result.add(geometry.index.array.buffer);
  }
  return result;
}
/** Call ONLY after collision copies, gates, target metadata and WorldGrid exist.
 * Removes consumed imported COLLISION/MARKERS trees from scene traversal, not ART.
 * Never disposes geometry/materials: imported buffer stores may be shared, and the
 * authoritative BVH/WorldGrid own their lifecycle. Receipt holds numbers/strings
 * only, so diagnostics do not retain detached Object3D or geometry identities.
 */
export function detachConsumedSourceNodes(world: THREE.Object3D,
  protectedGeometries: Iterable<THREE.BufferGeometry> = []): ConsumedSourceReceipt {
  const candidates: THREE.Object3D[] = [];
  world.traverse(node => { if (node !== world && (node.name === 'COLLISION' || node.name === 'MARKERS')) candidates.push(node); });
  const candidateSet = new Set(candidates);
  const roots = candidates.filter(node => { for (let p = node.parent; p && p !== world; p = p.parent) if (candidateSet.has(p)) return false; return true; });
  const sourceObjects = new Set<THREE.Object3D>(), sourceGeometries = new Set<THREE.BufferGeometry>();
  const detail = roots.map(root => {
    let objects = 0, meshes = 0;
    root.traverse(node => { objects++; sourceObjects.add(node); if ((node as THREE.Mesh).isMesh) { meshes++; sourceGeometries.add((node as THREE.Mesh).geometry); } });
    return { name: root.name as 'COLLISION' | 'MARKERS', objects, meshes };
  });
  const artGeometries = new Set<THREE.BufferGeometry>();
  world.traverse(node => { if (!sourceObjects.has(node) && (node as THREE.Mesh).isMesh) artGeometries.add((node as THREE.Mesh).geometry); });
  const protectedSet = new Set(protectedGeometries);
  const sourceBuffers = buffers(sourceGeometries), artBuffers = buffers(artGeometries), protectedBuffers = buffers(protectedSet);
  const receipt: ConsumedSourceReceipt = {
    roots: detail, objects: sourceObjects.size, meshes: detail.reduce((n, r) => n + r.meshes, 0), geometries: sourceGeometries.size,
    backingBytes: [...sourceBuffers].reduce((n, b) => n + b.byteLength, 0),
    sharedArtGeometryReferences: [...sourceGeometries].filter(g => artGeometries.has(g)).length,
    sharedProtectedGeometryReferences: [...sourceGeometries].filter(g => protectedSet.has(g)).length,
    sharedArtBackingBuffers: [...sourceBuffers].filter(b => artBuffers.has(b)).length,
    sharedProtectedBackingBuffers: [...sourceBuffers].filter(b => protectedBuffers.has(b)).length,
  };
  for (const root of roots) root.removeFromParent();
  return receipt;
}

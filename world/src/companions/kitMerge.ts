import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
/**
 * Procedural gear is authored as dozens of small meshes because that is how it stays readable to
 * edit. Drawn that way it costs a draw call per rivet, and the world shows up to 24 skinned enemies
 * at once, so a dressed patrol would spend more calls on buckles than on the world.
 *
 * Once a kit is attached, every static piece of it is baked down to one mesh per material, in the
 * bone's own space. Pieces an update() animates are marked `userData.dynamic` and left alone, so
 * the closures that drive them keep working. Baked geometry belongs to that one enemy and is
 * released with it.
 */
const dynamic = (o: THREE.Object3D) => o.userData.dynamic === true;

/** Bake one kit group in place. Returns the number of draw calls saved. */
export function bakeKitGroup(group: THREE.Object3D): number {
  const byMaterial = new Map<THREE.Material, THREE.Mesh[]>();
  for (const child of group.children) {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || dynamic(mesh) || Array.isArray(mesh.material)) continue;
    const list = byMaterial.get(mesh.material) ?? []; list.push(mesh); byMaterial.set(mesh.material, list);
  }
  let saved = 0;
  for (const [material, meshes] of byMaterial) {
    if (meshes.length < 2) continue;
    group.updateMatrixWorld(true);
    const parts: THREE.BufferGeometry[] = [];
    for (const mesh of meshes) {
      // Non-indexed with a uv channel: the kits mix extrusions, lathes and hand-built strips,
      // and mergeGeometries refuses a set whose attributes do not line up.
      const geo = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
      if (!geo.getAttribute('uv')) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.getAttribute('position').count * 2), 2));
      if (!geo.getAttribute('normal')) geo.computeVertexNormals();
      geo.deleteAttribute('color'); geo.deleteAttribute('tangent');
      geo.applyMatrix4(mesh.matrix);
      parts.push(geo);
    }
    const merged = mergeGeometries(parts, false);
    parts.forEach(p => p.dispose());
    if (!merged) continue; // A kit that will not bake still draws correctly, piece by piece.
    const baked = new THREE.Mesh(merged, material);
    baked.name = `${group.name}_Baked`; baked.castShadow = true; baked.userData.baked = true;
    for (const mesh of meshes) mesh.removeFromParent();
    group.add(baked);
    saved += meshes.length - 1;
  }
  return saved;
}

/** Bake every kit hung off an enemy's skeleton. Called once, right after the kits attach. */
export function bakeAttachedKits(root: THREE.Object3D): number {
  const groups: THREE.Object3D[] = [];
  root.traverse(o => { if (o.userData.visualOnly === true) groups.push(o); });
  let saved = 0;
  for (const group of groups) saved += bakeKitGroup(group);
  return saved;
}

/** Release the geometry baked for one enemy; the kit's own template geometry is shared and stays. */
export function disposeBakedKits(root: THREE.Object3D) {
  root.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh && m.userData.baked) m.geometry.dispose(); });
}

import * as THREE from 'three';

/** The approved head's maps (including skin texCoord 1), alpha and sidedness are art data.
 * Never pass these through the map-art toonMaterial(), which intentionally drops maps. */
export function preservePlayerMaterial(source: THREE.Material): THREE.Material {
  const material = source.clone();
  material.name = source.name;
  material.userData = { ...source.userData, playerMaterial: true };
  return material;
}

/** A real skinned inverted hull, sharing immutable geometry and the actor's skeleton/morph array. */
export function addPlayerOutline(mesh: THREE.SkinnedMesh, width = .002): THREE.SkinnedMesh {
  const material = new THREE.MeshBasicMaterial({ color: '#302931', side: THREE.BackSide });
  material.name = `${mesh.name}:outline`;
  material.onBeforeCompile = shader => {
    // objectNormal has already passed through morphnormal/skinnormal. Extruding before skinning
    // would distort thickness and miss corrected facial morph normals.
    shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>',
      `transformed += normalize(objectNormal) * ${width.toFixed(6)};\n#include <project_vertex>`);
  };
  material.customProgramCacheKey = () => `player-skinned-outline:${width}`;
  const outline = new THREE.SkinnedMesh(mesh.geometry, material);
  outline.name = `${mesh.name}__outline`;
  outline.skeleton = mesh.skeleton;
  outline.bindMode = mesh.bindMode;
  outline.bindMatrix.copy(mesh.bindMatrix);
  outline.bindMatrixInverse.copy(mesh.bindMatrixInverse);
  outline.morphTargetInfluences = mesh.morphTargetInfluences;
  outline.morphTargetDictionary = mesh.morphTargetDictionary;
  outline.frustumCulled = false;
  outline.castShadow = false;
  outline.receiveShadow = false;
  outline.userData.playerOutline = true;
  outline.raycast = () => {};
  mesh.add(outline);
  return outline;
}

export function wantsPlayerOutline(mesh: THREE.Mesh): boolean {
  const names = `${mesh.name} ${(Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map(m => m.name).join(' ')}`;
  return !/iris|eye|lid|brow|mouth|highlight|seal|decal/i.test(names);
}

/** Actor resources are unique except for deliberate geometry/texture/skeleton sharing. */
export function disposePlayerObject(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const skeletons = new Set<THREE.Skeleton>();
  root.traverse(object => {
    const mesh = object as THREE.SkinnedMesh;
    if (!mesh.isMesh) return;
    geometries.add(mesh.geometry);
    if (mesh.isSkinnedMesh) skeletons.add(mesh.skeleton);
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      materials.add(material);
      for (const value of Object.values(material)) if ((value as THREE.Texture | null)?.isTexture) textures.add(value as THREE.Texture);
    }
  });
  geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
  textures.forEach(t => t.dispose()); skeletons.forEach(s => s.dispose());
  root.removeFromParent();
}

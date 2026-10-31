import * as THREE from 'three';
import data from './cinematicTricornData.json';

/** Stage-only reuse of the project's authored optional tricorn. No gameplay equip. */
export function attachCinematicTricorn(root: THREE.Object3D): () => void {
  let source: THREE.SkinnedMesh | undefined;
  root.traverse(object => {
    const candidate = object as THREE.SkinnedMesh;
    if (!source && candidate.isSkinnedMesh && candidate.skeleton.bones.some(b => b.name === 'Head')) source = candidate;
  });
  if (!source) return () => {};
  const skin = source as THREE.SkinnedMesh;
  const head = skin.skeleton.bones.findIndex(b => b.name === 'Head');
  const geometry = new THREE.BufferGeometry();
  const seatedPositions=data.positions.map((value,index)=>index%3===1?value-.035:value);
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(seatedPositions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(data.normals, 3));
  geometry.setIndex(data.indices);
  const count = data.positions.length / 3;
  const joints = new Uint16Array(count * 4), weights = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) { joints[i * 4] = head; weights[i * 4] = 1; }
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(joints, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
  for (const group of data.groups) geometry.addGroup(group.start, group.count, group.materialIndex);
  const materials = data.materials.map(spec => new THREE.MeshStandardMaterial({
    name: 'Cinematic tricorn ' + spec.name,
    color: new THREE.Color().fromArray(spec.color),
    roughness: spec.roughness, metalness: spec.metalness, side: THREE.DoubleSide,
  }));
  const hat = new THREE.SkinnedMesh(geometry, materials);
  hat.name = 'Blackbeard cinematic-only optimized tricorn';
  hat.userData.cinematicOnly = true;
  hat.userData.sourceAsset = data.source;
  hat.frustumCulled = false;
  // The stage version seats the brim35mm lower into the hair mass after the
  // frontal and side camera fit review. The authored asset stays unchanged.
  // Authored character-rest-world Y-up coordinates. Preserve the existing skin
  // bind, rather than moving geometry to the head or applying a posed transform.
  hat.bind(skin.skeleton, skin.bindMatrix);
  hat.position.copy(skin.position); hat.quaternion.copy(skin.quaternion); hat.scale.copy(skin.scale);
  (skin.parent ?? root).add(hat);
  let disposed = false;
  return () => {
    if (disposed) return; disposed = true;
    hat.removeFromParent(); geometry.dispose(); materials.forEach(material => material.dispose());
    // The borrowed clone skeleton belongs to UltimateStage, never this helper.
  };
}

// World loads only its equipped AR; the full collection remains in Arena's on-demand gallery.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import registry from '../../assets/weapons/registry.json';
import type { CharacterRig } from './character';
const def = registry.find((a) => a.combat === 'lumen')!;
const url = new URL('../../assets/weapons/glb/01_Dawn_AR.glb', import.meta.url).href;
const point = (p: number[]) => new THREE.Vector3(p[2], p[1], -p[0]).multiplyScalar(def.scale).add(new THREE.Vector3().fromArray(def.offset));
function dispose(root: THREE.Object3D) {
  const gs = new Set<THREE.BufferGeometry>(), ms = new Set<THREE.Material>();
  root.traverse((o) => { const m = o as THREE.Mesh; if (!m.isMesh) return; gs.add(m.geometry); for (const mat of Array.isArray(m.material) ? m.material : [m.material]) ms.add(mat); });
  gs.forEach((g) => g.dispose()); ms.forEach((m) => m.dispose());
}
export function attachExplorerRifle(rig: CharacterRig, renderer?: THREE.WebGLRenderer, load: (url: string) => Promise<{ scene: THREE.Group }> = (url) => new GLTFLoader().loadAsync(url)) {
  let stopped = false, loaded: THREE.Group | null = null;
  let environment: THREE.WebGLRenderTarget | null = null;
  const gun = rig.joints.Gun, fallback = gun.getObjectByName('Rifle') as THREE.Mesh;
  // Keep projectile/muzzle flashes on the actual barrel after the authored art is fitted to both hands.
  const muzzle = new THREE.Vector3(0, 0.005, -0.455).multiplyScalar(1.1);
  gun.userData.artState = 'loading';
  const ready = load(url).then((gltf) => {
    if (stopped) { dispose(gltf.scene); return; }
    loaded = gltf.scene;
    if (!loaded.getObjectByName(`${def.file}_ROOT`)) throw new Error('Dawn AR root missing');
    const mount = new THREE.Group(); mount.name = 'Art_dawn';
    mount.rotation.y = Math.PI / 2; mount.scale.setScalar(def.scale); mount.position.fromArray(def.offset); mount.add(loaded);
    const visual = new THREE.Group(); visual.add(mount);
    const grip = point(def.grip!), support = point(def.support!), { right, left } = rig.gunHands;
    const scale = right.distanceTo(left) / grip.distanceTo(support);
    visual.scale.setScalar(scale);
    muzzle.copy(point(def.muzzle!)).multiplyScalar(scale);
    rig.gunAnchors.grip.copy(grip).multiplyScalar(scale); rig.gunAnchors.support.copy(support).multiplyScalar(scale);
    const z = right.clone().sub(left).normalize();
    const x = new THREE.Vector3(0, 1, 0).cross(z).normalize(), y = z.clone().cross(x);
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    q.multiply(new THREE.Quaternion().setFromUnitVectors(support.clone().sub(grip).normalize(), new THREE.Vector3(0, 0, -1)));
    rig.gunHold.q.copy(q); rig.gunHold.p.copy(right).sub(grip.multiplyScalar(scale).applyQuaternion(q));
    gun.add(visual);
    if (renderer) {
      const room = new RoomEnvironment(), pmrem = new THREE.PMREMGenerator(renderer);
      environment = pmrem.fromScene(room); room.dispose(); pmrem.dispose();
      loaded.traverse((o) => {
        const m = o as THREE.Mesh; if (!m.isMesh) return;
        for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
          const pbr = mat as THREE.MeshStandardMaterial;
          if (pbr.isMeshStandardMaterial) pbr.envMap = environment!.texture;
        }
      });
    }
    loaded.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    gun.remove(fallback);
    // Fallback body material belongs to the whole character; only its own geometry/outline material go.
    fallback.geometry.dispose();
    fallback.children.forEach((o) => { const m = o as THREE.Mesh; if (m.isMesh) for (const mat of Array.isArray(m.material) ? m.material : [m.material]) mat.dispose(); });
    gun.userData.artState = 'ready';
  }).catch((error: unknown) => {
    environment?.dispose(); environment = null;
    if (loaded) { dispose(loaded); loaded = null; }
    if (!stopped) { gun.userData.artState = 'fallback'; console.warn('World rifle art unavailable; original rifle retained.', error); }
  });
  return { ready,
    muzzleWorld(out = new THREE.Vector3()) { gun.updateWorldMatrix(true, false); return gun.localToWorld(out.copy(muzzle)); },
    dispose() { if (stopped) return; stopped = true; environment?.dispose(); if (loaded) { loaded.removeFromParent(); dispose(loaded); loaded = null; } } };
}

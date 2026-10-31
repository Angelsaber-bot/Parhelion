import * as THREE from 'three';
import { weaponFinish, type WeaponFinishId } from './weaponFinishes';

/** Only the accepted PH material family is recolored. Textures, transparency, PBR
 * strengths, transforms, buffers and sockets remain byte-for-byte unchanged.
 * Per-controller clones prevent a preview/source/shared material from being recolored.
 */
export function createWeaponFinishMaterials(root: THREE.Object3D) {
  const entries: { mesh: THREE.Mesh; original: THREE.Material | THREE.Material[] }[] = [];
  const copies = new Map<THREE.Material, THREE.Material>();
  const colored: { material: THREE.MeshStandardMaterial; base: THREE.Color; channel: 'ivory' | 'dark' | 'copper' | 'glow' | 'amber' }[] = [];
  let disposed = false, current: WeaponFinishId = 'original';
  root.traverse(o => {
    if (!(o instanceof THREE.Mesh)) return;
    entries.push({ mesh: o, original: o.material });
    const clone = (source: THREE.Material) => {
      let material = copies.get(source); if (material) return material;
      material = source.clone(); copies.set(source, material);
      if (material instanceof THREE.MeshStandardMaterial) {
        const channel = /^PH_(ivory|dark|copper|glow|amber)(?:\.\d+)?$/.exec(material.name)?.[1] as typeof colored[number]['channel'] | undefined;
        if (channel) colored.push({ material, base: material.color.clone(), channel });
      }
      return material;
    };
    o.material = Array.isArray(o.material) ? o.material.map(clone) : clone(o.material);
  });
  return {
    get finish() { return current; },
    get materialCount() { return copies.size; },
    apply(value: unknown) {
      if (disposed) return false;
      const finish = weaponFinish(value); if (!finish) return false;
      for (const entry of colored) {
        if (finish.colors) entry.material.color.set(finish.colors[entry.channel]);
        else entry.material.color.copy(entry.base);
      }
      current = finish.id; return true;
    },
    dispose() {
      if (disposed) return; disposed = true;
      // Restore ownership before the host disposes its original GLTF materials.
      for (const entry of entries) entry.mesh.material = entry.original;
      for (const material of copies.values()) material.dispose();
      entries.length = 0; copies.clear(); colored.length = 0;
    },
  };
}

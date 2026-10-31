import * as THREE from 'three';
import { makeWeaponFinishPattern } from './weaponFinishPatterns';
import { weaponFinish, type WeaponFinishId } from './weaponFinishes';

// GLTF loaders/embedding hosts may use a distinct Three constructor. Brand flags
// avoid a silent 'selected but no materials changed' cosmetic fallback.
const isMaterial = (value: unknown): value is THREE.Material => !!value && typeof value === 'object'
  && (value as THREE.Material).isMaterial === true && typeof (value as THREE.Material).clone === 'function' && typeof (value as THREE.Material).dispose === 'function';
const isMesh = (value: THREE.Object3D): value is THREE.Mesh => {
  const mesh = value as THREE.Mesh;
  return mesh.isMesh === true && mesh.geometry?.isBufferGeometry === true
    && (Array.isArray(mesh.material) ? mesh.material.length > 0 && mesh.material.every(isMaterial) : isMaterial(mesh.material));
};
const isStandard = (value: THREE.Material): value is THREE.MeshStandardMaterial => {
  const material = value as THREE.MeshStandardMaterial, color = material.color;
  return isMaterial(material) && material.isMeshStandardMaterial === true && color?.isColor === true
    && typeof color.clone === 'function' && typeof color.copy === 'function' && typeof color.set === 'function'
    && (material.map === null || material.map?.isTexture === true);
};

/** Only the accepted PH material family is recolored. Existing source textures,
 * transparency, PBR strengths, transforms, buffers and sockets are unchanged.
 * Unlocked finishes add bounded private albedo patterns to untextured ivory/dark panels only.
 * Per-controller clones prevent a preview/source/shared material from being recolored.
 */
export function createWeaponFinishMaterials(root: THREE.Object3D, options: { patterns?: boolean } = {}) {
  const entries: { mesh: THREE.Mesh; original: THREE.Material | THREE.Material[] }[] = [];
  const copies = new Map<THREE.Material, THREE.Material>();
  const colored: { material: THREE.MeshStandardMaterial; base: THREE.Color; map: THREE.Texture | null; channel: 'ivory' | 'dark' | 'copper' | 'glow' | 'amber' }[] = [];
  const patterns = new Map<string, THREE.DataTexture>();
  let disposed = false, current: WeaponFinishId = 'original';
  root.traverse(o => {
    if (!(isMesh(o))) return;
    entries.push({ mesh: o, original: o.material });
    const clone = (source: THREE.Material) => {
      let material = copies.get(source); if (material) return material;
      material = source.clone(); copies.set(source, material);
      if (isStandard(material)) {
        const channel = /^PH_(ivory|dark|copper|glow|amber)(?:\.\d+)?$/.exec(material.name)?.[1] as typeof colored[number]['channel'] | undefined;
        if (channel) colored.push({ material, base: material.color.clone(), map: material.map, channel });
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
        let map = entry.map;
        if (finish.colors) entry.material.color.set(finish.colors[entry.channel]);
        else entry.material.color.copy(entry.base);
        if (options.patterns !== false && finish.colors && !entry.map && (entry.channel === 'ivory' || entry.channel === 'dark')) {
          const key=`${finish.id}:${entry.channel}`;
          let pattern=patterns.get(key);
          if (!pattern) { pattern=makeWeaponFinishPattern(finish.id,entry.channel);patterns.set(key,pattern); }
          map=pattern;entry.material.color.set('#ffffff'); // palette lives in the sRGB albedo
        }
        if (entry.material.map !== map) { const shaderChange = !!entry.material.map !== !!map; entry.material.map = map; if (shaderChange) entry.material.needsUpdate = true; }
      }
      current = finish.id; return true;
    },
    dispose() {
      if (disposed) return; disposed = true;
      // Restore ownership before the host disposes its original GLTF materials.
      for (const entry of entries) entry.mesh.material = entry.original;
      for (const material of copies.values()) material.dispose();
      for (const texture of patterns.values()) texture.dispose(); patterns.clear();
      entries.length = 0; copies.clear(); colored.length = 0;
    },
  };
}

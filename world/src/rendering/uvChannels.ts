import * as THREE from 'three';

/**
 * three.js reads texture coordinates from `uv` to `uv3` only. A model whose texture points at a fifth set
 * (one servant's normal map asks for TEXCOORD_4) fails to compile: "'uv4' : undeclared identifier", and the
 * whole material draws nothing. Such textures fall back to the first UV set, which these models share anyway.
 */
export const MAX_UV_CHANNEL = 3;
const SLOTS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'alphaMap', 'bumpMap', 'displacementMap',
  'lightMap', 'specularMap', 'clearcoatMap', 'clearcoatNormalMap', 'clearcoatRoughnessMap', 'sheenColorMap', 'sheenRoughnessMap',
  'transmissionMap', 'thicknessMap', 'iridescenceMap', 'iridescenceThicknessMap', 'specularColorMap', 'specularIntensityMap', 'anisotropyMap'] as const;

/** Returns how many texture slots were moved back to channel 0. */
export function clampUvChannels(root: THREE.Object3D): number {
  let moved = 0;
  const seen = new Set<THREE.Material>();
  root.traverse(node => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if (!material || seen.has(material)) continue; seen.add(material);
      for (const slot of SLOTS) {
        const texture = (material as unknown as Record<string, THREE.Texture | null | undefined>)[slot];
        if (texture?.isTexture && texture.channel > MAX_UV_CHANNEL) {
          const copy = texture.clone(); copy.channel = 0;
          (material as unknown as Record<string, THREE.Texture>)[slot] = copy; material.needsUpdate = true; moved++;
        }
      }
    }
  });
  return moved;
}

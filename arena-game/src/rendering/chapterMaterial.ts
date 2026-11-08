import * as THREE from 'three';

/** Only the three new authored chapters use this channel-preserving material path.
 * ASTER/SAKURA/legacy maps retain toCel unchanged. Embedded surfaces are the same
 * baseColor / ORM / tangent normal maps inspected in exported-GLB previews.
 */
export const CRAFTED_CHAPTERS = new Set(['camlann', 'blackflag', 'frostcourt']);

export function toChapterMaterial(source: THREE.Material): THREE.Material {
  if (!(source as THREE.MeshStandardMaterial).isMeshStandardMaterial) return source;
  const material = (source as THREE.MeshStandardMaterial).clone();
  // Keep the actual authored roughness/metal/normal/AO response. A quiet environment
  // reflection supports brass/ice edges without making broad stone or snow glossy.
  material.envMapIntensity = .42;
  material.userData.chapterSurface = true;
  material.onBeforeCompile = (shader) => {
    // A restrained anime shadow hue/rim, after standard PBR evaluation. No procedural
    // UV overrides, dynamic lights, hard posterization or material-channel deletion.
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
      {
        float chapterLight = dot(outgoingLight, vec3(0.2126, 0.7152, 0.0722));
        float chapterShade = 1.0 - smoothstep(0.12, 0.6, chapterLight);
        outgoingLight *= mix(vec3(1.015, 1.0, 0.975), vec3(0.91, 0.95, 1.065), chapterShade * 0.55);
        float chapterRim = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 4.0);
        outgoingLight += diffuseColor.rgb * chapterRim * 0.035;
      }
      #include <opaque_fragment>`);
  };
  material.customProgramCacheKey = () => 'parhelion-crafted-chapter-pbr-v1';
  source.dispose();
  return material;
}

/**
 * Character rim light, shared by World and Arena (no `three` import: each game owns its copy).
 *
 * A soft fresnel edge on lit character materials keeps heroes readable against busy or dark
 * backgrounds and gives the anime look a light outline. It is applied when a character model loads,
 * before its shaders are compiled, so nothing recompiles mid-game.
 */
export const RIM_STRENGTH = .32;
/** One shared uniform set: every rim-lit material reads the same colour and strength. */
export const RIM_UNIFORMS = { rimColor: { value: [1, .95, .86] }, rimStrength: { value: RIM_STRENGTH }, rimPower: { value: 4.2 } };

type ShaderLike = { uniforms: Record<string, { value: unknown }>; fragmentShader: string };
type MaterialLike = {
  type: string; userData: Record<string, unknown>; needsUpdate: boolean;
  onBeforeCompile: (shader: ShaderLike, renderer: never) => void; customProgramCacheKey: () => string;
};
const LIT = new Set(['MeshStandardMaterial', 'MeshPhysicalMaterial', 'MeshToonMaterial', 'MeshLambertMaterial', 'MeshPhongMaterial']);
const RIM_CHUNK = `#include <emissivemap_fragment>
      {
        float rimFacing = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
        totalEmissiveRadiance += rimColor * (pow(1.0 - rimFacing, rimPower) * rimStrength);
      }`;

/** Adds the rim to one lit material (chaining any existing onBeforeCompile and cache key).
 * Returns false for materials it leaves alone: unlit ones, and ones that already have it. */
export function applyRimLight(material: MaterialLike): boolean {
  if (!LIT.has(material.type) || material.userData.rimLight) return false;
  material.userData.rimLight = true;
  const previous = material.onBeforeCompile, key = material.customProgramCacheKey();
  material.onBeforeCompile = function (shader, renderer) {
    previous.call(this, shader, renderer);
    Object.assign(shader.uniforms, RIM_UNIFORMS);
    shader.fragmentShader = 'uniform vec3 rimColor;\nuniform float rimStrength, rimPower;\n' + shader.fragmentShader.replace('#include <emissivemap_fragment>', RIM_CHUNK);
  };
  material.customProgramCacheKey = () => `${key}|rim`;
  material.needsUpdate = true;
  return true;
}

type NodeLike = { traverse(visit: (node: unknown) => void): void };
/** Rim-lights every lit material on the meshes under `root`; returns how many materials changed. */
export function rimLightCharacter(root: NodeLike): number {
  let changed = 0;
  root.traverse(node => {
    const mesh = node as { isMesh?: boolean; material?: MaterialLike | MaterialLike[] };
    if (!mesh.isMesh || !mesh.material) return;
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) if (applyRimLight(material)) changed++;
  });
  return changed;
}

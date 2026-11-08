import * as THREE from 'three';
import { winterMaterialProfile } from './winterMaterialProfiles.js';

// Sparse painted variation only. No noise textures, UVs, loops, or extra draw calls.
const SURFACE_GLSL = /* glsl */ `
  varying vec3 vWinterWorld;
  varying vec3 vWinterNormal;
  float winterBrush(vec3 p) {
    return sin(p.x * 0.67 + sin(p.z * 0.37)) * sin(p.y * 0.53 + p.z * 0.29);
  }
  float winterLine(float phase) {
    float footprint = fwidth(phase);
    return sin(phase) * (1.0 - smoothstep(0.55, 2.5, footprint));
  }
`;

/**
 * Translate exported PBR identities into restrained anime surface cues. Geometry/vertex colors
 * remain the artist's source of silhouette and palette; this is not a substitute for snow caps.
 * Frost, water and ice intentionally remain on their existing paths (no broad name matching).
 */
export function winterToonMaterial(src: THREE.Material, gradientMap: THREE.Texture): THREE.MeshToonMaterial | null {
  const p = winterMaterialProfile(src.name);
  if (!p) return null;
  const s = src as THREE.MeshStandardMaterial;
  const m = new THREE.MeshToonMaterial({
    name: src.name, vertexColors: s.vertexColors, color: s.color,
    gradientMap, side: s.side, transparent: s.transparent, opacity: s.opacity,
    alphaTest: s.alphaTest, depthWrite: s.depthWrite, depthTest: s.depthTest,
  });
  m.userData = { ...src.userData, winterSurface: src.name, roughness: p.roughness, metalness: p.metalness };
  let surface: string;
  switch (src.name) {
    case 'M_WinterSnow':
      surface = `
        // Blue-grey undersides against a softly warm upper snow plane, not emissive white.
        diffuseColor.rgb *= mix(vec3(0.86, 0.92, 1.0), vec3(1.0, 0.99, 0.96), max(wn.y, 0.0));
        diffuseColor.rgb *= 1.0 + ${p.grain} * brush;
      `;
      break;
    case 'M_WinterTimber':
    case 'M_WinterCharredWood':
      surface = `
        float axis = mix(vWinterWorld.x + vWinterWorld.z, vWinterWorld.z, abs(wn.y));
        float grain = winterLine(axis * 29.0 + sin(vWinterWorld.y * 1.7 + axis * 0.6) * 1.5);
        diffuseColor.rgb *= 1.0 + ${p.grain} * grain + 0.018 * brush;
      `;
      break;
    case 'M_WinterCanvas':
      surface = `
        float weave = winterLine((vWinterWorld.x + vWinterWorld.z) * 76.0) * winterLine(vWinterWorld.y * 76.0);
        diffuseColor.rgb *= 1.0 + ${p.grain} * weave + 0.015 * brush;
      `;
      break;
    case 'M_WinterCopper':
      surface = `
        // Patina is authored in vertex color; broad cool mottling does not turn it into gold.
        diffuseColor.rgb *= 1.0 + ${p.grain} * brush;
        diffuseColor.rgb *= mix(vec3(0.94, 1.01, 1.025), vec3(1.025, 1.01, 0.97), max(wn.y, 0.0));
      `;
      break;
    case 'M_WinterStone':
    case 'M_WinterBrick':
      surface = `
        diffuseColor.rgb *= 1.0 + ${p.grain} * brush;
        diffuseColor.rgb *= mix(vec3(0.96, 0.98, 1.025), vec3(1.025, 1.005, 0.98), max(wn.y, 0.0));
      `;
      break;
    default:
      surface = `diffuseColor.rgb *= 1.0 + ${p.grain} * brush;`;
  }
  const highlight = src.name === 'M_WinterGold' ? `
    // Small, banded gilding glint; no white plastic specular or glowing yellow cupolas.
    vec3 halfDir = normalize(normalize(vViewPosition) + normalize((viewMatrix * vec4(-0.45, 0.62, 0.64, 0.0)).xyz));
    float spec = pow(max(dot(normal, halfDir), 0.0), 28.0);
    float glint = smoothstep(0.36, 0.58, spec) * lit;
    outgoingLight += vec3(0.24, 0.16, 0.055) * glint;
  ` : '';
  const snowShoulder = src.name === 'M_WinterSnow' ? `
    // Soft HDR shoulder keeps bright snow facets legible without a hard white clipping plane.
    vec3 excess = max(outgoingLight - vec3(0.78), vec3(0.0));
    outgoingLight = min(outgoingLight, vec3(0.78)) + excess * 0.22 / (vec3(0.22) + excess);
  ` : '';
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWinterWorld;\nvarying vec3 vWinterNormal;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        vWinterWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vWinterNormal = normalize(mat3(modelMatrix) * objectNormal);
      `);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${SURFACE_GLSL}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec3 wn = normalize(vWinterNormal);
          float brush = winterBrush(vWinterWorld * 0.65);
          ${surface}
        }
      `)
      .replace('#include <opaque_fragment>', `
        {
          vec3 base = diffuseColor.rgb + vec3(0.0001);
          float shade = clamp(dot(outgoingLight / base, vec3(0.333333)), 0.0, 2.0);
          float lit = smoothstep(0.62, 0.95, shade);
          outgoingLight = mix(outgoingLight * vec3(0.84, 0.9, 1.055) + base * vec3(0.012, 0.016, 0.028), outgoingLight * vec3(1.02, 1.0, 0.975), lit);
          float rim = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 4.0);
          outgoingLight += base * vec3(0.91, 0.96, 1.0) * rim * ${p.rim} * (0.35 + 0.65 * lit);
          ${highlight}
          ${snowShoulder}
        }
        #include <opaque_fragment>
      `);
  };
  m.customProgramCacheKey = () => `winter-surface-v1-${src.name}`;
  return m;
}

import * as THREE from 'three';
import { kyotoMaterialProfile } from './kyotoMaterialProfiles.js';

// Broad brush variation, not photographic fractal noise. Fine line work fades under minification.
const SURFACE_GLSL = /* glsl */ `
  varying vec3 vKyotoWorld;
  varying vec3 vKyotoNormal;
  float kyotoBrush(vec3 p) {
    return sin(p.x * 0.73 + sin(p.z * 0.39)) * sin(p.y * 0.61 + p.z * 0.31);
  }
  float kyotoLine(float phase) {
    float footprint = fwidth(phase);
    return sin(phase) * (1.0 - smoothstep(0.55, 2.5, footprint));
  }
`;

/**
 * Keep the game's banded anime lighting, but distinguish actual Kyoto surfaces.
 * GLB stores PBR fallbacks; runtime intentionally translates them into restrained drawn highlights.
 * No canvas textures/UV dependency: Batch bakes world-space geometry and strips source UVs.
 */
export function kyotoToonMaterial(src: THREE.Material, gradientMap: THREE.Texture): THREE.MeshToonMaterial | null {
  const p = kyotoMaterialProfile(src.name);
  if (!p) return null;
  const s = src as THREE.MeshStandardMaterial;
  const m = new THREE.MeshToonMaterial({
    name: src.name, vertexColors: s.vertexColors, color: s.color,
    gradientMap, side: s.side, transparent: s.transparent, opacity: s.opacity,
    alphaTest: s.alphaTest, depthWrite: s.depthWrite, depthTest: s.depthTest,
  });
  m.userData = { ...src.userData, kyotoSurface: src.name, roughness: p.roughness, metalness: p.metalness };
  let surface: string;
  switch (src.name) {
    case 'M_KyotoTimber':
    case 'M_KyotoCharredWood':
      surface = `
        // Vertical grain on posts; horizontal grain on upward-facing deck/beam planes.
        float axis = mix(vKyotoWorld.x + vKyotoWorld.z, vKyotoWorld.z, abs(wn.y));
        float grain = kyotoLine(axis * 33.0 + sin(vKyotoWorld.y * 1.9 + axis * 0.6) * 1.6);
        diffuseColor.rgb *= 1.0 + ${p.grain} * grain + 0.022 * brush;
      `;
      break;
    case 'M_KyotoBamboo':
      surface = `
        float grain = kyotoLine((vKyotoWorld.x + vKyotoWorld.z) * 45.0 + sin(vKyotoWorld.y * 0.75));
        diffuseColor.rgb *= 1.0 + ${p.grain} * grain + 0.025 * brush;
        diffuseColor.rgb *= mix(vec3(0.98, 1.01, 0.96), vec3(1.03, 1.01, 0.92), max(wn.y, 0.0));
      `;
      break;
    case 'M_KyotoRoof':
      surface = `
        diffuseColor.rgb *= 1.0 + ${p.grain} * brush;
        // Cool ceramic facets, without painting fake tile grids across roof slopes.
        diffuseColor.rgb *= mix(vec3(0.95, 0.98, 1.05), vec3(1.02, 1.02, 1.03), max(wn.y, 0.0));
      `;
      break;
    case 'M_KyotoStone':
      surface = `
        diffuseColor.rgb *= 1.0 + ${p.grain} * brush;
        diffuseColor.rgb *= mix(vec3(0.94, 0.96, 1.02), vec3(1.03, 1.02, 0.98), max(wn.y, 0.0));
      `;
      break;
    case 'M_KyotoFabric':
      surface = `
        float weave = kyotoLine((vKyotoWorld.x + vKyotoWorld.z) * 92.0) * kyotoLine(vKyotoWorld.y * 92.0);
        diffuseColor.rgb *= 1.0 + ${p.grain} * weave + 0.018 * brush;
      `;
      break;
    case 'M_KyotoGold':
      surface = `diffuseColor.rgb *= 1.0 + ${p.grain} * brush;`;
      break;
    default:
      surface = `diffuseColor.rgb *= 1.0 + ${p.grain} * brush;`;
  }
  const highlight = src.name === 'M_KyotoGold' ? `
    // A small banded leaf-gold glint; no luminous yellow plastic or white metallic wash.
    vec3 halfDir = normalize(normalize(vViewPosition) + normalize((viewMatrix * vec4(-0.45, 0.62, 0.64, 0.0)).xyz));
    float spec = pow(max(dot(normal, halfDir), 0.0), 32.0);
    float glint = smoothstep(0.34, 0.56, spec) * lit;
    outgoingLight += vec3(0.30, 0.20, 0.065) * glint;
  ` : '';
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vKyotoWorld;\nvarying vec3 vKyotoNormal;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        vKyotoWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vKyotoNormal = normalize(mat3(modelMatrix) * objectNormal);
      `);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${SURFACE_GLSL}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec3 wn = normalize(vKyotoNormal);
          float brush = kyotoBrush(vKyotoWorld * 0.65);
          ${surface}
        }
      `)
      .replace('#include <opaque_fragment>', `
        {
          vec3 base = diffuseColor.rgb + vec3(0.0001);
          float shade = clamp(dot(outgoingLight / base, vec3(0.333333)), 0.0, 2.0);
          float lit = smoothstep(0.62, 0.95, shade);
          outgoingLight = mix(outgoingLight * vec3(0.83, 0.87, 1.07) + base * vec3(0.018, 0.015, 0.035), outgoingLight * vec3(1.025, 1.0, 0.97), lit);
          float rim = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 4.0);
          outgoingLight += base * vec3(1.0, 0.97, 0.88) * rim * ${p.rim} * (0.4 + 0.6 * lit);
          ${highlight}
        }
        #include <opaque_fragment>
      `);
  };
  m.customProgramCacheKey = () => `kyoto-surface-v1-${src.name}`;
  return m;
}

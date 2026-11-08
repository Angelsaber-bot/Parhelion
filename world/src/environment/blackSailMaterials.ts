import * as THREE from 'three';
import { blackSailMaterialProfile } from './blackSailMaterialProfiles.js';

// Bounded painted brushwork, derivative-filtered at distance; no textures or extra draw calls.
const SURFACE_GLSL = /* glsl */ `
  varying vec3 vBlackSailWorld;
  varying vec3 vBlackSailNormal;
  float blackSailBrush(vec3 p) {
    return sin(p.x * 0.61 + sin(p.z * 0.39)) * sin(p.y * 0.47 + p.z * 0.31);
  }
  float blackSailLine(float phase) {
    float footprint = fwidth(phase);
    return sin(phase) * (1.0 - smoothstep(0.55, 2.5, footprint));
  }
`;

/** Ordinary marine materials remain opaque and lit; ghost emission stays on story objects. */
export function blackSailToonMaterial(src: THREE.Material, gradientMap: THREE.Texture): THREE.MeshToonMaterial | null {
  const p = blackSailMaterialProfile(src.name);
  if (!p) return null;
  const s = src as THREE.MeshStandardMaterial;
  const m = new THREE.MeshToonMaterial({
    name: src.name, vertexColors: s.vertexColors, color: s.color,
    gradientMap, side: s.side, transparent: s.transparent, opacity: s.opacity,
    alphaTest: s.alphaTest, depthWrite: s.depthWrite, depthTest: s.depthTest,
    fog: s.fog,
  });
  m.userData = { ...src.userData, blackSailSurface: src.name, roughness: p.roughness, metalness: p.metalness };
  let surface: string;
  switch (src.name) {
    case 'M_BlackSailTimber':
    case 'M_BlackSailShingle':
      surface = `
        float axis = mix(vBlackSailWorld.x + vBlackSailWorld.z, vBlackSailWorld.z, abs(wn.y));
        float grain = blackSailLine(axis * 25.0 + sin(vBlackSailWorld.y * 1.3 + axis * 0.7) * 1.4);
        // Weathered pale ridges, never a glossy plastic hull.
        diffuseColor.rgb *= 1.0 + ${p.grain} * grain + 0.014 * brush;
      `;
      break;
    case 'M_BlackSailCanvas':
      surface = `
        float weave = blackSailLine((vBlackSailWorld.x + vBlackSailWorld.z) * 68.0) * blackSailLine(vBlackSailWorld.y * 68.0);
        diffuseColor.rgb *= 1.0 + ${p.grain} * weave + 0.012 * brush;
      `;
      break;
    case 'M_BlackSailRope':
    case 'M_BlackSailThatch':
      surface = `
        float fiber = blackSailLine((vBlackSailWorld.x + vBlackSailWorld.z) * 39.0 + vBlackSailWorld.y * 17.0);
        diffuseColor.rgb *= 1.0 + ${p.grain} * fiber + 0.012 * brush;
      `;
      break;
    case 'M_BlackSailStone':
      surface = `
        // Coral/limestone pores are broad painted values; salt/barnacles remain authored colors.
        diffuseColor.rgb *= 1.0 + ${p.grain} * brush;
        diffuseColor.rgb *= mix(vec3(0.96, 0.99, 1.018), vec3(1.02, 1.005, 0.98), max(wn.y, 0.0));
      `;
      break;
    default:
      surface = `diffuseColor.rgb *= 1.0 + ${p.grain} * brush;`;
  }
  const highlight = src.name === 'M_BlackSailBrass' ? `
    // Restrained warm band, gated by received lighting so shaded fittings do not glow.
    vec3 halfDir = normalize(normalize(vViewPosition) + normalize((viewMatrix * vec4(-0.45, 0.62, 0.64, 0.0)).xyz));
    float spec = pow(max(dot(normal, halfDir), 0.0), 24.0);
    float glint = smoothstep(0.38, 0.6, spec) * lit;
    outgoingLight += vec3(0.16, 0.105, 0.038) * glint;
  ` : '';
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vBlackSailWorld;\nvarying vec3 vBlackSailNormal;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        vBlackSailWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vBlackSailNormal = normalize(mat3(modelMatrix) * objectNormal);
      `);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${SURFACE_GLSL}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec3 wn = normalize(vBlackSailNormal);
          float brush = blackSailBrush(vBlackSailWorld * 0.65);
          ${surface}
        }
      `)
      .replace('#include <opaque_fragment>', `
        {
          vec3 base = diffuseColor.rgb + vec3(0.0001);
          float shade = clamp(dot(outgoingLight / base, vec3(0.333333)), 0.0, 2.0);
          float lit = smoothstep(0.62, 0.95, shade);
          outgoingLight = mix(outgoingLight * vec3(0.86, 0.94, 1.045) + base * vec3(0.009, 0.016, 0.023), outgoingLight * vec3(1.025, 1.005, 0.975), lit);
          float rim = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 4.0);
          outgoingLight += base * vec3(0.95, 0.99, 1.0) * rim * ${p.rim} * (0.35 + 0.65 * lit);
          ${highlight}
        }
        #include <opaque_fragment>
      `);
  };
  m.customProgramCacheKey = () => `blacksail-surface-v1-${src.name}`;
  return m;
}

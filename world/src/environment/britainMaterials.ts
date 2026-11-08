import * as THREE from 'three';
import { britainMaterialProfile } from './britainMaterialProfiles.js';

const SURFACE_GLSL = /* glsl */ `
  varying vec3 vBritainWorld;
  varying vec3 vBritainNormal;
  float britainBrush(vec3 p) {
    return sin(p.x * 0.43 + sin(p.y * 0.59)) * sin(p.z * 0.57 + p.y * 0.36);
  }
  float britainLine(float phase) {
    float footprint = fwidth(phase);
    return sin(phase) * (1.0 - smoothstep(0.45, 2.2, footprint));
  }
`;

/** Dry carved stone, split oak and coarse wool, with restrained sunset-facing accents. */
export function britainToonMaterial(src: THREE.Material, gradientMap: THREE.Texture): THREE.MeshToonMaterial | null {
  const p = britainMaterialProfile(src.name);
  if (!p) return null;
  const s = src as THREE.MeshStandardMaterial;
  const m = new THREE.MeshToonMaterial({ name: src.name, vertexColors: s.vertexColors,
    color: s.color, gradientMap, side: s.side, transparent: s.transparent, opacity: s.opacity,
    alphaTest: s.alphaTest, depthWrite: s.depthWrite, depthTest: s.depthTest, fog: s.fog });
  m.userData = { ...src.userData, britainSurface: src.name, roughness: p.roughness, metalness: p.metalness };
  let surface: string;
  switch (src.name) {
    case 'M_BritainOak':
    case 'M_BritainCharredWood':
      surface = `
        float axis = mix(vBritainWorld.x + vBritainWorld.z, vBritainWorld.z, abs(wn.y));
        float grain = britainLine(axis * 21.0 + 1.3 * sin(vBritainWorld.y * 0.8 + axis * 0.5));
        diffuseColor.rgb *= 1.0 + ${p.grain} * grain + 0.012 * brush;
      `;
      break;
    case 'M_BritainWool':
      surface = `
        float weave = britainLine((vBritainWorld.x + vBritainWorld.z) * 47.0) * britainLine(vBritainWorld.y * 54.0);
        diffuseColor.rgb *= 1.0 + ${p.grain} * weave + 0.012 * brush;
      `;
      break;
    case 'M_BritainThatch':
      surface = `
        float fiber = britainLine((vBritainWorld.x + vBritainWorld.z) * 31.0 + vBritainWorld.y * 9.0);
        diffuseColor.rgb *= 1.0 + ${p.grain} * fiber + 0.018 * brush;
      `;
      break;
    case 'M_BritainLimestone':
    case 'M_BritainSandstone':
      surface = `
        // Broad mineral wash, not salt/barnacles or snowy height masks from other chapters.
        diffuseColor.rgb *= 1.0 + ${p.grain} * brush;
        diffuseColor.rgb *= mix(vec3(0.985, 0.995, 1.012), vec3(1.025, 1.005, 0.975), max(wn.y, 0.0));
      `;
      break;
    case 'M_BritainSlate':
      surface = `
        float cleavage = britainLine((vBritainWorld.x + vBritainWorld.z) * 8.0 + vBritainWorld.y * 2.0);
        diffuseColor.rgb *= 1.0 + ${p.grain} * cleavage + 0.012 * brush;
      `;
      break;
    default: surface = `diffuseColor.rgb *= 1.0 + ${p.grain} * brush;`;
  }
  const highlight = src.name === 'M_BritainBronze' ? `
    vec3 halfDir = normalize(normalize(vViewPosition) + normalize((viewMatrix * vec4(-0.45, 0.62, 0.64, 0.0)).xyz));
    float spec = pow(max(dot(normal, halfDir), 0.0), 20.0);
    float glint = smoothstep(0.42, 0.65, spec) * lit;
    outgoingLight += vec3(0.12, 0.076, 0.025) * glint;
  ` : '';
  m.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vBritainWorld;\nvarying vec3 vBritainNormal;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        vBritainWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vBritainNormal = normalize(mat3(modelMatrix) * objectNormal);
      `);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${SURFACE_GLSL}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        { vec3 wn = normalize(vBritainNormal); float brush = britainBrush(vBritainWorld * 0.75); ${surface} }
      `)
      .replace('#include <opaque_fragment>', `
        {
          vec3 base = diffuseColor.rgb + vec3(0.0001);
          float shade = clamp(dot(outgoingLight / base, vec3(0.333333)), 0.0, 2.0);
          float lit = smoothstep(0.62, 0.95, shade);
          // Muted violet shadow and warm cream light; relief stays legible without emissive stone.
          outgoingLight = mix(outgoingLight * vec3(0.93, 0.95, 1.035) + base * vec3(0.012, 0.01, 0.018), outgoingLight * vec3(1.025, 1.005, 0.98), lit);
          float rim = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 4.0);
          outgoingLight += base * vec3(1.0, 0.965, 0.91) * rim * ${p.rim} * (0.25 + 0.75 * lit);
          ${highlight}
        }
        #include <opaque_fragment>
      `);
  };
  m.customProgramCacheKey = () => `britain-surface-v1-${src.name}`;
  return m;
}

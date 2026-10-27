import * as THREE from 'three';
import { valleyMaterialProfile } from './valleyMaterialProfiles.js';

const SURFACE_GLSL = /* glsl */ `
  varying vec3 vValleyWorld;
  varying vec3 vValleyNormal;
  float valleyBrush(vec3 p) {
    return sin(p.x * 0.31 + p.z * 0.17) * sin(p.y * 0.41 + sin(p.z * 0.36));
  }
  float valleyLine(float phase) {
    float footprint = fwidth(phase);
    return sin(phase) * (1.0 - smoothstep(0.45, 2.2, footprint));
  }
`;

/** Clean research ceramics and satin alloy contrast with porous ancient valley stone. */
export function valleyToonMaterial(src: THREE.Material, gradientMap: THREE.Texture): THREE.MeshToonMaterial | null {
  const p = valleyMaterialProfile(src.name);
  if (!p) return null;
  const s = src as THREE.MeshStandardMaterial;
  const m = new THREE.MeshToonMaterial({ name: src.name, vertexColors: s.vertexColors,
    color: s.color, gradientMap, side: s.side, transparent: s.transparent, opacity: s.opacity,
    alphaTest: s.alphaTest, depthWrite: s.depthWrite, depthTest: s.depthTest, fog: s.fog });
  m.userData = { ...src.userData, valleySurface: src.name, roughness: p.roughness, metalness: p.metalness };
  let surface: string;
  switch (src.name) {
    case 'M_ValleyTimber':
      surface = `
        float grain = valleyLine((vValleyWorld.x + vValleyWorld.z) * 23.0 + sin(vValleyWorld.y * 1.2));
        diffuseColor.rgb *= 1.0 + ${p.grain} * grain + 0.008 * brush;
      `;
      break;
    case 'M_ValleyCanvas':
      surface = `
        float weave = valleyLine((vValleyWorld.x + vValleyWorld.z) * 67.0) * valleyLine(vValleyWorld.y * 71.0);
        diffuseColor.rgb *= 1.0 + ${p.grain} * weave + 0.008 * brush;
      `;
      break;
    case 'M_ValleyMetal':
      surface = `
        float brushing = valleyLine(vValleyWorld.y * 88.0 + vValleyWorld.x * 6.0);
        diffuseColor.rgb *= 1.0 + ${p.grain} * brushing;
      `;
      break;
    case 'M_ValleyStone':
      surface = `
        diffuseColor.rgb *= 1.0 + ${p.grain} * brush;
        diffuseColor.rgb *= mix(vec3(0.97, 0.99, 1.025), vec3(1.015, 1.012, 0.985), max(wn.y, 0.0));
      `;
      break;
    default: surface = `diffuseColor.rgb *= 1.0 + ${p.grain} * brush;`;
  }
  const polished = ['M_ValleyCeramic', 'M_ValleyMetal', 'M_ValleyGlass', 'M_ValleyBrass'].includes(src.name);
  const highlight = polished ? `
    vec3 halfDir = normalize(normalize(vViewPosition) + normalize((viewMatrix * vec4(-0.45, 0.62, 0.64, 0.0)).xyz));
    float spec = pow(max(dot(normal, halfDir), 0.0), ${src.name === 'M_ValleyGlass' ? '42.0' : '30.0'});
    float glint = smoothstep(0.38, 0.64, spec) * lit;
    outgoingLight += ${src.name === 'M_ValleyBrass' ? 'vec3(0.12, 0.09, 0.04)' : 'vec3(0.075, 0.09, 0.1)'} * glint;
  ` : '';
  m.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vValleyWorld;\nvarying vec3 vValleyNormal;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        vValleyWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vValleyNormal = normalize(mat3(modelMatrix) * objectNormal);
      `);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${SURFACE_GLSL}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        { vec3 wn = normalize(vValleyNormal); float brush = valleyBrush(vValleyWorld * 0.6); ${surface} }
      `)
      .replace('#include <opaque_fragment>', `
        {
          vec3 base = diffuseColor.rgb + vec3(0.0001);
          float shade = clamp(dot(outgoingLight / base, vec3(0.333333)), 0.0, 2.0);
          float lit = smoothstep(0.62, 0.95, shade);
          // Clean blue-grey shadow; white panels stay white rather than dirty/noisy.
          outgoingLight = mix(outgoingLight * vec3(0.94, 0.985, 1.025) + base * vec3(0.01, 0.016, 0.019), outgoingLight * vec3(1.015, 1.01, 0.995), lit);
          float rim = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 4.0);
          outgoingLight += base * vec3(0.94, 0.99, 1.0) * rim * ${p.rim} * (0.2 + 0.8 * lit);
          ${highlight}
        }
        #include <opaque_fragment>
      `);
  };
  m.customProgramCacheKey = () => `valley-surface-v1-${src.name}`;
  return m;
}

import * as THREE from 'three';
import { NOISE_GLSL, timeUniform } from './look';

/**
 * The time-layer gates between the valley and its neighbouring eras were flat 80 m rectangles of
 * uniform glow: seen from a distance they read as hard-edged translucent walls cutting the sky.
 * This is the same light redrawn as a curtain: strongest at the ground and gone well before the top,
 * with slow rising bands and vertical streaks, fading where a face turns edge-on and when the camera
 * stands inside it. Additive, never writes depth, visual only.
 */
export const SEAM_VEIL = Object.freeze({ opacity: .34, falloff: 2.4, near: 2, nearFull: 14, reach: 36, sunk: .12 });
/** Which art meshes are region gate veils. */
export const isSeamVeil = (name: string) => /^Seam_[a-z]+_Gate$/.test(name);

/** Glow share at height fraction `t` (0 ground, 1 top): mirrors the shader's vertical falloff. */
export function seamVeilRise(t: number) { return Math.pow(1 - Math.min(1, Math.max(0, t)), SEAM_VEIL.falloff); }

export function seamVeilMaterial(mesh: THREE.Mesh): THREE.ShaderMaterial {
  mesh.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(mesh);
  const material = new THREE.ShaderMaterial({
    name: 'M_SeamVeil', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    vertexColors: !!(mesh.geometry as THREE.BufferGeometry).attributes.color,
    // The authored boxes are 80 m tall and sunk about a tenth into the ground: the curtain starts near ground
    // level and has faded out within `reach` metres, well below the box's top.
    uniforms: { uTime: timeUniform, uBase: { value: box.min.y + (box.max.y - box.min.y) * SEAM_VEIL.sunk }, uHeight: { value: Math.max(1, Math.min(SEAM_VEIL.reach, box.max.y - box.min.y)) }, uOpacity: { value: SEAM_VEIL.opacity } },
    vertexShader: /* glsl */ `
      varying vec3 vWorld; varying vec3 vNormalW; varying vec3 vTint;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz; vNormalW = normalize(mat3(modelMatrix) * normal);
        #ifdef USE_COLOR
          vTint = color.rgb;
        #else
          vTint = vec3(0.75, 0.9, 1.0);
        #endif
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uBase, uHeight, uOpacity;
      varying vec3 vWorld; varying vec3 vNormalW; varying vec3 vTint;
      ${NOISE_GLSL}
      void main() {
        float t = clamp((vWorld.y - uBase) / uHeight, 0.0, 1.0);
        float rise = pow(1.0 - t, ${SEAM_VEIL.falloff.toFixed(1)});
        float along = vWorld.x + vWorld.z;
        // Slow bands climbing the curtain, bent by position so they never form a straight ruler line.
        float bands = 0.6 + 0.4 * sin(vWorld.y * 0.55 - uTime * 1.1 + sin(along * 0.31) * 2.2);
        float streak = 0.55 + 0.45 * vnoise(vec2(along * 0.55, vWorld.y * 0.07 - uTime * 0.22));
        vec3 toEye = cameraPosition - vWorld; float dist = length(toEye);
        // Faces seen edge-on vanish (no hard side edges); standing inside it does not white out the view.
        float facing = smoothstep(0.04, 0.5, abs(dot(normalize(vNormalW), toEye / max(dist, 1e-3))));
        float near = smoothstep(${SEAM_VEIL.near.toFixed(1)}, ${SEAM_VEIL.nearFull.toFixed(1)}, dist);
        float a = rise * bands * streak * facing * near * uOpacity;
        gl_FragColor = vec4(vTint * a, a);
      }`,
  });
  return material;
}

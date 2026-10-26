// Toon look: banded lighting, inverted-hull outlines, and a sky with a 22° halo + sundogs
// (the "parhelion" the game is named after).
import * as THREE from 'three';

export const SUN_DIR = new THREE.Vector3(-0.45, 0.62, 0.64).normalize(); // from the south-west, afternoon

let gradient: THREE.DataTexture | null = null;
function toonGradient() {
  if (gradient) return gradient;
  const steps = new Uint8Array([90, 170, 235, 255]);
  gradient = new THREE.DataTexture(steps, steps.length, 1, THREE.RedFormat);
  gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
  gradient.needsUpdate = true;
  return gradient;
}

export function toonMaterial(src: THREE.Material): THREE.Material {
  const name = src.name;
  const s = src as THREE.MeshStandardMaterial;
  switch (name) {
    case 'M_Water':
      return Object.assign(new THREE.MeshToonMaterial({
        color: '#4cc3e0', transparent: true, opacity: 0.78, gradientMap: toonGradient(), emissive: '#1b6f9a', emissiveIntensity: 0.25,
      }), { name });
    case 'M_Waterfall':
      return Object.assign(new THREE.MeshBasicMaterial({ color: '#dff8ff', transparent: true, opacity: 0.72, side: THREE.DoubleSide, depthWrite: false }), { name });
    case 'M_Emissive':
    case 'M_Target':
      return Object.assign(new THREE.MeshBasicMaterial({ vertexColors: true }), { name });
    case 'M_Halo':
      return Object.assign(new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(0.32, 0.32, 0.36) }), { name });
    default:
      return Object.assign(new THREE.MeshToonMaterial({ vertexColors: s.vertexColors, color: s.color, gradientMap: toonGradient() }), { name });
  }
}

const outlineMat = new THREE.MeshBasicMaterial({ color: '#2b2f45', side: THREE.BackSide });
outlineMat.onBeforeCompile = (sh) => {
  sh.vertexShader = sh.vertexShader.replace(
    '#include <begin_vertex>',
    `vec3 transformed = position + normalize(normal) * 0.045;`,
  );
};

/** Inverted-hull outline sharing the mesh's geometry. */
export function addOutline(mesh: THREE.Mesh) {
  const o = new THREE.Mesh(mesh.geometry, outlineMat);
  o.name = `${mesh.name}__outline`;
  o.raycast = () => {};
  mesh.add(o);
}

export function makeSky(): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      sunDir: { value: SUN_DIR },
      top: { value: new THREE.Color('#3f8fe6') },
      mid: { value: new THREE.Color('#8fcdf6') },
      horizon: { value: new THREE.Color('#e6f6ff') },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 sunDir, top, mid, horizon;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = clamp(d.y, -0.2, 1.0);
        vec3 col = mix(horizon, mid, smoothstep(0.0, 0.25, h));
        col = mix(col, top, smoothstep(0.25, 0.9, h));
        float a = acos(clamp(dot(d, sunDir), -1.0, 1.0));
        col += vec3(1.0, 0.97, 0.85) * smoothstep(0.05, 0.035, a);           // sun disk
        col += vec3(1.0, 0.95, 0.8) * 0.35 * exp(-a * 10.0);                  // glow
        float halo = exp(-pow((a - 0.384) / 0.012, 2.0));                     // 22° halo
        col += mix(vec3(1.0, 0.75, 0.6), vec3(0.75, 0.85, 1.0), smoothstep(0.37, 0.4, a)) * halo * 0.28;
        // sundogs: two bright spots on the halo, level with the sun
        vec3 right = normalize(cross(sunDir, vec3(0.0, 1.0, 0.0)));
        vec3 up = cross(right, sunDir);
        for (int i = 0; i < 2; i++) {
          float s = i == 0 ? 1.0 : -1.0;
          vec3 dog = normalize(sunDir * cos(0.384) + right * s * sin(0.384));
          float ad = acos(clamp(dot(d, dog), -1.0, 1.0));
          col += vec3(1.0, 0.85, 0.7) * exp(-ad * 70.0) * 0.6;
        }
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), mat);
  sky.scale.setScalar(1500);
  sky.frustumCulled = false;
  sky.renderOrder = -1;
  sky.name = 'Sky';
  return sky;
}

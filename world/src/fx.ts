// Extra render features on top of look.ts: wind-swept instanced grass and screen-space sun shafts.
import * as THREE from 'three';
import type { MeshBVH } from 'three-mesh-bvh';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { timeUniform } from './look';

function mulberry32(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * GPU grass field that follows the camera (the Ghost of Tsushima / Genshin approach):
 * a fixed pool of blades lives in a square tile around the player; each blade's world position is
 * stable (toroidal wrap), its height and colour are read from textures baked from the terrain,
 * and a mask texture removes blades from water, cliffs, paths and anything built on top.
 */
export function makeGrassField(terrain: THREE.Mesh, bvh: MeshBVH, waterLevel: number, opts: { count: number; size: number }) {
  const g = terrain.geometry as THREE.BufferGeometry;
  const pos = g.attributes.position as THREE.BufferAttribute;
  const col = g.attributes.color as THREE.BufferAttribute;
  const nor = g.attributes.normal as THREE.BufferAttribute;
  const n = Math.round(Math.sqrt(pos.count));
  const half = -pos.getX(0);

  // bake height / colour+mask textures on the terrain grid
  const hData = new Float32Array(n * n);
  const cData = new Uint8Array(n * n * 4);
  const ray = new THREE.Ray(new THREE.Vector3(), new THREE.Vector3(0, -1, 0));
  for (let k = 0; k < n * n; k++) {
    const x = pos.getX(k), y = pos.getY(k), z = pos.getZ(k);
    hData[k] = y;
    const r = col.getX(k), gg = col.getY(k), b = col.getZ(k);
    let mask = y > waterLevel + 0.6 && nor.getY(k) > 0.8 && gg > r * 1.12 && gg > b * 1.25 ? 1 : 0;
    if (mask) {
      ray.origin.set(x, y + 40, z);
      const hit = bvh.raycastFirst(ray, THREE.DoubleSide);
      if (hit && hit.point.y > y + 0.6) mask = 0;
    }
    cData[k * 4] = Math.min(255, r * 255); cData[k * 4 + 1] = Math.min(255, gg * 255); cData[k * 4 + 2] = Math.min(255, b * 255);
    cData[k * 4 + 3] = mask * 255;
  }
  const tH = new THREE.DataTexture(hData, n, n, THREE.RedFormat, THREE.FloatType);
  tH.magFilter = tH.minFilter = THREE.LinearFilter;
  tH.needsUpdate = true;
  const tC = new THREE.DataTexture(cData, n, n, THREE.RGBAFormat);
  tC.magFilter = tC.minFilter = THREE.LinearFilter;
  tC.needsUpdate = true;

  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([-0.06, 0, 0, 0.06, 0, 0, -0.04, 0.4, 0, 0.04, 0.4, 0, 0, 0.82, 0], 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 0.48, 1, 0.48, 0.5, 1], 2));
  geo.setIndex([0, 1, 2, 2, 1, 3, 2, 3, 4]);
  const rng = mulberry32(11);
  const rand = new Float32Array(opts.count * 4);
  for (let i = 0; i < rand.length; i++) rand[i] = rng();
  geo.setAttribute('aRand', new THREE.InstancedBufferAttribute(rand, 4));
  geo.instanceCount = opts.count;

  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    uCam: { value: new THREE.Vector3() },
    uSize: { value: opts.size },
    uHalf: { value: half },
    uN: { value: n },
    tH: { value: tH },
    tC: { value: tC },
  }]);
  uniforms.uTime = timeUniform;
  const mat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    fog: true,
    uniforms,
    vertexShader: /* glsl */ `
      uniform float uTime, uSize, uHalf, uN;
      uniform vec3 uCam;
      uniform sampler2D tH, tC;
      attribute vec4 aRand;
      varying vec2 vUv;
      varying vec3 vCol;
      #include <fog_pars_vertex>
      void main() {
        vec2 lo = uCam.xz - 0.5 * uSize;
        vec2 wxz = lo + mod(aRand.xy * uSize - lo, uSize);
        vec2 tuv = ((wxz + uHalf) / (2.0 * uHalf)) * ((uN - 1.0) / uN) + 0.5 / uN;
        vec4 cm = texture2D(tC, tuv);
        float h = texture2D(tH, tuv).r;
        float dist = length(wxz - uCam.xz);
        float fade = 1.0 - smoothstep(uSize * 0.22, uSize * 0.48, dist);
        float keep = step(aRand.w, cm.a * fade);
        float sc = mix(0.55, 1.25, fract(aRand.z * 7.13)) * keep;
        float ang = aRand.z * 6.2831;
        vec3 p = position * vec3(sc, sc * mix(0.8, 1.35, fract(aRand.w * 13.7)), sc);
        p.xz = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * p.xz;
        vec3 wp = vec3(wxz.x, h - 0.04, wxz.y) + p;
        float k = uv.y * uv.y;
        float gust = sin(uTime * 0.7 + wp.x * 0.045 + wp.z * 0.035);
        wp.x += (sin(uTime * 2.2 + wp.x * 0.7 + wp.z * 0.45) * 0.1 + gust * 0.22) * k * sc;
        wp.z += (cos(uTime * 1.8 + wp.z * 0.55) * 0.07 + gust * 0.08) * k * sc;
        vUv = uv;
        vCol = cm.rgb;
        vec4 mvPosition = viewMatrix * vec4(wp, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vCol;
      #include <fog_pars_fragment>
      void main() {
        vec3 base = vCol * 0.66;
        vec3 tip = mix(vCol, vec3(1.0, 1.0, 0.7), 0.38) * 1.18;
        gl_FragColor = vec4(mix(base, tip, smoothstep(0.1, 0.95, vUv.y)), 1.0);
        #include <fog_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.name = 'GrassField';
  return { mesh, update: (cam: THREE.Vector3) => { (uniforms.uCam.value as THREE.Vector3).copy(cam); } };
}

/** Screen-space god rays from the sun: radial blur of the bright sky/cloud pixels toward the sun. */
export function makeSunShafts() {
  const pass = new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      sunUv: { value: new THREE.Vector2(0.5, 0.5) },
      strength: { value: 0 },
      aspect: { value: 1 },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse; uniform vec2 sunUv; uniform float strength, aspect;
      varying vec2 vUv;
      void main() {
        vec4 base = texture2D(tDiffuse, vUv);
        if (strength <= 0.001) { gl_FragColor = base; return; }
        vec2 d = (vUv - sunUv) / 48.0 * 0.9;
        vec2 uv = vUv;
        float decay = 1.0, acc = 0.0;
        for (int i = 0; i < 48; i++) {
          uv -= d;
          vec3 s = texture2D(tDiffuse, clamp(uv, 0.0, 1.0)).rgb;
          float l = dot(s, vec3(0.299, 0.587, 0.114));
          acc += smoothstep(0.9, 1.0, l) * decay;
          decay *= 0.955;
        }
        vec2 off = (vUv - sunUv) * vec2(aspect, 1.0);
        float fall = exp(-dot(off, off) * 1.6);
        gl_FragColor = vec4(base.rgb + vec3(1.0, 0.9, 0.72) * acc / 48.0 * strength * fall, base.a);
      }`,
  });
  const v = new THREE.Vector3();
  /** Call every frame before rendering. */
  const update = (camera: THREE.PerspectiveCamera, sunDir: THREE.Vector3) => {
    v.copy(camera.position).addScaledVector(sunDir, 1000).project(camera);
    const facing = camera.getWorldDirection(new THREE.Vector3()).dot(sunDir);
    pass.uniforms.sunUv.value.set(v.x * 0.5 + 0.5, v.y * 0.5 + 0.5);
    pass.uniforms.aspect.value = camera.aspect;
    pass.uniforms.strength.value = THREE.MathUtils.smoothstep(facing, 0.1, 0.6) * 1.1;
  };
  return { pass, update };
}

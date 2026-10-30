// Extra render features on top of look.ts: wind-swept instanced grass and screen-space sun shafts.
import * as THREE from 'three';
import type { MeshBVH } from 'three-mesh-bvh';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { timeUniform } from './look';
import type { WorldGrid } from './grid';

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
export function makeGrassField(grid: WorldGrid, bvh: MeshBVH, waterLevel: number, opts: { count: number; size: number }) {
  const n = grid.nx, nz = grid.nz;
  // bake colour+mask texture on the world grid (height comes from the grid's own texture)
  const cData = new Uint8Array(n * nz * 4);
  const ray = new THREE.Ray(new THREE.Vector3(), new THREE.Vector3(0, -1, 0));
  for (let k = 0; k < n * nz; k++) {
    const x = grid.x0 + (k % n) * grid.cell, z = grid.z0 + Math.floor(k / n) * grid.cell, y = grid.h[k];
    const r = grid.col[k * 3], gg = grid.col[k * 3 + 1], b = grid.col[k * 3 + 2];
    let mask = y > waterLevel + 0.6 && grid.ny[k] > 0.8 && gg > r * 1.12 && gg > b * 1.25 ? 1 : 0;
    if (mask) {
      ray.origin.set(x, y + 40, z);
      const hit = bvh.raycastFirst(ray, THREE.DoubleSide);
      if (hit && hit.point.y > y + 0.6) mask = 0;
    }
    cData[k * 4] = Math.min(255, r * 255); cData[k * 4 + 1] = Math.min(255, gg * 255); cData[k * 4 + 2] = Math.min(255, b * 255);
    cData[k * 4 + 3] = mask * 255;
  }
  const tH = grid.heightTexture();
  const tC = new THREE.DataTexture(cData, n, nz, THREE.RGBAFormat);
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
    uOrigin: { value: new THREE.Vector2(grid.x0, grid.z0) },
    uSpan: { value: new THREE.Vector2(grid.span, grid.spanZ) },
    uN: { value: new THREE.Vector2(n, nz) },
    tH: { value: tH },
    tC: { value: tC },
  }]);
  uniforms.uTime = timeUniform;
  const mat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    fog: true,
    uniforms,
    vertexShader: /* glsl */ `
      uniform float uTime, uSize;
      uniform vec2 uOrigin, uSpan, uN;
      uniform vec3 uCam;
      uniform sampler2D tH, tC;
      attribute vec4 aRand;
      varying vec2 vUv;
      varying vec3 vCol;
      #include <fog_pars_vertex>
      void main() {
        vec2 lo = uCam.xz - 0.5 * uSize;
        vec2 wxz = lo + mod(aRand.xy * uSize - lo, uSize);
        vec2 tuv = ((wxz - uOrigin) / uSpan) * ((uN - 1.0) / uN) + 0.5 / uN;
        vec4 cm = texture2D(tC, tuv);
        float dist = length(wxz - uCam.xz);
        float fade = 1.0 - smoothstep(uSize * 0.22, uSize * 0.48, dist);
        float keep = step(aRand.w, cm.a * fade);
        // Masked/faded blades used to collapse into degenerate triangles, but
        // still paid for height sampling and every wind/trigonometry operation.
        // All vertices share aRand/tuv: rejecting the entire blade is coherent.
        if (keep < 0.5) {
          vUv = uv; vCol = cm.rgb;
          gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
          #ifdef USE_FOG
            vFogDepth = 0.0;
          #endif
          return;
        }
        float h = texture2D(tH, tuv).r;
        float sc = mix(0.55, 1.25, fract(aRand.z * 7.13));
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
        vec2 d = (vUv - sunUv) / 32.0 * 0.9;
        vec2 uv = vUv;
        float decay = 1.0, acc = 0.0;
        for (int i = 0; i < 32; i++) {
          uv -= d;
          vec3 s = texture2D(tDiffuse, clamp(uv, 0.0, 1.0)).rgb;
          float l = dot(s, vec3(0.299, 0.587, 0.114));
          acc += smoothstep(0.9, 1.0, l) * decay;
          decay *= 0.935;
        }
        vec2 off = (vUv - sunUv) * vec2(aspect, 1.0);
        float fall = exp(-dot(off, off) * 1.6);
        gl_FragColor = vec4(base.rgb + vec3(1.0, 0.9, 0.72) * acc / 32.0 * strength * fall, base.a);
      }`,
  });
  const v = new THREE.Vector3(), direction = new THREE.Vector3();
  /** Call every frame before rendering. */
  const update = (camera: THREE.PerspectiveCamera, sunDir: THREE.Vector3) => {
    v.copy(camera.position).addScaledVector(sunDir, 1000).project(camera);
    const facing = camera.getWorldDirection(direction).dot(sunDir);
    pass.uniforms.sunUv.value.set(v.x * 0.5 + 0.5, v.y * 0.5 + 0.5);
    pass.uniforms.aspect.value = camera.aspect;
    const strength = THREE.MathUtils.smoothstep(facing, 0.1, 0.6) * 1.1;
    pass.uniforms.strength.value = strength;
    // Same threshold as the shader's exact copy branch. Skipping this pass
    // avoids a full-screen render-target read/write when rays contribute zero.
    pass.enabled = strength > 0.001;
  };
  return { pass, update };
}

/**
 * Depth-aware water on top of look.ts's toon water: turquoise shallows over sand, deep blue
 * offshore, a foam line hugging every shore and wave bands rolling in toward the beach.
 */
export function enhanceWater(mat: THREE.Material, grid: WorldGrid, waterLevel: number) {
  const tex = grid.heightTexture();
  const prev = mat.onBeforeCompile.bind(mat);
  mat.onBeforeCompile = (sh, r) => {
    prev(sh, r);
    sh.uniforms.tWaterH = { value: tex };
    sh.uniforms.uTOrigin = { value: new THREE.Vector2(grid.x0, grid.z0) };
    sh.uniforms.uTSpan = { value: new THREE.Vector2(grid.span, grid.spanZ) };
    sh.uniforms.uWL = { value: waterLevel };
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D tWaterH;\nuniform vec2 uTOrigin, uTSpan;\nuniform float uWL;')
      .replace('#include <opaque_fragment>', /* glsl */ `
        {
          vec2 tuv = (vWPos.xz - uTOrigin) / uTSpan;
          float inside = step(0.0, tuv.x) * step(tuv.x, 1.0) * step(0.0, tuv.y) * step(tuv.y, 1.0);
          float depth = mix(14.0, uWL - texture2D(tWaterH, clamp(tuv, 0.0, 1.0)).r, inside);
          float dn = vnoise(vWPos.xz * 0.35 + vec2(uTime * 0.3, -uTime * 0.2));
          float dk = smoothstep(0.2, 7.0, depth);
          outgoingLight *= mix(vec3(1.22, 1.2, 0.96), vec3(0.55, 0.74, 1.02), dk);
          float edge = smoothstep(0.5, 0.05, depth + (dn - 0.5) * 0.35);
          float wave = smoothstep(0.72, 0.96, sin(depth * 4.5 - uTime * 1.7 + dn * 2.5)) * smoothstep(2.2, 0.5, depth);
          float foam = max(edge, wave * 0.75) * step(0.0, depth);
          outgoingLight = mix(outgoingLight, vec3(1.0, 1.0, 0.98), foam * 0.85);
          diffuseColor.a = mix(diffuseColor.a * mix(0.5, 1.0, smoothstep(0.0, 1.8, depth)), 1.0, foam);
        }
        #include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => 'cel-water-depth';
  mat.needsUpdate = true;
}

/** Updraft columns: spiralling wind motes and a faint scrolling wind sheath. */
export function makeUpdrafts(cols: { x: number; z: number; r: number; y0: number; y1: number }[]) {
  const group = new THREE.Group();
  group.name = 'Updrafts';
  if (!cols.length) return group;
  const per = 220;
  const pos = new Float32Array(cols.length * per * 3);
  const col = new Float32Array(cols.length * per * 4); // x, z, r, y0
  const top = new Float32Array(cols.length * per);
  const seed = new Float32Array(cols.length * per * 3);
  const rng = mulberry32(7);
  cols.forEach((c, i) => {
    for (let k = 0; k < per; k++) {
      const j = i * per + k;
      col.set([c.x, c.z, c.r, c.y0], j * 4);
      top[j] = c.y1;
      seed.set([rng(), rng(), rng()], j * 3);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aCol', new THREE.BufferAttribute(col, 4));
  g.setAttribute('aTop', new THREE.BufferAttribute(top, 1));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 3));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: timeUniform, uScale: { value: innerHeight * 0.5 } },
    vertexShader: /* glsl */ `
      uniform float uTime, uScale;
      attribute vec4 aCol; attribute float aTop; attribute vec3 aSeed;
      varying float vA;
      void main() {
        float t = fract(aSeed.x + uTime * (0.12 + aSeed.z * 0.1));
        float y = mix(aCol.w, aTop, t);
        float ang = aSeed.y * 6.2831 + uTime * (1.4 + aSeed.z) + t * 9.0;
        float rad = aCol.z * (0.25 + 0.75 * sqrt(aSeed.z));
        vec3 p = vec3(aCol.x + cos(ang) * rad, y, aCol.y + sin(ang) * rad);
        vec4 mv = viewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        vA = smoothstep(0.0, 0.1, t) * smoothstep(1.0, 0.75, t);
        gl_PointSize = (0.14 + aSeed.z * 0.16) * uScale / -mv.z;
      }`,
    fragmentShader: /* glsl */ `
      varying float vA;
      void main() {
        vec2 d = gl_PointCoord - 0.5;
        float a = smoothstep(0.5, 0.1, length(d)) * vA;
        gl_FragColor = vec4(vec3(0.8, 1.0, 1.0) * a * 0.9, a);
      }`,
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  group.add(pts);
  const sheath = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: { uTime: timeUniform },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */ `
      uniform float uTime; varying vec2 vUv;
      void main() {
        float s = smoothstep(0.75, 1.0, sin((vUv.x * 3.0 + vUv.y * 2.0 - uTime * 0.6) * 6.2831));
        float a = s * smoothstep(0.0, 0.15, vUv.y) * smoothstep(1.0, 0.6, vUv.y) * 0.22;
        gl_FragColor = vec4(vec3(0.85, 1.0, 1.0) * a, a);
      }`,
  });
  for (const c of cols) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(c.r, c.r * 0.8, c.y1 - c.y0, 24, 1, true), sheath);
    m.position.set(c.x, (c.y0 + c.y1) / 2, c.z);
    m.raycast = () => {};
    group.add(m);
  }
  return group;
}

/** Drifting petals and pollen motes in a box that wraps around the camera. */
export function makeAmbientParticles(count = 1600, size = 70) {
  const g = new THREE.BufferGeometry();
  const rng = mulberry32(23);
  const seed = new Float32Array(count * 4);
  for (let i = 0; i < seed.length; i++) seed[i] = rng();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  const uniforms = { uTime: timeUniform, uCam: { value: new THREE.Vector3() }, uSize: { value: size }, uScale: { value: innerHeight * 0.5 } };
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms,
    vertexShader: /* glsl */ `
      uniform float uTime, uSize, uScale; uniform vec3 uCam;
      attribute vec4 aSeed;
      varying float vKind; varying float vA; varying float vRot;
      void main() {
        vec3 drift = vec3(uTime * (0.6 + aSeed.z * 0.8), -uTime * (0.25 + aSeed.w * 0.3), uTime * 0.35);
        drift.x += sin(uTime * 1.3 + aSeed.y * 20.0) * 1.2;
        drift.y += sin(uTime * 2.1 + aSeed.x * 17.0) * 0.4;
        vec3 lo = uCam - vec3(0.5 * uSize, 0.25 * uSize, 0.5 * uSize);
        vec3 p = lo + mod(aSeed.xyz * vec3(uSize, uSize * 0.5, uSize) + drift - lo, vec3(uSize, uSize * 0.5, uSize));
        vec4 mv = viewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        vKind = step(0.6, aSeed.w);
        vRot = uTime * (1.0 + aSeed.x * 3.0) + aSeed.y * 6.0;
        float dist = length(p - uCam);
        vA = smoothstep(uSize * 0.5, uSize * 0.3, dist) * smoothstep(0.5, 3.0, dist);
        gl_PointSize = mix(0.09, 0.2, vKind) * uScale / -mv.z;
      }`,
    fragmentShader: /* glsl */ `
      varying float vKind; varying float vA; varying float vRot;
      void main() {
        vec2 d = gl_PointCoord - 0.5;
        float c = cos(vRot), s = sin(vRot);
        d = mat2(c, -s, s, c) * d;
        // petal: squashed ellipse that flips as it tumbles; pollen: soft round mote
        float petal = smoothstep(0.5, 0.42, length(d * vec2(1.0, 1.0 + 1.6 * abs(sin(vRot * 0.7)))));
        float mote = smoothstep(0.5, 0.0, length(d));
        float a = mix(mote * 0.55, petal, vKind) * vA;
        vec3 col = mix(vec3(1.0, 0.98, 0.8), vec3(1.0, 0.78, 0.88), vKind);
        if (a < 0.02) discard;
        gl_FragColor = vec4(col, a);
      }`,
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  pts.name = 'AmbientParticles';
  return { points: pts, update: (cam: THREE.Vector3) => { uniforms.uCam.value.copy(cam); } };
}

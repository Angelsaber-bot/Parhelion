// Extra render features on top of look.ts: wind-swept instanced grass and screen-space sun shafts.
import * as THREE from 'three';
import type { MeshBVH } from 'three-mesh-bvh';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { timeUniform, cloudShadowUniform, NOISE_GLSL, SUN_DIR } from './look';
import type { WorldGrid } from '../map/grid';

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
/** Grass blade proportions (m). Blades average about half a metre; patches run 0.55–1.2× that, and one blade
 * in `1/seedShare` of the taller patches is a seed head half as tall again. The protagonist parts blades
 * between `pushInner` (fully laid over) and `pushOuter` (untouched). */
export const GRASS_BLADE = Object.freeze({ halfWidths: [.05, .042, .028] as const, length: .62, patch: .11, seedShare: .06, pushInner: .3, pushOuter: 1.5 });
const SUN_XZ = (() => { const l = Math.hypot(SUN_DIR.x, SUN_DIR.z) || 1; return [SUN_DIR.x / l, SUN_DIR.z / l] as const; })();
export function makeGrassField(grid: WorldGrid, builtBvh: MeshBVH, waterLevel: number, opts: { count: number; size: number; excluded?: Uint8Array }) {
  const n = grid.nx, nz = grid.nz;
  // bake colour+mask texture on the world grid (height comes from the grid's own texture)
  const cData = new Uint8Array(n * nz * 4);
  const ray = new THREE.Ray(new THREE.Vector3(), new THREE.Vector3(0, -1, 0));
  for (let k = 0; k < n * nz; k++) {
    const x = grid.x0 + (k % n) * grid.cell, z = grid.z0 + Math.floor(k / n) * grid.cell, y = grid.h[k];
    const r = grid.col[k * 3], gg = grid.col[k * 3 + 1], b = grid.col[k * 3 + 2];
    let mask = !opts.excluded?.[k] && y > waterLevel + 0.6 && grid.ny[k] > 0.8 && gg > r * 1.12 && gg > b * 1.25 ? 1 : 0;
    if (mask) {
      ray.origin.set(x, y + 40, z);
      // Query construction without the terrain itself. Coplanar castle paving
      // and thin decks are occupied ground too; a 60 cm threshold missed them.
      const hit = builtBvh.raycastFirst(ray, THREE.DoubleSide);
      if (hit && hit.point.y >= y - .1) mask = 0;
    }
    cData[k * 4] = Math.min(255, r * 255); cData[k * 4 + 1] = Math.min(255, gg * 255); cData[k * 4 + 2] = Math.min(255, b * 255);
    cData[k * 4 + 3] = mask * 255;
  }
  const tH = grid.heightTexture();
  const tC = new THREE.DataTexture(cData, n, nz, THREE.RGBAFormat);
  tC.magFilter = tC.minFilter = THREE.LinearFilter;
  tC.needsUpdate = true;

  // One blade: three segments tapering to a point, unit height (the shader gives it length, lean and bend).
  const geo = new THREE.InstancedBufferGeometry();
  const W = GRASS_BLADE.halfWidths;
  geo.setAttribute('position', new THREE.Float32BufferAttribute([-W[0], 0, 0, W[0], 0, 0, -W[1], 1 / 3, 0, W[1], 1 / 3, 0, -W[2], 2 / 3, 0, W[2], 2 / 3, 0, 0, 1, 0], 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1 / 3, 1, 1 / 3, 0, 2 / 3, 1, 2 / 3, .5, 1], 2));
  geo.setIndex([0, 1, 2, 2, 1, 3, 2, 3, 4, 4, 3, 5, 4, 5, 6]);
  const rng = mulberry32(11);
  const rand = new Float32Array(opts.count * 4);
  for (let i = 0; i < rand.length; i++) rand[i] = rng();
  geo.setAttribute('aRand', new THREE.InstancedBufferAttribute(rand, 4));
  geo.instanceCount = opts.count;

  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    uCam: { value: new THREE.Vector3() },
    uPlayer: { value: new THREE.Vector3(0, -1e4, 0) },
    uSize: { value: opts.size },
    uOrigin: { value: new THREE.Vector2(grid.x0, grid.z0) },
    uSpan: { value: new THREE.Vector2(grid.span, grid.spanZ) },
    uN: { value: new THREE.Vector2(n, nz) },
    tH: { value: tH },
    tC: { value: tC },
  }]);
  uniforms.uTime = timeUniform; uniforms.uCloud = cloudShadowUniform;
  const mat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    fog: true,
    uniforms,
    vertexShader: /* glsl */ `
      uniform float uTime, uSize;
      uniform vec2 uOrigin, uSpan, uN;
      uniform vec3 uCam, uPlayer;
      uniform sampler2D tH, tC;
      attribute vec4 aRand;
      varying vec2 vUv;
      varying vec3 vCol;
      varying vec2 vWxz;
      varying vec3 vLook; // x: gust front for the wind sheen, y: sun-facing shade, z: seed-head blade
      ${NOISE_GLSL}
      #include <fog_pars_vertex>
      void main() {
        vec2 lo = uCam.xz - 0.5 * uSize;
        vec2 wxz = lo + mod(aRand.xy * uSize - lo, uSize);
        vec2 tuv = ((wxz - uOrigin) / uSpan) * ((uN - 1.0) / uN) + 0.5 / uN;
        vec4 cm = texture2D(tC, tuv);
        float h = texture2D(tH, tuv).r;
        float dist = length(wxz - uCam.xz);
        float fade = 1.0 - smoothstep(uSize * 0.22, uSize * 0.48, dist);
        float keep = step(aRand.w, cm.a * fade);
        // Blades right at the lens filled the bottom of the frame as giant spikes; they bow out
        // inside ~2 m of the camera (the player stands further ahead and keeps its grass).
        float sc = keep * smoothstep(0.7, 2.3, dist);
        // A meadow, not a carpet: metres-wide patches run taller or shorter and greener or drier,
        // and a few blades in a hundred are tall seed heads.
        float patchTall = vnoise(wxz * ${GRASS_BLADE.patch.toFixed(3)});
        float patchDry = vnoise(wxz * 0.31 + 17.0);
        float seed = step(${(1 - GRASS_BLADE.seedShare).toFixed(3)}, fract(aRand.z * 31.7)) * step(0.45, patchTall);
        float len = ${GRASS_BLADE.length.toFixed(2)} * mix(0.55, 1.2, patchTall) * mix(0.7, 1.25, fract(aRand.w * 13.7)) * (1.0 + 0.55 * seed) * sc;
        float wide = mix(0.8, 1.35, fract(aRand.z * 7.13)) * sc * (1.0 - 0.35 * seed);
        float t = uv.y, t2 = t * t;
        // The blade leans the way it faces and curves over towards its tip.
        float bend = len * mix(0.18, 0.5, fract(aRand.x * 91.3));
        vec3 p = vec3(position.x * wide, t * len - bend * t2 * 0.3, bend * t2);
        float ang = aRand.z * 6.2831, ca = cos(ang), sa = sin(ang);
        p.xz = mat2(ca, -sa, sa, ca) * p.xz;
        vec3 wp = vec3(wxz.x, h - 0.04, wxz.y) + p;
        // Wind: broad gust fronts roll across the field, with a quicker flutter on top.
        float gust = sin(uTime * 0.7 + wxz.x * 0.045 + wxz.y * 0.035 + vnoise(wxz * 0.05) * 3.0);
        float flutter = sin(uTime * 2.2 + wxz.x * 0.7 + wxz.y * 0.45);
        wp.xz += vec2(1.0, 0.35) * (gust * 0.2 + flutter * 0.07) * t2 * len * 1.5;
        wp.y -= abs(gust) * 0.05 * t2 * len;
        // The protagonist parts the grass: blades within arm's reach lay over, away from the feet.
        vec2 away = wxz - uPlayer.xz; float pd = length(away);
        float push = (1.0 - smoothstep(${GRASS_BLADE.pushInner.toFixed(2)}, ${GRASS_BLADE.pushOuter.toFixed(2)}, pd)) * step(abs(h - uPlayer.y), 2.0);
        wp.xz += away / max(pd, 0.05) * push * 0.55 * t * len;
        wp.y -= push * 0.4 * t * len;
        vUv = uv;
        vCol = mix(cm.rgb, cm.rgb * vec3(1.14, 1.05, 0.7), smoothstep(0.45, 0.8, patchDry) * 0.55) * mix(1.0, 0.9, patchTall);
        vWxz = wxz;
        vLook = vec3(gust, 0.92 + 0.14 * abs(ca * ${SUN_XZ[0].toFixed(3)} + sa * ${SUN_XZ[1].toFixed(3)}), seed);
        vec4 mvPosition = viewMatrix * vec4(wp, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uCloud;
      varying vec2 vUv;
      varying vec3 vCol;
      varying vec2 vWxz;
      varying vec3 vLook;
      ${NOISE_GLSL}
      #include <fog_pars_fragment>
      void main() {
        vec3 base = vCol * 0.6;
        vec3 tip = mix(vCol, vec3(1.0, 1.0, 0.7), 0.34) * 1.16;
        vec3 c = mix(base, tip, smoothstep(0.05, 0.95, vUv.y)) * vLook.y;
        // Seed heads end in pale straw.
        c = mix(c, vec3(0.93, 0.86, 0.6), vLook.z * smoothstep(0.78, 1.0, vUv.y) * 0.8);
        // Wind sheen: the upper blade catches the light as a gust front passes.
        c += vec3(0.11, 0.12, 0.05) * smoothstep(0.55, 1.0, vLook.x) * vUv.y * vUv.y;
        // The same drifting cloud shadows as the land under it (look.ts celify).
        float cloud = smoothstep(0.5, 0.68, fbm(vWxz * 0.0105 + vec2(uTime * 0.016, uTime * 0.008))) * uCloud;
        c *= mix(vec3(1.0), vec3(0.74, 0.78, 0.9), cloud);
        gl_FragColor = vec4(c, 1.0);
        #include <fog_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.name = 'GrassField';
  /** `player`: where the protagonist's feet are, so nearby blades part (omit to leave the grass undisturbed). */
  return { mesh, update: (cam: THREE.Vector3, player?: THREE.Vector3) => { (uniforms.uCam.value as THREE.Vector3).copy(cam); if (player) (uniforms.uPlayer.value as THREE.Vector3).copy(player); else (uniforms.uPlayer.value as THREE.Vector3).set(0, -1e4, 0); } };
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
    pass.uniforms.strength.value = THREE.MathUtils.smoothstep(facing, 0.1, 0.6) * 1.1;
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


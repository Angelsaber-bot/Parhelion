import * as THREE from 'three';
import type { RegionId } from './settlements/types';
/**
 * Region weather motes: the air itself tells you which era you are in. The valley drifts pollen
 * and pale petals, the dusk kingdom sheds autumn leaves, the pirate coast throws salt spray and
 * driving streaks, the winter road snows, and Kyoto mixes rising embers with falling petals.
 *
 * One point cloud wrapped around the camera (one draw call). Each region names two particle kinds,
 * their colours, sizes, the split between them, the wind and how fast each kind falls or rises.
 * Drift is integrated on the CPU so changing wind never teleports a particle; crossing into another
 * era fades the air out and back in with the new preset.
 */
export type MoteShape = 'mote' | 'petal' | 'flake' | 'ember' | 'leaf' | 'streak';
const SHAPES: Record<MoteShape, number> = { mote: 0, petal: 1, flake: 2, ember: 3, leaf: 4, streak: 5 };
export interface WeatherPreset {
  a: { shape: MoteShape; color: number; size: number; fall: number };
  b: { shape: MoteShape; color: number; size: number; fall: number };
  /** share of particles that are kind A */ split: number;
  wind: readonly [number, number];
  opacity: number;
  /** share of the cloud that is lit in this era (snow is thick, valley air is light) */ density: number;
}
export const REGION_WEATHER: Readonly<Record<RegionId, WeatherPreset>> = Object.freeze({
  alpha: { a: { shape: 'mote', color: 0xfffacc, size: .09, fall: -.32 }, b: { shape: 'petal', color: 0xffc8e0, size: .2, fall: -.38 }, split: .6, wind: [.95, .35], opacity: 1, density: .45 },
  britain: { a: { shape: 'mote', color: 0xffd7a0, size: .085, fall: -.25 }, b: { shape: 'leaf', color: 0xd27a35, size: .26, fall: -.7 }, split: .55, wind: [1.25, .5], opacity: 1, density: .6 },
  blacksail: { a: { shape: 'mote', color: 0xe2f4ff, size: .08, fall: -.6 }, b: { shape: 'streak', color: 0xcfe4ee, size: .26, fall: -6.5 }, split: .45, wind: [3.4, 1.1], opacity: .8, density: .8 },
  winter: { a: { shape: 'flake', color: 0xffffff, size: .2, fall: -.85 }, b: { shape: 'flake', color: 0xe4f0ff, size: .32, fall: -1.15 }, split: .55, wind: [.55, .25], opacity: 1, density: 1 },
  kyoto: { a: { shape: 'ember', color: 0xffa54e, size: .14, fall: .55 }, b: { shape: 'petal', color: 0xffb3d0, size: .2, fall: -.4 }, split: .45, wind: [.7, .3], opacity: 1, density: .6 },
});

function mulberry32(a: number) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

export function makeRegionWeather(count = 1600, size = 70) {
  const g = new THREE.BufferGeometry();
  const rng = mulberry32(23), seed = new Float32Array(count * 4);
  for (let i = 0; i < seed.length; i++) seed[i] = rng();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  const uniforms = {
    uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uSize: { value: size }, uScale: { value: typeof innerHeight === 'number' ? innerHeight * .5 : 400 },
    uDrift: { value: new THREE.Vector4() }, // x, z wind travel; y travel of kind A; w travel of kind B
    uShape: { value: new THREE.Vector2() }, uColA: { value: new THREE.Color() }, uColB: { value: new THREE.Color() },
    uSizes: { value: new THREE.Vector2() }, uSplit: { value: .6 }, uAlpha: { value: 0 }, uDensity: { value: 1 },
  };
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms,
    vertexShader: /* glsl */ `
      uniform float uTime, uSize, uScale, uSplit, uDensity; uniform vec3 uCam; uniform vec4 uDrift; uniform vec2 uSizes;
      attribute vec4 aSeed;
      varying float vB; varying float vA; varying float vRot;
      void main() {
        vB = step(uSplit, aSeed.w);
        vec3 drift = vec3(uDrift.x * (0.6 + aSeed.z * 0.8), mix(uDrift.y, uDrift.w, vB) * (0.7 + aSeed.x * 0.6), uDrift.z * (0.7 + aSeed.y * 0.6));
        drift.x += sin(uTime * 1.3 + aSeed.y * 20.0) * 1.1;
        drift.y += sin(uTime * 2.1 + aSeed.x * 17.0) * 0.35;
        vec3 lo = uCam - vec3(0.5 * uSize, 0.25 * uSize, 0.5 * uSize);
        vec3 p = lo + mod(aSeed.xyz * vec3(uSize, uSize * 0.5, uSize) + drift - lo, vec3(uSize, uSize * 0.5, uSize));
        vec4 mv = viewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        vRot = uTime * (1.0 + aSeed.x * 3.0) + aSeed.y * 6.0;
        float dist = length(p - uCam);
        vA = smoothstep(uSize * 0.5, uSize * 0.3, dist) * smoothstep(0.5, 3.0, dist);
        // Thinner eras simply leave part of the cloud unlit.
        gl_PointSize = aSeed.y * 0.999 < uDensity ? mix(uSizes.x, uSizes.y, vB) * uScale / -mv.z : 0.0;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec2 uShape; uniform vec3 uColA, uColB; uniform float uAlpha;
      varying float vB; varying float vA; varying float vRot;
      float shape(float kind, vec2 d, float rot) {
        float c = cos(rot), s = sin(rot); vec2 r = mat2(c, -s, s, c) * d;
        if (kind < 0.5) return smoothstep(0.5, 0.0, length(d)) * 0.55;                                  // pollen mote
        if (kind < 1.5) return smoothstep(0.5, 0.42, length(r * vec2(1.0, 1.0 + 1.6 * abs(sin(rot * 0.7))))); // tumbling petal
        if (kind < 2.5) return smoothstep(0.5, 0.18, length(d)) * 0.95;                                 // snowflake
        if (kind < 3.5) { float l = length(d); return clamp(smoothstep(0.5, 0.0, l) * 0.7 + smoothstep(0.18, 0.0, l), 0.0, 1.0); } // ember
        if (kind < 4.5) { vec2 q = r * vec2(1.0, 2.3 + 0.9 * abs(sin(rot * 0.5))); return smoothstep(0.5, 0.4, length(q) + abs(q.x) * 0.35); } // leaf
        return smoothstep(0.5, 0.3, length(d * vec2(7.0, 1.0))) * 0.7;                                  // rain / spray streak
      }
      void main() {
        vec2 d = gl_PointCoord - 0.5;
        float a = shape(mix(uShape.x, uShape.y, vB), d, vRot) * vA * uAlpha;
        if (a < 0.02) discard;
        vec3 col = mix(uColA, uColB, vB);
        gl_FragColor = vec4(col, a);
      }`,
  });
  const points = new THREE.Points(g, mat);
  points.frustumCulled = false; points.name = 'RegionWeather';

  let current: RegionId | null = null, pending: RegionId | null = null, fade = 0, elapsed = 0;
  const drift = uniforms.uDrift.value;
  function apply(region: RegionId) {
    const w = REGION_WEATHER[region];
    uniforms.uShape.value.set(SHAPES[w.a.shape], SHAPES[w.b.shape]);
    uniforms.uColA.value.setHex(w.a.color); uniforms.uColB.value.setHex(w.b.color);
    uniforms.uSizes.value.set(w.a.size, w.b.size); uniforms.uSplit.value = w.split; uniforms.uDensity.value = w.density;
    current = region;
  }
  return {
    points,
    get region() { return current; },
    get alpha() { return uniforms.uAlpha.value; },
    uniforms,
    /** `pixels` is the drawing-buffer height in device pixels, so motes keep their size on retina screens. */
    update(cam: THREE.Vector3, region: RegionId, dtRaw = 1 / 60, pixels?: number) {
      if (pixels && Number.isFinite(pixels)) uniforms.uScale.value = pixels * .5;
      const dt = Number.isFinite(dtRaw) ? Math.max(0, Math.min(.1, dtRaw)) : 0;
      elapsed += dt; uniforms.uTime.value = elapsed; uniforms.uCam.value.copy(cam);
      if (current === null) { apply(region); fade = 1; }
      if (region !== current) pending = region;
      // Fade the old air out, swap presets, fade the new air in.
      if (pending && pending !== current) { fade = Math.max(0, fade - dt / .8); if (fade === 0) { apply(pending); pending = null; } }
      else { pending = null; fade = Math.min(1, fade + dt / 1.2); }
      const w = REGION_WEATHER[current!];
      uniforms.uAlpha.value = fade * w.opacity;
      drift.x += w.wind[0] * dt; drift.z += w.wind[1] * dt; drift.y += w.a.fall * dt; drift.w += w.b.fall * dt;
      // Keep the integrators small; the shader wraps positions anyway.
      const wrap = size * 64;
      if (Math.abs(drift.x) > wrap || Math.abs(drift.y) > wrap || Math.abs(drift.z) > wrap || Math.abs(drift.w) > wrap) drift.set(0, 0, 0, 0);
    },
    dispose() { g.dispose(); mat.dispose(); points.removeFromParent(); },
  };
}

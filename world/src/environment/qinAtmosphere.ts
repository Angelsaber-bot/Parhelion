import * as THREE from 'three';
import { QIN_FRAME } from '../map/qinPlan';

/**
 * Qin's living air: furnace sparks, kiln and incense smoke, dust turning in the
 * garrison skylight and a silver haze over the mercury sea. Every particle moves on
 * the GPU from its seed and the clock; the CPU only advances time and culls by range.
 */
export type Mode = 'rise' | 'smoke' | 'drift' | 'haze';
export interface Emitter { id: string; mode: Mode; at: [number, number, number]; count: number; spread: [number, number, number]; color: string; size: number; height: number; speed: number; range: number; opacity: number }
export const QIN_EMITTERS: readonly Emitter[] = [
  ...([[124, -84], [142, -84], [146, -106]] as const).map(([x, z], i) => ({ id: `foundry-sparks-${i}`, mode: 'rise' as const, at: [x, 51.8, z] as [number, number, number], count: 70, spread: [1.6, .2, 1.6] as [number, number, number], color: '#ffb35a', size: .16, height: 4.2, speed: .45, range: 90, opacity: 1 })),
  { id: 'shed-sparks', mode: 'rise', at: [-131.1, 25.1, 123.3], count: 40, spread: [.7, .1, .7], color: '#ffb35a', size: .14, height: 2.6, speed: .55, range: 80, opacity: 1 },
  { id: 'shed-smoke', mode: 'smoke', at: [-131.1, 25.4, 123.3], count: 28, spread: [.5, .1, .5], color: '#8d8a84', size: 2.2, height: 12, speed: .09, range: 160, opacity: .28 },
  { id: 'kiln-smoke-a', mode: 'smoke', at: [-230.05, 32.6, 49.6], count: 36, spread: [.5, .1, .5], color: '#9a958b', size: 2.8, height: 18, speed: .07, range: 220, opacity: .3 },
  { id: 'kiln-smoke-b', mode: 'smoke', at: [-219.5, 32.2, 51.05], count: 30, spread: [.5, .1, .5], color: '#a39e93', size: 2.5, height: 15, speed: .075, range: 220, opacity: .28 },
  ...([-1, 1] as const).map(s => ({ id: `incense-${s}`, mode: 'smoke' as const, at: [40 + s * 9, 61.4, 72] as [number, number, number], count: 22, spread: [.25, .05, .25] as [number, number, number], color: '#b9c4cf', size: .9, height: 7, speed: .12, range: 140, opacity: .32 })),
  { id: 'skylight-dust', mode: 'drift', at: [-17, 28.4, -130], count: 160, spread: [2.4, 10.4, 2.4], color: '#fff0c4', size: .07, height: 0, speed: .05, range: 70, opacity: .85 },
  { id: 'garrison-dust', mode: 'drift', at: [-15, 28.6, -130], count: 220, spread: [44, 8, 29], color: '#d9c8a4', size: .05, height: 0, speed: .03, range: 80, opacity: .45 },
  { id: 'foundry-haze', mode: 'drift', at: [130, 46.6, -96], count: 140, spread: [28, 8, 32], color: '#ffcf8a', size: .06, height: 0, speed: .04, range: 80, opacity: .55 },
  { id: 'mercury-haze', mode: 'haze', at: [55, 10.2, -178], count: 260, spread: [21, 2.4, 21], color: '#dfe9ff', size: .09, height: 0, speed: .05, range: 70, opacity: .9 },
  { id: 'dome-glitter', mode: 'haze', at: [55, 22, -178], count: 120, spread: [17, 9, 17], color: '#ffe6a8', size: .06, height: 0, speed: .02, range: 70, opacity: .7 },
];

const vertex = /* glsl */`
  attribute vec4 seed;
  uniform float uTime, uSpeed, uHeight, uSize, uMode;
  uniform vec3 uSpread;
  varying float vAlpha;
  void main(){
    vec3 p = position; float t = uTime * uSpeed + seed.x * 17.0; float a = 1.0;
    if (uMode < .5) { // rise: sparks climb, sway and wink out
      float age = fract(t + seed.y); p += vec3(seed.z - .5, 0.0, seed.w - .5) * uSpread * 2.0 * (1.0 + age);
      p.y += age * uHeight; p.x += sin(t * 9.0 + seed.y * 30.0) * .12 * age; p.z += cos(t * 7.0 + seed.z * 30.0) * .12 * age;
      a = (1.0 - age) * smoothstep(0.0, .08, age) * (.6 + .4 * sin(t * 40.0 + seed.w * 50.0));
    } else if (uMode < 1.5) { // smoke: billows widen and lean downwind
      float age = fract(t + seed.y); p += vec3(seed.z - .5, 0.0, seed.w - .5) * uSpread * 2.0;
      p.y += age * uHeight; p.x += age * age * uHeight * .35 + sin(t * 2.0 + seed.z * 9.0) * age; p.z += age * uHeight * .12;
      a = smoothstep(0.0, .15, age) * (1.0 - age);
    } else { // drift / haze: slow Lissajous wandering inside a volume, with a twinkle for haze
      p += (seed.yzw - .5) * uSpread * 2.0;
      p += vec3(sin(t * 1.3 + seed.w * 6.0), sin(t * .9 + seed.y * 6.0) * .6, cos(t * 1.1 + seed.z * 6.0)) * .8;
      a = uMode < 2.5 ? .55 + .45 * sin(t * 3.0 + seed.x * 20.0) : pow(max(0.0, sin(t * 5.0 + seed.x * 40.0)), 6.0);
    }
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float grow = uMode > .5 && uMode < 1.5 ? (1.0 + fract(t + seed.y) * 2.5) : 1.0;
    gl_PointSize = clamp(uSize * grow * 420.0 / max(-mv.z, .1), 1.0, 96.0);
    vAlpha = a;
  }`;
const fragment = /* glsl */`
  uniform vec3 uColor; uniform float uOpacity; uniform float uSoft;
  varying float vAlpha;
  void main(){
    vec2 c = gl_PointCoord - .5; float d = length(c);
    float disc = uSoft > .5 ? smoothstep(.5, 0.0, d) * .8 : smoothstep(.5, .1, d);
    float a = disc * vAlpha * uOpacity; if (a < .01) discard;
    gl_FragColor = vec4(uColor, a);
  }`;

/** Any region can pass its own emitters and offset; Qin's are the default. */
export function createQinAtmosphere(emitters: readonly Emitter[] = QIN_EMITTERS, frame: { offset: readonly [number, number]; rotated?: boolean } = QIN_FRAME, name = 'QinAtmosphere') {
  // Emitters are authored in the region's own frame (a half turn flips x and z).
  const s = frame.rotated ? -1 : 1, [OX2, OZ2] = frame.offset;
  const root = new THREE.Group(); root.name = name;
  const systems: { points: THREE.Points; material: THREE.ShaderMaterial; centre: THREE.Vector3; range: number }[] = [];
  let rand = 90215; const rnd = () => ((rand = (rand * 16807) % 2147483647) / 2147483647);
  for (const e of emitters) {
    const geo = new THREE.BufferGeometry(), pos = new Float32Array(e.count * 3), seed = new Float32Array(e.count * 4);
    for (let i = 0; i < e.count; i++) { pos.set([OX2 + s * e.at[0], e.at[1], OZ2 + s * e.at[2]], i * 3); seed.set([rnd(), rnd(), rnd(), rnd()], i * 4); }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('seed', new THREE.BufferAttribute(seed, 4));
    const r = Math.max(...e.spread) + e.height + 4; geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(OX2 + s * e.at[0], e.at[1] + e.height / 2, OZ2 + s * e.at[2]), r);
    const smoke = e.mode === 'smoke', mode = { rise: 0, smoke: 1, drift: 2, haze: 3 }[e.mode];
    const material = new THREE.ShaderMaterial({
      name: `${name}_${e.id}`, vertexShader: vertex, fragmentShader: fragment, transparent: true, depthWrite: false,
      blending: smoke ? THREE.NormalBlending : THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uSpeed: { value: e.speed }, uHeight: { value: e.height }, uSize: { value: e.size }, uMode: { value: mode }, uSpread: { value: new THREE.Vector3(...e.spread) }, uColor: { value: new THREE.Color(e.color) }, uOpacity: { value: e.opacity }, uSoft: { value: smoke ? 1 : 0 } },
    });
    const points = new THREE.Points(geo, material); points.name = `${name}_${e.id}`; points.frustumCulled = true; points.renderOrder = 3; points.userData.dynamic = true;
    root.add(points); systems.push({ points, material, centre: geo.boundingSphere.center.clone(), range: e.range });
  }
  let time = 0, disposed = false;
  return {
    root, systems,
    update(dt: number, viewer: { x: number; y: number; z: number }) {
      if (disposed) return; time += Math.min(dt, .1);
      for (const s of systems) {
        const near = Math.hypot(viewer.x - s.centre.x, viewer.z - s.centre.z) < s.range;
        s.points.visible = near; if (near) s.material.uniforms.uTime.value = time;
      }
    },
    dispose() { if (disposed) return; disposed = true; root.removeFromParent(); for (const s of systems) { s.points.geometry.dispose(); s.material.dispose(); } },
  };
}

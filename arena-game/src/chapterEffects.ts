import * as THREE from 'three';
import type { MapPresentation } from '../shared/map.ts';

/** Fixed world-space light dressing authored in a map's `presentation` block:
 * flickering flame/lamp halos, warm light pools on the ground, embers rising from
 * fires, slow smoke columns and drifting fields (fireflies, pollen, diamond dust).
 * Decorative only: nothing here affects collision, hit-scan or visibility rules.
 * One draw per layer (glows, pools, embers, smoke, field), no dynamic lights, no
 * per-frame allocations, deterministic seeds so captures are reproducible.
 */
export const CHAPTER_EFFECT_BUDGET = {
  high: { embersPerFire: 18, smokePerColumn: 9, field: 1 },
  low: { embersPerFire: 6, smokePerColumn: 4, field: 0.35 },
} as const;

const VERT = /* glsl */ `
  attribute float aSize;
  attribute vec4 aColor;
  uniform float uScale;
  varying vec4 vColor;
  varying float vDepth;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vColor = aColor;
    vDepth = -mv.z;
    gl_PointSize = aSize * uScale / max(0.1, -mv.z);
    gl_Position = projectionMatrix * mv;
  }`;
const FRAG = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;
  uniform float uAdditive;
  varying vec4 vColor;
  varying float vDepth;
  void main() {
    float a = texture2D(uMap, gl_PointCoord).a * vColor.a;
    if (a < 0.004) discard;
    float fog = smoothstep(uFogNear, uFogFar, vDepth);
    // Additive halos dim in fog but keep a third of their light, so distant fires and
    // lit windows still read through haze; normal-blended smoke takes the fog colour.
    vec3 c = mix(vColor.rgb, uFogColor, fog * (1.0 - uAdditive));
    gl_FragColor = vec4(c, a * (1.0 - fog * 0.65 * uAdditive));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

type Layer = {
  points: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  pos: THREE.BufferAttribute; size: THREE.BufferAttribute; color: THREE.BufferAttribute;
};

function rand(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

const linear = (hex: string | number) => new THREE.Color(hex as THREE.ColorRepresentation);

export class ChapterEffects {
  readonly root = new THREE.Group();
  private readonly layers: Layer[] = [];
  private readonly glow: Layer | null;
  private readonly embers: Layer | null;
  private readonly smoke: Layer | null;
  private readonly field: Layer | null;
  private readonly pools: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> | null;
  private readonly poolTex: THREE.Texture | null;
  private readonly glowBase: Float32Array;
  private readonly emberSeed: Float32Array;
  private readonly smokeSeed: Float32Array;
  private readonly fieldSeed: Float32Array;
  private readonly fieldKind: string;
  private readonly smokePer: number;
  private time = 0;
  private disposed = false;

  constructor(p: MapPresentation, texture: THREE.Texture, quality: 'high' | 'low') {
    this.root.name = 'CHAPTER_light_dressing';
    const budget = CHAPTER_EFFECT_BUDGET[quality];
    const r = rand(0x5eed1e);

    const glows = p.glows ?? [];
    this.glowBase = new Float32Array(glows.length * 2);
    this.glow = glows.length ? this.layer('CHAPTER_glows', glows.length, texture, true) : null;
    glows.forEach(([x, y, z, size, color, flicker], i) => {
      this.glow!.pos.setXYZ(i, x, y, z);
      const c = linear(color);
      this.glow!.color.setXYZW(i, c.r, c.g, c.b, 1);
      this.glowBase[i * 2] = size;
      this.glowBase[i * 2 + 1] = flicker ?? 0;
    });

    const pools = p.pools ?? [];
    if (pools.length) {
      // Flat additive discs a few millimetres above the surface: the warm light a
      // brazier or window would throw, without a real per-pixel light on every material.
      this.poolTex = radialTexture();
      const pos: number[] = [], uv: number[] = [], col: number[] = [], idx: number[] = [];
      pools.forEach(([x, y, z, radius, color, strength], i) => {
        const c = linear(color).multiplyScalar(strength ?? 1);
        for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
          pos.push(x + (u - .5) * 2 * radius, y + .012, z + (v - .5) * 2 * radius);
          uv.push(u, v); col.push(c.r, c.g, c.b);
        }
        idx.push(i * 4, i * 4 + 2, i * 4 + 1, i * 4, i * 4 + 3, i * 4 + 2);
      });
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      g.setIndex(idx);
      const m = new THREE.MeshBasicMaterial({ map: this.poolTex, vertexColors: true, transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, fog: true });
      this.pools = new THREE.Mesh(g, m);
      this.pools.name = 'CHAPTER_light_pools';
      this.pools.renderOrder = 2;
      this.root.add(this.pools);
    } else { this.pools = null; this.poolTex = null; }

    const fires = p.embers ?? [];
    const per = budget.embersPerFire;
    this.emberSeed = new Float32Array(fires.length * per * 4);
    this.embers = fires.length ? this.layer('CHAPTER_embers', fires.length * per, texture, true) : null;
    fires.forEach(([x, y, z, radius], f) => {
      for (let j = 0; j < per; j++) {
        const k = (f * per + j) * 4;
        this.emberSeed.set([x + (r() - .5) * radius, y, z + (r() - .5) * radius, r()], k);
        this.embers!.color.setXYZW(f * per + j, 1, .55 + r() * .25, .18, 1);
      }
    });

    const columns = p.smoke ?? [];
    const sp = this.smokePer = budget.smokePerColumn;
    this.smokeSeed = new Float32Array(columns.length * sp * 4);
    this.smoke = columns.length ? this.layer('CHAPTER_smoke', columns.length * sp, texture, false) : null;
    columns.forEach(([x, y, z, scale, color], s) => {
      const c = linear(color ?? '#8a8580');
      for (let j = 0; j < sp; j++) {
        this.smokeSeed.set([x, y, z, scale], (s * sp + j) * 4);
        this.smoke!.color.setXYZW(s * sp + j, c.r, c.g, c.b, 0);
      }
    });

    const f = p.field;
    this.fieldKind = f?.kind ?? '';
    const n = f ? Math.round(f.count * budget.field) : 0;
    this.fieldSeed = new Float32Array(n * 4);
    this.field = n ? this.layer('CHAPTER_field', n, texture, true) : null;
    if (f && n) {
      const c = linear(f.color);
      for (let i = 0; i < n; i++) {
        this.fieldSeed.set([f.min[0] + r() * (f.max[0] - f.min[0]), f.min[1] + r() * (f.max[1] - f.min[1]), f.min[2] + r() * (f.max[2] - f.min[2]), r() * Math.PI * 2], i * 4);
        this.field!.color.setXYZW(i, c.r, c.g, c.b, 0);
        this.field!.size.setX(i, f.size * (.6 + r() * .8));
      }
    }
    this.update(0);
  }

  private layer(name: string, count: number, map: THREE.Texture, additive: boolean): Layer {
    const g = new THREE.BufferGeometry();
    const pos = new THREE.BufferAttribute(new Float32Array(count * 3), 3).setUsage(THREE.DynamicDrawUsage);
    const size = new THREE.BufferAttribute(new Float32Array(count), 1).setUsage(THREE.DynamicDrawUsage);
    const color = new THREE.BufferAttribute(new Float32Array(count * 4), 4).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', pos); g.setAttribute('aSize', size); g.setAttribute('aColor', color);
    const m = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { uMap: { value: map }, uScale: { value: 400 }, uFogColor: { value: new THREE.Color() }, uFogNear: { value: 80 }, uFogFar: { value: 220 }, uAdditive: { value: additive ? 1 : 0 } },
    });
    const points = new THREE.Points(g, m);
    points.name = name;
    points.frustumCulled = false; // fixed small layers; positions move every frame
    points.renderOrder = additive ? 3 : 1;
    this.root.add(points);
    const layer = { points, pos, size, color };
    this.layers.push(layer);
    return layer;
  }

  /** Keep point sizes in world metres for the current camera and fog. */
  sync(camera: THREE.PerspectiveCamera, viewHeight: number, fog: THREE.Fog | null) {
    const scale = viewHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    for (const l of this.layers) {
      const u = l.points.material.uniforms;
      u.uScale.value = scale;
      if (fog) { (u.uFogColor.value as THREE.Color).copy(fog.color); u.uFogNear.value = fog.near; u.uFogFar.value = fog.far; }
    }
  }

  update(dt: number) {
    if (this.disposed) return;
    if (Number.isFinite(dt) && dt > 0) this.time += Math.min(dt, 0.1);
    const t = this.time;
    if (this.glow) {
      for (let i = 0; i < this.glowBase.length / 2; i++) {
        const fl = this.glowBase[i * 2 + 1];
        // Two incommensurate sines per flame read as live fire, not a strobing beacon.
        const wobble = 1 - fl * (.5 + .25 * Math.sin(t * 7.3 + i * 2.1) + .25 * Math.sin(t * 12.9 + i * 5.7)) * .5;
        this.glow.size.setX(i, this.glowBase[i * 2] * wobble);
      }
      this.glow.size.needsUpdate = true;
    }
    if (this.pools) this.pools.material.opacity = .9 + .1 * Math.sin(t * 6.1) * Math.sin(t * 2.3);
    if (this.embers) {
      const life = 2.4;
      for (let i = 0; i < this.emberSeed.length / 4; i++) {
        const k = i * 4, ph = this.emberSeed[k + 3];
        const a = ((t / life + ph) % 1);
        this.embers.pos.setXYZ(i,
          this.emberSeed[k] + Math.sin(t * 1.7 + ph * 40) * .25 * a,
          this.emberSeed[k + 1] + a * 2.6,
          this.emberSeed[k + 2] + Math.cos(t * 1.3 + ph * 30) * .25 * a);
        this.embers.size.setX(i, .07 * (1 - a * .6));
        this.embers.color.setW(i, Math.min(1, a * 8) * (1 - a));
      }
      this.embers.pos.needsUpdate = this.embers.size.needsUpdate = this.embers.color.needsUpdate = true;
    }
    if (this.smoke) {
      const per = this.smokePer;
      for (let i = 0; i < this.smokeSeed.length / 4; i++) {
        const k = i * 4, scale = this.smokeSeed[k + 3];
        const a = ((t / 14 + (i % per) / per) % 1);
        this.smoke.pos.setXYZ(i, this.smokeSeed[k] + a * a * 6 * scale, this.smokeSeed[k + 1] + a * 16 * scale, this.smokeSeed[k + 2] + a * 2 * scale);
        this.smoke.size.setX(i, scale * (2 + a * 7));
        this.smoke.color.setW(i, .38 * Math.min(1, a * 5) * (1 - a));
      }
      this.smoke.pos.needsUpdate = this.smoke.size.needsUpdate = this.smoke.color.needsUpdate = true;
    }
    if (this.field) {
      const fireflies = this.fieldKind === 'fireflies';
      for (let i = 0; i < this.fieldSeed.length / 4; i++) {
        const k = i * 4, ph = this.fieldSeed[k + 3];
        this.field.pos.setXYZ(i,
          this.fieldSeed[k] + Math.sin(t * .23 + ph) * 1.6,
          this.fieldSeed[k + 1] + Math.sin(t * .41 + ph * 2) * (fireflies ? .5 : .25),
          this.fieldSeed[k + 2] + Math.cos(t * .19 + ph * 3) * 1.6);
        // Fireflies pulse softly; diamond dust twinkles only when it catches the sun.
        const pulse = fireflies ? .5 + .5 * Math.sin(t * 1.9 + ph * 7) : this.fieldKind === 'pollen' ? .55 : Math.max(0, Math.sin(t * 2.7 + ph * 11)) ** 6;
        this.field.color.setW(i, fireflies ? .25 + .75 * pulse : pulse);
      }
      this.field.pos.needsUpdate = this.field.color.needsUpdate = true;
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    for (const l of this.layers) { l.points.geometry.dispose(); l.points.material.dispose(); }
    this.pools?.geometry.dispose(); this.pools?.material.dispose(); this.poolTex?.dispose();
    this.root.clear();
    // The shared glow texture belongs to ArenaScene and is retained.
  }
}

function radialTexture(): THREE.Texture {
  // Built from bytes (no canvas) so the effect layer also runs in tests and workers.
  const n = 64, data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const r = Math.min(1, Math.hypot(x + .5 - n / 2, y + .5 - n / 2) / (n / 2));
    const a = r < .35 ? .55 - (.27 * r) / .35 : .28 * (1 - (r - .35) / .65);
    data.set([255, 255, 255, Math.round(255 * Math.max(0, a))], (y * n + x) * 4);
  }
  const t = new THREE.DataTexture(data, n, n);
  t.needsUpdate = true;
  return t;
}

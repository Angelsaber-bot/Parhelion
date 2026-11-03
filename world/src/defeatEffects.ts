import * as THREE from 'three';
import type { Point3 } from './combat';
/**
 * Defeat dissolve: a beaten enemy used to blink out of existence. Now the body breaks into motes of
 * light that rise and scatter while a ring of sparks runs out along the ground — the same "return
 * to the halo" read for every foe, tinted gold for troops, in the elite's own glow for elites, and
 * larger for chapter bosses.
 *
 * Fixed capacity, one point cloud, one draw call. Motion is computed in the vertex shader from each
 * mote's birth time, so the CPU only writes a slot when something dies. Presentation only.
 */
export const DEFEAT_FX = Object.freeze({ slots: 8, motes: 56, ring: 24, life: 1.15, reducedMotes: 20 });

const PER = DEFEAT_FX.motes + DEFEAT_FX.ring;

export class DefeatEffects {
  readonly points: THREE.Points;
  private readonly start: Float32Array; private readonly vel: Float32Array; private readonly birth: Float32Array; private readonly color: Float32Array; private readonly size: Float32Array;
  private readonly uniforms = { uTime: { value: 0 }, uScale: { value: 400 } };
  private cursor = 0; private time = 0; private disposed = false; private seed = 1;
  constructor(parent: THREE.Object3D) {
    const n = DEFEAT_FX.slots * PER, g = new THREE.BufferGeometry();
    this.start = new Float32Array(n * 3); this.vel = new Float32Array(n * 3); this.birth = new Float32Array(n).fill(-100); this.color = new Float32Array(n * 3); this.size = new Float32Array(n);
    g.setAttribute('position', new THREE.BufferAttribute(this.start, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aVel', new THREE.BufferAttribute(this.vel, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aBirth', new THREE.BufferAttribute(this.birth, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.color, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    const material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: this.uniforms,
      vertexShader: /* glsl */ `
        uniform float uTime, uScale; attribute vec3 aVel; attribute float aBirth; attribute vec3 aColor; attribute float aSize;
        varying vec3 vColor; varying float vFade;
        void main() {
          float t = uTime - aBirth, life = ${DEFEAT_FX.life.toFixed(2)};
          float k = clamp(t / life, 0.0, 1.0);
          // Rise with a little drag: fast at first, settling as the mote fades.
          vec3 p = position + aVel * (t - 0.35 * t * t / life);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          vFade = (t < 0.0 || t > life) ? 0.0 : (1.0 - k) * smoothstep(0.0, 0.06, t);
          vColor = aColor;
          gl_PointSize = vFade > 0.0 ? aSize * (1.0 - 0.45 * k) * uScale / -mv.z : 0.0;
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vColor; varying float vFade;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = (smoothstep(0.5, 0.0, d) * 0.7 + smoothstep(0.16, 0.0, d)) * vFade;
          if (a < 0.02) discard;
          gl_FragColor = vec4(vColor * (1.0 + smoothstep(0.16, 0.0, d)), a);
        }`,
    });
    this.points = new THREE.Points(g, material); this.points.name = 'DefeatEffects'; this.points.frustumCulled = false;
    parent.add(this.points);
  }
  private rand() { this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0; return this.seed / 4294967296; }
  /** One body breaking into light at `p` (feet). Returns the slot used, or -1. */
  emit(p: Point3, hex: number, scale = 1, reduced = false): number {
    if (this.disposed || ![p.x, p.y, p.z, scale].every(Number.isFinite) || scale <= 0) return -1;
    const slot = this.cursor++ % DEFEAT_FX.slots, base = slot * PER, c = new THREE.Color(hex), white = new THREE.Color(0xfff6dc);
    const motes = reduced ? DEFEAT_FX.reducedMotes : DEFEAT_FX.motes;
    for (let i = 0; i < PER; i++) {
      const j = base + i, ring = i >= DEFEAT_FX.motes, live = ring || i < motes;
      const a = this.rand() * Math.PI * 2;
      if (ring) {
        const ra = (i - DEFEAT_FX.motes) / DEFEAT_FX.ring * Math.PI * 2;
        this.start.set([p.x + Math.cos(ra) * .3 * scale, p.y + .12, p.z + Math.sin(ra) * .3 * scale], j * 3);
        this.vel.set([Math.cos(ra) * 3.4 * scale, .15, Math.sin(ra) * 3.4 * scale], j * 3);
        this.size[j] = .11 * scale;
      } else {
        const r = Math.sqrt(this.rand()) * .32 * scale, h = (.15 + this.rand() * 1.65) * scale;
        this.start.set([p.x + Math.cos(a) * r, p.y + h, p.z + Math.sin(a) * r], j * 3);
        this.vel.set([Math.cos(a) * (.4 + this.rand()) * scale, (.9 + this.rand() * 1.6) * scale, Math.sin(a) * (.4 + this.rand()) * scale], j * 3);
        this.size[j] = (.07 + this.rand() * .09) * scale;
      }
      const tint = c.clone().lerp(white, ring ? .15 : this.rand() * .55);
      this.color.set([tint.r, tint.g, tint.b], j * 3);
      this.birth[j] = live ? this.time + (ring ? 0 : this.rand() * .12) : -100;
    }
    const g = this.points.geometry;
    for (const name of ['position', 'aVel', 'aBirth', 'aColor', 'aSize']) {
      const attr = g.getAttribute(name) as THREE.BufferAttribute, size = attr.itemSize;
      attr.clearUpdateRanges(); attr.addUpdateRange(base * size, PER * size); attr.needsUpdate = true;
    }
    return slot;
  }
  /** Seconds since the slot's mote burst started (for tests); Infinity when idle. */
  age(slot: number) { const b = this.birth[slot * PER + DEFEAT_FX.motes]; return b < -50 ? Infinity : this.time - b; }
  update(dt: number, pixels?: number) {
    if (this.disposed) return;
    if (Number.isFinite(dt) && dt > 0) this.time += Math.min(dt, .1);
    this.uniforms.uTime.value = this.time;
    if (pixels && Number.isFinite(pixels)) this.uniforms.uScale.value = pixels * .5;
  }
  clear() { this.birth.fill(-100); (this.points.geometry.getAttribute('aBirth') as THREE.BufferAttribute).needsUpdate = true; }
  dispose() { if (this.disposed) return; this.disposed = true; this.points.geometry.dispose(); (this.points.material as THREE.Material).dispose(); this.points.removeFromParent(); }
}

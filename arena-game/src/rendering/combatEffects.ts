import * as THREE from 'three';
import type {SkinEffect,ParticleShape} from '../cosmetics/skinEffects.ts';
import type { Vec3 } from '../../shared/map';

/** Presentation ceilings, not gameplay limits. A full twenty-pellet burst can
 * request 20 tracers + 140 sparks. Saturation replaces the oldest same-kind cosmetic;
 * authoritative events, hit indicators and damage are never filtered here. */
export const ARENA_EFFECT_BUDGET = {
  high: { tracers: 96, sparks: 384, numbers: 48 },
  low: { tracers: 48, sparks: 192, numbers: 32 },
} as const;
export interface NumberSurface { texture: THREE.Texture; paint(value: number, head: boolean, kill: boolean): void; }
export function createNumberSurface(): NumberSurface {
  const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 64;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Damage-number canvas unavailable');
  const texture = new THREE.CanvasTexture(canvas);
  return { texture, paint(value, head, kill) {
    context.clearRect(0, 0, 128, 64);
    context.font = `900 ${head || kill ? 46 : 38}px sans-serif`; context.textAlign = 'center';
    context.lineWidth = 6; context.strokeStyle = '#1a1030';
    context.fillStyle = kill ? '#ff5d7a' : head ? '#ffd34d' : '#ffffff';
    const text = String(Math.round(value)); context.strokeText(text, 64, 48); context.fillText(text, 64, 48);
    texture.needsUpdate = true;
  } };
}
type Life = { life: number; order: number };
type Tracer = Life & { line: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>; max: number };
type Spark = Life & { sprite: THREE.Sprite; max: number; grow: number; moving: boolean; velocity: THREE.Vector3; aspect:number; spin:number; gravity:number };
type DamageLabel = Life & { sprite: THREE.Sprite; vy: number; surface: NumberSurface; key: string };
const finitePoint = (point: Vec3) => point.length === 3 && point.every(Number.isFinite);

/** Lazy pools reuse resources across rounds. Inactive objects are detached from
 * the scene, not traversed every frame. Each damage slot exclusively owns its
 * canvas/texture: recycling cannot invalidate another active label's texture. */
export class ArenaCombatEffects {
  private tracers: Tracer[] = [];
  private sparks: Spark[] = [];
  private numbers: DamageLabel[] = [];
  private sequence = 0;
  private disposed = false;
  private recycled = { tracers: 0, sparks: 0, numbers: 0 };
  readonly budget: { readonly tracers: number; readonly sparks: number; readonly numbers: number };
  constructor(private parent: THREE.Object3D, private glow: THREE.Texture, quality: 'high' | 'low' = 'high', private numberSurface = createNumberSurface) {
    this.budget = ARENA_EFFECT_BUDGET[quality];
  }
  private acquire<T extends Life>(slots: T[], cap: number, create: () => T, kind: keyof typeof this.recycled): T {
    let slot = slots.find(value => value.life <= 0);
    if (!slot && slots.length < cap) { slot = create(); slots.push(slot); }
    if (!slot) { slot = slots.reduce((oldest, value) => value.order < oldest.order ? value : oldest); this.recycled[kind]++; }
    slot.order = ++this.sequence; return slot;
  }
  tracer(from: Vec3, to: Vec3, color: number, width = 1, style?:SkinEffect) {
    if (this.disposed || !finitePoint(from) || !finitePoint(to) || !Number.isFinite(width)) return;
    const slot = this.acquire(this.tracers, this.budget.tracers, () => {
      const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      const material = new THREE.LineBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
      const line = new THREE.Line(geometry, material); line.name = 'Arena pooled tracer';
      return { line, life: 0, max: .09, order: 0 };
    }, 'tracers');
    const position = slot.line.geometry.getAttribute('position') as THREE.BufferAttribute;
    // One pooled two-point segment. No per-shot vector objects or trigonometric coils.
    position.setXYZ(0,...from);position.setXYZ(1,...to);
    for(let i=2;i<position.count;i++)position.setXYZ(i,...to);
    slot.line.geometry.setDrawRange(0,2);position.needsUpdate=true;
    slot.max=.055;
    slot.line.geometry.computeBoundingSphere();
    slot.line.material.color.setHex(color); slot.line.material.opacity = .9 * width;
    slot.life = slot.max; this.parent.add(slot.line);
    if (style) this.tracerAccent(from, to, style);
  }
  /** Skin identity on the shot, placed only along the first metres from the muzzle so
   * the aim point and the target stay clear: wave, pulse, fork or a pair of glints. */
  private tracerAccent(from: Vec3, to: Vec3, style: SkinEffect) {
    const d = new THREE.Vector3(to[0] - from[0], to[1] - from[1], to[2] - from[2]), length = d.length();
    if (length < .5) return; d.divideScalar(length);
    const side = new THREE.Vector3(0, 1, 0).cross(d); if (side.lengthSq() < 1e-6) side.set(1, 0, 0); side.normalize();
    const up = d.clone().cross(side).normalize(), reach = Math.min(3, length * .3);
    const count = style.trail === 'wave' ? 6 : style.trail === 'pulse' ? 3 : style.trail === 'fork' ? 4 : 2;
    for (let i = 0; i < count; i++) {
      const t = (i + 1) / (count + 1), along = reach * t, p = new THREE.Vector3(...from).addScaledVector(d, along);
      if (style.trail === 'wave') p.addScaledVector(side, Math.sin(t * Math.PI * 3) * .05);
      if (style.trail === 'fork') p.addScaledVector(i % 2 ? side : up, (i % 2 ? .04 : -.04));
      const size = style.trail === 'pulse' ? .09 : .045;
      this.burst([p.x, p.y, p.z], i % 2 ? style.secondary : style.color, size, style.trail === 'pulse' ? .1 : .12, style.trail === 'fork' ? .6 : 0, style.particle, style.trail === 'fork' ? [side.x, side.y, side.z] : undefined, 0);
    }
  }
  burst(at: Vec3, color: number, size: number, life: number, speed: number, shape?:ParticleShape, dir?:Vec3, gravity?:number) {
    if (this.disposed || !finitePoint(at) || ![size, life, speed].every(Number.isFinite) || life <= 0) return;
    const slot = this.acquire(this.sparks, this.budget.sparks, () => {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glow, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      sprite.material.onBeforeCompile=shader=>{
        shader.uniforms.phParticleShape={value:0};sprite.material.userData.shapeUniform=shader.uniforms.phParticleShape;
        shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float phParticleShape;');
        shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
         vec2 q=vMapUv*2.0-1.0;float shape=phParticleShape;float r=length(q);
         if(shape>.5){float mask=1.0;
          if(shape<1.5)mask=1.0-smoothstep(.65,.95,abs(q.x)+abs(q.y));
          else if(shape<2.5)mask=smoothstep(.38,.50,r)*(1.0-smoothstep(.68,.86,r));
          else if(shape<3.5)mask=1.0-smoothstep(.65,.80,max(abs(q.x),abs(q.y)));
          else if(shape<4.5)mask=1.0-smoothstep(.65,.95,length(vec2(q.x,q.y*1.9)));
          else mask=1.0-smoothstep(.10,.23,min(abs(q.x),abs(q.y)));
          diffuseColor=vec4(diffuseColor.rgb,opacity*mask);
         }`);
      };
      sprite.material.customProgramCacheKey=()=> 'arena-skin-particles-v1';
      sprite.name = 'Arena pooled impact'; return { sprite, aspect:1,spin:0,gravity:9, life: 0, max: 0, grow: 0, moving: false, velocity: new THREE.Vector3(), order: 0 };
    }, 'sparks');
    const index=shape?{ember:0,crystal:1,ring:2,pixel:3,petal:4,star:5}[shape]:0;
    slot.sprite.material.userData.shapeIndex=index;
    const uniform=slot.sprite.material.userData.shapeUniform;if(uniform)uniform.value=index;
    // Set on every draw too: the first pooled draw may compile after this call.
    slot.sprite.onBeforeRender=()=>{const u=slot.sprite.material.userData.shapeUniform;if(u)u.value=slot.sprite.material.userData.shapeIndex;};
    slot.aspect=shape==='ember'?.35:shape==='petal'?1.6:1;
    slot.spin=shape==='pixel'?0:shape==='petal'?2.5:shape==='crystal'?1.2:0;
    slot.gravity=shape==='ring'?-.5:shape==='petal'?1.5:9;
    slot.sprite.material.rotation=shape==='crystal'?Math.PI/4:0;
    slot.sprite.position.set(...at); slot.sprite.scale.set(size*.4*slot.aspect,size*.4,1);
    slot.sprite.material.color.setHex(color); slot.sprite.material.opacity = 1;
    slot.life = slot.max = life; slot.grow = size * (speed ? .2 : 2.4); slot.moving = !!speed;
    if (speed&&dir) { slot.velocity.set(Math.random() - .5, Math.random() - .5, Math.random() - .5).multiplyScalar(.7).add(new THREE.Vector3(...dir)).normalize().multiplyScalar(speed); }
    else if (speed) slot.velocity.set(Math.random() - .5, Math.random() * .8 + .2, Math.random() - .5).normalize().multiplyScalar(speed);
    else slot.velocity.set(0, 0, 0);
    if (gravity !== undefined) slot.gravity = gravity;
    this.parent.add(slot.sprite);
  }
  damageNumber(at: Vec3, value: number, head: boolean, kill: boolean) {
    if (this.disposed || !finitePoint(at) || !Number.isFinite(value)) return;
    let slot: DamageLabel | undefined;
    try {
      slot = this.acquire(this.numbers, this.budget.numbers, () => {
        const surface = this.numberSurface();
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: surface.texture, depthTest: false, transparent: true }));
        sprite.name = 'Arena pooled damage label'; sprite.renderOrder = 20;
        return { sprite, surface, life: 0, vy: 0, key: '', order: 0 };
      }, 'numbers');
      const key = `${Math.round(value)}:${head ? 1 : 0}:${kill ? 1 : 0}`;
      if (slot.key !== key) { slot.surface.paint(value, head, kill); slot.key = key; }
    } catch {
      // Missing canvas support must not turn an authoritative hit into a client failure.
      if (slot) { slot.life = 0; slot.sprite.removeFromParent(); }
      return;
    }
    slot.sprite.position.set(at[0] + (Math.random() - .5) * .5, at[1], at[2] + (Math.random() - .5) * .5);
    slot.sprite.scale.set(.9, .45, 1); slot.sprite.material.opacity = 1; slot.life = .8; slot.vy = 1.6;
    this.parent.add(slot.sprite);
  }
  update(dt: number) {
    if (this.disposed || !Number.isFinite(dt) || dt <= 0) return;
    for (const slot of this.tracers) if (slot.life > 0) {
      slot.life -= dt; slot.line.material.opacity = Math.max(0, slot.life / slot.max) * .9;
      if (slot.life <= 0) slot.line.removeFromParent();
    }
    for (const slot of this.sparks) if (slot.life > 0) {
      slot.life -= dt;
      if (slot.moving) { slot.velocity.y -= slot.gravity * dt; slot.sprite.position.addScaledVector(slot.velocity, dt); }
      const size=Math.max(.01,slot.sprite.scale.y+slot.grow*dt);slot.sprite.scale.set(size*slot.aspect,size,1);slot.sprite.material.rotation+=slot.spin*dt;
      slot.sprite.material.opacity = Math.max(0, slot.life / slot.max);
      if (slot.life <= 0) slot.sprite.removeFromParent();
    }
    for (const slot of this.numbers) if (slot.life > 0) {
      slot.life -= dt; slot.vy -= 3 * dt; slot.sprite.position.y += slot.vy * dt;
      slot.sprite.material.opacity = Math.min(1, slot.life / .3);
      const pop = 1 + Math.max(0, slot.life - .65) * 4; slot.sprite.scale.set(.9 * pop, .45 * pop, 1);
      if (slot.life <= 0) slot.sprite.removeFromParent();
    }
  }
  clear() {
    for (const slot of this.tracers) { slot.life = 0; slot.line.removeFromParent(); }
    for (const slot of this.sparks) { slot.life = 0; slot.sprite.removeFromParent(); }
    for (const slot of this.numbers) { slot.life = 0; slot.sprite.removeFromParent(); }
  }
  get inventory() {
    return { allocated: { tracers: this.tracers.length, sparks: this.sparks.length, numbers: this.numbers.length },
      active: { tracers: this.tracers.filter(slot => slot.life > 0).length, sparks: this.sparks.filter(slot => slot.life > 0).length, numbers: this.numbers.filter(slot => slot.life > 0).length }, recycled: { ...this.recycled }, disposed: this.disposed };
  }
  dispose() {
    if (this.disposed) return; this.clear(); this.disposed = true;
    for (const slot of this.tracers) { slot.line.geometry.dispose(); slot.line.material.dispose(); }
    // Sprite geometry and glow texture are borrowed; never dispose either here.
    for (const slot of this.sparks) slot.sprite.material.dispose();
    for (const slot of this.numbers) { slot.sprite.material.dispose(); slot.surface.texture.dispose(); }
    this.tracers.length = this.sparks.length = this.numbers.length = 0;
  }
}

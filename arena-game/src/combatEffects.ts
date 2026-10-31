import * as THREE from 'three';
import type { Vec3 } from '../shared/map';

/** Presentation ceilings, not gameplay limits. Normal 9-pellet bursts measured
 * 9 tracers + 63 sparks. Saturation replaces the oldest same-kind cosmetic;
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
type Spark = Life & { sprite: THREE.Sprite; max: number; grow: number; moving: boolean; velocity: THREE.Vector3 };
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
  tracer(from: Vec3, to: Vec3, color: number, width = 1) {
    if (this.disposed || !finitePoint(from) || !finitePoint(to) || !Number.isFinite(width)) return;
    const slot = this.acquire(this.tracers, this.budget.tracers, () => {
      const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      const material = new THREE.LineBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
      const line = new THREE.Line(geometry, material); line.name = 'Arena pooled tracer';
      return { line, life: 0, max: .09, order: 0 };
    }, 'tracers');
    const position = slot.line.geometry.getAttribute('position') as THREE.BufferAttribute;
    position.setXYZ(0, ...from); position.setXYZ(1, ...to); position.needsUpdate = true;
    // Reused geometry must not retain a previous shot's culling bounds.
    slot.line.geometry.computeBoundingSphere();
    slot.line.material.color.setHex(color); slot.line.material.opacity = .9 * width;
    slot.life = slot.max; this.parent.add(slot.line);
  }
  burst(at: Vec3, color: number, size: number, life: number, speed: number) {
    if (this.disposed || !finitePoint(at) || ![size, life, speed].every(Number.isFinite) || life <= 0) return;
    const slot = this.acquire(this.sparks, this.budget.sparks, () => {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glow, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      sprite.name = 'Arena pooled impact'; return { sprite, life: 0, max: 0, grow: 0, moving: false, velocity: new THREE.Vector3(), order: 0 };
    }, 'sparks');
    slot.sprite.position.set(...at); slot.sprite.scale.setScalar(size * .4);
    slot.sprite.material.color.setHex(color); slot.sprite.material.opacity = 1;
    slot.life = slot.max = life; slot.grow = size * (speed ? .2 : 2.4); slot.moving = !!speed;
    if (speed) slot.velocity.set(Math.random() - .5, Math.random() * .8 + .2, Math.random() - .5).normalize().multiplyScalar(speed);
    else slot.velocity.set(0, 0, 0);
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
      if (slot.moving) { slot.velocity.y -= 9 * dt; slot.sprite.position.addScaledVector(slot.velocity, dt); }
      slot.sprite.scale.setScalar(Math.max(.01, slot.sprite.scale.x + slot.grow * dt));
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

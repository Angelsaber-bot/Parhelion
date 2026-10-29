import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { regionAt } from './regions';
import { enemyAttackTiming, isMusketeer, type Enemy, type EnemyMode } from './combat';

export type EnemyModel = 'samurai' | 'ashigaru' | 'musketeer' | 'officer' | 'sunward_guard' | 'deck_raider';
export const ENEMY_VISUAL_BUDGET = 24;
/** Stable appearance: moving across an era seam must never change an enemy's uniform. */
export function enemyModel(e: Pick<Enemy, 'id' | 'home' | 'kind'> & { miniboss?: string }): EnemyModel | null {
  if (e.kind === 'king') return null;
  const region = regionAt(e.home.x, e.home.z).id;
  const variant = [...e.id].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 0) % 3;
  if (region === 'kyoto') return e.miniboss || variant === 0 ? 'samurai' : 'ashigaru';
  if (region === 'winter') return isMusketeer(e as Enemy) ? 'musketeer' : 'officer';
  return region === 'britain' ? 'sunward_guard' : region === 'blacksail' ? 'deck_raider' : null;
}
/** These are pose demonstrations, not authored contact events. Never generate damage here.
 * Run is airborne; Death isn't supported; FirePreview is only mapped to the simulation-backed musket shot. */
export function enemyClip(model: EnemyModel, mode: EnemyMode, available: readonly string[]) {
  const requested = mode === 'chase' ? 'Walk' : mode === 'windup' ? (model === 'musketeer' ? 'Aim' : 'Attack_Windup')
    : mode === 'recover' ? (model === 'musketeer' ? 'FirePreview' : 'Attack') : 'Idle';
  return available.includes(requested) ? requested : available.includes('Idle') ? 'Idle' : available[0];
}
function disposeTemplate(gltf: GLTF) {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
  gltf.scene.traverse(o => {
    if (!(o instanceof THREE.Mesh)) return;
    geometries.add(o.geometry);
    for (const m of [o.material].flat()) {
      materials.add(m);
      for (const v of Object.values(m)) if (v instanceof THREE.Texture) textures.add(v);
    }
    if (o instanceof THREE.SkinnedMesh) o.skeleton.dispose();
  });
  geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => { t.dispose(); const image = t.source.data as { close?: () => void } | undefined; if (typeof image?.close === 'function') image.close(); });
}
interface Instance { root: THREE.Object3D; mixer: THREE.AnimationMixer; gltf: GLTF; key: string; state: string; action?: THREE.AnimationAction }
/** Cache lifetime is one world. Templates own geometry/materials/textures; clones own skeletons.
 * Requests are lazy, cached (including failures), nonblocking, and safe after world disposal. */
export class EnemyVisuals {
  private loader = new GLTFLoader();
  private cache = new Map<string, GLTF | null>();
  private pending = new Set<string>();
  private instances = new Map<string, Instance>();
  private disposed = false;
  get activeMixers() { return this.instances.size; }
  get diagnostics() { return { activeMixers: this.instances.size, loaded: [...this.cache.values()].filter(Boolean).length, failed: [...this.cache.values()].filter(v => !v).length, pending: this.pending.size }; }
  private request(key: string) {
    if (this.cache.has(key) || this.pending.has(key) || this.disposed) return;
    this.pending.add(key);
    this.loader.load(`${import.meta.env?.BASE_URL ?? '/'}assets/enemies/${key}.glb`, gltf => {
      this.pending.delete(key);
      if (this.disposed) { disposeTemplate(gltf); return; }
      this.cache.set(key, gltf);
    }, undefined, () => { this.pending.delete(key); if (!this.disposed) this.cache.set(key, null); });
  }
  release(id: string) {
    const instance = this.instances.get(id); if (!instance) return;
    instance.mixer.stopAllAction(); instance.mixer.uncacheRoot(instance.root);
    instance.root.traverse(o => { if (o instanceof THREE.SkinnedMesh) o.skeleton.dispose(); });
    instance.root.removeFromParent(); this.instances.delete(id);
  }
  update(e: Enemy, model: EnemyModel, parent: THREE.Group, fallback: THREE.Group, dt: number, distance: number, allowed: boolean) {
    if (this.disposed) return false;
    if (!allowed || !e.active || e.mode === 'dead') { this.release(e.id); fallback.visible = true; return false; }
    const prior = this.instances.get(e.id);
    // Hysteresis prevents clone churn at the LOD boundary.
    const lod = distance > (prior?.key.endsWith('_lod1') ? 18 : 23);
    const key = model + (lod ? '_lod1' : '');
    this.request(key);
    const gltf = this.cache.get(key);
    let instance = prior;
    if (gltf && instance?.key !== key && (instance || this.instances.size < ENEMY_VISUAL_BUDGET)) {
      this.release(e.id);
      const root = clone(gltf.scene);
      root.traverse(o => {
        if (!(o instanceof THREE.Mesh)) return;
        o.receiveShadow = true;
        // Bounds are rig-dependent; the 82m root cull and 24-instance cap bound this work.
        if (o instanceof THREE.SkinnedMesh) o.frustumCulled = false;
      });
      parent.add(root);
      instance = { root, mixer: new THREE.AnimationMixer(root), gltf, key, state: '' };
      this.instances.set(e.id, instance);
    }
    fallback.visible = !instance;
    if (!instance) return false;
    instance.root.traverse(o => { if (o instanceof THREE.Mesh) o.castShadow = distance < 18; });
    const name = enemyClip(model, e.mode, instance.gltf.animations.map(c => c.name));
    const state = `${e.mode}:${e.attackCount}:${name}`;
    if (state !== instance.state) {
      instance.state = state;
      const clip = instance.gltf.animations.find(c => c.name === name);
      if (clip) {
        const action = instance.mixer.clipAction(clip);
        if (action !== instance.action) instance.action?.fadeOut(0.12);
        const once = e.mode === 'windup' || e.mode === 'recover';
        action.reset().setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
        action.clampWhenFinished = once;
        // Fit preview to simulation state duration; late loading seeks to remaining timer.
        const timing = enemyAttackTiming(e);
        const duration = e.mode === 'windup' ? timing.windup : e.mode === 'recover' ? timing.recovery : clip.duration;
        action.setEffectiveTimeScale(clip.duration / duration).setEffectiveWeight(1).fadeIn(0.12).play();
        if (once) action.time = Math.max(0, duration - e.timer) / duration * clip.duration;
        instance.action = action;
      }
    }
    instance.mixer.update(Math.min(dt, 0.1));
    return true;
  }
  dispose() {
    if (this.disposed) return; this.disposed = true;
    for (const id of this.instances.keys()) this.release(id);
    for (const gltf of this.cache.values()) if (gltf) disposeTemplate(gltf);
    this.cache.clear();
  }
}

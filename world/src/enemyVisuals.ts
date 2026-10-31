import { isEnemySkinnedMesh, isEnemyMesh, isEnemyTexture } from './enemyMeshTypes';
import * as THREE from 'three';
import {nativeMusketeerContactMuzzle,transformEnemyContactMuzzle} from './enemyShotSocket';
import {createEchoWardenVisual} from './echoWardenVisual';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { selectEnemyRole, type EnemyRole } from './enemyRoles';
import { regionAt } from './regions';
import { createEnemyAttackActing } from './enemyAttackActing';
import { enemyAttackPose } from './enemyAttackPresentation';
import { isMusketeer, type Enemy, type EnemyMode, type Point3 } from './combat';

export type EnemyModel = 'samurai' | 'ashigaru' | 'musketeer' | 'officer' | 'sunward_guard' | 'deck_raider';
export const ENEMY_VISUAL_BUDGET = 24;
/** Stable appearance: moving across an era seam must never change an enemy's uniform. */
export function enemyModel(e: Pick<Enemy, 'id' | 'home' | 'kind'> & { miniboss?: string; role?: EnemyRole; appearance?: EnemyModel }): EnemyModel | null {
  if (e.appearance) return e.appearance;
  if (e.kind === 'king') return ({ boss_vacant_king: 'sunward_guard', boss_drowned_admiral: 'deck_raider', boss_winter_warden: 'officer', boss_hellfire_lord: 'samurai' } as Record<string, EnemyModel>)[e.id] ?? 'sunward_guard';
  const region = regionAt(e.home.x, e.home.z).id;
  const role = e.role ?? selectEnemyRole(e);
  // Yari spear geometry belongs to the thrust role; sword duelists use the actual samurai kit.
  if (region === 'kyoto') return e.miniboss || role === 'duelist' || role === 'breaker' ? 'samurai' : 'ashigaru';
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
    if (!(isEnemyMesh(o))) return;
    geometries.add(o.geometry);
    for (const m of [o.material].flat()) {
      materials.add(m);
      for (const v of Object.values(m)) if (isEnemyTexture(v)) textures.add(v);
    }
    if (isEnemySkinnedMesh(o)) o.skeleton.dispose();
  });
  geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => { t.dispose(); const image = t.source.data as { close?: () => void } | undefined; if (typeof image?.close === 'function') image.close(); });
}
interface Instance { insignia?: ReturnType<typeof createEchoWardenVisual>; acting: ReturnType<typeof createEnemyAttackActing>; root: THREE.Object3D; mixer: THREE.AnimationMixer; gltf: GLTF; key: string; state: string; action?: THREE.AnimationAction }
/** Cache lifetime is one world. Templates own geometry/materials/textures; clones own skeletons.
 * Requests are lazy and nonblocking; failures retry at most twice with backoff. Safe after world disposal. */
export class EnemyVisuals {
  private loader = new GLTFLoader();
  private cache = new Map<string, GLTF | null>();
  private pending = new Set<string>();
  private instances = new Map<string, Instance>();
  private disposed = false;
  private retries = new Map<string, { attempts: number; after: number }>();
  private now = 0;
  get activeMixers() { return this.instances.size; }
  get diagnostics() { return { activeMixers: this.instances.size, loaded: [...this.cache.values()].filter(Boolean).length, failed: [...this.cache.values()].filter(v => !v).length, pending: this.pending.size, exhausted: [...this.retries.values()].filter(v => v.attempts >= 3).length }; }
  private request(key: string) {
    if (this.cache.get(key) || this.pending.has(key) || this.disposed) return;
    const retry = this.retries.get(key);
    if (retry && (retry.attempts >= 3 || this.now < retry.after)) return;
    this.pending.add(key);
    const fail = () => {
      this.pending.delete(key);
      if (!this.disposed) {
        this.cache.set(key, null);
        const attempts = (this.retries.get(key)?.attempts ?? 0) + 1;
        this.retries.set(key, { attempts, after: this.now + (attempts === 1 ? 5 : 15) });
      }
    };
    try {
      this.loader.load(`${import.meta.env?.BASE_URL ?? '/'}assets/enemies/${key}.glb`, gltf => {
        this.pending.delete(key);
        if (this.disposed) { disposeTemplate(gltf); return; }
        this.cache.set(key, gltf); this.retries.delete(key);
      }, undefined, fail);
    } catch { fail(); } // Malformed base URLs must not abort the world's frame loop.
  }

  release(id: string) {
    const instance = this.instances.get(id); if (!instance) return;
    instance.insignia?.dispose();
    instance.mixer.stopAllAction(); instance.mixer.uncacheRoot(instance.root);
    instance.root.traverse(o => { if (isEnemySkinnedMesh(o)) o.skeleton.dispose(); });
    instance.root.removeFromParent(); this.instances.delete(id);
  }
  contactMuzzle(id:string,origin:Point3,target:Point3):THREE.Vector3|null {
    const instance=this.instances.get(id);if(!instance||!instance.key.startsWith('musketeer'))return null;
    const socket=nativeMusketeerContactMuzzle(instance.gltf);return socket?transformEnemyContactMuzzle(socket,origin,target):null;
  }
  /** Advance wall-clock loading backoff once per frame, not once per enemy. */
  tick(dt: number) { this.now += Math.max(0, Math.min(dt, 1)); }
  update(e: Enemy, model: EnemyModel, parent: THREE.Group, fallback: THREE.Group, dt: number, distance: number, allowed: boolean) {
    if (this.disposed) return false;
    if (!allowed || e.mode === 'dead') { this.release(e.id); fallback.visible = true; return false; }
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
        if (!(isEnemyMesh(o))) return;
        o.receiveShadow = true;
        // Bounds are rig-dependent; the 82m root cull and 24-instance cap bound this work.
        if (isEnemySkinnedMesh(o)) o.frustumCulled = false;
      });
      // Prime immutable contact sockets in presentation, never in a fixed AI tick.
      if(model==='musketeer')nativeMusketeerContactMuzzle(gltf);
      parent.add(root);
      instance = { insignia:e.storyPattern==='echo-warden'?createEchoWardenVisual(root):undefined, root, mixer: new THREE.AnimationMixer(root), gltf, key, state: '', acting: createEnemyAttackActing(root, gltf.scene, model) };
      this.instances.set(e.id, instance);
    }
    fallback.visible = !instance;
    if (!instance) return false;
    instance.root.traverse(o => { if (isEnemyMesh(o)) o.castShadow = distance < 18; });
    instance.acting.restore();
    const pose = enemyAttackPose(e, model);
    const clip = instance.gltf.animations.find(c => c.name === pose.clip)
      ?? instance.gltf.animations.find(c => c.name === 'Idle') ?? instance.gltf.animations[0];
    const state = `${e.mode}:${e.attackCount}:${clip?.name}`;
    if (clip && state !== instance.state) {
      instance.state = state;
      const action = instance.mixer.clipAction(clip);
      const priorAction = instance.action;
      // Deterministic contact poses must not cross-fade with a stale windup pose.
      // Free locomotion retains its soft transition; native assets remain immutable.
      if (pose.sample !== undefined) instance.mixer.stopAllAction();
      else if (action !== priorAction) priorAction?.fadeOut(.12);
      action.reset().setLoop(pose.sample !== undefined ? THREE.LoopOnce : THREE.LoopRepeat, pose.sample !== undefined ? 1 : Infinity);
      action.clampWhenFinished = pose.sample !== undefined;
      action.setEffectiveTimeScale(1).setEffectiveWeight(1).play();
      if (pose.sample === undefined && priorAction && action !== priorAction) action.fadeIn(.12);
      else action.stopFading();
      instance.action = action;
    }
    if (instance.action && pose.sample !== undefined) {
      // Sample the simulation clock exactly, including first load / LOD swap / pause.
      // Render dt must not run an attack ahead of its real contact or restart it.
      instance.action.paused = true;
      instance.action.time = clip.duration * pose.sample;
    } else if (instance.action) instance.action.paused = false;
    instance.mixer.update(Number.isFinite(dt) ? Math.max(0, Math.min(dt, .1)) : 0);
    instance.acting.update(e);
    instance.insignia?.update(e);
    return true;
  }
  dispose() {
    if (this.disposed) return; this.disposed = true;
    for (const id of this.instances.keys()) this.release(id);
    for (const gltf of this.cache.values()) if (gltf) disposeTemplate(gltf);
    this.cache.clear(); this.retries.clear(); this.pending.clear();
  }
}

import { isEnemySkinnedMesh, isEnemyMesh, isEnemyTexture } from './enemyMeshTypes';
import * as THREE from 'three';
import {nativeMusketeerContactMuzzle,transformEnemyContactMuzzle} from './enemyShotSocket';
import {createEchoWardenVisual} from './echoWardenVisual';
import { createShieldKit } from './shieldbearerVisual';
import { createShinobiKit } from './shinobiVisual';
import { createPowderKit } from './powderVisual';
import { createJaegerKit } from './jaegerVisual';
import { createBombardierKit, createBreakerKit } from './roleGearVisual';
import { createBossRegaliaKit, hasBossRegalia, type BossRegaliaId } from './bossRegaliaVisual';
import { createEliteCrestKit, hasEliteCrest } from './eliteCrestVisual';
import { createTroopKit } from './troopKitVisual';
import { bakeAttachedKits, disposeBakedKits } from '../companions/kitMerge';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { selectEnemyRole, type EnemyRole } from './enemyRoles';
import { regionAt } from '../map/regions';
import { createEnemyAttackActing } from './enemyAttackActing';
import { enemyAttackPose } from './enemyAttackPresentation';
import { enemyHitReaction } from './enemyHitReaction';
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
  if (region === 'kyoto') return e.miniboss || role === 'duelist' || role === 'breaker' || role === 'shinobi' ? 'samurai' : 'ashigaru';
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
interface Instance { shield?: THREE.Object3D | null; kit?: { remove(): void } | null; gear?: { remove(): void; update?(e: Enemy, t: number): void } | null; insignia?: ReturnType<typeof createEchoWardenVisual>; acting: ReturnType<typeof createEnemyAttackActing>; root: THREE.Object3D; mixer: THREE.AnimationMixer; gltf: GLTF; key: string; state: string; action?: THREE.AnimationAction; base?: { z: number; rx: number }; flashing?: boolean }
/** Cache lifetime is one world. Templates own geometry/materials/textures; clones own skeletons.
 * Requests are lazy and nonblocking; failures retry at most twice with backoff. Safe after world disposal. */
export class EnemyVisuals {
  private loader = new GLTFLoader();
  private cache = new Map<string, GLTF | null>();
  private pending = new Set<string>();
  private instances = new Map<string, Instance>();
  /** One white-hot twin per body material, shared by every clone wearing it (bounded by the templates). */
  private flashMaterials = new Map<THREE.Material, THREE.Material>();
  private flashFor(m: THREE.Material) {
    let f = this.flashMaterials.get(m);
    if (!f) {
      f = m.clone(); const e = (f as THREE.MeshStandardMaterial).emissive;
      if (e?.isColor) { e.set('#fff3e0'); (f as THREE.MeshStandardMaterial).emissiveIntensity = .9; } else { f.dispose(); f = m; }
      this.flashMaterials.set(m, f);
    }
    return f;
  }
  private disposed = false;
  private shieldKit?: ReturnType<typeof createShieldKit>;
  private shinobiKit?: ReturnType<typeof createShinobiKit>;
  private powderKit?: ReturnType<typeof createPowderKit>;
  private jaegerKit?: ReturnType<typeof createJaegerKit>;
  private bombardierKit?: ReturnType<typeof createBombardierKit>;
  private breakerKit?: ReturnType<typeof createBreakerKit>;
  private bossKits = new Map<BossRegaliaId, ReturnType<typeof createBossRegaliaKit>>();
  /** One regalia kit per champion id, built the first time that champion is seen. */
  private bossKit(id: BossRegaliaId) { let kit = this.bossKits.get(id); if (!kit) { kit = createBossRegaliaKit(id); this.bossKits.set(id, kit); } return kit; }
  private troopKit?: ReturnType<typeof createTroopKit>;
  private eliteKits = new Map<string, ReturnType<typeof createEliteCrestKit>>();
  /** One sashimono kit per roaming elite, built the first time that elite is seen. */
  private eliteKit(id: string) { let kit = this.eliteKits.get(id); if (!kit) { kit = createEliteCrestKit(id); this.eliteKits.set(id, kit); } return kit; }
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
    instance.insignia?.dispose(); disposeBakedKits(instance.root); instance.shield?.removeFromParent(); instance.kit?.remove(); instance.gear?.remove();
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
      instance = { kit: e.kind === 'king' || e.miniboss || e.storyPattern ? undefined : (this.troopKit ??= createTroopKit()).attach(root, e.id), shield: e.role === 'shieldbearer' && model === 'sunward_guard' ? (this.shieldKit ??= createShieldKit()).attach(root) : undefined, gear: e.kind === 'king' && hasBossRegalia(e.id) ? this.bossKit(e.id).attach(root) : hasEliteCrest(e.miniboss) ? this.eliteKit(e.miniboss).attach(root) : e.role === 'shinobi' && model === 'samurai' ? (this.shinobiKit ??= createShinobiKit()).attach(root) : e.role === 'powder' && model === 'deck_raider' ? (this.powderKit ??= createPowderKit()).attach(root) : e.role === 'jaeger' && model === 'musketeer' ? (this.jaegerKit ??= createJaegerKit()).attach(root) : e.role === 'bombardier' && !e.miniboss && e.kind !== 'king' ? (this.bombardierKit ??= createBombardierKit()).attach(root) : e.role === 'breaker' && model === 'sunward_guard' && !e.miniboss && e.kind !== 'king' ? (this.breakerKit ??= createBreakerKit()).attach(root) : undefined, insignia:e.storyPattern==='echo-warden'?createEchoWardenVisual(root):undefined, root, mixer: new THREE.AnimationMixer(root), gltf, key, state: '', acting: createEnemyAttackActing(root, gltf.scene, model) };
      // Gear is authored as many small meshes; bake each kit down to one draw per material.
      bakeAttachedKits(root);
      this.instances.set(e.id, instance);
    }
    fallback.visible = !instance;
    if (!instance) return false;
    const reaction = enemyHitReaction(e), swap = reaction.flash !== !!instance.flashing;
    instance.flashing = reaction.flash;
    instance.root.traverse(o => {
      if (!isEnemyMesh(o)) return;
      o.castShadow = distance < 18;
      if (!swap || !isEnemySkinnedMesh(o)) return;
      const base = (o.userData.hitBase ??= o.material) as THREE.Material | THREE.Material[];
      o.material = reaction.flash ? (Array.isArray(base) ? base.map(m => this.flashFor(m)) : this.flashFor(base)) : base;
    });
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
    // the flinch rides on the model root only: the enemy's own position never moves
    const base = instance.base ??= { z: instance.root.position.z, rx: instance.root.rotation.x };
    instance.root.position.z = base.z + reaction.push; instance.root.rotation.x = base.rx + reaction.lean;
    instance.insignia?.update(e); instance.gear?.update?.(e, this.now);
    return true;
  }
  dispose() {
    if (this.disposed) return; this.disposed = true;
    for (const id of this.instances.keys()) this.release(id);
    for (const gltf of this.cache.values()) if (gltf) disposeTemplate(gltf);
    this.cache.clear(); this.retries.clear(); this.pending.clear(); this.shieldKit?.dispose(); this.shieldKit = undefined; this.shinobiKit?.dispose(); this.shinobiKit = undefined; this.powderKit?.dispose(); this.powderKit = undefined; this.jaegerKit?.dispose(); this.jaegerKit = undefined; this.bombardierKit?.dispose(); this.bombardierKit = undefined; this.breakerKit?.dispose(); this.breakerKit = undefined; for (const f of new Set(this.flashMaterials.values())) if (!this.flashMaterials.has(f)) f.dispose(); this.flashMaterials.clear(); for (const kit of this.bossKits.values()) kit.dispose(); this.bossKits.clear(); for (const kit of this.eliteKits.values()) kit.dispose(); this.eliteKits.clear(); this.troopKit?.dispose(); this.troopKit = undefined;
  }
}

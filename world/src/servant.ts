import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { bilingual } from '../../shared-client/i18n';
import { FirstContract } from './contracts';
import { ServantAppearance, type ServantOutfit } from './servantAppearance';
import type { Collider } from './player';
import type { Marker } from './types';

// Only accepted, project-authored outfits; the rejected v1 model is never requested.
export const SERVANT_MODELS: Record<ServantOutfit, string> = {
  armor: new URL('../../assets/characters/artoria_refined/runtime_revision1/armor/artoria_armor.glb.gz', import.meta.url).href,
  civilian: new URL('../../assets/characters/artoria_refined/runtime_revision1/civilian/artoria_civilian.glb.gz', import.meta.url).href,
};
/** Lossless transport only. Some hosts already decode Content-Encoding: gzip. */
export async function decodeServantModel(bytes: ArrayBuffer): Promise<ArrayBuffer> {
  const magic = new Uint8Array(bytes, 0, Math.min(4, bytes.byteLength));
  if (magic[0] === 0x67 && magic[1] === 0x6c && magic[2] === 0x54 && magic[3] === 0x46) return bytes;
  if (magic[0] !== 0x1f || magic[1] !== 0x8b) throw new Error('Invalid Artoria GLB/gzip response');
  if (typeof DecompressionStream === 'undefined') throw new Error('This browser does not support lossless gzip model loading');
  const result = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  const decoded = new Uint8Array(result, 0, Math.min(4, result.byteLength));
  if (decoded[0] !== 0x67 || decoded[1] !== 0x6c || decoded[2] !== 0x54 || decoded[3] !== 0x46) throw new Error('Decoded Artoria asset is not a GLB');
  return result;
}
export async function loadServantGltf(url: string): Promise<GLTF> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Artoria asset HTTP ${response.status}`);
  return new GLTFLoader().parseAsync(await decodeServantModel(await response.arrayBuffer()), '');
}
export const SERVANT_CLIPS = ['Idle', 'Walk', 'Run', 'Attack'] as const;
// Authored runtime_revision1 timing (30fps); movement above capped gait speed can still slide.
export const SERVANT_MOTION = { walkSpeed: .7476, runSpeed: 1.9983, maxRate: 1.8, followSpeed: 6, attackContact: 5 / 9 } as const;
export const outfitLabel = (outfit: ServantOutfit) => outfit === 'armor' ? bilingual('誓约战甲', 'Oath armor') : bilingual('旅途便服', 'Travel clothes');
type Target = { id: string; position: THREE.Vector3 } | null;
export interface ServantOptions {
  scene: THREE.Scene; renderer?: THREE.WebGLRenderer; marker: Marker; contract: FirstContract;
  appearance?: ServantAppearance; colliders: Collider[];
  target: (position: THREE.Vector3) => Target;
  strike: (position: THREE.Vector3, targetId: string) => Target;
  load?: (url: string) => Promise<GLTF>;
}

/** One actor and one serialized load: rapid choices cannot resurrect an obsolete model. */
export class ContractServant {
  readonly root = new THREE.Group();
  readonly appearance: ServantAppearance;
  state: 'unloaded' | 'loading' | 'ready' | 'failed' = 'unloaded';
  activeOutfit?: ServantOutfit;
  private mixer?: THREE.AnimationMixer;
  private clips = new Map<string, THREE.AnimationAction>();
  private current?: THREE.AnimationAction;
  private attackTime = 0;
  private attackDuration = 1.2;
  private attackTarget: string | null = null;
  private contactPending = false;
  private activeLast = false;
  private disposed = false;
  private model?: THREE.Object3D;
  private environment?: THREE.WebGLRenderTarget;
  private loadTask?: Promise<void>;
  private readonly ray = new THREE.Ray();
  private readonly down = new THREE.Vector3(0,-1,0);
  constructor(private options: ServantOptions) {
    this.appearance = options.appearance ?? new ServantAppearance();
    this.root.name = 'ArtoriaContractServant';
    this.root.position.fromArray(options.marker.p).add(new THREE.Vector3(1.5,0,0));
    options.scene.add(this.root);
  }
  get animation() { return this.current?.getClip().name ?? null; }
  get status() {
    const prefix = this.options.contract.recruited ? bilingual('Saber 已缔约', 'Saber contracted') : bilingual('第一契约 · 圣剑湖等待', 'First contract · Waiting at Sword Lake');
    if (this.state === 'failed') return `${prefix} · ${bilingual('外观加载失败，可重试', 'Outfit unavailable; retry')}${this.activeOutfit ? ` (${outfitLabel(this.activeOutfit)})` : ''}`;
    if (this.state === 'loading') return `${prefix} · ${bilingual('正在加载外观', 'Loading outfit')}`;
    if (!this.options.contract.recruited) return prefix;
    return `${bilingual('Saber', 'Saber')} · ${this.options.contract.summoned ? bilingual('同行中', 'Following') : bilingual('已收回', 'Recalled')} · ${outfitLabel(this.activeOutfit ?? this.appearance.outfit)}`;
  }
  selectOutfit(value: unknown) {
    if (this.disposed || !this.appearance.select(value)) return Promise.resolve();
    this.cancelAttack();
    if (this.activeOutfit === this.appearance.outfit) {
      this.state = this.loadTask ? 'loading' : 'ready';
      return this.loadTask ?? Promise.resolve();
    }
    this.state = 'unloaded';
    return this.ensureLoaded();
  }
  retry() { if (this.state === 'failed') this.state = 'unloaded'; return this.ensureLoaded(); }
  ensureLoaded(): Promise<void> {
    if (this.disposed) return Promise.resolve();
    if (this.loadTask) return this.loadTask;
    if (this.state === 'failed' || this.activeOutfit === this.appearance.outfit) return Promise.resolve();
    this.loadTask = this.loadLatest().finally(() => { this.loadTask = undefined; });
    return this.loadTask;
  }
  private async loadLatest() {
    while (!this.disposed && this.activeOutfit !== this.appearance.outfit) {
      const outfit = this.appearance.outfit;
      this.state = 'loading';
      let candidate: GLTF | undefined;
      try {
        candidate = await (this.options.load ?? loadServantGltf)(SERVANT_MODELS[outfit]);
        if (this.disposed || outfit !== this.appearance.outfit) { disposeObject(candidate.scene); continue; }
        for (const name of SERVANT_CLIPS) {
          const clip = candidate.animations.find(c => c.name === name);
          if (!clip || !Number.isFinite(clip.duration) || clip.duration <= 0) throw new Error(`Missing or invalid ${name} clip`);
        }
        if (!this.environment && this.options.renderer) {
          const room = new RoomEnvironment(), pmrem = new THREE.PMREMGenerator(this.options.renderer);
          try { this.environment = pmrem.fromScene(room); } finally { room.dispose(); pmrem.dispose(); }
        }
        candidate.scene.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (!mesh.isMesh) return;
          mesh.castShadow = true; mesh.receiveShadow = true;
          // Animated sword/clothes can extend beyond their rest-pose bounds. One actor only.
          mesh.frustumCulled = false;
          for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
            if (this.environment && (material as THREE.MeshStandardMaterial).isMeshStandardMaterial) (material as THREE.MeshStandardMaterial).envMap = this.environment.texture;
          }
        });
        const mixer = new THREE.AnimationMixer(candidate.scene);
        const clips = new Map(candidate.animations.map(clip => [clip.name.toLowerCase(), mixer.clipAction(clip)]));
        this.clearModel();
        this.model = candidate.scene; this.root.add(this.model);
        this.mixer = mixer; this.clips = clips;
        this.attackDuration = candidate.animations.find(c => c.name === 'Attack')!.duration;
        this.activeOutfit = outfit; this.play('idle'); this.state = 'ready';
        candidate = undefined;
      } catch (error) {
        if (candidate) disposeObject(candidate.scene, this.environment?.texture);
        if (this.disposed) return;
        if (outfit !== this.appearance.outfit) continue;
        // Keep the last good outfit. Cosmetic failure must never erase the contract.
        this.state = 'failed';
        console.warn('Artoria outfit could not load; contract and previous outfit are preserved.', error);
        return;
      }
    }
    if (!this.disposed && this.activeOutfit === this.appearance.outfit) this.state = 'ready';
  }
  private play(name: string, restart = false, rate = 1) {
    const next = this.clips.get(name);
    if (!next) return;
    if (next === this.current && !restart) { next.setEffectiveTimeScale(rate); return; }
    next.reset().setEffectiveTimeScale(rate).setEffectiveWeight(1)
      .setLoop(name === 'attack' ? THREE.LoopOnce : THREE.LoopRepeat, name === 'attack' ? 1 : Infinity).play();
    next.clampWhenFinished = name === 'attack';
    if (this.current && this.current !== next) this.current.crossFadeTo(next,.18,false);
    this.current = next;
  }
  private cancelAttack() { this.attackTime = 0; this.attackTarget = null; this.contactPending = false; this.play('idle'); }
  private floor(x: number,z: number,baseY: number) {
    this.ray.origin.set(x,baseY+1.1,z); this.ray.direction.copy(this.down);
    let best = Infinity;
    for (const c of this.options.colliders) if (c.enabled) {
      const hit = c.bvh.raycastFirst(this.ray,THREE.DoubleSide);
      if (hit && hit.distance < best && hit.distance < 3 && Math.abs(hit.face?.normal.y ?? 0) > .7) best = hit.distance;
    }
    return best < Infinity ? baseY + 1.1 - best : null;
  }
  private visiblePath(from: THREE.Vector3,to: THREE.Vector3) {
    this.ray.origin.copy(from).add(new THREE.Vector3(0,.8,0));
    this.ray.direction.copy(to).sub(from); const distance = this.ray.direction.length();
    if (!distance) return true;
    this.ray.direction.divideScalar(distance);
    return !this.options.colliders.some(c => c.enabled && (c.bvh.raycastFirst(this.ray,THREE.DoubleSide)?.distance ?? Infinity) < distance);
  }
  update(dt: number,player: THREE.Vector3,yaw: number,enabled: boolean,paused: boolean) {
    if (this.disposed) return;
    dt = Number.isFinite(dt) ? Math.max(0, Math.min(.1, dt)) : 0;
    const { contract,marker } = this.options;
    const atLake = player.distanceTo(new THREE.Vector3().fromArray(marker.p)) < 80;
    if (atLake || contract.recruited) void this.ensureLoaded();
    const following = contract.summoned && enabled;
    this.root.visible = contract.recruited ? following : atLake;
    if (!following) {
      this.activeLast = false; this.cancelAttack();
      if (!contract.recruited) { this.root.position.fromArray(marker.p).add(new THREE.Vector3(1.5,0,0)); this.root.rotation.y = Math.PI; }
      if (!paused && this.root.visible) this.mixer?.update(dt);
      return;
    }
    if (paused) return;
    const destination = player.clone().add(new THREE.Vector3(Math.cos(yaw)*1.8 + Math.sin(yaw)*1.3,0,-Math.sin(yaw)*1.8 + Math.cos(yaw)*1.3));
    const ground = this.floor(destination.x,destination.z,player.y);
    if (ground !== null) destination.y = ground;
    if (!this.activeLast || this.root.position.distanceTo(player) > 24) {
      this.root.position.copy(ground !== null && this.visiblePath(player,destination) ? destination : player);
      this.cancelAttack();
    }
    this.activeLast = true;
    if (this.attackTime > 0) { this.advanceAttack(dt); return; }
    let speed = 0;
    const distance = this.root.position.distanceTo(destination);
    if (distance > .35 && ground !== null && this.visiblePath(this.root.position,destination)) {
      const delta = destination.clone().sub(this.root.position);
      speed = Math.min(SERVANT_MOTION.followSpeed, (distance - .25) * 3);
      this.root.position.addScaledVector(delta,Math.min(1,dt*speed/distance));
      this.root.rotation.y = Math.atan2(delta.x,delta.z);
    }
    if (this.model) {
      const target = this.options.target(this.root.position);
      if (target) {
        this.attackTime = this.attackDuration; this.attackTarget = target.id; this.contactPending = true;
        this.root.rotation.y = Math.atan2(target.position.x-this.root.position.x,target.position.z-this.root.position.z);
        this.play('attack',true);
      } else {
        const running = speed > (this.animation === 'Run' ? 2.2 : 2.6);
        this.play(speed < .1 ? 'idle' : running ? 'run' : 'walk', false,
          speed < .1 ? 1 : THREE.MathUtils.clamp(speed / (running ? SERVANT_MOTION.runSpeed : SERVANT_MOTION.walkSpeed), .65, SERVANT_MOTION.maxRate));
      }
    }
    if (this.attackTime > 0) this.advanceAttack(dt); else this.mixer?.update(dt);
  }
  private advanceAttack(dt: number) {
    this.attackTime = Math.max(0, this.attackTime - dt);
    if (this.contactPending && this.attackTime <= this.attackDuration * (1 - SERVANT_MOTION.attackContact)) {
      this.contactPending = false;
      if (this.attackTarget) this.options.strike(this.root.position, this.attackTarget);
    }
    this.mixer?.update(dt);
    if (this.attackTime <= 0) this.cancelAttack();
  }
  private clearModel() {
    this.cancelAttack(); this.current = undefined;
    this.mixer?.stopAllAction();
    if (this.model) {
      this.mixer?.uncacheRoot(this.model); this.model.removeFromParent();
      disposeObject(this.model, this.environment?.texture);
    }
    this.clips.clear(); this.mixer = undefined; this.model = undefined;
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true; this.clearModel(); this.root.removeFromParent();
    this.environment?.dispose(); this.environment = undefined;
  }
}
function disposeObject(root: THREE.Object3D, sharedEnvironment?: THREE.Texture) {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>(), skeletons = new Set<THREE.Skeleton>();
  root.traverse(o => {
    const mesh = o as THREE.SkinnedMesh; if (!mesh.isMesh) return;
    geometries.add(mesh.geometry);
    if (mesh.isSkinnedMesh) skeletons.add(mesh.skeleton);
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.add(m);
  });
  for (const material of materials) {
    for (const v of Object.values(material)) if (v instanceof THREE.Texture && v !== sharedEnvironment) textures.add(v);
    material.dispose();
  }
  const images = new Set<{ close(): void }>();
  textures.forEach(t => {
    const image = t.image as { close?: () => void } | undefined;
    if (typeof image?.close === 'function') images.add(image as { close(): void });
    t.dispose();
  });
  images.forEach(image => image.close());
  geometries.forEach(g => g.dispose()); skeletons.forEach(s => s.dispose());
}

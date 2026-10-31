import { skillAnimationProfile, skillAnimationSample } from './skillAnimationProfile';
import * as THREE from 'three';
import { validSkillPose, type SkillPoseCommand } from './skillPose';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { bilingual } from '../../shared-client/i18n';
import { FirstContract } from './contracts';
import { ServantAppearance, type ServantOutfit } from './servantAppearance';
import type { Collider } from './player';
import type { Marker } from './types';
import { ActionBlend } from './characters/actionBlend';
import { CompanionNavigation } from './companionNavigation';
import { saberRunRate } from './characters/saberStride';
import { SaberStrideRuntime } from './characters/saberStrideRuntime';
import { SaberGroundedLocomotion } from './characters/saberGroundedLocomotion';
import { SaberIdleCarry } from './characters/saberLocomotion';
import { COMPANION_MOTION, companionGait, turnCompanion } from './characters/companionMotion';

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
// Authored runtime_revision1 timing (30fps); movement and gait share the same speed budget.
export const SERVANT_MOTION = { walkSpeed: .7476, runSpeed: 1.9983, maxRate: COMPANION_MOTION.maxRate, followSpeed: 6, attackContact: 5 / 9 } as const;
export const outfitLabel = (outfit: ServantOutfit) => outfit === 'armor' ? bilingual('誓约战甲', 'Oath armor') : bilingual('旅途便服', 'Travel clothes');
type Target = { id: string; position: THREE.Vector3 } | null;
export interface ServantOptions {
  scene: THREE.Scene; renderer?: THREE.WebGLRenderer; marker: Marker; contract: FirstContract;
  appearance?: ServantAppearance; colliders: Collider[];
  target: (position: THREE.Vector3, targetId?: string) => Target;
  track?: (position: THREE.Vector3, targetId: string) => Target;
  onRejoin?: () => void;
  strike: (position: THREE.Vector3, targetId: string) => Target;
  /** Enemy to go after (lock-on radius around the player); null keeps the follow slot. */
  engage?: (player: THREE.Vector3, from?: THREE.Vector3) => Target;
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
  private blend = new ActionBlend('smoothstep');
  private stride?:SaberStrideRuntime;
  private strideSpeed=-1;
  private grounding?: SaberGroundedLocomotion;
  private groundingActive = false;
  private idleCarry?: SaberIdleCarry;
  private navigation: CompanionNavigation;
  private separatedFor = 0;
  private pursuing = false;
  private rejoinRetry = 0;
  private readonly rejoinPlayer = new THREE.Vector3(Infinity,0,Infinity);
  private attackYaw = 0;
  private attackTime = 0;
  private attackDuration = 1.2;
  private attackTarget: string | null = null;
  private contactPending = false;
  private skillPose?: { command: SkillPoseCommand; contacts: number; elapsed: number; clipElapsed: number; motionTime: number; cycle: number; emitted: boolean; started: boolean };
  private activeLast = false;
  private disposed = false;
  private model?: THREE.Object3D;
  private environment?: THREE.WebGLRenderTarget;
  private loadTask?: Promise<void>;
  constructor(private options: ServantOptions) {
    this.navigation = new CompanionNavigation(options.colliders);
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
            if (this.environment && (material as THREE.MeshStandardMaterial).isMeshStandardMaterial) { (material as THREE.MeshStandardMaterial).envMap = this.environment.texture; (material as THREE.MeshStandardMaterial).envMapIntensity = .45; }
          }
        });
        const mixer = new THREE.AnimationMixer(candidate.scene);
        const idle = candidate.animations.find(clip => clip.name === 'Idle')!;
        const idleCarry = new SaberIdleCarry(candidate.scene, mixer, idle);
        const clips = new Map(candidate.animations.map(clip => [clip.name.toLowerCase(), mixer.clipAction(idleCarry.locomotionClip(clip))]));
        this.clearModel();
        this.model = candidate.scene; this.root.add(this.model);
        this.mixer = mixer; this.clips = clips; this.idleCarry = idleCarry;
        this.stride=new SaberStrideRuntime(candidate.scene,this.root);
        this.grounding = new SaberGroundedLocomotion(candidate.scene, this.root, outfit, this.options.colliders);
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
  private tick(dt: number) {
    if (this.mixer) {
      this.grounding?.restore();
      const locomotion = ['Idle', 'Walk', 'Run'].includes(this.animation ?? '');
      if (!locomotion && this.groundingActive) this.grounding?.reset();
      this.groundingActive = locomotion;
      if (this.stride) this.stride.support = locomotion ? this.grounding : undefined;
      this.stride?.restore();
      this.blend.update(this.mixer, dt);
      this.idleCarry?.updateWeight(this.clips.get('idle'), this.clips.get('walk'), this.clips.get('run'));
      // Apply the just-updated normalized weight without advancing either clock twice.
      this.mixer.update(0);
      this.stride?.apply(this.clips.get('run'),dt,this.strideSpeed);
      if (locomotion && (this.stride?.diagnostics.weight ?? 0) < .001) this.grounding?.applyBase(dt);
    }
  }
  get strideDiagnostics(){return this.stride?.diagnostics;}
  get groundDiagnostics() { return this.grounding ? { contact: this.grounding.diagnostics, patch: this.grounding.patch.diagnostics } : undefined; }
  private play(name: string, restart = false, rate = 1) {
    const next = this.clips.get(name);
    if (!next) return;
    if (['walk', 'run'].includes(name)) for (const gait of ['walk', 'run']) {
      const action = this.clips.get(gait);
      if (action) action.setEffectiveTimeScale(rate * action.getClip().duration / next.getClip().duration);
    }
    if (next === this.current && !restart) { next.setEffectiveTimeScale(rate); return; }
    const previous = this.current;
    const gaitChange = !restart && ['Walk', 'Run'].includes(previous?.getClip().name ?? '') && ['walk', 'run'].includes(name);
    const phase = gaitChange && previous ? previous.time / previous.getClip().duration : 0;
    // An interrupted Walk/Run fade can return to an action which is still visible.
    // Preserve that action's live phase; rephasing a 30%-weighted clip instantly
    // teleports its feet even though ActionBlend correctly preserves its weight.
    const alreadyVisible = !restart && name !== 'attack' && next.enabled && next.isScheduled() && next.getEffectiveWeight() > 0;
    const startTime = alreadyVisible ? next.time : gaitChange ? phase * next.getClip().duration : 0;
    this.blend.start(next, previous === next ? 0 : .18, () => {
      next.reset().setEffectiveTimeScale(rate)
        .setLoop(name === 'attack' ? THREE.LoopOnce : THREE.LoopRepeat, name === 'attack' ? 1 : Infinity).play();
      next.time = startTime; next.clampWhenFinished = name === 'attack';
    });
    if (gaitChange && previous) previous.setEffectiveTimeScale(rate * previous.getClip().duration / next.getClip().duration);
    this.current = next;
  }
  private cancelAttack() { this.cancelSkillPose(); this.navigation.reset(); this.attackTime = 0; this.attackTarget = null; this.contactPending = false; this.play('idle'); }
  get presentationModel(): THREE.Object3D | null { return this.state === 'ready' ? this.model ?? null : null; }
  get presentationClips(): readonly THREE.AnimationClip[] { return [...this.clips.values()].map(action => action.getClip()); }
  startSkillPose(command: SkillPoseCommand): boolean {
    if (!validSkillPose(command) || this.disposed || this.state !== 'ready' || !this.root.visible || !this.options.contract.summoned || !this.clips.has('attack')) return false;
    this.cancelAttack(); this.activeLast = true;
    this.attackYaw = Math.atan2(command.direction.x, command.direction.z);
    this.skillPose = { command, contacts: 0, elapsed: 0, clipElapsed: 0, motionTime: 0, cycle: 0, emitted: false, started: false };
    this.play('idle'); return true;
  }
  cancelSkillPose() {
    const pose = this.skillPose; this.skillPose = undefined;
    if (pose) { this.play('idle'); pose.command.onFinish(false); }
  }
  private advanceSkillPose(dt: number) {
    const pose = this.skillPose;
    if (!pose) return;
    pose.elapsed += dt;
    if (pose.elapsed > 7.5) { this.cancelSkillPose(); return; }
    turnCompanion(this.root, this.attackYaw, dt);
    if (!pose.started) {
      const angle = Math.atan2(Math.sin(this.attackYaw - this.root.rotation.y), Math.cos(this.attackYaw - this.root.rotation.y));
      if (Math.abs(angle) > .08) { this.tick(dt); return; }
      pose.started = true; this.play('attack', true);
    }
    const contact = this.attackDuration * SERVANT_MOTION.attackContact;
    pose.motionTime += dt;
    // A frame may finish a clip and enter the next one. Preserve its remaining time;
    // contacts still come only from crossing the original clip's contact instant.
    for(let cycle=0;cycle<4 && this.skillPose===pose;cycle++) {
      const sample=skillAnimationSample(skillAnimationProfile('saber',pose.command.slot,pose.cycle),pose.motionTime,this.attackDuration,contact);
      const next=sample.clipTime;
      if (!pose.emitted && next + 1e-9 >= contact) {
        this.tick(Math.max(0, contact - pose.clipElapsed));
        pose.emitted = true; pose.contacts++;
        pose.command.onContact(this.root.position, { x: Math.sin(this.attackYaw), y: 0, z: Math.cos(this.attackYaw) }, 'sword', { losOffset: 1, casterFeetY: this.root.position.y });
        if (this.skillPose !== pose) return;
        this.tick(Math.max(0,next - contact));
      } else this.tick(Math.max(0,next - pose.clipElapsed));
      pose.clipElapsed = next;
      if (pose.motionTime + 1e-9 < sample.duration) return;
      if (pose.contacts >= pose.command.contacts) { this.skillPose = undefined; this.play('idle'); pose.command.onFinish(true); return; }
      pose.motionTime=Math.max(0,pose.motionTime-sample.duration);pose.cycle++;
      pose.clipElapsed = 0; pose.emitted = false; this.play('attack', true);
    }
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
      this.activeLast = false; this.pursuing=false;this.separatedFor=0; this.rejoinRetry=0; this.rejoinPlayer.set(Infinity,0,Infinity); this.cancelAttack();
      if (!contract.recruited) { this.root.position.fromArray(marker.p).add(new THREE.Vector3(1.5,0,0)); this.root.rotation.y = Math.PI; }
      if (!paused && this.root.visible) this.tick(dt);
      return;
    }
    if (paused) { this.cancelAttack(); return; }
    if (this.skillPose) {
      if(this.root.position.distanceTo(player)>24)this.cancelSkillPose();
      else { this.advanceSkillPose(dt); return; }
    }
    this.rejoinRetry=Math.max(0,this.rejoinRetry-dt);
    if(this.rejoinPlayer.distanceToSquared(player)>4){this.rejoinRetry=0;this.rejoinPlayer.copy(player);}
    const separation=this.root.position.distanceTo(player);
    // Preserve the authored <=3x gait. Pure following regroups before the 16m skill-command limit;
    // committed pursuit keeps its 24m leash, and never teleports to the enemy.
    const inCombat=(this.attackTime>0) || this.pursuing;
    this.separatedFor=separation>(inCombat?24:14)?this.separatedFor+dt:0;
    const rejoin=this.activeLast && (this.separatedFor>(inCombat?.75:.5) || separation>12 && this.navigation.stuckSeconds>2);
    if((!this.activeLast || rejoin) && this.rejoinRetry<=0) {
      const safe=this.navigation.safeReturn(player,yaw);
      if(safe){this.root.position.copy(safe);this.root.rotation.y=yaw;this.cancelAttack();this.separatedFor=0;this.rejoinRetry=0;if(rejoin)this.options.onRejoin?.();}
      else this.rejoinRetry=.25;
    }
    this.activeLast=true;
    if(separation>24 && this.attackTime>0)this.cancelAttack();
    if(this.attackTime>0){this.advanceAttack(dt);return;}
    const destination=player.clone().add(new THREE.Vector3(-Math.cos(yaw)*2.4-Math.sin(yaw)*.8,0,Math.sin(yaw)*2.4-Math.cos(yaw)*.8));
    const prey=this.options.engage?.(player,this.root.position);
    this.pursuing=!!prey;
    if(prey && separation<24)destination.copy(prey.position).add(this.root.position.clone().sub(prey.position).setY(0).normalize().multiplyScalar(1));
    const frameYaw=this.root.rotation.y;
    const speed=this.navigation.step(this.root,destination,dt,Math.min(SERVANT_MOTION.followSpeed,SERVANT_MOTION.runSpeed*SERVANT_MOTION.maxRate));
    if(this.model) {
      const target=this.options.target(this.root.position);
      if(target && Math.hypot(target.position.x-this.root.position.x,target.position.z-this.root.position.z)<1.75) {
        this.attackYaw=Math.atan2(target.position.x-this.root.position.x,target.position.z-this.root.position.z);
        this.navigation.reset();this.root.rotation.y=frameYaw;
        const remaining=turnCompanion(this.root,this.attackYaw,dt);
        if(Math.abs(remaining)<.12){this.attackTime=this.attackDuration;this.attackTarget=target.id;this.contactPending=true;this.play('attack',true);}
        else this.play('idle');
      } else {
        const running=companionGait(speed,SERVANT_MOTION.walkSpeed,this.animation==='Run')==='run';
        this.strideSpeed=speed;
        this.play(speed<.1?'idle':running?'run':'walk',false,speed<.1?1:THREE.MathUtils.clamp(running?saberRunRate(speed,this.clips.get('run')!.getClip().duration):speed/SERVANT_MOTION.walkSpeed,0,SERVANT_MOTION.maxRate));
      }
    }
    if(this.attackTime>0)this.advanceAttack(dt);else this.tick(dt);
  }
  private observeAttack():Target {
    if(!this.attackTarget)return null;
    const target=this.options.track?.(this.root.position,this.attackTarget) ?? (!this.options.track?this.options.target(this.root.position,this.attackTarget):null);
    return target?.id===this.attackTarget?target:null;
  }
  private advanceAttack(dt: number) {
    const contactAt=this.attackDuration*SERVANT_MOTION.attackContact;
    if(this.attackDuration-this.attackTime<contactAt-.12) {
      const target=this.observeAttack();
      if(!target){this.cancelAttack();return;}
      this.attackYaw=Math.atan2(target.position.x-this.root.position.x,target.position.z-this.root.position.z);
    }
    if(this.attackTime<this.attackDuration)turnCompanion(this.root,this.attackYaw,dt);
    this.attackTime=Math.max(0,this.attackTime-dt);
    if(this.contactPending && this.attackTime<=this.attackDuration-contactAt) {
      this.contactPending=false;
      const target=this.observeAttack();
      if(target && this.attackTarget) {
        const dx=target.position.x-this.root.position.x,dz=target.position.z-this.root.position.z,distance=Math.hypot(dx,dz);
        const facing=distance<.05 || (dx*Math.sin(this.root.rotation.y)+dz*Math.cos(this.root.rotation.y))/distance>=.7;
        if(distance<=2.6 && facing)this.options.strike(this.root.position,this.attackTarget);
      }
    }
    this.tick(dt);
    if(this.attackTime<=0)this.cancelAttack();
  }
  private clearModel() {
    this.grounding?.restore();
    this.stride?.clear();this.stride=undefined;this.strideSpeed=-1;
    this.grounding = undefined; this.groundingActive = false;
    this.cancelAttack(); this.current = undefined; this.blend.clear();
    this.mixer?.stopAllAction();
    if (this.model) {
      this.mixer?.uncacheRoot(this.model); this.model.removeFromParent();
      disposeObject(this.model, this.environment?.texture);
    }
    this.clips.clear(); this.mixer = undefined; this.model = undefined; this.idleCarry = undefined;
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
    for (const v of Object.values(material)) if ((v as THREE.Texture | undefined)?.isTexture && v !== sharedEnvironment) textures.add(v as THREE.Texture);
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

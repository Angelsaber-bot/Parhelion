import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mountedChargeClip } from './mountedChargeMotion';
import { musashiLocomotionClip } from './musashiLocomotion';

export type Axis = readonly [number, number, number];
export interface KitEvent { at: number; kind: 'fire' | 'hit'; socket?: string; }
export interface KitClip {
  name: string; duration: number; loop: boolean; nominalSpeed?: number;
  events?: readonly KitEvent[];
}
export interface KitSocket { node: string; forward?: Axis; up?: Axis; }
export interface CharacterKitDefinition {
  id: string; assetUrl: string; defaultState: string;
  clips: Readonly<Record<string, KitClip>>;
  sockets: Readonly<Record<string, KitSocket>>;
  /** All delivered clips are in-place. The host owns movement/collision/gameplay. */
  rootMotion: 'in-place';
  /** Visual-only origin correction, e.g. authored boot soles 14mm above zero. */
  visualOffset?: Axis;
  mount?: { saddleSocket: string; riderSeatSocket: string };
}
export interface KitEventResult extends KitEvent {
  character: string; state: string; clip: string;
  /** World-space snapshot sampled at the authored event instant, not after the frame. */
  transform?: { position: THREE.Vector3; quaternion: THREE.Quaternion; forward?: THREE.Vector3; up?: THREE.Vector3 };
}
export interface CharacterKitOptions {
  environment?: THREE.Texture;
  onEvent?: (event: KitEventResult) => void;
  transitionSeconds?: number;
}

/** Raw GLB or byte-exact gzip transport. Handles hosts that already decoded HTTP gzip. */
export async function decodeCharacterAsset(bytes: ArrayBuffer): Promise<ArrayBuffer> {
  const magic = new Uint8Array(bytes, 0, Math.min(4, bytes.byteLength));
  let result = bytes;
  if (magic[0] === 0x1f && magic[1] === 0x8b) {
    if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot decompress the character asset');
    result = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  }
  if (result.byteLength < 12) throw new Error('Truncated character GLB');
  const view = new DataView(result);
  if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== result.byteLength) throw new Error('Invalid character GLB header');
  return result;
}
export async function loadCharacterKit(definition: CharacterKitDefinition, options: CharacterKitOptions & { signal?: AbortSignal } = {}) {
  const response = await fetch(definition.assetUrl, { signal: options.signal });
  if (!response.ok) throw new Error(`Character asset HTTP ${response.status}`);
  const bytes = await decodeCharacterAsset(await response.arrayBuffer());
  options.signal?.throwIfAborted();
  const gltf = await new GLTFLoader().parseAsync(bytes, '');
  try {
    options.signal?.throwIfAborted();
    return new CharacterKit(gltf, definition, options);
  } catch (error) { disposeCharacterObject(gltf.scene, options.environment); throw error; }
}

/** Explicit opt-in render/animation adapter. Never recruits, spawns or damages anything. */
export class CharacterKit {
  readonly root = new THREE.Group();
  readonly model: THREE.Group;
  readonly mixer: THREE.AnimationMixer;
  private actions = new Map<string, THREE.AnimationAction>();
  private currentState = '';
  private elapsed = 0;
  private rate = 1;
  private emitted = new Set<number>();
  private generation = 0;
  private disposed = false;
  private readonly transition: number;
  constructor(gltf: GLTF, readonly definition: CharacterKitDefinition, private options: CharacterKitOptions = {}) {
    if (!definition.clips[definition.defaultState]) throw new Error('Character default state is missing');
    for (const [state, contract] of Object.entries(definition.clips)) {
      const clip = gltf.animations.find(c => c.name === contract.name);
      if (!clip || !Number.isFinite(contract.duration) || contract.duration <= 0 || Math.abs(clip.duration - contract.duration) > 1e-4) throw new Error(`Invalid character clip ${state}/${contract.name}`);
      if (contract.nominalSpeed !== undefined && (!Number.isFinite(contract.nominalSpeed) || contract.nominalSpeed <= 0)) throw new Error('Invalid nominal gait speed');
      for (const event of contract.events ?? []) {
        if (contract.loop || !Number.isFinite(event.at) || event.at < 0 || event.at > contract.duration) throw new Error('Invalid one-shot character event');
        if (event.socket && !definition.sockets[event.socket]) throw new Error(`Unknown event socket ${event.socket}`);
      }
    }
    if (definition.mount && (!definition.sockets[definition.mount.saddleSocket] || !definition.sockets[definition.mount.riderSeatSocket])) throw new Error('Missing mount socket contract');
    for (const [semantic, socket] of Object.entries(definition.sockets)) {
      if (!gltf.scene.getObjectByName(socket.node)) throw new Error(`Missing character socket ${semantic}/${socket.node}`);
      for (const axis of [socket.forward, socket.up]) if (axis && (axis.length !== 3 || axis.some(x => !Number.isFinite(x)) || new THREE.Vector3(...axis).lengthSq() < .01)) throw new Error('Invalid socket direction');
    }
    if (definition.visualOffset && (definition.visualOffset.length !== 3 || definition.visualOffset.some(value => !Number.isFinite(value)))) throw new Error('Invalid character visual offset');
    this.model = gltf.scene;
    if (definition.visualOffset) this.model.position.add(new THREE.Vector3(...definition.visualOffset));
    this.root.name = `CharacterKit:${definition.id}`; this.root.add(this.model);
    this.mixer = new THREE.AnimationMixer(this.model);
    for (const [state, clip] of Object.entries(definition.clips)) {
      let animation = gltf.animations.find(c => c.name === clip.name)!;
      if (definition.id === 'musashi') animation = musashiLocomotionClip(animation, this.model, state);
      const run = definition.clips.run, contact = clip.events?.find(event => event.kind === 'hit')?.at;
      if (definition.mount && state === 'attack' && run?.nominalSpeed && contact !== undefined && contact < clip.duration) {
        animation = mountedChargeClip(animation, gltf.animations.find(c => c.name === run.name)!, run.nominalSpeed, contact);
      }
      this.actions.set(state, this.mixer.clipAction(animation));
    }
    const transition = options.transitionSeconds ?? .18;
    this.transition = Number.isFinite(transition) ? THREE.MathUtils.clamp(transition, 0, .5) : .18;
    this.model.traverse(object => {
      const mesh = object as THREE.Mesh; if (!mesh.isMesh) return;
      mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        if (options.environment && (material as THREE.MeshStandardMaterial).isMeshStandardMaterial) { (material as THREE.MeshStandardMaterial).envMap = options.environment; (material as THREE.MeshStandardMaterial).envMapIntensity = .75; }
      }
    });
    this.play(definition.defaultState);
  }
  get state() { return this.currentState; }
  get clipTime() { return this.elapsed; }
  get playbackRate() { return this.rate; }
  play(state: string, options: { restart?: boolean; speed?: number; rate?: number } = {}) {
    if (this.disposed) return false;
    const contract = this.definition.clips[state], next = this.actions.get(state);
    if (!contract || !next) return false;
    let rate = options.rate ?? 1;
    if (options.speed !== undefined && contract.nominalSpeed) rate = Math.abs(options.speed) / contract.nominalSpeed;
    if (!Number.isFinite(rate)) rate = 1;
    const nextRate = THREE.MathUtils.clamp(rate, 0, 3), rateChanged = this.rate !== nextRate;
    this.rate = nextRate;
    next.setEffectiveTimeScale(this.rate);
    if (this.currentState === state && !options.restart) {
      // An event callback may pause/change this same action. Stop the old frame's
      // event integration before it divides by the newly zero/changed rate.
      if (rateChanged) this.generation++;
      return true;
    }
    const previous = this.actions.get(this.currentState);
    this.currentState = state; this.elapsed = 0; this.emitted.clear(); this.generation++;
    next.reset().setEffectiveTimeScale(this.rate).setEffectiveWeight(1)
      .setLoop(contract.loop ? THREE.LoopRepeat : THREE.LoopOnce, contract.loop ? Infinity : 1).play();
    next.clampWhenFinished = !contract.loop;
    if (previous && previous !== next) previous.crossFadeTo(next, this.transition, false);
    return true;
  }
  socketTransform(semantic: string) {
    const contract = this.definition.sockets[semantic];
    if (!contract || this.disposed) return undefined;
    this.root.updateWorldMatrix(true, true);
    const object = this.model.getObjectByName(contract.node);
    if (!object) return undefined;
    return {
      position: object.getWorldPosition(new THREE.Vector3()), quaternion: object.getWorldQuaternion(new THREE.Quaternion()),
      forward: contract.forward ? new THREE.Vector3(...contract.forward).transformDirection(object.matrixWorld) : undefined,
      up: contract.up ? new THREE.Vector3(...contract.up).transformDirection(object.matrixWorld) : undefined,
    };
  }
  update(dt: number, paused = false) {
    if (this.disposed || paused || !Number.isFinite(dt) || dt <= 0 || this.rate === 0) return;
    // Do not deliver a backlog of attacks after a suspended tab resumes.
    dt = Math.min(dt, .25);
    const state = this.currentState, contract = this.definition.clips[state], generation = this.generation;
    if (contract.loop) {
      this.elapsed = (this.elapsed + dt * this.rate) % contract.duration;
      this.mixer.update(dt); return;
    }
    const end = Math.min(contract.duration, this.elapsed + dt * this.rate);
    let cursor = this.elapsed;
    const events = (contract.events ?? []).map((event,index) => ({event,index})).sort((a,b) => a.event.at-b.event.at);
    for (const {event,index} of events) {
      if (this.emitted.has(index) || event.at < cursor || event.at > end) continue;
      this.mixer.update((event.at-cursor)/this.rate); cursor = event.at;
      this.elapsed = cursor; this.emitted.add(index);
      this.options.onEvent?.({ ...event, character: this.definition.id, state, clip: contract.name, transform: event.socket ? this.socketTransform(event.socket) : undefined });
      if (this.disposed || generation !== this.generation) return;
    }
    this.mixer.update((end-cursor)/this.rate); this.elapsed = end;
    if (end >= contract.duration) this.play(this.definition.defaultState);
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true; this.generation++; this.emitted.clear(); this.mixer.stopAllAction(); this.mixer.uncacheRoot(this.model);
    this.root.removeFromParent(); this.model.removeFromParent(); this.actions.clear(); disposeCharacterObject(this.model, this.options.environment);
  }
}
export function disposeCharacterObject(root: THREE.Object3D, sharedEnvironment?: THREE.Texture) {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>(), skeletons = new Set<THREE.Skeleton>();
  root.traverse(object => {
    const mesh = object as THREE.SkinnedMesh; if (!mesh.isMesh) return;
    geometries.add(mesh.geometry); if (mesh.isSkinnedMesh) skeletons.add(mesh.skeleton);
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.add(material);
  });
  for (const material of materials) {
    for (const value of Object.values(material)) if (value instanceof THREE.Texture && value !== sharedEnvironment) textures.add(value);
    material.dispose();
  }
  const bitmaps = new Set<{ close(): void }>();
  for (const texture of textures) {
    const image = texture.image as { close?: () => void } | undefined;
    if (typeof image?.close === 'function') bitmaps.add(image as { close(): void });
    texture.dispose();
  }
  bitmaps.forEach(bitmap => bitmap.close()); skeletons.forEach(skeleton => skeleton.dispose()); geometries.forEach(geometry => geometry.dispose());
}

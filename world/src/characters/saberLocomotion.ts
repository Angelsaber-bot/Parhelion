import * as THREE from 'three';

const RELAXED = ['RightArm', 'RightForeArm', 'RightHand', 'LeftArm', 'LeftForeArm'] as const;

/**
 * Preserve the published 61c52ed stationary carry, not the raw GLB's raised guard.
 * Idle retains its original breathing and the published five arm/blade aim targets.
 * Walk uses the same independently timed upper-body LOCAL curves: no new arm swing,
 * wrist roll, sword lift, trailing carry, or outfit-specific clearance adjustment.
 * Only the authored hips, legs and lower garment locomotion tracks keep moving.
 * Ordinary mixer tracks keep transitions reversible; Run and Attack remain untouched.
 */
export function publishedSaberIdleClip(model: THREE.Object3D, idle: THREE.AnimationClip) {
  const source = idle;
  // Clone transforms only, never the large skins/materials, and never pose the live model.
  function hierarchy(object: THREE.Object3D): THREE.Object3D {
    const copy = new THREE.Object3D(); copy.name = object.name;
    copy.position.copy(object.position); copy.quaternion.copy(object.quaternion); copy.scale.copy(object.scale);
    for (const child of object.children) if (!(child as THREE.Mesh).isMesh) copy.add(hierarchy(child));
    return copy;
  }
  const pose = hierarchy(model);
  const bone = (name: string) => pose.getObjectByName(`mixamorig${name}`) ?? pose.getObjectByName(`mixamorig:${name}`);
  const spine = bone('Spine');
  if (!spine || [...RELAXED, 'LeftHand'].some(name => !bone(name)) || RELAXED.some(name => !idle.tracks.some(track => track.name === `${bone(name)!.name}.quaternion`))) return source;
  const mixer = new THREE.AnimationMixer(pose), action = mixer.clipAction(idle);
  action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; action.play();
  mixer.update(0); pose.updateMatrixWorld(true);
  // This is exactly the published load-time calibration of the authored upright blade.
  const bladeLocal = new THREE.Vector3(0, 1, 0).applyQuaternion(bone('RightHand')!.getWorldQuaternion(new THREE.Quaternion()).invert());
  const originals = new Map(RELAXED.map(name => {
    const track = idle.tracks.find(track => track.name === `${bone(name)!.name}.quaternion`)!;
    return [name, (track as THREE.QuaternionKeyframeTrack & { createInterpolant(): THREE.Interpolant }).createInterpolant()];
  }));
  function aim(name: string, child: string | null, target: THREE.Vector3) {
    const joint = bone(name)!; joint.updateWorldMatrix(true, true);
    const world = joint.getWorldQuaternion(new THREE.Quaternion());
    const from = child ? bone(child)!.getWorldPosition(new THREE.Vector3()).sub(joint.getWorldPosition(new THREE.Vector3())).normalize() : bladeLocal.clone().applyQuaternion(world);
    const swing = new THREE.Quaternion().setFromUnitVectors(from, target.normalize());
    const parent = joint.parent!.getWorldQuaternion(new THREE.Quaternion());
    joint.quaternion.premultiply(parent.clone().invert().multiply(swing).multiply(parent));
    joint.updateWorldMatrix(false, true);
  }
  function publishedIdle(time: number) {
    mixer.setTime(time);
    // PropertyMixer can skip an unchanged sample. Do not accumulate our prior correction.
    for (const name of RELAXED) bone(name)!.quaternion.fromArray(originals.get(name)!.evaluate(time));
    pose.updateMatrixWorld(true);
    // Original stationary targets, including the original sword and wrist orientation.
    aim('RightArm', 'RightForeArm', new THREE.Vector3(-.5, -1, .08));
    aim('RightForeArm', 'RightHand', new THREE.Vector3(-.3, -.8, .5));
    aim('RightHand', null, new THREE.Vector3(-.55, -.85, .2));
    aim('LeftArm', 'LeftForeArm', new THREE.Vector3(.32, -1, .04));
    aim('LeftForeArm', 'LeftHand', new THREE.Vector3(.18, -1, .22));
  }
  publishedIdle(0);
  // Keep all non-arm Idle tracks byte-for-byte. Bake the original arm correction at
  // original keyframes plus 120 Hz; there is no redesigned stationary posture here.
  const timeSet = new Set<number>(idle.tracks.flatMap(track => Array.from(track.times)));
  const samples = Math.ceil(idle.duration * 120);
  for (let frame = 0; frame <= samples; frame++) timeSet.add(idle.duration * frame / samples);
  const times = [...timeSet].sort((a, b) => a - b), values = new Map(RELAXED.map(name => [name, [] as number[]]));
  for (const time of times) { publishedIdle(time); for (const name of RELAXED) values.get(name)!.push(...bone(name)!.quaternion.toArray()); }
  const replaced = new Set(RELAXED.map(name => `${bone(name)!.name}.quaternion`));
  const tracks = source.tracks.filter(track => !replaced.has(track.name)).map(track => track.clone());
  for (const name of RELAXED) tracks.push(new THREE.QuaternionKeyframeTrack(`${bone(name)!.name}.quaternion`, times, values.get(name)!));
  mixer.stopAllAction(); mixer.uncacheRoot(pose);
  return new THREE.AnimationClip(source.name, source.duration, tracks);
}

/**
 * Split only locomotion: the same upper Idle action runs on its natural 2.4 s clock
 * while legs/root keep their own Idle/Walk clocks and walking speed. Its weight is
 * exactly the sum of the locomotion weights, so authored Run/Attack blend normally.
 */
export class SaberIdleCarry {
  readonly action?: THREE.AnimationAction;
  private upper = new Set<string>();
  constructor(model: THREE.Object3D, mixer: THREE.AnimationMixer, idle: THREE.AnimationClip) {
    const restored = publishedSaberIdleClip(model, idle);
    if (restored === idle) return; // Unsupported rig: leave every original clip alone.
    const spine = model.getObjectByName('mixamorigSpine') ?? model.getObjectByName('mixamorig:Spine');
    spine!.traverse(object => this.upper.add(object.name));
    this.action = mixer.clipAction(new THREE.AnimationClip('PublishedIdleUpperBody', restored.duration,
      restored.tracks.filter(track => this.isUpper(track)).map(track => track.clone()))).play();
  }
  private isUpper(track: THREE.KeyframeTrack) { return this.upper.has(track.name.slice(0, track.name.lastIndexOf('.'))); }
  locomotionClip(source: THREE.AnimationClip) {
    if (!this.action || !['Idle', 'Walk'].includes(source.name)) return source;
    return new THREE.AnimationClip(source.name, source.duration, source.tracks.filter(track => !this.isUpper(track)).map(track => track.clone()));
  }
  updateWeight(idle?: THREE.AnimationAction, walk?: THREE.AnimationAction) {
    if (!this.action) return;
    const weight = (action?: THREE.AnimationAction) => action?.enabled && action.isScheduled() ? action.getEffectiveWeight() : 0;
    this.action.setEffectiveWeight(Math.min(1, weight(idle) + weight(walk)));
  }
}

/** Visual-only planar gait. No controller velocity, input, collision or combat ownership. */
import * as THREE from 'three';
import type { SkinnedCharacterRig } from './skinnedCharacter';

export function playerStride(speed: number) {
  const run = THREE.MathUtils.clamp(speed / 9, 0, 1);
  const reach = .21 + .035 * run;
  const cadence = .90 + .18 * speed;
  // At game-speed jogging/sprinting the short stance is followed by a flight phase.
  // The stance derivative is exactly -speed; do not speed up a sine wave and call it planted.
  const stance = THREE.MathUtils.clamp(2 * reach * cadence / Math.max(speed, .01), .05, .62);
  return { cadence, stance, reach, lift: .045 + .085 * run };
}

/** Exact integral of the exponentially filtered speed, including the low-speed fade.
 * Sampling the new speed with Euler integration makes identical inputs stride differently
 * at 30/60/120 Hz; keep phase continuous and rate-independent through start/stop. */
export function advancePlayerStride(previous: number, target: number, dt: number) {
  const next = target + (previous - target) * Math.exp(-10 * dt);
  const integral = (start: number, duration: number) => {
    const a = start - target, decay = Math.exp(-10 * duration);
    const first = target * duration + a * (1 - decay) / 10;
    const second = target * target * duration + 2 * target * a * (1 - decay) / 10 + a * a * (1 - decay * decay) / 20;
    const low = (start + target + a * decay) * .5 < .8;
    return low ? (.9 * first + .18 * second) / .8 : .9 * duration + .18 * first;
  };
  let cycles: number;
  if ((previous < .8 && next > .8) || (previous > .8 && next < .8)) {
    const split = -Math.log((.8 - target) / (previous - target)) / 10;
    cycles = integral(previous, split) + integral(.8, dt - split);
  } else cycles = integral(previous, dt);
  return { speed: next, phase: cycles * Math.PI * 2 };
}

export function samplePlayerFoot(phase: number, speed: number) {
  const { stance, reach, lift } = playerStride(speed);
  const p = ((phase / (Math.PI * 2)) % 1 + 1) % 1;
  if (p < stance) return { z: reach * (1 - 2 * p / stance), y: 0, swing: 0, contact: true };
  const u = (p - stance) / (1 - stance), u2 = u * u, u3 = u2 * u;
  // Hermite return matches stance velocity at both ends; no toe-off/landing position kink.
  const tangent = -2 * reach / stance * (1 - stance);
  const z = (2 * u3 - 3 * u2 + 1) * -reach + (u3 - 2 * u2 + u) * tangent
    + (-2 * u3 + 3 * u2) * reach + (u3 - u2) * tangent;
  const swing = Math.sin(Math.PI * u) ** 2;
  return { z, y: lift * swing, swing, contact: false };
}

function setWorldQuaternion(bone: THREE.Object3D, world: THREE.Quaternion) {
  const parent = bone.parent?.getWorldQuaternion(new THREE.Quaternion()) ?? new THREE.Quaternion();
  bone.quaternion.copy(parent.invert().multiply(world)); bone.updateWorldMatrix(false, true);
}
function aimLink(bone: THREE.Bone, child: THREE.Bone, direction: THREE.Vector3) {
  const current = child.getWorldPosition(new THREE.Vector3()).sub(bone.getWorldPosition(new THREE.Vector3())).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(current, direction.normalize()).multiply(bone.getWorldQuaternion(new THREE.Quaternion()));
  setWorldQuaternion(bone, q);
}

/** Bind-aware two-link leg solve, blended with the existing airborne pose. Flat local support
 * only: this does not raycast terrain, change capsule height, or claim slope foot locking. */
export function posePlayerGroundLeg(rig: SkinnedCharacterRig, side: 'L' | 'R', targetLocal: THREE.Vector3, weight: number, swing: number) {
  if (weight <= 0) return;
  const upper = rig.joints[`Thigh_${side}`] as THREE.Bone, lower = rig.joints[`Shin_${side}`] as THREE.Bone, foot = rig.joints[`Foot_${side}`] as THREE.Bone;
  const old = [upper.quaternion.clone(), lower.quaternion.clone(), foot.quaternion.clone()];
  const rootQ = rig.root.getWorldQuaternion(new THREE.Quaternion());
  const hip = upper.getWorldPosition(new THREE.Vector3()), target = rig.root.localToWorld(targetLocal.clone());
  const length1 = rig.rest.get(upper)!.rootP.distanceTo(rig.rest.get(lower)!.rootP);
  const length2 = rig.rest.get(lower)!.rootP.distanceTo(rig.rest.get(foot)!.rootP);
  const delta = target.sub(hip), distance = THREE.MathUtils.clamp(delta.length(), Math.abs(length1 - length2) + .0001, length1 + length2 - .0001), axis = delta.normalize();
  const pole = new THREE.Vector3(0, 0, 1).applyQuaternion(rootQ); pole.addScaledVector(axis, -pole.dot(axis)).normalize();
  const along = (length1 * length1 - length2 * length2 + distance * distance) / (2 * distance);
  const height = Math.sqrt(Math.max(0, length1 * length1 - along * along));
  const knee = hip.clone().addScaledVector(axis, along).addScaledVector(pole, height);
  aimLink(upper, lower, knee.clone().sub(hip));
  aimLink(lower, foot, hip.clone().addScaledVector(axis, distance).sub(knee));
  // Neutral in contact; a small dorsiflexion clears the toe in swing, not a rigid toe drag.
  const footQ = rootQ.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -.12 * swing)).multiply(rig.rest.get(foot)!.rootQ);
  setWorldQuaternion(foot, footQ);
  [upper, lower, foot].forEach((bone, i) => bone.quaternion.slerpQuaternions(old[i], bone.quaternion.clone(), weight));
  upper.updateWorldMatrix(false, true);
}

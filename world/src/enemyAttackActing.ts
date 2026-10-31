import * as THREE from 'three';
import { enemyAttackTiming, type Enemy } from './combat';
import type { EnemyPoseModel } from './enemyAttackPresentation';

const smooth = (x: number) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
/** Native models use opposite sword hands. Never rotate a generic arm Euler axis:
 * aim the real bind-aware chain and retain the weapon's measured hand-local axis.
 */
export const ENEMY_WEAPON_HAND = { samurai: 'R', officer: 'L', sunward_guard: 'R', deck_raider: 'L' } as const;
type SwordModel = keyof typeof ENEMY_WEAPON_HAND;
const isSword = (model: EnemyPoseModel): model is SwordModel => model in ENEMY_WEAPON_HAND;

export interface EnemyWeaponAxis { axis: THREE.Vector3; reach: number }
const calibrations = new WeakMap<THREE.Object3D, Map<string, EnemyWeaponAxis>>();
/** One-time immutable-template measurement, shared by all clones/LODs of that template.
 * The farthest hand-weighted vertex is the held blade tip, not an invented socket.
 */
export function measureEnemyWeaponAxis(template: THREE.Object3D, side: string): EnemyWeaponAxis | null {
  let cache = calibrations.get(template); if (!cache) { cache = new Map(); calibrations.set(template, cache); }
  const prior = cache.get(side); if (prior) return prior;
  const hand = template.getObjectByName(`hand${side}`); if (!hand) return null;
  template.updateWorldMatrix(true, true);
  const origin = hand.getWorldPosition(new THREE.Vector3()), point = new THREE.Vector3(), tip = new THREE.Vector3(); let reach = 0;
  template.traverse(o => {
    if (!(o instanceof THREE.SkinnedMesh)) return;
    const index = o.skeleton.bones.indexOf(hand as THREE.Bone); if (index < 0) return;
    const indices = o.geometry.attributes.skinIndex, weights = o.geometry.attributes.skinWeight;
    o.skeleton.update();
    for (let i = 0; i < indices.count; i++) {
      let held = false;
      for (let k = 0; k < 4; k++) if (indices.getComponent(i, k) === index && weights.getComponent(i, k) > .8) { held = true; break; }
      if (!held) continue;
      o.getVertexPosition(i, point).applyMatrix4(o.matrixWorld);
      const distance = point.distanceTo(origin); if (distance > reach) { reach = distance; tip.copy(point); }
    }
  });
  if (reach < .4 || reach > 2) return null;
  const result = { axis: hand.worldToLocal(tip).normalize(), reach }; cache.set(side, result); return result;
}

/** Clone-only, upper-body acting. The native clip is sampled first every frame;
 * no accumulation, root translation, foot displacement, hitbox or game-clock change.
 * Missing/foreign rigs gracefully retain their native clip.
 */
export function createEnemyAttackActing(root: THREE.Object3D, template: THREE.Object3D, model: EnemyPoseModel) {
  if (!isSword(model)) return { restore() {}, update(_e: Enemy) {} };
  const side = ENEMY_WEAPON_HAND[model], sign = side === 'R' ? -1 : 1;
  const upper = root.getObjectByName(`upper_arm${side}`), lower = root.getObjectByName(`forearm${side}`), hand = root.getObjectByName(`hand${side}`);
  const spine = root.getObjectByName('spine'), chest = root.getObjectByName('chest');
  const weapon = measureEnemyWeaponAxis(template, side);
  if (!upper || !lower || !hand || !spine || !chest || !weapon) return { restore() {}, update(_e: Enemy) {} };
  const affected = [upper, lower, hand, spine, chest];
  const native = affected.map(bone => bone.quaternion.clone());
  let applied = false;
  const vectors = Array.from({ length: 48 }, () => new THREE.Vector3()), quaternions = Array.from({ length: 24 }, () => new THREE.Quaternion());
  let vi = 0, qi = 0;
  const v = (x = 0, y = 0, z = 0) => vectors[vi++].set(x, y, z), q = () => quaternions[qi++].identity();
  const copy = (value: THREE.Vector3) => v().copy(value);
  const world = (value: THREE.Vector3) => root.localToWorld(value);
  const axis = (value: THREE.Vector3) => value.transformDirection(root.matrixWorld);
  const setWorld = (bone: THREE.Object3D, rotation: THREE.Quaternion) => {
    bone.quaternion.copy(bone.parent!.getWorldQuaternion(q()).invert().multiply(rotation)); bone.updateWorldMatrix(false, true);
  };
  const aim = (bone: THREE.Object3D, child: THREE.Object3D, target: THREE.Vector3) => {
    const origin = bone.getWorldPosition(v()), from = child.getWorldPosition(v()).sub(origin).normalize(), to = copy(target).sub(origin).normalize();
    setWorld(bone, q().setFromUnitVectors(from, to).multiply(bone.getWorldQuaternion(q())));
  };
  return {
    restore() {
      // AnimationMixer may skip unchanged property writes. Undo our last overlay
      // before sampling, even on a paused/identical frame, to prevent pose accumulation.
      if (!applied) return;
      affected.forEach((bone, i) => bone.quaternion.copy(native[i])); applied = false;
      root.updateWorldMatrix(true, true);
    },
    update(e: Enemy) {
    if (e.mode !== 'windup' && !(e.mode === 'recover' && e.contactSequence === e.attackCount && e.attackCount > 0)) return;
    // Burst/shot remains its native command/fire pose; do not pretend a sword cut fired a rifle.
    if (e.attack === 'shot' || e.attack === 'burst') return;
    vi = qi = 0;
    const timing = enemyAttackTiming(e), windup = e.mode === 'windup';
    const remaining = Math.max(0, e.timer), elapsed = windup ? timing.windup - remaining : timing.recovery - remaining;
    const stroke = windup ? smooth(1 - remaining / .2) : 1;
    const follow = windup ? 0 : smooth(elapsed / Math.min(.2, timing.recovery * .4));
    const release = windup ? 0 : smooth((elapsed - Math.min(.2, timing.recovery * .4)) / Math.max(.1, timing.recovery - Math.min(.2, timing.recovery * .4)));
    const weight = (windup ? smooth(elapsed / .22) : 1) * (1 - release);
    if (weight <= 0) return;
    affected.forEach((bone, i) => native[i].copy(bone.quaternion)); applied = true;
    root.updateWorldMatrix(true, true);
    // Build a recognizable shoulder/chest preparation, commit and open recovery.
    const yaw = (sign * .22 * (1 - stroke) - sign * .18 * follow) * weight;
    for (const [bone, share] of [[spine, .35], [chest, .65]] as const) {
      const rotation = q().setFromAxisAngle(axis(v(0, 1, 0)), yaw * share).multiply(bone.getWorldQuaternion(q()));
      setWorld(bone, rotation);
    }
    const targetLocal = v(sign * .34, 1.43, .13).lerp(v(sign * .17, 1.22, .44), stroke).lerp(v(-sign * .12, 1.09, .38), follow);
    const currentHand = hand.getWorldPosition(v()), target = currentHand.lerp(world(targetLocal), weight);
    const desired = axis(v(sign * .34, .90, -.15).lerp(v(-sign * .12, -.18, 1), stroke).lerp(v(-sign * .85, -.32, .48), follow).normalize());
    const originalHand = hand.getWorldQuaternion(q());
    const originalBlade = copy(weapon.axis).applyQuaternion(originalHand).normalize();
    const targetRotation = q().setFromUnitVectors(originalBlade, desired).multiply(originalHand);
    const handRotation = q().copy(originalHand).slerp(targetRotation, weight);
    const a = upper.getWorldPosition(v()), b = lower.getWorldPosition(v()), c = hand.getWorldPosition(v());
    const l1 = a.distanceTo(b), l2 = b.distanceTo(c), delta = copy(target).sub(a), distance = THREE.MathUtils.clamp(delta.length(), Math.abs(l1 - l2) + .0001, l1 + l2 - .0001), direction = delta.normalize();
    const along = (l1 * l1 - l2 * l2 + distance * distance) / (2 * distance), height = Math.sqrt(Math.max(0, l1 * l1 - along * along));
    const pole = axis(v(sign, -.5, -.15)); pole.addScaledVector(direction, -pole.dot(direction)).normalize();
    aim(upper, lower, copy(a).addScaledVector(direction, along).addScaledVector(pole, height));
    aim(lower, hand, copy(a).addScaledVector(direction, distance)); setWorld(hand, handRotation);
  } };
}

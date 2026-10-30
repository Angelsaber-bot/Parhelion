import * as THREE from 'three';
import { TICK_HZ, WEAPONS } from '../shared/content.ts';

type Pose = { position: [number, number, number]; rotation: [number, number, number] };
const pose = (position: Pose['position'], rotation: Pose['rotation']): Pose => ({ position, rotation });
const smooth = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
/** Strikes speed up into contact rather than easing in, so the hit lands with weight. */
const accelerate = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (2 - t * .9) / 1.1; };
const mix = (a: Pose, b: Pose, alpha: number): Pose => ({
  position: a.position.map((v, i) => v + (b.position[i] - v) * alpha) as Pose['position'],
  rotation: a.rotation.map((v, i) => v + (b.rotation[i] - v) * alpha) as Pose['rotation'],
});

/** All times are visual only. Windup reaches contact at the authoritative impact tick. */
export function meleeRecoverySeconds(weapon: number): number {
  const w = WEAPONS[weapon];
  return w?.kind === 'melee' ? Math.max(.1, (w.interval - (w.windup ?? 0)) / TICK_HZ) : .15;
}
export function meleeMotion(weapon: number, windup: number, strike: number, firstPerson: boolean): Pose {
  const ready = Math.max(0, Math.min(1, windup)), hit = Math.max(0, Math.min(1, strike));
  const pole = weapon === 6, hammer = weapon === 7;
  // Rotation convention: +x lifts the tip/head, +y swings it left, z rolls the edge.
  const frames = firstPerson ? (pole ? [
    // Angled across the view so the shaft stays readable; pull back, then a long straight thrust.
    pose([.3, -.3, -.7], [.1, .26, -.2]), pose([.38, -.24, -.5], [.06, .3, -.1]),
    pose([.12, -.17, -1.05], [.05, .1, -.12]), pose([.1, -.19, -1.12], [.03, .08, -.14]),
  ] : hammer ? [
    // Overhead smash: haul the head up over the right shoulder, then drive it down through the target.
    pose([.26, -.3, -.7], [.55, .1, -.25]), pose([.34, .02, -.5], [1.45, -.15, -.5]),
    pose([.05, -.12, -.78], [-.2, .1, -.1]), pose([.02, -.28, -.74], [-.6, .12, -.05]),
  ] : [
    // Diagonal cut: cock the blade high over the right shoulder, slash down-left across the screen.
    pose([.26, -.28, -.6], [.75, .2, -.35]), pose([.36, -.04, -.52], [1.25, -.55, -.9]),
    pose([.02, -.13, -.64], [-.1, .95, -.45]), pose([-.16, -.27, -.6], [-.4, 1.25, -.55]),
  ]) : (pole ? [
    pose([.16, -.08, -.32], [0, 0, 0]), pose([.2, -.04, -.12], [-.12, .1, .06]),
    pose([.13, -.06, -.82], [.04, 0, -.08]), pose([.12, -.08, -.9], [.08, -.03, -.1]),
  ] : hammer ? [
    pose([.16, -.08, -.32], [.35, 0, 0]), pose([.2, .32, -.12], [1.7, -.1, .1]),
    pose([.08, -.12, -.5], [-.55, .08, -.1]), pose([.04, -.22, -.52], [-.85, .12, -.15]),
  ] : [
    pose([.16, -.08, -.32], [.3, 0, 0]), pose([.26, .22, -.2], [1.2, -.75, .5]),
    pose([.02, -.04, -.48], [-.05, .7, -.6]), pose([-.1, -.14, -.46], [-.35, 1.05, -.75]),
  ]);
  const [idle, anticipation, contact, followThrough] = frames;
  if (ready > 0) {
    // Readable preparation, then a fast strike into contact instead of a single-frame pose snap.
    const release = hammer ? .74 : pole ? .7 : .62;
    return ready < release ? mix(idle, anticipation, smooth(ready / release))
      : mix(anticipation, contact, accelerate((ready - release) / (1 - release)));
  }
  if (hit > 0) {
    const elapsed = 1 - hit, follow = hammer ? .26 : .2;
    return elapsed < follow ? mix(contact, followThrough, smooth(elapsed / follow))
      : mix(followThrough, idle, smooth((elapsed - follow) / (1 - follow)));
  }
  return idle;
}

/** Cosmetic poses only. Impact timing/range/arc always come from shared authoritative rules. */
export function poseMelee(root: THREE.Group, weapon: number, windup: number, strike: number, firstPerson: boolean) {
  const current = meleeMotion(weapon, windup, strike, firstPerson);
  root.position.set(...current.position); root.rotation.set(...current.rotation);
  if (!firstPerson) {
    // Keep the authored right-hand grip anchored while rotating its complete weapon mount.
    const grip = new THREE.Vector3(0, -.1, .07).multiply(root.scale);
    root.position.add(grip).sub(grip.clone().applyEuler(root.rotation));
  }
}
export function meleeWindupProgress(remaining: number, total: number) {
  return remaining > 0 ? Math.max(.04, Math.min(1, 1 - remaining / Math.max(1, total))) : 0;
}

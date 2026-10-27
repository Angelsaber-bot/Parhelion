import * as THREE from 'three';
import { TICK_HZ, WEAPONS } from '../shared/content.ts';

type Pose = { position: [number, number, number]; rotation: [number, number, number] };
const pose = (position: Pose['position'], rotation: Pose['rotation']): Pose => ({ position, rotation });
const smooth = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
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
  const frames = firstPerson ? (pole ? [
    pose([.24, -.24, -.98], [-.12, -.1, -.15]), pose([.27, -.2, -.91], [-.22, .03, .04]),
    pose([.16, -.2, -1.3], [.02, 0, -.1]), pose([.14, -.22, -1.4], [.06, -.04, -.12]),
  ] : hammer ? [
    pose([.25, -.27, -.83], [-.38, -.12, -.18]), pose([.3, -.16, -.97], [-.95, -.16, -.04]),
    pose([.18, -.31, -.99], [.2, .08, -.3]), pose([.12, -.4, -1.01], [.48, .14, -.38]),
  ] : [
    pose([.25, -.25, -.75], [-.15, -.15, -.2]), pose([.32, -.18, -.86], [-.25, -.65, .1]),
    pose([.06, -.23, -.88], [.05, .5, -.65]), pose([-.02, -.3, -.92], [.25, .65, -.8]),
  ]) : (pole ? [
    pose([.16, -.08, -.32], [0, 0, 0]), pose([.19, -.04, -.22], [-.18, .08, .06]),
    pose([.13, -.06, -.73], [.08, 0, -.08]), pose([.12, -.08, -.82], [.15, -.03, -.1]),
  ] : hammer ? [
    pose([.16, -.08, -.32], [0, 0, 0]), pose([.23, .14, -.25], [-1.08, -.12, .14]),
    pose([.08, -.18, -.48], [.6, .12, -.18]), pose([.02, -.26, -.54], [.85, .2, -.28]),
  ] : [
    pose([.16, -.08, -.32], [0, 0, 0]), pose([.25, .06, -.25], [-.28, -.85, .35]),
    pose([.03, -.08, -.45], [.18, .65, -.58]), pose([-.07, -.15, -.47], [.26, .9, -.72]),
  ]);
  const [idle, anticipation, contact, followThrough] = frames;
  if (ready > 0) {
    // Readable preparation, then a fast strike into contact instead of a single-frame pose snap.
    const release = hammer ? .74 : pole ? .7 : .62;
    return ready < release ? mix(idle, anticipation, smooth(ready / release))
      : mix(anticipation, contact, smooth((ready - release) / (1 - release)));
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

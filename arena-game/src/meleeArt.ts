import * as THREE from 'three';
/** Cosmetic poses only. Impact timing/range/arc come from shared authoritative rules. */
export function poseMelee(root: THREE.Group, weapon: number, windup: number, strike: number, firstPerson: boolean) {
  const ready = Math.max(0, Math.min(1, windup));
  const hit = Math.max(0, Math.min(1, strike));
  const pole = weapon === 6, hammer = weapon === 7;
  if (firstPerson) {
    root.position.set(.23 + ready * .06 - hit * .12, -.22 + ready * .06 - hit * .04, (pole ? -.82 : -.62) + ready * .08 - hit * (pole ? .26 : .05));
    root.rotation.set(hammer ? -.35 - ready * .65 + hit * .65 : -.12 - ready * .18 + hit * .18,
      pole ? -.12 + ready * .12 : -.22 - ready * .42 + hit * .75,
      hammer ? -.18 + ready * .2 : -.18 + ready * .3 - hit * .45);
  } else {
    root.position.set(.16 + ready * .12 - hit * .13, -.08 + ready * .16, -.32 + ready * .08 - hit * (pole ? .35 : .08));
    root.rotation.set(hammer ? -ready * .9 + hit * .6 : -ready * .25 + hit * .15,
      pole ? 0 : -ready * .65 + hit * .8,
      hammer ? ready * .15 : ready * .35 - hit * .45);
    // Pivot about the right-hand grip, instead of letting the handle orbit away from it.
    const grip = new THREE.Vector3(0, -.1, .07).multiply(root.scale);
    root.position.add(grip).sub(grip.clone().applyEuler(root.rotation));
  }
}
export function meleeWindupProgress(remaining: number, total: number) {
  return remaining > 0 ? Math.max(.08, Math.min(1, 1 - remaining / Math.max(1, total))) : 0;
}

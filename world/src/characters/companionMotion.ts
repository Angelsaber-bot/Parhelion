import * as THREE from 'three';

export const COMPANION_MOTION = { maxRate: 3, walkRate: 1.8, turnRate: 8, acceleration: 14, deceleration: 20, stopDistance: .25 } as const;
/** The shortest bounded turn, including crossing +/-PI. Returns the remaining angle. */
export function turnCompanion(root: THREE.Object3D, heading: number, dt: number) {
  const angle = Math.atan2(Math.sin(heading - root.rotation.y), Math.cos(heading - root.rotation.y));
  root.rotation.y += THREE.MathUtils.clamp(angle, -COMPANION_MOTION.turnRate * dt, COMPANION_MOTION.turnRate * dt);
  return Math.atan2(Math.sin(heading - root.rotation.y), Math.cos(heading - root.rotation.y));
}
export function companionGait(speed: number, walkSpeed: number, wasRunning: boolean) {
  return speed > walkSpeed * COMPANION_MOTION.walkRate * (wasRunning ? .88 : 1) ? 'run' : 'walk';
}
/** Visual follow smoothing only; callers retain their existing collision, target and leash rules. */
export class CompanionMotion {
  private speed = 0;
  reset() { this.speed = 0; }
  step(root: THREE.Object3D, destination: THREE.Vector3, dt: number, maxSpeed: number) {
    if (dt <= 0) return 0;
    const delta = destination.clone().sub(root.position), distance = Math.hypot(delta.x, delta.z);
    if (distance <= COMPANION_MOTION.stopDistance + .005) { this.reset(); return 0; }
    const turn = turnCompanion(root, Math.atan2(delta.x, delta.z), dt);
    // No moonwalk during a reversal: rotate first, then accelerate into the new heading.
    const alignment = Math.max(0, Math.cos(turn));
    const target = Math.min(maxSpeed, (distance - COMPANION_MOTION.stopDistance) * 3) * alignment * alignment;
    const acceleration = target > this.speed ? COMPANION_MOTION.acceleration : COMPANION_MOTION.deceleration;
    this.speed += THREE.MathUtils.clamp(target - this.speed, -acceleration * dt, acceleration * dt);
    // Existing momentum must not carry an actor backwards while it is facing away.
    const step = Math.min(this.speed * alignment * dt, distance - COMPANION_MOTION.stopDistance);
    root.position.addScaledVector(delta, step / distance);
    return step / dt;
  }
}

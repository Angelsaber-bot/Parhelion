import * as THREE from 'three';
import type { CharacterKit, KitEventResult } from './characters/characterKit';
import type { Collider } from './player';

type Target = { id: string; position: THREE.Vector3 } | null;
export interface KitCompanionOptions {
  colliders: Collider[];
  /** Acquisition range (m): melee servants stay close, Blackbeard's pistol reaches further. */
  range: number;
  /** Damage per authored hit/fire event. */
  damage: number;
  target: (position: THREE.Vector3, range: number) => Target;
  strike: (position: THREE.Vector3, range: number, damage: number, targetId: string) => Target;
  /** Enemy to go after (lock-on radius around the player); null keeps the follow slot. */
  engage?: (player: THREE.Vector3) => Target;
}

/**
 * Follow/assist behaviour for an era servant's CharacterKit once they are the active companion.
 * Mirrors ContractServant: stays beside the player, snaps back when separated, and only deals damage
 * on the kit's authored hit/fire events (never invented timing).
 */
export class KitCompanion {
  private activeLast = false;
  private attackTarget: string | null = null;
  private readonly ray = new THREE.Ray();
  private readonly down = new THREE.Vector3(0, -1, 0);
  constructor(private options: KitCompanionOptions) {}
  get attacking() { return this.attackTarget !== null; }
  /** Wire as the kit's onEvent. */
  onEvent(actor: CharacterKit, event: KitEventResult) {
    if (event.state !== 'attack' || !this.attackTarget) return;
    const { range, damage } = this.options;
    // Ranged shots need a little slack beyond acquisition range if the target stepped back.
    this.options.strike(actor.root.position, range + (event.kind === 'fire' ? 2 : 1), damage, this.attackTarget);
  }
  /** The servant stopped following (recalled, switched, defeated, swimming…). */
  release(actor?: CharacterKit) {
    this.activeLast = false; this.attackTarget = null;
    if (actor && actor.state === 'attack') actor.play(actor.definition.defaultState);
  }
  update(actor: CharacterKit, dt: number, player: THREE.Vector3, yaw: number, paused: boolean) {
    if (paused) return;
    dt = Number.isFinite(dt) ? Math.max(0, Math.min(.1, dt)) : 0;
    const root = actor.root;
    // Opposite side from Saber's slot so a quick switch never stacks them visually.
    const destination = player.clone().add(new THREE.Vector3(-Math.cos(yaw) * 2.4 - Math.sin(yaw) * .8, 0, Math.sin(yaw) * 2.4 - Math.cos(yaw) * .8));
    const prey = this.options.engage?.(player);
    // Melee closes in; Blackbeard keeps pistol distance.
    if (prey) destination.copy(prey.position).add(root.position.clone().sub(prey.position).setY(0).normalize().multiplyScalar(Math.max(1.4, Math.min(5, this.options.range) - 1.5)));
    const ground = this.floor(destination.x, destination.z, player.y);
    if (ground !== null) destination.y = ground;
    if (!this.activeLast || root.position.distanceTo(player) > 24) {
      root.position.copy(ground !== null && this.visiblePath(player, destination) ? destination : player);
      this.release(actor);
    }
    this.activeLast = true;
    if (actor.state === 'attack') { actor.update(dt); if (actor.state !== 'attack') this.attackTarget = null; return; }
    this.attackTarget = null;
    let speed = 0;
    const distance = root.position.distanceTo(destination);
    if (distance > .6 && ground !== null && this.visiblePath(root.position, destination)) {
      const delta = destination.clone().sub(root.position);
      speed = Math.min(6, (distance - .25) * 3);
      root.position.addScaledVector(delta, Math.min(1, dt * speed / distance));
      root.rotation.y = Math.atan2(delta.x, delta.z);
    }
    const target = this.options.target(root.position, this.options.range);
    if (target && actor.definition.clips.attack) {
      this.attackTarget = target.id;
      root.rotation.y = Math.atan2(target.position.x - root.position.x, target.position.z - root.position.z);
      actor.play('attack', { restart: true });
    } else {
      const running = speed > (actor.state === 'run' ? 2.2 : 2.6);
      if (speed < .1) actor.play('idle');
      else actor.play(running ? 'run' : 'walk', { rate: THREE.MathUtils.clamp(speed / (actor.definition.clips[running ? 'run' : 'walk'].nominalSpeed ?? 1), .65, 1.8) });
    }
    actor.update(dt);
  }
  private floor(x: number, z: number, baseY: number) {
    this.ray.origin.set(x, baseY + 1.1, z); this.ray.direction.copy(this.down);
    let best = Infinity;
    for (const c of this.options.colliders) if (c.enabled) {
      const hit = c.bvh.raycastFirst(this.ray, THREE.DoubleSide);
      if (hit && hit.distance < best && hit.distance < 3 && Math.abs(hit.face?.normal.y ?? 0) > .7) best = hit.distance;
    }
    return best < Infinity ? baseY + 1.1 - best : null;
  }
  private visiblePath(from: THREE.Vector3, to: THREE.Vector3) {
    this.ray.origin.copy(from).add(new THREE.Vector3(0, .8, 0));
    this.ray.direction.copy(to).sub(from); const distance = this.ray.direction.length();
    if (!distance) return true;
    this.ray.direction.divideScalar(distance);
    return !this.options.colliders.some(c => c.enabled && (c.bvh.raycastFirst(this.ray, THREE.DoubleSide)?.distance ?? Infinity) < distance);
  }
}

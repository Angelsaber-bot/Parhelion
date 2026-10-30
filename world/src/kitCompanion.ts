import * as THREE from 'three';
import type { CharacterKit, KitEventResult } from './characters/characterKit';
import type { Collider } from './player';
import { validSkillPose, type SkillPoseCommand } from './skillPose';
import { MountedCharge } from './mountedCharge';
import { CompanionMotion, COMPANION_MOTION, companionGait, turnCompanion } from './characters/companionMotion';

type Target = { id: string; position: THREE.Vector3 } | null;
export interface KitCompanionOptions {
  colliders: Collider[];
  /** Acquisition range (m): melee servants stay close, Blackbeard's pistol reaches further. */
  range: number;
  /** Damage per authored hit/fire event. */
  damage: number;
  target: (position: THREE.Vector3, range: number, targetId?: string) => Target;
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
  private motion = new CompanionMotion();
  private attackYaw = 0;
  private attackTarget: string | null = null;
  private readonly ray = new THREE.Ray();
  private readonly down = new THREE.Vector3(0, -1, 0);
  private mounted?: MountedCharge;
  private skillPose?: { command: SkillPoseCommand; contacts: number; elapsed: number; started: boolean };
  constructor(private options: KitCompanionOptions) {}
  get attacking() { if (this.skillPose) return true; return this.mounted?.attacking ?? this.attackTarget !== null; }
  get mountedPhase() { return this.mounted?.phase; }
  /** Wire as the kit's onEvent. */
  onEvent(actor: CharacterKit, event: KitEventResult) {
    if (actor.definition.mount) { this.mounted?.onEvent(actor, event); return; }
    const pose = this.skillPose;
    if (pose) {
      if (event.state !== 'attack' || pose.contacts >= pose.command.contacts) return;
      pose.contacts++;
      pose.command.onContact(event.transform?.position ?? actor.root.position, { x: Math.sin(this.attackYaw), y: 0, z: Math.cos(this.attackYaw) }, event.socket, { losOffset: event.transform ? 0 : 1, casterFeetY: actor.root.position.y });
      return;
    }
    if (event.state !== 'attack' || !this.attackTarget) return;
    const { range, damage } = this.options;
    // Ranged shots need a little slack beyond acquisition range if the target stepped back.
    this.options.strike(actor.root.position, range + (event.kind === 'fire' ? 2 : 1), damage, this.attackTarget);
  }
  /** Starts only a loaded live actor; no ordinary ally damage can leak from its skill montage. */
  startSkillPose(actor: CharacterKit, command: SkillPoseCommand, player: THREE.Vector3, yaw: number): boolean {
    if (!validSkillPose(command) || !actor.root.visible || actor.root.position.distanceTo(player) > 24 || !actor.definition.clips.attack?.events?.length) return false;
    if (actor.definition.mount) {
      this.mounted ??= new MountedCharge(this.options);
      return this.mounted.startSkillPose(actor, command, player, yaw);
    }
    this.release(actor);
    this.activeLast = true;
    this.attackYaw = Math.atan2(command.direction.x, command.direction.z);
    this.skillPose = { command, contacts: 0, elapsed: 0, started: false };
    actor.play(actor.definition.defaultState);
    return true;
  }
  cancelSkillPose(actor?: CharacterKit) {
    const pose = this.skillPose; this.skillPose = undefined;
    if (pose) { if (actor) actor.play(actor.definition.defaultState); pose.command.onFinish(false); }
    this.mounted?.cancelSkillPose(actor);
  }
  /** The servant stopped following (recalled, switched, defeated, swimming…). */
  release(actor?: CharacterKit) {
    this.cancelSkillPose(actor);
    this.mounted?.release(actor);
    this.activeLast = false; this.attackTarget = null; this.motion.reset();
    if (actor && actor.state === 'attack') actor.play(actor.definition.defaultState);
  }
  update(actor: CharacterKit, dt: number, player: THREE.Vector3, yaw: number, paused: boolean) {
    if (paused) { this.cancelSkillPose(actor); return; }
    dt = Number.isFinite(dt) ? Math.max(0, Math.min(.1, dt)) : 0;
    if (actor.definition.mount) {
      this.mounted ??= new MountedCharge(this.options);
      this.mounted.update(actor, dt, player, yaw); return;
    }
    const root = actor.root;
    const pose = this.skillPose;
    if (pose) {
      pose.elapsed += dt;
      if (pose.elapsed > 7.5 || root.position.distanceTo(player) > 24) { this.cancelSkillPose(actor); return; }
      turnCompanion(root, this.attackYaw, dt);
      if (!pose.started) {
        const angle = Math.atan2(Math.sin(this.attackYaw - root.rotation.y), Math.cos(this.attackYaw - root.rotation.y));
        if (Math.abs(angle) > .08) { actor.update(dt); return; }
        pose.started = true; actor.play('attack', { restart: true });
      }
      actor.update(dt);
      if (this.skillPose !== pose) return;
      if (actor.state !== 'attack') {
        if (pose.contacts >= pose.command.contacts) { this.skillPose = undefined; pose.command.onFinish(true); }
        else actor.play('attack', { restart: true });
      }
      return;
    }
    // Opposite side from Saber's slot so a quick switch never stacks them visually.
    const destination = player.clone().add(new THREE.Vector3(-Math.cos(yaw) * 2.4 - Math.sin(yaw) * .8, 0, Math.sin(yaw) * 2.4 - Math.cos(yaw) * .8));
    const prey = this.options.engage?.(player);
    // Melee closes in; Blackbeard keeps pistol distance.
    if (prey) destination.copy(prey.position).add(root.position.clone().sub(prey.position).setY(0).normalize().multiplyScalar(Math.max(1.4, Math.min(5, this.options.range) - 1.5)));
    const ground = this.floor(destination.x, destination.z, player.y);
    if (ground !== null) destination.y = ground;
    if (!this.activeLast || root.position.distanceTo(player) > 24) {
      root.position.copy(ground !== null && this.visiblePath(player, destination) ? destination : player);
      root.rotation.y = yaw; this.release(actor);
    }
    this.activeLast = true;
    if (actor.state === 'attack') { turnCompanion(root, this.attackYaw, dt); actor.update(dt); if (actor.state !== 'attack') this.attackTarget = null; return; }
    this.attackTarget = null;
    const frameYaw = root.rotation.y;
    let speed = 0;
    if (ground !== null && this.visiblePath(root.position, destination)) {
      speed = this.motion.step(root, destination, dt, Math.min(6, (actor.definition.clips.run?.nominalSpeed ?? 2) * COMPANION_MOTION.maxRate));
    } else this.motion.reset();
    const target = this.options.target(root.position, this.options.range);
    if (target && actor.definition.clips.attack) {
      this.attackTarget = target.id;
      this.attackYaw = Math.atan2(target.position.x - root.position.x, target.position.z - root.position.z);
      this.motion.reset(); root.rotation.y = frameYaw; turnCompanion(root, this.attackYaw, dt);
      actor.play('attack', { restart: true });
    } else {
      const running = companionGait(speed, actor.definition.clips.walk?.nominalSpeed ?? .75, actor.state === 'run') === 'run';
      if (speed < .1) actor.play('idle');
      else actor.play(running ? 'run' : 'walk', { speed });
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

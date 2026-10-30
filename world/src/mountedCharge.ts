import * as THREE from 'three';
import { validSkillPose, type SkillPoseCommand } from './skillPose';
import type { CharacterKit, KitEventResult } from './characters/characterKit';
import { MOUNTED_CHARGE as MOTION, mountedChargeDistance } from './characters/mountedChargeMotion';
import type { KitCompanionOptions } from './kitCompanion';
import type { Collider } from './player';
import { companionGait } from './characters/companionMotion';

type Target = NonNullable<ReturnType<KitCompanionOptions['target']>>;
type ChargePlan = { target: Target; direction: THREE.Vector3; start: THREE.Vector3; end: THREE.Vector3 };
export type MountedPhase = 'follow' | 'approach' | 'charge' | 'recover';

/** Conservative ground navigation for a full-sized horse, not the rider's point-sized ray. */
export class MountedCharge {
  phase: MountedPhase = 'follow';
  private active = false;
  private skillPose?: { command: SkillPoseCommand; elapsed: number };
  private plan?: ChargePlan;
  private cooldown = 0;
  private planCheck = 0;
  private stalled = 0;
  private emitted = false;
  private separatedFor = 0;
  private returnRetry = 0;
  private followStuckFor = 0;
  private readonly ray = new THREE.Ray();
  private readonly bounds = new WeakMap<Collider['bvh'], THREE.Box3>();
  private readonly body = new THREE.Box3(new THREE.Vector3(-MOTION.radius, .42, -MOTION.halfLength), new THREE.Vector3(MOTION.radius, 3.4, MOTION.halfLength));
  private readonly bodyTransform = new THREE.Matrix4();
  private readonly worldBody = new THREE.Box3();
  constructor(private options: KitCompanionOptions) {}
  get attacking() { return this.phase === 'charge'; }
  /** Validate a full horse-sized approach before the caller spends any skill resources. */
  startSkillPose(actor: CharacterKit, command: SkillPoseCommand, player: THREE.Vector3, _yaw: number): boolean {
    if (!validSkillPose(command) || command.contacts !== 1) return false;
    const attack = actor.definition.clips.attack, contact = attack?.events?.find(e => e.kind === 'hit')?.at;
    const target = command.targetId && command.targetPoint
      ? { id: command.targetId, position: new THREE.Vector3(command.targetPoint.x, command.targetPoint.y, command.targetPoint.z) }
      : this.options.engage?.(player, actor.root.position) ?? this.options.target(actor.root.position, this.options.range);
    if (!attack || contact === undefined || !target || target.position.distanceTo(player) > 16 || Math.abs(target.position.y - actor.root.position.y) > 1.5 || !this.resolve(target)) return false;
    const toTarget = target.position.clone().sub(actor.root.position).setY(0).normalize();
    const direction = new THREE.Vector3(command.direction.x, 0, command.direction.z).normalize();
    if (toTarget.dot(direction) < .25) return false;
    // The skill corridor starts at the real horse root. Keep the target ahead at
    // the authored contact despite the .16m staging tolerance, rather than
    // reporting a completed swing after the horse has already passed its target.
    const plan = this.makePlan(actor, target, player, attack.duration, contact, .35);
    if (!plan) return false;
    this.release(actor); this.active = true; this.plan = plan; this.phase = 'approach';
    this.skillPose = { command, elapsed: 0 }; return true;
  }
  cancelSkillPose(actor?: CharacterKit) {
    if(!this.skillPose)return;
    this.finishSkillPose(false);this.plan=undefined;this.phase='recover';
    this.cooldown=Math.max(this.cooldown,.35);this.emitted=false;this.stalled=0;
    if(actor?.state==='attack')actor.play('idle');
  }
  private finishSkillPose(completed: boolean) {
    const pose = this.skillPose; this.skillPose = undefined; pose?.command.onFinish(completed);
  }
  release(actor?: CharacterKit) {
    this.finishSkillPose(false);
    this.active = false; this.plan = undefined; this.phase = 'follow'; this.cooldown = 0; this.emitted = false; this.planCheck = 0; this.stalled = 0;
    if (actor?.state === 'attack') actor.play('idle');
  }
  onEvent(actor: CharacterKit, event: KitEventResult) {
    if (this.phase !== 'charge' || !this.plan || this.emitted || event.state !== 'attack' || event.kind !== 'hit') return;
    this.emitted = true;
    if (this.skillPose) {
      this.skillPose.command.onContact(actor.root.position, this.plan.direction, event.socket, { losOffset: 1, casterFeetY: actor.root.position.y });
      return;
    }
    // The actual combat callback still rechecks this exact live target, range, LOS and ally cooldown.
    this.options.strike(actor.root.position, MOTION.hitRange, this.options.damage, this.plan.target.id);
  }
  update(actor: CharacterKit, dt: number, player: THREE.Vector3, yaw: number) {
    if (this.skillPose) {
      this.skillPose.elapsed += dt;
      if (this.skillPose.elapsed > 7.5 || !this.plan || (!this.emitted && !this.resolve(this.plan.target))) { this.cancelSkillPose(actor); return; }
    }
    const root = actor.root, attack = actor.definition.clips.attack;
    const contact = attack?.events?.find(event => event.kind === 'hit')?.at;
    if (!attack || contact === undefined) { actor.play('idle'); actor.update(dt); return; }
    this.returnRetry = Math.max(0,this.returnRetry-dt);
    const separation=root.position.distanceTo(player), leash=this.plan||this.skillPose?24:14;
    this.separatedFor=separation>leash?this.separatedFor+dt:0;
    if (!this.active || this.separatedFor > (this.plan || this.skillPose ? .75 : .5) || this.followStuckFor>2) {
      if(this.returnRetry>0){actor.play('idle');actor.update(dt);return;}
      const slot=this.safeFollowSlot(player,yaw), wasActive=this.active;
      this.release(actor);this.returnRetry=.25;
      if(!slot){actor.play('idle');actor.update(dt);return;}
      root.position.copy(slot);root.rotation.y=yaw;this.active=true;
      this.separatedFor=this.followStuckFor=0;
      if(wasActive)this.options.onRejoin?.();
    }
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.planCheck = Math.max(0, this.planCheck - dt);
    if (this.phase === 'charge' && this.plan) {
      const live = this.resolve(this.plan.target);
      if ((!live && !this.emitted) || root.position.distanceTo(player) > MOTION.maxLeash) { this.recover(actor); actor.update(dt); return; }
      // Split a frame at the authored hit so root displacement and the sampled saber pose agree.
      let remaining = dt;
      while (remaining > 1e-8 && this.phase === 'charge') {
        const before = actor.clipTime;
        const slice = before < contact && before + remaining > contact ? contact - before : remaining;
        const after = Math.min(attack.duration, before + slice);
        const destination = this.plan.start.clone().addScaledVector(this.plan.direction, mountedChargeDistance(after, attack.duration, contact));
        if (!this.path(root.position, destination, root.rotation.y) || destination.distanceTo(player) > MOTION.maxLeash) {
          this.recover(actor); break;
        }
        const floor = this.ground(destination, root.position.y, root.rotation.y);
        if (floor === null) { this.recover(actor); break; }
        root.position.copy(destination).setY(floor); actor.update(slice); remaining -= slice;
        if (actor.state !== 'attack') this.recover(actor);
      }
      return;
    }
    if (this.phase === 'recover') {
      actor.play('idle'); actor.update(dt);
      if (this.cooldown <= 0) this.phase = 'follow';
      return;
    }
    let prey = this.plan ? this.resolve(this.plan.target) : this.options.engage?.(player, root.position) ?? this.options.target(root.position, this.options.range);
    if (prey && (prey.position.distanceTo(player) > 16 || Math.abs(prey.position.y - root.position.y) > 1.5)) prey = null;
    if (!prey) { this.plan = undefined; this.phase = 'follow'; }
    if (prey && !this.plan && this.cooldown <= 0) {
      this.plan = this.makePlan(actor, prey, player, attack.duration, contact);
      if (this.plan) { this.phase = 'approach'; this.planCheck = .35; this.stalled = 0; }
      else this.cooldown = .4;
    }
    if (this.plan && prey) {
      const shift = prey.position.clone().sub(this.plan.target.position);
      this.plan.start.add(shift); this.plan.end.add(shift); this.plan.target = { id: prey.id, position: prey.position.clone() };
      // A moving target cannot drag the planned run through a new wall, ledge or beyond the leash.
      const heading = Math.atan2(this.plan.direction.x, this.plan.direction.z);
      const check = this.planCheck <= 0 || shift.lengthSq() > .04;
      if (check) this.planCheck = .35;
      if (this.plan.end.distanceTo(player) > MOTION.maxLeash || (check && !this.path(this.plan.start, this.plan.end, heading))) {
        this.plan = undefined; this.phase = 'follow'; this.cooldown = .35;
      }
    }
    const destination = this.plan?.start ?? this.followSlot(player, yaw);
    const speed = this.move(actor, destination, dt, this.plan ? 4.4 : Math.min(6.2,(actor.definition.clips.run?.nominalSpeed ?? 2.1)*3));
    this.followStuckFor=!this.plan&&speed===0&&root.position.distanceTo(destination)>1?this.followStuckFor+dt:0;
    // A new obstruction may invalidate a previously reachable staging slot. Wait rather than
    // play a running pose against it, then drop the plan and let the next bounded retry replan.
    if (this.plan && speed === 0 && root.position.distanceTo(destination) > .2) this.stalled += dt;
    else this.stalled = 0;
    if (this.stalled > 1.2) { this.plan = undefined; this.phase = 'follow'; this.cooldown = .4; this.stalled = 0; }
    if (this.plan && root.position.clone().setY(0).distanceTo(this.plan.start.clone().setY(0)) < .16) {
      const heading = Math.atan2(this.plan.direction.x, this.plan.direction.z);
      const turn = this.turn(root, heading, dt);
      if (Math.abs(turn) < .06 && this.path(root.position, this.plan.end, heading)) {
        // Start at the current supported point; do not snap to the staging point.
        this.plan.start.copy(root.position); this.phase = 'charge'; this.emitted = false;
        actor.play('attack', { restart: true });
        return;
      }
    }
    const running = companionGait(speed, actor.definition.clips.walk?.nominalSpeed ?? .7, actor.state === 'run') === 'run';
    if (speed < .05) actor.play('idle'); else actor.play(running ? 'run' : 'walk', { speed });
    actor.update(dt);
  }
  private resolve(target: Target) {
    const live = (this.options.track ?? this.options.target)(target.position, this.options.range, target.id);
    return live?.id === target.id ? live : null;
  }
  private recover(actor: CharacterKit) {
    this.finishSkillPose(this.emitted);
    this.phase = 'recover'; this.plan = undefined; this.cooldown = MOTION.recovery; actor.play('idle');
  }
  private followSlot(player: THREE.Vector3, yaw: number) {
    return player.clone().add(new THREE.Vector3(-Math.cos(yaw) * 3.2 - Math.sin(yaw), 0, Math.sin(yaw) * 3.2 - Math.cos(yaw)));
  }
  /** Rejoin only a supported horse-sized slot on the player's visible side.
   * No fallback to the player's point when a horse cannot fit there. */
  private safeFollowSlot(player:THREE.Vector3,yaw:number):THREE.Vector3|null {
    for(const [offset,back] of [[3.2,-1],[-3.2,-1],[2.4,-1],[-2.4,-1],[4.2,-1],[-4.2,-1],[0,3.2],[0,-3.2]]) {
      const slot=player.clone().add(new THREE.Vector3(-Math.cos(yaw)*offset+Math.sin(yaw)*back,0,Math.sin(yaw)*offset+Math.cos(yaw)*back));
      const y=this.ground(slot,player.y,yaw);if(y===null)continue;slot.y=y;
      if(this.bodyClear(slot,yaw)&&this.path(player,slot,yaw))return slot;
    }
    return null;
  }
  private makePlan(actor: CharacterKit, target: Target, player: THREE.Vector3, duration: number, contact: number, contactLead = 0): ChargePlan | undefined {
    const direction = target.position.clone().sub(actor.root.position).setY(0);
    if (direction.lengthSq() < .01) direction.set(Math.sin(actor.root.rotation.y), 0, Math.cos(actor.root.rotation.y));
    direction.normalize();
    const side = new THREE.Vector3(direction.z, 0, -direction.x);
    for (const sign of [1, -1]) {
      const start = target.position.clone().addScaledVector(direction, -(mountedChargeDistance(contact, duration, contact) + contactLead)).addScaledVector(side, sign * MOTION.sideClearance);
      const end = start.clone().addScaledVector(direction, mountedChargeDistance(duration, duration, contact));
      const heading = Math.atan2(direction.x, direction.z);
      const approach = start.clone().sub(actor.root.position), approachYaw = Math.atan2(approach.x, approach.z);
      if (start.distanceTo(player) <= MOTION.maxLeash && end.distanceTo(player) <= MOTION.maxLeash && this.path(start, end, heading) && this.path(actor.root.position, start, approachYaw)) {
        return { target: { id: target.id, position: target.position.clone() }, direction, start, end };
      }
    }
    return undefined;
  }
  private turn(root: THREE.Object3D, target: number, dt: number) {
    const angle = Math.atan2(Math.sin(target - root.rotation.y), Math.cos(target - root.rotation.y));
    const turn = THREE.MathUtils.clamp(angle, -3 * dt, 3 * dt), steps = Math.max(1, Math.ceil(Math.abs(turn) / .08));
    // Sweep the rear/flanks while turning, not just the forward travel ray.
    for (let i = 1; i <= steps; i++) {
      const yaw = root.rotation.y + turn * i / steps;
      if (!this.bodyClear(root.position, yaw) || this.ground(root.position, root.position.y, yaw) === null) return angle || 1;
    }
    root.rotation.y += turn; return angle;
  }
  private move(actor: CharacterKit, destination: THREE.Vector3, dt: number, maxSpeed=4.4) {
    const root = actor.root, delta = destination.clone().sub(root.position).setY(0), distance = delta.length();
    if (distance < .16 || dt <= 0) return 0;
    const heading = Math.atan2(delta.x, delta.z), turn = this.turn(root, heading, dt);
    // Turn in place first rather than sliding the entire horse sideways during a sharp reversal.
    if (Math.abs(turn) > .3) return 0;
    const speed = Math.min(maxSpeed, distance * 3), next = root.position.clone().addScaledVector(delta, Math.min(1, speed * dt / distance));
    if (!this.path(root.position, next, root.rotation.y)) return 0;
    const y = this.ground(next, root.position.y, root.rotation.y);
    if (y === null) return 0;
    root.position.copy(next).setY(y); return speed;
  }
  private floor(x: number, z: number, baseY: number) {
    this.ray.origin.set(x, baseY + .9, z); this.ray.direction.set(0, -1, 0);
    let best = Infinity;
    for (const collider of this.options.colliders) if (collider.enabled) {
      if (!this.ray.intersectsBox(this.colliderBounds(collider))) continue;
      const hit = collider.bvh.raycastFirst(this.ray, THREE.DoubleSide, 0, 1.8);
      if (hit && hit.distance < best && hit.distance < 1.8 && Math.abs(hit.face?.normal.y ?? 0) > .72) best = hit.distance;
    }
    return best < Infinity ? baseY + .9 - best : null;
  }
  private ground(point: THREE.Vector3, baseY: number, yaw: number) {
    const y = this.floor(point.x, point.z, baseY);
    if (y === null || Math.abs(y - baseY) > MOTION.stepHeight) return null;
    const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)), side = new THREE.Vector3(forward.z, 0, -forward.x);
    for (const f of [-MOTION.halfLength, MOTION.halfLength]) for (const s of [-MOTION.radius, MOTION.radius]) {
      const sample = point.clone().addScaledVector(forward, f).addScaledVector(side, s), support = this.floor(sample.x, sample.z, y);
      if (support === null || Math.abs(support - y) > MOTION.stepHeight) return null;
    }
    return y;
  }
  private path(from: THREE.Vector3, to: THREE.Vector3, yaw: number) {
    const delta = to.clone().sub(from).setY(0), length = delta.length();
    let y = from.y;
    const steps = Math.max(1, Math.ceil(length / .22));
    for (let i = 0; i <= steps; i++) {
      const sample = from.clone().lerp(to, i / steps), support = this.ground(sample, y, yaw);
      if (support === null) return false;
      sample.y = support;
      if (!this.bodyClear(sample, yaw)) return false;
      y = support;
    }
    return true;
  }
  private colliderBounds(collider: Collider) {
    let bounds = this.bounds.get(collider.bvh);
    if (!bounds) { bounds = collider.bvh.getBoundingBox(new THREE.Box3()); this.bounds.set(collider.bvh, bounds); }
    return bounds;
  }
  private bodyClear(point: THREE.Vector3, yaw: number) {
    this.bodyTransform.makeRotationY(yaw).setPosition(point);
    this.worldBody.copy(this.body).applyMatrix4(this.bodyTransform);
    return !this.options.colliders.some(c => c.enabled && this.worldBody.intersectsBox(this.colliderBounds(c)) && c.bvh.intersectsBox(this.body, this.bodyTransform));
  }
}

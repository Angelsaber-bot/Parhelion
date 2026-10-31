import { skillAnimationProfile, skillAnimationSample } from './skillAnimationProfile';
import * as THREE from 'three';
import type { CharacterKit, KitEventResult } from './characters/characterKit';
import type { Collider } from './player';
import { validSkillPose, type SkillPoseCommand } from './skillPose';
import { MountedCharge } from './mountedCharge';
import { CompanionNavigation } from './companionNavigation';
import { COMPANION_MOTION, companionGait, turnCompanion } from './characters/companionMotion';

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
  engage?: (player: THREE.Vector3, from?: THREE.Vector3) => Target;
  track?: (position: THREE.Vector3, range: number, targetId: string) => Target;
  onRejoin?: () => void;
}

/**
 * Follow/assist behaviour for an era servant's CharacterKit once they are the active companion.
 * Mirrors ContractServant: stays beside the player, snaps back when separated, and only deals damage
 * on the kit's authored hit/fire events (never invented timing).
 */
export class KitCompanion {
  private activeLast = false;
  private navigation: CompanionNavigation;
  private attackAge = 0;
  private separatedFor = 0;
  private pursuing = false;
  private rejoinRetry = 0;
  private readonly rejoinPlayer = new THREE.Vector3(Infinity,0,Infinity);
  private attackYaw = 0;
  private attackTarget: string | null = null;
  private mounted?: MountedCharge;
  private skillPose?: { command: SkillPoseCommand; contacts: number; elapsed: number; motionTime: number; cycle: number; started: boolean };
  constructor(private options: KitCompanionOptions) { this.navigation = new CompanionNavigation(options.colliders); }
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
    const ranged = event.kind === 'fire', range = ranged ? this.options.range + 2 : Math.min(2.6,this.options.range);
    const target = this.observe(actor.root.position,range,this.attackTarget);
    if (!target || !this.facing(actor.root,target.position)) return;
    // Socket LOS is additionally checked for guns: a muzzle beyond a wall cannot shoot from the root.
    if (ranged && event.transform && !this.navigation.lineOfSight(event.transform.position,target.position.clone().add(new THREE.Vector3(0,1,0)))) return;
    this.options.strike(actor.root.position,range,this.options.damage,this.attackTarget);
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
    this.skillPose = { command, contacts: 0, elapsed: 0, motionTime: 0, cycle: 0, started: false };
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
    this.activeLast = false; this.pursuing=false;this.separatedFor=0; this.attackTarget = null; this.navigation.reset(); this.rejoinRetry=0;this.rejoinPlayer.set(Infinity,0,Infinity);
    if (actor && actor.state === 'attack') actor.play(actor.definition.defaultState);
  }
  update(actor: CharacterKit, dt: number, player: THREE.Vector3, yaw: number, paused: boolean) {
    if (paused) { this.cancelSkillPose(actor); this.attackTarget=null; this.attackAge=0; this.navigation.reset(); if(!actor.definition.mount && actor.state==='attack')actor.play(actor.definition.defaultState); return; }
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
      const attack=actor.definition.clips.attack;
      const contact=Math.min(...attack.events!.map(event=>event.at));
      pose.motionTime+=dt;
      for(let cycle=0;cycle<4 && this.skillPose===pose;cycle++) {
        const sample=skillAnimationSample(skillAnimationProfile(actor.definition.id,pose.command.slot,pose.cycle),pose.motionTime,attack.duration,contact);
        let remaining=Math.max(0,sample.clipTime-actor.clipTime);
        const clipAdvance=remaining;
        // Allocate actual elapsed time across a possible clip-cycle boundary.
        const visualAdvance=Math.max(0,Math.min(dt,pose.motionTime)-Math.max(0,pose.motionTime-sample.duration));
        if(clipAdvance<=1e-9 && visualAdvance>0)actor.update(0,false,visualAdvance);
        // CharacterKit samples each exact authored socket event; bounded slices avoid
        // its tab-resume cap swallowing a fast release. No events are generated here.
        while(remaining>1e-9 && actor.state==='attack') {
          const slice=Math.min(.1,remaining);actor.update(slice,false,visualAdvance*slice/clipAdvance);remaining-=slice;
          if(this.skillPose!==pose)return;
        }
        if(pose.motionTime+1e-9<sample.duration)return;
        if(pose.contacts>=pose.command.contacts){this.skillPose=undefined;actor.play(actor.definition.defaultState);pose.command.onFinish(true);return;}
        pose.motionTime=Math.max(0,pose.motionTime-sample.duration);pose.cycle++;
        actor.play('attack',{restart:true});
      }
      return;
    }
    this.rejoinRetry=Math.max(0,this.rejoinRetry-dt);
    if(this.rejoinPlayer.distanceToSquared(player)>4){this.rejoinRetry=0;this.rejoinPlayer.copy(player);}
    const separation=root.position.distanceTo(player);
    // Preserve the authored <=3x gait. Pure following regroups before the 16m skill-command limit;
    // committed pursuit keeps its 24m leash, and never teleports to the enemy.
    const inCombat=(actor.state==='attack' && this.attackTarget!==null) || this.pursuing;
    this.separatedFor=separation>(inCombat?24:14)?this.separatedFor+dt:0;
    const rejoin=this.activeLast && (this.separatedFor>(inCombat?.75:.5) || separation>12 && this.navigation.stuckSeconds>2);
    if ((!this.activeLast || rejoin) && this.rejoinRetry<=0) {
      const safe=this.navigation.safeReturn(player,yaw);
      if(safe){root.position.copy(safe);root.rotation.y=yaw;this.release(actor);this.separatedFor=0;this.rejoinRetry=0;if(rejoin)this.options.onRejoin?.();}
      else this.rejoinRetry=.25;
    }
    this.activeLast=true;
    if(separation>24 && actor.state==='attack'){actor.play(actor.definition.defaultState);this.attackTarget=null;}
    if(actor.state==='attack' && this.attackTarget) {
      const contact=actor.definition.clips.attack.events?.[0]?.at ?? .6;
      if(this.attackAge<contact-.12) {
        const live=this.observe(root.position,this.options.range+2,this.attackTarget);
        if(!live){actor.play(actor.definition.defaultState);this.attackTarget=null;this.navigation.reset();return;}
        this.attackYaw=Math.atan2(live.position.x-root.position.x,live.position.z-root.position.z);
      }
      turnCompanion(root,this.attackYaw,dt);this.attackAge+=dt;actor.update(dt);
      if(actor.state!=='attack')this.attackTarget=null;
      return;
    }
    this.attackTarget=null;
    const destination = player.clone().add(new THREE.Vector3(-Math.cos(yaw)*2.4-Math.sin(yaw)*.8,0,Math.sin(yaw)*2.4-Math.cos(yaw)*.8));
    const prey=this.options.engage?.(player,root.position);
    this.pursuing=!!prey;
    if(prey && separation<24) destination.copy(prey.position).add(root.position.clone().sub(prey.position).setY(0).normalize().multiplyScalar(this.options.range>5?this.options.range*.65:1));
    const frameYaw=root.rotation.y;
    const speed=this.navigation.step(root,destination,dt,Math.min(6,(actor.definition.clips.run?.nominalSpeed??2)*COMPANION_MOTION.maxRate));
    const target=this.options.target(root.position,this.options.range);
    const inReach=target && Math.hypot(target.position.x-root.position.x,target.position.z-root.position.z)<(this.options.range>5?this.options.range:1.75);
    if(inReach && actor.definition.clips.attack) {
      this.attackYaw=Math.atan2(target.position.x-root.position.x,target.position.z-root.position.z);
      this.navigation.reset();root.rotation.y=frameYaw;
      const remaining=turnCompanion(root,this.attackYaw,dt);
      if(Math.abs(remaining)<.12){this.attackTarget=target.id;this.attackAge=0;actor.play('attack',{restart:true});}
      else actor.play('idle');
    } else {
      const running=companionGait(speed,actor.definition.clips.walk?.nominalSpeed??.75,actor.state==='run')==='run';
      actor.play(speed<.1?'idle':running?'run':'walk',speed<.1?undefined:{speed});
    }
    actor.update(dt);
  }
  private observe(position:THREE.Vector3,range:number,id:string):Target {
    const target=this.options.track?.(position,range,id) ?? (!this.options.track?this.options.target(position,range,id):null);
    return target?.id===id?target:null;
  }
  private facing(root:THREE.Object3D,position:THREE.Vector3) {
    const dx=position.x-root.position.x,dz=position.z-root.position.z,distance=Math.hypot(dx,dz);
    return distance<.05 || (dx*Math.sin(root.rotation.y)+dz*Math.cos(root.rotation.y))/distance>=.7;
  }

}

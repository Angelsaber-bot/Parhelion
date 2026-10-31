/** ISOLATED VALIDATION CANDIDATE: bounded avoidance of directions rejected by actual step revalidation. Not imported by production. */
import * as THREE from 'three';
import type { Collider } from '../../src/player';
import { CompanionMotion } from '../../src/characters/companionMotion';

const TURNS = [0, .55, 1.05, Math.PI / 2, 2.05] as const;
const HEIGHTS = [.35,1.25] as const, BODY_SIDES = [-.34,0,.34] as const;
const RETURN_OFFSETS = [2.4,-2.4,1.4,-1.4,3.4,-3.4] as const;
const CENTER_RETURN_OFFSETS = [-1.6,1.6] as const;
const STRAIGHT = [1] as const, RIGHT_FIRST = [1,-1] as const, LEFT_FIRST = [-1,1] as const;
/** Local, bounded walking steering for the single active foot companion.
 * Ground and body-width checks remain authoritative; steering never edits colliders.
 */
export class CompanionNavigationCandidate {
  private failedDirections: Array<{heading:number;left:number}> = [];
  private rejectedDirections = 0;
  private maximumFailedDirections = 0;
  get detourDiagnostics(){return{rejectedDirections:this.rejectedDirections,maximumFailedDirections:this.maximumFailedDirections,active:this.failedDirections.length,cap:9,expiry:.4,maxPlanCandidates:9};}
  private readonly ray = new THREE.Ray();
  // Collider BVHs are immutable world-space geometry, as in MountedCharge.
  // Key by BVH (not collider) so replacement BVHs get fresh bounds. enabled is
  // deliberately checked on every query: gate changes must apply immediately.
  private readonly bounds = new WeakMap<Collider['bvh'], THREE.Box3>();
  private readonly segmentBounds = new THREE.Box3();
  private readonly segmentEnd = new THREE.Vector3();
  private prepareSegment(max: number) {
    this.segmentEnd.copy(this.ray.direction).multiplyScalar(max).add(this.ray.origin);
    this.segmentBounds.min.copy(this.ray.origin).min(this.segmentEnd);
    this.segmentBounds.max.copy(this.ray.origin).max(this.segmentEnd);
  }
  private overlapsSegment(collider: Collider) {
    let bounds = this.bounds.get(collider.bvh);
    if (!bounds) {
      bounds = collider.bvh.getBoundingBox(new THREE.Box3()).expandByScalar(1e-5);
      this.bounds.set(collider.bvh, bounds);
    }
    return this.segmentBounds.intersectsBox(bounds);
  }
  private readonly waypoint = new THREE.Vector3();
  private readonly goal = new THREE.Vector3(Infinity,0,Infinity);
  private readonly before = new THREE.Vector3();
  private readonly candidate = new THREE.Vector3();
  private readonly motion = new CompanionMotion();
  private planFor = 0;
  private side = 0;
  private blockedFor = 0;
  get stuckSeconds() { return this.blockedFor; }
  constructor(private readonly colliders: Collider[]) {}
  reset() { this.failedDirections.length=0; this.motion.reset(); this.planFor=0; this.side=0; this.blockedFor=0; }
  private hit(max:number) {
    this.prepareSegment(max);
    for(const collider of this.colliders) if(collider.enabled && this.overlapsSegment(collider)) {
      const hit=collider.bvh.raycastFirst(this.ray,THREE.DoubleSide,0,max);
      if(hit && hit.distance<max) return true;
    }
    return false;
  }
  floor(x:number,z:number,baseY:number):number|null {
    this.ray.origin.set(x,baseY+.7,z);this.ray.direction.set(0,-1,0);
    let best=Infinity;
    this.prepareSegment(1.5);
    for(const collider of this.colliders) if(collider.enabled && this.overlapsSegment(collider)) {
      const hit=collider.bvh.raycastFirst(this.ray,THREE.DoubleSide,0,1.5);
      if(hit && hit.distance<best && hit.distance<1.5 && Math.abs(hit.face?.normal.y??0)>.7) best=hit.distance;
    }
    return best<Infinity ? baseY+.7-best : null;
  }
  lineOfSight(from:THREE.Vector3,to:THREE.Vector3):boolean {
    this.ray.origin.copy(from);this.ray.direction.copy(to).sub(from);const length=this.ray.direction.length();
    if(length<1e-6)return true;this.ray.direction.divideScalar(length);return !this.hit(Math.max(0,length-.05));
  }
  /** Capsule-width sweep approximated by parallel body rays, followed by local floor sampling. */
  path(from:THREE.Vector3,to:THREE.Vector3):boolean {
    const dx=to.x-from.x,dz=to.z-from.z,length=Math.hypot(dx,dz);
    if(length<1e-6)return true;
    const ux=dx/length,uz=dz/length;
    this.ray.direction.set(ux,0,uz);
    for(const height of HEIGHTS) for(const side of BODY_SIDES) {
      this.ray.origin.set(from.x-uz*side,from.y+height,from.z+ux*side);
      if(this.hit(length+.36))return false;
    }
    // A clear horizontal ray alone must never let an actor cross a pit or a tall step.
    let y=from.y;
    const samples=Math.max(1,Math.ceil(length/.5));
    for(let i=1;i<=samples;i++) {
      const t=i/samples,ground=this.floor(from.x+dx*t,from.z+dz*t,y);
      if(ground===null || Math.abs(ground-y)>.65)return false;
      // Match safeReturn's full head clearance, including unsupported low
      // ceilings that sit above both horizontal body-ray heights.
      this.ray.origin.set(from.x+dx*t,ground+.12,from.z+dz*t);
      this.ray.direction.set(0,1,0);
      if(this.hit(1.65))return false;
      y=ground;
    }
    return true;
  }
  private clear(point:THREE.Vector3) {
    this.ray.origin.set(point.x,point.y+.12,point.z);this.ray.direction.set(0,1,0);
    if(this.hit(1.65))return false;
    for(let i=0;i<8;i++) {
      const angle=i*Math.PI/4;this.ray.origin.set(point.x,point.y+.7,point.z);this.ray.direction.set(Math.cos(angle),0,Math.sin(angle));
      if(this.hit(.48))return false;
    }
    return true;
  }
  /** Only explicit summon/long separation may use this: never an attack-target teleport. */
  safeReturn(player:THREE.Vector3,yaw:number):THREE.Vector3|null {
    for(const offset of RETURN_OFFSETS) {
      const x=player.x-Math.cos(yaw)*offset-Math.sin(yaw)*.8,z=player.z+Math.sin(yaw)*offset-Math.cos(yaw)*.8;
      const y=this.floor(x,z,player.y);if(y===null||Math.abs(y-player.y)>.65)continue;
      this.candidate.set(x,y,z);
      if(this.clear(this.candidate)&&this.path(player,this.candidate))return this.candidate;
    }
    // If side slots lie off a narrow bridge, try behind then ahead on its
    // centerline. Never use the player point or bypass floor/body/path checks.
    for(const offset of CENTER_RETURN_OFFSETS) {
      const x=player.x+Math.sin(yaw)*offset,z=player.z+Math.cos(yaw)*offset;
      const y=this.floor(x,z,player.y);if(y===null||Math.abs(y-player.y)>.65)continue;
      let supported=true;
      for(const side of BODY_SIDES) {
        const edge=this.floor(x+Math.cos(yaw)*side,z-Math.sin(yaw)*side,y);
        if(edge===null||Math.abs(edge-y)>.65){supported=false;break;}
      }
      if(!supported)continue;
      this.candidate.set(x,y,z);
      if(this.clear(this.candidate)&&this.path(player,this.candidate))return this.candidate;
    }
    return null;
  }
  step(root:THREE.Object3D,destination:THREE.Vector3,dt:number,maxSpeed:number):number {
    if(!Number.isFinite(dt)||dt<=0)return 0;
    dt=Math.min(.1,dt);this.planFor-=dt;
    for(const failed of this.failedDirections)failed.left-=dt;
    for(let i=this.failedDirections.length-1;i>=0;i--)if(this.failedDirections[i].left<=0)this.failedDirections.splice(i,1);
    const distance=Math.hypot(destination.x-root.position.x,destination.z-root.position.z);
    if(distance<.255){this.motion.reset();this.blockedFor=0;return 0;}
    if(this.planFor<=0 || Math.hypot(destination.x-this.goal.x,destination.z-this.goal.z)>1) {
      this.goal.copy(destination);this.planFor=.12;
      const angle=Math.atan2(destination.z-root.position.z,destination.x-root.position.x),reach=Math.min(this.failedDirections.length ? .65 : 3,distance);
      let found=false;
      for(const turn of TURNS) {
        const signs=turn===0?STRAIGHT:this.side<0?LEFT_FIRST:RIGHT_FIRST;
        for(const sign of signs) {
          const heading=angle+turn*sign;
          if(this.failedDirections.some(failed=>Math.abs(Math.atan2(Math.sin(heading-failed.heading),Math.cos(heading-failed.heading)))<.28))continue;
          this.candidate.set(root.position.x+Math.cos(heading)*reach,root.position.y,root.position.z+Math.sin(heading)*reach);
          if(this.path(root.position,this.candidate)) {
            this.waypoint.copy(this.candidate);this.side=turn===0?0:sign;found=true;break;
          }
        }
        if(found)break;
      }
      if(!found){this.waypoint.copy(root.position);this.motion.reset();}
    }
    this.before.copy(root.position);
    this.motion.step(root,this.waypoint,dt,maxSpeed);
    const moved=Math.hypot(root.position.x-this.before.x,root.position.z-this.before.z);
    if(moved>1e-7) {
      // Revalidate even inside the plan interval: a quest gate can close between render frames.
      const y=this.floor(root.position.x,root.position.z,this.before.y);
      if(y===null || !this.path(this.before,root.position)){
        const heading=Math.atan2(root.position.z-this.before.z,root.position.x-this.before.x),existing=this.failedDirections.find(failed=>Math.abs(Math.atan2(Math.sin(heading-failed.heading),Math.cos(heading-failed.heading)))<.28);
        if(existing)existing.left=.4;else{if(this.failedDirections.length>=9)this.failedDirections.shift();this.failedDirections.push({heading,left:.4});}
        this.rejectedDirections++;this.maximumFailedDirections=Math.max(this.maximumFailedDirections,this.failedDirections.length);
        root.position.copy(this.before);this.motion.reset();this.planFor=0;this.blockedFor+=dt;return 0;}
      root.position.y=y;this.blockedFor=0;
      return moved/dt;
    }
    this.blockedFor+=dt;return 0;
  }
}

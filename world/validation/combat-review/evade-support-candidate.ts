/** ISOLATED VALIDATION CANDIDATE, not installed by production main.
 * One <=1cm downward capsule collision retry during a prior-grounded admitted
 * evade. No timer grace and no onGround=true assignment. Unsupported/corner
 * displacement is rolled back exactly. Production Player performs its normal
 * grounded velocity cleanup after this collision hook returns.
 */
import * as THREE from 'three';import type {Player} from '../../src/player';
export const EVADE_SUPPORT_DROP=.01;
type SupportPlayer=Pick<Player,'pos'|'vel'|'onGround'|'swimming'|'gliding'|'inUpdraft'|'flying'|'colliders'|'step'>;
export function installEvadeSupportCandidate(player:SupportPlayer){
 const body=player as unknown as Pick<Player,'pos'|'vel'|'onGround'|'swimming'|'gliding'|'inUpdraft'|'flying'|'colliders'>&{collide():void},originalStep=player.step,originalCollide=body.collide,stepDescriptor=Object.getOwnPropertyDescriptor(player,'step'),collisionDescriptor=Object.getOwnPropertyDescriptor(player,'collide');
 const position=new THREE.Vector3(),velocity=new THREE.Vector3(),ray=new THREE.Ray(),walkable=Math.cos(50*Math.PI/180);let eligible=false,steps=0,primaryQueries=0,supportQueries=0,supportRejected=0,extraQueries=0,recovered=0,rolledBack=0,maxObservedExtraQueriesPerStep=0,maxObservedSupportQueriesPerStep=0,disposed=false;
 player.step=function(dt,input){
  const evade=input.evade;
  eligible=Number.isFinite(dt)&&dt>0&&dt<=.1&&this.onGround&&!input.jump&&!this.flying&&!!evade&&Number.isFinite(evade.x)&&Number.isFinite(evade.z)&&Math.hypot(evade.x,evade.z)>.001;
  steps++;const oldExtra=extraQueries,oldSupport=supportQueries;try{return originalStep.call(this,dt,input);}finally{maxObservedExtraQueriesPerStep=Math.max(maxObservedExtraQueriesPerStep,extraQueries-oldExtra);maxObservedSupportQueriesPerStep=Math.max(maxObservedSupportQueriesPerStep,supportQueries-oldSupport);eligible=false;}
 };
 body.collide=function(){
  primaryQueries++;originalCollide.call(this);
  if(!eligible||this.onGround||this.vel.y>0||this.swimming||this.gliding||this.inUpdraft||this.flying)return;
  if(!Number.isFinite(this.pos.lengthSq())||!Number.isFinite(this.vel.lengthSq()))return;
  // Require real walkable support directly below the feet as well as a capsule
  // contact. This rejects rim/edge grabbing and nonwalkable corner normals.
  ray.origin.copy(this.pos);ray.origin.y+=.002;ray.direction.set(0,-1,0);supportQueries++;
  let closest:any=null;
  for(const collider of this.colliders)if(collider.enabled){const hit=collider.bvh.raycastFirst(ray,THREE.DoubleSide,0,EVADE_SUPPORT_DROP+.002001);if(hit&&(!closest||hit.distance<closest.distance))closest=hit;}
  if(!closest||Math.abs(closest.face?.normal.y??0)<walkable||closest.point.y>this.pos.y+1e-7||this.pos.y-closest.point.y>EVADE_SUPPORT_DROP+1e-7){supportRejected++;return;}
  position.copy(this.pos);velocity.copy(this.vel);const grounded=this.onGround;
  this.pos.y-=EVADE_SUPPORT_DROP;extraQueries++;originalCollide.call(this);
  const vertical=this.pos.y-position.y;
  if(this.onGround&&Math.abs(this.pos.x-position.x)<=1e-7&&Math.abs(this.pos.z-position.z)<=1e-7&&vertical>=-EVADE_SUPPORT_DROP-1e-7&&vertical<=1e-7){recovered++;return;}
  this.pos.copy(position);this.vel.copy(velocity);this.onGround=grounded;rolledBack++;
 };
 return{get diagnostics(){return{steps,primaryQueries,supportQueries,supportRejected,extraQueries,recovered,rolledBack,maxObservedExtraQueriesPerStep,maxObservedSupportQueriesPerStep,maxSupportRaysPerStep:1,maxExtraQueriesPerStep:1,drop:EVADE_SUPPORT_DROP};},dispose(){if(disposed)return;disposed=true;if(stepDescriptor)Object.defineProperty(player,'step',stepDescriptor);else delete(player as any).step;if(collisionDescriptor)Object.defineProperty(player,'collide',collisionDescriptor);else delete(player as any).collide;}};
}

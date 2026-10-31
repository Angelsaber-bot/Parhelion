/** ISOLATED design comparison only. Defer the exact immediately preceding
 * failed grounded-step retry until a melee/Q request. No proximity-only airborne
 * admission, no time grace, no hidden tracking or action/cooldown writes. */
import * as THREE from 'three';import {EvadeGroundSupport} from '../../src/evadeGroundSupport';
export function installGroundAdmissionCandidate(player:any,actions:any){
 const support=new EvadeGroundSupport(),lastPosition=new THREE.Vector3(),lastVelocity=new THREE.Vector3(),originalStep=player.step,originalPress=actions.press,originalTeleport=player.teleport,stepDescriptor=Object.getOwnPropertyDescriptor(player,'step'),pressDescriptor=Object.getOwnPropertyDescriptor(actions,'press'),teleportDescriptor=Object.getOwnPropertyDescriptor(player,'teleport');let pending=false,disposed=false,attempts=0,recoveredRequests=0;
 const solve=()=>player.collide();
 player.step=function(dt:number,input:any,...rest:any[]){const eligible=Number.isFinite(dt)&&dt>0&&dt<=.1&&this.onGround&&!input.jump&&!this.flying&&!input.evade;pending=false;const result=originalStep.call(this,dt,input,...rest);pending=eligible&&!this.onGround&&!this.swimming&&!this.gliding&&!this.inUpdraft&&this.vel.y<=0;if(pending){lastPosition.copy(this.pos);lastVelocity.copy(this.vel);}return result;};
 player.teleport=function(...args:any[]){pending=false;return originalTeleport.apply(this,args);};
 actions.press=function(action:string){
  const c=this.actionContext,otherwiseReady=c.enabled&&c.armed&&!this.skills.casting&&!this.melee.active&&!this.evade.active&&(action==='melee'?c.bladeReady&&this.melee.cooldown<=0:action==='skill'&&this.skills.cooldown('skill')<=0);
  if(otherwiseReady&&!c.grounded&&pending&&player.pos.distanceToSquared(lastPosition)<1e-18&&player.vel.distanceToSquared(lastVelocity)<1e-18){attempts++;pending=false;if(support.tryRecover(player,player.colliders,solve))recoveredRequests++;}
  return originalPress.call(this,action);
 };
 return{get diagnostics(){return{attempts,recoveredRequests,pending,...support.diagnostics};},dispose(){if(disposed)return;disposed=true;pending=false;for(const[o,k,d]of[[player,'step',stepDescriptor],[player,'teleport',teleportDescriptor],[actions,'press',pressDescriptor]]as const){if(d)Object.defineProperty(o,k,d);else delete o[k];}}};
}

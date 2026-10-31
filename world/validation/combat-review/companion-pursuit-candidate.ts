/** REJECTED EXPERIMENT: continuity-only did not resolve Winter after60s.
 * ISOLATED validation only. A last-visible navigation point is never an attack
 * target, never updated from hidden live actor positions, and expires in .75s. */
import * as THREE from 'three';
type Target={id:string;position:THREE.Vector3}|null;
export class CompanionPursuitCandidate {
 private target:Target=null;private left=0;private previousPlayer=new THREE.Vector3();private previousRoot=new THREE.Vector3();private initialized=false;
 retained=0;cleared=0;
 clear(){if(this.target)this.cleared++;this.target=null;this.left=0;}
 advance(dt:number,player:THREE.Vector3,root:THREE.Vector3,enabled:boolean){
  if(!enabled||!Number.isFinite(dt)||dt<0||!Number.isFinite(player.lengthSq())||!Number.isFinite(root.lengthSq())){this.clear();this.initialized=false;return;}
  if(this.initialized&&(player.distanceTo(this.previousPlayer)>8||root.distanceTo(this.previousRoot)>8))this.clear();
  this.previousPlayer.copy(player);this.previousRoot.copy(root);this.initialized=true;
  this.left=Math.max(0,this.left-Math.min(.1,dt));if(this.left===0)this.clear();
 }
 choose(visible:Target,player:THREE.Vector3,from:THREE.Vector3,stuck:number,alive:(id:string)=>boolean):Target{
  if(visible){if(stuck<.35){this.target={id:visible.id,position:visible.position.clone()};this.left=.75;}else this.clear();return visible;}
  const target=this.target;
  if(!target||this.left<=0||stuck>=.35||!alive(target.id)||from.distanceTo(player)>24||Math.hypot(target.position.x-player.x,target.position.z-player.z)>=15||Math.abs(target.position.y-from.y)>=3||Math.abs(target.position.y-player.y)>=3){this.clear();return null;}
  this.retained++;return target;
 }
 get diagnostics(){return{retained:this.retained,cleared:this.cleared,left:this.left,id:this.target?.id??null,position:this.target?.position.toArray()??null,expiry:.75};}
}
export function installCompanionPursuitCandidate(servant:any,alive:(id:string)=>boolean){
 const memory=new CompanionPursuitCandidate(),originalUpdate=servant.update,originalEngage=servant.options.engage,descriptor=Object.getOwnPropertyDescriptor(servant,'update');let disposed=false;
 servant.update=function(dt:number,player:THREE.Vector3,yaw:number,enabled:boolean,paused:boolean){memory.advance(dt,player,this.root.position,enabled&&!paused&&this.options.contract.summoned);return originalUpdate.call(this,dt,player,yaw,enabled,paused);};
 servant.options.engage=(player:THREE.Vector3,from:THREE.Vector3)=>memory.choose(originalEngage(player,from),player,from,servant.navigation.stuckSeconds,alive);
 return{memory,dispose(){if(disposed)return;disposed=true;memory.clear();servant.options.engage=originalEngage;if(descriptor)Object.defineProperty(servant,'update',descriptor);else delete servant.update;}};
}

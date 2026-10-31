/** Bounded native lower-leg presentation only. Never changes controller, root, hips, gun or hands. */
import * as THREE from 'three';
import type {SkinnedCharacterRig,PlayerAnimationState} from './skinnedCharacter';
import type {Collider} from './player';
import {SaberTerrainPatch} from './characters/saberTerrainPatch';
import {SaberFootSupport} from './characters/saberFootSupport';
import {PLAYER_SOLE_PROBES} from './playerSoleGeometry';
export class PlayerTerrainSupport {
 readonly patch:SaberTerrainPatch;readonly support:SaberFootSupport;
 readonly diagnostics={adjusted:0,unsupported:0,heightRange:0,floorMiss:0,reachFallback:0,reachClamped:0,maxLift:0,maxRequestedReachExcess:0};
 private previousRoot=new THREE.Vector3();private seeded=false;private hipPoint=new THREE.Vector3();private baseFootQ=new THREE.Quaternion();private alignedFootQ=new THREE.Quaternion();private active=false;private root=new THREE.Vector3();private target=new THREE.Vector3();private offset=new THREE.Vector3();private normal=new THREE.Vector3();private axis=new THREE.Vector3(0,1,0);private rootQ=new THREE.Quaternion();private inverse=new THREE.Quaternion();private tilt=new THREE.Quaternion();private footQ=[new THREE.Quaternion(),new THREE.Quaternion()];private modified=[false,false];private contact=[false,false];
 constructor(private rig:SkinnedCharacterRig,colliders:Collider[]){this.patch=new SaberTerrainPatch(colliders);this.support=new SaberFootSupport((x,z,y)=>this.patch.floor(x,z,y),(['L','R']as const).map((side,i)=>{const bounds=new THREE.Box3(),point=new THREE.Vector3(),q=rig.rest.get(rig.joints['Foot_'+side]as THREE.Bone)!.rootQ;for(const p of PLAYER_SOLE_PROBES[i])bounds.expandByPoint(point.fromArray(p).applyQuaternion(q));return{halfWidth:(bounds.max.x-bounds.min.x)/2,halfLength:(bounds.max.z-bounds.min.z)/2,lateralOffset:(bounds.max.x+bounds.min.x)/2,forwardOffset:(bounds.max.z+bounds.min.z)/2};}));}
 reset(){this.active=false;this.seeded=false;this.modified.fill(false);this.contact.fill(false);this.patch.clear();this.support.clear();}
 begin(dt:number,state:PlayerAnimationState,meleeOwned=false){this.active=!meleeOwned&&state.onGround&&!state.swimming&&!state.gliding&&!state.flying&&!state.melee;this.modified.fill(false);this.support.advance(dt);if(!this.active){this.contact.fill(false);return;}this.rig.root.getWorldPosition(this.root);if(this.seeded&&this.root.distanceToSquared(this.previousRoot)>2.25){this.support.clear();this.contact.fill(false);}this.previousRoot.copy(this.root);this.seeded=true;this.rig.root.getWorldQuaternion(this.rootQ);this.inverse.copy(this.rootQ).invert();this.patch.beginFrame(this.root.x,this.root.z,this.root.y);}
 prepare(side:'L'|'R',local:THREE.Vector3,lift:number,swing:number,contact:boolean){const i=side==='L'?0:1;if(!this.active)return;this.target.copy(local);this.rig.root.localToWorld(this.target);const edge=contact!==this.contact[i];this.contact[i]=contact;const yaw=Math.atan2(2*(this.rootQ.w*this.rootQ.y+this.rootQ.x*this.rootQ.z),1-2*(this.rootQ.y*this.rootQ.y+this.rootQ.z*this.rootQ.z));const plane=this.support.read(i,this.target.x,this.target.z,this.root.y,yaw,this.patch.revision,edge);if(!plane.valid){this.diagnostics.unsupported++;return;}if(plane.kind==='plane'&&plane.normal.y>.99999&&Math.abs(plane.point.y-this.root.y)<.01)return;
  const foot=this.rig.joints['Foot_'+side]as THREE.Bone,rest=this.rig.rest.get(foot)!;
  this.normal.copy(plane.normal);this.tilt.setFromUnitVectors(this.axis,this.normal);
  this.footQ[i].copy(this.rootQ).multiply(this.tilt.setFromUnitVectors(this.axis,this.normal.applyQuaternion(this.inverse)));
  this.footQ[i].multiply(this.tilt.setFromAxisAngle(this.offset.set(1,0,0),-.12*swing)).multiply(rest.rootQ);
  // The ground plane owns stance, not a rigidly dorsiflexed airborne boot.
  this.baseFootQ.copy(this.rootQ).multiply(this.tilt.setFromAxisAngle(this.offset.set(1,0,0),-.12*swing)).multiply(rest.rootQ);this.footQ[i].slerp(this.baseFootQ,swing);
  let needed=-Infinity;
  for(const p of PLAYER_SOLE_PROBES[i]){this.offset.fromArray(p).applyQuaternion(this.footQ[i]);const floor=this.patch.floor(this.target.x+this.offset.x,this.target.z+this.offset.z,this.root.y);if(floor===null){this.diagnostics.unsupported++;this.diagnostics.floorMiss++;return;}needed=Math.max(needed,floor-this.offset.y);}
  const hip=this.rig.joints['Thigh_'+side]as THREE.Bone,shin=this.rig.joints['Shin_'+side]as THREE.Bone;
  const length=this.rig.rest.get(hip)!.rootP.distanceTo(this.rig.rest.get(shin)!.rootP)+this.rig.rest.get(shin)!.rootP.distanceTo(rest.rootP);hip.getWorldPosition(this.hipPoint);
  const reachFloor=this.hipPoint.y-Math.sqrt(Math.max(0,(length-.0001)**2-(this.target.x-this.hipPoint.x)**2-(this.target.z-this.hipPoint.z)**2));
  if(needed+lift+.001<reachFloor&&plane.kind==='plane'&&plane.normal.y<.99999){
    this.alignedFootQ.copy(this.footQ[i]);this.baseFootQ.copy(this.rootQ).multiply(this.tilt.setFromAxisAngle(this.offset.set(1,0,0),-.12*swing)).multiply(rest.rootQ);
    let lo=0,hi=1,best=-Infinity;this.footQ[i].copy(this.baseFootQ);

    const baseHeight=this.requiredHeight(i);if(Number.isFinite(baseHeight)&&baseHeight+lift+.001>=reachFloor){best=baseHeight;for(let pass=0;pass<5;pass++){const mid=(lo+hi)/2;this.footQ[i].slerpQuaternions(this.baseFootQ,this.alignedFootQ,mid);const h=this.requiredHeight(i);if(!Number.isFinite(h)){this.diagnostics.unsupported++;return;}if(h+lift+.001>=reachFloor){lo=mid;best=h;}else hi=mid;}this.footQ[i].slerpQuaternions(this.baseFootQ,this.alignedFootQ,lo);needed=best;}else if(Number.isFinite(baseHeight)&&baseHeight>needed){this.footQ[i].copy(this.baseFootQ);needed=baseHeight;}else this.footQ[i].copy(this.alignedFootQ);
  }
  let requestedRaise=needed+lift+.001-this.target.y;if(requestedRaise<0)requestedRaise*=(1-swing)**2;const raise=THREE.MathUtils.clamp(requestedRaise,-.10,.22);if(raise!==requestedRaise)this.diagnostics.heightRange++;if(Math.abs(raise)<1e-5&&plane.normal.y>.99999)return;
  this.target.y+=raise;
  const error=this.target.distanceTo(hip.getWorldPosition(this.offset))-length;this.diagnostics.maxRequestedReachExcess=Math.max(this.diagnostics.maxRequestedReachExcess,error);if(error>-.0001){this.diagnostics.reachClamped++;this.target.sub(this.offset).setLength(length-.0001).add(this.offset);}
  this.rig.root.worldToLocal(this.target);local.copy(this.target);this.modified[i]=true;this.diagnostics.adjusted++;this.diagnostics.maxLift=Math.max(this.diagnostics.maxLift,raise);
 }
 private requiredHeight(i:number){let h=-Infinity;for(const p of PLAYER_SOLE_PROBES[i]){this.offset.fromArray(p).applyQuaternion(this.footQ[i]);const floor=this.patch.floor(this.target.x+this.offset.x,this.target.z+this.offset.z,this.root.y);if(floor===null)return NaN;h=Math.max(h,floor-this.offset.y);}return h;}
 finish(side:'L'|'R'){const i=side==='L'?0:1;if(!this.modified[i])return;const foot=this.rig.joints['Foot_'+side];foot.parent!.getWorldQuaternion(this.inverse);foot.quaternion.copy(this.inverse.invert().multiply(this.footQ[i]));foot.updateWorldMatrix(false,true);this.inverse.copy(this.rootQ).invert();}
}

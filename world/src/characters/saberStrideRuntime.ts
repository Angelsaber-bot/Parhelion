import * as THREE from 'three';
import { sampleSaberRunFoot, SABER_RUN_STRIDE } from './saberStride';
export interface SaberStrideSupport {
  begin(dt:number,root:THREE.Vector3):boolean|void;
  adjust(side:number,target:THREE.Vector3,orientation:THREE.Quaternion,hip:THREE.Vector3,l1:number,l2:number,lift:number,contact:boolean,final:boolean):boolean|void;
  reset():void;
}
/** Bind-aware, visual-only run stance. Restore before the mixer, apply after it:
 * no accumulating overrides, no controller translation, no damage/event ownership. */
export class SaberStrideRuntime {
  support?:SaberStrideSupport;
  readonly diagnostics={planted:[false,false],reachReleases:0,maxAnchorError:0,maxTargetError:0,unsupportedReleases:0,weight:0};
  private chains:THREE.Object3D[][]=[];
  private restFeet:THREE.Vector3[]=[];private restFootQ:THREE.Quaternion[]=[];
  private lengths:number[][]=[];private panels:THREE.Object3D[]=[];
  private panelRest:{q:THREE.Quaternion;worldQ:THREE.Quaternion}[]=[];
  private edited:THREE.Object3D[]=[];private original:THREE.Quaternion[]=[];private modified=false;
  private anchors=[new THREE.Vector3(),new THREE.Vector3()];private anchorQ=[new THREE.Quaternion(),new THREE.Quaternion()];
  private previousRoot=new THREE.Vector3();private previousQ=new THREE.Quaternion();private initialized=false;
  private vectors=Array.from({length:48},()=>new THREE.Vector3());private quaternions=Array.from({length:40},()=>new THREE.Quaternion());private vi=0;private qi=0;
  private toes:THREE.Object3D[]=[];private toeRest:THREE.Quaternion[]=[];
  private anchored=[false,false];
  private thigh=[0,0];private calibration=4.5;private lift=.18;private calibrated=false;
  private swingTime=[0,0];private swingOffset=[new THREE.Vector3(),new THREE.Vector3()];
  private released=[false,false];private releaseTime=[0,0];private releaseOrigin=[new THREE.Vector3(),new THREE.Vector3()];
  constructor(private model:THREE.Object3D,private root:THREE.Object3D){
    const find=(name:string)=>model.getObjectByName('mixamorig'+name)??model.getObjectByName('mixamorig:'+name);
    const chains=['Left','Right'].map(side=>['UpLeg','Leg','Foot'].map(part=>find(side+part)));
    if(chains.some(c=>c.some(b=>!b)))return;this.chains=chains as THREE.Object3D[][];
    model.updateWorldMatrix(true,true);
    for(const chain of this.chains){
      const points=chain.map(b=>b.getWorldPosition(new THREE.Vector3()));
      this.restFeet.push(model.worldToLocal(points[2].clone()));this.restFootQ.push(model.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(chain[2].getWorldQuaternion(new THREE.Quaternion())));
      this.lengths.push([points[0].distanceTo(points[1]),points[1].distanceTo(points[2])]);
    }
    this.toes=['Left','Right'].map(s=>find(s+'ToeBase')).filter((b):b is THREE.Object3D=>!!b);this.toeRest=this.toes.map(b=>b.quaternion.clone());
    this.panels=['RuntimeSkirtFront','RuntimeSkirtBack'].map(n=>model.getObjectByName(n)).filter((b):b is THREE.Object3D=>!!b);
    this.panelRest=this.panels.map(b=>({q:b.quaternion.clone(),worldQ:root.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(b.getWorldQuaternion(new THREE.Quaternion()))}));
    this.edited=[...this.chains.flat(),...this.toes,...this.panels];this.original=this.edited.map(b=>b.quaternion.clone());
  }
  restore(){if(this.modified){this.edited.forEach((b,i)=>b.quaternion.copy(this.original[i]));this.modified=false;}}
  clear(){this.support?.reset();this.restore();this.anchored[0]=this.anchored[1]=false;this.initialized=false;this.released.fill(false);this.releaseTime.fill(0);this.swingTime.fill(0);this.calibrated=false;this.diagnostics.weight=0;this.diagnostics.planted.fill(false);}
  private v(){return this.vectors[this.vi++].set(0,0,0);}
  private q(){return this.quaternions[this.qi++].identity();}
  private setWorld(b:THREE.Object3D,q:THREE.Quaternion){b.quaternion.copy(b.parent!.getWorldQuaternion(this.q()).invert().multiply(q));b.updateWorldMatrix(false,true);}
  private aim(b:THREE.Object3D,child:THREE.Object3D,target:THREE.Vector3){const p=b.getWorldPosition(this.v()),from=child.getWorldPosition(this.v()).sub(p).normalize(),to=this.v().copy(target).sub(p).normalize();this.setWorld(b,this.q().setFromUnitVectors(from,to).multiply(b.getWorldQuaternion(this.q())));}
  apply(action:THREE.AnimationAction|undefined,dt:number,speed:number){
    if(!action||!action.enabled||!action.isScheduled()||action.getClip().name!=='Run'||action.getEffectiveWeight()<.001||!this.chains.length){if(this.initialized)this.support?.reset();this.anchored[0]=this.anchored[1]=false;this.initialized=false;this.diagnostics.weight=0;this.diagnostics.planted.fill(false);this.releaseTime.fill(0);this.swingTime.fill(0);this.released.fill(false);this.calibrated=false;return;}
    this.diagnostics.weight=action.getEffectiveWeight();this.vi=this.qi=0;this.model.updateWorldMatrix(true,true);
    const rootP=this.root.getWorldPosition(this.v()),rootQ=this.root.getWorldQuaternion(this.q());
    const distance=this.initialized?rootP.distanceTo(this.previousRoot):0,angle=this.initialized?rootQ.angleTo(this.previousQ):0;
    const teleported=distance>.5||angle>1;
    const moving=this.initialized&&(distance>1e-8||angle>1e-7);
    if(teleported){this.support?.reset();this.anchored[0]=this.anchored[1]=false;this.releaseTime.fill(0);this.swingTime.fill(0);this.released.fill(false);}
    if(this.support?.begin(dt,rootP))for(let side=0;side<2;side++)if(this.anchored[side]){this.anchored[side]=false;this.released[side]=true;this.releaseTime[side]=.08;this.releaseOrigin[side].copy(this.anchors[side]);this.diagnostics.unsupportedReleases++;}
    const weight=action.getEffectiveWeight();

    const rate=Math.max(.001,action.getEffectiveTimeScale()),duration=action.getClip().duration;
    const actualSpeed=speed>=0?speed:SABER_RUN_STRIDE.nominalSpeed*rate;
    const desiredCalibration=actualSpeed/rate,desiredLift=.075+.105*Math.min(1,actualSpeed/5.5);
    const ease=this.calibrated?1-Math.exp(-Math.max(0,dt)/.09):1;this.calibration=THREE.MathUtils.lerp(this.calibration,desiredCalibration,ease);this.lift=THREE.MathUtils.lerp(this.lift,desiredLift,ease);this.calibrated=true;
    const calibration=this.calibration,lift=this.lift;
    this.edited.forEach((b,i)=>this.original[i].copy(b.quaternion));this.modified=true;
    for(let side=0;side<2;side++){
      const [upper,lower,foot]=this.chains[side],sample=sampleSaberRunFoot(action.time/duration+side*.5,duration,calibration,lift);
      const target=this.v().copy(this.restFeet[side]);target.z+=sample.z;target.y+=sample.y;this.root.localToWorld(target);
      const footQ=this.q().copy(rootQ).multiply(this.q().setFromAxisAngle(this.v().set(1,0,0),-.10*sample.swing)).multiply(this.restFootQ[side]);
      const hip=upper.getWorldPosition(this.v()),[l1,l2]=this.lengths[side];
      let adjusted=!this.anchored[side]||!sample.contact;
      let supported=adjusted?this.support?.adjust(side,target,footQ,hip,l1,l2,sample.y,sample.contact,false)!==false:true;
      if(!sample.contact){if(this.anchored[side]){this.swingOffset[side].copy(this.anchors[side]).sub(target);this.swingTime[side]=.12;}this.anchored[side]=false;this.released[side]=false;}
      else if(!teleported&&!this.anchored[side]&&moving&&weight>=.995&&!this.released[side]&&this.releaseTime[side]<=0&&supported){this.anchors[side].copy(target);this.anchorQ[side].copy(footQ);this.anchored[side]=true;}
      if(this.anchored[side]&&hip.distanceTo(this.anchors[side])>l1+l2-.001){this.anchored[side]=false;this.released[side]=true;this.releaseTime[side]=.08;this.releaseOrigin[side].copy(this.anchors[side]);this.diagnostics.reachReleases++;if(!adjusted){supported=this.support?.adjust(side,target,footQ,hip,l1,l2,sample.y,sample.contact,false)!==false;adjusted=true;}}
      if(this.anchored[side]){target.copy(this.anchors[side]);footQ.copy(this.anchorQ[side]);}
      if(this.swingTime[side]>0){this.swingTime[side]=Math.max(0,this.swingTime[side]-dt);target.addScaledVector(this.swingOffset[side],(this.swingTime[side]/.12)**2);}
      if(this.releaseTime[side]>0){this.releaseTime[side]=Math.max(0,this.releaseTime[side]-dt);const t=1-this.releaseTime[side]/.08;target.lerpVectors(this.releaseOrigin[side],target,t*t*(3-2*t));target.y+=.025*Math.sin(Math.PI*t);}
      if(weight<.99999){target.lerpVectors(foot.getWorldPosition(this.v()),target,weight);footQ.slerp(foot.getWorldQuaternion(this.q()),1-weight);}
      if(!this.anchored[side]||weight<.99999)this.support?.adjust(side,target,footQ,hip,l1,l2,0,sample.contact,true);
      this.diagnostics.maxTargetError=Math.max(this.diagnostics.maxTargetError,target.distanceTo(hip)-(l1+l2-.0001));
      const delta=this.v().copy(target).sub(hip),d=THREE.MathUtils.clamp(delta.length(),Math.abs(l1-l2)+.0001,l1+l2-.0001),axis=delta.normalize();
      const pole=this.v().set(0,0,1).applyQuaternion(rootQ);if(weight<.99999)pole.lerpVectors(lower.getWorldPosition(this.v()).sub(hip).normalize(),pole,weight);pole.addScaledVector(axis,-pole.dot(axis)).normalize();
      const along=(l1*l1-l2*l2+d*d)/(2*d),height=Math.sqrt(Math.max(0,l1*l1-along*along));
      const knee=this.v().copy(hip).addScaledVector(axis,along).addScaledVector(pole,height),end=this.v().copy(hip).addScaledVector(axis,d);
      this.aim(upper,lower,knee);this.aim(lower,foot,end);this.setWorld(foot,footQ);if(this.toes[side]){this.toes[side].quaternion.slerp(this.toeRest[side],weight);this.toes[side].updateWorldMatrix(false,true);}
      const direction=this.v().copy(knee).sub(hip).applyQuaternion(this.q().copy(rootQ).invert());this.thigh[side]=Math.atan2(-direction.z,-direction.y);
      if(this.anchored[side]&&weight>=.99999)this.diagnostics.maxAnchorError=Math.max(this.diagnostics.maxAnchorError,foot.getWorldPosition(this.v()).distanceTo(this.anchors[side]));
    }
    for(let i=0;i<this.panels.length;i++){
      const panel=this.panels[i],rest=this.panelRest[i],front=panel.name.endsWith('Front'),limit=front?.24:.12;
      const demand=front?Math.min(0,...this.thigh)*.4:Math.max(0,...this.thigh)*.5,angle=limit*Math.tanh(demand/limit);
      panel.quaternion.copy(rest.q).multiply(this.q().copy(rest.worldQ).invert().multiply(this.q().setFromAxisAngle(this.v().set(1,0,0),angle)).multiply(rest.worldQ));
    }
    if(weight<.99999){for(const panel of this.panels)panel.quaternion.slerp(this.original[this.edited.indexOf(panel)],1-weight);this.model.updateWorldMatrix(true,true);}
    for(let side=0;side<2;side++)this.diagnostics.planted[side]=this.anchored[side]&&weight>=.99999;
    if(dt>0||!this.initialized){this.previousRoot.copy(rootP);this.previousQ.copy(rootQ);this.initialized=true;}
  }
}

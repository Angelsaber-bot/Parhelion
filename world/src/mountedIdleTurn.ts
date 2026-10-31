import * as T from 'three';

type Leg = { bones:T.Object3D[]; original:T.Quaternion[]; anchor:T.Vector3; start:T.Vector3; native:T.Vector3; swing:boolean };
/** Napoleon-only visual diagonal steps during upright, stationary idle turns.
 * Native-height accommodation is not terrain foot locking. No root, rider,
 * clip, collision, target, event or attack timing is modified. */
export class MountedIdleTurn {
  private readonly legs:Leg[]=[];
  private readonly vectors=Array.from({length:22},()=>new T.Vector3());
  private readonly quaternions=Array.from({length:7},()=>new T.Quaternion());
  private readonly previousP=new T.Vector3();
  private readonly previousQ=new T.Quaternion();
  private disposed=false;private initialized=false;private modified=false;private phase=0;private weight=0;private lastGroup=-1;
  readonly diagnostics={frames:0,maxReachError:0,maxFootError:0,maxSupportAdjustment:0};
  constructor(private readonly root:T.Object3D,model:T.Object3D){
    const names=['L','R'].flatMap(s=>[[`H_ForeUpper_${s}`,`H_ForeCannon_${s}`,`H_ForeHoof_${s}`],[`H_HindThigh_${s}`,`H_HindShin_${s}`,`H_HindCannon_${s}`,`H_HindHoof_${s}`]]);
    const chains=names.map(ns=>ns.map(n=>model.getObjectByName(n)));
    if(chains.some(chain=>chain.some(bone=>!bone)))return;
    for(const chain of chains){const bones=chain as T.Object3D[];this.legs.push({bones,original:bones.map(b=>b.quaternion.clone()),anchor:new T.Vector3(),start:new T.Vector3(),native:new T.Vector3(),swing:false});}
  }
  restore(){if(!this.modified)return;for(const leg of this.legs)for(let j=0;j<leg.bones.length;j++)leg.bones[j].quaternion.copy(leg.original[j]);this.root.updateWorldMatrix(true,true);this.modified=false;}
  reset(){this.restore();this.initialized=false;this.phase=0;this.weight=0;this.lastGroup=-1;for(const leg of this.legs)leg.swing=false;}
  dispose(){if(this.disposed)return;this.reset();this.disposed=true;}
  apply(dt:number,state:string){
    if(this.disposed||!this.legs.length||!Number.isFinite(dt)||dt<=0||dt>.1)return;
    this.root.updateWorldMatrix(true,true);const v=this.vectors,q=this.quaternions,p=this.root.getWorldPosition(v[0]),rotation=this.root.getWorldQuaternion(q[0]);
    if(!Number.isFinite(p.x)||!Number.isFinite(p.y)||!Number.isFinite(p.z)||!Number.isFinite(rotation.x)||!Number.isFinite(rotation.y)||!Number.isFinite(rotation.z)||!Number.isFinite(rotation.w)){this.reset();return;}
    const upright=v[1].set(0,1,0).applyQuaternion(rotation).y>1-1e-8;
    const active=upright&&this.initialized&&state==='idle'&&p.distanceTo(this.previousP)<.003&&rotation.angleTo(this.previousQ)<.3;
    const turn=active?rotation.angleTo(this.previousQ)/dt:0;
    if(!active){this.weight=0;this.phase=0;this.lastGroup=-1;}
    this.weight=T.MathUtils.clamp(this.weight+(turn>.12?dt/.07:-dt/.18),0,1);
    for(const leg of this.legs){leg.bones[leg.bones.length-1].getWorldPosition(leg.native);if(!this.initialized||!active||this.weight===0)leg.anchor.copy(leg.native);}
    this.previousP.copy(p);this.previousQ.copy(rotation);this.initialized=true;
    if(!active||!this.weight){this.phase=0;this.lastGroup=-1;for(const leg of this.legs)leg.swing=false;return;}
    this.phase+=dt;const group=Math.floor(this.phase/.12)%2,u=(this.phase%.12)/.12;
    if(group!==this.lastGroup){for(let i=0;i<this.legs.length;i++){const leg=this.legs[i];if(leg.swing)leg.bones[leg.bones.length-1].getWorldPosition(leg.anchor);leg.start.copy(leg.anchor);leg.swing=(i===0||i===3?0:1)===group;}this.lastGroup=group;}
    for(const leg of this.legs){
      const chain=leg.bones;for(let j=0;j<chain.length;j++)leg.original[j].copy(chain[j].quaternion);
      const target=v[2].copy(leg.anchor);if(leg.swing){target.copy(leg.start).lerp(leg.native,u*u*(3-2*u));target.y+=Math.sin(Math.PI*u)*.055;}
      const last=chain[chain.length-1],endpoint=chain[2];last.getWorldQuaternion(q[1]);endpoint.getWorldQuaternion(q[2]);
      const endTarget=v[5].copy(target);if(chain.length===4)endTarget.sub(v[4].copy(leg.native).sub(endpoint.getWorldPosition(v[3])));
      const hip=chain[0].getWorldPosition(v[6]),mid=chain[1].getWorldPosition(v[7]),end=endpoint.getWorldPosition(v[8]),reach=hip.distanceTo(mid)+mid.distanceTo(end)-.00001,dy=endTarget.y-hip.y,radial=v[9].set(endTarget.x-hip.x,0,endTarget.z-hip.z),radius=Math.sqrt(Math.max(0,reach*reach-dy*dy));
      // Reachable-plane retreat avoids stretching near-straight forelegs. Residual
      // horizontal accommodation remains visible/measured, never called a lock.
      if(Math.abs(dy)<reach&&radial.length()>radius){v[10].copy(endTarget);radial.setLength(radius);endTarget.x=hip.x+radial.x;endTarget.z=hip.z+radial.z;const adjustment=v[11].copy(endTarget).sub(v[10]);target.add(adjustment);if(!leg.swing)leg.anchor.add(adjustment);this.diagnostics.maxSupportAdjustment=Math.max(this.diagnostics.maxSupportAdjustment,adjustment.length());}
      this.solve(chain[0],chain[1],endpoint,endTarget);if(chain.length===4)this.worldQ(endpoint,q[2]);this.worldQ(last,q[1]);
      this.diagnostics.maxFootError=Math.max(this.diagnostics.maxFootError,last.getWorldPosition(v[3]).distanceTo(target));
      for(let j=0;j<chain.length;j++)chain[j].quaternion.slerpQuaternions(leg.original[j],q[6].copy(chain[j].quaternion),this.weight);
      chain[0].updateWorldMatrix(false,true);
    }
    this.modified=true;this.diagnostics.frames++;
  }
  private worldQ(bone:T.Object3D,world:T.Quaternion){bone.quaternion.copy(bone.parent!.getWorldQuaternion(this.quaternions[4]).invert().multiply(world));bone.updateWorldMatrix(false,true);}
  private aim(bone:T.Object3D,child:T.Object3D,direction:T.Vector3){const v=this.vectors,q=this.quaternions,from=child.getWorldPosition(v[20]).sub(bone.getWorldPosition(v[21])).normalize();bone.getWorldQuaternion(q[3]);q[5].setFromUnitVectors(from,direction.normalize()).multiply(q[3]);this.worldQ(bone,q[5]);}
  private solve(a:T.Object3D,b:T.Object3D,c:T.Object3D,target:T.Vector3){
    const v=this.vectors,hip=a.getWorldPosition(v[12]),knee=b.getWorldPosition(v[13]),foot=c.getWorldPosition(v[14]),l1=hip.distanceTo(knee),l2=knee.distanceTo(foot),axis=v[15].copy(target).sub(hip),raw=axis.length(),d=T.MathUtils.clamp(raw,Math.abs(l1-l2)+1e-5,l1+l2-1e-5);axis.normalize();this.diagnostics.maxReachError=Math.max(this.diagnostics.maxReachError,Math.abs(raw-d));
    const offset=v[17].copy(knee).sub(hip),pole=v[16].copy(offset).addScaledVector(axis,-offset.dot(axis));
    if(pole.lengthSq()<1e-8){pole.set(0,0,1).applyQuaternion(this.root.getWorldQuaternion(this.quaternions[3]));pole.addScaledVector(axis,-pole.dot(axis));}pole.normalize();
    const along=(l1*l1-l2*l2+d*d)/(2*d),height=Math.sqrt(Math.max(0,l1*l1-along*along)),joint=v[18].copy(hip).addScaledVector(axis,along).addScaledVector(pole,height);
    this.aim(a,b,v[19].copy(joint).sub(hip));this.aim(b,c,v[19].copy(hip).addScaledVector(axis,d).sub(joint));
  }
}

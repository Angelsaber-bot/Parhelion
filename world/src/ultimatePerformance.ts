import * as THREE from 'three';
export interface UltimatePerformanceFrame { phase:'intro'|'charge'|'release'|'outro'; progress:number; elapsed:number; strikeCount?:number; reduced?:boolean; }
export interface UltimatePerformance { readonly anchors:{socket?:THREE.Object3D;head?:THREE.Object3D;leftFoot?:THREE.Object3D;rightFoot?:THREE.Object3D}; update(frame:UltimatePerformanceFrame):void;reset():void;dispose():void; }
const smooth=(x:number)=>{x=THREE.MathUtils.clamp(x,0,1);return x*x*(3-2*x);};
/** Saber-only original stage performance. Pass a PRIVATE clone, after its base
 * animation/live pose has been evaluated. Never owns source actor or hit clocks. */
export function createUltimatePerformance(identity:string,root:THREE.Object3D):UltimatePerformance{
 const names=['Hips','Spine','Spine1','Spine2','Head','RightArm','RightForeArm','RightHand','LeftArm','LeftForeArm','LeftHand','LeftFoot','RightFoot'];
 const bones=Object.fromEntries(names.map(n=>[n,root.getObjectByName('mixamorig'+n)]));
 const socket=root.getObjectByName('WeaponSocket_R');
 const anchors={socket,head:bones.Head,leftFoot:bones.LeftFoot,rightFoot:bones.RightFoot};
 if(identity!=='saber'||!socket||names.some(n=>!bones[n]))return{anchors,update(){},reset(){},dispose(){}};
 const base=new Map<THREE.Object3D,{q:THREE.Quaternion;p:THREE.Vector3}>();
 for(const name of ['Spine','Spine1','Spine2','Head']){const b=bones[name]!;base.set(b,{q:b.quaternion.clone(),p:b.position.clone()});}
 const vectors=Array.from({length:128},()=>new THREE.Vector3()),quaternions=Array.from({length:96},()=>new THREE.Quaternion());let vi=0,qi=0;
 const nv=(x=0,y=0,z=0)=>vectors[vi++].set(x,y,z),nq=()=>quaternions[qi++].identity(),cv=(p:THREE.Vector3)=>nv().copy(p),cq=(q:THREE.Quaternion)=>nq().copy(q);
 let strikeStart=-1,lastStrike=0,disposed=false;
 const basis=new THREE.Matrix4();
 const v=(a:number[])=>nv(a[0],a[1],a[2]);
 const world=(p:THREE.Vector3)=>root.localToWorld(cv(p));
 const worldAxis=(p:THREE.Vector3)=>cv(p).transformDirection(root.matrixWorld);
 const setWorldQ=(bone:THREE.Object3D,q:THREE.Quaternion)=>{bone.quaternion.copy(bone.parent!.getWorldQuaternion(nq()).invert().multiply(q));bone.updateWorldMatrix(false,true);};
 const aim=(bone:THREE.Object3D,child:THREE.Object3D,target:THREE.Vector3)=>{
  const p=bone.getWorldPosition(nv()),from=child.getWorldPosition(nv()).sub(p).normalize(),to=cv(target).sub(p).normalize();
  setWorldQ(bone,nq().setFromUnitVectors(from,to).multiply(bone.getWorldQuaternion(nq())));
 };
 // Analytic 2-bone solver: pole is authored in root-space, not guessed Euler axes.
 const arm=(side:'Left'|'Right',target:THREE.Vector3)=>{
  const upper=bones[side+'Arm']!,lower=bones[side+'ForeArm']!,hand=bones[side+'Hand']!;
  const a=upper.getWorldPosition(nv()),b=lower.getWorldPosition(nv()),c=hand.getWorldPosition(nv());
  const l1=a.distanceTo(b),l2=b.distanceTo(c),delta=cv(target).sub(a),distance=THREE.MathUtils.clamp(delta.length(),Math.abs(l1-l2)+.0001,l1+l2-.0001),axis=delta.normalize();
  const along=(l1*l1-l2*l2+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,l1*l1-along*along));
  const pole=worldAxis(nv(side==='Left'?1:-1,-.45,.32));pole.addScaledVector(axis,-pole.dot(axis)).normalize();
  const elbow=cv(a).addScaledVector(axis,along).addScaledVector(pole,height),end=cv(a).addScaledVector(axis,distance);
  aim(upper,lower,elbow);aim(lower,hand,end);
 };
 const orientSword=(direction:THREE.Vector3)=>{
  const y=worldAxis(direction).normalize(),x=worldAxis(nv(-1,0,0));x.addScaledVector(y,-x.dot(y)).normalize();const z=cv(x).cross(y).normalize();x.crossVectors(y,z).normalize();
  const desired=nq().setFromRotationMatrix(basis.makeBasis(x,y,z));
  setWorldQ(bones.RightHand!,desired.multiply(cq(socket.quaternion).invert()));
 };
 const supportGrip=()=>{
  root.updateWorldMatrix(true,true);
  // Hand is below the right grip, along the measured socket +Y blade axis.
  const target=socket.localToWorld(nv(0,-.105,.018));arm('Left',target);
  const q=bones.RightHand!.getWorldQuaternion(nq());
  q.multiply(nq().setFromAxisAngle(nv(0,1,0),Math.PI));setWorldQ(bones.LeftHand!,q);
 };
 const restore=()=>{for(const [b,p]of base){b.quaternion.copy(p.q);b.position.copy(p.p);}root.updateWorldMatrix(true,true);};
 return{anchors,update(frame){
  if(disposed||!Number.isFinite(frame.elapsed))return;
  vi=qi=0;const p=THREE.MathUtils.clamp(frame.progress,0,1);root.updateWorldMatrix(true,true);
  if(frame.phase==='intro'||frame.phase==='charge'){
   restore();const charge=frame.phase==='charge';const t=smooth(charge?p:frame.elapsed/.65);
   const start=charge?v([-.18,1.19,.24]):v([-.30,1.12,.19]);
   const end=charge?v([-.13,1.49,.20]):v([-.18,1.19,.24]);
   const wrist=start.lerp(end,t);
   // Distributed chest wind-up, with quiet head counterturn, no global limb Euler rotations.
   for(const [name,angle]of [['Spine',-.035],['Spine1',-.07],['Spine2',-.10],['Head',.10]] as const){
    const b=bones[name]!,axis=worldAxis(nv(0,1,0));
    const parentQ=b.parent!.getWorldQuaternion(nq());axis.applyQuaternion(parentQ.invert());b.quaternion.premultiply(nq().setFromAxisAngle(axis,(charge?t:0)*angle));b.updateWorldMatrix(false,true);
   }
   arm('Right',world(wrist));
   const direction=charge?v([-.25,.96,.12]).lerp(v([-.15,.96,-.24]),t):v([-.25,.96,.12]);orientSword(direction.normalize());supportGrip();
  }else{
   const strikes=frame.strikeCount??0;
   if(strikes>lastStrike){strikeStart=frame.elapsed;lastStrike=strikes;}
   const age=strikeStart<0?-1:Math.max(0,frame.elapsed-strikeStart);
   // Original two-handed downward-forward stroke, driven by the accepted contact
   // notification. This is presentation only: no source pose or damage mutation.
   const sweep=age<0?0:smooth(age/.14),settle=age<.14?0:smooth((age-.14)/.38);
   restore();
   const twist=THREE.MathUtils.lerp(-.205,.14,sweep)*(1-settle*.35);
   for(const [name,weight]of [['Spine',.17],['Spine1',.34],['Spine2',.49],['Head',-.35]] as const){
    const b=bones[name]!,axis=worldAxis(nv(0,1,0));axis.applyQuaternion(b.parent!.getWorldQuaternion(nq()).invert());b.quaternion.premultiply(nq().setFromAxisAngle(axis,twist*weight));b.updateWorldMatrix(false,true);
   }
   const wrist=v([-.13,1.49,.20]).lerp(v([-.10,1.04,.30]),sweep).lerp(v([-.15,1.10,.25]),settle*.3);
   arm('Right',world(wrist));
   const direction=v([-.15,.96,-.24]).lerp(v([.55,-.30,.78]),sweep).normalize();orientSword(direction);supportGrip();
  }
  root.updateWorldMatrix(true,true);
 },reset(){strikeStart=-1;lastStrike=0;},dispose(){disposed=true;base.clear();}};
}

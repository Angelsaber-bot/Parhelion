import * as THREE from 'three';
import type {UltimatePerformance,UltimatePerformanceFrame} from './ultimatePerformance';
const smooth=(x:number)=>{x=THREE.MathUtils.clamp(x,0,1);return x*x*(3-2*x);};
/** Private stage acting only. Release always converges to the actual source pose
 * BEFORE the earliest authored contact; counters never manufacture a hit. */
export function createCaptainCavalryPerformance(identity:string,root:THREE.Object3D,clips:readonly THREE.AnimationClip[]=[]):UltimatePerformance {
 const mounted=identity==='napoleon'||identity==='napoleonMounted',get=(n:string)=>root.getObjectByName(n);
 const socket=get(mounted?'SaberSocket':'Blackbeard_Muzzle'),head=get('Head'),leftFoot=get(mounted?'H_ForeHoof_L':'FootL'),rightFoot=get(mounted?'H_ForeHoof_R':'FootR'),anchors={socket,head,leftFoot,rightFoot};
 const names=['Hips','Spine','Chest','Neck','Head','UpperArmR','ForearmR','HandR','UpperArmL','ForearmL','HandL',...(!mounted?['ThighL','ShinL','FootL','ThighR','ShinR','FootR']:[])];
 if(!socket||!head||names.some(n=>!get(n)))return{anchors,update(){},reset(){},dispose(){}};
 const bones=names.map(n=>get(n)!),base=bones.map(b=>({p:b.position.clone(),q:b.quaternion.clone()})),last=bones.map(b=>({p:b.position.clone(),q:b.quaternion.clone()})),windup=bones.map(b=>({p:b.position.clone(),q:b.quaternion.clone()}));
 root.updateWorldMatrix(true,true);const feet=['L','R'].map(s=>root.worldToLocal(get(mounted?'H_ForeHoof_'+s:'Foot'+s)!.getWorldPosition(new THREE.Vector3())));
 const vectors=Array.from({length:180},()=>new THREE.Vector3()),quats=Array.from({length:130},()=>new THREE.Quaternion());let vi=0,qi=0;
 const v=(x=0,y=0,z=0)=>vectors[vi++].set(x,y,z),q=()=>quats[qi++].identity(),cv=(a:THREE.Vector3)=>v().copy(a),world=(a:THREE.Vector3)=>root.localToWorld(cv(a)),axis=(a:THREE.Vector3)=>cv(a).transformDirection(root.matrixWorld),wp=(b:THREE.Object3D)=>b.getWorldPosition(v()),wq=(b:THREE.Object3D)=>b.getWorldQuaternion(q());
 const setQ=(b:THREE.Object3D,a:THREE.Quaternion)=>{b.quaternion.copy(wq(b.parent!).invert().multiply(a));b.updateWorldMatrix(false,true);};
 const rotate=(name:string,a:THREE.Vector3,angle:number)=>{const b=get(name)!;setQ(b,q().setFromAxisAngle(axis(a),angle).multiply(wq(b)));};
 const aim=(b:THREE.Object3D,c:THREE.Object3D,target:THREE.Vector3)=>{const p=wp(b),from=wp(c).sub(p).normalize(),to=cv(target).sub(p).normalize();setQ(b,q().setFromUnitVectors(from,to).multiply(wq(b)));};
 const solve=(chain:THREE.Object3D[],target:THREE.Vector3,pole:THREE.Vector3)=>{const[a,b,c]=chain,p=wp(a),l1=p.distanceTo(wp(b)),l2=wp(b).distanceTo(wp(c)),d=cv(target).sub(p),distance=THREE.MathUtils.clamp(d.length(),Math.abs(l1-l2)+.00001,l1+l2-.00001),direction=d.normalize(),along=(l1*l1-l2*l2+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,l1*l1-along*along));pole=axis(pole);pole.addScaledVector(direction,-pole.dot(direction)).normalize();aim(a,b,cv(p).addScaledVector(direction,along).addScaledVector(pole,height));aim(b,c,cv(p).addScaledVector(direction,distance));};
 const arm=(side:'L'|'R',target:THREE.Vector3)=>solve(['UpperArm','Forearm','Hand'].map(n=>get(n+side)!),world(target),v(side==='R'?-1:1,-.7,.1));
 const basis=new THREE.Matrix4();
 const gun=(direction:THREE.Vector3)=>{const z=axis(direction).normalize(),y=axis(v(0,1,0));y.addScaledVector(z,-y.dot(z)).normalize();const x=cv(y).cross(z).normalize();y.crossVectors(z,x);setQ(get('HandR')!,q().setFromRotationMatrix(basis.makeBasis(x,y,z)).multiply(q().copy(socket.quaternion).invert()));};
 const blade=(direction:THREE.Vector3)=>{const tip=get('SaberTip');if(!tip)return;const hand=get('HandR')!,current=wp(tip).sub(wp(socket)).normalize(),desired=axis(direction).normalize();setQ(hand,q().setFromUnitVectors(current,desired).multiply(wq(hand)));};
 const gaitClip=mounted?clips.find(c=>c.name==='MountedRun'):undefined,gait=gaitClip?new THREE.AnimationMixer(root):undefined;
 if(gait&&gaitClip)gait.clipAction(new THREE.AnimationClip('Remaster presentation gallop',gaitClip.duration,gaitClip.tracks.filter(t=>/^H_/.test(t.name)))).play();
 let previous='',releaseAt=-1,disposed=false;
 const store=(to:typeof last)=>{for(let i=0;i<bones.length;i++){to[i].p.copy(bones[i].position);to[i].q.copy(bones[i].quaternion);}};
 return{anchors,update(frame:UltimatePerformanceFrame){
  if(disposed||!Number.isFinite(frame.elapsed))return;vi=qi=0;
  if(frame.phase==='release'){
   if(previous!=='release')releaseAt=frame.elapsed;
   const blend=smooth((frame.elapsed-releaseAt)/.14);
   if(blend<1)for(let i=0;i<bones.length;i++){bones[i].position.lerpVectors(windup[i].p,bones[i].position,blend);bones[i].quaternion.slerpQuaternions(windup[i].q,bones[i].quaternion,blend);}
   // Actual live actor cut/fire including true native contact, never post-hit fake swing.
   store(last);root.updateWorldMatrix(true,true);previous=frame.phase;return;
  }
  if(frame.phase==='outro'){
   const settle=smooth(frame.progress);for(let i=0;i<bones.length;i++){bones[i].position.lerpVectors(last[i].p,base[i].p,settle);bones[i].quaternion.slerpQuaternions(last[i].q,base[i].q,settle);}
   root.updateWorldMatrix(true,true);
   if(mounted){const rein=get('H_ReinGrip')??get('ReinSocket');if(rein)arm('L',root.worldToLocal(wp(rein)));const grip=wp(socket),tip=get('SaberTip');if(tip){const direction=wp(tip).sub(grip).normalize();const up=axis(v(-.35,.85,.40)).normalize();direction.lerp(up,settle).normalize();blade(cv(direction).transformDirection(basis.copy(root.matrixWorld).invert()));}}
   root.updateWorldMatrix(true,true);previous=frame.phase;return;
  }
  if(gait)gait.setTime(frame.phase==='intro'?0:frame.elapsed*(.55+.55*smooth(frame.progress)));
  for(let i=0;i<bones.length;i++){bones[i].position.copy(base[i].p);bones[i].quaternion.copy(base[i].q);}root.updateWorldMatrix(true,true);
  const p=smooth(frame.progress),intro=frame.phase==='intro';
  if(mounted){
   // Rider commits over the saddle, rein hand stays on the actual rig's grip.
   rotate('Spine',v(1,0,0),intro?.025:.10+.085*p);rotate('Chest',v(0,1,0),intro?-.05*p:-.13+.09*p);rotate('Head',v(1,0,0),intro?-.015:-.07);rotate('Head',v(0,1,0),intro?.10*(1-p):.04);
   const wrist=intro?v(-.40,2.20,.35).lerp(v(-.39,2.43,.23),p):v(-.39,2.43,.23).lerp(v(-.48,2.47,.42),p);
   arm('R',wrist);blade(intro?v(-.12,.98,.15).lerp(v(-.32,.92,.22),p):v(-.32,.92,.22).lerp(v(-.18,.58,.80),p));
   const rein=get('H_ReinGrip')??get('ReinSocket');if(rein){const target=root.worldToLocal(wp(rein));arm('L',target);}
  }else{
   // A planted captain's stance: load knees, pivot chest, draw the flintlock,
   // raise the free hand to the tricorn then extend the broadside command.
   const weight=intro?.35*p: .35+.65*p;get('Hips')!.position.y-=.045*weight;root.updateWorldMatrix(true,true);
   rotate('Spine',v(0,1,0),-.18*weight);rotate('Chest',v(0,1,0),-.09*weight);rotate('Chest',v(1,0,0),.035*weight);rotate('Head',v(0,1,0),.13*weight);
   for(let i=0;i<2;i++){const side=i?'R':'L',foot=get('Foot'+side)!,rotation=wq(foot);solve(['Thigh','Shin','Foot'].map(n=>get(n+side)!),world(feet[i]),v(0,0,1));setQ(foot,rotation);}
   const wrist=intro?v(-.39,1.02,.16).lerp(v(-.42,1.52,.18),p):v(-.42,1.52,.18).lerp(v(-.44,1.47,.40),smooth((p-.35)/.65));
   arm('R',wrist);gun(intro?v(.04,.85,.52):v(.04,.85,.52).lerp(v(-.05,.04,1),smooth((p-.35)/.65)).normalize());
   const left=intro?v(.39,1.05,.16).lerp(v(.24,1.79,.07),Math.sin(p*Math.PI*.5)):v(.24,1.79,.07).lerp(v(.58,1.52,.38),smooth(p));
   arm('L',left);
  }
  root.updateWorldMatrix(true,true);store(windup);store(last);previous=frame.phase;
 },reset(){previous='';releaseAt=-1;},dispose(){if(disposed)return;disposed=true;gait?.stopAllAction();gait?.uncacheRoot(root);}};
}

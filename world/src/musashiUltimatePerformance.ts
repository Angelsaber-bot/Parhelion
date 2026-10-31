import * as THREE from 'three';
import type { UltimatePerformance, UltimatePerformanceFrame } from './ultimatePerformance';
import {skillAnimationProfile,skillAnimationSample} from './skillAnimationProfile';
const smooth=(x:number)=>{x=THREE.MathUtils.clamp(x,0,1);return x*x*(3-2*x);};
/** Musashi-only private-clone performance. Sword choreography never generates hits.
 * Preserves native face/costume/hair, socket locals, fingers, scale and root travel. */
export function createMusashiUltimatePerformance(root:THREE.Object3D,clips:readonly THREE.AnimationClip[]=[]):UltimatePerformance {
 const get=(n:string)=>root.getObjectByName('mixamorig'+n);
 const head=get('Head'),socket=root.getObjectByName('Attachment_RightHand_Katana'),leftSocket=root.getObjectByName('Attachment_LeftHand_Katana');
 const anchors={socket,head,leftFoot:get('LeftToe_End'),rightFoot:get('RightToe_End')};
 const names=['RightArm','RightForeArm','RightHand','LeftArm','LeftForeArm','LeftHand','Spine','Spine2','Hips','LeftUpLeg','LeftLeg','LeftFoot','RightUpLeg','RightLeg','RightFoot'];
 if(!head||!socket||!leftSocket||names.some(n=>!get(n)))return{anchors,update(){},reset(){},dispose(){}};
 const r=['RightArm','RightForeArm','RightHand'].map(n=>get(n)!),l=['LeftArm','LeftForeArm','LeftHand'].map(n=>get(n)!);
 const spine=[get('Spine')!,get('Spine2')!,head],pelvis=get('Hips')!;
 const legs=['Left','Right'].map(side=>['UpLeg','Leg','Foot'].map(n=>get(side+n)!));
 root.updateWorldMatrix(true,true);
 const footStarts=legs.map(chain=>root.worldToLocal(chain[2].getWorldPosition(new THREE.Vector3())));
 const base=[...r,...l,...spine,pelvis,...legs.flat()].map(b=>({b,q:b.quaternion.clone(),p:b.position.clone()}));
 const vs=Array.from({length:192},()=>new THREE.Vector3()),qs=Array.from({length:128},()=>new THREE.Quaternion());let vi=0,qi=0;
 const v=(x=0,y=0,z=0)=>vs[vi++].set(x,y,z),q=()=>qs[qi++].identity(),cv=(x:THREE.Vector3)=>v().copy(x);
 const matrix=new THREE.Matrix4();let lastStrike=0,strikeAt=-1,releaseAt=-1,disposed=false;
 // Derive anticipation from the unchanged gameplay remap; effects still require
 // actual contact notifications. A delayed contact holds at the pre-contact pose.
 const duration=clips.find(c=>c.name==='Attack')?.duration??1.6,contacts=[19/30,33/30],planned:number[]=[];let total=0;
 for(let cycle=0;planned.length<3;cycle++){
  const profile=skillAnimationProfile('musashi','ultimate',cycle),span=skillAnimationSample(profile,0,duration,contacts[0]).duration;
  for(const contact of contacts){if(planned.length===3)break;let lo=0,hi=span;for(let i=0;i<30;i++){const mid=(lo+hi)/2;if(skillAnimationSample(profile,mid,duration,contacts[0]).clipTime<contact)lo=mid;else hi=mid;}planned.push(total+hi);}total+=span;
 }
 const world=(x:THREE.Vector3)=>root.localToWorld(cv(x));
 const axis=(x:THREE.Vector3)=>cv(x).transformDirection(root.matrixWorld);
 const setWorld=(b:THREE.Object3D,rotation:THREE.Quaternion)=>{b.quaternion.copy(b.parent!.getWorldQuaternion(q()).invert().multiply(rotation));b.updateWorldMatrix(false,true);};
 const aim=(b:THREE.Object3D,c:THREE.Object3D,target:THREE.Vector3)=>{const p=b.getWorldPosition(v()),from=c.getWorldPosition(v()).sub(p).normalize(),to=cv(target).sub(p).normalize();setWorld(b,q().setFromUnitVectors(from,to).multiply(b.getWorldQuaternion(q())));};
 const arm=(chain:THREE.Object3D[],target:THREE.Vector3,side:number)=>{
  const [upper,lower,hand]=chain,a=upper.getWorldPosition(v()),b=lower.getWorldPosition(v()),c=hand.getWorldPosition(v()),l1=a.distanceTo(b),l2=b.distanceTo(c),delta=cv(target).sub(a),d=THREE.MathUtils.clamp(delta.length(),Math.abs(l1-l2)+1e-5,l1+l2-1e-5),direction=delta.normalize();
  const along=(l1*l1-l2*l2+d*d)/(2*d),height=Math.sqrt(Math.max(0,l1*l1-along*along)),pole=axis(v(side,-.6,.1));pole.addScaledVector(direction,-pole.dot(direction)).normalize();
  aim(upper,lower,cv(a).addScaledVector(direction,along).addScaledVector(pole,height));aim(lower,hand,cv(a).addScaledVector(direction,d));
 };
 const plantLeg=(chain:THREE.Object3D[],target:THREE.Vector3)=>{
  const [upper,lower,foot]=chain,a=upper.getWorldPosition(v()),b=lower.getWorldPosition(v()),c=foot.getWorldPosition(v()),l1=a.distanceTo(b),l2=b.distanceTo(c),delta=cv(target).sub(a),d=THREE.MathUtils.clamp(delta.length(),Math.abs(l1-l2)+1e-5,l1+l2-1e-5),direction=delta.normalize();
  const along=(l1*l1-l2*l2+d*d)/(2*d),height=Math.sqrt(Math.max(0,l1*l1-along*along)),pole=axis(v(0,0,1)),footQ=foot.getWorldQuaternion(q());pole.addScaledVector(direction,-pole.dot(direction)).normalize();
  aim(upper,lower,cv(a).addScaledVector(direction,along).addScaledVector(pole,height));aim(lower,foot,cv(a).addScaledVector(direction,d));setWorld(foot,footQ);
 };
 const torso=(yaw:number,lean:number)=>{for(let i=0;i<spine.length;i++){const bone=spine[i],weight=i===2?-.4:i===0?.35:.65,parent=bone.parent!.getWorldQuaternion(q()).invert(),ay=axis(v(0,1,0)).applyQuaternion(parent),ax=axis(v(1,0,0)).applyQuaternion(parent);bone.quaternion.premultiply(q().setFromAxisAngle(ay,yaw*weight)).premultiply(q().setFromAxisAngle(ax,lean*weight));bone.updateWorldMatrix(false,true);}};
 const orient=(chain:THREE.Object3D[],anchor:THREE.Object3D,direction:THREE.Vector3)=>{const z=axis(direction).normalize(),y=axis(v(0,1,0));y.addScaledVector(z,-y.dot(z)).normalize();const x=cv(y).cross(z).normalize();y.crossVectors(z,x);setWorld(chain[2],q().setFromRotationMatrix(matrix.makeBasis(x,y,z)).multiply(q().copy(anchor.quaternion).invert()));};
 return {anchors,update(frame:UltimatePerformanceFrame){
  if(disposed||!Number.isFinite(frame.elapsed)||!Number.isFinite(frame.progress))return;vi=qi=0;
  for(const s of base){s.b.quaternion.copy(s.q);s.b.position.copy(s.p);}root.updateWorldMatrix(true,true);
  if(frame.phase==='release'&&releaseAt<0)releaseAt=frame.elapsed;
  const count=Math.min(3,Math.max(0,Math.floor(frame.strikeCount??0)));
  if(frame.phase==='release'&&count>lastStrike){lastStrike=count;strikeAt=frame.elapsed;}
  const settle=frame.phase==='outro'?smooth(frame.progress):0;
  const stance=frame.phase==='intro'?smooth(frame.progress):1-settle;
  const age=strikeAt<0?99:Math.max(0,frame.elapsed-strikeAt);
  const next=Math.min(2,lastStrike),until=releaseAt<0?99:planned[next]-(frame.elapsed-releaseAt);
  const anticipation=frame.phase==='release'&&lastStrike<3?smooth((.16-until)/.16):0;
  // The torso loads before the cut; impact is a brief compression, then a
  // controlled exhale rather than a permanent forward lunge.
  const impact=lastStrike?Math.sin(Math.min(1,age/.07)*Math.PI/2)*Math.exp(-Math.max(0,age-.07)*9):0;
  pelvis.position.y-=.065*stance+.025*impact*(1-settle);
  pelvis.position.x+=(lastStrike===2?-.028:.028)*impact*(1-settle);
  pelvis.position.z+=.022*impact*(1-settle);root.updateWorldMatrix(true,true);
  for(let side=0;side<2;side++){
   const target=cv(footStarts[side]),step=frame.phase==='intro'?smooth((frame.progress-(side===0?0:.28))/.65):1-settle;
   target.x+=(side===0?1:-1)*.105*step;target.z+=(side===0?-.10:.18)*step;
   if(frame.phase==='intro')target.y+=.035*Math.sin(Math.PI*step);
   plantLeg(legs[side],world(target));
  }
  let rw=v(-.30,1.37,.16),lw=v(.28,1.02,.23),rd=v(-.55,.68,.47),ld=v(.75,.05,.65);
  let yaw=-.28;
  const sweep=lastStrike?smooth((age+.09)/.20):0,recover=smooth((age-.17)/.24);
  if(frame.phase==='intro'){
   const ready=smooth((frame.progress-.18)/.72);rw.lerp(v(-.30,.96,.14),1-ready);rd.lerp(v(-.35,-.28,.88),1-ready);lw.lerp(v(.30,.94,.14),1-ready);ld.lerp(v(.4,-.25,.88),1-ready);yaw*=ready;
  } else if(frame.phase==='charge'){
   const breathe=Math.sin(Math.PI*smooth(frame.progress));rw.x-=.035*breathe;rw.y+=.055*breathe;lw.y+=.08*breathe;ld.y+=.10*breathe;
  } else if(lastStrike===0){
   rw.lerp(v(.16,1.03,.34),anticipation*.42525);rd.lerp(v(.75,-.32,.59),anticipation*.42525);yaw=THREE.MathUtils.lerp(-.28,-.0546175,anticipation);
  } else if(lastStrike===1){
   rw.lerp(v(.16,1.03,.34),sweep);rd.lerp(v(.75,-.32,.59),sweep);
   lw.lerp(v(.29,1.42,.14),smooth(age/.16));ld.lerp(v(.50,.75,.43),smooth(age/.16));
   lw.lerp(v(-.16,1.03,.35),anticipation*.42525);ld.lerp(v(-.8,-.3,.52),anticipation*.42525);
   yaw=THREE.MathUtils.lerp(-.08,.25,sweep)-.14*anticipation;
  } else if(lastStrike===2){
   rw.set(.16,1.03,.34).lerp(v(-.29,1.40,.18),recover);rd.set(.75,-.32,.59).lerp(v(-.65,.60,.46),recover);
   lw.set(.29,1.42,.14).lerp(v(-.16,1.03,.35),sweep);ld.set(.50,.75,.43).lerp(v(-.8,-.3,.52),sweep);
   lw.lerp(v(.29,1.39,.20),recover);ld.lerp(v(.65,.60,.46),recover);
   rw.lerp(v(.14,1.04,.36),anticipation*.42525);lw.lerp(v(-.14,1.04,.43),anticipation*.42525);
   rd.lerp(v(.72,-.27,.64),anticipation*.42525);ld.lerp(v(-.72,-.27,.64),anticipation*.42525);
   yaw=THREE.MathUtils.lerp(.11,-.28,sweep)+.12*anticipation;
  } else {
   rw.set(-.29,1.40,.18).lerp(v(.14,1.04,.36),sweep);lw.set(.29,1.39,.20).lerp(v(-.14,1.04,.43),sweep);
   rd.set(-.65,.60,.46).lerp(v(.72,-.27,.64),sweep);ld.set(.65,.60,.46).lerp(v(-.72,-.27,.64),sweep);yaw=THREE.MathUtils.lerp(-.16,.08,sweep);
  }
  // End with separated blades below the sightline; preserve the last cut until
  // the real outro starts, and restore the captured pose on reset/dispose.
  rw.lerp(v(-.30,.96,.18),settle);lw.lerp(v(.30,.94,.20),settle);
  rd.lerp(v(-.38,-.20,.90),settle);ld.lerp(v(.38,-.20,.90),settle);
  torso(yaw*(1-settle),(.045*stance+.025*impact)*(1-settle));
  arm(r,world(rw),-1);orient(r,socket,rd.normalize());arm(l,world(lw),1);orient(l,leftSocket,ld.normalize());root.updateWorldMatrix(true,true);
 },reset(){lastStrike=0;strikeAt=releaseAt=-1;for(const s of base){s.b.quaternion.copy(s.q);s.b.position.copy(s.p);}root.updateWorldMatrix(true,true);},dispose(){if(disposed)return;this.reset();disposed=true;}};
}

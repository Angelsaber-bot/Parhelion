import * as THREE from 'three';
import type { UltimatePerformance, UltimatePerformanceFrame } from '../../src/ultimatePerformance';
const smooth=(x:number)=>{x=THREE.MathUtils.clamp(x,0,1);return x*x*(3-2*x);};
/** Original presentation-only performances. The caller MUST pass a private clone.
 * Contact counters are notifications, never a damage/event source. */
export function createEraUltimatePerformance(identity:string,root:THREE.Object3D,clips:readonly THREE.AnimationClip[]=[]):UltimatePerformance {
 const mounted=identity==='napoleon'||identity==='napoleonMounted',mix=identity==='musashi';
 const get=(n:string)=>root.getObjectByName(n);
 const head=get(mix?'mixamorigHead':'Head'),leftFoot=get(mounted?'H_ForeHoof_L':mix?'mixamorigLeftToe_End':'FootL'),rightFoot=get(mounted?'H_ForeHoof_R':mix?'mixamorigRightToe_End':'FootR');
 const socket=get(identity==='blackbeard'?'Blackbeard_Muzzle':mounted?'SaberSocket':'Attachment_RightHand_Katana');
 const anchors={socket,head,leftFoot,rightFoot};
 const right=[get(mix?'mixamorigRightArm':'UpperArmR'),get(mix?'mixamorigRightForeArm':'ForearmR'),get(mix?'mixamorigRightHand':'HandR')];
 const left=[get(mix?'mixamorigLeftArm':'UpperArmL'),get(mix?'mixamorigLeftForeArm':'ForearmL'),get(mix?'mixamorigLeftHand':'HandL')];
 if(!['blackbeard','musashi','napoleon','napoleonMounted'].includes(identity)||!socket||!head||[...right,...left].some(x=>!x))return{anchors,update(){},reset(){},dispose(){}};
 const r=right as THREE.Object3D[],l=left as THREE.Object3D[];
 const spine=[get(mix?'mixamorigSpine':'Spine')!,get(mix?'mixamorigSpine2':'Chest')!,head];
 const riderSeat=mounted?[get('Root')!,get('Hips')!]:[];
 const pelvis=mix?get('mixamorigHips'):undefined;
 const legs=mix?['Left','Right'].map(side=>[get('mixamorig'+side+'UpLeg'),get('mixamorig'+side+'Leg'),get('mixamorig'+side+'Foot')]):[];
 root.updateWorldMatrix(true,true);
 const footStarts=legs.map(chain=>chain[2]?root.worldToLocal(chain[2].getWorldPosition(new THREE.Vector3())):new THREE.Vector3());
 const lowerBody=pelvis?[pelvis,...legs.flat().filter((bone):bone is THREE.Object3D=>!!bone)]:[];
 const base=[...r,...l,...spine,...riderSeat,...lowerBody].map(b=>({b,q:b.quaternion.clone(),p:b.position.clone()}));
 const vs=Array.from({length:100},()=>new THREE.Vector3()),qs=Array.from({length:80},()=>new THREE.Quaternion());let vi=0,qi=0;
 const v=(x=0,y=0,z=0)=>vs[vi++].set(x,y,z),q=()=>qs[qi++].identity(),cv=(x:THREE.Vector3)=>v().copy(x);
 const gaitClip=mounted?clips.find(c=>c.name==='MountedRun'):undefined;
 const gait=gaitClip?new THREE.AnimationMixer(root):undefined;
 if(gait&&gaitClip){const tracks=gaitClip.tracks.filter(t=>/^H_/.test(t.name));gait.clipAction(new THREE.AnimationClip('StageHorseGallop',gaitClip.duration,tracks)).play();}
 const leftSocket=get('Attachment_LeftHand_Katana');
 const matrix=new THREE.Matrix4();let lastStrike=0,strikeAt=-1,commandAt=-1,disposed=false;
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
  if(disposed||!Number.isFinite(frame.elapsed))return;vi=qi=0;
  if(gait)gait.setTime(frame.phase==='intro'?0:frame.elapsed*1.10);
  for(const s of base){s.b.quaternion.copy(s.q);s.b.position.copy(s.p);}root.updateWorldMatrix(true,true);
  const count=Math.max(0,frame.strikeCount??0);if(count>lastStrike&&frame.phase==='release'){lastStrike=count;strikeAt=frame.elapsed;if(commandAt<0)commandAt=frame.elapsed;}
  const age=strikeAt<0?99:Math.max(0,frame.elapsed-strikeAt),kick=age<.30?Math.sin(Math.min(1,age/.07)*Math.PI/2)*Math.exp(-Math.max(0,age-.07)*15):0;
  if(mix&&leftSocket){
   // A planted, asymmetric combat stance under the dual-blade sequence. The
   // private hips carry the weight while analytic leg chains retain ground contact.
   const stance=frame.phase==='intro'?smooth(frame.progress):frame.phase==='outro'?1-smooth(frame.progress):1;
   const settle=frame.phase==='outro'?smooth(frame.progress):0;
   const lunge=(strikeAt<0?0:smooth(age/.22))*(1-settle);
   if(pelvis&&legs.every(chain=>chain.every(Boolean))){
    pelvis.position.y-=.025*stance+.025*lunge;pelvis.position.z+=.045*lunge;root.updateWorldMatrix(true,true);
    for(let side=0;side<2;side++){const target=cv(footStarts[side]);target.x+=(side===0?1:-1)*.035*stance;target.z+=(side===0?-.06:.12)*stance+(side===0?0:.06)*lunge;plantLeg(legs[side] as THREE.Object3D[],world(target));}
   }
   const prep=frame.phase==='intro'?smooth(frame.progress):1;
   const sweep=strikeAt<0?0:smooth(age/.17),recover=smooth((age-.18)/.25);
   torso((lastStrike===1?THREE.MathUtils.lerp(-.28,.25,sweep):lastStrike===2?THREE.MathUtils.lerp(.25,-.28,sweep):lastStrike>=3?THREE.MathUtils.lerp(-.28,.08,sweep):-.28)*(1-settle),0);
   let rw=v(-.25,1.37,.16),lw=v(.28,1.02,.23),rd=v(-.55,.68,.47),ld=v(.75,.05,.65);
   if(frame.phase==='charge'){const flourish=Math.sin(Math.PI*smooth(frame.progress));rw.x-=.065*flourish;rw.y+=.10*flourish;lw.y+=.16*flourish;lw.z+=.045*flourish;rd.x-=.12*flourish;ld.y+=.22*flourish;}
   if(lastStrike===1){rw.lerp(v(.16,1.03,.31),sweep);rd.lerp(v(.75,-.32,.59),sweep);lw.lerp(v(.25,1.42,.13),sweep);ld.lerp(v(.50,.75,.43),sweep);}
   else if(lastStrike===2){rw.set(.16,1.03,.31).lerp(v(-.26,1.38,.18),recover);rd.set(.75,-.32,.59).lerp(v(-.65,.6,.46),recover);lw.set(.25,1.42,.13).lerp(v(-.16,1.03,.32),sweep);ld.set(.50,.75,.43).lerp(v(-.8,-.3,.52),sweep);lw.lerp(v(.27,1.38,.16),recover);ld.lerp(v(.65,.6,.46),recover);}
   else if(lastStrike>=3){rw.set(-.26,1.38,.18).lerp(v(.12,1.05,.33),sweep);lw.set(.27,1.38,.16).lerp(v(-.12,1.05,.39),sweep);rd.set(-.65,.6,.46).lerp(v(.72,-.27,.64),sweep);ld.set(.65,.6,.46).lerp(v(-.72,-.27,.64),sweep);}
   if(frame.phase==='intro'){rw.lerp(v(-.29,1.05,.20),1-prep);rd.lerp(v(-.7,.15,.7),1-prep);}
   // The finishing cross releases into an open low guard, not a frozen end pose.
   // Only the private stage actor recovers; contact counters and source clips are untouched.
   rw.lerp(v(-.29,1.04,.20),settle);lw.lerp(v(.29,1.02,.21),settle);
   rd.lerp(v(-.7,.10,.7),settle);ld.lerp(v(.7,.10,.7),settle);
   arm(r,world(rw),-1);orient(r,socket,rd.normalize());arm(l,world(lw),1);orient(l,leftSocket,ld.normalize());
   root.updateWorldMatrix(true,true);return;
  }
  if(mounted){
   // The rider absorbs the gallop through the seat rather than freezing over a
   // moving horse. Reins and saber are solved after this body motion.
   if(riderSeat[0]&&frame.phase!=='intro'){
    const suspension=frame.reduced?.3:1;
    riderSeat[0].position.y+=Math.sin(frame.elapsed*2*Math.PI/.8)*.014*suspension;
    riderSeat[0].position.z+=Math.sin(frame.elapsed*2*Math.PI/.8+1.1)*.009*suspension;
    root.updateWorldMatrix(true,true);
   }
   const t=frame.phase==='intro'?smooth(frame.progress):1,sweep=strikeAt<0?0:smooth(age/.18),settle=frame.phase==='outro'?smooth(frame.progress):0;
   torso(THREE.MathUtils.lerp(-.1,.18,sweep)*(1-settle),.16*t-.055*settle);
   // Rider keeps the left rein, right sword leads the charge then makes one clear cut.
   const rw=v(-.40,2.21,.35).lerp(v(-.48,2.40,.33),t).lerp(v(-.58,2.10,.40),sweep).lerp(v(-.48,2.24,.35),settle);
   arm(r,world(rw),-1);
   const tip=get('SaberTip')!;const blade=cv(tip.position).sub(socket.position).normalize();
   const desired=axis(v(-.15,.72,.68).lerp(v(-.90,-.35,-.20),sweep).lerp(v(-.35,.75,.55),settle).normalize());
   const current=cv(blade).applyQuaternion(r[2].getWorldQuaternion(q())).normalize();setWorld(r[2],q().setFromUnitVectors(current,desired).multiply(r[2].getWorldQuaternion(q())));
   const rein=get('H_ReinGrip');if(rein)arm(l,rein.getWorldPosition(v()),1);
   root.updateWorldMatrix(true,true);return;
  }
  torso(-.12, -.10*kick);
  const charge=frame.phase==='charge',intro=frame.phase==='intro',t=smooth(frame.progress),lower=intro?0:charge?smooth((t-.58)/.42):1;
  const wrist=v(-.38,1.60,.19).lerp(v(-.43,1.46,.37),lower);wrist.z-=kick*.10;wrist.y+=kick*.075;
  arm(r,world(wrist),-1);orient(r,socket,v(.08,.96,.27).lerp(v(-.08,.08+kick*.28,1),lower).normalize());
  // Free hand gives the broadside command, deliberately separate from the gun arm.
  const gesture=intro?smooth(frame.elapsed/.65):charge?1:1-smooth(Math.max(0,frame.progress-.65)/.35)*.65;
  const command=commandAt>=0?smooth((frame.elapsed-commandAt)/.20):0;
  arm(l,world(v(.38,1.03,.15).lerp(v(.47,1.66,.22),gesture).lerp(v(.62,1.25,.37),command)),1);
  root.updateWorldMatrix(true,true);
 },reset(){lastStrike=0;strikeAt=-1;commandAt=-1;},dispose(){disposed=true;gait?.stopAllAction();gait?.uncacheRoot(root);}};
}

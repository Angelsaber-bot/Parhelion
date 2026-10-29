/** Actual imported hand/forearm basis; no Euler/local-axis assumptions. */
import * as THREE from 'three';
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { playerFixture } from '../player-fixture.ts';
import { ShoulderAim } from '../../src/aim.ts';
import { SkinnedCharacterAnimator, type PlayerAnimationState } from '../../src/skinnedCharacter.ts';
const v=()=>new THREE.Vector3(),q=()=>new THREE.Quaternion();
const base={speed:0,onGround:true,swimming:false,vy:0,moveYaw:0};
const Animator=process.argv[3]?(await import(pathToFileURL(resolve(process.argv[3])).href)).SkinnedCharacterAnimator:SkinnedCharacterAnimator;
const f=await playerFixture(),rig=f.rig,a=new Animator(rig);
const axes=Object.fromEntries((['R','L']as const).map(side=>{
 const lower=rig.joints[`Forearm_${side}`] as THREE.Bone,hand=rig.joints[`Hand_${side}`] as THREE.Bone;
 const lr=rig.rest.get(lower)!,hr=rig.rest.get(hand)!;
 const longitudinal=hr.rootP.clone().sub(lr.rootP).normalize(),handAxis=rig.rest.get(rig.bones[`J_Bip_${side}_Middle1`])!.rootP.clone().sub(hr.rootP).normalize();
 const dorsal=new THREE.Vector3(0,1,0).addScaledVector(handAxis,-handAxis.y).normalize();
 return[side,{longitudinal:longitudinal.applyQuaternion(lr.rootQ.clone().invert()),dorsal:dorsal.applyQuaternion(lr.rootQ.clone().invert())}];
}));
function sample(side:'R'|'L'){
 const elbow=rig.joints[`Forearm_${side}`].getWorldPosition(v()),wrist=rig.joints[`Hand_${side}`].getWorldPosition(v());
 const longitudinal=wrist.clone().sub(elbow).normalize(),palmQ=rig.handSockets[side].getWorldQuaternion(q());
 const handAxis=new THREE.Vector3(1,0,0).applyQuaternion(palmQ),handDorsal=new THREE.Vector3(0,1,0).applyQuaternion(palmQ);
 const foreDorsal=axes[side].dorsal.clone().applyQuaternion(rig.joints[`Forearm_${side}`].getWorldQuaternion(q()));
 const projected=(d:THREE.Vector3)=>d.clone().addScaledVector(longitudinal,-d.dot(longitudinal)).normalize();
 const d1=projected(foreDorsal),d2=projected(handDorsal);
 return {bendDeg:THREE.MathUtils.radToDeg(longitudinal.angleTo(handAxis)),rollDeg:THREE.MathUtils.radToDeg(Math.atan2(longitudinal.dot(d1.clone().cross(d2)),d1.dot(d2))),palmQ:palmQ.toArray(),wrist:wrist.toArray(),handAxis:handAxis.toArray(),forearmAxis:longitudinal.toArray(),gripError:rig.handSockets[side].getWorldPosition(v()).distanceTo(rig.joints.Gun.localToWorld(rig.gunAnchors[side==='R'?'grip':'support'].clone()))};
}
const result:any={scope:'Actual production rig, metacarpal +X/palm dorsal +Y socket basis versus imported forearm anatomical axes. Node bone samples; not browser evidence.',bones:Object.keys(rig.bones).filter(n=>/Arm|Hand|Twist/.test(n)),axes:Object.fromEntries(Object.entries(axes).map(([s,r])=>[s,{longitudinal:r.longitudinal.toArray(),dorsal:r.dorsal.toArray()}])),states:{}};
for(const [name,state]of Object.entries<PlayerAnimationState>({idle:{...base,armed:false},walk:{...base,armed:false,speed:5.5},run:{...base,armed:false,speed:9},carry:{...base,speed:5.5},ready:base,ads:{...base,aim:1}})){
 a.reset(state.armed!==false);for(let i=0;i<240;i++)a.update(1/120,state);
 const rows:any[]=[];for(let i=0;i<240;i++){a.update(1/120,state);rows.push({t:i/120,R:sample('R'),L:sample('L')});}
 result.states[name]={samples:rows,summary:Object.fromEntries((['R','L']as const).map(s=>[s,{bend:[Math.min(...rows.map(r=>r[s].bendDeg)),Math.max(...rows.map(r=>r[s].bendDeg))],roll:[Math.min(...rows.map(r=>r[s].rollDeg)),Math.max(...rows.map(r=>r[s].rollDeg))],maxStepDeg:Math.max(...rows.slice(1).map((r,i)=>THREE.MathUtils.radToDeg(q().fromArray(r[s].palmQ).angleTo(q().fromArray(rows[i][s].palmQ))))),maxGripError:Math.max(...rows.map(r=>r[s].gripError))}]))};
}
result.transitions=[];
for(const ordinary of [false,true])for(const hz of [30,60,120]) {
 const shoulderAim=new ShoulderAim();
 a.reset(true);for(let i=0;i<hz*2;i++)a.update(1/hz,{...base,speed:5.5});
 const names=['Arm_R','Forearm_R','Hand_R','Arm_L','Forearm_L','Hand_L'];
 let previous=names.map(n=>rig.joints[n].quaternion.clone()),maxStepDeg=0,maxAngularSpeed=0,maxGripError=0,maxRollDeg=0,worst:any;
 for(let i=0;i<hz*10;i++) {
  const time=i/hz;shoulderAim.held=!!(Math.floor(time/.35)%2);const aim=ordinary?shoulderAim.step(1/hz,true):Number(shoulderAim.held);
  const state={...base,speed:ordinary?5.5:Math.floor(time/1.4)%2?9:5.5,aim,pitch:Math.sin(time*1.1)*(ordinary?.5:1.45),moveYaw:Math.atan2(Math.sin(time*2),Math.cos(time*2))};
  a.update(1/hz,state);
  names.forEach((name,j)=>{const rotation=rig.joints[name].quaternion,step=THREE.MathUtils.radToDeg(rotation.angleTo(previous[j]));if(step>maxStepDeg){maxStepDeg=step;worst={time,name,state};}maxAngularSpeed=Math.max(maxAngularSpeed,step*hz);previous[j]=rotation.clone();});
  maxGripError=Math.max(maxGripError,sample('R').gripError);maxRollDeg=Math.max(maxRollDeg,Math.abs(sample('R').rollDeg),Math.abs(sample('L').rollDeg));
 }
 result.transitions.push({hz,ordinaryProductionAim:ordinary,duration:10,description:ordinary?'Production ShoulderAim, speed 5.5, ±0.5 pitch, repeated 350ms ADS interruptions and wrapped heading':'Raw 0/1 target stress bypasses production ShoulderAim: 5.5/9 speed, ±1.45 pitch, 350ms toggles and wrapped heading; zero-time shots excluded',maxStepDeg,maxAngularSpeed,maxGripError,maxRollDeg,worst});
}
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(result,null,2));console.log(JSON.stringify({bones:result.bones,axes:result.axes,states:Object.fromEntries(Object.entries(result.states).map(([s,r]:any)=>[s,r.summary])),transitions:result.transitions},null,2));f.dispose();

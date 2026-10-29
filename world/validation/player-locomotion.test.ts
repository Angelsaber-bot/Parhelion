import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { playerFixture } from './player-fixture.ts';
import { SkinnedCharacterAnimator } from '../src/skinnedCharacter.ts';
import { advancePlayerStride, playerStride, samplePlayerFoot } from '../src/playerLocomotion.ts';

const base = { speed:0,onGround:true,swimming:false,vy:0,moveYaw:0,armed:false };
const corr=(xs:number[],ys:number[])=>{const x=xs.reduce((a,b)=>a+b)/xs.length,y=ys.reduce((a,b)=>a+b)/ys.length;return xs.reduce((n,v,i)=>n+(v-x)*(ys[i]-y),0)/Math.sqrt(xs.reduce((n,v)=>n+(v-x)**2,0)*ys.reduce((n,v)=>n+(v-y)**2,0));};

test('visual stride integration is rate-independent through starts/stops and does not run an idle treadmill',()=>{
 const samples=[30,60,120].map(hz=>{let speed=0,phase=0;for(const target of [5.5,9,0,2,0])for(let i=0;i<hz;i++){const s=advancePlayerStride(speed,target,1/hz);speed=s.speed;phase+=s.phase;}return{speed,phase};});
 for(const s of samples){assert.ok(Math.abs(s.phase-samples[0].phase)<1e-10);assert.ok(Math.abs(s.speed-samples[0].speed)<1e-10);}
 assert.deepEqual(advancePlayerStride(0,0,.1),{speed:0,phase:0});
 for(const speed of [2,5.5,9]){
  const {cadence,stance}=playerStride(speed),phase=stance*Math.PI,epsilon=1e-6;
  const a=samplePlayerFoot(phase-epsilon,speed),b=samplePlayerFoot(phase+epsilon,speed);
  assert.ok(Math.abs((b.z-a.z)/(2*epsilon)*cadence*Math.PI*2+speed)<1e-7);
  for(const boundary of [0,stance*Math.PI*2,Math.PI*2]){
   const l=samplePlayerFoot(boundary-epsilon,speed),r=samplePlayerFoot(boundary+epsilon,speed);
   assert.ok(Math.abs(l.z-r.z)<.00002);assert.ok(Math.abs(l.y-r.y)<1e-9);
  }
 }
});

test('actual free arms counter-swing their own leg, keep elbow flex and articulate wrists in walk/run',async()=>{
 for(const armed of [false,true])for(const speed of [5.5,9]){
  const f=await playerFixture(),a=new SkinnedCharacterAnimator(f.rig);a.reset(armed);
  for(let i=0;i<120;i++)a.update(1/60,{...base,speed,armed});
  for(const side of (armed?['L']:['L','R'])){
   const hands:number[]=[],feet:number[]=[],palms:THREE.Quaternion[]=[];
   let minFlex=Infinity,maxFlex=0;
   for(let i=0;i<120;i++){
    a.update(1/60,{...base,speed,armed});
    const shoulder=f.rig.joints[`Arm_${side}`].getWorldPosition(new THREE.Vector3()),elbow=f.rig.joints[`Forearm_${side}`].getWorldPosition(new THREE.Vector3()),hand=f.rig.joints[`Hand_${side}`].getWorldPosition(new THREE.Vector3());
    const flex=Math.PI-shoulder.sub(elbow).angleTo(hand.sub(elbow));minFlex=Math.min(minFlex,flex);maxFlex=Math.max(maxFlex,flex);
    hands.push(f.rig.handSockets[side as 'L'|'R'].getWorldPosition(new THREE.Vector3()).z);feet.push(f.rig.joints[`Foot_${side}`].getWorldPosition(new THREE.Vector3()).z);
    palms.push(f.rig.handSockets[side as 'L'|'R'].getWorldQuaternion(new THREE.Quaternion()));
   }
   assert.ok(corr(hands,feet)<-.90,'same-side marching must not return');
   assert.ok(minFlex>.35&&maxFlex<1.2,'relaxed elbows must not lock or overfold');
   assert.ok(Math.max(...palms.map(p=>p.angleTo(palms[0])))>.18,'wrist must not be world-locked through the swing');
  }f.dispose();
 }
});

test('real feet have stationary level contact intervals in straight planar travel and actual shoe vertices clear the ground',async t=>{
 for(const hz of [30,60,120])for(const speed of [2,5.5,9]){
  const f=await playerFixture(),a=new SkinnedCharacterAnimator(f.rig);a.reset(false);
  for(let i=0;i<hz*2;i++){f.rig.root.position.z+=speed/hz;a.update(1/hz,{...base,speed});}
  let previous=['L','R'].map(s=>f.rig.joints[`Foot_${s}`].getWorldPosition(new THREE.Vector3()));
  let contacts=0,maxSlide=0,minSole=Infinity;
  const shoe=f.rig.meshes.find(m=>m.name==='BodyBatch_05_soft_dark_shoe_leather')!;
  for(let i=0;i<hz*4;i++){
   f.rig.root.position.z+=speed/hz;a.update(1/hz,{...base,speed});
   for(const [j,side]of ['L','R'].entries()){
    const bone=f.rig.joints[`Foot_${side}`] as THREE.Bone,p=bone.getWorldPosition(new THREE.Vector3()),restY=f.rig.rest.get(bone)!.rootP.y;
    assert.ok(p.y>=restY-1e-5,'ankle must not sink below its bind support plane');
    if(Math.abs(p.y-restY)<1e-8&&Math.abs(previous[j].y-restY)<1e-8){contacts++;maxSlide=Math.max(maxSlide,p.distanceTo(previous[j])*hz);}previous[j]=p;
   }
   if(i%Math.max(1,Math.round(hz/12))===0)for(let v=0;v<shoe.geometry.attributes.position.count;v++)minSole=Math.min(minSole,shoe.getVertexPosition(v,new THREE.Vector3()).applyMatrix4(shoe.matrixWorld).y);
  }
  t.diagnostic(JSON.stringify({hz,speed,contacts,maxContactSpeed:maxSlide,minSole}));
  assert.ok(contacts>=10,'short sprint stance still has sampled planted intervals');assert.ok(maxSlide<.002,'planted intervals cannot skid over a flat translated root');assert.ok(minSole>=-.001,'actual skinned soles cannot pierce the local plane');f.dispose();
 }
});


test('actual walk stays upright with bounded stance and swing knee flexion',async()=>{
 const f=await playerFixture(),a=new SkinnedCharacterAnimator(f.rig);a.reset(false);
 let hipMin=Infinity,stanceMax=0,kneeMax=0;
 for(let i=0;i<300;i++){
  a.update(1/60,{...base,speed:5.5});if(i<120)continue;
  hipMin=Math.min(hipMin,f.rig.joints.Hips.getWorldPosition(new THREE.Vector3()).y);
  for(const side of ['L','R']){
   const hip=f.rig.joints[`Thigh_${side}`].getWorldPosition(new THREE.Vector3()),knee=f.rig.joints[`Shin_${side}`].getWorldPosition(new THREE.Vector3()),foot=f.rig.joints[`Foot_${side}`].getWorldPosition(new THREE.Vector3());
   const angle=(Math.PI-hip.sub(knee).angleTo(foot.clone().sub(knee)))*180/Math.PI;
   kneeMax=Math.max(kneeMax,angle);
   if(Math.abs(foot.y-f.rig.rest.get(f.rig.joints[`Foot_${side}`])!.rootP.y)<1e-8)stanceMax=Math.max(stanceMax,angle);
  }
 }
 assert.ok(hipMin>.95,'do not restore the rejected low pelvis');
 assert.ok(stanceMax<38,'support leg must not crouch deeply');
 assert.ok(kneeMax<70,'walk swing must not restore the rejected 86 degree fold');f.dispose();
});

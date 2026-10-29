/** Signed anatomical hinge checks; unsigned joint angles cannot detect reversed elbows. */
import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { playerFixture } from './player-fixture.ts';
import { SkinnedCharacterAnimator, solvePlayerArm } from '../src/skinnedCharacter.ts';
const v=()=>new THREE.Vector3(),q=()=>new THREE.Quaternion();
const base={onGround:true,swimming:false,vy:0,moveYaw:0};

test('both mirrored elbows flex toward the authored biceps side, not through the back of the elbow',async t=>{
 const f=await playerFixture(),a=new SkinnedCharacterAnimator(f.rig);
 let minSigned=1,maxGrip=0,count=0;
 for(const armed of [false,true])for(const speed of [0,5.5,9])for(const aim of (armed?[0,1]:[0]))for(const pitch of (aim?[-1.4,0,1.4]:[0])){
  a.reset(armed,.7);const state={...base,moveYaw:.7,armed,speed,aim,pitch};
  for(let i=0;i<240;i++)a.update(1/120,state);
  for(let i=0;i<120;i++){
   a.update(1/120,state);
   for(const side of ['R','L']as const){
    const u=f.rig.joints[`Arm_${side}`]as THREE.Bone,e=f.rig.joints[`Forearm_${side}`],w=f.rig.joints[`Hand_${side}`];
    const proximal=e.getWorldPosition(v()).sub(u.getWorldPosition(v())).normalize();
    const distal=w.getWorldPosition(v()).sub(e.getWorldPosition(v())).normalize();
    const actualFlex=distal.addScaledVector(proximal,-distal.dot(proximal)).normalize();
    // +Z is the asset's anterior upper-arm surface in its recorded root-space bind
    // pose; left/right share anterior, unlike an unsigned mirrored local Euler X.
    const authoredFlex=new THREE.Vector3(0,0,1).applyQuaternion(f.rig.rest.get(u)!.rootQ.clone().invert()).applyQuaternion(u.getWorldQuaternion(q()));
    authoredFlex.addScaledVector(proximal,-authoredFlex.dot(proximal)).normalize();
    const signed=authoredFlex.dot(actualFlex);minSigned=Math.min(minSigned,signed);count++;
    assert.ok(signed>.999,`${side} flexes through posterior elbow: ${JSON.stringify({armed,speed,aim,pitch,signed})}`);
   }
   if(armed)maxGrip=Math.max(maxGrip,f.rig.handSockets.R.getWorldPosition(v()).distanceTo(f.rig.joints.Gun.localToWorld(f.rig.gunAnchors.grip.clone())));
  }
 }
 assert.ok(maxGrip<.002);t.diagnostic(JSON.stringify({count,minSigned,maxGrip}));f.dispose();
});

test('free-arm elbow points posterior while forearm bends forward throughout idle/walk/run',async t=>{
 const f=await playerFixture(),a=new SkinnedCharacterAnimator(f.rig);let leastPosterior=Infinity,count=0;
 for(const armed of [false,true])for(const speed of [0,2,5.5,9]){
  if(armed&&speed===0)continue;
  a.reset(armed,1.1);const state={...base,moveYaw:1.1,armed,speed};for(let i=0;i<240;i++)a.update(1/120,state);
  for(let i=0;i<240;i++){
   a.update(1/120,state);
   for(const side of (armed?['L']:['R','L'])as ('R'|'L')[]){
    const S=f.rig.joints[`Arm_${side}`].getWorldPosition(v()),E=f.rig.joints[`Forearm_${side}`].getWorldPosition(v()),W=f.rig.joints[`Hand_${side}`].getWorldPosition(v());
    const reach=W.sub(S).normalize(),pole=E.sub(S);pole.addScaledVector(reach,-pole.dot(reach)).normalize();
    const back=new THREE.Vector3(0,0,-1).applyQuaternion(f.rig.root.getWorldQuaternion(q()));back.addScaledVector(reach,-back.dot(reach)).normalize();
    const signed=pole.dot(back);leastPosterior=Math.min(leastPosterior,signed);count++;
    assert.ok(signed>.9,`${side} elbow points in front of shoulder/wrist line: ${signed}`);
   }
  }
 }
 t.diagnostic(JSON.stringify({count,leastPosterior}));f.dispose();
});


test('reach clamp keeps the signed bend plane finite near full extension on both arms',async()=>{
 const f=await playerFixture();
 for(const side of ['R','L']as const)for(const distance of [.00001,.05,.47,1,10]){
  const shoulder=f.rig.joints[`Arm_${side}`].getWorldPosition(v());
  const target=shoulder.clone().add(new THREE.Vector3(side==='R'?-.2:.2,-1,.1).normalize().multiplyScalar(distance));
  solvePlayerArm(f.rig,side,target,f.rig.handSockets[side].getWorldQuaternion(q()),1,1,0);
  for(const name of [`Arm_${side}`,`Forearm_${side}`,`Hand_${side}`])assert.ok(f.rig.joints[name].quaternion.toArray().every(Number.isFinite));
  const upper=f.rig.joints[`Arm_${side}`]as THREE.Bone,elbow=f.rig.joints[`Forearm_${side}`],hand=f.rig.joints[`Hand_${side}`];
  const u=elbow.getWorldPosition(v()).sub(upper.getWorldPosition(v())).normalize(),d=hand.getWorldPosition(v()).sub(elbow.getWorldPosition(v())).normalize();
  const bend=d.clone().addScaledVector(u,-d.dot(u));assert.ok(bend.length()>.001,'reach clamp must retain nonzero hinge plane');
  const flex=new THREE.Vector3(0,0,1).applyQuaternion(f.rig.rest.get(upper)!.rootQ.clone().invert()).applyQuaternion(upper.getWorldQuaternion(q()));
  flex.addScaledVector(u,-flex.dot(u)).normalize();assert.ok(flex.dot(bend.normalize())>.999);
 }f.dispose();
});

/** Independent production ADS comparison against frozen pre-change source. Native rigs; no GPU claim. */
import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';import{playerFixture}from'../player-fixture';import{SkinnedCharacterAnimator as Baseline}from'../fixtures/player-pre-ads-pole';import{SkinnedCharacterAnimator as Candidate}from'../../src/skinnedCharacter';
test('adaptive ADS pole preserves gun and non-right-arm motion through aim/fire/pitch boundaries',async t=>{
 const a=await playerFixture(),b=await playerFixture();
 try{for(const hz of[30,60,120]){
  const old=new Baseline(a.rig),candidate=new Candidate(b.rig);let changed=0,maxOther=0,maxGun=0,maxMuzzle=0,maxPalm=0,excludedExact=0;
  for(let i=0;i<hz*6;i++){
   const time=i/hz,aim=time>=1&&time<4?Math.min(1,(time-1)*2):0,pitch=time<2?-.75:time<3?-.75+(time-2)*1.5:time<4?.75-(time-3)*1.5:0;
   const state={speed:time<5?0:4,onGround:time<4.5,swimming:false,vy:time<4.5?0:-2,moveYaw:0,armed:true,aim,pitch,firing:i%Math.round(hz/5)===0};old.update(1/hz,state);candidate.update(1/hz,state);
   for(const [name,joint]of Object.entries(a.rig.joints)){const other=b.rig.joints[name as keyof typeof b.rig.joints];if(!other)continue;const diff=(joint as THREE.Object3D).quaternion.angleTo(other.quaternion);if(/^(Arm|Forearm|Hand)_R$/.test(name)){if(diff>.001)changed++;}else{const x=[...(joint as THREE.Object3D).position.toArray(),...(joint as THREE.Object3D).quaternion.toArray(),...(joint as THREE.Object3D).scale.toArray()],y=[...other.position.toArray(),...other.quaternion.toArray(),...other.scale.toArray()];for(let j=0;j<x.length;j++)maxOther=Math.max(maxOther,Math.abs(x[j]-y[j]));}}
   a.rig.root.updateMatrixWorld(true);b.rig.root.updateMatrixWorld(true);for(let j=0;j<16;j++)maxGun=Math.max(maxGun,Math.abs(a.rig.joints.Gun.matrixWorld.elements[j]-b.rig.joints.Gun.matrixWorld.elements[j]));
   maxMuzzle=Math.max(maxMuzzle,a.rifle.muzzleWorld(new THREE.Vector3()).distanceTo(b.rifle.muzzleWorld(new THREE.Vector3())));
   for(const side of['L','R']as const){const x=a.rig.handSockets[side].getWorldPosition(new THREE.Vector3()),y=b.rig.handSockets[side].getWorldPosition(new THREE.Vector3());maxPalm=Math.max(maxPalm,x.distanceTo(y));}
   // Before any ADS, firing alone must not activate the corrective elbow pole.
   if(time<1||pitch<=-.5){for(const name of['Arm_R','Forearm_R','Hand_R']){const x=a.rig.joints[name as keyof typeof a.rig.joints],y=b.rig.joints[name as keyof typeof b.rig.joints];assert.deepEqual(x.quaternion.toArray(),y.quaternion.toArray());}excludedExact++;}
  }
  assert.ok(changed>0,'positive candidate actually changes right arm');assert.equal(maxOther,0,'other joints stay exactly unchanged');assert.equal(maxGun,0,'gun world transform exact');assert.equal(maxMuzzle,0,'physical muzzle unchanged');assert.ok(maxPalm<1e-12,'palm contacts preserved');t.diagnostic(JSON.stringify({hz,changed,maxOther,maxGun,maxMuzzle,maxPalm,excludedExact}));
 }}finally{a.dispose();b.dispose();}
});

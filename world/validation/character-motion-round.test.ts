/** Independent round QA: actual production rig, not a synthetic pose math substitute. */
import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { playerFixture } from './player-fixture.ts';
import { SkinnedCharacterAnimator, type PlayerAnimationState } from '../src/skinnedCharacter.ts';
const base:PlayerAnimationState={speed:0,onGround:true,swimming:false,vy:0,moveYaw:0};
const angle=(a:number,b:number)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));

test('round QA: grounded turning is rate-invariant and follows the short arc across ±π',async()=>{
 const yaws:number[]=[];
 for(const hz of [30,60,120]){
  const f=await playerFixture(),a=new SkinnedCharacterAnimator(f.rig);
  a.reset(false,Math.PI-.02);
  for(let i=0;i<hz/5;i++)a.update(1/hz,{...base,armed:false,moveYaw:-Math.PI+.02});
  assert.ok(angle(a.facing,Math.PI)<.021,'never rotates the long way through zero');yaws.push(a.facing);
  const residual=angle(a.facing,-Math.PI+.02);assert.ok(residual>0&&residual<.01,'smoothly approaches instead of snapping');f.dispose();
 }
 assert.ok(Math.max(...yaws)-Math.min(...yaws)<1e-10,`equal elapsed 0.2s must not depend on render rate: ${yaws}`);
});

test('round QA: normal gait stays finite across start/stop, turnaround, airborne and interrupted ADS at 30/60/120 Hz',async()=>{
 for(const hz of [30,60,120]){
  const f=await playerFixture(),a=new SkinnedCharacterAnimator(f.rig);a.reset(false);
  const snapshots=f.rig.meshes.map(m=>[m.geometry.attributes.position.version,m.geometry.attributes.normal.version]);
  const states:PlayerAnimationState[]=[
   {...base,armed:false,speed:5.5}, {...base,armed:false,speed:9,moveYaw:Math.PI}, {...base,armed:false},
   {...base,speed:5.5,aim:.5,pitch:-1.4}, {...base,speed:9,aim:1,pitch:1.4},
   {...base,speed:8,onGround:false,vy:3}, {...base,speed:8,onGround:false,vy:0},
   {...base,speed:8,onGround:false,vy:-3,gliding:true}, {...base,armed:false,swimming:true,onGround:false,speed:3}, base,
  ];
  for(const state of states)for(let i=0;i<Math.round(hz*.25);i++){
   a.update(1/hz,state);
   for(const [name,bone]of Object.entries(f.rig.bones)){
    assert.ok(bone.matrixWorld.elements.every(Number.isFinite),`${name} invalid at ${hz}Hz`);
    assert.ok(Math.abs(bone.quaternion.length()-1)<1e-5,`${name} non-unit quaternion`);
   }
  }
  f.rig.meshes.forEach((m,i)=>assert.deepEqual([m.geometry.attributes.position.version,m.geometry.attributes.normal.version],snapshots[i],'animation cannot edit protected vertex buffers'));
  f.dispose();
 }
});

test('round QA: zero-time input shots preserve exact barrel/palms through moving and gliding carry',async()=>{
 const f=await playerFixture(),a=new SkinnedCharacterAnimator(f.rig);
 for(const state of [{...base,speed:9},{...base,onGround:false,gliding:true,speed:8,vy:-2}]){
  for(let i=0;i<180;i++)a.update(1/60,state);
  for(const yaw of [-Math.PI,-1.3,1.7])for(const pitch of [-1.45,0,1.45]){
   const look=new THREE.Vector3(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch));a.prepareShot(look);
   const barrel=new THREE.Vector3(0,0,-1).applyQuaternion(f.rig.joints.Gun.getWorldQuaternion(new THREE.Quaternion()));
   assert.ok(barrel.distanceTo(look)<1e-6);
   for(const side of ['R','L']as const){const anchor=f.rig.gunAnchors[side==='R'?'grip':'support'];assert.ok(f.rig.handSockets[side].getWorldPosition(new THREE.Vector3()).distanceTo(f.rig.joints.Gun.localToWorld(anchor.clone()))<.002);}
  }
 }
 a.reset(false,.7);a.prepareShot(new THREE.Vector3(1,0,0));assert.equal(a.facing,.7);assert.equal(f.rig.joints.Gun.visible,false);f.dispose();
});

test('round QA: non-finite presentation values and invalid delta cannot poison the skeleton',async()=>{
 const f=await playerFixture(),a=new SkinnedCharacterAnimator(f.rig);
 for(const dt of [0,-1,NaN,Infinity,1/60])for(const value of [NaN,Infinity,-Infinity]){
  a.update(dt,{...base,speed:value,aim:value,pitch:value,vy:value,moveYaw:value,lookYaw:value});
  assert.ok(Number.isFinite(a.facing));for(const bone of Object.values(f.rig.bones))assert.ok(bone.matrixWorld.elements.every(Number.isFinite));
 }
 f.dispose();
});

test('round QA: equal-duration grounded start/stride/turn/stop/aim poses agree at 30/60/120 Hz',async()=>{
 const names=['Hips','Foot_L','Foot_R','Hand_L','Hand_R'];const runs:THREE.Vector3[][]=[];
 for(const hz of [30,60,120]){
  const f=await playerFixture(),a=new SkinnedCharacterAnimator(f.rig),samples:THREE.Vector3[]=[];
  for(const [duration,state]of [[.1,{...base,speed:5.5}],[.9,{...base,speed:5.5}],[.2,{...base,speed:5.5,moveYaw:Math.PI/2}],[.2,{...base,moveYaw:Math.PI/2}],[.6,{...base,aim:1,pitch:.3,moveYaw:Math.PI/2}]]as const){
   for(let i=0;i<Math.round(hz*duration);i++)a.update(1/hz,state);
   samples.push(...names.map(name=>f.rig.joints[name].getWorldPosition(new THREE.Vector3())));
  }
  runs.push(samples);f.dispose();
 }
 for(const samples of runs.slice(1))for(let i=0;i<samples.length;i++)assert.ok(samples[i].distanceTo(runs[0][i])<1e-8,`frame-rate changed actual sampled joint ${i}: ${samples[i].distanceTo(runs[0][i])}m`);
});

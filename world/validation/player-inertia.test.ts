import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PlayerInertia } from '../src/playerInertia.ts';
import { playerFixture } from './player-fixture.ts';
import { SkinnedCharacterAnimator } from '../src/skinnedCharacter.ts';
const ground = { onGround: true, swimming: false, vy: 0, speed: 0, turnRate: 0, lockedUpperBody: false };
test('landing absorption is finite, no-bounce and rate-independent at the same contact ages', () => {
 const samples = [30,60,120].map(hz => {
  const acting = new PlayerInertia();
  for(let i=0;i<hz;i++)acting.update(1/hz,{...ground,onGround:false,vy:-10});
  const values:number[]=[];
  for(let i=0;i<hz;i++){const frame=acting.update(1/hz,ground);assert.ok(frame.compression>=0&&frame.compression<.06);if((i+1)%(hz/10)===0)values.push(frame.compression);}
  return values;
 });
 for(const values of samples)for(let i=0;i<values.length;i++)assert.ok(Math.abs(values[i]-samples[0][i])<1e-12);
 assert.ok(samples[0][0]>.04);assert.ok(samples[0].at(-1)!<1e-5);
});
test('spawn, zero-time muzzle queries, swimming and controlled flight do not invent a landing',()=>{
 const acting=new PlayerInertia();assert.equal(acting.update(.1,ground).compression,0);
 acting.update(.1,{...ground,onGround:false,vy:-12});
 assert.equal(acting.update(0,ground).compression,0);
 assert.ok(acting.update(.05,ground).compression>.04);
 acting.reset();assert.equal(acting.update(.1,ground).compression,0);
 for(const mode of ['swimming','gliding','flying']){
  acting.reset();acting.update(.1,{...ground,onGround:false,vy:-12,[mode]:true});
  assert.equal(acting.update(.1,ground).compression,0);
 }
 acting.reset();assert.ok(Object.values(acting.update(NaN,{...ground,vy:NaN,speed:Infinity,turnRate:NaN})).every(Number.isFinite));
});
test('ground turn acting is bounded and gives immediate combat pose no new turn kick',()=>{
 const acting=new PlayerInertia();
 for(let i=0;i<60;i++)acting.update(1/60,{...ground,speed:9,turnRate:8});
 assert.ok(acting.update(0,ground).turn>.065);assert.ok(acting.update(0,ground).turn<=.07);
 for(let i=0;i<60;i++)acting.update(1/60,{...ground,speed:9,turnRate:80,lockedUpperBody:true});
 assert.ok(acting.update(0,ground).turn<.00001);
});
test('actual runtime legs extend for descent and landing loads hips without moving root or sinking sole',async t=>{
 const f=await playerFixture(),a=new SkinnedCharacterAnimator(f.rig);a.reset(false);
 const state={...ground,moveYaw:0,armed:false};
 const kneeFlex=()=>{
  const hip=f.rig.joints.Thigh_R.getWorldPosition(new THREE.Vector3()),knee=f.rig.joints.Shin_R.getWorldPosition(new THREE.Vector3()),foot=f.rig.joints.Foot_R.getWorldPosition(new THREE.Vector3());
  return Math.PI-hip.sub(knee).angleTo(foot.sub(knee));
 };
 for(let i=0;i<60;i++)a.update(1/60,{...state,onGround:false,vy:6});
 const rising=kneeFlex();
 for(let i=0;i<60;i++)a.update(1/60,{...state,onGround:false,vy:-10});
 const falling=kneeFlex();assert.ok(rising-falling>.40);
 const root=f.rig.root.position.clone();let minHip=Infinity,minSole=Infinity,maxStep=0;
 const shoe=f.rig.meshes.find(m=>m.name==='BodyBatch_05_soft_dark_shoe_leather')!;
 let previous=f.rig.joints.Hips.getWorldPosition(new THREE.Vector3()).y;
 for(let i=0;i<90;i++){
  a.update(1/60,state);const y=f.rig.joints.Hips.getWorldPosition(new THREE.Vector3()).y;
  maxStep=Math.max(maxStep,Math.abs(y-previous));previous=y;minHip=Math.min(minHip,y);
  // Check every landing frame, including the first contact (not only settled poses).
  for(let v=0;v<shoe.geometry.attributes.position.count;v++)minSole=Math.min(minSole,shoe.getVertexPosition(v,new THREE.Vector3()).applyMatrix4(shoe.matrixWorld).y);
 }
 assert.ok(f.rig.root.position.equals(root));assert.ok(maxStep<.03);assert.ok(minSole>=-.001);
 const settled=f.rig.joints.Hips.getWorldPosition(new THREE.Vector3()).y;assert.ok(settled-minHip>.035);
 t.diagnostic(JSON.stringify({risingKneeRadians:rising,fallingKneeRadians:falling,minHip,settledHip:settled,maxFrameHipTravel:maxStep,minSole}));f.dispose();
});

test('jump gather develops toward apex; walking off an edge never creates takeoff acting and repeated contacts stay bounded',()=>{
 const acting=new PlayerInertia();acting.update(1/60,{...ground,onGround:false,vy:6});
 let gather=0;for(let i=0;i<24;i++)gather=acting.update(1/60,{...ground,onGround:false,vy:6-i/4}).gather;
 assert.ok(gather>.95,'apex retains gathered limbs rather than early extension');
 acting.reset();for(let i=0;i<30;i++)assert.equal(acting.update(1/60,{...ground,onGround:false,vy:-i/4}).gather,0);
 for(let i=0;i<240;i++){acting.update(1/120,{...ground,onGround:false,vy:-30});assert.ok(acting.update(1/120,ground).compression<=.06);}
});

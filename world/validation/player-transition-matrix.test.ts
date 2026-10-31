import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { playerFixture } from './player-fixture.ts';
import { SkinnedCharacterAnimator, type PlayerAnimationState } from '../src/skinnedCharacter.ts';
const v=()=>new THREE.Vector3();
const base:PlayerAnimationState={speed:0,onGround:true,swimming:false,vy:0,moveYaw:0,armed:true};
test('turn/jump/ADS/melee/glide interruptions keep actual support surfaces and immediate shot contacts at30/60/120Hz',async t=>{
 for(const hz of [30,60,120]){
  const f=await playerFixture(),a=new SkinnedCharacterAnimator(f.rig);a.reset(true);
  const shoe=f.rig.meshes.find(m=>m.name==='BodyBatch_05_soft_dark_shoe_leather')!;
  let minSole=Infinity,maxShotContact=0,maxMuzzleAngle=0,frames=0,minAt:any;
  const run=(duration:number,sample:(t:number)=>PlayerAnimationState)=>{
   for(let i=0;i<Math.round(duration*hz);i++){
    const state=sample(i/hz),root=f.rig.root.position.clone();a.update(1/hz,state);frames++;
    assert.ok(f.rig.root.position.equals(root),'acting must never move the controller');
    f.rig.root.traverse(o=>assert.ok(o.matrixWorld.elements.every(Number.isFinite)));
    if(state.onGround&&!state.swimming&&i%Math.max(1,Math.round(hz/30))===0){
     for(let j=0;j<shoe.geometry.attributes.position.count;j++){const y=shoe.getVertexPosition(j,v()).applyMatrix4(shoe.matrixWorld).y;if(y<minSole){minSole=y;minAt={frame:frames,state};}}
    }
    if(state.firing){
     const pitch=state.pitch??0,yaw=state.lookYaw??0,look=new THREE.Vector3(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch));
     a.prepareShot(look);f.rig.root.updateMatrixWorld(true);
     for(const side of ['L','R']as const){const anchor=side==='R'?f.rig.gunAnchors.grip:f.rig.gunAnchors.support;
      const actual=f.rig.joints.Gun.localToWorld(anchor.clone()),palm=f.rig.handSockets[side].getWorldPosition(v());maxShotContact=Math.max(maxShotContact,actual.distanceTo(palm));}
     const muzzle=new THREE.Vector3(0,0,-1).applyQuaternion(f.rig.joints.Gun.getWorldQuaternion(new THREE.Quaternion()));maxMuzzleAngle=Math.max(maxMuzzleAngle,muzzle.angleTo(look));
    }
   }
  };
  run(1,t=>({...base,speed:9,moveYaw:Math.sin(t*5)*1.5}));
  run(.5,t=>({...base,speed:5,onGround:false,vy:6-t*14,moveYaw:t,aim:1,pitch:Math.sin(t*7)*1.25,lookYaw:t,firing:true}));
  run(.5,t=>({...base,speed:3,onGround:false,vy:-7,moveYaw:t+1,gliding:true,aim:t>.25?1:0,pitch:-1.2,lookYaw:2,firing:t>.25}));
  run(.6,t=>({...base,speed:2,moveYaw:2+t,aim:t<.15?1:0,pitch:.9,lookYaw:2.6,firing:t<.15}));
  for(let combo=0;combo<3;combo++)run(.5,t=>({...base,speed:2,moveYaw:2.6,melee:{phase:t/.5,combo,yaw:2.6}}));
  run(.5,t=>({...base,speed:9,moveYaw:2.6+t,aim:1,pitch:1.3,lookYaw:3,firing:true}));
  run(.4,t=>({...base,swimming:true,onGround:false,speed:3,vy:-2,aim:1,pitch:-.9,lookYaw:-2,firing:true}));
  run(1,()=>base);
  t.diagnostic(JSON.stringify({hz,frames,minSole,maxShotContact,maxMuzzleAngle,minAt}));
  assert.ok(minSole>=-.001,`support penetration ${minSole}`);assert.ok(maxShotContact<.005,`lost gun contact ${maxShotContact}`);assert.ok(maxMuzzleAngle<1e-6);f.dispose();
 }
});

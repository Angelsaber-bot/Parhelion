/** Independent native anatomical grid: grip identity alone cannot prove wrist comfort. */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {playerFixture} from './player-fixture';
import {SkinnedCharacterAnimator as Baseline} from './fixtures/player-pre-ads-pole';
import {SkinnedCharacterAnimator as Current} from '../src/skinnedCharacter';
type Rig=Awaited<ReturnType<typeof playerFixture>>['rig'];
function bend(rig:Rig){
 const hand=rig.joints.Hand_R,forearm=rig.joints.Forearm_R,middle=rig.bones.J_Bip_R_Middle1;
 const origin=hand.getWorldPosition(new THREE.Vector3());
 return THREE.MathUtils.radToDeg(middle.getWorldPosition(new THREE.Vector3()).sub(origin).angleTo(origin.clone().sub(forearm.getWorldPosition(new THREE.Vector3()))));
}
test('settled native ADS grid bounds wrist flex relative to exact old pose, not only fixed palm',async t=>{
 const a=await playerFixture(),b=await playerFixture();const old=new Baseline(a.rig),current=new Current(b.rig);const rows:any[]=[];let changed=0;
 try{
  for(const speed of[0,5.5])for(const aim of[0,.5,1])for(const pitch of[-1,-.5,-.25,0,.5,1]){
   old.reset(true);current.reset(true);const state={speed,aim,pitch,armed:true,onGround:true,swimming:false,vy:0,moveYaw:0};
   for(let i=0;i<360;i++){old.update(1/120,state);current.update(1/120,state);}
   let maxOld=0,maxCurrent=0,maxExcess=-Infinity,maxPalm=0;
   for(let i=0;i<32;i++){
    old.update(1/120,state);current.update(1/120,state);const before=bend(a.rig),after=bend(b.rig);maxOld=Math.max(maxOld,before);maxCurrent=Math.max(maxCurrent,after);maxExcess=Math.max(maxExcess,after-Math.max(before,12.5));
    assert.ok(after<=Math.max(before,12.5)+.0001,`wrist limit: speed=${speed},aim=${aim},pitch=${pitch},old=${before},current=${after}`);
    for(const side of['L','R']as const)maxPalm=Math.max(maxPalm,a.rig.handSockets[side].getWorldPosition(new THREE.Vector3()).distanceTo(b.rig.handSockets[side].getWorldPosition(new THREE.Vector3())));
    assert.deepEqual(a.rig.joints.Gun.matrixWorld.elements,b.rig.joints.Gun.matrixWorld.elements);
    if(a.rig.joints.Forearm_R.quaternion.angleTo(b.rig.joints.Forearm_R.quaternion)>.001)changed++;
   }
   assert.ok(maxPalm<1e-12);rows.push({speed,aim,pitch,maxOld,maxCurrent,maxExcess,maxPalm});
  }
  assert.ok(changed>0,'anatomical clamp does not merely disable every correction');t.diagnostic(JSON.stringify({cases:rows.length,samples:rows.length*32,changed,rows}));
 }finally{a.dispose();b.dispose();}
});

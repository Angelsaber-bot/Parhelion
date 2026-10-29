/** Anatomical wrist regression: actual imported hand/metacarpal basis, not world Euler angles. */
import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { playerFixture } from './player-fixture.ts';
import { ShoulderAim } from '../src/aim.ts';
import { SkinnedCharacterAnimator } from '../src/skinnedCharacter.ts';
const v=()=>new THREE.Vector3(),q=()=>new THREE.Quaternion(),deg=THREE.MathUtils.radToDeg;
const base={speed:0,onGround:true,swimming:false,vy:0,moveYaw:0};
type Rig=Awaited<ReturnType<typeof playerFixture>>['rig'];
function wrist(rig:Rig,side:'R'|'L') {
 const lower=rig.joints[`Forearm_${side}`] as THREE.Bone,hand=rig.joints[`Hand_${side}`] as THREE.Bone,middle=rig.bones[`J_Bip_${side}_Middle1`];
 const lr=rig.rest.get(lower)!,hr=rig.rest.get(hand)!;
 const bindAxis=rig.rest.get(middle)!.rootP.clone().sub(hr.rootP).normalize();
 const bindDorsal=new THREE.Vector3(0,1,0).addScaledVector(bindAxis,-bindAxis.y).normalize();
 const distal=middle.getWorldPosition(v()).sub(hand.getWorldPosition(v())).normalize();
 const forearm=hand.getWorldPosition(v()).sub(lower.getWorldPosition(v())).normalize();
 const dorsal=(bone:THREE.Bone,rest:typeof lr)=>bindDorsal.clone().applyQuaternion(rest.rootQ.clone().invert()).applyQuaternion(bone.getWorldQuaternion(q()));
 const project=(axis:THREE.Vector3)=>axis.addScaledVector(forearm,-axis.dot(forearm)).normalize();
 const d1=project(dorsal(lower,lr)),d2=project(dorsal(hand,hr));
 return {bend:deg(distal.angleTo(forearm)),roll:deg(Math.atan2(forearm.dot(d1.clone().cross(d2)),d1.dot(d2)))};
}

test('actual free wrists follow the forearm with small relaxed flex and no axial wrist wind-up across idle/walk/run',async t=>{
 const f=await playerFixture(),a=new SkinnedCharacterAnimator(f.rig);
 for(const armed of [false,true])for(const speed of [0,2,5.5,9]){
  if(armed&&speed===0)continue;a.reset(armed);
  for(let i=0;i<240;i++)a.update(1/120,{...base,armed,speed});
  let maxBend=0,maxRoll=0;
  for(let i=0;i<240;i++){
   a.update(1/120,{...base,armed,speed});
   for(const side of (armed?['L']:['R','L']) as ('R'|'L')[]){const m=wrist(f.rig,side);maxBend=Math.max(maxBend,m.bend);maxRoll=Math.max(maxRoll,Math.abs(m.roll));}
  }
  t.diagnostic(JSON.stringify({armed,speed,maxBend,maxRoll}));
  assert.ok(maxBend<6,'a free metacarpal cannot retain the rejected 32–44 degree wrist kink');
  assert.ok(maxRoll<.1,'pronation belongs in the forearm, not an axially twisted wrist');
 }f.dispose();
});

test('actual low carry balances relaxed wrist flex with stock clearance and ADS preserves the grip',async t=>{
 const f=await playerFixture(),a=new SkinnedCharacterAnimator(f.rig);
 for(const [speed,aim]of [[5.5,0],[9,0],[0,0],[0,1]]as const){
  a.reset(true);for(let i=0;i<240;i++)a.update(1/120,{...base,speed,aim});
  let maxRight=0,maxLeft=0,maxRoll=0,maxGrip=0;
  for(let i=0;i<240;i++){
   a.update(1/120,{...base,speed,aim});
   for(const side of ['R','L']as const){
    const m=wrist(f.rig,side);maxRoll=Math.max(maxRoll,Math.abs(m.roll));if(side==='R')maxRight=Math.max(maxRight,m.bend);else maxLeft=Math.max(maxLeft,m.bend);
    if(side==='R'||aim===1||speed===0)maxGrip=Math.max(maxGrip,f.rig.handSockets[side].getWorldPosition(v()).distanceTo(f.rig.joints.Gun.localToWorld(f.rig.gunAnchors[side==='R'?'grip':'support'].clone())));
   }
  }
  t.diagnostic(JSON.stringify({speed,aim,maxRight,maxLeft,maxRoll,maxGrip}));
  assert.ok(maxRight<(speed>0?24:13));assert.ok(maxLeft<24);assert.ok(maxRoll<.1);assert.ok(maxGrip<.002);
 }f.dispose();
});

test('wrist/forearm orientations stay continuous through repeated ADS interruption, pitch sweeps and wrapped heading at 30/60/120 Hz',async t=>{
 for(const ordinary of [false,true])for(const hz of [30,60,120]){
  const f=await playerFixture(),a=new SkinnedCharacterAnimator(f.rig),shoulderAim=new ShoulderAim();a.reset(true);
  for(let i=0;i<hz*2;i++)a.update(1/hz,{...base,speed:5.5});
  const names=['Arm_R','Forearm_R','Hand_R','Arm_L','Forearm_L','Hand_L'];
  let previous=names.map(n=>f.rig.joints[n].quaternion.clone()),maxAngularSpeed=0,maxGrip=0;
  for(let i=0;i<hz*10;i++){
   const time=i/hz;shoulderAim.held=!!(Math.floor(time/.35)%2);const aim=ordinary?shoulderAim.step(1/hz,true):Number(shoulderAim.held);
   a.update(1/hz,{...base,speed:ordinary?5.5:Math.floor(time/1.4)%2?9:5.5,aim,pitch:Math.sin(time*1.1)*(ordinary?.5:1.45),moveYaw:Math.atan2(Math.sin(time*2),Math.cos(time*2))});
   names.forEach((name,j)=>{const rotation=f.rig.joints[name].quaternion;maxAngularSpeed=Math.max(maxAngularSpeed,deg(rotation.angleTo(previous[j]))*hz);previous[j]=rotation.clone();});
   for(const bone of Object.values(f.rig.bones))assert.ok(bone.matrixWorld.elements.every(Number.isFinite));
   for(const side of ['R','L']as const)assert.ok(Math.abs(wrist(f.rig,side).roll)<.1);
   maxGrip=Math.max(maxGrip,f.rig.handSockets.R.getWorldPosition(v()).distanceTo(f.rig.joints.Gun.localToWorld(f.rig.gunAnchors.grip.clone())));
  }
  t.diagnostic(JSON.stringify({ordinaryProductionAim:ordinary,hz,maxAngularSpeed,maxGrip}));
  assert.ok(maxAngularSpeed<(ordinary?1300:3800),'production eased ADS has a tighter envelope than intentionally raw full-range input toggles');assert.ok(maxGrip<.002);f.dispose();
 }
});


test('dense actual stock/sleeve triangles retain clearance after wrist pronation at walk and run',async t=>{
 const f=await playerFixture(),a=new SkinnedCharacterAnimator(f.rig);
 const sleeve=f.rig.meshes.find(m=>m.name==='BodyBatch_04_porcelain-white_tailored_twill') as THREE.SkinnedMesh;
 const stock=f.rig.joints.Gun.getObjectByName('Stock_external_frame') as THREE.Mesh;
 assert.ok(sleeve&&stock);
 const geometry=new THREE.BufferGeometry(),positions=new Float32Array(sleeve.geometry.attributes.position.count*3);
 geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setIndex(sleeve.geometry.index!.clone());
 const point=v();for(let vertex=0;vertex<positions.length/3;vertex++)sleeve.getVertexPosition(vertex,point).toArray(positions,vertex*3);
 const tree=new MeshBVH(geometry),stockTree=new MeshBVH(stock.geometry);stock.geometry.boundsTree=stockTree;let minDistance=Infinity;
 for(const speed of [5.5,9]){
  a.reset(true);for(let i=0;i<240;i++)a.update(1/120,{...base,speed});
  for(let frame=0;frame<240;frame++){
   a.update(1/120,{...base,speed});
   for(let vertex=0;vertex<positions.length/3;vertex++)sleeve.getVertexPosition(vertex,point).toArray(positions,vertex*3);
   tree.refit();const relative=sleeve.matrixWorld.clone().invert().multiply(stock.matrixWorld);
   assert.equal(tree.bvhcast(stockTree,relative,{intersectsTriangles:(one,two)=>one.intersectsTriangle(two,undefined,true)}),false,`stock crosses actual sleeve: ${speed}, ${frame}`);
   if(frame%10===0){const nearest=tree.closestPointToGeometry(stock.geometry,relative);if(nearest)minDistance=Math.min(minDistance,nearest.distance);}
  }
 }
 t.diagnostic(JSON.stringify({denseSamples:480,hz:120,minSampledStockSleeveDistance:minDistance}));
 assert.ok(minDistance>.001,'leave a real millimetre-scale margin, not merely a sampled nonintersection');geometry.dispose();f.dispose();
});

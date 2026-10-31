import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { playerFixture } from './player-fixture';
import { SkinnedCharacterAnimator, type PlayerAnimationState } from '../src/skinnedCharacter';
import { SkinnedCharacterAnimator as Before } from './fixtures/player-pre-ads-pole';
const base:PlayerAnimationState={speed:0,onGround:true,swimming:false,vy:0,moveYaw:0,armed:true,aim:0,pitch:0};
const locals=(rig:Awaited<ReturnType<typeof playerFixture>>['rig'])=>Object.fromEntries(Object.entries(rig.bones).map(([name,b])=>[name,[...b.position.toArray(),...b.quaternion.toArray(),...b.scale.toArray()]]));

test('ADS correction leaves immediate hip-fire and repeated shot origins exactly at the historical pose',async()=>{
 const a=await playerFixture(),b=await playerFixture(),old=new Before(a.rig),current=new SkinnedCharacterAnimator(b.rig);
 try{for(const pitch of[-1.5,-.3,0,.8,1.5]){old.reset(true);current.reset(true);for(let i=0;i<120;i++){old.update(1/60,{...base,pitch});current.update(1/60,{...base,pitch});}
  for(const yaw of[0,.8,-.6]){const direction=new THREE.Vector3(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch));old.prepareShot(direction);current.prepareShot(direction);assert.deepEqual(locals(b.rig),locals(a.rig));assert.deepEqual(b.rig.joints.Gun.matrixWorld.elements,a.rig.joints.Gun.matrixWorld.elements);assert.deepEqual(b.rifle.muzzleWorld().toArray(),a.rifle.muzzleWorld().toArray());}
 }}finally{a.dispose();b.dispose();}
});

test('native ADS/turn/jump/glide/melee transitions preserve exact gun and non-arm state with fixed palm contacts',async()=>{
 const a=await playerFixture(),b=await playerFixture(),old=new Before(a.rig),current=new SkinnedCharacterAnimator(b.rig);let maxPalm=0,maxElbow=0;
 try{for(let i=0;i<1440;i++){const t=i/60,phase=Math.floor(t/3),state:PlayerAnimationState={speed:phase%3===0?5.5:0,onGround:phase!==2&&phase!==6,swimming:false,gliding:phase===6,vy:phase===2?Math.sin(t*3)*4:0,moveYaw:Math.sin(t*.7),armed:phase!==7,aim:phase===0?0:Math.min(1,Math.max(0,Math.sin(t*2)*.8+.5)),pitch:Math.sin(t)*1.5,firing:i%97===0,lookYaw:Math.sin(t*.7),...(phase===5?{melee:{phase:(t%1.2)/1.2,combo:Math.floor(t/1.2)%3,yaw:Math.sin(t*.7)}}:{})};old.update(1/60,state);current.update(1/60,state);
  assert.deepEqual(b.rig.joints.Gun.matrixWorld.elements,a.rig.joints.Gun.matrixWorld.elements);assert.deepEqual(b.rifle.muzzleWorld().toArray(),a.rifle.muzzleWorld().toArray());
  for(const side of['R','L']as const)maxPalm=Math.max(maxPalm,a.rig.handSockets[side].getWorldPosition(new THREE.Vector3()).distanceTo(b.rig.handSockets[side].getWorldPosition(new THREE.Vector3())));
  maxElbow=Math.max(maxElbow,a.rig.joints.Forearm_R.getWorldPosition(new THREE.Vector3()).distanceTo(b.rig.joints.Forearm_R.getWorldPosition(new THREE.Vector3())));
  const before=locals(a.rig),after=locals(b.rig);for(const name of Object.keys(before))if(!/^J_Bip_R_(UpperArm|LowerArm|Hand)$/.test(name))assert.deepEqual(after[name],before[name],name);
 }
 assert.ok(maxElbow>.05,'positive native right-arm adjustment');assert.ok(maxPalm<1e-12);
 old.reset(false);current.reset(false);assert.deepEqual(locals(b.rig),locals(a.rig),'new-game/unarmed reset has no corrective carryover');
 }finally{a.dispose();b.dispose();}
});

test('level native ADS reduces measured sleeve/stock crossing extent without changing weapon geometry',async(t)=>{
 const counts:number[]=[], extents:number[]=[];
 for(const Runtime of[Before,SkinnedCharacterAnimator]){const f=await playerFixture(),anim=new Runtime(f.rig);try{for(let i=0;i<120;i++)anim.update(1/60,{...base,aim:1});const sleeve=f.rig.meshes.find(m=>/BodyBatch_04_/.test(m.name)) as THREE.SkinnedMesh;assert.ok(sleeve);const ix=sleeve.geometry.attributes.skinIndex,w=sleeve.geometry.attributes.skinWeight,index=sleeve.geometry.index!,selected:number[]=[];const weights:number[]=[];
  for(let i=0;i<ix.count;i++){let sum=0;for(let k=0;k<4;k++)if(/^J_Bip_R_(UpperArm|LowerArm)$/.test(sleeve.skeleton.bones[ix.getComponent(i,k)].name))sum+=w.getComponent(i,k);weights.push(sum);}
  for(let i=0;i<index.count;i+=3){const tri=[index.getX(i),index.getX(i+1),index.getX(i+2)];if(tri.every(v=>weights[v]>.7))selected.push(...tri);}
  assert.ok(selected.length>1000);const geometry=new THREE.BufferGeometry(),positions=new Float32Array(ix.count*3),p=new THREE.Vector3();sleeve.skeleton.update();for(let i=0;i<ix.count;i++)sleeve.getVertexPosition(i,p).applyMatrix4(sleeve.matrixWorld).toArray(positions,i*3);geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setIndex(selected);const tree=new MeshBVH(geometry);let count=0,stocks=0,extent=0;const line=new THREE.Line3();
  f.rig.joints.Gun.traverse(o=>{const mesh=o as THREE.Mesh;if(!mesh.isMesh||!mesh.name.startsWith('Stock_external_frame'))return;stocks++;const weaponTree=new MeshBVH(mesh.geometry);let hit=false;tree.bvhcast(weaponTree,mesh.matrixWorld,{intersectsTriangles:(a,b)=>{if(a.intersectsTriangle(b,line)){hit=true;extent+=line.distance();}return false;}});if(hit)count++;});assert.ok(stocks>=5);counts.push(count);extents.push(extent);geometry.dispose();
 }finally{f.dispose();}}
 t.diagnostic(JSON.stringify({counts,extents,scope:'sum of triangle intersection line lengths, not depth/volume'}));assert.ok(counts[0]>0,'historical stock/sleeve defect positively exercised');assert.ok(counts[1]<=counts[0],'no additional intersecting stock submeshes in this settled pose');assert.ok(extents[1]<extents[0]*.8,'at least 20% less summed triangle-crossing line extent; residual contact remains, not penetration depth');
});

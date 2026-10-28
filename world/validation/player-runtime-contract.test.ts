import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {buildCharacter, CharacterAnimator} from '../src/character.ts';

const required=['Hips','CoatTails','Spine','ScarfTail','Head','Ponytail','Arm_L','Forearm_L','Thigh_L','Shin_L','Arm_R','Forearm_R','Thigh_R','Shin_R','Glider','Gun'];
test('player rig preserves animation joints, synchronous geometry and finite attributes',()=>{
 const material=new THREE.MeshBasicMaterial({vertexColors:true}),rig=buildCharacter(material);
 for(const name of required)assert.ok(rig.joints[name],`missing animation joint ${name}`);
 assert.ok(rig.meshes.length>0&&rig.meshes.length<=24,'bounded shared-material draw batches');
 for(const mesh of rig.meshes){assert.equal(mesh.material,material);assert.ok(mesh.geometry.attributes.position.count>0);for(const attribute of Object.values(mesh.geometry.attributes))for(const v of attribute.array)assert.ok(Number.isFinite(v));}
 for(const pair of [rig.gunHold,rig.gunSling]){assert.ok(Math.abs(pair.q.length()-1)<1e-5);assert.ok(pair.p.toArray().every(Number.isFinite));}
});
test('player locomotion, swimming, glide and shoulder aim do not freeze or generate invalid transforms',()=>{
 const rig=buildCharacter(new THREE.MeshBasicMaterial()),animator=new CharacterAnimator(rig);
 for(const state of [
 {speed:0,onGround:true,swimming:false,vy:0,moveYaw:null},
 {speed:9,onGround:true,swimming:false,vy:0,moveYaw:1},
 {speed:3,onGround:false,swimming:true,vy:0,moveYaw:2},
 {speed:5,onGround:false,swimming:false,vy:-2,moveYaw:0,gliding:true},
 {speed:0,onGround:true,swimming:false,vy:0,moveYaw:0,aim:1,pitch:-.5},
 {speed:0,onGround:true,swimming:false,vy:0,moveYaw:0,aim:1,pitch:.5},
 ])for(let i=0;i<120;i++){
 animator.update(1/60,state);rig.root.updateMatrixWorld(true);
 for(const [name,joint]of Object.entries(rig.joints)){assert.equal(joint.matrixAutoUpdate,true,`${name} incorrectly frozen`);assert.equal(joint.matrixWorldAutoUpdate,true);assert.ok(joint.matrixWorld.elements.every(Number.isFinite));}
 }
});
test('fully raised rifle hands meet actual grip and handguard within 2 mm at supported pitches',()=>{
 for(const pitch of [-.5,0,.5]){
 const rig=buildCharacter(new THREE.MeshBasicMaterial()),animator=new CharacterAnimator(rig);
 for(let i=0;i<120;i++)animator.update(1/60,{speed:0,onGround:true,swimming:false,vy:0,moveYaw:0,aim:1,pitch});
 rig.root.updateMatrixWorld(true);
 for(const [side,anchor]of [['R','grip'],['L','support']] as const){
 const wrist=rig.joints[`Forearm_${side}`].localToWorld(new THREE.Vector3(0,-.28,0));
 const target=rig.joints.Gun.localToWorld(rig.gunAnchors[anchor].clone());
 assert.ok(wrist.distanceTo(target)<.002,`${side} hand misses ${anchor} at pitch ${pitch}: ${wrist.distanceTo(target)} m`);
 }
 }
});
test('equipped production AR fits both wrists at everyday ADS pitches, not only fallback gun',async()=>{
 const {attachExplorerRifle}=await import('../src/weaponArt.ts');
 const {GLTFLoader}=await import('three/examples/jsm/loaders/GLTFLoader.js');
 const {readFile}=await import('node:fs/promises');
 const data=await readFile(new URL('../../assets/weapons/glb/01_Dawn_AR.glb',import.meta.url));
 const rig=buildCharacter(new THREE.MeshStandardMaterial()),rifle=attachExplorerRifle(rig,undefined,()=>new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),''));
 await rifle.ready;assert.equal(rig.joints.Gun.userData.artState,'ready');
 const animator=new CharacterAnimator(rig);
 for(const pitch of [-.5,0,.5]){
 for(let i=0;i<120;i++)animator.update(1/60,{speed:0,onGround:true,swimming:false,vy:0,moveYaw:0,aim:1,pitch});
 rig.root.updateMatrixWorld(true);
 for(const [side,anchor]of [['R','grip'],['L','support']] as const){
 const wrist=rig.joints[`Forearm_${side}`].localToWorld(new THREE.Vector3(0,-.28,0));
 const target=rig.joints.Gun.localToWorld(rig.gunAnchors[anchor].clone());
 assert.ok(wrist.distanceTo(target)<.002,`equipped AR ${side} error ${wrist.distanceTo(target)} at pitch ${pitch}`);
 }
 }
 rifle.dispose();
});
test('authored mesh indices and quantized normals stay valid after decoding',()=>{
 const rig=buildCharacter(new THREE.MeshStandardMaterial());
 const meshes=rig.meshes.filter(m=>m.userData.authoredPlayer);assert.ok(meshes.length>0);
 let triangles=0;
 for(const mesh of meshes){
 const p=mesh.geometry.attributes.position,n=mesh.geometry.attributes.normal,ix=mesh.geometry.index;assert.ok(ix);
 triangles+=ix.count/3;
 for(const index of ix.array)assert.ok(index>=0&&index<p.count,`out-of-range vertex ${mesh.name}`);
 for(let i=0;i<n.count;i++){const length=Math.hypot(n.getX(i),n.getY(i),n.getZ(i));assert.ok(length>.98&&length<1.02,`bad quantized normal ${mesh.name}:${i}`);}
 assert.ok(mesh.geometry.boundingSphere&&Number.isFinite(mesh.geometry.boundingSphere.radius));
 }
 assert.ok(triangles>20_000&&triangles<60_000,'bounded authored player fidelity/budget, excluding gun and glider');
});

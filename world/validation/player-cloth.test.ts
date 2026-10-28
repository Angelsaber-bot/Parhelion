import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {buildCharacter,CharacterAnimator} from '../src/character.ts';import {deformUniformCloth} from '../src/playerMesh.ts';
test('short tunic deformation uses immutable rest data, resets, remains finite and stays inside culling sphere',()=>{
 const rig=buildCharacter(new THREE.MeshStandardMaterial()),mesh=rig.meshes.find(m=>m.name==='PlayerPart_CoatTails')!,g=mesh.geometry,p=g.attributes.position,n=g.attributes.normal;
 const original=Array.from(p.array);rig.joints.Thigh_L.rotation.x=.9;rig.joints.Thigh_R.rotation.x=-.9;deformUniformCloth(rig.joints,rig.meshes);const posed=Array.from(p.array);
 for(let i=0;i<100;i++)deformUniformCloth(rig.joints,rig.meshes);assert.deepEqual(Array.from(p.array),posed,'must not accumulate deformation');
 for(const angles of [[-.9,.9],[.9,-.9],[-.7,-.7],[.35,.35],[0,0]]){
 rig.joints.Thigh_L.rotation.x=angles[0];rig.joints.Thigh_R.rotation.x=angles[1];deformUniformCloth(rig.joints,rig.meshes);
 for(let i=0;i<p.count;i++){const v=new THREE.Vector3().fromBufferAttribute(p,i);assert.ok(v.toArray().every(Number.isFinite));assert.ok(g.boundingSphere!.containsPoint(v),'deformed cloth outside culling sphere');assert.ok(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<1e-5);if(original[i*3+1]>=-.025)assert.ok(v.distanceTo(new THREE.Vector3(...original.slice(i*3,i*3+3)))<1e-6,'waist stays fixed');}
 }
 for(let i=0;i<p.array.length;i++)assert.ok(Math.abs(p.array[i]-original[i])<1e-6,'zero thigh angle restores rest');
});
test('run-idle-swim-idle returns tunic to rest without stale deformed vertices',()=>{
 const rig=buildCharacter(new THREE.MeshStandardMaterial()),a=new CharacterAnimator(rig),p=rig.meshes.find(m=>m.name==='PlayerPart_CoatTails')!.geometry.attributes.position,original=Array.from(p.array);
 for(const state of [{speed:9,onGround:true,swimming:false},{speed:0,onGround:true,swimming:false},{speed:3,onGround:false,swimming:true},{speed:0,onGround:true,swimming:false}])for(let i=0;i<180;i++)a.update(1/60,{...state,vy:0,moveYaw:0});
 for(let i=0;i<p.array.length;i++)assert.ok(Math.abs(p.array[i]-original[i])<1e-6);
});

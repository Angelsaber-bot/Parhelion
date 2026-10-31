/** Candidate-only finite floor/cache checks; no production attachment. */
import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';import {MeshBVH} from 'three-mesh-bvh';
import {SaberTerrainPatch} from '../../src/characters/saberTerrainPatch';import {CompanionNavigation} from '../../src/companionNavigation';
const surface=()=>{const geometry=new THREE.PlaneGeometry(8,8).rotateX(-Math.PI/2);return{name:'independent',enabled:true,bvh:new MeshBVH(geometry)};};
test('candidate cache follows versioned real BVH refit and rejects nonfinite floor requests',()=>{
 const c=surface(),patch=new SaberTerrainPatch([c]),nav=new CompanionNavigation([c]);try{patch.beginFrame(0,0,0);assert.equal(patch.floor(0,0,0),0);const position=c.bvh.geometry.getAttribute('position');for(let i=0;i<position.count;i++)position.setY(i,position.getY(i)+.23);position.needsUpdate=true;c.bvh.refit();patch.beginFrame(0,0,0);assert.ok(Math.abs(patch.floor(0,0,0)!-.23)<1e-7);assert.equal(patch.floor(0,0,0),nav.floor(0,0,0));for(const args of [[NaN,0,0],[0,Infinity,0],[0,0,NaN]])assert.equal(patch.floor(...args as [number,number,number]),null);}finally{c.bvh.geometry.dispose();}
});
test('candidate recovers support after collider-count overflow returns to its prior valid set',()=>{
 const c=surface(),colliders=[c],patch=new SaberTerrainPatch(colliders);try{patch.beginFrame(0,0,0);assert.equal(patch.floor(0,0,0),0);for(let i=0;i<256;i++)colliders.push({name:`disabled-${i}`,enabled:false,bvh:c.bvh});patch.beginFrame(0,0,0);assert.equal(patch.floor(0,0,0),null,'oversize list is unsupported');colliders.length=1;patch.beginFrame(0,0,0);assert.equal(patch.floor(0,0,0),0,'restored original valid set must not remain poisoned until actor moves');}finally{c.bvh.geometry.dispose();}
});
test('explicit clear invalidates cached bounds after announced in-place BVH refit',()=>{
 const c=surface(),patch=new SaberTerrainPatch([c]);try{patch.beginFrame(0,0,0);assert.equal(patch.floor(0,0,0),0);const position=c.bvh.geometry.getAttribute('position');for(let i=0;i<position.count;i++){position.setX(i,position.getX(i)+20);position.setY(i,.2);}c.bvh.refit();patch.clear();patch.beginFrame(20,0,.2);assert.ok(Math.abs(patch.floor(20,0,.2)!-.2)<1e-7,'explicit clear is the update notification for raw CPU edits');}finally{c.bvh.geometry.dispose();}
});
test('index identity/version changes invalidate cached triangle topology',()=>{
 for(const replace of [false,true]){const geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute([-2,0,-1,0,0,-1,-1,0,1,0,0,-1,2,0,-1,1,0,1],3));geometry.setIndex([0,1,2,3,4,5]);const c={name:'topology',enabled:true,bvh:new MeshBVH(geometry)},patch=new SaberTerrainPatch([c]),nav=new CompanionNavigation([c]);try{patch.beginFrame(0,0,0);assert.equal(patch.floor(1,0,0),0);if(replace)geometry.setIndex([0,1,2,0,1,2]);else{for(let i=3;i<6;i++)geometry.index!.setX(i,i-3);geometry.index!.needsUpdate=true;}c.bvh.refit();patch.beginFrame(0,0,0);assert.equal(nav.floor(1,0,0),null);assert.equal(patch.floor(1,0,0),null);}finally{geometry.dispose();}}
});

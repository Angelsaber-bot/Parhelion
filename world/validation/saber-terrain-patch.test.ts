import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { SaberTerrainPatch } from '../src/characters/saberTerrainPatch.ts';
import { CompanionNavigation } from '../src/companionNavigation.ts';
const surface=(y:number,segments=1)=>{const g=new THREE.PlaneGeometry(8,8,segments,segments).rotateX(-Math.PI/2).translate(0,y,0);return{name:'test',enabled:true,bvh:new MeshBVH(g)};};
test('cached triangles agree with authoritative finite floor rays, including overlapping floors',()=>{
 const colliders=[surface(0),surface(.4),surface(2)];const patch=new SaberTerrainPatch(colliders),nav=new CompanionNavigation(colliders);patch.beginFrame(0,0,0);
 for(let i=0;i<100;i++){const x=Math.sin(i)*.8,z=Math.cos(i)*.8;assert.ok(Math.abs(patch.floor(x,z,0)!-nav.floor(x,z,0)!)<1e-7);}
 assert.equal(patch.diagnostics.refreshes,1);assert.equal(patch.diagnostics.shapecasts,2);assert.equal(patch.floor(4,4,0),null);
 colliders[1].enabled=false;patch.beginFrame(0,0,0);assert.equal(patch.floor(0,0,0),0);assert.equal(patch.diagnostics.refreshes,2);
 colliders[0].bvh=surface(.18).bvh;patch.beginFrame(0,0,0);assert.ok(Math.abs(patch.floor(0,0,0)!-.18)<1e-7);
});
test('dense patch overflow stays unsupported without repeated per-probe shapecasts',()=>{
 const patch=new SaberTerrainPatch([surface(0,100)]);patch.beginFrame(0,0,0);assert.equal(patch.floor(0,0,0),null);const casts=patch.diagnostics.shapecasts;
 for(let i=0;i<100;i++)assert.equal(patch.floor(.1,.1,0),null);assert.equal(patch.diagnostics.shapecasts,casts);assert.equal(patch.diagnostics.overflows,1);
});
test('missing surfaces and out-of-height-window roofs never create support',()=>{
 const patch=new SaberTerrainPatch([surface(2),surface(-2)]);patch.beginFrame(0,0,0);assert.equal(patch.floor(0,0,0),null);
});

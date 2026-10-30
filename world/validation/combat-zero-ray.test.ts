import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {makeCombatTerrain} from '../src/combatTerrain';
import type {Layout} from '../src/types';
const layout={areas:[],markers:[],world:{waterLevel:-100}} as unknown as Layout;
test('zero-length combat LOS is visible without submitting a degenerate BVH ray',()=>{
 const bvh=new MeshBVH(new THREE.BoxGeometry(2,2,2));let queries=0;
 bvh.raycastFirst=()=>{queries++;throw new Error('no BVH query expected');};
 const geometry=makeCombatTerrain([{name:'box',enabled:true,bvh}],layout),p={x:0,y:0,z:0};
 assert.equal(geometry.terrain.lineOfSight(p,p),true,'even an interior point has no line segment');
 for(const direction of [{x:0,y:0,z:0},{x:NaN,y:0,z:1},{x:Infinity,y:0,z:0}])assert.equal(geometry.cast(p,direction),null);
 for(const max of [NaN,0,-1,-Infinity])assert.equal(geometry.cast(p,{x:1,y:0,z:0},max),null);
 assert.equal(geometry.cast({x:NaN,y:0,z:0},{x:1,y:0,z:0}),null);
 assert.equal(geometry.terrain.lineOfSight(p,{x:NaN,y:0,z:0}),false);
 assert.equal(queries,0);
});
test('normal combat LOS and cast preserve obstacle, range, endpoint tolerance and enabled behavior',()=>{
 const collider={name:'wall',enabled:true,bvh:new MeshBVH(new THREE.BoxGeometry(2,2,2).translate(0,1,4))};
 const geometry=makeCombatTerrain([collider],layout),from={x:0,y:1,z:0};
 assert.equal(geometry.terrain.lineOfSight(from,{x:0,y:1,z:6}),false);
 assert.equal(geometry.terrain.lineOfSight(from,{x:0,y:1,z:2}),true);
 assert.equal(geometry.terrain.lineOfSight(from,{x:0,y:1,z:3}),true,'existing .05 endpoint tolerance remains');
 assert.equal(geometry.cast(from,{x:0,y:0,z:2},3),null,'strict max remains');
 assert.ok(geometry.cast(from,{x:0,y:0,z:2},3.01));
 assert.ok(geometry.cast(from,{x:0,y:0,z:2}),'default infinite ray remains supported');
 collider.enabled=false;assert.equal(geometry.terrain.lineOfSight(from,{x:0,y:1,z:6}),true);
});
test('bounded combat casts pass exact far while preserving first-collider ties and infinite default',()=>{
 const colliders=['first','second'].map(name=>({name,enabled:true,bvh:new MeshBVH(new THREE.PlaneGeometry(4,4).translate(0,0,3))}));
 const fars:number[]=[];
 for(const c of colliders){const original=c.bvh.raycastFirst.bind(c.bvh);c.bvh.raycastFirst=(ray,side,near,far)=>{
  assert.equal(near,0);fars.push(far!);const hit=original(ray,side,near,far);if(hit)(hit as any).colliderTag=c.name;return hit;
 };}
 const geometry=makeCombatTerrain(colliders,layout),origin={x:0,y:0,z:0},direction={x:0,y:0,z:1};
 assert.equal(geometry.cast(origin,direction,3),null,'exact maximum is excluded even if BVH returns boundary hit');
 assert.equal((geometry.cast(origin,direction,3.000001) as any).colliderTag,'first');
 assert.equal((geometry.cast(origin,direction) as any).colliderTag,'first');
 assert.deepEqual(fars,[3,3,3.000001,3.000001,Infinity,Infinity]);
});

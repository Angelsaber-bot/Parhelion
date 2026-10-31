import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';import {MeshBVH} from 'three-mesh-bvh';
import {makeCombatTerrain} from '../src/combatTerrain';import type {Layout} from '../src/types';import type {Collider} from '../src/player';
const layout={world:{seed:1,waterLevel:-10},areas:[],markers:[]}as unknown as Layout;
function collider(name:string,size:number[],p:number[]):Collider{const geometry=new THREE.BoxGeometry(...size as [number,number,number]).translate(...p as [number,number,number]);return{name,enabled:true,bvh:new MeshBVH(geometry)};}
const point=(hit:any)=>hit?{distance:hit.distance,point:hit.point.toArray()}:null;
test('contact broadphase preserves thin/tall cover, overlapping roofs and ground ceilings; never excludes ray endpoints',()=>{
 const colliders=[collider('floor',[200,.2,200],[0,-.1,0]),collider('thin tall gate',[.015,12,3],[2,6,0]),collider('roof',[6,.1,6],[0,4,0]),collider('lower roof',[3,.1,3],[0,2,0]),collider('far',[1,1,1],[90,0,90])];
 const world=makeCombatTerrain(colliders,layout),bounds={minX:-5,maxX:5,minZ:-5,maxZ:5},local=world.contactSurface(bounds);assert.equal(local.colliderCount,4);
 for(const ceiling of [1.1,2.01,3,4.5,20])for(let x=-4;x<=4;x+=.5)for(let z=-4;z<=4;z+=1)assert.deepEqual(point(local.ground(x,z,ceiling)),point(world.ground(x,z,ceiling)));
 for(let i=0;i<200;i++){const from={x:-4,y:.3+(i%7),z:-4+(i%17)*.5},to={x:4,y:.2+(i%11)*.4,z:4-(i%19)*.4},d={x:to.x-from.x,y:to.y-from.y,z:to.z-from.z},length=Math.hypot(d.x,d.y,d.z);assert.deepEqual(point(local.cast(from,d,length)),point(world.cast(from,d,length)));}
 colliders.forEach(c=>c.bvh.geometry.dispose());
});
test('current enabled flags and fresh refitted bounds cannot leave stale gate/cover candidates',()=>{
 const gate=collider('gate',[.1,4,3],[20,2,0]),floor=collider('floor',[100,.2,100],[0,-.1,0]),colliders=[floor,gate],world=makeCombatTerrain(colliders,layout),bounds={minX:-3,maxX:3,minZ:-3,maxZ:3};
 assert.equal(world.contactSurface(bounds).colliderCount,1);gate.bvh.geometry.translate(-20,0,0);gate.bvh.refit();const local=world.contactSurface(bounds);assert.equal(local.colliderCount,2);
 const from={x:-2,y:1,z:0},direction={x:4,y:0,z:0};assert.deepEqual(point(local.cast(from,direction,4)),point(world.cast(from,direction,4)));assert.ok(local.cast(from,direction,4));
 gate.enabled=false;assert.equal(local.cast(from,direction,4),null);assert.equal(world.cast(from,direction,4),null);gate.enabled=true;assert.ok(local.cast(from,direction,4));
 gate.bvh.geometry.translate(20,0,0);gate.bvh.refit();assert.equal(world.contactSurface(bounds).colliderCount,1);colliders.forEach(c=>c.bvh.geometry.dispose());
});

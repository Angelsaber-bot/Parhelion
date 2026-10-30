import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {CompanionNavigation} from '../src/companionNavigation';
const collider=(geometry:THREE.BufferGeometry)=>({name:'query-fixture',enabled:true,bvh:new MeshBVH(geometry)});
test('companion finite queries prune distant collider BVHs without weakening local floor or body checks',()=>{
 const floor=collider(new THREE.PlaneGeometry(20,20).rotateX(-Math.PI/2));
 const remote=collider(new THREE.BoxGeometry(2,2,2).translate(100,1,100));
 let remoteQueries=0,localQueries=0;const original=floor.bvh.raycastFirst.bind(floor.bvh);
 floor.bvh.raycastFirst=(ray,side,near,far)=>{localQueries++;assert.equal(near,0);assert.ok(Number.isFinite(far)&&far!>0);return original(ray,side,near,far);};
 remote.bvh.raycastFirst=()=>{remoteQueries++;throw new Error('disjoint collider should be rejected before narrowphase');};
 const nav=new CompanionNavigation([floor,remote]);
 assert.equal(nav.floor(0,0,0),0);assert.equal(nav.path(new THREE.Vector3(),new THREE.Vector3(0,0,3)),true);
 assert.ok(localQueries>0);assert.equal(remoteQueries,0);
});
test('cached companion bounds preserve inside-box rays, live gate state and replacement BVH identity',()=>{
 const box=collider(new THREE.BoxGeometry(2,2,2).translate(0,1,4));const nav=new CompanionNavigation([box]);
 const from=new THREE.Vector3(0,1,4),to=new THREE.Vector3(0,1,6);
 assert.equal(nav.lineOfSight(from,to),false);
 box.enabled=false;assert.equal(nav.lineOfSight(from,to),true);
 box.enabled=true;assert.equal(nav.lineOfSight(from,to),false);
 box.bvh=new MeshBVH(new THREE.BoxGeometry(2,2,2).translate(100,1,4));assert.equal(nav.lineOfSight(from,to),true);
});
test('finite companion floor retains strict maximum distance and coplanar edge support',()=>{
 const floor=collider(new THREE.PlaneGeometry(20,20).rotateX(-Math.PI/2));const nav=new CompanionNavigation([floor]);
 assert.equal(nav.floor(10,0,0),0);
 assert.equal(nav.floor(0,0,.8),null,'hit exactly at 1.5 remains outside strict floor limit');
 assert.ok(Math.abs(nav.floor(0,0,.8-1e-8)!)<1e-10);
 assert.equal(nav.floor(10.001,0,0),null);
});

test('walking rejects a low unsupported ceiling above both horizontal body rays',()=>{
 const ground=collider(new THREE.PlaneGeometry(20,20).rotateX(-Math.PI/2));
 const ceiling=collider(new THREE.PlaneGeometry(4,4).rotateX(-Math.PI/2).translate(0,1.5,3));
 const nav=new CompanionNavigation([ground,ceiling]);
 assert.equal(nav.path(new THREE.Vector3(),new THREE.Vector3(0,0,3)),false);
 ceiling.enabled=false;
 assert.equal(nav.path(new THREE.Vector3(),new THREE.Vector3(0,0,3)),true);
 ceiling.enabled=true;
 assert.equal(nav.path(new THREE.Vector3(),new THREE.Vector3(0,0,3)),false,'cached bounds must not ignore reclosed overhead collider');
 ceiling.bvh=new MeshBVH(new THREE.PlaneGeometry(4,4).rotateX(-Math.PI/2).translate(0,2,3));
 assert.equal(nav.path(new THREE.Vector3(),new THREE.Vector3(0,0,3)),true,'adequate headroom remains traversable');
});

test('safe return uses checked centerline slots on a narrow bridge but rejects insufficient width or broken support',()=>{
 const bridge=(width:number,length=8,z=0)=>collider(new THREE.PlaneGeometry(width,length).rotateX(-Math.PI/2).translate(0,0,z));
 const player=new THREE.Vector3(),nav=new CompanionNavigation([bridge(1.2)]);
 const returned=nav.safeReturn(player,0);assert.ok(returned);assert.equal(returned.x,0);assert.equal(returned.z,-1.6,'behind has priority over ahead');
 assert.equal(new CompanionNavigation([bridge(.6)]).safeReturn(player,0),null,'center point alone is not enough foot support');
 assert.equal(new CompanionNavigation([bridge(1.2,.6),bridge(1.2,1,-2),bridge(1.2,1,2)]).safeReturn(player,0),null,'cannot rejoin across missing bridge floor');
 const broad=new CompanionNavigation([bridge(20,20)]).safeReturn(player,0);assert.ok(broad);assert.equal(broad.x,-2.4,'existing side slots keep priority');
});

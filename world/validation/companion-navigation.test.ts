import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as THREE from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {CompanionNavigation} from '../src/companionNavigation.ts';
const collider=(geometry:THREE.BufferGeometry,name='ground')=>({name,enabled:true,bvh:new MeshBVH(geometry)});
const floor=()=>collider(new THREE.PlaneGeometry(100,100).rotateX(-Math.PI/2));
test('walking steering goes around a finite wall without clipping, teleporting or increasing speed',()=>{
 const wall=collider(new THREE.BoxGeometry(6,3,.5).translate(0,1.5,4),'wall');
 const nav=new CompanionNavigation([floor(),wall]),root=new THREE.Group(),goal=new THREE.Vector3(0,0,10);
 let largest=0;
 for(let i=0;i<1200&&root.position.distanceTo(goal)>.3;i++){
  const before=root.position.clone();nav.step(root,goal,1/60,6);
  largest=Math.max(largest,root.position.distanceTo(before));
  assert.ok(Math.hypot(Math.max(0,Math.abs(root.position.x)-3),Math.max(0,Math.abs(root.position.z-4)-.25))>=.33,'body stays outside wall '+JSON.stringify(root.position));
  assert.ok(Number.isFinite(root.position.y));
 }
 assert.ok(root.position.distanceTo(goal)<.3,JSON.stringify(root.position));assert.ok(largest<=.100001);
});
test('a missing floor and a too-high step cannot be crossed by local steering or safe return',()=>{
 const near=collider(new THREE.PlaneGeometry(8,8).rotateX(-Math.PI/2));
 const nav=new CompanionNavigation([near]),root=new THREE.Group();
 for(let i=0;i<600;i++)nav.step(root,new THREE.Vector3(0,0,20),1/60,6);
 assert.ok(Math.abs(root.position.x)<=4&&Math.abs(root.position.z)<=4);
 assert.equal(nav.safeReturn(new THREE.Vector3(0,0,20),0),null);
 const step=collider(new THREE.BoxGeometry(10,3,10).translate(0,1.5,10));
 assert.equal(new CompanionNavigation([near,step]).path(new THREE.Vector3(0,0,3),new THREE.Vector3(0,3,8)),false);
});
test('safe rejoin anchors stay grounded, outside obstacles and on the player side of a wall',()=>{
 const wall=collider(new THREE.BoxGeometry(.3,3,12).translate(-1,1.5,0));
 const nav=new CompanionNavigation([floor(),wall]),player=new THREE.Vector3();
 const safe=nav.safeReturn(player,0);assert.ok(safe);assert.ok(safe.x>-.5);assert.ok(safe.distanceTo(player)<4);assert.ok(Math.abs(safe.y)<1e-7);
});
test('closing a gate after planning blocks the very next walk step',()=>{
 const gate=collider(new THREE.BoxGeometry(4,3,.2).translate(0,1.5,.55));gate.enabled=false;
 const nav=new CompanionNavigation([floor(),gate]),root=new THREE.Group(),goal=new THREE.Vector3(0,0,8);
 nav.step(root,goal,.05,6);gate.enabled=true;
 for(let i=0;i<60;i++)nav.step(root,goal,1/60,6);
 assert.ok(Math.hypot(Math.max(0,Math.abs(root.position.x)-2),Math.max(0,Math.abs(root.position.z-.55)-.1))>=.33,JSON.stringify(root.position));
});

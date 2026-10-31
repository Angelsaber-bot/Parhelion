import assert from 'node:assert/strict';import {test} from 'node:test';import * as THREE from 'three';import {MeshBVH} from 'three-mesh-bvh';
import {CompanionNavigation} from './fixtures/companion-navigation-pre-detour';import type {Collider} from '../src/player';
type DetourNavigation=Pick<CompanionNavigation,'step'|'path'|'floor'|'reset'|'stuckSeconds'>&{readonly detourDiagnostics:{rejectedDirections:number;maximumFailedDirections:number;active:number;cap:number;expiry:number;maxPlanCandidates:number}};
export function companionDetourContract(label:string,CompanionNavigationCandidate:new(colliders:Collider[])=>DetourNavigation){
const collider=(g:THREE.BufferGeometry,name='fixture')=>({name,enabled:true,bvh:new MeshBVH(g)});
const floor=()=>collider(new THREE.PlaneGeometry(100,100).rotateX(-Math.PI/2));
function beam(){const a=new THREE.Vector3(0,.06,0),b=new THREE.Vector3(1.8,3.36,0);return collider(new THREE.BoxGeometry(.13,a.distanceTo(b),.13).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize())).translate(...a.clone().add(b).multiplyScalar(.5).toArray()),'diagonal');}
function root(){const r=new THREE.Group();r.position.set(.3,0,-.065622);return r;}
for(const hz of[30,60,120])test(`${label} diagonal beam escape keeps every real path check and speed cap at ${hz}Hz`,()=>{
 const colliders=[floor(),beam()],old=new CompanionNavigation(colliders),nav=new CompanionNavigationCandidate(colliders),a=root(),b=root(),goal=new THREE.Vector3(4.3277,0,1.25665),dt=1/hz;
 let calls=0,maxCalls=0;const path=nav.path.bind(nav);nav.path=(from,to)=>{calls++;return path(from,to);};
 for(let i=0;i<10*hz;i++){calls=0;const before=b.position.clone();old.step(a,goal,dt,6);nav.step(b,goal,dt,6);maxCalls=Math.max(maxCalls,calls);assert.ok(b.position.distanceTo(before)<=6*dt+1e-6);if(b.position.distanceTo(before)>1e-7)assert.equal(path(before,b.position),true,'no rejected path bypass');}
 assert.ok(a.position.distanceTo(goal)>3,'baseline reproduces repeated short-step rejection');assert.ok(b.position.distanceTo(goal)<.26);assert.ok(nav.detourDiagnostics.rejectedDirections>0);assert.ok(nav.detourDiagnostics.maximumFailedDirections<=9);assert.ok(maxCalls<=10,'nine planning candidates plus one actual revalidation');assert.equal(nav.detourDiagnostics.active,0,'failure memories expire');
});
for(const fixture of['open','slope','door']as const)test(`${label} preserves unaffected ${fixture} trajectory exactly`,()=>{
 const ground=fixture==='slope'?collider(new THREE.PlaneGeometry(100,100).rotateX(-Math.PI/2).rotateZ(.1)):floor(),colliders=[ground];
 if(fixture==='door')for(const x of[-3.3,3.3])colliders.push(collider(new THREE.BoxGeometry(5,3,.3).translate(x,1.5,4)));
 const old=new CompanionNavigation(colliders),nav=new CompanionNavigationCandidate(colliders),a=new THREE.Group(),b=new THREE.Group();
 for(let i=0;i<1200;i++){const goal=new THREE.Vector3(fixture==='door'?0:Math.sin(i/130)*2,0,8);old.step(a,goal,1/120,6);nav.step(b,goal,1/120,6);assert.deepEqual(b.position.toArray(),a.position.toArray());assert.equal(b.rotation.y,a.rotation.y);assert.equal(nav.stuckSeconds,old.stuckSeconds);}
 assert.equal(nav.detourDiagnostics.rejectedDirections,0);
});
test(`${label} retains ledge and nonwalkable steep floor rejection`,()=>{
 const finite=collider(new THREE.PlaneGeometry(8,8).rotateX(-Math.PI/2)),nav=new CompanionNavigationCandidate([finite]),r=new THREE.Group();
 for(let i=0;i<1200;i++)nav.step(r,new THREE.Vector3(0,0,20),1/120,6);assert.ok(Math.abs(r.position.x)<=4&&Math.abs(r.position.z)<=4);
 const steep=collider(new THREE.PlaneGeometry(30,30).rotateX(-Math.PI/2).rotateZ(Math.PI/3)),s=new CompanionNavigationCandidate([steep]);assert.equal(s.floor(0,0,0),null);
});
test(`${label} bounded failed memory expires in a closed no-path enclosure and reset clears immediately`,()=>{
 const walls=[collider(new THREE.BoxGeometry(6,3,.2).translate(0,1.5,2)),collider(new THREE.BoxGeometry(6,3,.2).translate(0,1.5,-2)),collider(new THREE.BoxGeometry(.2,3,6).translate(2,1.5,0)),collider(new THREE.BoxGeometry(.2,3,6).translate(-2,1.5,0))];for(const wall of walls)wall.enabled=false;
 const nav=new CompanionNavigationCandidate([floor(),beam(),...walls]),r=root(),goal=new THREE.Vector3(4.3277,0,1.25665);
 for(let i=0;i<120&&!nav.detourDiagnostics.active;i++)nav.step(r,goal,1/120,6);assert.ok(nav.detourDiagnostics.active>0);
 // Tighten a physical enclosure only after the observed rejection. No actor/clock override.
 for(const wall of walls)wall.enabled=true;
 for(let i=0;i<600;i++){nav.step(r,goal,1/120,6);assert.ok(Math.abs(r.position.x)<1.91&&Math.abs(r.position.z)<1.91);assert.ok(nav.detourDiagnostics.active<=9);}
 // Stop at the current point while the old physical failure expires.
 for(let i=0;i<60;i++)nav.step(r,r.position.clone(),1/120,6);assert.equal(nav.detourDiagnostics.active,0);
 nav.reset();assert.equal(nav.detourDiagnostics.active,0);assert.equal(nav.stuckSeconds,0);
});
test(`${label} changing target after a real failure remains bounded and can reach the new clear goal`,()=>{
 const nav=new CompanionNavigationCandidate([floor(),beam()]),r=root(),goal=new THREE.Vector3(4.3277,0,1.25665);
 for(let i=0;i<120&&!nav.detourDiagnostics.active;i++)nav.step(r,goal,1/120,6);assert.ok(nav.detourDiagnostics.active>0);
 const changed=new THREE.Vector3(-3,0,-3);for(let i=0;i<1200;i++)nav.step(r,changed,1/120,6);assert.ok(r.position.distanceTo(changed)<.26);assert.equal(nav.detourDiagnostics.active,0);
});

}

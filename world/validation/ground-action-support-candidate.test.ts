import {test} from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';import {MeshBVH} from 'three-mesh-bvh';import {Player} from '../src/player';import {installGroundActionSupportCandidate} from './combat-review/ground-action-support-candidate';
const snapshot=(p:Player)=>({p:p.pos.toArray(),v:p.vel.toArray(),ground:p.onGround,swim:p.swimming,glide:p.gliding,updraft:p.inUpdraft});
for(const hz of[30,60,120])for(const water of[-10,2])test(`inactive-action candidate preserves ordinary state exactly at${hz}Hz/water${water}`,()=>{
 const geometry=new THREE.PlaneGeometry(200,200).rotateX(-Math.PI/2).rotateZ(.05),colliders=[{name:'slope',enabled:true,bvh:new MeshBVH(geometry)}],a=new Player(colliders,water),b=new Player(colliders,water),candidate=installGroundActionSupportCandidate(b,()=>false,'actions');
 try{a.teleport(0,.05,0);b.teleport(0,.05,0);for(let i=0;i<hz*8;i++){const input={x:Math.sin(i/hz),z:i>hz*6?0:1,jump:i===hz*2||i===hz*3,sprint:i>hz*4&&i<hz*5};a.step(1/hz,input);b.step(1/hz,input);assert.deepEqual(snapshot(b),snapshot(a));}assert.equal(candidate.diagnostics.supportPasses,0);}finally{candidate.dispose();geometry.dispose();}
});
test('active action does not gain airborne/jump admission and does not duplicate existing evade recovery',()=>{
 const geometry=new THREE.PlaneGeometry(100,100).rotateX(-Math.PI/2).rotateZ(.1),colliders=[{name:'slope',enabled:true,bvh:new MeshBVH(geometry)}],a=new Player(colliders,-10),b=new Player(colliders,-10),candidate=installGroundActionSupportCandidate(b,()=>true,'actions');
 try{a.teleport(0,2,0);b.teleport(0,2,0);for(let i=0;i<10;i++){const input={x:1,z:0,jump:false,sprint:false};a.step(1/120,input);b.step(1/120,input);assert.deepEqual(snapshot(b),snapshot(a));}assert.equal(candidate.diagnostics.supportPasses,0,'no prior ground');
  a.teleport(0,.02,0);b.teleport(0,.02,0);for(let i=0;i<120;i++){const input={x:0,z:0,jump:false,sprint:false};a.step(1/120,input);b.step(1/120,input);}assert.ok(a.onGround&&b.onGround);
  const before=candidate.diagnostics.supportPasses,jump={x:0,z:0,jump:true,sprint:false};a.step(1/120,jump);b.step(1/120,jump);assert.deepEqual(snapshot(b),snapshot(a));assert.equal(candidate.diagnostics.supportPasses,before);
  for(let i=0;i<180;i++){const input={x:0,z:0,jump:false,sprint:false};a.step(1/120,input);b.step(1/120,input);}assert.ok(a.onGround&&b.onGround);
  const initial=candidate.diagnostics.supportPasses;for(let i=0;i<28;i++){const input={x:0,z:0,jump:false,sprint:false,evade:{x:-1,z:0,strength:1}};a.step(1/120,input);b.step(1/120,input);assert.deepEqual(snapshot(b),snapshot(a));}assert.equal(candidate.diagnostics.supportPasses,initial,'accepted evade helper alone owns evade steps');
 }finally{candidate.dispose();geometry.dispose();}
});
test('candidate disposal restores method ownership and is repeat safe',()=>{
 const p=new Player([],-10),step=p.step;assert.equal(Object.hasOwn(p,'step'),false);const c=installGroundActionSupportCandidate(p,()=>false,'actions');assert.equal(Object.hasOwn(p,'step'),true);c.dispose();c.dispose();assert.equal(Object.hasOwn(p,'step'),false);assert.equal(p.step,step);assert.equal(Object.hasOwn(p,'collide'),false);
});

/** Candidate-only eligibility transitions; no production import/attachment. */
import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';import {MeshBVH}from'three-mesh-bvh';
import {Player}from'../../src/player';import {installGroundActionSupportCandidate}from'./ground-action-support-candidate';
test('admitted-action support stops immediately when ownership ends, and never follows teleport into air',()=>{
 const geometry=new THREE.PlaneGeometry(100,100).rotateX(-Math.PI/2).rotateZ(.05),colliders=[{name:'slope',enabled:true,bvh:new MeshBVH(geometry)}],p=new Player(colliders,-10);let active=true;
 const c=installGroundActionSupportCandidate(p,()=>active,'actions'),idle={x:0,z:0,jump:false,sprint:false},walk={...idle,x:-1};
 try{
  p.teleport(0,.05,0);for(let i=0;i<120;i++)p.step(1/120,idle);assert.ok(p.onGround);
  for(let i=0;i<60;i++)p.step(1/120,walk);assert.ok(c.diagnostics.recovered>0,'positive admitted-action recovery');
  active=false;const before=c.diagnostics.supportPasses;for(let i=0;i<180;i++)p.step(1/120,walk);assert.equal(c.diagnostics.supportPasses,before,'no residual support after action end');
  active=true;p.teleport(0,10,0);const airborne=c.diagnostics.supportPasses;for(let i=0;i<10;i++)p.step(1/120,walk);assert.equal(c.diagnostics.supportPasses,airborne,'old action cannot create an airborne foothold');assert.equal(p.onGround,false);
  p.teleport(0,.05,0);for(let i=0;i<120;i++)p.step(1/120,idle);assert.ok(p.onGround);const grounded=c.diagnostics.supportPasses;p.step(0,walk);assert.equal(c.diagnostics.supportPasses,grounded);p.step(1/120,{...walk,jump:true});assert.equal(c.diagnostics.supportPasses,grounded);assert.equal(p.onGround,false);
 }finally{c.dispose();geometry.dispose();}
});

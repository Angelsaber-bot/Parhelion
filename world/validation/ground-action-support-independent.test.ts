/** Historical admitted-only API transitions, preserved without weakening after general support approval. */
import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';import {MeshBVH}from'three-mesh-bvh';import {Player}from'./fixtures/player-pre-general-support';
for(const hz of[30,60,120])test(`historical admitted support ends immediately and cannot survive airborne relocation at ${hz}Hz`,()=>{
 const geometry=new THREE.PlaneGeometry(100,100).rotateX(-Math.PI/2).rotateZ(.05),colliders=[{name:'slope',enabled:true,bvh:new MeshBVH(geometry)}],p=new Player(colliders,-10),dt=1/hz,idle={x:0,z:0,jump:false,sprint:false},walk={...idle,x:-1};const diagnostics=()=>(p as any).evadeSupport.diagnostics;
 try{
  p.teleport(0,.05,0);for(let i=0;i<hz;i++)p.step(dt,idle);assert.ok(p.onGround);
  for(let i=0;i<hz;i++)p.step(dt,walk,true);if(hz===120)assert.ok(diagnostics().recovered>0,'positive explicit admitted-action recovery at production physics rate');else assert.ok(p.onGround,'coarser component steps retain ordinary contact without requiring recovery');
  const ended=diagnostics().supportPasses;for(let i=0;i<hz;i++)p.step(dt,walk,false);assert.equal(diagnostics().supportPasses,ended,'no residual probe after action end');
  p.teleport(0,10,0);const airborne=diagnostics().supportPasses;for(let i=0;i<Math.round(hz/12);i++)p.step(dt,walk,true);assert.equal(diagnostics().supportPasses,airborne);assert.equal(p.onGround,false);
  p.teleport(0,.05,0);for(let i=0;i<hz;i++)p.step(dt,idle);assert.ok(p.onGround);const grounded=diagnostics().supportPasses;p.step(0,walk,true);assert.equal(diagnostics().supportPasses,grounded);p.step(dt,{...walk,jump:true},true);assert.equal(diagnostics().supportPasses,grounded);assert.equal(p.onGround,false);
 }finally{geometry.dispose();}
});

import {Player as GeneralPlayer} from '../src/player';
for(const hz of[30,60,120])test(`live general support requires real prior ground at ${hz}Hz`,()=>{
 const geometry=new THREE.PlaneGeometry(100,100).rotateX(-Math.PI/2).rotateZ(.05),colliders=[{name:'slope',enabled:true,bvh:new MeshBVH(geometry)}],p=new GeneralPlayer(colliders,-10),dt=1/hz,idle={x:0,z:0,jump:false,sprint:false},walk={...idle,x:-1};const diagnostics=()=>(p as any).evadeSupport.diagnostics;
 try{
  p.teleport(0,.05,0);for(let i=0;i<hz;i++)p.step(dt,idle);assert.ok(p.onGround);
  for(let i=0;i<hz;i++)p.step(dt,walk);assert.ok(p.onGround);if(hz===120)assert.ok(diagnostics().recovered>0,'ordinary walking positively uses approved general support');
  p.teleport(0,10,0);const airborne=diagnostics().supportPasses;for(let i=0;i<Math.round(hz/12);i++)p.step(dt,walk);assert.equal(diagnostics().supportPasses,airborne);assert.equal(p.onGround,false);
  p.teleport(0,.05,0);for(let i=0;i<hz;i++)p.step(dt,idle);assert.ok(p.onGround);const grounded=diagnostics().supportPasses;p.step(0,walk);assert.equal(diagnostics().supportPasses,grounded);p.step(dt,{...walk,jump:true});assert.equal(diagnostics().supportPasses,grounded);assert.equal(p.onGround,false);
 }finally{geometry.dispose();}
});

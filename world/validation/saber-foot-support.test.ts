import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';import{SaberFootSupport,type SaberFootprint}from'../src/characters/saberFootSupport.ts';
const foot:SaberFootprint={halfWidth:.06,halfLength:.15,forwardOffset:.06,lateralOffset:0};
test('support cache fits actual planes and upper stair treads without root/body edits',()=>{
 const flat=new SaberFootSupport((x,z)=>.25*x+.2*z,[foot,foot]);let p=flat.read(0,2,3,1,1.2,0,true);assert.equal(p.valid,true);assert.equal(p.kind,'plane');assert.ok(p.normal.distanceTo(new THREE.Vector3(-.25,1,-.2).normalize())<1e-12);assert.ok(Math.abs(flat.heightAt(p,2.1,3.2)-(.25*2.1+.2*3.2))<1e-12);
 const step=new SaberFootSupport((_x,z)=>z>=0?.12:0,[foot,foot]);p=step.read(0,0,-.06,0,0,0,true);assert.equal(p.kind,'step');assert.equal(p.point.y,.12);assert.ok(p.normal.equals(new THREE.Vector3(0,1,0)));
});
test('ordinary flat running has contact-edge sampling, not terrain rays on every frame',()=>{
 const support=new SaberFootSupport(()=>0,[foot,foot]);let queries=0;const perFrame:number[]=[];let previous=[-1,-1];
 for(let frame=0;frame<600;frame++){support.advance(1/60);const t=frame/60,cycle=t*2.16;for(let side=0;side<2;side++){const phase=cycle+side*.5,landing=Math.floor(phase),changed=landing!==previous[side];previous[side]=landing;support.read(side,0,landing*5.5/2.16,0,0,0,changed);}const next=support.diagnostics.floorQueries;perFrame.push(next-queries);queries=next;}
 assert.ok(queries<300,`${queries} rays / 600 frames`);assert.ok(Math.max(...perFrame)<=10);assert.ok(perFrame.filter(n=>n===0).length>500);
});
test('meaningful target changes are budgeted; unsupported and revised height never fabricate support',()=>{
 let height:number|null=0;const support=new SaberFootSupport(()=>height,[foot,foot]);support.read(0,0,0,0,0,0,true);const old=support.diagnostics.floorQueries;
 for(let i=0;i<60;i++){support.advance(1/600);support.read(0,i,0,0,0,0);}assert.ok(support.diagnostics.floorQueries-old<=10,'moving request cannot issue fresh rays every render frame');
 height=null;let p=support.read(0,50,0,0,0,1);assert.equal(p.valid,false);assert.ok(Number.isNaN(support.heightAt(p,50,0)));const failed=support.diagnostics.floorQueries;support.read(0,50,0,0,0,1);assert.equal(support.diagnostics.floorQueries,failed);
 height=.18;p=support.read(0,50,0,0,0,2);assert.equal(p.valid,true);assert.equal(p.point.y,.18);const settled=support.diagnostics.floorQueries;support.read(0,50,0,0,0,2,true);assert.equal(support.diagnostics.floorQueries,settled,'zero-time pose query cannot duplicate contact sampling');
 const cliff=new SaberFootSupport((_x,z)=>z>0?.5:0,[foot,foot]);assert.equal(cliff.read(0,0,-.06,0,0,0,true).valid,false);
});

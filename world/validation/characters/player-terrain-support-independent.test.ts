/** Independent production support lifecycle; no-helper animator remains the explicit baseline. */
import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';import{MeshBVH}from'three-mesh-bvh';import{playerFixture}from'../player-fixture';import{SkinnedCharacterAnimator as Candidate}from'../../src/skinnedCharacter';import{PlayerTerrainSupport}from'../../src/playerTerrainSupport';
const state={speed:0,onGround:true,swimming:false,vy:0,moveYaw:0,armed:true};
function floor(height:number,slope:number){const g=new THREE.PlaneGeometry(20,20).rotateX(-Math.PI/2),p=g.attributes.position;for(let i=0;i<p.count;i++)p.setY(i,height+p.getX(i)*slope);p.needsUpdate=true;return{name:'independent-level',enabled:true,bvh:new MeshBVH(g)};}
const pose=(rig:Awaited<ReturnType<typeof playerFixture>>['rig'])=>Object.fromEntries(Object.entries(rig.bones).map(([name,bone])=>[name,[...bone.position.toArray(),...bone.quaternion.toArray(),...bone.scale.toArray()]]));
test('production support refreshes both feet after a sub-threshold vertical relocation and real air/land transition',async()=>{
 const a=await playerFixture(),b=await playerFixture(),floors=[floor(0,0),floor(1.2,.2)],sa=new PlayerTerrainSupport(a.rig,floors),sb=new PlayerTerrainSupport(b.rig,floors),aa=new Candidate(a.rig,sa),bb=new Candidate(b.rig,sb);
 try{b.rig.root.position.y=1.2;for(let i=0;i<180;i++){aa.update(1/60,state);bb.update(1/60,state);}assert.ok(sb.diagnostics.adjusted>0);a.rig.root.position.y=1.2;aa.update(1/60,{...state,onGround:false,vy:0});bb.update(1/60,{...state,onGround:false,vy:0});for(let i=0;i<30;i++){aa.update(1/60,state);bb.update(1/60,state);assert.deepEqual(pose(a.rig),pose(b.rig),`same native state/location must not retain a previous floor normal at frame ${i}`);}}
 finally{a.dispose();b.dispose();for(const c of floors)c.bvh.geometry.dispose();}
});
test('production support reset discards cached invalid support and matches a fresh same-clock actor',async()=>{
 const a=await playerFixture(),b=await playerFixture(),c=floor(0,.2),list=[c],sa=new PlayerTerrainSupport(a.rig,list),sb=new PlayerTerrainSupport(b.rig,[c]),aa=new Candidate(a.rig,sa),bb=new Candidate(b.rig,sb);
 try{for(let i=0;i<60;i++)aa.update(1/60,state);assert.ok(sa.diagnostics.adjusted>0);list.length=0;aa.update(1/60,state);list.push(c);aa.reset(true);bb.reset(true);for(let i=0;i<60;i++){aa.update(1/60,state);bb.update(1/60,state);assert.deepEqual(pose(a.rig),pose(b.rig));}assert.ok(sa.patch.diagnostics.refreshes>=3);}
 finally{a.dispose();b.dispose();c.bvh.geometry.dispose();}
});

test('production support observes collider enable, versioned refit and overflow recovery like explicitly cleared reference',async()=>{
 const a=await playerFixture(),b=await playerFixture(),c=floor(0,.25),list=[c],sa=new PlayerTerrainSupport(a.rig,list),sb=new PlayerTerrainSupport(b.rig,list),aa=new Candidate(a.rig,sa),bb=new Candidate(b.rig,sb);
 try{for(let i=0;i<90;i++){aa.update(1/60,state);bb.update(1/60,state);}assert.ok(sa.diagnostics.adjusted>0);
  for(const change of['disable','enable','refit','overflow','recover']as const){
   if(change==='disable')c.enabled=false;if(change==='enable')c.enabled=true;
   if(change==='refit'){const p=c.bvh.geometry.attributes.position;for(let i=0;i<p.count;i++)p.setY(i,p.getY(i)+.08);p.needsUpdate=true;c.bvh.refit();}
   if(change==='overflow')while(list.length<257)list.push(c);if(change==='recover')list.length=1;
   sb.patch.clear();sb.support.clear();const before=sa.diagnostics.adjusted;
   for(let i=0;i<12;i++){aa.update(1/60,state);bb.update(1/60,state);assert.deepEqual(pose(a.rig),pose(b.rig),`${change} frame ${i}`);}
   if(change==='disable'||change==='overflow')assert.equal(sa.diagnostics.adjusted,before,'unsupported must not apply cached corrections');else assert.ok(sa.diagnostics.adjusted>before,'supported revision must positively recover');
  }
 }finally{a.dispose();b.dispose();c.bvh.geometry.dispose();}
});

import{SkinnedCharacterAnimator as Accepted}from'../../src/skinnedCharacter';
test('production support leaves entire authored melee release tail unchanged, then resumes terrain ownership',async()=>{
 const a=await playerFixture(),b=await playerFixture(),c=floor(0,.2),support=new PlayerTerrainSupport(b.rig,[c]),old=new Accepted(a.rig),current=new Candidate(b.rig,support);
 try{for(let i=0;i<60;i++){old.update(1/60,state);current.update(1/60,state);}assert.ok(support.diagnostics.adjusted>0);
  const attack={...state,melee:{phase:.4,combo:1,yaw:.2}};for(let i=0;i<15;i++){old.update(1/60,attack);current.update(1/60,attack);assert.deepEqual(pose(a.rig),pose(b.rig));}
  const queries=support.patch.diagnostics.heightQueries;for(let i=0;i<10;i++){old.update(1/60,state);current.update(1/60,state);assert.deepEqual(pose(a.rig),pose(b.rig),`authored release frame ${i}`);assert.equal(support.patch.diagnostics.heightQueries,queries);}
  const before=support.diagnostics.adjusted;for(let i=0;i<20;i++){old.update(1/60,state);current.update(1/60,state);}assert.ok(support.diagnostics.adjusted>before,'terrain resumes only after native release ends');
 }finally{a.dispose();b.dispose();c.bvh.geometry.dispose();}
});

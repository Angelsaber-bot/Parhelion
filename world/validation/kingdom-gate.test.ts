import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { MeshBVH } from 'three-mesh-bvh';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { regionLoader, bakeQuantized } from '../src/rendering/glb';
import { KINGDOM_GATE as G, createKingdomGateRuntime, gateGuide, gatePoint } from '../src/story/kingdomGate';
import { createKingdomGateScene, gateEscortPosition } from '../src/environment/kingdomGateScene';
import { getEraStoryGuide, getEraBossRequirements } from '../src/story/eraStories';
import { WorldProgress, WORLD_PROGRESS_KEY } from '../src/core/progress';

function harness(flags:string[]=[]){
 const done=new Set(flags);let saves=0,damage=0,near=true,canceled=0;
 const runtime=createKingdomGateRuntime({done,save:()=>{saves++;return true;},changed(){},supply:()=>true,toast(){},reachable:()=>near,start:()=>({ok:true}),cancel(){canceled++;},encounter:()=>G.encounter,damage:()=>damage});
 const frame={dt:.05,held:false,playable:true,inRange:true,grounded:true,moving:false,attacking:false};
 return {done,runtime,frame,get saves(){return saves;},set damage(n:number){damage=n;},set near(n:boolean){near=n;},get canceled(){return canceled;}};
}
test('gate: early latch, winch, escort, repeat and save roundtrip keep separate facts',()=>{
 const h=harness();h.runtime.unlock();assert.equal(gateGuide(h.done)?.targetId,G.winch);
 h.runtime.interact(G.winch);h.runtime.update(h.frame,false,()=>true);
 for(let i=0;i<61;i++)h.runtime.update({...h.frame,held:true},false,()=>true);
 assert.ok(h.done.has(G.open));assert.ok(!h.done.has(G.rescued));assert.equal(gateGuide(h.done)?.targetId,G.service);
 for(let i=0;i<400;i++)h.runtime.update(h.frame,true,()=>true);
 assert.ok(h.done.has(G.rescued));assert.equal(h.saves,3);assert.equal(h.canceled,1);
 h.runtime.unlock();assert.equal(h.saves,3);
 const data=new Map<string,string>(),storage={getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v);}};
 const progress=new WorldProgress(storage);for(const f of h.done)progress.done.add(f);progress.save();
 assert.ok(data.has(WORLD_PROGRESS_KEY));const restored=new WorldProgress(storage),scene=createKingdomGateScene();scene.apply(restored.done);
 assert.equal(scene.collider.enabled,false);assert.equal(scene.latch.visible,false);assert.equal(gateGuide(restored.done),null);scene.dispose();
});
test('gate: damage, held input, blocked route, pause, distance and death cannot award rescue',()=>{
 const h=harness([G.unlocked]);h.runtime.interact(G.winch);
 for(let i=0;i<100;i++)h.runtime.update({...h.frame,held:true},true,()=>true);
 assert.ok(!h.done.has(G.open),'initial held input must release');
 h.runtime.update(h.frame,false,()=>true);
 for(let i=0;i<30;i++)h.runtime.update({...h.frame,held:true},true,()=>true);
 h.damage=1;h.runtime.update({...h.frame,held:true},true,()=>true);
 for(let i=0;i<70;i++)h.runtime.update({...h.frame,held:true},true,()=>true);
 assert.ok(!h.done.has(G.open));
 h.runtime.interrupt();h.done.add(G.open);
 for(let i=0;i<400;i++){h.runtime.update(h.frame,true,()=>false);h.runtime.update({...h.frame,playable:false},true,()=>true);h.runtime.update(h.frame,false,()=>true);}
 assert.equal(h.runtime.escort,0);assert.ok(!h.done.has(G.rescued));
 for(let i=0;i<100;i++)h.runtime.update(h.frame,true,()=>true);
 assert.ok(h.runtime.escort>0);h.runtime.reset();assert.equal(h.runtime.escort,0);assert.ok(h.done.has(G.open));
});
test('gate: chapter points to remaining action; old oath-hearth saves keep boss access',()=>{
 const done=new Set(['saber_contract']);assert.equal(getEraStoryGuide('britain',done)?.targetId,G.entry);
 done.add(G.unlocked);assert.equal(getEraStoryGuide('britain',done)?.targetId,G.winch);
 done.add(G.open);assert.equal(getEraStoryGuide('britain',done)?.targetId,G.service);
 done.add(G.rescued);assert.equal(getEraStoryGuide('britain',done)?.targetId,'hall_brazier_1');
 assert.deepEqual(getEraBossRequirements('sun_core',new Set(['saber_contract','hall_brazier_1'])),['saber_contract','hall_brazier_1']);
 const scene=createKingdomGateScene();
 for(const flags of [['hall_brazier_1'],['sun_core'],['saber_contract','shard_camp','shard_tower','shard_table']]){scene.apply(new Set(flags));assert.equal(scene.collider.enabled,false,'old progress is never physically re-gated');}
 scene.dispose();
});
const buffer=readFileSync(new URL('../public/assets/world_britain.glb',import.meta.url));
const gltf=await regionLoader().parseAsync(buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength),'');bakeQuantized(gltf.scene);gltf.scene.position.x=-720;gltf.scene.updateMatrixWorld(true);
const parts:THREE.BufferGeometry[]=[];
gltf.scene.getObjectByName('COLLISION')!.traverse(o=>{const m=o as THREE.Mesh;if(!m.isMesh||m.userData.dynamic)return;const g=new THREE.BufferGeometry().setAttribute('position',m.geometry.attributes.position.clone());if(m.geometry.index)g.setIndex(m.geometry.index.clone());g.applyMatrix4(m.matrixWorld);parts.push(g.index?g.toNonIndexed():g);});
const site=createKingdomGateScene();parts.push(...site.collisionGeometries);const bvh=new MeshBVH(mergeGeometries(parts));
test('gate: real Camelot floor and body clearance support entire resident passage',()=>{
 for(let i=0;i<=160;i++){
  const p=gateEscortPosition(i/160),floor=bvh.raycastFirst(new THREE.Ray(p.clone().add(new THREE.Vector3(0,2,0)),new THREE.Vector3(0,-1,0)),THREE.DoubleSide);
  assert.ok(floor&&Math.abs(floor.point.y-p.y)<.6,`floor at ${i}: ${floor?.point.y}`);
  if(i===160)continue;const next=gateEscortPosition((i+1)/160),d=next.clone().sub(p).normalize();
  for(const dx of[-.7,.7])assert.equal(bvh.raycastFirst(new THREE.Ray(p.clone().add(new THREE.Vector3(dx,1,0)),d),THREE.DoubleSide,0,p.distanceTo(next)+.35),null,`body at ${i}`);
 }
 const outside=new THREE.Vector3(...gatePoint(0,3,1)),inward=new THREE.Vector3(-Math.SQRT1_2,0,-Math.SQRT1_2);
 assert.ok(site.collider.bvh.raycastFirst(new THREE.Ray(outside,inward),THREE.DoubleSide,0,6),'closed gate blocks passage');
});

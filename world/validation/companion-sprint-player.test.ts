/** Actual Player capsule and delivered companion rigs on a controlled flat BVH runway.
 * Twenty seconds of legal sprint input and one 90-degree turn must stay close through
 * actual locomotion, without periodic regroup teleports. Not GPU/FPS or human-play acceptance.
 */
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshBVH} from 'three-mesh-bvh';
import {Player} from '../src/player/player.ts';
import {KitCompanion} from '../src/companions/kitCompanion.ts';
import {CharacterKit} from '../src/characters/characterKit.ts';
import {CHARACTER_KITS} from '../src/characters/catalog.ts';
import {ContractServant,SERVANT_MODELS,decodeServantModel} from '../src/companions/servant.ts';
import {FirstContract} from '../src/companions/contracts.ts';
import {readCharacter} from './characters/inspect.ts';
import {nodeImageMetadata} from './player-fixture.ts';
for(const identity of ['saber','blackbeard','musashi','napoleonMounted'] as const)test(`${identity}: real 9m/s sprint for20s with a right-angle turn remains bounded and returns safely`,async t=>{
 const geometry=new THREE.PlaneGeometry(500,500).rotateX(-Math.PI/2);
 const colliders=[{name:'runway',enabled:true,bvh:new MeshBVH(geometry)}],player=new Player(colliders,-10);
 player.teleport(0,.02,0);for(let i=0;i<30;i++)player.step(1/120,{x:0,z:0,jump:false,sprint:false});
 let rejoins=0,contacts=0,root:THREE.Group,update:(dt:number)=>void,dispose:()=>void;
 let gaitSpeed:()=>number|null=()=>null;
 if(identity==='saber') {
  nodeImageMetadata();const bytes=await readFile(fileURLToPath(SERVANT_MODELS.armor));
  const gltf=await new GLTFLoader().parseAsync(await decodeServantModel(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)),'');
  const actor=new ContractServant({scene:new THREE.Scene(),marker:{id:'saber_contract',type:'interact',label:'Saber',p:[0,0,0]},contract:new FirstContract(new Set(['saber_contract'])),colliders,load:async()=>gltf,target:()=>null,strike:()=>{contacts++;return null;},onRejoin:()=>rejoins++});
  await actor.ensureLoaded();root=actor.root;update=dt=>actor.update(dt,player.pos,player.yaw,true,false);dispose=()=>actor.dispose();
 } else {
  const {gltf}=await readCharacter(fileURLToPath(new URL(CHARACTER_KITS[identity].assetUrl)));
  const follow=new KitCompanion({colliders,range:identity==='blackbeard'?12:identity==='napoleonMounted'?4.5:3.5,damage:9,target:()=>null,strike:()=>{contacts++;return null;},onRejoin:()=>rejoins++});
  const actor=new CharacterKit(gltf,CHARACTER_KITS[identity],{onEvent:event=>follow.onEvent(actor,event)});
  gaitSpeed=()=>actor.state==='walk'||actor.state==='run'?actor.playbackRate*actor.definition.clips[actor.state].nominalSpeed!:null;
  root=actor.root;update=dt=>follow.update(actor,dt,player.pos,player.yaw,false);dispose=()=>{follow.release(actor);actor.dispose();};
 }
 try {
  update(1/60);let maximumGap=0,travel=0;
  for(let frame=0;frame<1200;frame++) {
   player.yaw=frame<600?0:Math.PI/2;
   const start=player.pos.clone();
   for(let sub=0;sub<2;sub++)player.step(1/120,{x:0,z:1,jump:false,sprint:true});
   travel+=player.pos.distanceTo(start);
   const previous=root.position.clone(),count=rejoins;update(1/60);
   const gap=root.position.distanceTo(player.pos);maximumGap=Math.max(maximumGap,gap);
   assert.ok(player.onGround&&!player.swimming&&!player.flying);
   assert.ok(root.position.toArray().every(Number.isFinite));
   if(rejoins===count)assert.ok(root.position.distanceTo(previous)<=11/60+.00001,'catch-up movement stays bounded');
   else {assert.ok(gap<4,'regroup finishes near the real player, never the enemy');assert.ok(Math.abs(root.position.y)<1e-7);}
   const authoredSpeed=gaitSpeed();
   if(authoredSpeed!==null&&rejoins===count)assert.ok(Math.abs(root.position.distanceTo(previous)*60-authoredSpeed)<1e-6,'catch-up animation matches the real displacement');
  }
  assert.ok(Math.abs(travel-180)<.05,`actual player traversed ${travel}m, not a slow synthetic proxy`);
  assert.ok(maximumGap<9,`maximum separation ${maximumGap}`);assert.equal(rejoins,0,'ordinary sprinting never needs a regroup teleport');
  for(let i=0;i<180;i++){player.step(1/120,{x:0,z:0,jump:false,sprint:false});player.step(1/120,{x:0,z:0,jump:false,sprint:false});update(1/60);}
  assert.ok(root.position.distanceTo(player.pos)<4);assert.equal(contacts,0);
  t.diagnostic(JSON.stringify({identity,playerMetres:travel,maximumGap,rejoins,settledGap:root.position.distanceTo(player.pos)}));
 } finally {dispose();geometry.dispose();}
});

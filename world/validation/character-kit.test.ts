import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gzipSync } from 'node:zlib';
import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CharacterKit, decodeCharacterAsset, loadCharacterKit, type CharacterKitDefinition, type KitEventResult } from '../src/characters/characterKit.ts';
function fixture(onEvent?: (event:KitEventResult)=>void) {
  const scene=new THREE.Group(),socket=new THREE.Object3D();socket.name='Muzzle';scene.add(socket);
  const geometry=new THREE.BoxGeometry(),texture=new THREE.Texture(),environment=new THREE.Texture(),material=new THREE.MeshStandardMaterial({map:texture});
  scene.add(new THREE.Mesh(geometry,material),new THREE.Mesh(geometry,material));
  const idle=new THREE.AnimationClip('Idle',1,[new THREE.VectorKeyframeTrack('Muzzle.position',[0,1],[0,0,0,0,0,0])]);
  const attack=new THREE.AnimationClip('Attack',1,[new THREE.VectorKeyframeTrack('Muzzle.position',[0,1],[0,0,0,10,0,0])]);
  const walk=new THREE.AnimationClip('Walk',1,[new THREE.VectorKeyframeTrack('Muzzle.position',[0,1],[0,0,0,0,0,0])]);
  const definition:CharacterKitDefinition={id:'test',assetUrl:'/local-only.glb',defaultState:'idle',rootMotion:'in-place',
    clips:{idle:{name:'Idle',duration:1,loop:true},walk:{name:'Walk',duration:1,loop:true,nominalSpeed:2},attack:{name:'Attack',duration:1,loop:false,events:[{at:.25,kind:'fire',socket:'muzzle'},{at:.75,kind:'hit',socket:'muzzle'}]}},
    sockets:{muzzle:{node:'Muzzle',forward:[0,0,1],up:[0,1,0]}}};
  const gltf={scene,animations:[idle,walk,attack]} as GLTF;
  const kit=new CharacterKit(gltf,definition,{onEvent,environment});
  return {kit,gltf,definition,geometry,material,texture,environment};
}
const tick=(kit:CharacterKit,count:number)=>{for(let i=0;i<count;i++)kit.update(.25);};
test('mapped one-shot events fire once at the authored pose, then return to Idle',()=>{
  const events:KitEventResult[]=[],f=fixture(e=>events.push(e));f.kit.root.position.x=100;f.kit.play('attack');
  tick(f.kit,8);assert.equal(events.length,2);assert.equal(events[0].kind,'fire');assert.equal(events[1].kind,'hit');
  assert.ok(Math.abs(events[0].transform!.position.x-102.5)<1e-5);assert.ok(Math.abs(events[1].transform!.position.x-107.5)<1e-5);
  assert.deepEqual(events[0].transform!.forward!.toArray(),[0,0,1]);assert.equal(f.kit.state,'idle');f.kit.dispose();
});
test('repeated requests do not restart an attack; explicit restart produces a new event sequence',()=>{
  let count=0;const f=fixture(()=>count++);f.kit.play('attack');f.kit.update(.25);f.kit.play('attack');f.kit.update(.25);assert.equal(count,1);
  f.kit.play('attack',{restart:true});f.kit.update(.25);assert.equal(count,2);f.kit.dispose();
});
test('pause and zero playback freeze clock; changing state cancels outstanding hits',()=>{
  let count=0;const f=fixture(()=>count++);f.kit.play('attack');f.kit.update(.1);f.kit.update(.25,true);assert.equal(f.kit.clipTime,.1);
  f.kit.play('attack',{rate:0});f.kit.update(.25);assert.equal(f.kit.clipTime,.1);
  f.kit.play('idle');tick(f.kit,8);assert.equal(count,0);f.kit.dispose();
});
test('gait rate uses declared speed and bounds invalid inputs without changing root position',()=>{
  const f=fixture();f.kit.play('walk',{speed:4});assert.equal(f.kit.playbackRate,2);f.kit.update(.25);assert.equal(f.kit.clipTime,.5);
  f.kit.play('walk',{speed:100});assert.equal(f.kit.playbackRate,3);f.kit.play('walk',{rate:NaN});assert.equal(f.kit.playbackRate,1);
  f.kit.update(NaN);f.kit.update(-1);assert.equal(f.kit.clipTime,.5);f.kit.update(1000);assert.equal(f.kit.clipTime,.75);
  assert.deepEqual(f.kit.root.position.toArray(),[0,0,0]);assert.equal(f.kit.play('not-a-state'),false);f.kit.dispose();
});
test('scaled Attack fires at scaled wall time while sampling its authored clip instant',()=>{
  const events:KitEventResult[]=[],f=fixture(e=>events.push(e));f.kit.play('attack',{rate:2});f.kit.update(.125);assert.equal(events.length,1);assert.equal(f.kit.clipTime,.25);assert.ok(Math.abs(events[0].transform!.position.x-2.5*(.125/.18))<1e-5, 'socket uses the actual crossfaded pose at the event instant');f.kit.dispose();
});
test('event callbacks can dispose or change state without leaking stale later events',()=>{
  for(const action of ['dispose','idle']){let calls=0;let f:ReturnType<typeof fixture>;f=fixture(()=>{calls++;action==='dispose'?f.kit.dispose():f.kit.play('idle');});f.kit.play('attack');tick(f.kit,8);assert.equal(calls,1);f.kit.dispose();}
});
test('resources dispose once while caller-owned environment stays alive; no resurrection',()=>{
  const f=fixture(),counts={g:0,m:0,t:0,e:0};f.geometry.addEventListener('dispose',()=>counts.g++);f.material.addEventListener('dispose',()=>counts.m++);f.texture.addEventListener('dispose',()=>counts.t++);f.environment.addEventListener('dispose',()=>counts.e++);
  const scene=new THREE.Scene();scene.add(f.kit.root);f.kit.dispose();f.kit.dispose();f.kit.update(.1);assert.equal(f.kit.play('attack'),false);assert.equal(f.kit.socketTransform('muzzle'),undefined);
  assert.deepEqual(counts,{g:1,m:1,t:1,e:0});assert.equal(scene.children.length,0);
});
test('invalid clips, sockets and looping hit events reject rather than silently playing the wrong clip',()=>{
  const f=fixture();f.kit.dispose();
  assert.throws(()=>new CharacterKit(f.gltf,{...f.definition,defaultState:'missing'}),/default/);
  assert.throws(()=>new CharacterKit(f.gltf,{...f.definition,sockets:{muzzle:{node:'wrong'}}}),/Missing/);
  assert.throws(()=>new CharacterKit(f.gltf,{...f.definition,clips:{...f.definition.clips,attack:{...f.definition.clips.attack,duration:2}}}),/Invalid character clip/);
  assert.throws(()=>new CharacterKit(f.gltf,{...f.definition,clips:{...f.definition.clips,attack:{...f.definition.clips.attack,loop:true}}}),/one-shot/);
});
test('transport is byte-exact for raw/already-decoded/gzip GLB and rejects corrupt headers',async()=>{
  const raw=new Uint8Array([0x67,0x6c,0x54,0x46,2,0,0,0,12,0,0,0]).buffer;assert.equal(await decodeCharacterAsset(raw),raw);
  const gzip=gzipSync(Buffer.from(raw));assert.deepEqual(Buffer.from(await decodeCharacterAsset(gzip.buffer.slice(gzip.byteOffset,gzip.byteOffset+gzip.byteLength))),Buffer.from(raw));
  await assert.rejects(decodeCharacterAsset(new Uint8Array([1,2,3]).buffer),/Truncated/);
  const invalid=raw.slice(0);new DataView(invalid).setUint32(8,999,true);await assert.rejects(decodeCharacterAsset(invalid),/Invalid/);
});
test('HTTP failure and abort do not create an actor or mutate gameplay state',async()=>{
  const f=fixture();f.kit.dispose();const original=globalThis.fetch;
  try{globalThis.fetch=async()=>new Response('failed',{status:503});await assert.rejects(loadCharacterKit(f.definition),/HTTP 503/);
    globalThis.fetch=async(_url,options)=>{options?.signal?.throwIfAborted();throw Error('unexpected fetch');};
    const controller=new AbortController();controller.abort();await assert.rejects(loadCharacterKit(f.definition,{signal:controller.signal}),/abort/i);
  }finally{globalThis.fetch=original;}
});

test('event callbacks can pause or change the current clip rate without corrupting its clock',()=>{
  let calls=0;let f:ReturnType<typeof fixture>;f=fixture(()=>{calls++;if(calls===1)f.kit.play('attack',{rate:0});});
  f.kit.play('attack',{rate:2});f.kit.update(.25);assert.equal(calls,1);assert.equal(f.kit.clipTime,.25);
  assert.ok(Number.isFinite(f.kit.mixer.time));f.kit.update(.25);assert.equal(f.kit.clipTime,.25);
  f.kit.play('attack',{rate:1});tick(f.kit,4);assert.equal(calls,2);assert.equal(f.kit.state,'idle');f.kit.dispose();
});

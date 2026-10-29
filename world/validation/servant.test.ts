import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshBVH } from 'three-mesh-bvh';
import { FirstContract } from '../src/contracts.ts';
import { ContractServant, SERVANT_MODELS, SERVANT_CLIPS } from '../src/servant.ts';
import { ServantAppearance, SERVANT_APPEARANCE_KEY } from '../src/servantAppearance.ts';
import { setLanguage } from '../../shared-client/i18n.ts';
const marker = { id: 'saber_contract', type: 'interact' as const, label: 'Saber', p: [10,0,0] as [number,number,number] };
function model() {
  const root = new THREE.Group();
  const geometry = new THREE.BoxGeometry(.5,1.7,.3).translate(0,.85,0);
  const texture = new THREE.DataTexture(new Uint8Array([255,255,255,255]),1,1);
  const material = new THREE.MeshStandardMaterial({map:texture});
  root.add(new THREE.Mesh(geometry,material));
  const disposed = { geometry:0,material:0,texture:0 };
  geometry.addEventListener('dispose',()=>disposed.geometry++);
  material.addEventListener('dispose',()=>disposed.material++);
  texture.addEventListener('dispose',()=>disposed.texture++);
  return { gltf: {scene:root,animations:SERVANT_CLIPS.map(name=>new THREE.AnimationClip(name,name==='Attack'?1.2:1,[]))} as GLTF, disposed };
}
function fixture(done = new Set<string>(), customLoad?: (url:string)=>Promise<GLTF>) {
  const scene = new THREE.Scene(), contract = new FirstContract(done), asset = model();
  let loads=0, targets=0, attacks=0, enemy: {id:string;position:THREE.Vector3}|null=null;
  const servant = new ContractServant({scene,marker,contract,colliders:[{name:'floor',enabled:true,bvh:new MeshBVH(new THREE.PlaneGeometry(200,200).rotateX(-Math.PI/2))}],
    load: async (url) => { loads++; return customLoad ? customLoad(url) : asset.gltf; },
    target:()=>{ targets++; return enemy; }, strike: (_p,id) => { assert.equal(id,'enemy'); attacks++; return enemy; }});
  return {scene,contract,servant,asset,loads:()=>loads,targets:()=>targets,attacks:()=>attacks,setEnemy:(on:boolean)=>{enemy=on?{id:'enemy',position:new THREE.Vector3(2,0,2)}:null;}};
}
function advance(f:ReturnType<typeof fixture>,seconds:number,p=new THREE.Vector3()) { for(let t=0;t<seconds-1e-8;t+=.05) f.servant.update(.05,p,0,true,false); }

test('appearance defaults to accepted armor; invalid/corrupt/denied storage cannot affect contract saves', () => {
  const data=new Map<string,string>();const storage={getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v);}};
  const preference=new ServantAppearance(storage);assert.equal(preference.outfit,'armor');
  assert.equal(preference.select('civilian'),true);assert.equal(new ServantAppearance(storage).outfit,'civilian');
  assert.equal(preference.select('../../untrusted.glb'),false);assert.equal(preference.outfit,'civilian');
  assert.equal(data.size,1);assert.ok(data.has(SERVANT_APPEARANCE_KEY));
  data.set(SERVANT_APPEARANCE_KEY,'{bad');assert.equal(new ServantAppearance(storage).outfit,'armor');
  const denied=new ServantAppearance({getItem(){throw Error('denied');},setItem(){throw Error('denied');}});
  assert.doesNotThrow(()=>denied.select('civilian'));assert.equal(denied.saved,false);assert.equal(denied.outfit,'civilian');
  assert.doesNotMatch(Object.values(SERVANT_MODELS).join(' '),/characters\/saber\//);
});
test('lake NPC lazy loads once, contract follows, recall hides, pause prevents target acquisition', async () => {
  const f=fixture();
  f.servant.update(.1,new THREE.Vector3(1000,0,0),0,true,false); assert.equal(f.loads(),0);
  f.servant.update(.1,new THREE.Vector3(10,0,0),0,true,false); await f.servant.ensureLoaded();
  assert.equal(f.loads(),1); assert.equal(f.servant.state,'ready'); assert.equal(f.servant.root.visible,true);
  f.contract.recruit(); f.servant.update(.1,new THREE.Vector3(),0,true,false);
  assert.ok(f.servant.root.position.distanceTo(new THREE.Vector3()) < 4); assert.equal(f.targets(),1);
  f.servant.update(.1,new THREE.Vector3(),0,true,true); assert.equal(f.targets(),1);
  f.contract.toggle(); f.servant.update(.1,new THREE.Vector3(),0,true,false); assert.equal(f.servant.root.visible,false);
  f.servant.dispose(); f.servant.dispose(); assert.equal(f.scene.children.length,0);
  assert.deepEqual(f.asset.disposed,{geometry:1,material:1,texture:1});
});
test('Idle/Walk/Run crossfades follow actual movement and teleport rematerializes without traversing walls', async () => {
  const f=fixture(new Set(['saber_contract']));await f.servant.ensureLoaded();
  f.servant.update(.05,new THREE.Vector3(),0,true,false);assert.equal(f.servant.animation,'Idle');
  // Turning/accelerating into a new follow direction is bounded, not a one-frame snap.
  advance(f,.25,new THREE.Vector3(.7,0,0));assert.equal(f.servant.animation,'Walk');
  advance(f,.15,new THREE.Vector3(7,0,0));assert.equal(f.servant.animation,'Run');
  advance(f,3,new THREE.Vector3(7,0,0));assert.equal(f.servant.animation,'Idle');
  f.servant.update(.05,new THREE.Vector3(500,0,0),0,true,false);
  assert.ok(f.servant.root.position.distanceTo(new THREE.Vector3(500,0,0))<4);
  f.servant.dispose();
});
test('Attack anticipates, contacts once at the clip phase, recovers fully and can replay', async () => {
  const f=fixture(new Set(['saber_contract']));await f.servant.ensureLoaded();f.setEnemy(true);
  advance(f,.4);assert.equal(f.servant.animation,'Attack');assert.equal(f.attacks(),0,'no damage during anticipation');
  advance(f,.3);assert.equal(f.attacks(),1);assert.equal(f.servant.animation,'Attack');
  f.setEnemy(false);advance(f,.7);assert.equal(f.attacks(),1);assert.equal(f.servant.animation,'Idle');
  f.setEnemy(true);advance(f,.7);assert.equal(f.attacks(),2);f.servant.dispose();
});
test('pause freezes the attack; recall, traversal suppression and quest reset cancel pending contact', async () => {
  for(const interruption of ['recall','flight','reset'] as const) {
    const done=new Set(['saber_contract']),f=fixture(done);await f.servant.ensureLoaded();f.setEnemy(true);
    advance(f,.2);f.servant.update(.1,new THREE.Vector3(),0,true,true);assert.equal(f.attacks(),0);
    if(interruption==='recall')f.contract.toggle();
    if(interruption==='reset'){done.clear();f.contract.reset();}
    f.servant.update(.1,new THREE.Vector3(),0,interruption!=='flight',false);
    assert.equal(f.servant.animation,'Idle');assert.equal(f.attacks(),0);f.servant.dispose();
  }
});
test('serialized outfit loading is latest-wins; stale candidates and old resources are disposed exactly once', async () => {
  const requests:{url:string;finish:(g:GLTF)=>void}[]=[];
  const f=fixture(new Set(['saber_contract']),url=>new Promise(r=>requests.push({url,finish:r})));
  const initial=f.servant.ensureLoaded();assert.equal(initial,f.servant.ensureLoaded());
  const first=model();requests[0].finish(first.gltf);await initial;
  const pending=f.servant.selectOutfit('civilian');f.servant.selectOutfit('armor');
  assert.equal(requests.length,2,'only one request in flight');
  const obsolete=model();requests[1].finish(obsolete.gltf);await pending;
  assert.equal(f.servant.activeOutfit,'armor');assert.equal(f.servant.root.children.length,1);
  assert.deepEqual(obsolete.disposed,{geometry:1,material:1,texture:1});assert.equal(first.disposed.geometry,0);
  const last=f.servant.selectOutfit('civilian'),second=model();requests[2].finish(second.gltf);await last;
  assert.equal(f.servant.activeOutfit,'civilian');assert.equal(f.servant.root.children.length,1);
  assert.deepEqual(first.disposed,{geometry:1,material:1,texture:1});
  assert.equal(f.contract.recruited,true);assert.equal(f.contract.summoned,true);
  f.servant.dispose();assert.deepEqual(second.disposed,{geometry:1,material:1,texture:1});
});
test('latest selection queues behind a stale initial load and late completion after disposal cannot resurrect it', async () => {
  const requests:((g:GLTF)=>void)[]=[];
  const f=fixture(new Set(['saber_contract']),()=>new Promise(r=>requests.push(r)));
  const pending=f.servant.ensureLoaded();f.servant.selectOutfit('civilian');assert.equal(requests.length,1);
  const old=model();requests[0](old.gltf);await new Promise(r=>setImmediate(r));
  assert.equal(requests.length,2);assert.equal(old.disposed.geometry,1);
  f.servant.dispose();const late=model();requests[1](late.gltf);await pending;
  assert.equal(f.scene.children.length,0);assert.equal(late.gltf.scene.parent,null);assert.equal(late.disposed.geometry,1);
  f.servant.update(.1,new THREE.Vector3(),0,true,false);assert.equal(requests.length,2);
});
test('bad outfit retains the last good model and recall state; no auto-retry loop; explicit retry recovers', async () => {
  let fail=true;const assets=[model(),model()];
  const f=fixture(new Set(['saber_contract']),async url=>{
    if(url===SERVANT_MODELS.civilian&&fail)throw Error('simulated 503');
    return url===SERVANT_MODELS.armor?assets[0].gltf:assets[1].gltf;
  });
  const warn=console.warn;console.warn=()=>{};
  try {
    await f.servant.ensureLoaded();f.contract.toggle();await f.servant.selectOutfit('civilian');
    assert.equal(f.servant.state,'failed');assert.equal(f.servant.activeOutfit,'armor');assert.equal(f.contract.summoned,false);
    advance(f,1);assert.equal(f.loads(),2);assert.equal(assets[0].disposed.geometry,0);
    setLanguage('en');assert.match(f.servant.status,/unavailable/);setLanguage('zh');assert.match(f.servant.status,/失败/);
    fail=false;await f.servant.retry();assert.equal(f.servant.activeOutfit,'civilian');assert.equal(f.servant.state,'ready');
    assert.equal(f.contract.summoned,false);assert.equal(assets[0].disposed.geometry,1);
  }finally{console.warn=warn;setLanguage('zh');f.servant.dispose();}
});
test('missing mandatory clips fail safely before replacing the accepted outfit', async () => {
  const first=model(),bad=model();bad.gltf.animations=bad.gltf.animations.filter(c=>c.name!=='Run');
  const f=fixture(new Set(['saber_contract']),async url=>url===SERVANT_MODELS.armor?first.gltf:bad.gltf);
  const warn=console.warn;console.warn=()=>{};
  try {await f.servant.ensureLoaded();await f.servant.selectOutfit('civilian');assert.equal(f.servant.state,'failed');assert.equal(f.servant.activeOutfit,'armor');assert.equal(bad.disposed.geometry,1);}
  finally{console.warn=warn;f.servant.dispose();}
});

test('lossless runtime transport accepts gzip or an already HTTP-decoded GLB and rejects corruption', async () => {
  const { gzipSync }=await import('node:zlib');
  const { decodeServantModel, loadServantGltf }=await import('../src/servant.ts');
  const raw=new Uint8Array([0x67,0x6c,0x54,0x46,2,0,0,0,12,0,0,0]).buffer;
  assert.equal(await decodeServantModel(raw),raw,'host already decoded Content-Encoding');
  const gzip=gzipSync(Buffer.from(raw));
  assert.deepEqual(Buffer.from(await decodeServantModel(gzip.buffer.slice(gzip.byteOffset,gzip.byteOffset+gzip.byteLength))),Buffer.from(raw));
  await assert.rejects(decodeServantModel(new Uint8Array([1,2,3,4]).buffer),/Invalid/);
  const invalid=gzipSync(Buffer.from('not-a-model'));
  await assert.rejects(decodeServantModel(invalid.buffer.slice(invalid.byteOffset,invalid.byteOffset+invalid.byteLength)),/not a GLB/);
  const original=globalThis.fetch;
  try {globalThis.fetch=async()=>new Response('unavailable',{status:503});await assert.rejects(loadServantGltf('/local-test-only'),/HTTP 503/);}
  finally{globalThis.fetch=original;}
});

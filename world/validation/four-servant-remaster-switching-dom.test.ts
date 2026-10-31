/** Independent remaster acceptance: actual main/GLBs, explicit legacy unlock fixture; no GPU. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {bootWorldWithoutGpu} from './world-dom-boot.fixture';
const ids=['saber','blackbeard','napoleon','musashi'];
const key='parhelion.world.progress.v2';
const done=['hq_terminal','armory_rack','summon_circle',...ids.map(id=>id+'_contract')];
const initial:Record<string,string>={[key]:JSON.stringify({done,found:[]})};
function resources(roots:any[]){const g=new Set<any>(),m=new Set<any>(),t=new Set<any>(),buffers=new Set<ArrayBufferLike>();let bones=0,skins=0,triangles=0;const signature=createHash('sha256');for(const root of roots)root.traverse((o:any)=>{if(o.isBone)bones++;if(o.isSkinnedMesh)skins++;if(o.isMesh){g.add(o.geometry);signature.update(o.name);for(const material of Array.isArray(o.material)?o.material:[o.material]){m.add(material);signature.update(JSON.stringify([material.name,material.type,material.color?.toArray(),material.roughness,material.metalness,material.side,material.map?.channel]));for(const v of Object.values(material))if((v as any)?.isTexture)t.add(v);}}});for(const geometry of g){triangles+=(geometry.index?.count??geometry.attributes.position?.count??0)/3;for(const [name,a]of Object.entries(geometry.attributes)as [string,any][]){const array=a.isInterleavedBufferAttribute?a.data.array:a.array;buffers.add(array.buffer);signature.update(name);signature.update(new Uint8Array(array.buffer,array.byteOffset,array.byteLength));}if(geometry.index){const a=geometry.index.array;buffers.add(a.buffer);signature.update(new Uint8Array(a.buffer,a.byteOffset,a.byteLength));}}return{geometries:g.size,materials:m.size,textures:t.size,bones,skins,triangles,backingBytes:[...buffers].reduce((n,b)=>n+b.byteLength,0),restGeometryAndMaterialSignature:signature.digest('hex')};}
test('four remastered native actors cycle, recall and reload without stale models or resource growth',async()=>{
 const h=await bootWorldWithoutGpu({worldRoot:process.env.WORLD_SOURCE_QA_ROOT,deterministic:true,initialStorage:initial});let saved:Record<string,string>={};
 try{
  const w=h.world,d=h.window.document;let now=0;const frame=(n=1)=>{for(let i=0;i<n;i++)h.frame(now+=1000/60);};
  const tap=(action:string)=>{const code=w.settings.bindingsFor(action)[0];assert.ok(code);for(const type of ['keydown','keyup'])d.body.dispatchEvent(new h.window.KeyboardEvent(type,{code,bubbles:true,cancelable:true}));};
  const roots=()=>[w.servant.root,...['blackbeard','napoleonMounted','musashi'].map(id=>w.scene.children.find((o:any)=>o.name===`CharacterKit:${id}`))].filter(Boolean);
  const rootFor=(id:string)=>id==='saber'?w.servant.root:w.scene.children.find((o:any)=>o.name===`CharacterKit:${id==='napoleon'?'napoleonMounted':id}`);
  (d.getElementById('start')as HTMLElement).click();await Promise.resolve();frame();await h.settleAssets();frame(120);assert.ok(w.player.onGround,'natural supported spawn');assert.deepEqual([...w.contract.roster],ids);
  async function check(id:string){frame();await h.settleAssets();frame(120);assert.equal(w.contract.selected,id);assert.ok(w.contract.companionSummoned);const root=rootFor(id);assert.ok(root?.visible,`${id} real actor visible`);const r=resources([root]);assert.ok(r.skins>0&&r.bones>5&&r.materials>0,`${id} positive native skin/material path`);assert.ok(root.position.distanceTo(w.player.pos)<18,`${id} follows near normal spawn`);assert.equal(roots().filter((o:any)=>o.visible&&o.position.distanceTo(w.player.pos)<30).length,1,'only selected actor follows');assert.equal(w.ultimateDirector.active,false);assert.equal(w.ultimateStage.isActive,false);assert.deepEqual([...w.done].sort(),[...done].sort());}
  for(const id of ids){if(w.contract.selected!==id)tap('switchServant');await check(id);}
  const warm=resources(roots());assert.equal(roots().length,4);console.log(JSON.stringify({scope:'NON-GPU actor-only attached resources after all four loaded',warm,actors:ids.map(id=>({id,...resources([rootFor(id)])}))}));
  for(let cycle=0;cycle<12;cycle++){tap('switchServant');await check(ids[(cycle+4)%4]);assert.deepEqual(resources(roots()),warm,'loaded actor resources plateau after all four warm');}
  // Race-style rapid real key events before asynchronous presentation settles.
  for(let i=0;i<9;i++)tap('switchServant');const selected=w.contract.selected;await check(selected);assert.deepEqual(resources(roots()),warm);
  tap('summon');frame(2);assert.equal(w.contract.companionSummoned,false);assert.equal(roots().filter((o:any)=>o.visible&&o.position.distanceTo(w.player.pos)<30).length,0);
  for(let i=0;i<h.window.localStorage.length;i++){const k=h.window.localStorage.key(i)!;saved[k]=h.window.localStorage.getItem(k)!;}
  assert.equal(JSON.parse(saved['parhelion.world.contract.v1']).servant,selected);assert.equal(JSON.parse(saved['parhelion.world.contract.v1']).summoned,false);const disposals=new Map<any,number>();for(const root of roots())root.traverse((o:any)=>{if(o.isMesh){disposals.set(o.geometry,0);for(const m of Array.isArray(o.material)?o.material:[o.material])disposals.set(m,0);}});assert.ok(disposals.size>20);for(const resource of disposals.keys())resource.addEventListener('dispose',()=>disposals.set(resource,disposals.get(resource)!+1));
  h.window.dispatchEvent(new h.window.PageTransitionEvent('pagehide',{persisted:true}));assert.ok([...disposals.values()].every(n=>n===0),'BFCache does not dispose actors');
  h.window.dispatchEvent(new h.window.PageTransitionEvent('pagehide',{persisted:false}));h.window.dispatchEvent(new h.window.PageTransitionEvent('pagehide',{persisted:false}));assert.ok([...disposals.values()].every(n=>n===1),'every attached native/remaster geometry and material disposed exactly once on final exit');
  console.log(JSON.stringify({disposedGeometryAndMaterialResources:disposals.size}));assert.deepEqual(h.errors,[]);assert.deepEqual(h.warnings,[]);
 }finally{await h.close();}
 const next=await bootWorldWithoutGpu({worldRoot:process.env.WORLD_SOURCE_QA_ROOT,deterministic:true,initialStorage:saved});try{assert.deepEqual([...next.world.contract.roster],ids);assert.equal(next.world.contract.selected,JSON.parse(saved['parhelion.world.contract.v1']).servant);assert.equal(next.world.contract.companionSummoned,false);assert.deepEqual([...next.world.done].sort(),[...done].sort());assert.deepEqual(next.errors,[]);}finally{await next.close();}
});

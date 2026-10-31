/** Bounded actual-main lifecycle stress; synthetic legacy save, no time-duration claim. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {bootWorldWithoutGpu} from '../world-dom-boot.fixture';
const require=createRequire(import.meta.url);
// Read-only listener census for this pinned JSDOM fixture, not browser heap accounting.
const {implForWrapper}=require('jsdom/lib/generated/idl/utils.js');
const worldRoot=resolve(process.argv[2]),out=process.argv[3];
const regions=['alpha','britain','blacksail','winter','kyoto'];
const progressKey='parhelion.world.progress.v2';
const initialDone=['hq_terminal','armory_rack','summon_circle','saber_contract','relay_a','relay_b','sun_core','sea_core','winter_core','fire_core'];
let storage:Record<string,string>={[progressKey]:JSON.stringify({done:initialDone,found:regions.map(r=>'travel_'+r)})};
let expectedReload:any=null;
const rows:any[]=[],baselines=new Map<string,any>();let error:unknown;
function census(w:any,d:Document,window:any){
 const geometries=new Set<any>(),materials=new Set<any>(),textures=new Set<any>();let nodes=0,meshes=0;
 w.scene.traverse((o:any)=>{nodes++;if(o.isMesh){meshes++;geometries.add(o.geometry);}if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);});
 for(const m of materials)for(const value of Object.values(m))if((value as any)?.isTexture)textures.add(value);
 let listeners=0;const listenerTypes:Record<string,number>={};
 for(const o of [window,d,...d.querySelectorAll('*')]){const list=implForWrapper(o)?._eventListeners;if(list)for(const [type,entries]of Object.entries(list)){listeners+=(entries as any[]).length;listenerTypes[type]=(listenerTypes[type]??0)+(entries as any[]).length;}}
 return{nodes,meshes,geometries:geometries.size,materials:materials.size,textures:textures.size,listeners,listenerTypes,domNodes:d.querySelectorAll('*').length,cue:w.combat.contactEffects.diagnostics};
}
for(let segment=0;segment<4&&!error;segment++){
 const h=await bootWorldWithoutGpu({worldRoot,deterministic:true,initialStorage:storage});const{world:w,window}=h,d=window.document;let now=0,toggles=0,teleports=0;
 const frame=(n=1)=>{for(let i=0;i<n;i++)h.frame(now+=1000/60);};
 const tap=(action:string)=>{const code=w.settings.bindingsFor(action)[0];assert.ok(code);for(const type of ['keydown','keyup'])d.body.dispatchEvent(new window.KeyboardEvent(type,{code,bubbles:true,cancelable:true}));};
 const start=async()=>{(d.getElementById('start')as HTMLElement).click();await Promise.resolve();frame();};
 const settle=()=>{for(let i=0;i<240&&!w.player.onGround;i++)frame();assert.ok(w.player.onGround,'real physics settles');};
 const originalToggle=w.contract.toggle.bind(w.contract);w.contract.toggle=(...args:any[])=>{toggles++;return originalToggle(...args);};
 const originalTeleport=w.player.teleport.bind(w.player);w.player.teleport=(...args:any[])=>{teleports++;return originalTeleport(...args);};
 async function travel(region:string){frame(360);settle();(d.getElementById('world-travel-open')as HTMLElement).click();const b=d.querySelector<HTMLButtonElement>(`[data-travel-id="travel_${region}"]`);assert.ok(b);assert.equal(b.disabled,false,`${region}: ${b.textContent}`);const count=teleports,hp=w.combat.state.hp;b.click();assert.equal(teleports,count+1,'one travel click causes one player teleport');assert.equal(w.combat.state.hp,hp,'travel cannot heal');assert.equal(w.travelPanel.open,false);await start();settle();await h.settleAssets();frame(120);}
 async function outfit(value:string){d.exitPointerLock();frame();(d.getElementById('servant-open')as HTMLElement).click();const dialog=d.getElementById('servant-settings')as HTMLDialogElement;assert.ok(dialog.open);const select=d.getElementById('servant-outfit')as HTMLSelectElement;
  const old=w.servant.presentationModel,disposals=new Map<any,number>();if(w.servant.appearance.outfit!==value){old.traverse((o:any)=>{if(o.isMesh){disposals.set(o.geometry,0);for(const m of Array.isArray(o.material)?o.material:[o.material])disposals.set(m,0);}});for(const resource of disposals.keys())resource.addEventListener('dispose',()=>disposals.set(resource,disposals.get(resource)!+1));}
  select.value=value;select.dispatchEvent(new window.Event('change',{bubbles:true}));await h.settleAssets();assert.equal(w.servant.appearance.outfit,value);if(disposals.size){assert.equal(old.parent,null);assert.ok([...disposals.values()].every(n=>n===1),'old native geometry/material disposed exactly once');}
  (dialog.querySelector('header button')as HTMLElement).click();await start();frame(120);return disposals.size;
 }
 try{
  if(expectedReload){assert.deepEqual([...w.done].sort(),expectedReload.done,'reload retains entire completed set');assert.deepEqual([...w.found].sort(),expectedReload.found,'reload retains entire discovered set');assert.equal(w.servant.appearance.outfit,expectedReload.outfit);assert.equal(w.contract.summoned,expectedReload.summoned);}
  for(const flag of initialDone)assert.ok(w.done.has(flag),'save/reload retains original progress');await start();await h.settleAssets();frame(120);settle();
  // Warm every measured location/outfit combination before comparing retained scene resources.
  for(const region of regions){await travel(region);for(const look of ['armor','civilian'])await outfit(look);}
  for(let local=0;local<5;local++){
   const cycle=segment*5+local,region=regions[local],look=cycle%2?'civilian':'armor';await travel(region);const disposed=await outfit(look);
   const hp=w.combat.state.hp,pos=w.player.pos.toArray(),actor=w.servant.root.position.toArray();d.exitPointerLock();frame();frame(90);assert.equal(w.combat.state.hp,hp);assert.deepEqual(w.player.pos.toArray(),pos);assert.deepEqual(w.servant.root.position.toArray(),actor);await start();
   const prior=w.contract.summoned,calls=toggles;tap('summon');frame();assert.equal(toggles,calls+1);assert.equal(w.contract.summoned,!prior);tap('summon');frame();assert.equal(toggles,calls+2);assert.equal(w.contract.summoned,prior);
   const energy=w.actions.skills.energy;tap('ultimate');frame();if(energy<100){assert.equal(w.actions.skills.energy,energy);assert.equal(w.actions.skills.casting,false,'insufficient-charge command cannot create a cast');}
   frame(180);await h.settleAssets();assert.equal(w.combat.defeated,false);assert.equal(w.narrative.open,false);assert.equal(w.campaignJournal.open,false);assert.equal(w.travelPanel.open,false);assert.equal(w.actions.skills.casting,false);assert.ok(w.player.onGround);
   const count=census(w,d,window),key=region+':'+look;assert.equal(count.cue.active,0);assert.equal(count.cue.slots,3);assert.equal(count.cue.bytes,55296);
   // Compare structural retained counts, not resource identities that legitimately change on outfit replacement.
   const stable={...count,cue:{active:count.cue.active,slots:count.cue.slots,bytes:count.cue.bytes}};
   if(baselines.has(key))assert.deepEqual(stable,baselines.get(key),`retention plateau ${key}`);else baselines.set(key,stable);
   for(const flag of initialDone)assert.ok(w.done.has(flag));rows.push({cycle,segment,region,look,disposed,energy,ultimate:'normal-input; insufficient-charge rejection unless naturally earned',hp:w.combat.state.hp,count:stable});console.log(JSON.stringify({cycle,segment,region,look,listeners:stable.listeners,nodes:stable.nodes,progress:[w.done.size,w.found.size]}));
  }
  storage={};for(let i=0;i<window.localStorage.length;i++){const key=window.localStorage.key(i)!;storage[key]=window.localStorage.getItem(key)!;}assert.ok(storage[progressKey]);expectedReload={done:[...w.done].sort(),found:[...w.found].sort(),outfit:w.servant.appearance.outfit,summoned:w.contract.summoned};const persisted=JSON.parse(storage[progressKey]);assert.deepEqual([...persisted.done].sort(),expectedReload.done);assert.deepEqual([...persisted.found].sort(),expectedReload.found);for(const flag of initialDone)assert.ok(persisted.done.includes(flag));assert.deepEqual(h.errors,[]);assert.deepEqual(h.warnings,[]);
 }catch(e){error=e;console.error(e);}finally{await h.close();}
}
writeFileSync(out,JSON.stringify({scope:'CPU actual main,20 measured cycles across4 boots plus explicit all-state warmup. Synthetic legacy progress/travel discoveries; normal UI/input/autosave/reload. No energy/HP/ground injection. Not hours of human play, GPU/native heap or exhaustive listener reachability.',worldRoot,measuredCycles:rows.length,rows,error:error?String(error):null},null,2));if(error)process.exitCode=1;else console.log(`PASS ${rows.length} measured cycles, ${baselines.size} state baselines`);

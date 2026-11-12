/** Production input/collision test with a non-GPU renderer and explicit preboot
 * regional handovers and a connected independent circuit. Synthetic kills isolate the finale's state authority. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {bootWorldWithoutGpu} from './world-dom-boot.fixture';
import {ADVENTURE as A} from '../src/story/openWorldCampaign';
import {WORLD_PROGRESS_KEY} from '../src/core/progress';
import {HARBOR_RELIEF as R,HARBOR_MEDICINE_LANE,HARBOR_MERCHANT_LANE} from '../src/story/harborRelief';
import {JOURNEY as J} from '../src/story/worldJourney';
import {VALLEY_PROLOGUE} from '../src/story/valleyPrologue';
test('adventure actual main: regional handovers lead to emitters, Warden, tower, and saved evacuation before the sky handover',async()=>{
 const flags=[A.started,A.online,'armory_rack','saber_contract','sun_core','sea_core','blackbeard_contract',A.departed,'winter_core','napoleon_contract',A.arrived,'fire_core','musashi_contract',A.evidence,J.egyptDone,J.orleansDone,J.qinDone,J.groundWatch];
 const h=await bootWorldWithoutGpu({deterministic:true,initialStorage:{[WORLD_PROGRESS_KEY]:JSON.stringify({done:flags,found:[]})}}),w=h.world,d=h.window.document;let now=0;
 const frame=(n=1)=>{for(let i=0;i<n;i++)h.frame(now+=1000/60);};
 const key=(held:boolean)=>d.body.dispatchEvent(new h.window.KeyboardEvent(held?'keydown':'keyup',{code:w.settings.bindingsFor('interact')[0],bubbles:true,cancelable:true}));
 const tap=()=>{key(true);key(false);};
 const place=(id:string)=>{const m=w.layout.markers.find((m:any)=>m.id===id)!;assert.ok(m,id);w.player.teleport(m.p[0],m.p[1]+.3,m.p[2]);frame(90);assert.ok(w.player.onGround,`standing at ${id}`);};
 const clear=()=>{for(const e of w.combat.state.enemies.filter((e:any)=>e.storyEncounter&&e.hp>0))w.combat.damageEnemy(e.id,10000,{source:'melee',origin:w.player.pos});frame();};
 const hold=()=>{frame();key(true);frame(190);key(false);frame();};
 try{
  (d.getElementById('start')as HTMLElement).click();await Promise.resolve();frame(2);await h.settleAssets();
  for(const id of A.emitters){
   place(id);tap();assert.ok(w.combat.storyEncounter?.id.startsWith('adventure_guard_'),d.getElementById('toast')?.textContent);
   // The production attack handler interrupts interaction before the last hit.
   // A victory must survive this, then re-engaging the panel must not respawn it.
   const attack=w.settings.bindingsFor('melee')[0];
   d.body.dispatchEvent(new h.window.KeyboardEvent('keydown',{code:attack,bubbles:true,cancelable:true}));
   d.body.dispatchEvent(new h.window.KeyboardEvent('keyup',{code:attack,bubbles:true,cancelable:true}));
   assert.equal(w.adventureRuntime.channel,null,'normal combat input cancels the hold');
   const encounter=w.combat.storyEncounter.id;clear();frame(90);
   assert.ok(w.done.has(`${encounter}_cleared`),'real combat victory survives attack interruption');
   assert.ok(JSON.parse(h.window.localStorage.getItem(WORLD_PROGRESS_KEY)!).done.includes(`${encounter}_cleared`),'guard victory is saved before panel completion');
   tap();assert.equal(w.combat.storyEncounter,null,'reopening the panel never replaces defeated guards');
   hold();assert.ok(w.done.has(id),`${id}: ${d.getElementById('toast')?.textContent}`);
  }
  place('adventure_guardian');tap();assert.equal(w.combat.storyEncounter?.id,'adventure_guardian');clear();assert.ok(w.done.has(A.guardian));
  place('adventure_tower');tap();hold();assert.ok(w.done.has(A.takeover),d.getElementById('toast')?.textContent);
  place('adventure_exit');tap();assert.ok(w.done.has(A.escaped));
  place('adventure_tomorrow');tap();assert.equal(w.done.has(A.ending),false);
  assert.match(d.getElementById('toast')?.textContent??'',/天穹观测冠/);
  const saved = JSON.parse(h.window.localStorage.getItem(WORLD_PROGRESS_KEY)!);
  assert.ok(saved.done.includes(A.escaped));assert.equal(saved.done.includes(A.ending),false);assert.equal(h.errors.length,0);
 }finally{await h.close();}
});
test('adventure actual main: harbor relief, side boarding, Admiral victory and merchant departure',async()=>{
 const flags=[A.started,A.online,'armory_rack','blackbeard_meet',VALLEY_PROLOGUE.room,VALLEY_PROLOGUE.record];
 const h=await bootWorldWithoutGpu({deterministic:true,initialStorage:{[WORLD_PROGRESS_KEY]:JSON.stringify({done:flags,found:[]})}}),w=h.world,d=h.window.document;let now=0;
 const frame=(n=1)=>{for(let i=0;i<n;i++)h.frame(now+=1000/60);};
 const key=(held:boolean)=>d.body.dispatchEvent(new h.window.KeyboardEvent(held?'keydown':'keyup',{code:w.settings.bindingsFor('interact')[0],bubbles:true,cancelable:true}));
 const tap=()=>{key(true);key(false);};
 const place=(id:string)=>{const m=w.layout.markers.find((m:any)=>m.id===id)!;w.player.teleport(m.p[0],m.p[1]+.3,m.p[2]);frame(90);assert.ok(w.player.onGround);};
 const hold=(id:string)=>{place(id);tap();frame();key(true);frame(200);key(false);frame();};
 try{
  (d.getElementById('start')as HTMLElement).click();await Promise.resolve();frame(2);
  for(const [lane,width,length] of [[HARBOR_MEDICINE_LANE,1.6,4.2],[HARBOR_MERCHANT_LANE,2.8,7.2]] as const){
   for(let z=lane.startZ-length;z<=lane.endZ+length;z+=2) for(const x of [lane.x-width,lane.x,lane.x+width]){
    const floor=w.combat.geometry.ground(x,z,6);
    assert.ok(!floor||floor.point.y<=w.layout.world.waterLevel+.12,`harbor navigation blocked at ${x},${z}: ${floor?.point.y}`);
   }
  }
  hold('adventure_harbor_rigging');assert.ok(w.done.has(A.harborSide),d.getElementById('toast')?.textContent);assert.equal(w.colliders.find((c:any)=>c.name==='COL_Ghost_Bridge').enabled,true);
  place(A.records);tap();assert.equal(w.adventureRuntime.channel,null,'the relief must be sent before taking the records');
  place(R.reserve);tap();assert.ok(w.done.has(R.reserve),d.getElementById('toast')?.textContent);
  place(R.lookout);tap();assert.ok(w.done.has(R.lookout),d.getElementById('toast')?.textContent);
  hold(R.crossing);assert.ok(w.done.has(R.crossing),d.getElementById('toast')?.textContent);
  place(R.launch);tap();assert.ok(w.done.has(R.launch),d.getElementById('toast')?.textContent);
  const relief=w.scene.getObjectByName('NassauReliefSkiff');assert.ok(relief?.visible);assert.equal(relief.position.x,HARBOR_MEDICINE_LANE.x);
  frame(320);assert.ok(w.done.has(R.underway));assert.ok(relief.position.z>HARBOR_MEDICINE_LANE.startZ+22);
  frame(320);assert.ok(w.done.has(R.delivered));assert.ok(w.scene.getObjectByName('ValleyDeliveredMedicine')?.visible);
  hold(A.records);assert.ok(w.done.has(A.records));assert.equal(w.combat.storyEncounter?.id,'adventure_harbor_alarm');assert.equal(w.combat.beginBoss('sea_core'),false);hold('adventure_harbor_alarm');assert.ok(w.done.has('adventure_harbor_alarm_disabled'));assert.equal(w.combat.storyEncounter,null);assert.equal(w.combat.beginBoss('sea_core'),true);w.combat.damageEnemy('boss_drowned_admiral',100000,{source:'melee',origin:w.player.pos});assert.ok(w.done.has('sea_core'));
  place('adventure_harbor_exit');tap();assert.ok(w.done.has(A.exited));place('adventure_harbor_depart');tap();assert.ok(w.done.has(A.sailing));assert.equal(w.done.has(A.departed),false);
  const initial=w.adventureSites.ship.position.z;assert.equal(initial,HARBOR_MERCHANT_LANE.startZ);frame(600);assert.ok(w.adventureSites.ship.position.z>initial+12);assert.equal(w.done.has(A.departed),false);
  frame(1250);assert.ok(w.done.has(A.departed));assert.equal(w.adventureSites.ship.position.z,HARBOR_MERCHANT_LANE.endZ);assert.ok(JSON.parse(h.window.localStorage.getItem(WORLD_PROGRESS_KEY)!).done.includes(A.departed));assert.equal(h.errors.length,0);
 }finally{await h.close();}
});

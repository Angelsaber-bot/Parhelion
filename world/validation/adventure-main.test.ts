/** Production input/collision test with a non-GPU renderer and explicit preboot
 * four-region evidence. Synthetic kills isolate the finale's state authority. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {bootWorldWithoutGpu} from './world-dom-boot.fixture';
import {ADVENTURE as A} from '../src/story/openWorldCampaign';
import {WORLD_PROGRESS_KEY} from '../src/core/progress';
test('adventure actual main: four-region evidence leads to emitters, Warden, tower, evacuation and saved ending',async()=>{
 const flags=[A.started,A.online,'armory_rack','saber_contract','sun_core','sea_core','blackbeard_contract',A.departed,'winter_core','napoleon_contract',A.arrived,'fire_core','musashi_contract',A.evidence];
 const h=await bootWorldWithoutGpu({deterministic:true,initialStorage:{[WORLD_PROGRESS_KEY]:JSON.stringify({done:flags,found:[]})}}),w=h.world,d=h.window.document;let now=0;
 const frame=(n=1)=>{for(let i=0;i<n;i++)h.frame(now+=1000/60);};
 const key=(held:boolean)=>d.body.dispatchEvent(new h.window.KeyboardEvent(held?'keydown':'keyup',{code:w.settings.bindingsFor('interact')[0],bubbles:true,cancelable:true}));
 const tap=()=>{key(true);key(false);};
 const place=(id:string)=>{const m=w.layout.markers.find((m:any)=>m.id===id)!;assert.ok(m,id);w.player.teleport(m.p[0],m.p[1]+.3,m.p[2]);frame(90);assert.ok(w.player.onGround,`standing at ${id}`);};
 const clear=()=>{for(const e of w.combat.state.enemies.filter((e:any)=>e.storyEncounter&&e.hp>0))w.combat.damageEnemy(e.id,10000,{source:'melee',origin:w.player.pos});frame();};
 const hold=()=>{frame();key(true);frame(190);key(false);frame();};
 try{
  (d.getElementById('start')as HTMLElement).click();await Promise.resolve();frame(2);await h.settleAssets();
  for(const id of A.emitters){place(id);tap();assert.ok(w.combat.storyEncounter?.id.startsWith('adventure_guard_'),d.getElementById('toast')?.textContent);clear();hold();assert.ok(w.done.has(id),`${id}: ${d.getElementById('toast')?.textContent}`);}
  place('adventure_guardian');tap();assert.equal(w.combat.storyEncounter?.id,'adventure_guardian');clear();assert.ok(w.done.has(A.guardian));
  place('adventure_tower');tap();hold();assert.ok(w.done.has(A.takeover),d.getElementById('toast')?.textContent);
  place('adventure_exit');tap();assert.ok(w.done.has(A.escaped));place('adventure_tomorrow');tap();assert.ok(w.done.has(A.ending),d.getElementById('toast')?.textContent);
  assert.ok(JSON.parse(h.window.localStorage.getItem(WORLD_PROGRESS_KEY)!).done.includes(A.ending));assert.equal(h.errors.length,0);
 }finally{await h.close();}
});
test('adventure actual main: side boarding, recover records, defeat Admiral, disembark then wait for actual departure',async()=>{
 const flags=[A.started,A.online,'armory_rack','blackbeard_meet'];
 const h=await bootWorldWithoutGpu({deterministic:true,initialStorage:{[WORLD_PROGRESS_KEY]:JSON.stringify({done:flags,found:[]})}}),w=h.world,d=h.window.document;let now=0;
 const frame=(n=1)=>{for(let i=0;i<n;i++)h.frame(now+=1000/60);};
 const key=(held:boolean)=>d.body.dispatchEvent(new h.window.KeyboardEvent(held?'keydown':'keyup',{code:w.settings.bindingsFor('interact')[0],bubbles:true,cancelable:true}));
 const tap=()=>{key(true);key(false);};
 const place=(id:string)=>{const m=w.layout.markers.find((m:any)=>m.id===id)!;w.player.teleport(m.p[0],m.p[1]+.3,m.p[2]);frame(90);assert.ok(w.player.onGround);};
 const hold=(id:string)=>{place(id);tap();frame();key(true);frame(200);key(false);frame();};
 try{
  (d.getElementById('start')as HTMLElement).click();await Promise.resolve();frame(2);
  hold('adventure_harbor_rigging');assert.ok(w.done.has(A.harborSide),d.getElementById('toast')?.textContent);assert.equal(w.colliders.find((c:any)=>c.name==='COL_Ghost_Bridge').enabled,true);
  hold(A.records);assert.ok(w.done.has(A.records));assert.equal(w.combat.storyEncounter?.id,'adventure_harbor_alarm');assert.equal(w.combat.beginBoss('sea_core'),false);hold('adventure_harbor_alarm');assert.ok(w.done.has('adventure_harbor_alarm_disabled'));assert.equal(w.combat.storyEncounter,null);assert.equal(w.combat.beginBoss('sea_core'),true);w.combat.damageEnemy('boss_drowned_admiral',100000,{source:'melee',origin:w.player.pos});assert.ok(w.done.has('sea_core'));
  place('adventure_harbor_exit');tap();assert.ok(w.done.has(A.exited));place('adventure_harbor_depart');tap();assert.ok(w.done.has(A.sailing));assert.equal(w.done.has(A.departed),false);
  const initial=w.adventureSites.ship.position.z;frame(600);assert.ok(w.adventureSites.ship.position.z>initial+40);assert.equal(w.done.has(A.departed),false);
  frame(1250);assert.ok(w.done.has(A.departed));assert.ok(w.adventureSites.ship.position.z>=309);assert.ok(JSON.parse(h.window.localStorage.getItem(WORLD_PROGRESS_KEY)!).done.includes(A.departed));assert.equal(h.errors.length,0);
 }finally{await h.close();}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {bootWorldWithoutGpu} from './world-dom-boot.fixture';
import {WORLD_PROGRESS_KEY} from '../src/core/progress';
import {EGYPT_CAMPAIGN as E} from '../src/story/egyptCampaign';
import {QIN_CAMPAIGN as Q} from '../src/story/qinCampaign';
import {ORLEANS_CAMPAIGN as O} from '../src/story/orleansCampaign';

test('new chapter actions route through production input, actual encounters, autonomous work and persistent saves',async()=>{
 const seed=['armory_rack','adventure_started','adventure_online','journey_egypt_weir','journey_qin_workers','journey_orleans_muster','egypt_water_plan_westBridge'];
 const h=await bootWorldWithoutGpu({deterministic:true,bootTimeoutMs:120000,initialStorage:{[WORLD_PROGRESS_KEY]:JSON.stringify({done:seed,found:[]})}});
 const w=h.world,d=h.window.document;let time=0;
 const frame=(n=1)=>{for(let i=0;i<n;i++)h.frame(time+=1000/60);};
 const tap=()=>{for(const type of ['keydown','keyup'])d.body.dispatchEvent(new h.window.KeyboardEvent(type,{code:w.settings.bindingsFor('interact')[0],bubbles:true,cancelable:true}));};
 const go=(id:string)=>{const m=w.layout.markers.find((m:{id:string})=>m.id===id);assert.ok(m,id);const floor=w.combat.geometry.ground(m.p[0],m.p[2],m.p[1]+.5);assert.ok(floor,id);w.player.teleport(floor.point.x,floor.point.y+.12,floor.point.z);frame(20);};
 const act=(id:string)=>{go(id);tap();if(w.narrative.choosing){const b=d.querySelector<HTMLButtonElement>(`[data-choice="${id}"]`);assert.ok(b,`${id}: ${d.getElementById('world-dialogue')?.textContent}`);b.click();}return id;};
 const earn=(id:string)=>{act(id);assert.ok(w.done.has(id),`${id}: ${d.getElementById('prompt')?.textContent} | ${d.getElementById('objective')?.textContent}`);};
 const win=(id:string)=>{act(id);const active=w.combat.storyEncounter;assert.ok(active,`${id}: encounter did not start`);for(const e of w.combat.state.enemies.filter((e:{storyEncounter?:string})=>e.storyEncounter===active.id)){for(let i=0;i<40&&e.hp>0;i++)w.combat.damageEnemy(e.id,100);}frame(10);assert.ok(w.done.has(id),id);};
 try{
  (d.getElementById('start') as HTMLElement).click();await Promise.resolve();frame(3);
  earn(E.started);win(E.limb);win(E.temple);earn(E.bed);earn(E.relocated);
  for(const id of [E.trial,E.side,E.forebay,E.bypass,E.brake,E.bell])earn(id);
  assert.ok(w.done.has(E.ready));
  // The actual three-phase climax is covered by world-journey.test.ts.
  w.done.add('realm_egypt_phase_3');for(const id of [E.drained,E.moored,E.meal])earn(id);assert.ok(w.done.has(E.complete));
  earn(Q.started);earn(Q.guard);earn(Q.take);assert.ok(!w.done.has(Q.guard));earn(Q.locked);
  for(const id of [Q.observe,Q.halt,Q.loan,Q.road])earn(id);
  frame(2800);earn(Q.returned);assert.ok(w.done.has(Q.complete));
  earn(O.started);earn(O.relay);win(O.scout);frame(800);earn(O.lookout);earn(O.stitch);earn(O.bars);
  for(const id of [O.boat,O.builder,O.archer,O.test,O.inspect])earn(id);
  win(O.flank);for(const id of [O.retreat,O.cover,O.camp,O.agree,O.screen])earn(id);
  frame(1800);earn(O.model);earn(O.bridge);earn(O.locked);frame(800);earn(O.trial);assert.ok(w.done.has(O.complete));
  const stored=JSON.parse(h.window.localStorage.getItem(WORLD_PROGRESS_KEY)!);
  for(const flag of [E.ready,Q.complete,O.complete])assert.ok(stored.done.includes(flag),flag);
 }finally{await h.close();}
});

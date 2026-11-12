import test from 'node:test';
import assert from 'node:assert/strict';
import {ADVENTURE as A,getAdventureGuide,getCurrentAdventureGuide,adventureTravelOpen,harborBridgeReady,winterRouteReady,adventureChapterComplete} from '../src/story/openWorldCampaign';
import {createAdventureRuntime} from '../src/story/adventureRuntime';
import {ADVENTURE_ACTIONS} from '../src/story/adventureSites';
import {getEraBossRequirements,getEraPieceRequirements} from '../src/story/eraStories';
import {RelayChannel} from '../src/story/relayChannel';
import {HARBOR_RELIEF as R,harborReliefReady} from '../src/story/harborRelief';
import {VALLEY_PROLOGUE} from '../src/story/valleyPrologue';
function setup(flags:string[]=[]){const done=new Set([A.started,'armory_rack',...flags]),actions=new Map(ADVENTURE_ACTIONS.map(a=>[a.id,a]));let saves=0,starts=0,damage=0,near=true,encounter:string|null=null;
 const runtime=createAdventureRuntime({done,actions,path:[[0,0,0],[2,0,0],[4,0,0]],reachable:()=>near,save:()=>{saves++;return true;},changed(){},toast(){},damage:()=>damage,supply:()=>true,encounter:()=>encounter,start:spec=>{starts++;encounter=spec.id;return{ok:true};},cancel(){encounter=null;},moveCart:()=>true});
 const frame={dt:1/60,held:false,playable:true,inRange:true,grounded:true,moving:false,attacking:false};
 const hold=(id:string)=>{runtime.interact(id);runtime.update(frame);for(let n=0;n<200;n++)runtime.update({...frame,held:true});runtime.update(frame);};
 return{done,runtime,frame,hold,get saves(){return saves;},get starts(){return starts;},set encounter(id:string|null){encounter=id;},set damage(n:number){damage=n;},set near(b:boolean){near=b;}};
}
const finaleFlags=['sun_core','sea_core','blackbeard_contract',A.departed,'winter_core','napoleon_contract',A.arrived,'musashi_contract',A.evidence];
test('adventure: defeated emitter guards stay cleared through attacking, interruption, reset and reload',()=>{
 const h=setup(finaleFlags),id=A.emitters[0],encounter='adventure_guard_1';
 assert.equal(h.runtime.victory(encounter),false,'a victory without an admitted encounter cannot grant progress');
 h.runtime.interact(id);assert.equal(h.starts,1);h.runtime.interrupt();
 h.encounter=null;assert.equal(h.runtime.victory(encounter),true);
 assert.ok(h.done.has(`${encounter}_cleared`));assert.equal(h.done.has(id),false,'clearing guards does not silently shut down the panel');
 h.runtime.reset();h.runtime.interact(id);assert.equal(h.starts,1,'reset retains the saved clear');
 h.runtime.interrupt();h.hold(id);assert.ok(h.done.has(id));assert.equal(h.starts,1);
 const reload=setup([...finaleFlags,`${encounter}_cleared`]);reload.hold(id);
 assert.ok(reload.done.has(id));assert.equal(reload.starts,0,'a saved clear can finish after reload without another encounter');
 reload.runtime.interact(A.emitters[1]);assert.equal(reload.starts,1,'clearing one emitter does not clear the next');
});
test('adventure: unfinished emitter battles retry normally without granting a guard clear',()=>{
 const h=setup(finaleFlags),id=A.emitters[0];h.runtime.interact(id);h.runtime.interrupt();
 h.encounter=null;h.runtime.reset();h.runtime.interact(id);
 assert.equal(h.starts,2);assert.equal(h.done.has('adventure_guard_1_cleared'),false);
});
test('adventure: minimum uplink opens travel without forging old tower/seam/summon facts',()=>{
 const h=setup();assert.equal(adventureTravelOpen(h.done),false);h.done.add(A.online);assert.ok(adventureTravelOpen(h.done));
 assert.equal(getAdventureGuide('alpha',h.done)?.targetId,'saber_contract');for(const old of ['tower_console','summon_circle','relay_a','relay_b'])assert.equal(h.done.has(old),false);
});
test('adventure: harbor accepts both preparations, records before or after boss and requires true disembarkation',()=>{
 const h=setup(['blackbeard_meet']);assert.equal(harborBridgeReady(h.done),false);h.hold('adventure_harbor_rigging');assert.ok(harborBridgeReady(h.done));assert.deepEqual(getEraPieceRequirements('Ghost_Bridge',h.done),[]);
 h.runtime.interact('adventure_harbor_depart');assert.equal(h.done.has(A.departed),false);
 h.done.add('sea_core');assert.equal(getAdventureGuide('blacksail',h.done)?.targetId,A.records);h.hold(A.records);assert.equal(getAdventureGuide('blacksail',h.done)?.targetId,'adventure_harbor_exit');
 h.runtime.interact('adventure_harbor_exit');h.runtime.interact('adventure_harbor_depart');assert.equal(h.done.has(A.departed),false);for(let i=0;i<1801;i++)h.runtime.update(h.frame);assert.ok(h.done.has(A.departed));h.done.add('blackbeard_contract');assert.ok(adventureChapterComplete('blacksail',h.done));
 const before=h.saves;h.runtime.interact('adventure_harbor_depart');assert.equal(h.saves,before);
 const cannon=setup(['blackbeard_meet','fort_cannon','ghost_boat_1','ghost_boat_2','ghost_boat_3']);assert.ok(harborBridgeReady(cannon.done));assert.equal(cannon.done.has(A.harborSide),false);
});
test('harbor relief needs the two pier actions and resumes from the saved mid-channel checkpoint', () => {
 const h=setup(['blackbeard_meet',A.harborSide,VALLEY_PROLOGUE.room]);
 assert.equal(getAdventureGuide('blacksail',h.done)?.targetId,R.reserve);
 h.runtime.interact(R.launch);assert.equal(h.done.has(R.launch),false);
 h.runtime.interact(R.reserve);h.runtime.interact(R.lookout);
 h.runtime.interact(R.launch);assert.equal(h.done.has(R.launch),false);
 h.hold(R.crossing);h.runtime.interact(R.launch);
 for(let i=0;i<310;i++) h.runtime.update(h.frame);
 assert.ok(h.done.has(R.underway));assert.equal(h.done.has(R.delivered),false);
 const restored=setup([...h.done]);assert.equal(restored.runtime.reliefProgress,.5);
 for(let i=0;i<310;i++) restored.runtime.update({...restored.frame,playable:false});
 assert.equal(restored.runtime.reliefProgress,.5);
 for(let i=0;i<310;i++) restored.runtime.update(restored.frame);
 assert.ok(harborReliefReady(restored.done));assert.equal(restored.runtime.reliefProgress,1);
 assert.equal(getAdventureGuide('blacksail',restored.done)?.targetId,A.records);
 assert.ok(harborReliefReady(new Set([...h.done].filter(flag=>flag!==R.reserve).concat(A.records))));
});
test('adventure: winter route choice, two real braces, convoy checkpoints, pause and arrival authority',()=>{
 const h=setup(['napoleon_meet','shard_bell','winter_core']);assert.ok(winterRouteReady(h.done));h.runtime.hit(A.brace1);assert.equal(h.done.has(A.road),false);h.runtime.hit(A.brace2);assert.ok(h.done.has(A.road));
 h.runtime.interact('adventure_winter_arrival');assert.equal(h.done.has(A.arrived),false);h.runtime.interact('adventure_winter_convoy');
 for(let i=0;i<400;i++)h.runtime.update({...h.frame,playable:false});assert.equal(h.runtime.cartProgress,0);
 for(let i=0;i<400;i++)h.runtime.update(h.frame);assert.equal(h.runtime.cartProgress,1);assert.ok(h.done.has('adventure_cart_leg_2'));assert.equal(h.done.has(A.arrived),false);
 h.runtime.interact('adventure_winter_arrival');h.done.add('napoleon_contract');assert.ok(adventureChapterComplete('winter',h.done));
 h.runtime.reset();assert.equal(h.runtime.cartProgress,1);
});
test('adventure: Kyoto before companion and final journey checks preserve committed facts on cancellation',()=>{
 const h=setup(['musashi_meet','kikyo_banner_1','kikyo_banner_2','kikyo_banner_3']);assert.equal(getAdventureGuide('kyoto',h.done)?.targetId,'fire_core');assert.equal(h.done.has('saber_contract'),false);
 h.hold(A.water);assert.ok(h.done.has(A.water));h.hold(A.evidence);assert.equal(h.done.has(A.evidence),false);h.done.add('fire_core');h.hold(A.evidence);assert.ok(h.done.has(A.evidence));
 h.hold(A.emitters[0]);assert.equal(h.done.has(A.emitters[0]),false,'local repairs cannot bypass four region outcomes');
 for(const f of ['sun_core','sea_core','blackbeard_contract',A.departed,'winter_core','napoleon_contract',A.arrived,'musashi_contract'])h.done.add(f);
 for(const id of A.emitters)h.hold(id);assert.ok(A.emitters.every(id=>h.done.has(id)));
 h.runtime.interact('adventure_tower');assert.equal(h.done.has(A.takeover),false);
 h.runtime.interact('adventure_guardian');assert.ok(h.runtime.victory('adventure_guardian'));h.hold('adventure_tower');h.runtime.interact('adventure_exit');h.runtime.interact('adventure_tomorrow');assert.ok(h.done.has(A.ending));assert.equal(getAdventureGuide('alpha',h.done),null);
});
test('channel authored durations do not change with frame rate or allow hidden time',()=>{
 for(const dt of[1/120,1/60,.05]){const c=new RelayChannel(2),frame={dt,held:false,active:true,playable:true,inRange:true,grounded:true,moving:false,attacking:false,damageRevision:0};c.update(frame);let seconds=0;while(c.progress<1&&seconds<3){c.update({...frame,held:true});seconds+=dt;}assert.ok(Math.abs(seconds-2)<.051);}
});

test('default guide advances after a local chapter and preparation tracks only remaining actions',()=>{const done=new Set([A.started,A.online,'armory_rack','saber_contract','sun_core']);assert.equal(getCurrentAdventureGuide('britain',done)?.targetId,'blackbeard_meet');done.add('napoleon_meet');done.add('beacon_1');assert.equal(getAdventureGuide('winter',done)?.targetId,'beacon_2');done.add('blackbeard_meet');done.add('fort_cannon');done.add('ghost_boat_1');assert.equal(getAdventureGuide('blacksail',done)?.targetId,'ghost_boat_2');});

test('adventure respects contract-only legacy victories without requiring another first-clear boss',()=>{const harbor=setup(['blackbeard_meet','blackbeard_contract',A.records]);assert.equal(getAdventureGuide('blacksail',harbor.done)?.targetId,'adventure_harbor_exit');harbor.runtime.interact('adventure_harbor_exit');assert.ok(harbor.done.has(A.exited));const winter=setup(['napoleon_meet','napoleon_contract','shard_bell',A.road]);assert.equal(getAdventureGuide('winter',winter.done)?.targetId,'adventure_winter_convoy');const kyoto=setup(['musashi_meet','musashi_contract','kikyo_banner_1','kikyo_banner_2','kikyo_banner_3']);assert.equal(getAdventureGuide('kyoto',kyoto.done)?.targetId,A.evidence);});

test('legacy Winter victories skip obsolete preparation but still require a cleared road and real delivery',()=>{
 for(const victory of ['winter_core','napoleon_contract']){
  const h=setup([victory]);
  assert.equal(winterRouteReady(h.done),true);
  assert.equal(getAdventureGuide('winter',h.done)?.targetId,'adventure_winter_latch');
  h.runtime.interact('adventure_winter_convoy');assert.equal(h.done.has(A.convoy),false);
  h.runtime.hit(A.brace1);h.runtime.hit(A.brace2);
  assert.equal(getAdventureGuide('winter',h.done)?.targetId,'adventure_winter_convoy');
  h.runtime.interact('adventure_winter_convoy');assert.equal(h.done.has(A.convoy),true);
  assert.equal(adventureChapterComplete('winter',h.done),false);
  for(let i=0;i<400;i++)h.runtime.update(h.frame);
  assert.equal(h.done.has(A.arrived),false);
  h.runtime.interact('adventure_winter_arrival');h.done.add('napoleon_contract');
  assert.equal(adventureChapterComplete('winter',h.done),true);
  assert.equal(getAdventureGuide('winter',h.done),null);
  for(const flag of ['beacon_1','beacon_2','beacon_3','shard_bell'])assert.equal(h.done.has(flag),false);
 }
});

test('legacy Kyoto victories guide actual evidence and pact without demanding flags or another boss',()=>{
 for(const victory of ['fire_core','musashi_contract']){
  const h=setup([victory]);
  assert.equal(getAdventureGuide('kyoto',h.done)?.targetId,A.evidence);
  assert.equal(adventureChapterComplete('kyoto',h.done),false);
  h.hold(A.evidence);assert.equal(h.done.has(A.evidence),true);
  if(victory==='fire_core')assert.equal(getAdventureGuide('kyoto',h.done)?.targetId,'musashi_contract');
  h.done.add('musashi_contract');
  assert.equal(adventureChapterComplete('kyoto',h.done),true);
  assert.equal(getAdventureGuide('kyoto',h.done),null);
  for(const flag of ['musashi_meet','kikyo_banner_1','kikyo_banner_2','kikyo_banner_3'])assert.equal(h.done.has(flag),false);
  if(victory==='musashi_contract')assert.equal(h.done.has('fire_core'),false);
 }
});

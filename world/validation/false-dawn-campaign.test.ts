import test from 'node:test';
import assert from 'node:assert/strict';
import { FALSE_DAWN as F, FALSE_DAWN_ENCOUNTERS, chooseFalseDawn as choose, confirmFalseDawnEncounterStart as confirm, falseDawnEncounterFlags as flags, getExpectedFalseDawnEncounter as expected, getFalseDawnEncounterOrigin as origin, getFalseDawnGuide as guide, getFalseDawnState as state, interactFalseDawn as interact, recordFalseDawnEncounterVictory as victory, getFalseDawnEnding, getFalseDawnCompanionReaction, getFalseDawnRouteBriefing, getFalseDawnMarkerLabel, type FalseDawnEncounterId } from '../src/falseDawnCampaign';
import { WorldProgress } from '../src/progress';
import { getEraBossRequirements, ERA_IDS, ERA_STORIES } from '../src/eraStories';
function ready() { return new Set([F.receiver,'armory_rack']); }
function start(done:Set<string>,id:FalseDawnEncounterId) {
 assert.equal(expected(done),id);const before=[...done];const request=choose(origin(id),`start:${id}`,done);assert.equal(request.encounter,id);assert.equal(request.changed,false);assert.deepEqual([...done],before,'request alone never assumes spawn acceptance');
 assert.equal(confirm(id,done).handled,true);assert.ok(done.has(flags(id).started));
 assert.equal(choose(origin(id),`start:${id}`,done,{activeEncounter:id}).encounter,null,'cannot start on top of active encounter');
}
function clear(done:Set<string>,id:FalseDawnEncounterId) { start(done,id);assert.equal(victory(id,done).changed,true);assert.equal(victory(id,done).changed,false,'duplicate event cannot award twice'); }
function toArray(route:'harbor'|'winter') {
 const done=ready();clear(done,'false_dawn_courier');assert.equal(state(done).stage,'route');assert.equal(choose(F.recorder,`route_${route}`,done).changed,true);
 if(route==='harbor') clear(done,'false_dawn_harbor');else {clear(done,'false_dawn_winter_1');assert.equal(state(done).stage,'winter-two');assert.equal(done.has(flags('false_dawn_winter_2').started),false,'no automatic wave');clear(done,'false_dawn_winter_2');}
 const console=route==='harbor'?F.harbor:F.winter;assert.equal(choose(console,'key_perfect',done).changed,false);assert.equal(choose(console,'key_living',done).changed,true);assert.equal(state(done).stage,'return');return done;
}
test('False Dawn entry requires only receiver work and original equipment, never all chronicles or reset',()=>{
 const done=new Set<string>();assert.equal(state(done).stage,'locked');assert.equal(guide(done)?.targetId,'alpha_signal_keeper');done.add('campaign_alpha_met');assert.equal(guide(done)?.targetId,'campaign_alpha_work');
 done.add(F.receiver);assert.equal(state(done).stage,'equipment');assert.equal(guide(done)?.targetId,'armory_rack');assert.equal(choose(F.recorder,'start:false_dawn_courier',done).encounter,null);
 done.add('armory_rack');assert.equal(state(done).stage,'lead');assert.equal(interact(F.recorder,done).choices?.length,2);assert.equal(done.has(F.started),false);
 for(const region of ERA_IDS)done.add(ERA_STORIES[region].core);assert.equal(state(done).stage,'lead','old completed worlds still have a fresh sequel');clear(done,'false_dawn_courier');assert.equal(state(done).stage,'route');
 assert.ok(![...done].some(flag=>/^campaign_.*_complete$/.test(flag)),'no resident conclusions prerequisite');
});
test('both route choices and both endings form four complete action paths with explicit launches',()=>{
 for(const route of['harbor','winter']as const)for(const ending of['repurpose','seal']as const){const done=toArray(route);start(done,'false_dawn_array');assert.equal(state(done).stage,'array');
 for(const emitter of F.emitters){const result=interact(emitter,done,{activeEncounter:'false_dawn_array'});assert.equal(result.changed,true);assert.equal(result.dialogue,null,'no pausing battle dialogue');assert.ok(result.toast);}
 assert.equal(state(done).stage,'array','emitters alone are not victory');assert.equal(victory('false_dawn_array',done).changed,true);assert.equal(state(done).stage,'warden');clear(done,'false_dawn_warden');assert.equal(state(done).stage,'ending');assert.equal(done.has(F.complete),false);
 const result=choose(F.array,`ending_${ending}`,done);assert.equal(result.changed,true);assert.equal(state(done).stage,'complete');assert.equal(state(done).ending,ending);assert.equal(guide(done),null);assert.ok(getFalseDawnEnding(done)[1].includes('False Dawn is over'));
 const before=[...done];for(const id of['ending_repurpose','ending_seal'])assert.equal(choose(F.array,id,done).changed,false);for(const id of F.emitters)assert.equal(interact(id,done).changed,false);assert.deepEqual([...done],before);
 assert.equal(done.has('summon_circle'),false,'story never grants passage');assert.equal(done.has(route==='harbor'?flags('false_dawn_winter_1').cleared:flags('false_dawn_harbor').cleared),false,'unchosen route never auto-completes');
 }
});
test('route choice is immutable, and physical-origin/phase checks reject shortcuts',()=>{
 const done=ready();assert.equal(interact('unrelated',done).handled,false);assert.equal(choose(F.harbor,'start:false_dawn_courier',done).encounter,null);assert.equal(choose(F.recorder,'route_harbor',done).changed,false);
 for(const id of FALSE_DAWN_ENCOUNTERS)assert.equal(victory(id,done).changed,false,'cannot fake completion before actual accepted start');
 clear(done,'false_dawn_courier');assert.equal(choose(F.winter,'route_harbor',done).changed,false);assert.equal(choose(F.recorder,'route_harbor',done).changed,true);const before=[...done];assert.equal(choose(F.recorder,'route_winter',done).changed,false);assert.deepEqual([...done],before);
 assert.equal(confirm('false_dawn_winter_1',done).handled,false);assert.equal(victory('false_dawn_winter_1',done).handled,false);assert.equal(choose(F.harbor,'key_living',done).changed,false);assert.equal(choose(F.array,'ending_seal',done).changed,false);
 assert.equal(choose(F.harbor,'start:__proto__',done).encounter,null);assert.equal(choose(F.harbor,'start:constructor',done).encounter,null);
});
test('failed launch is retryable, and leave/reload retains anchors but requires restarting unfinished defense',()=>{
 const values=new Map<string,string>(),storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);}};
 let p=new WorldProgress(storage);toArray('winter').forEach(flag=>p.done.add(flag));
 const request=choose(F.array,'start:false_dawn_array',p.done);assert.ok(request.encounter);assert.equal(state(p.done).stage,'return','failed runtime launch does not commit array start');
 start(p.done,'false_dawn_array');assert.equal(interact(F.emitters[2],p.done,{activeEncounter:'false_dawn_array'}).changed,false,'ordered signal circuit');assert.equal(interact(F.emitters[0],p.done,{activeEncounter:'false_dawn_array'}).changed,true);
 p.save();p=new WorldProgress(storage);assert.deepEqual(state(p.done).anchors,[true,false,false]);assert.equal(interact(F.emitters[1],p.done).changed,false,'no dormant defense bypass');assert.equal(guide(p.done)?.targetId,F.array,'retry guidance points to console, not unavailable switch');
 start(p.done,'false_dawn_array');assert.equal(guide(p.done,{activeEncounter:'false_dawn_array'})?.targetId,F.emitters[1]);assert.equal(interact(F.emitters[1],p.done,{activeEncounter:'false_dawn_array'}).changed,true);assert.equal(interact(F.emitters[2],p.done,{activeEncounter:'false_dawn_array'}).changed,true);assert.equal(victory('false_dawn_array',p.done).changed,true);
 p.save();p=new WorldProgress(storage);assert.equal(state(p.done).stage,'warden');p.reset();assert.equal(victory('false_dawn_array',p.done).changed,false);assert.equal(victory('false_dawn_warden',p.done).changed,false);assert.equal(confirm('false_dawn_warden',p.done).handled,false);assert.equal(state(p.done).stage,'locked');
});
test('array guards can be defeated first, but Warden stays blocked until physical emitter sequence is complete',()=>{
 const done=toArray('harbor');clear(done,'false_dawn_array');assert.equal(state(done).stage,'array');assert.equal(expected(done),null);assert.equal(choose(F.array,'start:false_dawn_warden',done).encounter,null);
 for(const id of F.emitters)assert.equal(interact(id,done).changed,true,'safe cleanup after genuine defense victory');assert.equal(state(done).stage,'warden');assert.equal(expected(done),'false_dawn_warden');
});
test('non-pausing active-combat replies and optional route text never modify original gates or equipment',()=>{
 const done=ready(),original=ERA_IDS.map(r=>getEraBossRequirements(ERA_STORIES[r].core,done));start(done,'false_dawn_courier');
 const before=[...done];for(const id of[F.recorder,F.harbor,F.winter,F.array]){const result=interact(id,done,{activeEncounter:'false_dawn_courier'});assert.ok(result.toast);assert.equal(result.dialogue,null);assert.equal(result.changed,false);}assert.deepEqual([...done],before);
 victory('false_dawn_courier',done);const route=choose(F.recorder,'route_winter',done);assert.match(route.dialogue![1],/summoning circle/);assert.equal(done.has('summon_circle'),false);assert.deepEqual(ERA_IDS.map(r=>getEraBossRequirements(ERA_STORIES[r].core,done)),original);
});

test('orphan encounter-start flags still report other newly repaired start flags for saving',()=>{
 const done=ready();done.add(flags('false_dawn_courier').started);assert.equal(done.has(F.started),false);
 const result=confirm('false_dawn_courier',done);assert.equal(result.changed,true);assert.equal(done.has(F.started),true);
 const array=toArray('harbor');array.add(flags('false_dawn_array').started);assert.equal(flags('false_dawn_array').started,F.arrayStarted);assert.equal(confirm('false_dawn_array',array).changed,false);assert.ok(array.has(F.arrayStarted));
});


test('companion comments are finite original voices, contextual, bilingual and do not invent presence or writes',()=>{
 const done=ready();for(const id of[null,undefined,'unknown','__proto__'])assert.equal(getFalseDawnCompanionReaction(id,done),null);
 for(const id of['saber','blackbeard','napoleon','musashi'])assert.equal(getFalseDawnCompanionReaction(id,new Set()),null);
 const snapshots=[ready(),toArray('harbor'),toArray('winter'),new Set([F.complete,F.rescued]),new Set([F.complete,F.sealed])];
 for(const snapshot of snapshots){const before=[...snapshot],voices=[];for(const id of['saber','blackbeard','napoleon','musashi']){const reaction=getFalseDawnCompanionReaction(id,snapshot)!;assert.ok(reaction.speaker[0]);assert.ok(reaction.line[0]);assert.ok(reaction.line[1]);voices.push(reaction.line[1]);}assert.equal(new Set(voices).size,4);assert.deepEqual([...snapshot],before);}
});

test('runtime null and nonstring event IDs cannot match an idle null expected encounter',()=>{
 const done=new Set<string>();for(const invalid of[null,undefined,0,{},[],false]){assert.equal(confirm(invalid as never,done).handled,false);assert.equal(victory(invalid as never,done).handled,false);}assert.equal(done.size,0);
});
test('deterministic hostile event-order fuzz never writes original progress or both branches',()=>{
 let seed=0x151a;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
 const ids=[F.recorder,F.harbor,F.winter,F.array,...F.emitters,'unknown'];const choices=['route_harbor','route_winter','key_perfect','key_living','ending_repurpose','ending_seal','later','unknown',...FALSE_DAWN_ENCOUNTERS.map(id=>`start:${id}`)];
 for(let run=0;run<30;run++){const done=ready();for(let step=0;step<300;step++){const id=ids[random()%ids.length],event=FALSE_DAWN_ENCOUNTERS[random()%FALSE_DAWN_ENCOUNTERS.length];switch(random()%5){case 0:interact(id,done,{activeEncounter:random()%2?'false_dawn_array':null});break;case 1:choose(id,choices[random()%choices.length],done);break;case 2:confirm(event,done);break;case 3:victory(event,done);break;default:guide(done);state(done);}
 assert.ok(!(done.has(F.routeHarbor)&&done.has(F.routeWinter)));assert.ok(!(done.has(F.rescued)&&done.has(F.sealed)));assert.ok([...done].every(flag=>flag==='armory_rack'||flag===F.receiver||flag.startsWith('false_dawn_')));
 if(done.has(F.complete)){assert.ok(done.has(flags('false_dawn_warden').cleared));assert.ok(F.anchors.every(flag=>done.has(flag)));assert.ok(done.has(flags('false_dawn_array').cleared));assert.ok(done.has(F.harborKey)||done.has(F.winterKey));}
 }}
});


test('earlier resident work is acknowledged only when earned and endings remember the actual chosen route',()=>{
 const base=getFalseDawnRouteBriefing(new Set())[1];assert.ok(!base.includes('manifest you checked'));assert.ok(!base.includes('your work with Mikhail'));
 const harbor=getFalseDawnRouteBriefing(new Set(['campaign_blacksail_worked']))[1];assert.ok(harbor.includes('manifest you checked'));assert.ok(!harbor.includes('your work with Mikhail'));
 const winter=getFalseDawnRouteBriefing(new Set(['campaign_winter_worked']))[1];assert.ok(winter.includes('your work with Mikhail'));assert.ok(!winter.includes('manifest you checked'));
 const h=getFalseDawnEnding(new Set([F.complete,F.rescued,F.routeHarbor]))[1],w=getFalseDawnEnding(new Set([F.complete,F.rescued,F.routeWinter]))[1];assert.ok(h.includes('tide station'));assert.ok(!h.includes('snowfield connections'));assert.ok(w.includes('snowfield connections'));assert.notEqual(h,w);
 for(const id of[F.recorder,F.harbor,F.winter,F.array,...F.emitters]){const label=getFalseDawnMarkerLabel(id)!;assert.ok(label[0].length<20);assert.ok(label[1].length<45);assert.equal(label[0].includes('\n'),false);label[0]='mutated';assert.notEqual(getFalseDawnMarkerLabel(id)![0],'mutated');}assert.equal(getFalseDawnMarkerLabel('__proto__'),null);
});

test('completed emitters and remote stations never spam the full ending or fabricate unchosen victories',()=>{
 const done=new Set([F.complete,F.rescued,F.routeHarbor]);const before=[...done];
 for(const id of[...F.emitters,F.harbor,F.winter]){const result=interact(id,done);assert.equal(result.dialogue,null);assert.ok(result.toast);assert.equal(result.changed,false);assert.equal(result.encounter,null);}
 assert.match(interact(F.winter,done).toast![1],/unchosen route/);assert.ok(interact(F.array,done).dialogue?.[1].includes('False Dawn is over'));assert.deepEqual([...done],before);
});

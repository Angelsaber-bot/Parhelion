import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {getCompactRelayEncounterSpec} from '../src/compactRelayEncounter';
import {COMPACT_RELAY_SITE} from '../src/compactRelaySitesData';
import {STORY_ENCOUNTER_LIMITS} from '../src/storyEncounters';
import {ARENA_TRAINING_HREF,arenaTrainingBriefing} from '../src/arenaTrainingBridge';
test('two native roles match authored sockets with bounded offsets and no stat or reward overrides',()=>{
 const s=getCompactRelayEncounterSpec(); assert.equal(s.id,'compact_relay_training');
 assert.deepEqual(s.actors.map(a=>a.role),['musketeer','breaker']);
 assert.deepEqual(Object.values(s.anchor),[...COMPACT_RELAY_SITE.anchor]);
 assert.ok(Math.hypot(COMPACT_RELAY_SITE.entry[0]-s.anchor.x,COMPACT_RELAY_SITE.entry[2]-s.anchor.z)<=STORY_ENCOUNTER_LIMITS.trigger);
 s.actors.forEach((a,i)=>{assert.ok(Math.hypot(...a.offset)<=STORY_ENCOUNTER_LIMITS.actorOffset);assert.deepEqual([s.anchor.x+a.offset[0],s.anchor.z+a.offset[1]],[COMPACT_RELAY_SITE.enemySockets[i][0],COMPACT_RELAY_SITE.enemySockets[i][2]]);assert.deepEqual(Object.keys(a).sort(),['offset','role','title']);});
});
test('spec retries use private mutable copies',()=>{
 const s=getCompactRelayEncounterSpec();s.anchor.x=999;Object.assign(s.actors[0].offset,{0:999});Object.assign(s.actors[0].title!,{0:'changed'});
 const next=getCompactRelayEncounterSpec();assert.equal(next.anchor.x,COMPACT_RELAY_SITE.anchor[0]);assert.notEqual(next.actors[0].offset[0],999);assert.notEqual(next.actors[0].title![0],'changed');
});
test('Arena link is supported offline lobby only, without autostart or authority transfer',()=>{
 const u=new URL(ARENA_TRAINING_HREF,'https://example.invalid');assert.equal(u.pathname,'/arena/');assert.deepEqual([...u.searchParams],[['mode','offline']]);
 const source=readFileSync(new URL('../../arena-game/src/main.ts',import.meta.url),'utf8');assert.match(source,/params\.get\('mode'\) === 'online' \? 'online' : 'offline'/);
 const b=arenaTrainingBriefing(a=>`WORLD_${a}`,a=>`ARENA_${a}`);assert.equal(b.rows.length,5);assert.match(b.rows.find(r=>r.id==='melee')!.arena[1],/ARENA_weapon3.*ARENA_fire/);assert.match(b.warning[1],/WORLD_reset/);assert.match(b.warning[1],/WORLD_teleport3/);assert.match(b.fairness[1],/no Arena damage or equipment advantage/);assert.match(b.practice[1][1],/not automatic objectives or rewards/);
});
test('labels refresh from caller settings without caching either mode',()=>{
 let key='First';const label=(a:string)=>`${key}_${a}`;const before=arenaTrainingBriefing(label,label);key='Remapped';const after=arenaTrainingBriefing(label,label);assert.match(before.rows[0].world[0],/First_aim/);assert.match(after.rows[0].world[0],/Remapped_aim/);
});
test('runtime sampled site height is used and malformed geometry fails closed',()=>{
 const s=getCompactRelayEncounterSpec([-60,10.15,226],[[-51,10.2,228],[-64,10.1,218]]);assert.equal(s.anchor.y,10.15);assert.deepEqual(s.actors[0].offset,[9,2]);
 assert.throws(()=>getCompactRelayEncounterSpec([0,NaN,0],[]));assert.throws(()=>getCompactRelayEncounterSpec([0,1,2],[[0,1,2]]));
});
test('exact relay ID admits ordinary enemies; cancellation is not a kill and retry cannot alias targets',async()=>{
 const {WorldCombatState}=await import('../src/combat');const {StoryEncounterDirector}=await import('../src/storyEncounters');
 const state=new WorldCombatState([],[]),director=new StoryEncounterDirector(),spec=getCompactRelayEncounterSpec();
 const [x,y,z]=COMPACT_RELAY_SITE.entry;
 const context={state,player:{x,y,z},playable:true,place:(x:number,z:number)=>({x,y:spec.anchor.y,z})};
 for(const id of ['compact_relay','compact_relay_training_extra','compact_relay_other'])assert.equal(director.start({...spec,id},context).reason,'invalid');
 assert.equal(director.start(spec,context).ok,true);assert.deepEqual(state.enemies.map(e=>e.maxHp),[66,66]);
 const first=state.enemies.map(e=>e.id);assert.equal(director.observe(context),null);
 assert.equal(director.cancel(),spec.id);state.clearStoryEnemies();assert.equal(director.observe(context),null);
 assert.equal(state.drainEvents().filter(e=>e.type==='kill').length,0);assert.equal(director.start(spec,context).ok,true);
 assert.ok(state.enemies.every(e=>!first.includes(e.id)));assert.ok(state.enemies.every(e=>e.hp===e.maxHp));
});

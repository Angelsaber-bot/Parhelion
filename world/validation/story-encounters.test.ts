import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WorldCombatState, type CombatTerrain } from '../src/combat.ts';
import { StoryEncounterDirector, type StoryEncounterSpec } from '../src/storyEncounters.ts';
const p = (x=0,z=0,y=0) => ({x,y,z});
const ground: CombatTerrain = {walk:(_from,x,z)=>p(x,z),lineOfSight:()=>true};
const spec:StoryEncounterSpec = {id:'false_dawn_courier',anchor:p(),actors:[{role:'lancer',offset:[-4,4]},{role:'musketeer',offset:[4,4]}]};
const fixture = () => {const state=new WorldCombatState([],[]),director=new StoryEncounterDirector();return{state,director,context:{state,player:p(),playable:true,place:(x:number,z:number)=>p(x,z)}};};
test('physical admission is atomic, capped and stage-neutral; invalid/busy/unsafe inputs create no enemies',()=>{
 const {state,director,context}=fixture();
 for(const invalid of [{...spec,id:'bad'}, {...spec,anchor:p(NaN)}, {...spec,actors:[]}, {...spec,actors:Array(4).fill(spec.actors[0])}, {...spec,actors:[{role:'king',offset:[4,4]}]}, {...spec,actors:[{role:'lancer',offset:[100,0]}]}]) {
  assert.deepEqual(director.start(invalid as StoryEncounterSpec,context),{ok:false,reason:'invalid'});assert.equal(state.enemies.length,0);
 }
 assert.equal(director.start(spec,{...context,playable:false}).reason,'unavailable');
 assert.equal(director.start(spec,{...context,player:p(13)}).reason,'out-of-range');
 assert.equal(director.start(spec,{...context,player:p(0,0,9)}).reason,'out-of-range');
 state.bossStarted=true;assert.equal(director.start(spec,context).reason,'busy');state.bossStarted=false;
 let placement=0;
 assert.equal(director.start(spec,{...context,place:(x,z)=>++placement===2?null:p(x,z)}).reason,'blocked');
 assert.equal(state.enemies.length,0,'failed second placement cannot leave first actor behind');assert.equal(director.status,null);
 assert.equal(director.start(spec,context).ok,true);assert.equal(state.enemies.length,2);
 assert.deepEqual(director.status,{id:spec.id,remaining:2});
 assert.equal(director.start(spec,context).reason,'active');assert.equal(director.start({...spec,id:'false_dawn_other'},context).reason,'busy');assert.equal(state.enemies.length,2);
 assert.deepEqual(state.enemies.map(e=>e.role),['lancer','musketeer']);assert.deepEqual(state.enemies.map(e=>e.maxHp),[66,66]);
});
test('story enemies participate in real rays/strikes and only actual final defeat yields one victory',()=>{
 const {state,director,context}=fixture();director.start(spec,context);
 const [first,second]=state.enemies;
 assert.equal(state.raycast(p(-4,0,1.05),p(0,1))?.id,first.id);
 state.hitEnemy(first.id,first.hp);assert.equal(director.observe(context),null);assert.equal(first.timer,Infinity);
 state.hitEnemy(second.id,second.hp);assert.equal(director.observe({...context,playable:false}),null,'paused presentation cannot advance mission');
 assert.deepEqual(director.observe(context),{type:'victory',id:spec.id});assert.equal(director.observe(context),null,'no duplicate rewards');
 state.clearStoryEnemies();assert.equal(state.enemies.length,0);
});
test('defeat, direct reset, leash and manual cancel are never victories; retry creates a fresh roster',()=>{
 for(const cancel of ['death','reset','leash','manual'] as const){
  const {state,director,context}=fixture();director.start(spec,context);const original=[...state.enemies];
  if(cancel==='death')state.defeatedFor=2;
  if(cancel==='reset')state.resetAll();
  if(cancel==='leash')context.player=p(31);
  if(cancel==='manual'){assert.equal(director.cancel(),spec.id);assert.equal(director.observe(context),null);}
  else assert.deepEqual(director.observe(context),{type:'cancel',id:spec.id});
  state.clearStoryEnemies();state.defeatedFor=0;context.player=p();
  assert.equal(director.start(spec,context).ok,true);assert.ok(state.enemies.every(e=>e.hp===e.maxHp&&e.active&&!original.includes(e)));
  assert.ok(state.enemies.every(e=>!original.some(old=>old.id===e.id)),'fresh generation cannot alias a stale companion/strike target');
 }
});
test('pause freezes story attack clocks; lethal player contact cancels instead of awarding reset actors',()=>{
 const {state,director,context}=fixture();director.start(spec,context);const e=state.enemies[0];e.mode='windup';e.timer=.01;e.attack='sweep';e.p=p(.5);state.hp=1;
 for(let i=0;i<20;i++)state.step(.1,p(),false,ground);
 assert.equal(e.timer,.01);assert.equal(director.observe({...context,playable:false}),null);
 state.step(.05,p(),true,ground);assert.equal(state.defeated,true);assert.deepEqual(director.observe(context),{type:'cancel',id:spec.id});
 assert.equal(state.drainEvents().filter(e=>e.type==='kill').length,0,'defeat reset is not enemy death credit');
});
test('busy local wilderness remains untouched and passive distant activation does not falsely block a mission',()=>{
 const {state,director,context}=fixture();
 const nearby=new WorldCombatState([{id:'wild',kind:'shade',p:p(10)}],[]).enemies[0];nearby.active=true;nearby.mode='windup';nearby.timer=1;state.enemies.push(nearby);
 assert.equal(director.start(spec,context).reason,'busy');assert.equal(nearby.mode,'windup');assert.equal(nearby.timer,1);
 nearby.p=p(50);nearby.mode='idle';assert.equal(director.start(spec,context).ok,true);assert.ok(state.enemies.includes(nearby));
 state.clearStoryEnemies();assert.deepEqual(state.enemies,[nearby]);
});

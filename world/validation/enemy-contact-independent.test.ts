/** Independent verification: simulation owns contact, presentation is read-only.
 * No renderer timing or synthetic frame time is represented as GPU/FPS evidence. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { WorldCombatState, enemyAttackTiming, type CombatTerrain, type CombatEvent } from '../src/combat';
import { enemyAttackPose, ENEMY_CONTACT_SAMPLE, type EnemyPoseModel } from '../src/enemyAttackPresentation';
import type { EnemyRole } from '../src/enemyRoles';
const terrain:CombatTerrain={walk:(_p,x,z)=>({x,y:0,z}),lineOfSight:()=>true};
const scenarios: [EnemyRole,EnemyPoseModel][]=[['stalker','deck_raider'],['duelist','samurai'],['breaker','sunward_guard'],['bombardier','officer'],['musketeer','musketeer'],['lancer','ashigaru']];
for(const [role,model]of scenarios)test(`${role}: contact timing/events are identical at 30/60/120Hz presentation, with frozen pauses`,()=>{
 const run=(renderEvery:number)=>{
  const state=new WorldCombatState([{id:'qa',kind:'shade',role,p:{x:0,y:0,z:0}}],[]),e=state.enemies[0],player={x:0,y:0,z:1};
  const contacts:{tick:number;event:CombatEvent}[]=[];let firstContact=-1,firstWindup=-1;
  for(let tick=0;tick<600;tick++){
   state.step(1/120,player,true,terrain);
   if(e.mode==='windup'&&firstWindup<0){
    firstWindup=tick;const before=JSON.stringify(e),hp=state.hp;
    // A modal or hidden-tab pause must not consume windup or emit a contact.
    for(let pause=0;pause<40;pause++){state.step(.1,player,false,terrain);enemyAttackPose(e,model);}
    assert.equal(JSON.stringify(e),before);assert.equal(state.hp,hp);
   }
   const events=state.drainEvents();
   for(const event of events)if(event.type==='attackContact'){
    contacts.push({tick,event});if(firstContact<0)firstContact=tick;
    assert.equal(e.mode,'recover');assert.equal(e.contactSequence,event.sequence);
    const pose=enemyAttackPose(e,model);assert.equal(pose.stage,'contact');assert.equal(pose.sample,ENEMY_CONTACT_SAMPLE[model]);
    // Event snapshots cannot follow a mutable locked target across later ticks.
    const p={...event.target};e.target.x+=123;assert.deepEqual(event.target,p);e.target.x-=123;
   }
   if(tick%renderEvery===0){const before=JSON.stringify(e);for(let repeat=0;repeat<7;repeat++)enemyAttackPose(e,model);assert.equal(JSON.stringify(e),before,'pose sampling is pure');}
   if(firstContact>=0&&tick>=firstContact+20)break;
  }
  assert.equal(contacts.length,1,'one actual contact, never render-driven duplicates');
  assert.ok(firstContact-firstWindup>=Math.floor(enemyAttackTiming(e).windup*120),'no shortened advertised tell');
  return{contacts,hp:state.hp,enemy:JSON.parse(JSON.stringify(e))};
 };
 const reference=run(1);assert.deepEqual(run(2),reference);assert.deepEqual(run(4),reference);
});
for(const [role,model]of scenarios)test(`${role}: lethal windup cancellation and far despawn never fabricate a contact`,()=>{
 for(const cancel of ['death','despawn']as const){
  const state=new WorldCombatState([{id:'qa',kind:'shade',role,p:{x:0,y:0,z:0}}],[]),e=state.enemies[0],player={x:0,y:0,z:1};
  for(let i=0;i<5&&e.mode!=='windup';i++)state.step(1/120,player,true,terrain);
  assert.equal(e.mode,'windup');state.drainEvents();
  if(cancel==='death')assert.equal(state.hitEnemy(e.id,999,{source:'ranged',origin:{x:0,y:1,z:1}}),true);
  else state.step(1/120,{x:200,y:0,z:0},true,terrain);
  assert.equal(enemyAttackPose(e,model).clip,'Idle');
  for(let i=0;i<240;i++)state.step(1/120,{x:cancel==='death'?0:200,y:0,z:1},true,terrain);
  assert.equal(state.drainEvents().filter(event=>event.type==='attackContact').length,0);
  assert.equal(state.hp,100);assert.equal(e.contactSequence,0);
 }
});

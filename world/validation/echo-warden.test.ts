import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WorldCombatState, enemyAttackTiming, enemyAttackContains, enemyAttackRadius, type CombatTerrain } from '../src/combat.ts';
import { ECHO_WARDEN, chooseEchoWardenAttack } from '../src/echoWarden.ts';
import { PlayerMelee } from '../src/playerMelee.ts';
import { collectStrikeTargets } from '../src/combatActions.ts';
const p=(x=0,z=0)=>({x,y:0,z});
const terrain:CombatTerrain={walk:(_from,x,z)=>p(x,z),lineOfSight:()=>true};
function make(){const s=new WorldCombatState([],[]);const [e]=s.replaceStoryEnemies([{id:'story_warden_1',kind:'crystal',p:p(),role:'breaker',storyEncounter:'false_dawn_warden',storyPattern:'echo-warden'}]);return{s,e};}
for(const phase of [1,2] as const) for(const [attack,count,range] of [['thrust',0,6],['sweep',1,2],['burst',2,10]] as const) test(`Echo Warden ${attack}/phase${phase}: locked full tell, walking dodge, cover and exact one-hit contact`,()=>{
 for(const dodge of ['walk','cover','stay'] as const){
  const{s,e}=make(),player=p(range);e.phase=phase;e.attackCount=count;e.timer=0;
  s.step(.05,player,true,terrain);assert.equal(e.mode,'windup');assert.equal(e.attack,attack);assert.ok(enemyAttackContains(e,player));
  const locked={...e.target},timing=enemyAttackTiming(e);assert.ok(timing.windup>=1.1&&timing.recovery>=1.55);
  let elapsed=0;
  while(e.mode==='windup'){
   if(dodge==='walk'&&elapsed>=.3)player.z+=5.5*.05;
   s.step(.05,player,true,dodge==='cover'?{...terrain,lineOfSight:()=>false}:terrain);elapsed+=.05;
   assert.deepEqual(e.target,locked);assert.ok(elapsed<2);
  }
  assert.equal(e.mode,'recover');assert.ok(e.timer>=1.5);
  assert.equal(s.hp,dodge==='stay'?100-(attack==='burst'?16:18):100);
  const hits=s.drainEvents().filter(event=>event.type==='hurt');assert.equal(hits.length,dodge==='stay'?1:0);
  for(let i=0;i<10;i++)s.step(.05,player,true,terrain);
  assert.equal(s.drainEvents().filter(event=>event.type==='hurt').length,0,'no lingering/repeated active hitbox');
 }
});
test('Warden phase break is one visible, damageable punish opportunity; ordinary roles stay unchanged',()=>{
 const{s,e}=make();assert.equal(e.maxHp,264);assert.equal(e.maxHp,ECHO_WARDEN.hp);e.mode='windup';e.timer=1;e.attackCount=1;
 s.hitEnemy(e.id,140,{source:'melee'});assert.equal(e.phase,2);assert.equal(e.mode,'recover');assert.equal(e.timer,1);assert.equal(e.contactSequence,0);assert.equal(e.staggerCooldown,0);
 const before=e.hp;s.hitEnemy(e.id,30,{source:'melee'});assert.equal(before-e.hp,60,'phase break is not hidden invulnerability');
 assert.equal(s.drainEvents().filter(event=>event.type==='storyPhase').length,1);s.hitEnemy(e.id,1);assert.equal(s.drainEvents().filter(event=>event.type==='storyPhase').length,0);
 const ordinary=new WorldCombatState([{id:'old',kind:'crystal',p:p(),role:'breaker'}],[]).enemies[0];assert.equal(ordinary.maxHp,88);assert.equal(enemyAttackRadius(ordinary),3.7);
 assert.equal(chooseEchoWardenAttack({attackCount:0},7),'thrust');assert.equal(chooseEchoWardenAttack({attackCount:0},7.01),'burst');
});
/** Ideal uninterrupted offense CPU scenarios; not observed user kill times or balance telemetry. */
export function wardenOffenseScenario(mode:'rifle'|'rifle-companion'|'melee'){
 const{s,e}=make(),player=p(mode==='melee'?1.3:6),melee=new PlayerMelee();s.setDefense({guard:1,invulnerable:true});
 let accumulator=0,time=0,shots=0,contacts=0,companion=0,nextCompanion=1.1;
 while(e.hp>0&&time<20){
  time+=1/120;accumulator+=1/120;
  if(accumulator+1e-9>=.05){s.step(.05,player,true,terrain);accumulator-=.05;}
  if(mode==='melee'){
   melee.press(-Math.PI/2);const contact=melee.update(1/120,true);
   if(contact){const targets=collectStrikeTargets([e],{origin:player,direction:p(-1),range:contact.range,halfWidth:contact.halfWidth,damage:contact.damage,maxTargets:1},terrain);if(targets.length){s.hitEnemy(e.id,contact.damage,{source:'melee',origin:player});contacts++;}}
  }else if(s.canShoot()){s.hitEnemy(e.id,16,{source:'ranged',origin:player});shots++;}
  if(mode==='rifle-companion'&&time>=nextCompanion&&e.hp>0){s.hitEnemy(e.id,14,{source:'servant',origin:p(1)});companion++;nextCompanion+=1.1;}
 }
 return{mode,seconds:+time.toFixed(3),shots,meleeContacts:contacts,companionContacts:companion,enemyAttacks:e.attackCount,hp:e.hp};
}
test('authored Warden survives a complete opening rifle burst but does not become a sponge against real combo contacts',()=>{
 const scenarios=(['rifle','rifle-companion','melee'] as const).map(wardenOffenseScenario);
 for(const row of scenarios){assert.equal(row.hp,0);assert.ok(row.seconds>=2&&row.seconds<8,JSON.stringify(row));}
 assert.equal(scenarios[0].shots,17);assert.ok(scenarios[0].enemyAttacks>=1,'opening tell actually occurs before ideal kill');
 assert.ok(scenarios[2].meleeContacts>=4&&scenarios[2].meleeContacts<=9);console.log('WARDEN_IDEAL_OFFENSE',JSON.stringify(scenarios));
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WorldCombatState, enemyAttackTiming, enemyAttackContains, type CombatTerrain } from '../src/combat.ts';
import { chooseBossAttack } from '../src/bossPatterns.ts';
import { collectStrikeTargets, strikeContains, type StrikeRequest } from '../src/combatActions.ts';
import { CONTRACT_SKILLS, skillContains, type SkillStrike } from '../src/contractSkills.ts';

const p = (x: number, z = 0, y = 0) => ({ x, y, z });
const terrain: CombatTerrain = { walk: (_from, x, z) => p(x,z), lineOfSight: () => true };
const ids = ['boss_winter_warden', 'boss_hellfire_lord'] as const;
function encounter(id: string) {
  const state = new WorldCombatState([], { id, kind: 'king', p: p(0), requires: [] });
  state.beginBoss(new Set()); state.drainEvents();
  return state;
}
for (const id of ids) for (const phase of [1,2] as const) {
  test(`${id} phase${phase}: mid-range thrust is locked, side-steppable and exposes an earned melee punish`, () => {
    const state = encounter(id), e = state.boss;
    e.phase = phase; e.attackCount = id === ids[0] ? 1 : 2;
    e.mode = 'chase'; e.timer = 0;
    const player = p(6.5);
    state.step(.05,player,true,terrain);
    assert.equal(e.attack,'thrust'); assert.equal(e.mode,'windup');
    const locked = { ...e.target }, timing = enemyAttackTiming(e);
    assert.ok(timing.windup >= 1.1,'full reaction tell even at hardest phase');
    assert.equal(enemyAttackContains(e,player),true,'standing in the lane is a real threat');
    // Walk sideways at the actual player walk speed, starting .3s after the tell.
    // No evade invulnerability, teleport or LOS obstruction is used to pass this test.
    for(let elapsed=0; elapsed < timing.windup+.1 && e.mode === 'windup'; elapsed+=.05) {
      if(elapsed >= .3) {
        if(player.z < 1.35) player.z += 5.5*.05;
        else player.x = Math.max(1.35, player.x - 5.5*.05);
      }
      state.step(.05,player,true,terrain);
      assert.deepEqual(e.target,locked,'the spear cannot track a sidestep');
    }
    assert.equal(e.mode,'recover'); assert.equal(state.hp,100);
    assert.ok(e.timer >= 1.3,'full advertised recovery survives contact');
    // Physically close the remaining gap during recovery, rather than teleporting a hit origin.
    while(Math.hypot(player.x,player.z)>1.4 && e.mode==='recover') {
      const distance=Math.hypot(player.x,player.z), step=Math.min(5.5*.05,distance-1.35);
      player.x-=player.x/distance*step; player.z-=player.z/distance*step;
      state.step(.05,player,true,terrain);
    }
    assert.ok(Math.hypot(player.x,player.z)<=1.4); assert.equal(e.mode,'recover');
    // First blade contact takes .19s; the reward must remain reachable after that startup.
    for(let i=0;i<4;i++) state.step(.05,player,true,terrain);
    assert.equal(e.mode,'recover');
    const before = e.hp;
    state.hitEnemy(e.id,30,{source:'melee',origin:player});
    assert.equal(before-e.hp,60,'earned recovery doubles a normal melee hit without extra HP');
  });
  test(`${id} phase${phase}: staying in the locked mid-range lane is not a harmless preview`, () => {
    const state = encounter(id), e = state.boss;
    e.phase=phase; e.attackCount=id===ids[0]?1:2; e.mode='chase'; e.timer=0;
    const player=p(6.5);
    state.step(.05,player,true,terrain);
    for(let i=0;i<40 && e.mode==='windup';i++) state.step(.05,player,true,terrain);
    assert.ok(state.hp<100); assert.ok(state.hp>=68,'no one-shot damage inflation');
    assert.equal(e.mode,'recover');
  });
}
test('thrust reach margin never schedules an impossible distant lane and other boss rhythms stay intact',()=>{
  for(const id of ids) {
    const e=encounter(id).boss; e.attackCount=id===ids[0]?1:2;
    for(const distance of [4,6,7,7.5]) assert.equal(chooseBossAttack(e,distance),'thrust');
    for(const distance of [7.5001,8,18,24]) assert.equal(chooseBossAttack(e,distance),'burst');
    e.attackCount=0;
    assert.equal(chooseBossAttack(e,4),'sweep'); assert.equal(chooseBossAttack(e,7),'burst');
  }
  const king=encounter('boss_vacant_king').boss, admiral=encounter('boss_drowned_admiral').boss;
  for(let count=0;count<6;count++) {
    king.attackCount=admiral.attackCount=count;
    assert.equal(chooseBossAttack(king,7),'burst');
    assert.equal(chooseBossAttack(admiral,7),count%3===2?'shot':'burst');
  }
});

test('every kit/pulse uses exactly the contact corridor for rotated and non-unit skill directions',()=>{
  const enemy=new WorldCombatState([{id:'target',kind:'shade',p:p(0)}],{id:'boss',kind:'king',p:p(100),requires:[]}).enemies[0];
  enemy.active=true;
  for(const [identity,slots] of Object.entries(CONTRACT_SKILLS)) for(const [slot,definition] of Object.entries(slots)) for(const pulse of definition.pulses) {
    for(const scale of [.1,1,7]) for(const yaw of [0,.4,Math.PI/2,Math.PI]) {
      const strike={type:'strike',identity:identity==='player'?null:identity,slot,pulse:0,...pulse,
        origin:p(3,-4),direction:p(Math.cos(yaw)*scale,Math.sin(yaw)*scale)} as SkillStrike;
      for(const along of [-.1,0,pulse.range*.5,pulse.range+.01]) for(const across of [0,pulse.halfWidth*.9,pulse.halfWidth+.01]) for(const height of [0,2.5,2.7]) {
        Object.assign(enemy.p,p(3+Math.cos(yaw)*along-Math.sin(yaw)*across,-4+Math.sin(yaw)*along+Math.cos(yaw)*across,height));
        assert.equal(skillContains(strike,enemy.p),collectStrikeTargets([enemy],strike,terrain).length===1,`${identity}/${slot}: no preview/contact disagreement`);
      }
    }
  }
});
test('malformed geometry fails closed in preview and contact; blocked and pacified actors never consume target budget',()=>{
  const base:StrikeRequest={origin:p(0),direction:p(10),range:5,halfWidth:1,damage:30,maxTargets:1};
  const state=new WorldCombatState(['blocked','pacified','live'].map((id,i)=>({id,kind:'shade' as const,p:p(i+1)})),{id:'boss',kind:'king',p:p(100),requires:[]});
  state.enemies.forEach(e=>e.active=true); state.enemies[1].pacified=true;
  const cover={...terrain,lineOfSight:(_from:ReturnType<typeof p>,to:ReturnType<typeof p>)=>to.x!==1};
  assert.deepEqual(collectStrikeTargets(state.enemies,base,cover).map(e=>e.id),['live']);
  assert.equal(strikeContains(base,p(3)),true,'non-unit headings preserve metres');
  for(const invalid of [{range:Infinity},{halfWidth:NaN},{direction:p(0)},{direction:p(Number.MAX_VALUE,Number.MAX_VALUE)},{maxTargets:0},{damage:0},{losOffset:0},{casterFeetY:NaN}]) {
    const strike={...base,...invalid} as StrikeRequest;
    assert.equal(strikeContains(strike,p(3)),false);
    assert.deepEqual(collectStrikeTargets(state.enemies,strike,terrain),[]);
    assert.equal(skillContains({...strike,type:'strike',identity:null,slot:'skill',pulse:0,at:0},p(3)),false);
  }
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { WorldCombatState, COMBAT, type CombatTerrain } from '../src/combat';
const ground: CombatTerrain = { walk: (_p,x,z) => ({x,y:0,z}), lineOfSight: () => true };
for (const distance of [36,50,65,81]) test(`ranged damage persists beyond pursuit leash at ${distance}m until real defeat`, () => {
  const s = new WorldCombatState([{id:'target',kind:'shade',p:{x:0,y:0,z:0}}],[]), e=s.enemies[0];
  const p={x:distance,y:0,z:0}, origin={...p,y:1.05}; s.step(.05,p,true,ground);
  let shots=0;
  while (e.hp>0 && shots++<30) {
    assert.equal(s.raycast(origin,{x:-1,y:0,z:0},COMBAT.shotRange)?.id,e.id);
    const hp=e.hp; assert.equal(s.hitEnemy(e.id,16,{source:'ranged',origin}),true);
    assert.ok(e.hp<hp); const after=e.hp;
    for(let tick=0;tick<4;tick++)s.step(.05,p,true,ground);
    assert.equal(e.hp,after,'patrol return cannot silently undo a legitimate shot');
    if(e.hp>0) assert.equal(e.active,true,'no one-tick immunity when returning home');
  }
  assert.equal(e.mode,'dead'); assert.equal(s.drainEvents().filter(e=>e.type==='kill').length,1);
});
test('pursuit stays bounded, repeated boundary crossings retain damage, real despawn resets and story gates hold',()=>{
  const s=new WorldCombatState([{id:'wild_48',kind:'shade',p:{x:0,y:0,z:0}}],{id:'boss',kind:'king',p:{x:0,y:0,z:0},requires:['gate']});
  const e=s.enemies[0],p={x:40,y:0,z:0};s.step(.05,p,true,ground);s.hitEnemy(e.id,5);
  s.step(.05,p,true,ground);assert.equal(e.mode,'idle');assert.deepEqual(e.p,e.home);assert.equal(e.hp,e.maxHp-5);
  for(const x of [34,36,81,83,81,34,36]) {s.step(.05,{x,y:0,z:0},true,ground);assert.equal(e.hp,e.maxHp-5);}
  s.step(.05,{x:COMBAT.hideRange+1,y:0,z:0},true,ground);assert.equal(e.hp,e.maxHp);assert.equal(e.active,false);
  s.syncWorldFlags(new Set(['relay_b']));s.step(.05,{x:1,y:0,z:0},true,ground);
  assert.equal(e.mode,'pacified');assert.equal(s.hitEnemy(e.id,500),false);assert.equal(s.hitEnemy('boss',500),false);
  assert.equal(s.beginBoss(new Set()),false);assert.equal(s.beginBoss(new Set(['gate'])),true);assert.equal(s.hitEnemy('boss',5),true);
});

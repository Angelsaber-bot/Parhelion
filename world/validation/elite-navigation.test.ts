import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nearbyElite } from '../src/eliteNavigation.ts';
import { WorldCombatState } from '../src/combat.ts';
const enemy = () => new WorldCombatState([{id:'elite',kind:'crystal',miniboss:'elite_valley_sentinel',p:{x:100,y:0,z:0}}],[]).enemies[0];
test('elite hint uses real placed location without depending on combat activation',()=>{
 const e=enemy();assert.equal(e.active,false);
 const hint=nearbyElite([e],{x:0,y:0,z:0});assert.equal(hint?.distance,100);assert.deepEqual(hint?.direction,['东','E']);
 e.p={x:0,y:0,z:-100};assert.deepEqual(nearbyElite([e],{x:0,y:0,z:0})?.direction,['北','N']);
});
test('elite hints exclude dead, distant, other-region and ordinary mobs',()=>{
 const e=enemy(),p={x:0,y:0,z:0};e.mode='dead';assert.equal(nearbyElite([e],p),null);
 e.mode='idle';e.p.x=151;assert.equal(nearbyElite([e],p),null);
 e.p.x=100;e.home.x=720;assert.equal(nearbyElite([e],p),null);
 e.home.x=100;e.miniboss=undefined;assert.equal(nearbyElite([e],p),null);
});

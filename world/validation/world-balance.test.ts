import test from 'node:test';
import assert from 'node:assert/strict';
import {WORLD_RIFLE as R,rifleDistanceMultiplier} from '../src/worldBalance';
import {WorldCombatState,COMBAT,type CombatTerrain} from '../src/combat';
import {ADVENTURE as A} from '../src/openWorldCampaign';
const p=(x=0,z=0)=>({x,y:0,z});
const terrain:CombatTerrain={walk:(_from,x,z)=>p(x,z),lineOfSight:()=>true};
function make(role:'stalker'|'breaker'='stalker'){const s=new WorldCombatState([{id:'wild_test',kind:'shade',p:p(2),role}],{id:'boss',kind:'king',p:p(50),requires:[]});s.enemies[0].active=true;return s;}
test('balance: rifle sustained output leaves meaningful skill and enemy tell windows without HP inflation',()=>{
 const s=make(),e=s.enemies[0];assert.equal(e.hp,66);let shots=0,firstVent=0,time=0;
 for(let i=0;i<600;i++){if(s.canShoot()){shots++;if(s.gunVent>0&&!firstVent)firstVent=time;}s.step(1/120,p(20),true,terrain);time+=1/120;}
 assert.ok(shots<=18,`five-second automatic fire produced ${shots} shots`);assert.ok(firstVent>=.85&&firstVent<1.1);
 assert.ok(rifleDistanceMultiplier(40)<.4);assert.equal(R.enemyRange,70);assert.equal(COMBAT.bossHp,1800);
});
test('balance: armor rewards movement or recovery timing; Saber hit interrupt is bounded and cannot stunlock',()=>{
 const s=make('breaker'),e=s.enemies[0];e.mode='windup';e.timer=1;
 s.hitEnemy(e.id,12,{source:'ranged',origin:p(2)});assert.equal(e.hp,57.6);
 assert.ok(s.interruptEnemy(e.id));assert.equal(e.mode,'stagger');assert.equal(s.interruptEnemy(e.id),false);e.mode='windup';assert.equal(s.interruptEnemy(e.id),false);
 e.mode='recover';s.hitEnemy(e.id,12,{source:'ranged',origin:p(2)});assert.ok(Math.abs(e.hp-42)<.001);
});
test('balance: restored regions pacify wilderness across reload/reset without completing neighboring chapters',()=>{
 const s=new WorldCombatState([{id:'wild_test',kind:'shade',p:p(600,30)}],{id:'boss',kind:'king',p:p(50),requires:[]});
 const done=new Set([A.started,'sea_core','blackbeard_contract',A.departed]);s.syncWorldFlags(done);assert.equal(s.enemies[0].pacified,true);assert.equal(s.enemies[0].mode,'pacified');
 s.resetAll();s.syncWorldFlags(new Set());assert.equal(s.enemies[0].pacified,false);assert.equal(done.has('winter_core'),false);
});

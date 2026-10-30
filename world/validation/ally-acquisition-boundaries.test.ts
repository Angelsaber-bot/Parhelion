import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({load(url,context,next){return url.endsWith('.css')?{format:'module',source:'',shortCircuit:true}:next(url,context);}});
const { WorldCombat } = await import('../src/combatView');
import { WorldCombatState, type Point3 } from '../src/combat';

/** Isolated query/HP regression, intentionally synthetic terrain; production BVH
 * and actual animation contacts are separately exercised by companion-reliability-dom. */
function fixture(points:Point3[], sight:(a:Point3,b:Point3)=>boolean=()=>true){
 const state=new WorldCombatState(points.map((p,i)=>({id:`target-${i}`,kind:'shade' as const,p})),{id:'boss',kind:'king',p:{x:100,y:0,z:100},requires:[]});
 for(const e of state.enemies)if(e.kind!=='king'){e.active=true;e.mode='recover';}
 const view=Object.create(WorldCombat.prototype) as any;
 Object.assign(view,{state,playable:true,player:{x:0,y:0,z:0},allyCooldown:0,geometry:{terrain:{lineOfSight:sight}},events(){},spark(){}});
 return {view,state};
}
test('Blackbeard authored pistol range is not silently clamped to five metres',()=>{
 const {view,state}=fixture([{x:0,y:0,z:9}]); const hp=state.enemies[0].hp;
 assert.equal(view.allyTarget({x:0,y:0,z:0},12,undefined,'ranged')?.id,'target-0');
 assert.equal(view.allyStrike({x:0,y:0,z:0},12,12,'target-0','ranged')?.id,'target-0');
 assert.equal(state.enemies[0].hp,hp-12,'actual HP must decrease');
});
test('a nearer enemy behind a wall cannot starve a visible valid target',()=>{
 const {view,state}=fixture([{x:1,y:0,z:0},{x:0,y:0,z:2}],(_a,b)=>b.x!==1);
 assert.equal(view.allyTarget({x:0,y:0,z:0},3.5)?.id,'target-1');
 const hp=state.enemies[1].hp;view.allyStrike({x:0,y:0,z:0},3.5,14);
 assert.equal(state.enemies[1].hp,hp-14);assert.equal(state.enemies[0].hp,state.enemies[0].maxHp);
});
test('engage does not lock an unreachable ledge while ignoring reachable ground enemy',()=>{
 const {view}=fixture([{x:1,y:4,z:0},{x:0,y:0,z:3}]);
 assert.equal(view.allyEngage(15)?.id,'target-1');
});
test('contact revalidates wall, pacified and unstarted boss: none can lose HP',()=>{
 const {view,state}=fixture([{x:1,y:0,z:0}],()=>false);const target=state.enemies[0];
 assert.equal(view.allyStrike({x:0,y:0,z:0},12,12,target.id),null);assert.equal(target.hp,target.maxHp);
 view.geometry.terrain.lineOfSight=()=>true;target.pacified=true;
 assert.equal(view.allyStrike({x:0,y:0,z:0},12,12,target.id),null);assert.equal(target.hp,target.maxHp);
 const boss=state.enemies.find(e=>e.kind==='king')!;Object.assign(boss.p,{x:1,y:0,z:0});
 assert.equal(view.allyTarget({x:0,y:0,z:0},12,boss.id),null);assert.equal(boss.hp,boss.maxHp);
});
test('windup tracks through cooldown but contact cannot hit a moved-away or replacement enemy',()=>{
 const {view,state}=fixture([{x:0,y:0,z:2},{x:1,y:0,z:1}]);
 view.allyCooldown=.8;
 assert.equal(view.allyTarget({x:0,y:0,z:0},3.5,'target-0'),null);
 assert.equal(view.allyTrack({x:0,y:0,z:0},3.5,'target-0')?.id,'target-0');
 assert.equal(view.allyStrike({x:0,y:0,z:0},3.5,14,'target-0'),null);
 view.allyCooldown=0;state.enemies[0].p.z=8;
 assert.equal(view.allyStrike({x:0,y:0,z:0},3.5,14,'target-0'),null);
 for(const e of state.enemies)assert.equal(e.hp,e.maxHp,'missed authored contact cannot redirect damage');
});

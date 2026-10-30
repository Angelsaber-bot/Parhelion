import test from 'node:test';
import assert from 'node:assert/strict';
import {WorldCombatState} from '../src/combat';
import {resolveServantSkillAim} from '../src/skillAim';
import {collectStrikeTargets} from '../src/combatActions';
const p=(x:number,z:number,y=0)=>({x,y,z});
const clear={lineOfSight:()=>true,walk:(_f:any,x:number,z:number)=>p(x,z)};
function fixture(){const state=new WorldCombatState([{id:'target',kind:'stalker',p:p(0,0)},{id:'side',kind:'stalker',p:p(5,0)}],{id:'boss_vacant_king',kind:'king',p:p(100,100),requires:[]});for(const e of state.enemies){e.active=e.kind!=='king';}return state;}
test('servant on opposite side of an aimed enemy rotates toward enemy, not parallel to player',()=>{
 const s=fixture(),aim=resolveServantSkillAim({player:p(0,7),caster:p(0,-3),viewOrigin:p(0,10,1.5),viewDirection:p(0,-1),range:11,enemies:s.enemies,terrain:clear})!;
 assert.equal(aim.targetId,'target');assert.ok(aim.direction.z>.99);assert.deepEqual(aim.origin,p(0,-3));
 const strike={...aim,range:11,halfWidth:1.7,damage:46,maxTargets:3};const hits=collectStrikeTargets(s.enemies,strike,clear);assert.equal(hits[0].id,'target');
 const before=s.enemies[0].hp;s.hitEnemy(hits[0].id,strike.damage,{source:'skill',origin:aim.origin});assert.ok(s.enemies[0].hp<before);
});
test('aim assistance never selects occluded, high-floor, pacified, inactive or dead targets',()=>{
 for(const reason of ['blocked','height','peace','inactive','dead']){
  const s=fixture();s.enemies[1].active=false;const e=s.enemies[0];if(reason==='height')e.p.y=4;if(reason==='peace')e.pacified=true;if(reason==='inactive')e.active=false;if(reason==='dead')e.mode='dead';
  const aim=resolveServantSkillAim({player:p(0,7),caster:p(0,-3),viewOrigin:p(0,10,1.5),viewDirection:p(0,-1),range:11,enemies:s.enemies,terrain:{lineOfSight:()=>reason!=='blocked'}})!;
  assert.equal(aim.targetId,undefined,reason);
 }
});
test('caster range is authoritative and free aiming remains finite without a valid target',()=>{
 const s=fixture(),args={player:p(0,7),caster:p(0,-20),viewOrigin:p(0,10,1.5),viewDirection:p(0,-1),range:11,enemies:s.enemies,terrain:clear};
 assert.equal(resolveServantSkillAim(args)?.targetId,undefined);
 assert.equal(resolveServantSkillAim({...args,viewDirection:p(0,0)}),null);
 assert.equal(resolveServantSkillAim({...args,caster:p(NaN,0)}),null);
 const a=resolveServantSkillAim({...args,caster:p(0,-4),enemies:[]})!;assert.ok([a.direction.x,a.direction.z].every(Number.isFinite));assert.ok(Math.abs(Math.hypot(a.direction.x,a.direction.z)-1)<1e-8);
});
test('visible aim-nearest target is selected independently of array order; camera and caster LOS both required',()=>{
 const s=fixture(),args={player:p(0,7),caster:p(1,4),viewOrigin:p(0,10,2),viewDirection:p(0,-1),range:11,enemies:s.enemies,terrain:clear};
 assert.equal(resolveServantSkillAim(args)?.targetId,'target');assert.equal(resolveServantSkillAim({...args,enemies:[...s.enemies].reverse()})?.targetId,'target');
 assert.equal(resolveServantSkillAim({...args,terrain:{lineOfSight:(from)=>from.y!==2}})?.targetId,undefined);
});

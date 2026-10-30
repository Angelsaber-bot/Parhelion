import test from 'node:test';
import assert from 'node:assert/strict';
import { PlayerMelee, PlayerEvade } from '../src/playerMelee.ts';
test('melee has one timed contact and ignores early spam', () => {
 const m=new PlayerMelee(); assert.equal(m.press(1),true); assert.equal(m.press(2),false);
 const contacts=[];for(let i=0;i<35;i++){const hit=m.update(1/60,true);if(hit)contacts.push(hit);}
 assert.equal(contacts.length,1);assert.equal(contacts[0].yaw,1);assert.equal(m.active,false);
});
test('combo requires late input, caps at three, and reset clears pending contact',()=>{
 const m=new PlayerMelee();m.press(0);const contacts=[];
 for(let i=0;i<160;i++){if(m.active&&m.phase>.6)m.press(0);const c=m.update(1/60,true);if(c)contacts.push(c);}
 assert.deepEqual(contacts.map(x=>x.combo),[0,1,2]);assert.ok(contacts[2].damage>contacts[0].damage);
 m.press(0);m.update(.1,true);m.reset();for(let i=0;i<20;i++)assert.equal(m.update(.1,true),null);
});
test('pause cancels hidden attacks, invalid dt never advances, cooldown cannot reset by cancel spam',()=>{
 const m=new PlayerMelee();m.press(0);assert.equal(m.update(NaN,true),null);assert.equal(m.phase,0);m.update(.1,false);assert.equal(m.active,false);assert.equal(m.press(0),false);m.update(.1,true);m.update(.1,true);assert.equal(m.press(0),true);
});
test('evade snapshots unit direction, is bounded and cancels without resetting cooldown',()=>{
 const e=new PlayerEvade();assert.equal(e.start(3,4),true);assert.equal(e.start(0,1),false);assert.equal(Math.hypot(e.x,e.z),1);e.update(.1,false);assert.equal(e.active,false);assert.ok(e.cooldown>1);for(let i=0;i<15;i++)e.update(.1,true);assert.equal(e.start(0,0),false);assert.equal(e.start(0,1),true);e.reset();assert.equal(e.cooldown,0);
});

/** Authored arena collision proof, not rendered visual or human playtest acceptance. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Player } from '../src/player.ts';
import { WorldCombatState, enemyAttackContains } from '../src/combat.ts';
import { layout, q, colliders } from './enemy-live-terrain.fixture.ts';

for(const id of ['boss_winter_warden','boss_hellfire_lord']) test(`${id}: actual delivered arena supports the new midrange counter at eight headings`,()=>{
  const marker=layout.markers.find(m=>m.id===id)!;
  assert.ok(marker);
  for(let heading=0;heading<8;heading++) {
    const angle=heading*Math.PI/4, dx=Math.cos(angle), dz=Math.sin(angle);
    const x=marker.p[0]+dx*6.5,z=marker.p[2]+dz*6.5;
    const support=q.ground(x,z,marker.p[1]+3);assert.ok(support);
    assert.ok(support.point.y>layout.world.waterLevel+.45);
    const player=new Player(colliders,layout.world.waterLevel);
    player.teleport(x,support.point.y+.05,z);
    const idle={x:0,z:0,jump:false,sprint:false};
    for(let i=0;i<30;i++) player.step(1/120,idle);
    assert.ok(player.onGround,`heading ${heading}: starts on actual collision surface`);
    const state=new WorldCombatState([],{id,kind:'king',p:{x:marker.p[0],y:marker.p[1]+.05,z:marker.p[2]},requires:[]});
    state.beginBoss(new Set());const e=state.boss;
    e.phase=2;e.attackCount=id==='boss_winter_warden'?1:2;e.mode='chase';e.timer=0;
    state.step(.05,player.pos,true,q.terrain);
    assert.equal(e.mode,'windup');assert.equal(e.attack,'thrust');
    assert.equal(enemyAttackContains(e,player.pos),true);
    const target={...e.target};let ticks=0;
    while(e.mode==='windup' && ticks<240) {
      // Tangential walk after .3s; no teleport, flying, sprint or immunity.
      const reacted=ticks>=36;
      player.step(1/120,{...idle,x:reacted?-dz:0,z:reacted?-dx:0});
      ticks++;
      if(ticks%6===0) state.step(.05,player.pos,true,q.terrain);
    }
    assert.equal(e.mode,'recover');assert.equal(state.hp,100,`heading ${heading}: actual arena sidestep is safe`);
    assert.deepEqual(e.target,target);
    assert.ok(player.onGround && !player.swimming,`heading ${heading}: counter must not require falling off the arena`);
    assert.ok(Math.abs(player.pos.y-support.point.y)<.35);
  }
});

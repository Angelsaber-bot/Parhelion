import test from 'node:test';
import assert from 'node:assert/strict';
import {bootWorldWithoutGpu} from './world-dom-boot.fixture';
import {flagPuzzle,flagCamp,campEncounterId} from '../src/exploration/catalog';
test('cloister edge waits for next-wave admission without losing a cleared wave; pause cannot start enemies',async()=>{
 const h=await bootWorldWithoutGpu({deterministic:true}),w=h.world,xp=w.exploration;
 const original=w.combat.startStoryEncounter;let calls=0,allow=true;
 w.combat.startStoryEncounter=()=>{calls++;return {ok:allow,reason:allow?'started':'out-of-range'};};
 try{
  w.done.add(flagPuzzle('oath_cloister'));
  const rt=xp.state.camps.get('oath_cloister');
  w.player.teleport(-850,rt.y,34);w.player.onGround=true;
  xp.update(.01,w.player,'britain',true);assert.equal(rt.running,true);
  xp.victory(campEncounterId('oath_cloister',0));assert.equal(rt.wave,1);
  allow=false;w.player.teleport(-830,rt.y,34);
  xp.update(2,w.player,'britain',true);
  assert.equal(rt.wave,1);assert.ok(rt.pending>0);assert.equal(w.done.has(flagCamp('oath_cloister')),false);
  const before=calls;xp.update(20,w.player,'britain',false);assert.equal(calls,before);
  xp.update(2,w.player,'britain',true);assert.equal(rt.wave,1);
  allow=true;w.player.teleport(-850,rt.y,34);xp.update(2,w.player,'britain',true);
  assert.equal(rt.wave,1);assert.equal(rt.running,true);
  xp.victory(campEncounterId('oath_cloister',1));allow=false;w.player.teleport(-800,rt.y,34);
  xp.update(2,w.player,'britain',true);assert.equal(rt.wave,0,'deliberately leaving the encounter still abandons it');
  xp.reset();assert.equal(rt.pending,0);
 }finally{w.combat.startStoryEncounter=original;await h.close();}
});

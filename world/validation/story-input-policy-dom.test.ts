/** Policy helper verification: entry positioning/admission are explicit test setup,
 * never behavior hidden inside the reusable input driver. No hostile HP writes. */
import test from 'node:test';import assert from 'node:assert/strict';
import {bootWorldWithoutGpu} from './world-dom-boot.fixture';import {getFalseDawnEncounterSpec} from '../src/falseDawnEncounterCatalog';
import {createStoryInputPolicy} from './combat-review/story-input-policy';
test('normal-input helper accepts caller-owned clock and clears a live Warden using remapped controls without placement or damage hooks',async()=>{
 const h=await bootWorldWithoutGpu({deterministic:true,initialStorage:{'parhelion.world.progress.v2':JSON.stringify({done:['armory_rack'],found:[]})}}),{world:w,window}=h;let now=0;
 const step=()=>h.frame(now+=1000/60),spec=getFalseDawnEncounterSpec('false_dawn_warden')!;
 try{
  (window.document.getElementById('start')as HTMLElement).click();await Promise.resolve();const x=spec.anchor.x+7,z=spec.anchor.z+1.85,g=w.combat.geometry.ground(x,z,spec.anchor.y+4);assert.ok(g);w.player.teleport(x,g.point.y+.04,z);step();await h.settleAssets();for(let i=0;i<60&&!w.player.onGround;i++)step();assert.equal(w.player.onGround,true);
  const freeBinding=['KeyJ','KeyY','KeyK','KeyP','KeyL'].find(code=>!w.settings.action(code));assert.ok(freeBinding);assert.equal(w.settings.bind('fire',freeBinding),null);assert.equal(w.settings.bind('right','ArrowRight'),null);w.settings.update({invertY:true});
  assert.equal(w.combat.startStoryEncounter(spec,{position:w.player.pos,playable:true}).ok,true);
  let teleports=0;const teleport=w.player.teleport.bind(w.player);w.player.teleport=(...args:any[])=>{teleports++;return teleport(...args);};
  const policy=createStoryInputPolicy({world:w,window,nowSeconds:()=>now/1000,step},{reactionSeconds:.7});
  const result=policy.run(30);assert.equal(result.defeated,false);assert.equal(result.remaining,null);assert.equal(result.seenIds.length,1);assert.ok(result.seconds<12);assert.ok(result.hp>0);assert.equal(teleports,0);assert.ok(w.actions.skills.energy>0,'only actual normal weapon damage earned charge');
  const hp=w.combat.state.hp,energy=w.actions.skills.energy;for(let i=0;i<30;i++){policy.tick();step();}assert.equal(w.combat.state.hp,hp);assert.equal(w.actions.skills.energy,energy);policy.release();assert.deepEqual(h.errors,[]);assert.deepEqual(h.warnings,[]);
 }finally{await h.close();}
});

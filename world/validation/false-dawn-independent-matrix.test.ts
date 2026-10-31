/** Independent actual-main keyboard route matrix. NON-GPU, teleport skips travel,
 * damage injection isolates progress transactions; NOT a balance/playthrough claim. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {bootWorldWithoutGpu} from './world-dom-boot.fixture';
import {FALSE_DAWN as F,getFalseDawnState} from '../src/falseDawnCampaign';
import {WorldProgress} from '../src/progress';
test('all four False Dawn route/ending pairs require explicit keyboard choices and preserve retry/replay transactions',async t=>{
 const h=await bootWorldWithoutGpu({worldRoot:process.env.WORLD_SOURCE_QA_ROOT,deterministic:true});const {world:w,window}=h,d=window.document;let time=0;const checkHud=!process.env.WORLD_SOURCE_QA_ROOT||process.env.WORLD_EXPECT_TRACKED_HUD==='1';
 const key=(code:string)=>{for(const type of ['keydown','keyup'])d.body.dispatchEvent(new window.KeyboardEvent(type,{code,bubbles:true,cancelable:true}));};
 const frame=(n=1)=>{for(let i=0;i<n;i++)h.frame(time+=1000/60);};
 const close=()=>{for(let i=0;w.narrative.open&&!w.narrative.choosing&&i<60;i++)key('KeyF');};
 const at=(id:string)=>{const m=w.layout.markers.find((m:any)=>m.id===id);assert.ok(m,id);const x=m.p[0],z=m.p[2]+.65,g=w.combat.geometry.ground(x,z,m.p[1]+3);assert.ok(g);w.player.teleport(x,g.point.y+.04,z);w.player.onGround=true;w.player.flying=w.player.swimming=w.player.gliding=false;};
 const inspect=(id:string)=>{close();at(id);key('KeyF');assert.ok(w.narrative.open,id);};
 const choice=(id:string)=>{close();assert.ok(w.narrative.choosing,id);const before=[...w.done].sort();key('KeyF');assert.deepEqual([...w.done].sort(),before,'F without selection cannot mutate');const buttons=[...d.querySelectorAll<HTMLButtonElement>('#world-dialogue-choices [data-choice]')];const index=buttons.findIndex(b=>b.dataset.choice===id);assert.ok(index>=0&&index<9,id);const pos=w.player.pos.clone();key(`Digit${index+1}`);assert.equal(w.player.pos.distanceTo(pos),0,'selection digit cannot teleport');key('KeyF');};
 const start=(station:string,id:string)=>{inspect(station);choice(`start:${id}`);assert.equal(w.combat.storyEncounter?.id,id);assert.equal(w.narrative.open,false);frame(2);};
 const victory=()=>{const actors=w.combat.state.enemies.filter((e:any)=>e.storyEncounter);assert.ok(actors.length&&actors.length<=3);for(const e of actors)w.combat.damageEnemy(e.id,10000,{source:'ranged',origin:w.player.pos});frame();assert.equal(w.combat.storyEncounter,null);};
 try{
  for(const route of ['harbor','winter']as const)for(const ending of ['repurpose','seal']as const)await t.test(`${route}/${ending}`,async()=>{
   d.exitPointerLock();w.worldProgress.reset();w.falseDawnRuntime.invalidate();w.combat.reset();for(const flag of ['armory_rack',F.receiver])w.done.add(flag);w.worldProgress.save();(d.getElementById('start')as HTMLElement).click();await Promise.resolve();
   if(checkHud)assert.equal(d.getElementById('world-tracked-story'),null,'no context before explicit pin');
   (d.getElementById('world-campaign-journal-open')as HTMLButtonElement).click();
   const pin=d.querySelector<HTMLButtonElement>('[data-false-dawn-track]')!;assert.ok(pin&&!pin.disabled);pin.click();(d.getElementById('start')as HTMLElement).click();await Promise.resolve();frame(8);
   if(checkHud){const hud=d.getElementById('world-tracked-story')!;assert.ok(hud);assert.ok(d.getElementById('objective')!.children.length>1,'original objective remains alongside pinned context');}
   assert.match(d.querySelector('#guide .label')!.textContent!,/伪晓回声|False Dawn/);
   start(F.recorder,'false_dawn_courier');
   // Leaving the encounter is never a victory; return requires deliberate start.
   w.player.teleport(3000,50,3000);frame(3);assert.equal(w.combat.storyEncounter,null);assert.equal(getFalseDawnState(w.done).stage,'courier');
   start(F.recorder,'false_dawn_courier');victory();inspect(F.recorder);choice(`route_${route}`);close();frame(8);
   if(checkHud)assert.match(d.getElementById('world-tracked-story')!.textContent!,/召唤阵|summoning circle/,'blocked route explains gate without discarding pin');
   assert.equal(w.done.has('summon_circle'),false,'optional progression cannot invent route unlock');
   assert.doesNotMatch(d.querySelector('#guide .label')!.textContent!,/伪晓回声|False Dawn/,'remote locked pin falls back to original story');
   w.done.add('summon_circle');frame();assert.match(d.querySelector('#guide .label')!.textContent!,/伪晓回声|False Dawn/,'pin intent resumes only after real route flag');
   const station=route==='harbor'?F.harbor:F.winter;start(station,route==='harbor'?'false_dawn_harbor':'false_dawn_winter_1');victory();
   if(route==='winter'){start(station,'false_dawn_winter_2');victory();}
   inspect(station);choice('key_living');close();start(F.array,'false_dawn_array');
   at(F.emitters[1]);const wrong=[...w.done].sort();key('KeyF');assert.deepEqual([...w.done].sort(),wrong);assert.equal(w.narrative.open,false);
   at(F.emitters[0]);key('KeyF');assert.ok(w.done.has(F.anchors[0]));w.combat.cancelStoryEncounter();assert.ok(new WorldProgress(window.localStorage).done.has(F.anchors[0]));
   start(F.array,'false_dawn_array');for(const id of F.emitters){at(id);key('KeyF');assert.equal(w.narrative.open,false);}victory();
   start(F.array,'false_dawn_warden');victory();assert.equal(getFalseDawnState(w.done).stage,'ending');inspect(F.array);choice(`ending_${ending}`);close();frame(8);if(checkHud)assert.equal(d.getElementById('world-tracked-story'),null,'complete arc drops contextual block');
   assert.equal(getFalseDawnState(w.done).ending,ending);assert.equal(getFalseDawnState(new WorldProgress(window.localStorage).done).ending,ending);
   const complete=[...w.done].sort();inspect(F.array);close();assert.deepEqual([...w.done].sort(),complete,'replay cannot grant another ending/reward');assert.equal(w.done.has('sun_core'),false);assert.equal(w.done.has('sea_core'),false);
  });
  assert.deepEqual(h.errors,[]);
 }finally{await h.close();}
});

/** NON-GPU production contact compatibility, NOT a balance playthrough.
 * Old-save flags, one entry teleport and full charge are fixtures. Hostile roster,
 * positions, HP, attack clocks and all damage remain production-owned. */
import test from 'node:test';import assert from 'node:assert/strict';
import {bootWorldWithoutGpu} from './world-dom-boot.fixture';
import {getFalseDawnEncounterSpec} from '../src/falseDawnEncounterCatalog';
test('story roster accepts real companion ultimate/normal fire, pause and cancellation without stale-target victory',async t=>{
 const h=await bootWorldWithoutGpu({deterministic:true,initialStorage:{'parhelion.world.progress.v2':JSON.stringify({done:['armory_rack','saber_contract'],found:[]})}}),{world:w,window}=h,d=window.document;let now=0;
 const frame=(n=1)=>{for(let i=0;i<n;i++)h.frame(now+=1000/60);};
 const key=(code:string)=>{for(const type of ['keydown','keyup'])d.body.dispatchEvent(new window.KeyboardEvent(type,{code,bubbles:true,cancelable:true}));};
 const aim=(e:any)=>{const dx=e.p.x-w.camera.position.x,dz=e.p.z-w.camera.position.z,dy=e.p.y+1-w.camera.position.y,yaw=Math.atan2(-dx,-dz),pitch=Math.atan2(dy,Math.hypot(dx,dz)),sens=.0022*w.settings.value.sensitivity*(1+(w.settings.value.adsSensitivity-1)*w.aim.value);const event=new window.MouseEvent('mousemove',{bubbles:true});Object.defineProperties(event,{movementX:{value:Math.atan2(Math.sin(w.player.yaw-yaw),Math.cos(w.player.yaw-yaw))/sens},movementY:{value:(w.player.pitch-pitch)/sens}});d.dispatchEvent(event);};
 const mouse=(down:boolean)=>window.dispatchEvent(new window.MouseEvent(down?'mousedown':'mouseup',{button:0,bubbles:true,cancelable:true}));
 const spec=getFalseDawnEncounterSpec('false_dawn_array')!,victories:string[]=[],hits:any[]=[];
 const originalVictory=w.combat.options.onStoryEncounterVictory;w.combat.options.onStoryEncounterVictory=(id:string)=>{victories.push(id);originalVictory?.(id);};
 const record=w.actions.recordDamage.bind(w.actions);w.actions.recordDamage=(hit:any)=>{hits.push({...hit});return record(hit);};
 const start=async()=>{const x=spec.anchor.x,z=spec.anchor.z-6,g=w.combat.geometry.ground(x,z,spec.anchor.y+4);assert.ok(g);w.player.teleport(x,g.point.y+.04,z);w.player.onGround=true;frame(2);await h.settleAssets();frame(30);assert.equal(w.combat.startStoryEncounter(spec,{position:w.player.pos,playable:true}).ok,true);const actors=w.combat.state.enemies.filter((e:any)=>e.storyEncounter);assert.equal(actors.length,3);for(let i=0;i<6;i++){aim(actors[0]);frame();}return actors;};
 try{
  (d.getElementById('start')as HTMLElement).click();await Promise.resolve();w.ultimateDirector.setMode('full');
  const actors=await start();w.actions.skills.energyValue=100;key('KeyX');assert.equal(w.ultimateDirector.active,true);assert.equal(w.actions.skills.energy,0);
  const snapshot=actors.map((e:any)=>({hp:e.hp,timer:e.timer,mode:e.mode,p:{...e.p}}));
  Object.defineProperty(d,'visibilityState',{value:'hidden',configurable:true});d.dispatchEvent(new window.Event('visibilitychange'));frame(90);assert.deepEqual(actors.map((e:any)=>({hp:e.hp,timer:e.timer,mode:e.mode,p:{...e.p}})),snapshot,'hidden ultimate cannot run story attacks or damage');
  Object.defineProperty(d,'visibilityState',{value:'visible',configurable:true});d.dispatchEvent(new window.Event('visibilitychange'));window.dispatchEvent(new window.Event('focus'));
  for(let i=0;i<1200&&w.ultimateDirector.active;i++)frame();assert.equal(w.ultimateDirector.active,false);assert.ok(hits.some(hit=>hit.source==='ultimate'&&hit.id.startsWith('story_')),'native companion contact damages live story roster');
  mouse(true);for(let i=0;i<1800&&w.combat.storyEncounter&&!w.combat.defeated;i++){const target=actors.find((e:any)=>e.hp>0);if(target)aim(target);frame();}mouse(false);assert.equal(w.combat.defeated,false);assert.ok(actors.every((e:any)=>e.hp===0));frame(10);assert.deepEqual(victories,[spec.id]);
  await t.test('cancel before native contact leaves no victory and retry never aliases captured IDs',async()=>{
   w.actions.reset();const retry=await start();const oldIds=retry.map((e:any)=>e.id);w.actions.skills.energyValue=100;hits.length=0;key('KeyX');assert.equal(w.ultimateDirector.active,true);w.combat.cancelStoryEncounter();assert.equal(w.combat.storyEncounter,null);
   assert.equal(w.combat.startStoryEncounter(spec,{position:w.player.pos,playable:false}).reason,'unavailable','fresh cinematic admission rejects another roster');
   for(let i=0;i<1200&&w.ultimateDirector.active;i++)frame();assert.equal(hits.filter(hit=>oldIds.includes(hit.id)).length,0);assert.deepEqual(victories,[spec.id]);
   const next=await start();assert.ok(next.every((e:any)=>!oldIds.includes(e.id)));w.combat.cancelStoryEncounter();frame(10);assert.deepEqual(victories,[spec.id]);
  });
  w.actions.reset();w.actions.skills.energyValue=100;frame(2);key('KeyX');assert.equal(w.ultimateDirector.active,false);assert.equal(w.actions.skills.energy,100,'empty story field cannot charge a companion ultimate');
  assert.deepEqual(h.errors,[]);assert.deepEqual(h.warnings,[]);
 }finally{await h.close();}
});

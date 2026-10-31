/** Event/clock audit with explicit entry-position fixtures and mocked GPU. */
import test from 'node:test';import assert from 'node:assert/strict';
import {bootWorldWithoutGpu} from './world-dom-boot.fixture';
import {getFalseDawnEncounterSpec} from '../src/falseDawnEncounterCatalog';
test('first visible frame cannot charge hidden wall time to an already winding-up enemy',async()=>{
 const h=await bootWorldWithoutGpu({deterministic:true,initialStorage:{'parhelion.world.progress.v2':'{"done":["armory_rack"],"found":[]}'}}),w=h.world,d=h.window.document;let now=0;
 const frame=(ms=1000/60)=>h.frame(now+=ms);
 try{
  (d.getElementById('start')as HTMLElement).click();await Promise.resolve();const spec=getFalseDawnEncounterSpec('false_dawn_courier')!;assert.ok(spec);
  const x=spec.anchor.x,z=spec.anchor.z-3,g=w.combat.geometry.ground(x,z,spec.anchor.y+4);assert.ok(g);w.player.teleport(x,g.point.y+.04,z);for(let i=0;i<60;i++)frame();
  assert.equal(w.combat.startStoryEncounter(spec,{position:w.player.pos,playable:true}).ok,true);const enemy=w.combat.state.enemies.find((e:any)=>e.storyEncounter);assert.ok(enemy);
  for(let i=0;i<1200&&!(enemy.mode==='windup'&&enemy.timer<.07);i++)frame();assert.equal(enemy.mode,'windup');assert.ok(enemy.timer<.07);
  for(const type of ['keydown','keyup'])d.body.dispatchEvent(new h.window.KeyboardEvent(type,{code:'KeyQ',bubbles:true}));
  assert.ok(w.actions.skills.cooldown('skill')>0);
  const snapshot=()=>({hp:w.combat.state.hp,timer:enemy.timer,mode:enemy.mode,p:w.player.pos.toArray(),cooldown:w.actions.skills.cooldown('skill')});
  const before=snapshot();
  Object.defineProperty(d,'visibilityState',{configurable:true,value:'hidden'});d.dispatchEvent(new h.window.Event('visibilitychange'));
  // No RAF callbacks while backgrounded, matching a throttled browser.
  Object.defineProperty(d,'visibilityState',{configurable:true,value:'visible'});d.dispatchEvent(new h.window.Event('visibilitychange'));
  frame(60000);const after=snapshot();
  assert.deepEqual(after,before,JSON.stringify({before,after}));
  const start=async()=>{(d.getElementById('start')as HTMLElement).click();await Promise.resolve();};
  const canvas=d.getElementById('view')!;
  const transitions:[string,()=>Promise<void>|void][]=[
   ['blur/focus',()=>{h.window.dispatchEvent(new h.window.Event('blur'));h.window.dispatchEvent(new h.window.Event('focus'));}],
   ['pointer lock',async()=>{d.exitPointerLock();await start();}],
   ['settings menu',async()=>{w.settingsPanel.show();w.settingsPanel.close();await start();}],
   ['graphics recovery',async()=>{canvas.dispatchEvent(new h.window.Event('webglcontextlost',{cancelable:true}));canvas.dispatchEvent(new h.window.Event('webglcontextrestored'));await start();}],
   ['repeated transitions',()=>{for(let i=0;i<3;i++){h.window.dispatchEvent(new h.window.Event('blur'));Object.defineProperty(d,'visibilityState',{configurable:true,value:'hidden'});d.dispatchEvent(new h.window.Event('visibilitychange'));Object.defineProperty(d,'visibilityState',{configurable:true,value:'visible'});d.dispatchEvent(new h.window.Event('visibilitychange'));h.window.dispatchEvent(new h.window.Event('focus'));}}],
  ];
  for(const [name,transition]of transitions){const saved=snapshot();await transition();frame(60000);assert.deepEqual(snapshot(),saved,name);}
  const cd=w.actions.skills.cooldown('skill'),combatAcc=w.combat.acc;frame();assert.ok(Math.abs(w.actions.skills.cooldown('skill')-(cd-1/60))<1e-8);const expectedAcc=combatAcc+1/60-Math.floor((combatAcc+1/60+1e-9)/.05)*.05;assert.ok(Math.abs(w.combat.acc-expectedAcc)<1e-8,'20Hz enemy budget consumes only elapsed visible fixed steps');
  const activeCd=w.actions.skills.cooldown('skill');frame(1000);assert.ok(Math.abs(w.actions.skills.cooldown('skill')-(activeCd-.1))<1e-8,'ordinary active long frames retain100ms clamp');
  assert.deepEqual(h.errors,[]);
 }finally{await h.close();}
});

test('hidden cinematic time is discarded at resume while subsequent visible time still reaches native contact',async()=>{
 const h=await bootWorldWithoutGpu({deterministic:true,initialStorage:{'parhelion.world.progress.v2':'{"done":["armory_rack","saber_contract"],"found":[]}'}}),w=h.world,d=h.window.document;let now=0;
 const frame=(ms=1000/60)=>h.frame(now+=ms),key=(code:string)=>{for(const type of ['keydown','keyup'])d.body.dispatchEvent(new h.window.KeyboardEvent(type,{code,bubbles:true}));};
 try{
  (d.getElementById('start')as HTMLElement).click();await Promise.resolve();w.ultimateDirector.setMode('full');const spec=getFalseDawnEncounterSpec('false_dawn_array')!,x=spec.anchor.x,z=spec.anchor.z-6,g=w.combat.geometry.ground(x,z,spec.anchor.y+4);assert.ok(g);w.player.teleport(x,g.point.y+.04,z);
  for(let i=0;i<60;i++)frame();await h.settleAssets();assert.equal(w.combat.startStoryEncounter(spec,{position:w.player.pos,playable:true}).ok,true);
  const actor=w.combat.state.enemies.find((e:any)=>e.storyEncounter);for(let i=0;i<6;i++){const dx=actor.p.x-w.camera.position.x,dz=actor.p.z-w.camera.position.z,dy=actor.p.y+1-w.camera.position.y,yaw=Math.atan2(-dx,-dz),pitch=Math.atan2(dy,Math.hypot(dx,dz)),sens=.0022*w.settings.value.sensitivity,event=new h.window.MouseEvent('mousemove',{bubbles:true});Object.defineProperties(event,{movementX:{value:Math.atan2(Math.sin(w.player.yaw-yaw),Math.cos(w.player.yaw-yaw))/sens},movementY:{value:(w.player.pitch-pitch)/sens}});d.dispatchEvent(event);frame();}
  // Explicit charge/entry fixtures; actual native contact and hostile HP remain production-owned.
  w.actions.skills.energyValue=100;key('KeyX');assert.ok(w.ultimateDirector.active);for(let i=0;i<6;i++)frame();
  const elapsed=w.ultimateDirector.frame.elapsed,hp=actor.hp;
  Object.defineProperty(d,'visibilityState',{configurable:true,value:'hidden'});d.dispatchEvent(new h.window.Event('visibilitychange'));h.window.dispatchEvent(new h.window.Event('blur'));
  Object.defineProperty(d,'visibilityState',{configurable:true,value:'visible'});d.dispatchEvent(new h.window.Event('visibilitychange'));h.window.dispatchEvent(new h.window.Event('focus'));
  frame(120000);assert.equal(w.ultimateDirector.frame.elapsed,elapsed);assert.equal(actor.hp,hp);assert.equal(w.actions.skills.energy,0);
  frame();assert.ok(Math.abs(w.ultimateDirector.frame.elapsed-(elapsed+1/60))<1e-8);
  for(let i=0;i<1200&&actor.hp===hp;i++)frame();assert.ok(actor.hp<hp,'normal visible time still reaches original native damage');assert.deepEqual(h.errors,[]);
 }finally{await h.close();}
});

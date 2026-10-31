/** Actual-main RAF cadence matrix; original120Hz physics and normal input.
 * Only armory-save and one supported entry per case are setup; no state forcing. */
import test from 'node:test';import assert from 'node:assert/strict';import {bootWorldWithoutGpu}from'./world-dom-boot.fixture';
test('admitted downhill contacts and guard release are stable at30/120Hz rendered cadence',async t=>{
 const h=await bootWorldWithoutGpu({deterministic:true,initialStorage:{'parhelion.world.progress.v2':JSON.stringify({done:['armory_rack'],found:[]})}}),{world:w,window}=h,d=window.document;let now=0,hz=60;
 const frame=(n=1)=>{for(let i=0;i<n;i++)h.frame(now+=1000/hz);};
 const key=(action:string,down:boolean)=>d.body.dispatchEvent(new window.KeyboardEvent(down?'keydown':'keyup',{code:w.settings.bindingsFor(action)[0],bubbles:true,cancelable:true}));
 const contacts:string[]=[],calls:any[]=[];const strike=w.actions.options.strike;w.actions.options.strike=(...args:any[])=>{contacts.push(args[1]);return strike(...args);};
 const step=w.player.step.bind(w.player);w.player.step=(...args:any[])=>{calls.push({dt:args[0],admitted:args[2]===true,owned:!!(w.actions.melee.active||w.actions.skills.casting||w.actions.skills.guarding),guardOnly:!!(w.actions.skills.guarding&&!w.actions.skills.casting&&!w.actions.melee.active)});return step(...args);};
 try{
  (d.getElementById('start')as HTMLElement).click();await Promise.resolve();frame();await h.settleAssets();
  for(const rate of[30,120])for(const action of['melee','skill']){
   hz=rate;const ground=w.combat.geometry.ground(-45,-98.8,30);assert.ok(ground);w.player.teleport(-45,ground.point.y+.08,-98.8);frame(hz*10);assert.ok(w.player.onGround);
   const yaw=Math.atan2(w.player.pos.x+52,w.player.pos.z+85),delta=Math.atan2(Math.sin(w.player.yaw-yaw),Math.cos(w.player.yaw-yaw)),event=new window.MouseEvent('mousemove',{bubbles:true});Object.defineProperties(event,{movementX:{value:delta/(.0022*w.settings.value.sensitivity)},movementY:{value:0}});d.dispatchEvent(event);frame();
   contacts.length=0;calls.length=0;const recovered=w.player.evadeSupport.diagnostics.recovered;key('forward',true);key(action,true);key(action,false);assert.ok(action==='melee'?w.actions.melee.active:w.actions.skills.casting);
   frame(Math.ceil(hz*1.4));key('forward',false);assert.deepEqual(contacts,[action]);assert.ok(w.player.evadeSupport.diagnostics.recovered>recovered);assert.ok(calls.every(c=>Math.abs(c.dt-1/120)<1e-12));assert.ok(calls.every(c=>c.admitted===c.owned));assert.ok(calls.some(c=>c.admitted));if(action==='skill')assert.ok(calls.some(c=>c.guardOnly&&c.admitted));assert.equal(w.actions.melee.active||w.actions.skills.casting||w.actions.skills.guarding,false);
   const probes=w.player.evadeSupport.diagnostics.supportPasses;frame(hz);assert.equal(w.player.evadeSupport.diagnostics.supportPasses,probes,'finished action adds no recovery queries');assert.equal(contacts.length,1,'no delayed duplicate contact');t.diagnostic(JSON.stringify({hz,action,physicsSteps:calls.length,guardSteps:calls.filter(c=>c.guardOnly).length,recovered:w.player.evadeSupport.diagnostics.recovered-recovered}));
  }
  assert.deepEqual(h.errors,[]);
 }finally{key('forward',false);await h.close();}
});

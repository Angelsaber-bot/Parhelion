/** Browser events + real production simulation; renderer is a no-GPU boundary.
 * Encounter entry/admission setup isolates recovery, not narrative or balance. */
import test from 'node:test';import assert from 'node:assert/strict';
import {bootWorldWithoutGpu} from './world-dom-boot.fixture';
import {getFalseDawnEncounterSpec} from '../src/falseDawnEncounterCatalog';
test('repeated graphics recovery preserves live contact buffers and actor timers across BFCache without stale input replay',async()=>{
 const h=await bootWorldWithoutGpu({deterministic:true,initialStorage:{'parhelion.world.progress.v2':JSON.stringify({done:['armory_rack'],found:[]})}}),w=h.world,d=h.window.document,canvas=d.getElementById('view')!;let now=0,renders=0;
 const originalRender=w.renderer.render.bind(w.renderer);w.renderer.render=(...args:any[])=>{renders++;return originalRender(...args);};
 const frame=(n=1,step=1000/60)=>{for(let i=0;i<n;i++)h.frame(now+=step);};
 const emit=(name:string)=>{const e=new h.window.Event(name,{cancelable:true});canvas.dispatchEvent(e);return e;};
 const start=async()=>{(d.getElementById('start')as HTMLElement).click();await Promise.resolve();};
 try{
  await start();const x=-52.2,z=-102.9,g=w.combat.geometry.ground(x,z,8);assert.ok(g);w.player.teleport(x,g.point.y+.1,z);for(let i=0;i<180&&!w.player.onGround;i++)frame();assert.ok(w.player.onGround);
  assert.equal(w.combat.startStoryEncounter(getFalseDawnEncounterSpec('false_dawn_warden'),{position:w.player.pos,playable:true}).ok,true);await h.settleAssets();
  const cue=w.combat.contactEffects,slots=cue.slots,resources=slots.map((s:any)=>({mesh:s.mesh,geometry:s.mesh.geometry,material:s.mesh.material,array:s.mesh.geometry.attributes.position.array}));let disposed=0;for(const r of resources){r.geometry.addEventListener('dispose',()=>disposed++);r.material.addEventListener('dispose',()=>disposed++);}
  for(let i=0;i<360&&!cue.diagnostics.active;i++)frame();assert.ok(cue.diagnostics.active);assert.ok(w.combat.state.hp<100);
  const actor=w.combat.state.enemies.find((e:any)=>e.storyEncounter);assert.ok(actor.contactSequence>0);
  const custom=['KeyJ','KeyY','KeyK','KeyP','KeyL'].find(code=>!w.settings.action(code))!;assert.ok(custom);assert.equal(w.settings.bind('fire',custom),null);
  const snapshot=()=>JSON.stringify({hp:w.combat.state.hp,player:w.player.pos.toArray(),actor:[actor.id,actor.hp,actor.timer,actor.mode,actor.contactSequence,actor.p],cue:slots.map((s:any)=>[s.age,s.mesh.visible,s.mesh.material.opacity])});
  for(let cycle=0;cycle<3;cycle++){
   assert.equal(emit('webglcontextlost').defaultPrevented,true);assert.equal(w.graphicsRecovery.state,'lost');const frozen=snapshot(),before=renders;
   h.window.dispatchEvent(new h.window.PageTransitionEvent('pagehide',{persisted:true}));h.window.dispatchEvent(new h.window.PageTransitionEvent('pageshow',{persisted:true}));
   d.body.dispatchEvent(new h.window.KeyboardEvent('keydown',{code:custom,bubbles:true}));if(cycle===2)now+=80000;else frame(8,10000);assert.equal(snapshot(),frozen);assert.equal(renders,before);assert.equal(disposed,0);
   emit('webglcontextrestored');assert.equal(w.graphicsRecovery.state,'awaiting-resume');if(cycle===2)now+=40000;else frame(4,10000);assert.equal(snapshot(),frozen);assert.equal(renders,before);
   await canvas.requestPointerLock();assert.equal(d.pointerLockElement,null);assert.equal(snapshot(),frozen);await start();assert.equal(w.graphicsRecovery.state,'available');assert.equal(d.pointerLockElement,canvas);frame();assert.equal(snapshot(),frozen,'first resumed frame consumes zero hidden time even if no RAF occurred during loss');assert.equal(actor.hp,JSON.parse(frozen).actor[1],'held key while unavailable cannot fire on resume');
   for(let i=0;i<3;i++){assert.equal(slots[i].mesh,resources[i].mesh);assert.equal(slots[i].mesh.geometry,resources[i].geometry);assert.equal(slots[i].mesh.material,resources[i].material);assert.equal(slots[i].mesh.geometry.attributes.position.array,resources[i].array);}assert.equal(cue.diagnostics.bytes,55296);assert.equal(disposed,0);
  }
  const active=slots.find((s:any)=>s.mesh.visible),age=active.age;frame();assert.ok(active.age>age,'ordinary visible time advances after the discarded resume frame');
  assert.equal(w.settings.value.bindings.fire,custom);w.combat.cancelStoryEncounter();assert.equal(cue.diagnostics.active,0);assert.equal(w.done.has('false_dawn_warden_cleared'),false);
  h.window.dispatchEvent(new h.window.PageTransitionEvent('pagehide',{persisted:false}));assert.equal(disposed,6);emit('webglcontextrestored');assert.equal(w.graphicsRecovery.state,'disposed');assert.deepEqual(h.errors,[]);
 }finally{await h.close();}
});

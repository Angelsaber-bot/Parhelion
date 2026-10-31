/** Actual-main presentation lifecycle stress. Direct encounter admission/entry setup
 * isolates resources; not a narrative playthrough or balance test. Contacts/damage
 * come from production simulation, with no hostile HP or contact-event injection. */
import test from'node:test';import assert from'node:assert/strict';
import{bootWorldWithoutGpu}from'./world-dom-boot.fixture';import{getFalseDawnEncounterSpec}from'../src/falseDawnEncounterCatalog';
test('real Warden contacts pause, honor reduced effects, and remain fixed-capacity across cancel/reset/retry',async()=>{
 const h=await bootWorldWithoutGpu({deterministic:true});const{world:w,window}=h,d=window.document;let now=0;const frame=(n=1)=>{for(let i=0;i<n;i++)h.frame(now+=1000/60);};
 const key=(code:string)=>{for(const type of ['keydown','keyup'])d.body.dispatchEvent(new window.KeyboardEvent(type,{code,bubbles:true}));};
 const cue=w.combat.contactEffects;assert.ok(cue);const slots=cue.slots;assert.equal(slots.length,3);const resources=slots.map((s:any)=>({mesh:s.mesh,geometry:s.mesh.geometry,material:s.mesh.material,array:s.mesh.geometry.attributes.position.array}));let geoDisposed=0,matDisposed=0;for(const r of resources){r.geometry.addEventListener('dispose',()=>geoDisposed++);r.material.addEventListener('dispose',()=>matDisposed++);}
 const ids=new Set<string>(),durations:number[]=[];
 try{
  (d.getElementById('start')as HTMLElement).click();await Promise.resolve();frame();await h.settleAssets();
  for(let cycle=0;cycle<12;cycle++){
   if(!d.pointerLockElement){(d.getElementById('start')as HTMLElement).click();await Promise.resolve();}
   w.combat.reset();const reduced=cycle%2===1,toggle=d.getElementById('world-reduced-effects')as HTMLInputElement;toggle.checked=reduced;toggle.dispatchEvent(new window.Event('change',{bubbles:true}));
   const x=-52.2,z=-102.9,g=w.combat.geometry.ground(x,z,8);assert.ok(g);w.player.teleport(x,g.point.y+.1,z);for(let i=0;i<180&&!w.player.onGround;i++)frame();assert.ok(w.player.onGround);
   const result=w.combat.startStoryEncounter(getFalseDawnEncounterSpec('false_dawn_warden'),{position:w.player.pos,playable:!!d.pointerLockElement});assert.equal(result.ok,true,JSON.stringify({cycle,result,p:w.player.pos.toArray(),grounded:w.player.onGround,locked:!!d.pointerLockElement}));await h.settleAssets();
   const actor=w.combat.state.enemies.find((e:any)=>e.storyEncounter);assert.ok(actor);assert.equal(ids.has(actor.id),false);ids.add(actor.id);
   for(let i=0;i<360&&cue.diagnostics.active===0;i++)frame();assert.ok(cue.diagnostics.active>0,`real contact ${cycle}`);assert.ok(actor.contactSequence>0);assert.ok(w.combat.state.hp<100,'actual attack caused production damage');
   const active=slots.find((s:any)=>s.mesh.visible);assert.ok(active);assert.equal(active.duration,reduced?.12:.24);durations.push(active.duration);assert.equal(cue.diagnostics.bytes,55296);assert.ok(cue.diagnostics.lastBuild.vertices>0);
   if(cycle===0){d.exitPointerLock();const opacity=active.mesh.material.opacity,age=active.age,hp=w.combat.state.hp;frame(30);assert.equal(active.age,age);assert.equal(active.mesh.material.opacity,opacity);assert.equal(w.combat.state.hp,hp);(d.getElementById('start')as HTMLElement).click();await Promise.resolve();}
   if(cycle%3===0)w.combat.cancelStoryEncounter();else if(cycle%3===1){window.confirm=()=>true;key('KeyR');}else{w.player.teleport(3000,50,3000);frame(2);}
   assert.equal(cue.diagnostics.active,0);assert.equal(w.combat.storyEncounter,null);assert.equal(w.scene.getObjectByName(actor.id),undefined);await h.settleAssets();
   for(let i=0;i<3;i++){assert.equal(slots[i].mesh,resources[i].mesh);assert.equal(slots[i].mesh.geometry,resources[i].geometry);assert.equal(slots[i].mesh.material,resources[i].material);assert.equal(slots[i].mesh.geometry.attributes.position.array,resources[i].array);assert.ok(resources[i].mesh.parent);}
   assert.equal(geoDisposed,0);assert.equal(matDisposed,0);assert.equal(w.done.has('false_dawn_warden_cleared'),false,'cleanup never grants victory');
  }
  cue.dispose();cue.dispose();assert.equal(geoDisposed,3);assert.equal(matDisposed,3);assert.equal(cue.diagnostics.active,0);for(const r of resources)assert.equal(r.mesh.parent,null);assert.deepEqual(h.errors,[]);console.log(JSON.stringify({attempts:ids.size,durations,bytes:cue.diagnostics.bytes,geoDisposed,matDisposed}));
 }finally{await h.close();}
});

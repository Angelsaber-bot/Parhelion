import test from 'node:test';
import assert from 'node:assert/strict';
import { bootWorldWithoutGpu } from './world-dom-boot.fixture';
import * as THREE from 'three';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

test('NON-GPU production boot initializes real DOM/assets/state and executes its frame/event chain',async(t)=>{
 const harness=await bootWorldWithoutGpu();
 try{
  const {window,world}=harness;
  assert.equal(world.ready,true);assert.ok(world.layout.markers.length>210);assert.ok(world.colliders.length>0);
  assert.equal(window.document.querySelectorAll('#world-action-bar').length,1);assert.equal(window.document.querySelectorAll('#world-travel-panel').length,1);
  assert.equal(window.document.querySelectorAll('#world-audio-volume').length,1);assert.equal(world.audio.volume,.35);
  assert.equal(world.done.size,0);harness.frame(window.performance.now()+16);
  let now=window.performance.now()+32;
  const frame=()=>harness.frame(now+=1000/60);
  const key=(code:string,repeat=false)=>window.document.body.dispatchEvent(new window.KeyboardEvent('keydown',{code,key:code==='Escape'?'Escape':code==='Tab'?'Tab':code.replace('Key','').toLowerCase(),repeat,bubbles:true,cancelable:true}));
  const release=(code:string)=>window.document.body.dispatchEvent(new window.KeyboardEvent('keyup',{code,bubbles:true}));
  const enter=async()=>{(window.document.getElementById('start') as HTMLElement).click();await Promise.resolve();assert.equal(window.document.pointerLockElement,window.document.getElementById('view'));frame();};
  const fire=()=>window.document.body.dispatchEvent(new window.MouseEvent('mousedown',{button:0,bubbles:true,cancelable:true}));
  const audioCalls:Record<string,number>={};
  const snapshot=async(name:string)=>{if(process.env.WORLD_UI_REVIEW_DIR){await mkdir(process.env.WORLD_UI_REVIEW_DIR,{recursive:true});await writeFile(resolve(process.env.WORLD_UI_REVIEW_DIR,`${name}.html`),await harness.snapshot(name));}};
  for(const kind of ['shot','cannon','melee','contact','hurt','kill','skill','evade','interaction','unlock']){const original=world.audio[kind].bind(world.audio);world.audio[kind]=(...args:unknown[])=>{audioCalls[kind]=(audioCalls[kind]??0)+1;return original(...args);};}
  const originalSkillEvent=world.audio.skillEvent.bind(world.audio);world.audio.skillEvent=(event:{type:string})=>{const key=`skill-${event.type}`;audioCalls[key]=(audioCalls[key]??0)+1;return originalSkillEvent(event);};
  await t.test('existing help explains companion casts versus the intentionally aimed player ultimate in both locales',()=>{
    const locale=window.document.querySelector<HTMLSelectElement>('#world-settings .parhelion-language select')!;
    assert.ok(locale);const energy=world.actions.skills.energy,flags=[...world.done];
    locale.value='en';locale.dispatchEvent(new window.Event('change',{bubbles:true}));
    assert.match(window.document.getElementById('help')!.textContent!,/Summoned: skills\/ultimates come from your companion/);
    assert.match(window.document.getElementById('help')!.textContent!,/Your ultimate follows your facing and can miss/);
    locale.value='zh';locale.dispatchEvent(new window.Event('change',{bubbles:true}));
    assert.match(window.document.getElementById('help')!.textContent!,/可能落空/);
    assert.equal(world.actions.skills.energy,energy);assert.deepEqual([...world.done],flags);
  });
  await t.test('actual settings controls persist volume/mute without synthetic autoplay',async()=>{
    const volume=window.document.getElementById('world-audio-volume') as HTMLInputElement;volume.value='.2';volume.dispatchEvent(new window.Event('input',{bubbles:true}));assert.equal(world.audio.volume,.2);
    const mute=window.document.getElementById('world-audio-muted') as HTMLInputElement;mute.checked=true;mute.dispatchEvent(new window.Event('change',{bubbles:true}));assert.equal(world.audio.muted,true);
    assert.deepEqual(JSON.parse(window.localStorage.getItem('parhelion-world-audio-v1')!),{volume:.2,muted:true});
    await enter();assert.ok(audioCalls.unlock>0);assert.equal(world.audio.activeVoices,0,'synthetic jsdom events are not trusted user gestures');mute.checked=false;mute.dispatchEvent(new window.Event('change',{bubbles:true}));
    await snapshot('01-hud');
  });
  await t.test('production F opens readable dialogue, blocks damage/input, ignores repeat and closes on a new F',async()=>{
    const npc=world.scene.getObjectByName('Resident_alpha_archivist');assert.ok(npc);
    const point=npc.getWorldPosition(new THREE.Vector3()),z=point.z+1;world.player.teleport(point.x,world.ground(point.x,z)+.02,z);
    for(const state of [{onGround:false,swimming:false,gliding:false},{onGround:true,swimming:true,gliding:false},{onGround:true,swimming:false,gliding:true}]){
      Object.assign(world.player,state);key('KeyF');release('KeyF');assert.equal(world.done.has('valley_story_met'),false,'air/water/glide cannot start dialogue or advance progress');
      assert.equal((window.document.getElementById('world-dialogue') as HTMLElement).hidden,true);
    }
    Object.assign(world.player,{onGround:false,swimming:false,gliding:false});
    for(let i=0;i<45;i++)frame();key('KeyF');release('KeyF');
    const dialogue=window.document.getElementById('world-dialogue') as HTMLElement;
    assert.equal(dialogue.hidden,false);assert.equal(world.done.has('valley_story_met'),true);assert.ok(dialogue.textContent!.length>40);
    await snapshot('02-dialogue');
    const position=world.player.pos.clone(),shots=audioCalls.shot??0,hp=world.combat.state.hp;
    key('KeyF',true);assert.equal(dialogue.hidden,false);
    key('KeyW');key('KeyB');key('KeyQ');fire();for(let i=0;i<10;i++)frame();
    assert.ok(world.player.pos.distanceTo(position)<.02);assert.equal(audioCalls.shot??0,shots);assert.equal(world.actions.melee.active,false);assert.equal(world.actions.skills.casting,false);assert.equal(world.combat.state.hp,hp);
    release('KeyW');key('KeyF');release('KeyF');assert.equal(dialogue.hidden,true);
    key('KeyW');frame();release('KeyW');assert.ok(world.player.pos.distanceTo(position)>.02);
  });
  await t.test('map, settings, blur and pointer unlock clear dialogue and cannot leave a stuck modal',async()=>{
    const npc=world.scene.getObjectByName('Resident_alpha_archivist'),point=npc.getWorldPosition(new THREE.Vector3()),z=point.z+1;
    const open=()=>{world.player.teleport(point.x,world.ground(point.x,z)+.02,z);for(let i=0;i<5;i++)frame();key('KeyF');release('KeyF');assert.equal((window.document.getElementById('world-dialogue') as HTMLElement).hidden,false);};
    open();key('KeyM');assert.equal((window.document.getElementById('world-dialogue') as HTMLElement).hidden,true);assert.ok(window.document.getElementById('bigmap')!.classList.contains('open'));key('KeyM');
    open();key('KeyO');assert.equal(world.settingsPanel.open,true);assert.equal((window.document.getElementById('world-dialogue') as HTMLElement).hidden,true);await snapshot('03-settings');world.settingsPanel.close();
    await enter();open();window.dispatchEvent(new window.Event('blur'));assert.equal((window.document.getElementById('world-dialogue') as HTMLElement).hidden,true);assert.equal(world.audio.activeVoices,0);
    open();key('Escape');window.document.exitPointerLock();assert.equal((window.document.getElementById('world-dialogue') as HTMLElement).hidden,true);await enter();
  });
  await t.test('N travel modal releases pointer lock, traps focus, suppresses gameplay and Escape closes without relocking',async()=>{
    key('KeyN');assert.equal(world.travelPanel.open,true);assert.equal(window.document.pointerLockElement,null);
    const panel=window.document.getElementById('world-travel-panel')!;assert.ok(panel.contains(window.document.activeElement));
    await snapshot('04-travel');
    key('Tab');assert.ok(panel.contains(window.document.activeElement));const position=world.player.pos.clone();key('KeyW');fire();frame();assert.ok(world.player.pos.distanceTo(position)<.02);
    key('Escape');assert.equal(world.travelPanel.open,false);assert.equal(window.document.pointerLockElement,null);
  });
  await t.test('real equipment interactions and combat inputs route cues only for accepted actions',async()=>{
    await enter();
    for(const id of ['hq_terminal','armory_rack']){
      const marker=world.layout.markers.find((m:{id:string})=>m.id===id);assert.ok(marker);world.player.teleport(...marker.p);world.player.onGround=true;key('KeyF');release('KeyF');assert.equal(world.done.has(id),true,id);
      const panel=window.document.getElementById('world-dialogue') as HTMLElement;if(!panel.hidden){key('KeyF');release('KeyF');}
    }
    world.player.onGround=true;frame();const shots=audioCalls.shot??0;fire();window.document.body.dispatchEvent(new window.MouseEvent('mouseup',{button:0,bubbles:true}));assert.equal(audioCalls.shot,shots+1);
    world.player.onGround=true;const melee=audioCalls.melee??0;key('KeyB');release('KeyB');assert.equal(audioCalls.melee,melee+1);assert.equal(world.actions.melee.active,true);
    key('KeyM');key('KeyM');world.player.onGround=true;const skills=audioCalls['skill-cast']??0;key('KeyQ');release('KeyQ');assert.equal(audioCalls['skill-cast'],skills+1);
    key('KeyQ');release('KeyQ');assert.equal(audioCalls['skill-cast'],skills+1,'cooldown/repeated action has no new cast cue');
    key('KeyM');key('KeyM');world.player.onGround=true;const evades=audioCalls.evade??0;key('KeyZ');release('KeyZ');assert.equal(audioCalls.evade,evades+1);
    key('KeyM');const hiddenShots=audioCalls.shot;fire();frame();assert.equal(audioCalls.shot,hiddenShots);key('KeyM');
  });
  assert.equal(harness.errors.length,0,JSON.stringify(harness.errors));
 }finally{await harness.close();}
});

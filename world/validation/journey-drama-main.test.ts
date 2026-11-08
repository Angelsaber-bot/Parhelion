import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {bootWorldWithoutGpu} from './world-dom-boot.fixture';
import {JOURNEY_DRAMA as D,JOURNEY_CAST} from '../src/story/journeyDrama';
test('production story dialogue requires reading, grounded presence and explicit confirmation; personal chronicle remains available',async()=>{
 const h=await bootWorldWithoutGpu({deterministic:true,initialStorage:{'parhelion.world.progress.v2':JSON.stringify({done:['adventure_v2',D.started],found:[]})}}),d=h.window.document,w=h.world;let now=0;
 const frame=(n=1)=>{for(let i=0;i<n;i++)h.frame(now+=1000/60);};
 const key=(code:string)=>{for(const type of ['keydown','keyup'])d.body.dispatchEvent(new h.window.KeyboardEvent(type,{code,key:code==='Escape'?'Escape':code.slice(3).toLowerCase(),bubbles:true,cancelable:true}));};
 const actor=w.scene.getObjectByName('Resident_'+JOURNEY_CAST.alpha.npc)!,p=actor.getWorldPosition(new THREE.Vector3());
 const approach=()=>{w.player.teleport(p.x,p.y+.05,p.z+1);frame(90);assert.ok(w.player.onGround);};
 const read=()=>{for(let i=0;i<20&&(d.getElementById('world-dialogue-choices')as HTMLElement).hidden;i++)key('KeyF');assert.equal((d.getElementById('world-dialogue-choices')as HTMLElement).hidden,false);};
 try{
  (d.getElementById('start')as HTMLElement).click();await Promise.resolve();approach();key('KeyF');assert.ok(w.narrative.open);assert.equal(w.done.has(D.opening),false);
  frame(20);const face=actor.getObjectByName('ResidentFaceAndHair')as THREE.Mesh;assert.ok(face.morphTargetInfluences![0]>.01,'actual dialogue animates its nearby actor');
  key('Escape');assert.equal(w.done.has(D.opening),false);key('KeyF');read();w.player.teleport(p.x+20,p.y,p.z);d.querySelector<HTMLButtonElement>('[data-choice="accept"]')!.click();assert.equal(w.done.has(D.opening),false,'stale distant confirmation is rejected');
  approach();key('KeyF');read();d.querySelector<HTMLButtonElement>('[data-choice="accept"]')!.click();assert.ok(w.done.has(D.opening));assert.equal(w.done.has('armory_rack'),false);assert.ok(JSON.parse(h.window.localStorage.getItem('parhelion.world.progress.v2')!).done.includes(D.opening));
  key('KeyF');read();d.querySelector<HTMLButtonElement>('[data-choice="personal"]')!.click();assert.ok(w.narrative.open);assert.ok(w.done.has('campaign_alpha_met'),'personal resident episode is still reachable');assert.deepEqual(h.errors,[]);
 }finally{await h.close();}
});

import * as THREE from 'three';
/** Real input/physics/combat wiring with a non-GPU renderer. Synthetic enemy kills
 * isolate interaction lifecycle; this is not a combat feel or visual acceptance test. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {bootWorldWithoutGpu} from './world-dom-boot.fixture';
import {KINGDOM_GATE as G} from '../src/kingdomGate';
import {gateEscortPosition} from '../src/kingdomGateScene';
test('actual main: start guards, release latch, turn winch and escort through real collision',async()=>{
 const h=await bootWorldWithoutGpu({deterministic:true,initialStorage:{'parhelion.world.progress.v2':JSON.stringify({done:['armory_rack','saber_contract','summon_circle'],found:[]})}}),w=h.world,d=h.window.document;let now=0;
 const frame=(n=1)=>{for(let i=0;i<n;i++)h.frame(now+=1000/60);};
 const key=(down:boolean)=>d.body.dispatchEvent(new h.window.KeyboardEvent(down?'keydown':'keyup',{code:w.settings.bindingsFor('interact')[0],bubbles:true,cancelable:true}));
 const tap=()=>{key(true);key(false);};
 const place=(id:string)=>{const m=w.layout.markers.find((m:any)=>m.id===id);w.player.teleport(m.p[0],m.p[1]+.3,m.p[2]);frame(90);assert.ok(w.player.onGround);};
 try{
  (d.getElementById('start')as HTMLElement).click();await Promise.resolve();await h.settleAssets();frame(2);
  place(G.entry);tap();frame();assert.equal(w.combat.storyEncounter?.id,G.encounter,d.getElementById('toast')?.textContent);
  for(const enemy of w.combat.state.enemies.filter((e:any)=>e.storyEncounter===G.encounter))w.combat.damageEnemy(enemy.id,10000,{source:'ranged',origin:w.player.pos});frame();assert.ok(!w.done.has(G.open));
  w.camera.position.copy(w.player.pos).add(new THREE.Vector3(0,1.5,0));w.camera.lookAt(w.kingdomGateScene.latch.position);w.camera.updateMatrixWorld(true);
  d.body.dispatchEvent(new h.window.MouseEvent('mousedown',{button:0,bubbles:true}));d.body.dispatchEvent(new h.window.MouseEvent('mouseup',{button:0,bubbles:true}));
  assert.ok(w.done.has(G.unlocked),'real shooting handler releases the latch');
  place(G.latch);tap();frame();assert.ok(w.done.has(G.unlocked),d.getElementById('toast')?.textContent);
  place(G.winch);tap();frame();key(true);frame(210);key(false);assert.ok(w.done.has(G.open),d.getElementById('toast')?.textContent);assert.equal(w.kingdomGateScene.collider.enabled,false);assert.ok(!w.done.has(G.rescued));
  const p=gateEscortPosition(.4);w.player.teleport(p.x,p.y+.3,p.z);frame(90);
  // A single fixed safe escort position stays within 14m of the whole 16m route.
  frame(1100);assert.ok(w.done.has(G.rescued),`escort ${w.kingdomGateRuntime.escort}; ${d.getElementById('toast')?.textContent}`);
  assert.equal(w.kingdomGateScene.collider.enabled,false);assert.equal(h.errors.length,0);
 }finally{await h.close();}
});

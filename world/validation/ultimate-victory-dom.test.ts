import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { bootWorldWithoutGpu } from './world-dom-boot.fixture';

/** NON-GPU: production DOM/event delivery, GLB/BVH and real ultimate boss kill.
 * Boss requirement gate and HP are explicitly injected to isolate notification timing. */
test('NON-GPU ultimate boss victory waits for gameplay and new-game reset discards pending delivery',async t=>{
 const h=await bootWorldWithoutGpu({deterministic:true});const {world:w,window}=h;let now=0;
 const frame=(n=1)=>{for(let i=0;i<n;i++)h.frame(now+=1000/60);};
 const key=(code:string)=>{for(const type of ['keydown','keyup'])window.document.body.dispatchEvent(new window.KeyboardEvent(type,{code,bubbles:true,cancelable:true}));};
 const center=w.layout.markers.find((m:any)=>m.id==='boss_vacant_king').p;
 const floor=(x:number,z:number)=>{const ray=new THREE.Ray(new THREE.Vector3(x,center[1]+3,z),new THREE.Vector3(0,-1,0));let best=Infinity;for(const c of w.colliders)if(c.enabled){const hit=c.bvh.raycastFirst(ray,THREE.DoubleSide);if(hit&&Math.abs(hit.face?.normal.y??0)>.7)best=Math.min(best,hit.distance);}assert.ok(Number.isFinite(best));return center[1]+3-best;};
 try{
  w.done.add('armory_rack');w.player.teleport(center[0],floor(center[0],center[2]+7)+.05,center[2]+7);w.player.onGround=true;(window.document.getElementById('start') as HTMLElement).click();await Promise.resolve();frame(30);await h.settleAssets();
  for(const discard of [false,true])await t.test(discard?'reset discards pending victory':'victory delivered after normal frame resumes',()=>{
   for(const e of w.combat.state.enemies)if(e.kind!=='king'){e.mode='dead';e.hp=0;e.active=false;}
   w.combat.state.setBossRequirements('boss_vacant_king',[]);assert.equal(w.combat.state.beginBoss(w.done,'boss_vacant_king'),true);
   const boss=w.combat.state.boss;Object.assign(boss.p,{x:center[0],y:floor(center[0],center[2]+4),z:center[2]+4});Object.assign(boss.home,boss.p);boss.mode='recover';boss.timer=100;boss.hp=1;
   w.combat.damageEnemy(boss.id,0,{source:'ranged',origin:w.player.pos});w.player.yaw=0;w.actions.reset();w.actions.skills.energyValue=100;w.ultimateDirector.setMode('full');key('KeyX');assert.equal(w.ultimateDirector.active,true);
   const toast=window.document.getElementById('toast')!;toast.textContent='before ultimate';let killed=false;
   for(let i=0;i<500&&w.ultimateDirector.active;i++){frame();if(boss.hp===0){killed=true;assert.doesNotMatch(toast.textContent??'',/已击败|再次挑战成功|defeated|Rematch won/,'victory must not be consumed behind the full-screen stage');}}
   assert.equal(killed,true,'production ultimate actually kills boss');assert.equal(w.combat.state.bossStarted,false);assert.equal(w.ultimateDirector.active,false);assert.equal(w.actions.skills.casting,false);
   if(discard){window.confirm=()=>true;key('KeyR');assert.equal(w.done.has('armory_rack'),false,'real reset path ran');(window.document.getElementById('start') as HTMLElement).click();frame(4);assert.doesNotMatch(toast.textContent??'',/已击败|再次挑战成功|defeated|Rematch won/,'reset drops the deferred old-game victory');}
   else{frame();assert.match(toast.textContent??'',/已击败|再次挑战成功|defeated|Rematch won/,'victory shown on first normal gameplay frame');assert.equal(toast.classList.contains('show'),true);}
  });
  await h.settleAssets();assert.deepEqual(h.errors,[]);assert.deepEqual(h.warnings,[]);
 }finally{await h.close();}
});

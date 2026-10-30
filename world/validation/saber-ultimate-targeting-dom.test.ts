import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { bootWorldWithoutGpu } from './world-dom-boot.fixture';

/** NON-GPU production input/aim, actual GLB contacts, BVH and HP. Only charge,
 * encounter placement/recovery and boss gates are injected; no guaranteed hits. */
test('NON-GPU Saber ultimate targets actual combat positions or rejects before payment',async t=>{
 const h=await bootWorldWithoutGpu({deterministic:true});const {world:w,window}=h;let now=0;
 const frame=(n=1)=>{for(let i=0;i<n;i++)h.frame(now+=1000/60);};
 const key=()=>{for(const type of ['keydown','keyup'])window.document.body.dispatchEvent(new window.KeyboardEvent(type,{code:'KeyX',key:'x',bubbles:true}));};
 const center=w.layout.markers.find((m:any)=>m.id==='boss_vacant_king').p;
 const floor=(x:number,z:number)=>{const ray=new THREE.Ray(new THREE.Vector3(x,center[1]+3,z),new THREE.Vector3(0,-1,0));let best=Infinity;for(const c of w.colliders)if(c.enabled){const hit=c.bvh.raycastFirst(ray,THREE.DoubleSide);if(hit&&Math.abs(hit.face?.normal.y??0)>.7)best=Math.min(best,hit.distance);}assert.ok(Number.isFinite(best));return center[1]+3-best;};
 const enemy=w.combat.state.enemies.find((e:any)=>e.kind!=='king'&&!e.miniboss);
 const hits:any[]=[];const record=w.actions.recordDamage.bind(w.actions);w.actions.recordDamage=(hit:any)=>{hits.push({...hit});record(hit);};
 const aim=()=>{w.camera.lookAt(enemy.p.x,enemy.p.y+1,enemy.p.z);w.camera.updateMatrixWorld();};
 const ready=()=>{w.ultimateDirector.abort();w.actions.reset();w.contract.select('saber');w.player.teleport(center[0],floor(center[0],center[2]+7)+.05,center[2]+7);w.player.onGround=true;w.player.yaw=0;w.player.flying=w.player.swimming=w.player.gliding=false;Object.assign(enemy.p,{x:center[0],y:floor(center[0],center[2]),z:center[2]});Object.assign(enemy.home,enemy.p);enemy.hp=enemy.maxHp=500;enemy.mode='recover';enemy.timer=100;enemy.active=true;enemy.pacified=false;};
 const cast=(target:any=enemy)=>{w.actions.skills.energyValue=100;hits.length=0;const hp=target.hp;key();return hp;};
 const complete=()=>{for(let i=0;i<600&&w.ultimateDirector.active;i++)frame();assert.equal(w.ultimateDirector.active,false);assert.equal(w.actions.skills.casting,false);};
 try{
  w.done.add('armory_rack');w.contract.recruit();ready();(window.document.getElementById('start') as HTMLElement).click();await Promise.resolve();frame(2);await h.settleAssets();frame(30);
  for(const e of w.combat.state.enemies)if(e!==enemy&&e.kind!=='king'){e.mode='dead';e.timer=Infinity;e.hp=0;e.active=false;}
  await t.test('natural following and active pursuit, no caster placement',()=>{ready();frame(20);enemy.p.z-=8;enemy.p.y=floor(enemy.p.x,enemy.p.z);Object.assign(enemy.home,enemy.p);aim();const distance=w.servant.root.position.distanceTo(new THREE.Vector3(enemy.p.x,enemy.p.y,enemy.p.z));t.diagnostic(`natural caster distance ${distance.toFixed(2)}m`);assert.ok(distance>6,'not an ideal 3m caster fixture');const hp=cast();assert.equal(w.actions.skills.casting,true);complete();assert.equal(hp-enemy.hp,138);assert.equal(hits.filter(hit=>hit.source==='ultimate').length,1);});
  for(const distance of [6,10,15])await t.test(`caster ${distance}m from target turns and lands one contact`,()=>{ready();frame(30);w.servant.root.position.set(center[0],floor(center[0],center[2]+distance),center[2]+distance);w.servant.root.rotation.y=Math.PI/2;aim();const hp=cast();assert.equal(w.actions.skills.casting,true);complete();assert.equal(hp-enemy.hp,138);assert.equal(hits.filter(hit=>hit.source==='ultimate').length,1);});
  await t.test('moving target before input is acquired at its current location',()=>{ready();frame(15);enemy.p.x+=2;enemy.p.y=floor(enemy.p.x,enemy.p.z);Object.assign(enemy.home,enemy.p);aim();const hp=cast();assert.equal(w.actions.skills.casting,true);complete();assert.equal(hp-enemy.hp,138);});
  await t.test('ordinary attack can be replaced by ultimate without contact substitution',()=>{ready();for(let i=0;i<600&&w.servant.attackTime<=0;i++)frame();assert.ok(w.servant.attackTime>0,'real autonomous attack started');aim();const hp=cast();assert.equal(w.actions.skills.casting,true);complete();assert.equal(hp-enemy.hp,138);assert.deepEqual(hits.map(hit=>hit.source),['ultimate']);});
  for(const failure of ['out-of-caster-range','wrong-facing','high-floor','cover','no-hostile'])await t.test(`${failure} rejects before cost or cinematic`,()=>{
   ready();frame(30);w.servant.root.position.set(center[0],floor(center[0],center[2]+6),center[2]+6);aim();let blocker:any;
   if(failure==='out-of-caster-range')w.servant.root.position.set(center[0],floor(center[0],center[2]+22),center[2]+22);
   if(failure==='wrong-facing'){w.camera.lookAt(w.camera.position.clone().add(new THREE.Vector3(0,0,10)));w.camera.updateMatrixWorld();}
   if(failure==='high-floor')enemy.p.y+=4;
   if(failure==='no-hostile')enemy.active=false;
   if(failure==='cover'){const geometry=new THREE.BoxGeometry(12,6,.3).translate(center[0],enemy.p.y+2,center[2]+3);blocker={name:'QA_solid_cover',enabled:true,bvh:new MeshBVH(geometry)};w.colliders.push(blocker);}
   try{const hp=cast(),accepted=w.actions.skills.casting;if(accepted){complete();t.diagnostic(`${failure}: accepted=${accepted}, energy=${w.actions.skills.energy}, HP loss=${hp-enemy.hp}`);}assert.equal(accepted,false,'no payable Saber cast without a reachable hostile');assert.equal(w.ultimateDirector.active,false);assert.equal(w.actions.skills.energy,100);assert.equal(w.actions.skills.cooldown('ultimate'),0);assert.equal(enemy.hp,hp);assert.ok(window.document.getElementById('toast')?.textContent);}
   finally{if(blocker){w.colliders.splice(w.colliders.indexOf(blocker),1);blocker.bvh.geometry.dispose();}}
  });
  await t.test('accepted ultimate still checks real cover at contact, never guaranteed damage',()=>{
   ready();frame(30);w.servant.root.position.set(center[0],floor(center[0],center[2]+10),center[2]+10);aim();const hp=cast();assert.equal(w.actions.skills.casting,true);
   const geometry=new THREE.BoxGeometry(12,6,.3).translate(center[0],enemy.p.y+2,center[2]+3),blocker={name:'QA_cover_after_acceptance',enabled:true,bvh:new MeshBVH(geometry)};w.colliders.push(blocker);
   try{complete();assert.equal(enemy.hp,hp,'live LOS remains authoritative even after valid preflight');assert.equal(hits.length,0);assert.equal(w.actions.skills.energy,0);assert.ok(w.actions.skills.cooldown('ultimate')>0);}
   finally{w.colliders.splice(w.colliders.indexOf(blocker),1);geometry.dispose();}
  });
  await t.test('real boss receives authored ultimate HP damage from follower position',()=>{ready();enemy.active=false;enemy.mode='dead';w.combat.state.setBossRequirements('boss_vacant_king',[]);assert.equal(w.combat.state.beginBoss(w.done,'boss_vacant_king'),true);const boss=w.combat.state.boss;boss.mode='recover';boss.timer=100;frame(30);w.camera.lookAt(boss.p.x,boss.p.y+1,boss.p.z);w.camera.updateMatrixWorld();const hp=cast(boss);assert.equal(w.actions.skills.casting,true);complete();assert.equal(hp-boss.hp,138);assert.equal(hits.filter(hit=>hit.source==='ultimate'&&hit.id===boss.id).length,1);});
  await h.settleAssets();assert.deepEqual(h.errors,[]);assert.deepEqual(h.warnings,[]);
 }finally{await h.close();}
});

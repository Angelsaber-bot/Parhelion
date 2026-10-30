import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { bootWorldWithoutGpu } from './world-dom-boot.fixture';
import { SERVANTS } from '../src/contracts';
import { CONTRACT_SKILLS } from '../src/contractSkills';

/** NON-GPU production GLBs/BVH/inputs/HP, not image quality or FPS. Target recovery,
 * positions and boss gates isolate contacts; natural-charge case never sets energy. */
test('NON-GPU era ultimates pay only for reachable live targets and retain authored damage',async t=>{
 const h=await bootWorldWithoutGpu({deterministic:true});const {world:w,window}=h;let now=0;
 const frame=(n=1)=>{for(let i=0;i<n;i++)h.frame(now+=1000/60);};
 const key=()=>{for(const type of ['keydown','keyup'])window.document.body.dispatchEvent(new window.KeyboardEvent(type,{code:'KeyX',key:'x',bubbles:true}));};
 const center=w.layout.markers.find((m:any)=>m.id==='boss_vacant_king').p;
 const floor=(x:number,z:number)=>{const ray=new THREE.Ray(new THREE.Vector3(x,center[1]+3,z),new THREE.Vector3(0,-1,0));let best=Infinity;for(const c of w.colliders)if(c.enabled){const hit=c.bvh.raycastFirst(ray,THREE.DoubleSide);if(hit&&Math.abs(hit.face?.normal.y??0)>.7)best=Math.min(best,hit.distance);}assert.ok(Number.isFinite(best));return center[1]+3-best;};
 const enemy=w.combat.state.enemies.find((e:any)=>e.kind!=='king'&&!e.miniboss);
 const hits:any[]=[];const record=w.actions.recordDamage.bind(w.actions);w.actions.recordDamage=(hit:any)=>{hits.push({...hit});record(hit);};
 const aim=(target=enemy)=>{w.camera.lookAt(target.p.x,target.p.y+1,target.p.z);w.camera.updateMatrixWorld();};
 const rootFor=(id:string)=>w.scene.children.find((o:any)=>o.name.startsWith('CharacterKit:')&&o.name.toLowerCase().includes(id));
 const ready=async(id:string)=>{w.ultimateDirector.abort();w.actions.reset();w.contract.select(id);w.player.teleport(center[0],floor(center[0],center[2]+7)+.05,center[2]+7);w.player.onGround=true;w.player.yaw=0;w.player.flying=w.player.swimming=w.player.gliding=false;Object.assign(enemy.p,{x:center[0],y:floor(center[0],center[2]),z:center[2]});Object.assign(enemy.home,enemy.p);enemy.hp=enemy.maxHp=10000;enemy.mode='recover';enemy.timer=100;enemy.active=true;enemy.pacified=false;frame(30);await h.settleAssets();assert.ok(rootFor(id));};
 const cast=(charge=true)=>{if(charge)w.actions.skills.energyValue=100;hits.length=0;const hp=enemy.hp;key();return hp;};
 const complete=()=>{for(let i=0;i<900&&w.ultimateDirector.active;i++)frame();assert.equal(w.ultimateDirector.active,false);assert.equal(w.actions.skills.casting,false);};
 try{
  w.done.add('armory_rack');for(const s of SERVANTS)w.contract.recruit(s.contract);(window.document.getElementById('start') as HTMLElement).click();await Promise.resolve();frame(2);await h.settleAssets();
  for(const e of w.combat.state.enemies)if(e!==enemy&&e.kind!=='king'){e.mode='dead';e.timer=Infinity;e.hp=0;e.active=false;}
  for(const id of ['blackbeard','napoleon','musashi'] as const){
   const expected={blackbeard:144,napoleon:155,musashi:156}[id];
   for(const failure of ['no-hostile','wrong-facing','high-floor','cover','out-of-range'])await t.test(id==='napoleon'&&failure==='out-of-range'?'napoleon safe approach closes initial 22m before its real contact':`${id} ${failure} rejects before payment`,async()=>{
    await ready(id);const root=rootFor(id);root.position.set(center[0],floor(center[0],center[2]+5),center[2]+5);aim();let blocker:any;
    if(failure==='no-hostile')enemy.active=false;
    if(failure==='wrong-facing'){w.camera.lookAt(w.camera.position.clone().add(new THREE.Vector3(0,0,10)));w.camera.updateMatrixWorld();}
    if(failure==='high-floor')enemy.p.y+=4;
    if(failure==='out-of-range'){const distance=Math.max(...CONTRACT_SKILLS[id].ultimate.pulses.map(p=>p.range))+2;w.player.teleport(center[0],floor(center[0],center[2]+distance-8),center[2]+distance-8);w.player.onGround=true;root.position.set(center[0],floor(center[0],center[2]+distance),center[2]+distance);aim();}
    if(failure==='cover'){const geometry=new THREE.BoxGeometry(12,6,.3).translate(center[0],enemy.p.y+2,center[2]+2.5);blocker={name:'QA_era_cover',enabled:true,bvh:new MeshBVH(geometry)};w.colliders.push(blocker);}
    try{const hp=cast(),accepted=w.actions.skills.casting;if(accepted){complete();t.diagnostic(`${id}/${failure}: paid=true energy=${w.actions.skills.energy} HP=${hp-enemy.hp}`);}if(id==='napoleon'&&failure==='out-of-range'){assert.equal(accepted,true);assert.equal(hp-enemy.hp,155);assert.equal(w.actions.skills.energy,0);assert.equal(hits.filter(hit=>hit.source==='ultimate').length,1);return;}assert.equal(accepted,false);assert.equal(w.actions.skills.energy,100);assert.equal(w.actions.skills.cooldown('ultimate'),0);assert.equal(w.ultimateDirector.overlay.hidden,true);assert.equal(enemy.hp,hp);}
    finally{if(blocker){w.colliders.splice(w.colliders.indexOf(blocker),1);blocker.bvh.geometry.dispose();}}
   });
   await t.test(`${id} natural gun damage charges meter then actual pursuing actor casts`,async()=>{
    await ready(id);assert.equal(w.actions.skills.energy,0);let shots=0;const hpBefore=enemy.hp;
    for(let i=0;i<1200&&w.actions.skills.energy<100;i++){
     if(i%15===0){aim();window.document.body.dispatchEvent(new window.MouseEvent('mousedown',{button:0,bubbles:true}));window.document.body.dispatchEvent(new window.MouseEvent('mouseup',{button:0,bubbles:true}));shots++;}frame();
    }
    assert.equal(w.actions.skills.energy,100,`actual weapon hits must charge meter (${shots} attempts)`);assert.ok(enemy.hp<hpBefore);assert.ok(hits.some(hit=>hit.source==='ranged'&&hit.damage>0));
    const root=rootFor(id);t.diagnostic(`${id}: natural charge after ${shots} shots, caster distance ${Math.hypot(root.position.x-enemy.p.x,root.position.z-enemy.p.z).toFixed(2)}m`);
    aim();const hp=cast(false);assert.equal(w.actions.skills.casting,true);complete();assert.equal(hp-enemy.hp,expected);assert.equal(hits.filter(hit=>hit.source==='ultimate').reduce((n,h)=>n+h.damage,0),expected);assert.equal(w.actions.skills.energy,0);
   });
   for(const mode of ['full','short','off','skip-intro','skip-between'])await t.test(`${id} natural actor ${mode} exact budget`,async()=>{
    await ready(id);frame(120);enemy.p.x+=1;enemy.p.y=floor(enemy.p.x,enemy.p.z);Object.assign(enemy.home,enemy.p);aim();w.ultimateDirector.setMode(mode==='short'?'short':mode==='off'?'off':'full');
    const hp=cast();assert.equal(w.actions.skills.casting,true);if(mode==='skip-intro')w.ultimateDirector.skip();
    let skipped=false;for(let i=0;i<900&&w.ultimateDirector.active;i++){if(mode==='skip-between'&&!skipped&&hits.some(hit=>hit.source==='ultimate')){w.ultimateDirector.skip();skipped=true;}frame();}
    assert.equal(w.actions.skills.casting,false);assert.equal(w.ultimateDirector.active,false);assert.equal(hp-enemy.hp,expected);assert.equal(hits.filter(hit=>hit.source==='ultimate').reduce((n,h)=>n+h.damage,0),expected);assert.equal(hits.filter(hit=>hit.source==='ultimate').length,id==='napoleon'?1:3);assert.equal(w.actions.skills.energy,0);assert.ok(w.actions.skills.cooldown('ultimate')>0);
   });
   await t.test(`${id} target death between pulses cannot duplicate HP damage`,async()=>{
    await ready(id);frame(120);aim();enemy.hp=60;w.ultimateDirector.setMode('full');cast();assert.equal(w.actions.skills.casting,true);complete();assert.equal(enemy.hp,0);assert.equal(hits.filter(hit=>hit.source==='ultimate').reduce((n,h)=>n+h.damage,0),60);assert.equal(hits.filter(hit=>hit.source==='ultimate').length,id==='napoleon'?1:2);assert.ok(hits.every(hit=>hit.source==='ultimate'));
   });
   if(id!=='napoleon')await t.test(`${id} new cover between pulses prevents remaining damage`,async()=>{
    await ready(id);const root=rootFor(id);root.position.set(center[0],floor(center[0],center[2]+5),center[2]+5);aim();w.ultimateDirector.setMode('full');const hp=cast();assert.equal(w.actions.skills.casting,true);
    for(let i=0;i<600&&!hits.some(hit=>hit.source==='ultimate');i++)frame();assert.equal(hp-enemy.hp,48);
    const geometry=new THREE.BoxGeometry(12,6,.3).translate(center[0],enemy.p.y+2,center[2]+2.5),wall={name:'QA_era_late_cover',enabled:true,bvh:new MeshBVH(geometry)};w.colliders.push(wall);
    try{complete();assert.equal(hp-enemy.hp,48,'each later contact must still pass live BVH LOS');assert.equal(hits.filter(hit=>hit.source==='ultimate').length,1);assert.equal(w.actions.skills.energy,0);assert.ok(w.actions.skills.cooldown('ultimate')>0);}
    finally{w.colliders.splice(w.colliders.indexOf(wall),1);geometry.dispose();}
   });
   await t.test(`${id} real boss loses only its authored ultimate budget`,async()=>{
    await ready(id);enemy.mode='dead';enemy.active=false;w.combat.state.setBossRequirements('boss_vacant_king',[]);assert.equal(w.combat.state.beginBoss(w.done,'boss_vacant_king'),true);const boss=w.combat.state.boss;boss.mode='recover';boss.timer=100;frame(120);aim(boss);w.ultimateDirector.setMode('full');const hp=boss.hp;cast();assert.equal(w.actions.skills.casting,true);complete();assert.equal(hp-boss.hp,expected);assert.equal(hits.filter(hit=>hit.source==='ultimate'&&hit.id===boss.id).reduce((n,h)=>n+h.damage,0),expected);
    boss.active=false;boss.mode='dead';boss.hp=0;w.combat.state.bossStarted=false;
   });
   if(id==='napoleon')await t.test('Napoleon clear aim still rejects a horse-sized blocked approach',async()=>{
    await ready(id);const root=rootFor(id);root.position.set(center[0],floor(center[0],center[2]+5),center[2]+5);aim();
    const walls=[-1.2,1.2].map(dx=>{const geometry=new THREE.BoxGeometry(.8,5,14).translate(center[0]+dx,enemy.p.y+2,center[2]);return{name:'QA_horse_flank',enabled:true,bvh:new MeshBVH(geometry)};});w.colliders.push(...walls);
    try{assert.equal(w.actions.options.resolveAim('napoleon','ultimate')?.targetId,enemy.id,'center aim ray is genuinely clear');const hp=cast();assert.equal(w.actions.skills.casting,false,'full horse path, not point LOS, must reject');assert.equal(w.actions.skills.energy,100);assert.equal(w.actions.skills.cooldown('ultimate'),0);assert.equal(enemy.hp,hp);assert.equal(w.ultimateDirector.active,false);}
    finally{for(const wall of walls){w.colliders.splice(w.colliders.indexOf(wall),1);wall.bvh.geometry.dispose();}}
   });
  }
  await h.settleAssets();assert.deepEqual(h.errors,[]);assert.deepEqual(h.warnings,[]);
 }finally{await h.close();}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { bootWorldWithoutGpu } from './world-dom-boot.fixture';
import { SERVANTS } from '../src/contracts';
import { CONTRACT_SKILLS } from '../src/contractSkills';

/** NON-GPU integration: actual GLB clips, production frame/input/HP/terrain BVH.
 * Synthetic recruitment, placement, full ultimate energy and long enemy recovery isolate contacts; this
 * is not visual pixel QA or a natural traversal/endurance playthrough. */
test('NON-GPU companion contacts reduce actual HP, separately from command skills', async t => {
 const h = await bootWorldWithoutGpu({ deterministic:true });
 const {world:w,window}=h; let now=0;
 const frame=(n=1)=>{for(let i=0;i<n;i++){w.combat.state.hp=100;h.frame(now+=1000/60);}};
 const key=(code:string)=>{window.document.body.dispatchEvent(new window.KeyboardEvent('keydown',{code,bubbles:true}));window.document.body.dispatchEvent(new window.KeyboardEvent('keyup',{code,bubbles:true}));};
 const hits:Array<{source:string;damage:number;id:string}>=[];
 const record=w.actions.recordDamage.bind(w.actions);w.actions.recordDamage=(hit:any)=>{hits.push({...hit});record(hit);};
 const poseTrace:any[]=[];
 const startPose=w.actions.options.startPose;
 w.actions.options.startPose=(id:any,command:any)=>{
  const observed={...command,onContact:(p:any,d:any,socket:any,geometry:any)=>{poseTrace.push({type:'contact',id,p:{...p},d:{...d},geometry});command.onContact(p,d,socket,geometry);},onFinish:(completed:boolean)=>{poseTrace.push({type:'finish',id,completed});command.onFinish(completed);}};
  const accepted=startPose(id,observed);poseTrace.push({type:'start',id,accepted,targetId:command.targetId,targetPoint:command.targetPoint,direction:command.direction});return accepted;
 };
 const enemy=w.combat.state.enemies.find((e:any)=>e.kind!=='king'&&!e.miniboss);
 const center=w.layout.markers.find((m:any)=>m.id==='boss_vacant_king').p;
 const floor=(x:number,z:number)=>{
  const ray=new THREE.Ray(new THREE.Vector3(x,center[1]+3,z),new THREE.Vector3(0,-1,0));let best=Infinity;
  for(const c of w.colliders)if(c.enabled){const hit=c.bvh.raycastFirst(ray,THREE.DoubleSide);if(hit&&Math.abs(hit.face?.normal.y??0)>.7)best=Math.min(best,hit.distance);}
  assert.ok(Number.isFinite(best),`supported fixture position ${x},${z}`);return center[1]+3-best;
 };
 const position=(x:number,z:number)=>{w.player.teleport(x,floor(x,z)+.05,z);w.player.onGround=true;w.player.flying=false;w.player.swimming=false;w.player.gliding=false;};
 const resetTarget=(dx=0,dz=0)=>{Object.assign(enemy.p,{x:center[0]+dx,y:floor(center[0]+dx,center[2]+dz),z:center[2]+dz});Object.assign(enemy.home,enemy.p);enemy.hp=enemy.maxHp=10000;enemy.mode='recover';enemy.timer=100;enemy.active=true;enemy.pacified=false;};
 const rootFor=(id:string)=>id==='saber'?w.servant.root:w.scene.children.find((o:any)=>o.name.startsWith('CharacterKit:')&&o.name.toLowerCase().includes(id==='napoleon'?'napoleon':id));
 try {
  w.done.add('armory_rack');for(const s of SERVANTS)w.contract.recruit(s.contract);
  position(center[0],center[2]+7);(window.document.getElementById('start') as HTMLElement).click();await Promise.resolve();frame(2);await h.settleAssets();
  // Remove unrelated targets from this controlled combat lane without granting victories.
  for(const e of w.combat.state.enemies)if(e!==enemy&&e.kind!=='king'){e.mode='dead';e.timer=Infinity;e.hp=0;e.active=false;}
  await t.test('active enemy has rendered body geometry and loses HP; dormant boss has no hostile bar',async()=>{
   resetTarget();frame(2);await h.settleAssets();frame(2);
   const visual=w.combat.visuals.get(enemy.id);assert.equal(visual.root.visible,true);
   let bodies=0;visual.body.traverseVisible((o:any)=>{if(o.isMesh&&o.geometry?.attributes?.position?.count>0)bodies++;});
   assert.ok(bodies>0,'active enemy cannot be only a health bar');
   const hp=enemy.hp;assert.equal(w.combat.damageEnemy(enemy.id,16,{source:'ranged',origin:w.player.pos}),true);assert.equal(enemy.hp,hp-16);
   const boss=w.combat.state.enemies.find((e:any)=>e.id==='boss_vacant_king');
   assert.equal(boss.active,false);assert.equal(w.combat.visuals.get(boss.id).root.visible,false,'untriggered boss must not advertise an attackable health bar');
   assert.equal(w.combat.damageEnemy(boss.id,16,{source:'ranged',origin:w.player.pos}),false);
  });
  await t.test('story pacification shows peace marker instead of an invulnerable hostile bar',()=>{
   const guard=w.combat.state.enemies.find((e:any)=>e.id==='wild_48');assert.ok(guard);
   Object.assign(guard.p,{x:center[0]+2,y:floor(center[0]+2,center[2]+2),z:center[2]+2});Object.assign(guard.home,guard.p);guard.mode='idle';guard.hp=guard.maxHp;guard.timer=0;
   w.done.add('relay_b');frame(3);
   const v=w.combat.visuals.get(guard.id);assert.equal(guard.pacified,true);assert.equal(v.root.visible,true);assert.equal(v.bar.visible,false);assert.equal(v.peaceMarker.visible,true);
   const hp=guard.hp;assert.equal(w.combat.damageEnemy(guard.id,16,{source:'ranged',origin:w.player.pos}),false);assert.equal(guard.hp,hp);
   guard.mode='dead';guard.active=false;guard.timer=Infinity;
  });
  for(const s of SERVANTS) await t.test(s.id,async t=>{
   w.actions.reset();w.contract.select(s.id);position(center[0],center[2]+7);resetTarget();frame(2);await h.settleAssets();frame(2);
   const root=rootFor(s.id);assert.ok(root,`${s.id} actual GLB actor loaded`);
   await t.test('autonomous contact against moving target',t=>{
    root.position.set(center[0]+5,floor(center[0]+5,center[2]+7),center[2]+7);hits.length=0;const hp=enemy.hp;
    for(let i=0;i<600;i++){if(i<180){enemy.p.x=center[0]+Math.sin(i/90)*1.5;enemy.p.y=floor(enemy.p.x,enemy.p.z);}frame();}
    t.diagnostic(`${s.id} ordinary HP loss=${hp-enemy.hp}; sources=${JSON.stringify(hits)}`);
    assert.ok(enemy.hp<hp,`${s.id} must remove HP, not merely animate; root=${root.position.toArray()} enemy=${JSON.stringify(enemy.p)} player=${w.player.pos.toArray()} flags=${JSON.stringify([w.player.onGround,w.player.swimming,w.player.flying,w.player.gliding])}`);
    assert.ok(hits.some(hit=>hit.id===enemy.id&&hit.source==='servant'&&hit.damage>0),'ordinary contact damage source is servant');
   });
   for(const slot of ['skill','ultimate'] as const) await t.test(`${slot} turns toward target even from its opposite side`,t=>{
    position(center[0],center[2]+7);frame(30);assert.equal(w.player.onGround,true,'player settles before skill input');resetTarget();root.position.set(center[0],floor(center[0],center[2]-3),center[2]-3);root.rotation.y=0;w.player.yaw=0;w.actions.reset();hits.length=0;poseTrace.length=0;
    if(slot==='ultimate')w.actions.skills.energyValue=100; // Explicit QA charge injection, not a claim about earning energy.
    key(slot==='skill'?'KeyQ':'KeyX');assert.equal(w.actions.skills.casting,true,`accepted ${slot}`);frame(slot==='ultimate'?900:s.id==='napoleon'?600:300);
    t.diagnostic(`${s.id} ${slot} records=${JSON.stringify(hits)}; pose=${JSON.stringify(poseTrace)}; final actor=${root.position.toArray()}; target=${JSON.stringify(enemy.p)}`);
    if(s.id==='napoleon')for(const contact of poseTrace.filter(e=>e.type==='contact')){const forward=(enemy.p.x-contact.p.x)*contact.d.x+(enemy.p.z-contact.p.z)*contact.d.z;t.diagnostic(`cavalry ${slot} contact forward=${forward}`);assert.ok(forward>0,'authored mounted contact must occur before passing target');}
    assert.ok(hits.some(hit=>hit.id===enemy.id&&hit.source===slot&&hit.damage>0),`${s.id}: command must deal ${slot} HP damage independently of ordinary hits ${JSON.stringify(hits)}`);
    const expected=CONTRACT_SKILLS[s.id][slot].pulses.reduce((sum,pulse)=>sum+pulse.damage,0);
    assert.equal(hits.filter(hit=>hit.id===enemy.id&&hit.source===slot).reduce((sum,hit)=>sum+hit.damage,0),expected,'stationary clear target receives every authored skill pulse, never ordinary-hit substitution');
   });
   await t.test('running far away regroups',()=>{
    enemy.mode='dead';enemy.active=false;enemy.timer=Infinity;position(center[0]+35,center[2]+15);frame(180);
    assert.ok(root.position.distanceTo(w.player.pos)<8,`${s.id} regroup distance ${root.position.distanceTo(w.player.pos)}`);
   });
  });
  await h.settleAssets();assert.deepEqual(h.errors,[]);assert.deepEqual(h.warnings,[]);
 }finally{await h.close();}
});

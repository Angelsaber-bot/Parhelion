/** Actual-main finish control + actual combat API/geometry checks. NON-GPU. */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {bootWorldWithoutGpu} from './world-dom-boot.fixture';
const regions=['alpha','britain','blacksail','winter','kyoto'],finishes=['original','signal','oath','tide','frost','ember'];
test('NON-GPU all earned finishes keep live geometry, muzzle, enemy ray hitbox, gun damage and melee contact identical; reset locks without destroying preference',async()=>{
 const done=['hq_terminal','armory_rack',...regions.map(r=>`campaign_${r}_complete`)];
 const h=await bootWorldWithoutGpu({worldRoot:process.env.WORLD_SOURCE_QA_ROOT,deterministic:true,initialStorage:{'parhelion.world.progress.v2':JSON.stringify({done,found:[]})}});
 const {world:w,window}=h,d=window.document,select=d.getElementById('world-weapon-finish')as HTMLSelectElement;
 try{
  await Promise.all([w.rifle.ready,w.blade.ready]);
  const meshes:THREE.Mesh[]=[];w.rig.root.traverse((o:THREE.Object3D)=>{if((o as THREE.Mesh).isMesh)meshes.push(o as THREE.Mesh);});
  const baseline=meshes.map(m=>({geometry:m.geometry,positions:m.geometry.attributes.position.array.slice(),materials:[m.material].flat()}));
  const originalMuzzle=w.rifle.muzzleWorld().toArray(),originalDone=[...w.done].sort(),colliders=[...w.colliders];
  const e=w.combat.state.enemies.find((e:any)=>e.id.startsWith('wild_')&&!e.miniboss)!;assert.ok(e);
  for(const enemy of w.combat.state.enemies)enemy.active=false;
  e.active=true;e.pacified=false;e.mode='chase';
  const origin={x:e.p.x,y:e.p.y+1.05,z:e.p.z+10},direction={x:0,y:0,z:-1};
  const hit=w.combat.raycast(origin,direction,150);assert.equal(hit?.id,e.id);
  let reference:unknown;
  for(const finish of finishes){
   assert.equal(Array.from(select.options).find(o=>o.value===finish)!.disabled,false);select.value=finish;select.dispatchEvent(new window.Event('change',{bubbles:true}));
   assert.equal(w.rifle.finish,finish);assert.equal(w.blade.finish,finish);assert.equal(w.weaponFinishStore.active(w.done),finish);
   assert.deepEqual([...w.done].sort(),originalDone);assert.deepEqual(w.rifle.muzzleWorld().toArray(),originalMuzzle);assert.deepEqual([...w.colliders],colliders);
   for(const [i,m]of meshes.entries()){assert.equal(m.geometry,baseline[i].geometry);assert.deepEqual(m.geometry.attributes.position.array,baseline[i].positions);assert.deepEqual([m.material].flat(),baseline[i].materials,'finish reuses fixed material identities');}
   e.hp=e.maxHp;e.mode='chase';const before=e.hp;assert.equal(w.combat.damageEnemy(e.id,undefined,{source:'ranged',origin}),true);
   const gunDamage=before-e.hp,ray=w.combat.raycast(origin,direction,150);
   w.actions.melee.reset();assert.equal(w.actions.melee.press(.3),true);const contacts=[];
   for(let i=0;i<120;i++){const contact=w.actions.melee.update(1/120,true);if(contact)contacts.push(JSON.parse(JSON.stringify(contact)));}
   const result={gunDamage,ray:JSON.parse(JSON.stringify(ray)),contacts};if(reference===undefined)reference=result;else assert.deepEqual(result,reference);
  }
  assert.ok((reference as any).gunDamage>0);assert.equal((reference as any).contacts.length,1);
  // Repeated cosmetic switches are bounded; they never rebuild weapon meshes/resources.
  for(let i=0;i<120;i++){select.value=finishes[i%finishes.length];select.dispatchEvent(new window.Event('change',{bubbles:true}));}
  const after:THREE.Mesh[]=[];w.rig.root.traverse((o:THREE.Object3D)=>{if((o as THREE.Mesh).isMesh)after.push(o as THREE.Mesh);});assert.deepEqual(after,meshes);
  select.value='ember';select.dispatchEvent(new window.Event('change',{bubbles:true}));
  (d.getElementById('start')as HTMLElement).click();await Promise.resolve();window.confirm=()=>true;
  d.body.dispatchEvent(new window.KeyboardEvent('keydown',{code:'KeyR',bubbles:true}));d.body.dispatchEvent(new window.KeyboardEvent('keyup',{code:'KeyR',bubbles:true}));
  assert.equal(w.done.size,0);assert.equal(w.weaponFinishStore.preference,'ember');assert.equal(w.weaponFinishStore.active(w.done),'original');assert.equal(w.rifle.finish,'original');assert.equal(w.blade.finish,'original');
  assert.equal(Array.from(select.options).find(o=>o.value==='ember')!.disabled,true);select.value='ember';select.dispatchEvent(new window.Event('change',{bubbles:true}));assert.equal(w.rifle.finish,'original');assert.equal(w.done.size,0);
  assert.deepEqual(h.errors,[]);
 }finally{await h.close();}
});

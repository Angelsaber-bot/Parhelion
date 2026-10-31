/** Real main + loaded GLTF (including mixed ESM/CJS constructors). Entry teleport
 * and explicit authored admission are fixture setup, not a campaign playthrough. */
import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {bootWorldWithoutGpu} from './world-dom-boot.fixture';
import {getFalseDawnEncounterSpec} from '../src/falseDawnEncounterCatalog';
import {measureEnemyWeaponAxis} from '../src/enemyAttackActing';
import {nativeMusketeerContactMuzzle} from '../src/enemyShotSocket';

test('actual-main Warden uses distinct real native blade axes at all three contacts, not a silent cross-constructor fallback',async()=>{
 const h=await bootWorldWithoutGpu({deterministic:true,initialStorage:{'parhelion.world.progress.v2':JSON.stringify({done:['armory_rack'],found:[]})}}),{world:w,window}=h;let now=0;const frame=()=>h.frame(now+=1000/60),spec=getFalseDawnEncounterSpec('false_dawn_warden')!;
 try{
  (window.document.getElementById('start')as HTMLElement).click();await Promise.resolve();const x=spec.anchor.x-.2,z=spec.anchor.z-2.9,g=w.combat.geometry.ground(x,z,spec.anchor.y+4);assert.ok(g);w.player.teleport(x,g.point.y+.04,z);frame();await h.settleAssets();for(let i=0;i<60&&!w.player.onGround;i++)frame();assert.equal(w.player.onGround,true);
  assert.equal(w.combat.startStoryEncounter(spec,{position:w.player.pos,playable:true}).ok,true);frame();await h.settleAssets();frame();
  const enemy=w.combat.state.enemies.find((e:any)=>e.storyEncounter)!,axes:{attack:string;axis:number[]}[]=[];let sequence=0;
  for(let i=0;i<900&&sequence<3;i++){
   frame();if(enemy.contactSequence===sequence)continue;sequence=enemy.contactSequence;
   const instance=w.combat.enemyAssets.instances.get(enemy.id);assert.ok(instance);const calibration=measureEnemyWeaponAxis(instance.gltf.scene,'R');assert.ok(calibration,'loaded native asset must measure even when constructor differs');instance.root.updateWorldMatrix(true,true);
   const hand=instance.root.getObjectByName('handR'),axis=calibration.axis.clone().applyQuaternion(hand.getWorldQuaternion(new THREE.Quaternion())).applyQuaternion(instance.root.getWorldQuaternion(new THREE.Quaternion()).invert()).normalize();axes.push({attack:enemy.attack,axis:axis.toArray()});
   if(enemy.attack==='thrust')assert.ok(axis.z>.99&&Math.abs(axis.y)<.01);if(enemy.attack==='burst')assert.ok(axis.y<-.95);if(enemy.attack==='sweep')assert.ok(axis.y<-.2&&axis.z>.9);
  }
  assert.deepEqual(axes.map(row=>row.attack),['thrust','sweep','burst']);assert.equal(w.combat.state.hp,48);
  w.combat.cancelStoryEncounter();
  const musket={...spec,id:'false_dawn_native_socket_test',actors:[{role:'musketeer',offset:[-2.5,-.8]}]};assert.equal(w.combat.startStoryEncounter(musket,{position:w.player.pos,playable:true}).ok,true);frame();await h.settleAssets();frame();
  const gunner=w.combat.state.enemies.find((e:any)=>e.storyEncounter)!,instance=w.combat.enemyAssets.instances.get(gunner.id),socket=nativeMusketeerContactMuzzle(instance.gltf);assert.ok(socket);assert.ok(Math.abs(socket.z-1.1063)<.015);
  assert.deepEqual(h.errors,[]);console.log('LIVE_NATIVE_CONTACT_AXES',JSON.stringify(axes));
 }finally{await h.close();}
});

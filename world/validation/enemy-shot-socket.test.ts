import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {nativeMusketeerContactMuzzle,transformEnemyContactMuzzle} from '../src/enemyShotSocket';
import {EnemyVisuals} from '../src/enemyVisuals';import {WorldCombatState} from '../src/combat';import {parseLocalGlb} from './player-fixture';
for(const key of ['musketeer','musketeer_lod1'])test(`${key}: actual contact barrel cap supplies an immutable cached visual socket without touching templates`,async()=>{
 const gltf=await parseLocalGlb(new URL(`../public/assets/enemies/${key}.glb`,import.meta.url));const bones=new Map<THREE.Object3D,number[]>(),resources=new Set<THREE.BufferGeometry|THREE.Material>();gltf.scene.traverse(o=>{bones.set(o,[...o.position.toArray(),...o.quaternion.toArray()]);if(o instanceof THREE.Mesh){resources.add(o.geometry);[o.material].flat().forEach(m=>resources.add(m));}});let disposed=0;resources.forEach(r=>r.addEventListener('dispose',()=>disposed++));
 const socket=nativeMusketeerContactMuzzle(gltf);assert.ok(socket);assert.ok(Object.isFrozen(socket));assert.ok(Math.abs(socket.x-.14)<.02);assert.ok(Math.abs(socket.y-1.5185)<.015);assert.ok(Math.abs(socket.z-1.1063)<.015);assert.equal(nativeMusketeerContactMuzzle(gltf),socket);
 for(const [bone,pose]of bones)assert.deepEqual([...bone.position.toArray(),...bone.quaternion.toArray()],pose);assert.equal(disposed,0,'measuring a private skeleton cannot dispose shared geometry/material');
 const origin={x:12,y:4,z:-8},forward=transformEnemyContactMuzzle(socket,origin,{x:12,y:4,z:2}),right=transformEnemyContactMuzzle(socket,origin,{x:22,y:4,z:-8});assert.deepEqual(forward.toArray(),[12+socket.x,4+socket.y,-8+socket.z]);assert.ok(Math.abs(right.x-(12+socket.z))<1e-10);assert.ok(Math.abs(right.z-(-8-socket.x))<1e-10);
});
test('live visual socket follows the immutable contact snapshot, not a stale rendered actor; canceled instances fall back safely',async()=>{
 const gltf=await parseLocalGlb(new URL('../public/assets/enemies/musketeer.glb',import.meta.url)),visuals=new EnemyVisuals();(visuals as any).cache.set('musketeer',gltf);
 const e=new WorldCombatState([{id:'shot',kind:'shade',p:{x:0,y:0,z:0},role:'musketeer'}],[]).enemies[0];e.active=true;e.mode='windup';e.timer=.4;
 const parent=new THREE.Group(),fallback=new THREE.Group();assert.equal(visuals.contactMuzzle(e.id,e.p,e.target),null);visuals.update(e,'musketeer',parent,fallback,0,5,true);
 parent.position.set(100,50,100);parent.rotation.y=2;parent.updateMatrixWorld(true);
 const actual=visuals.contactMuzzle(e.id,{x:2,y:3,z:4},{x:2,y:3,z:14}),local=nativeMusketeerContactMuzzle(gltf)!;assert.ok(actual);assert.deepEqual(actual.toArray(),[2+local.x,3+local.y,4+local.z]);
 visuals.release(e.id);assert.equal(visuals.contactMuzzle(e.id,e.p,e.target),null);visuals.dispose();
});
test('foreign/missing native contact clips are a safe cached fallback',()=>{
 const asset={scene:new THREE.Group(),animations:[]};assert.equal(nativeMusketeerContactMuzzle(asset),null);assert.equal(nativeMusketeerContactMuzzle(asset),null);
});

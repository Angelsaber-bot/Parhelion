import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { makeValleySentinel } from '../src/valleySentinel.ts';
import { EnemyVisuals } from '../src/enemyVisuals.ts';
import { WorldCombatState, BOSSES } from '../src/combat.ts';
import { parseLocalGlb } from './player-fixture.ts';

test('guardian root-local instance matrices preserve all articulated pieces under transformed ancestry', () => {
  const geometries: THREE.BufferGeometry[] = [], materials: THREE.Material[] = [];
  const creature = makeValleySentinel(geometries, materials);
  const scene = new THREE.Group(); scene.position.set(40, 3, -12); scene.rotation.y=.8; scene.scale.setScalar(1.3);
  scene.add(creature.root); creature.root.position.set(9,2,4); creature.root.rotation.y=-.3;
  for(const [time,moving,attacking] of [[0,false,false],[1,true,false],[2,false,true]] as const) {
    creature.update(time,moving,attacking);scene.updateMatrixWorld(true);
    const inv=creature.root.matrixWorld.clone().invert();
    const batches=creature.root.children.filter(o=>o instanceof THREE.InstancedMesh) as THREE.InstancedMesh[];
    for(const batch of batches) {
      const sources: THREE.Mesh[]=[];
      creature.root.traverse(o=>{if(o instanceof THREE.Mesh && !(o instanceof THREE.InstancedMesh) && o.geometry===batch.geometry && o.material===batch.material)sources.push(o);});
      assert.equal(sources.length,batch.count);
      sources.forEach((source,i)=>{
        const expected=new THREE.Matrix4().multiplyMatrices(inv,source.matrixWorld),actual=new THREE.Matrix4();batch.getMatrixAt(i,actual);
        expected.elements.forEach((n,j)=>assert.ok(Math.abs(n-actual.elements[j])<1e-6));
      });
    }
    const versions=batches.map(b=>b.instanceMatrix.version);
    creature.root.position.x+=2;creature.update(time,moving,attacking);
    assert.deepEqual(batches.map(b=>b.instanceMatrix.version),versions,'paused/root movement needs no local instance uploads');
  }
  geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
});

test('enemy hot path caches mesh references and only updates shadow flags at threshold transitions', async()=>{
  const visuals=new EnemyVisuals(),v=visuals as any;
  v.cache.set('ashigaru',await parseLocalGlb(new URL('../public/assets/enemies/ashigaru.glb',import.meta.url)));
  const e=new WorldCombatState([{id:'cpu-test',kind:'shade',p:{x:0,y:0,z:720}}],[]).enemies[0];
  const parent=new THREE.Group(),fallback=new THREE.Group();
  visuals.update(e,'ashigaru',parent,fallback,0,5,true);
  const instance=v.instances.get(e.id);let traversals=0,updates=0;
  instance.root.traverse=()=>{traversals++;};
  const update=instance.mixer.update.bind(instance.mixer);instance.mixer.update=(dt:number)=>{updates++;return update(dt);};
  for(let i=0;i<100;i++)visuals.update(e,'ashigaru',parent,fallback,0,5,true);
  assert.equal(traversals,0);assert.equal(updates,0);
  assert.ok(instance.meshes.every((m:THREE.Mesh)=>m.castShadow));
  visuals.update(e,'ashigaru',parent,fallback,0,19,true);
  assert.ok(instance.meshes.every((m:THREE.Mesh)=>!m.castShadow));
  e.mode='chase';visuals.update(e,'ashigaru',parent,fallback,0,19,true);
  assert.equal(updates,1,'paused state change must still sample new pose');
  visuals.dispose();
});

test('nearest detailed budget changes in the same frame, even when outgoing enemies occur later in spawn order', async()=>{
  const { registerHooks } = await import('node:module');
  const hook=registerHooks({load(url,context,next){return url.endsWith('.css')?{format:'module',source:'',shortCircuit:true}:next(url,context);}});
  class Element {
    style={};classList={add(){},remove(){}};selectors=new Map();
    append(){}remove(){}getContext(){return null;}
    querySelector(key:string){if(!this.selectors.has(key))this.selectors.set(key,new Element());return this.selectors.get(key);}
  }
  (globalThis as any).document={documentElement:{lang:'en'},createElement:()=>new Element(),body:new Element(),getElementById:()=>null};
  (globalThis as any).window={setTimeout:()=>1,addEventListener(){}};
  const {WorldCombat}=await import('../src/combatView.ts');
  const combat=new WorldCombat({scene:new THREE.Scene(),colliders:[],layout:{world:{seed:537,waterLevel:1},areas:[],paths:[],markers:BOSSES.map((b,i)=>({id:b.id,type:'enemy',p:[i*200,0,720]}))} as any,done:new Set(),toast(){},onVictory(){},onPlayerDefeated(){}});
  const view=combat as any;
  view.enemyAssets.loader.load=()=>{};
  const gltf=await parseLocalGlb(new URL('../public/assets/enemies/ashigaru.glb',import.meta.url));
  view.enemyAssets.cache.set('ashigaru',gltf);
  view.enemyAssets.cache.set('ashigaru_lod1',gltf);
  const enemies=new WorldCombatState(Array.from({length:30},(_,i)=>({id:`budget_${i}`,kind:'shade' as const,p:{x:i/2,y:0,z:720}})),[]).enemies;
  combat.state.enemies.splice(0,combat.state.enemies.length,...enemies);
  for(const e of enemies){const v=view.makeEnemy(e);v.model='ashigaru';view.visuals.set(e.id,v);}
  combat.update(0,{x:15,y:0,z:720},false);
  assert.deepEqual([...view.enemyAssets.instances.keys()].sort(),['budget_28','budget_29'],'nearest two real rigs first, not spawn-order first');
  assert.ok(view.visuals.get('budget_6').fallback.visible,'pending detailed slots retain visible regional fallback');
  for(let i=0;i<11;i++)combat.update(0,{x:15,y:0,z:720},false);
  assert.deepEqual([...view.enemyAssets.instances.keys()].sort(),enemies.slice(6).map(e=>e.id).sort());
  combat.update(0,{x:0,y:0,z:720},false);
  assert.ok(view.enemyAssets.instances.has('budget_0') && view.enemyAssets.instances.has('budget_1'),'two incoming slots fill immediately despite outgoing late array order');
  for(let i=0;i<2;i++)combat.update(0,{x:0,y:0,z:720},false);
  assert.deepEqual([...view.enemyAssets.instances.keys()].sort(),enemies.slice(0,24).map(e=>e.id).sort());
  assert.equal(view.enemyAssets.activeMixers,24);
  combat.dispose();hook.deregister();
});

test('clone quota preserves existing LOD until replacement and never delays a chapter boss',async()=>{
  const visuals=new EnemyVisuals(),v=visuals as any;
  v.cache.set('ashigaru',await parseLocalGlb(new URL('../public/assets/enemies/ashigaru.glb',import.meta.url)));
  v.cache.set('ashigaru_lod1',await parseLocalGlb(new URL('../public/assets/enemies/ashigaru_lod1.glb',import.meta.url)));
  const enemies=new WorldCombatState(Array.from({length:3},(_,i)=>({id:`quota_${i}`,kind:'shade' as const,p:{x:0,y:0,z:720}})),[]).enemies;
  const parents=enemies.map(()=>new THREE.Group()),fallbacks=enemies.map(()=>new THREE.Group());
  visuals.tick(0);
  enemies.forEach((e,i)=>visuals.update(e,'ashigaru',parents[i],fallbacks[i],0,5,true));
  assert.equal(visuals.activeMixers,2);assert.equal(fallbacks[2].visible,true);
  const previous=v.instances.get(enemies[0].id);
  visuals.update(enemies[0],'ashigaru',parents[0],fallbacks[0],0,30,true);
  assert.equal(v.instances.get(enemies[0].id),previous,'quota exhaustion keeps existing detailed rig, never empties the slot');
  const boss={...enemies[2],id:'boss_probe',kind:'king' as const};
  assert.equal(visuals.update(boss,'ashigaru',new THREE.Group(),new THREE.Group(),0,5,true),true);
  assert.equal(visuals.activeMixers,3,'boss bypasses ordinary clone quota');
  visuals.tick(0);visuals.update(enemies[0],'ashigaru',parents[0],fallbacks[0],0,30,true);
  assert.equal(v.instances.get(enemies[0].id).key,'ashigaru_lod1');
  visuals.dispose();
});

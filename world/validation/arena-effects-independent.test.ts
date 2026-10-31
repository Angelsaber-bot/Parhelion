/** Independent CPU resource/saturation audit of the actual Arena pool. */
import test from'node:test';import assert from'node:assert/strict';import*as THREE from'three';
import{ArenaCombatEffects}from'../../arena-game/src/combatEffects';
test('Arena saturation keeps newest same-kind effects, bounded distinct label textures, and borrowed resources through clears/disposal',()=>{
 const parent=new THREE.Scene(),unrelated=new THREE.Object3D(),glow=new THREE.Texture();parent.add(unrelated);let glowDisposed=0;glow.addEventListener('dispose',()=>glowDisposed++);
 const surfaces=new Map<string,{value:number;head:boolean;kill:boolean}>(),disposed=new Map<object,number>();const watch=(o:any)=>{if(!disposed.has(o)){disposed.set(o,0);o.addEventListener('dispose',()=>disposed.set(o,disposed.get(o)!+1));}};
 const effects=new ArenaCombatEffects(parent,glow,'low',()=>{const texture=new THREE.Texture();watch(texture);return{texture,paint(value,head,kill){surfaces.set(texture.uuid,{value,head,kill});}};});
 const originalRandom=Math.random;
 try{
  for(let i=0;i<500;i++){effects.tracer([i,0,0],[i,1,-1],0xffaa22);effects.burst([i,0,0],0x55aaff,1,.3,0);effects.damageNumber([i,2,0],i,i%2===0,i%3===0);}
  assert.deepEqual(effects.inventory.allocated,{tracers:48,sparks:192,numbers:32});
  const lines=parent.children.filter(o=>(o as THREE.Line).isLine)as THREE.Line[];const labels=parent.children.filter(o=>o.name==='Arena pooled damage label')as THREE.Sprite[];const sparks=parent.children.filter(o=>o.name==='Arena pooled impact');
  assert.deepEqual(lines.map(l=>l.geometry.attributes.position.getX(0)).sort((a,b)=>a-b),Array.from({length:48},(_,i)=>452+i));assert.deepEqual(sparks.map(s=>s.position.x).sort((a,b)=>a-b),Array.from({length:192},(_,i)=>308+i));
  assert.equal(new Set(labels.map(s=>s.material.map)).size,32);assert.deepEqual(labels.map(s=>surfaces.get(s.material.map!.uuid)!.value).sort((a,b)=>a-b),Array.from({length:32},(_,i)=>468+i));
  for(const label of labels){const state=surfaces.get(label.material.map!.uuid)!;assert.equal(state.head,state.value%2===0);assert.equal(state.kill,state.value%3===0);}
  for(const object of parent.children){const o=object as THREE.Mesh;if(o.material)watch(o.material);if((object as THREE.Line).isLine)watch(o.geometry);}
  const before=effects.inventory;for(const dt of [0,-1,NaN,Infinity])effects.update(dt);assert.deepEqual(effects.inventory,before);effects.tracer([NaN,0,0],[0,0,0],0);effects.burst([0,0,0],0,1,NaN,0);effects.damageNumber([0,0,0],NaN,false,false);assert.deepEqual(effects.inventory,before);
  effects.clear();assert.deepEqual(parent.children,[unrelated]);assert.ok([...disposed.values()].every(n=>n===0));
  for(let round=0;round<50;round++){effects.damageNumber([0,2,0],16,false,false);effects.burst([0,0,0],0xffffff,1,.3,0);effects.tracer([0,0,0],[1,1,1],0xffffff);effects.update(60);assert.deepEqual(parent.children,[unrelated]);assert.deepEqual(effects.inventory.allocated,before.allocated);}
  effects.dispose();effects.dispose();assert.ok([...disposed.values()].every(n=>n===1));assert.equal(glowDisposed,0);assert.deepEqual(parent.children,[unrelated]);effects.tracer([0,0,0],[1,1,1],0);effects.damageNumber([0,0,0],1,false,false);assert.deepEqual(parent.children,[unrelated]);
 }finally{Math.random=originalRandom;effects.dispose();glow.dispose();}
});

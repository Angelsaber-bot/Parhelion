import test from 'node:test';import assert from'node:assert/strict';import*as THREE from'three';
import{bootWorldWithoutGpu}from'./world-dom-boot.fixture';
test('production Tower Halo animation keeps unrelated authored material colors private',async()=>{
 const h=await bootWorldWithoutGpu({worldRoot:process.env.WORLD_SOURCE_QA_ROOT,deterministic:true});const{world:w,window}=h;let now=0;const frame=()=>h.frame(now+=1000/60);
 try{(window.document.getElementById('start')as HTMLElement).click();await Promise.resolve();frame();await h.settleAssets();
  const world=w.scene.getObjectByName('World'),halo=world.getObjectByName('Tower_Halo')as THREE.Mesh;assert.ok(halo);const material=halo.material as THREE.MeshBasicMaterial;
  const other=new Map<THREE.Material,number>();world.traverse((o:THREE.Object3D)=>{const m=o as THREE.Mesh;if(!m.isMesh||m===halo||m.name.endsWith('__outline'))return;for(const mat of Array.isArray(m.material)?m.material:[m.material]){assert.notEqual(mat,material,`animated halo never aliases ${m.name}`);if((mat as THREE.MeshBasicMaterial).color)other.set(mat,(mat as THREE.MeshBasicMaterial).color.getHex());}});
  const initial=material.color.getHex();w.done.add('tower_console');for(let i=0;i<30;i++)frame();assert.notEqual(material.color.getHex(),initial,'real main animates only unlocked halo');
  for(const[mat,color]of other)assert.equal((mat as THREE.MeshBasicMaterial).color.getHex(),color,`${mat.name} cannot inherit halo animation`);
  window.confirm=()=>true;window.document.body.dispatchEvent(new window.KeyboardEvent('keydown',{code:'KeyR',bubbles:true}));window.document.body.dispatchEvent(new window.KeyboardEvent('keyup',{code:'KeyR',bubbles:true}));
  assert.equal(w.done.size,0);assert.equal(material.color.getHex(),initial,'reset restores private halo color');assert.deepEqual(h.errors,[]);
 }finally{await h.close();}
});

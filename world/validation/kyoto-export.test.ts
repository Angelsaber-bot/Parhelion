import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { regionLoader,bakeQuantized } from '../src/glb.ts';
const bytes=readFileSync(new URL('../public/assets/world_kyoto.glb',import.meta.url));
const gltf=await regionLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');bakeQuantized(gltf.scene);
const art=gltf.scene.getObjectByName('ART')!;
const mesh=(name:string)=>{const m=art.getObjectByName(name) as THREE.Mesh;assert.ok(m?.isMesh,`actual exported mesh ${name}`);return m;};
const tris=(m:THREE.Mesh)=>(m.geometry.index?.count??m.geometry.attributes.position.count)/3;
test('Kyoto exported art has real architectural layers and separate landmark surface profiles',()=>{
 assert.ok(tris(mesh('Kyoto_RoofCraft'))>10000);
 assert.ok(tris(mesh('Rakuchu'))>60000);
 assert.ok(tris(mesh('Kinkaku_Gold'))>500);
 assert.ok(tris(mesh('Higashiyama'))>10000);
 assert.equal((mesh('Kinkaku_Gold').material as THREE.Material).name,'M_KyotoGold');
 assert.equal((mesh('Kyoto_RoofCraft').material as THREE.Material).name,'M_KyotoRoof');
 for(const name of ['Arashiyama_Timber','Arashiyama_Bamboo','Arashiyama_GardenStone','Arashiyama_Roofs'])assert.ok(tris(mesh(name))>1000,name);
 const bounds=new THREE.Box3().setFromObject(mesh('Arashiyama_Bamboo'));
 assert.ok(bounds.max.y-bounds.min.y>8,'bamboo has genuine upright volume, not labels or flat ground decoration');
});
test('Kyoto exported art remains finite, bounded, and below explicit review asset budgets',()=>{
 let total=0,calls=0;
 art.traverse(o=>{const m=o as THREE.Mesh;if(!m.isMesh)return;calls++;total+=tris(m);
  for(const value of m.geometry.attributes.position.array)assert.ok(Number.isFinite(value),`${m.name} finite coordinates`);
  const box=new THREE.Box3().setFromObject(m);assert.ok(box.min.x>=-800&&box.max.x<=800&&box.min.z>=-800&&box.max.z<=800,`${m.name} sane region bounds`);
 });
 assert.ok(bytes.byteLength<25*1024*1024,'individual deployment asset below25MiB');
 assert.ok(total<2_000_000,`art triangle review ceiling2m, actual ${total}`);
 assert.ok(calls<100,`pre-chunk art mesh ceiling100, actual ${calls}`);
 // These are export budgets, NOT a measured frame-rate or runtime draw-call guarantee.
});

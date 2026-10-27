import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { regionLoader, bakeQuantized } from '../src/glb.ts';
import { collisionSnapshot } from './blacksail/collision-snapshot.ts';
const path=new URL('../public/assets/world_blacksail.glb',import.meta.url).pathname;
const bytes=readFileSync(path);
const gltf=await regionLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
bakeQuantized(gltf.scene);gltf.scene.updateMatrixWorld(true);
test('Everblacksail exported geometry is finite and stays under the 2 million ART triangle / 12.4 MB transfer budgets',()=>{
 let artTriangles=0;gltf.scene.traverse(o=>{const m=o as THREE.Mesh;if(!m.isMesh)return;
  assert.ok(m.matrixWorld.elements.every(Number.isFinite),`${m.name} finite transform`);
  for(const [name,a] of Object.entries(m.geometry.attributes)) for(let i=0;i<a.count;i++)for(let k=0;k<a.itemSize;k++)assert.ok(Number.isFinite(a.getComponent(i,k)),`${m.name}.${name}[${i},${k}] finite`);
  if(m.geometry.index)for(let i=0;i<m.geometry.index.count;i++)assert.ok(m.geometry.index.getX(i)<m.geometry.attributes.position.count,`${m.name} valid index`);
  let p=m.parent;while(p){if(p.name==='ART'){artTriangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;break;}p=p.parent;}
 });assert.ok(artTriangles<2_000_000,`${artTriangles} ART triangles`);assert.ok(bytes.length<12_400_000,`${bytes.length} bytes`);
});
test('Everblacksail collision meshes preserve exact baseline ordered triangle positions and gameplay extras',async()=>{
 const before=JSON.parse(readFileSync(new URL('./blacksail/baseline-collision.json',import.meta.url),'utf8'));
 assert.deepEqual(await collisionSnapshot(path),before);
});

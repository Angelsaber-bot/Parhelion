import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { regionLoader, bakeQuantized } from '../src/rendering/glb.ts';
import { collisionSnapshot } from './winter/collision-snapshot.ts';
import {unseatedGlbPath} from './join-band-seating.ts';
const path=new URL('../public/assets/world_winter.glb',import.meta.url).pathname;
const bytes=readFileSync(path);
const gltf=await regionLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
bakeQuantized(gltf.scene);gltf.scene.updateMatrixWorld(true);
test('Everwinter exported geometry is finite and stays under the 2 million ART triangle / 12.4 MB transfer budgets',()=>{
 let artTriangles=0;gltf.scene.traverse(o=>{const m=o as THREE.Mesh;if(!m.isMesh)return;
  assert.ok(m.matrixWorld.elements.every(Number.isFinite),`${m.name} finite transform`);
  for(const [name,a] of Object.entries(m.geometry.attributes)) for(let i=0;i<a.count;i++)for(let k=0;k<a.itemSize;k++)assert.ok(Number.isFinite(a.getComponent(i,k)),`${m.name}.${name}[${i},${k}] finite`);
  if(m.geometry.index)for(let i=0;i<m.geometry.index.count;i++)assert.ok(m.geometry.index.getX(i)<m.geometry.attributes.position.count,`${m.name} valid index`);
  let p=m.parent;while(p){if(p.name==='ART'){artTriangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;break;}p=p.parent;}
 });assert.ok(artTriangles<2_000_000,`${artTriangles} ART triangles`);assert.ok(bytes.length<12_400_000,`${bytes.length} bytes`);
});
test('Everwinter collision preserves the refreshed baseline and its authored burned-open ruin shells',async()=>{
 const before=JSON.parse(readFileSync(new URL('./winter/baseline-collision.json',import.meta.url),'utf8'));
 // Baseline refreshed after the Winter rebuild (refresh-map-baselines.ts); the 13 burned-open
 // replacements and house foundations are already part of it, so every collider must match exactly.
 const now=await collisionSnapshot(await unseatedGlbPath(path,'winter')); // join-band prop seating reversed
 const repair=now.find(m=>m.name==='COL_Winter_House_Foundations');
 assert.deepEqual(now.filter(m=>m.name!=='COL_Terrain'),before.filter((m:{name:string})=>m.name!=='COL_Terrain'),'gates, targets, props and repairs stay exact; continuous terrain is checked elsewhere');
 const ruins=now.find(m=>m.name==='COL_Winter_Ruin_Shells');
 assert.ok(ruins);assert.equal(ruins.extras.winterRuinShell,true);
 // Every listed burned-open house is an authored 23-box shell (17 houses since the Winter rebuild).
 const houses=(ruins.extras.houses??[]) as unknown[];assert.ok(houses.length>=13,`${houses.length} ruin houses`);assert.equal(ruins.triangles,houses.length*23*12);
 assert(repair);assert.ok(repair.triangles>0&&repair.triangles<=768);assert.equal(repair.triangles%12,0);
 assert.equal(repair.extras.dynamic,true);assert.equal(repair.extras.groundFooting,true);
});

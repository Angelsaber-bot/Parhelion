import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {regionLoader,bakeQuantized} from '../src/glb.ts';
import {collisionSnapshot} from './kingdom-valley/collision-snapshot.ts';
for(const region of ['alpha','britain']) {
 const path=new URL(`../public/assets/world_${region}.glb`,import.meta.url).pathname;
 const bytes=readFileSync(path);
 const gltf=await regionLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 bakeQuantized(gltf.scene);gltf.scene.updateMatrixWorld(true);
 test(`${region}: actual exported geometry has finite attributes and valid indices within transfer and triangle budgets`,()=>{
  let triangles=0;
  gltf.scene.traverse(o=>{const m=o as THREE.Mesh;if(!m.isMesh)return;
   assert.ok(m.matrixWorld.elements.every(Number.isFinite),`${m.name} matrix`);
   for(const[name,a]of Object.entries(m.geometry.attributes))for(let i=0;i<a.count;i++)for(let k=0;k<a.itemSize;k++)assert.ok(Number.isFinite(a.getComponent(i,k)),`${m.name}.${name}`);
   if(m.geometry.index)for(let i=0;i<m.geometry.index.count;i++){const n=m.geometry.index.getX(i);assert.ok(Number.isInteger(n)&&n>=0&&n<m.geometry.attributes.position.count,`${m.name} index ${n}`);}
   let p=m.parent;while(p){if(p.name==='ART'){triangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;break;}p=p.parent;}
  });
  assert.ok(triangles<2_000_000,`${triangles} ART triangles`);assert.ok(bytes.length<12_400_000,`${bytes.length} bytes`);
 });
 test(`${region}: exact baseline collision preserved except explicitly realigned Alpha seam gates`,async()=>{
  const baseline=JSON.parse(readFileSync(new URL(`./kingdom-valley/${region}-baseline-collision.json`,import.meta.url),'utf8'));
  const now=await collisionSnapshot(path);
  const allowed=region==='alpha'?['west','north','east','south'].map(id=>`COL_Seam_${id}_Gate`):[];
  assert.deepEqual(now.filter(n=>!allowed.includes(n.name)),baseline.filter(n=>!allowed.includes(n.name)));
  for(const name of allowed){
    const before=baseline.find(n=>n.name===name),after=now.find(n=>n.name===name);
    assert.deepEqual(after.extras,before.extras,'unchanged summon-circle unlock');
    assert.equal(after.triangles,60,'three realigned field panels, independently tested against ART/player');
  }
 });
}

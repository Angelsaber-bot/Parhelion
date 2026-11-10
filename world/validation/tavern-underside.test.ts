import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import * as THREE from 'three';
import {regionLoader,bakeQuantized} from '../src/rendering/glb.ts';
import {snapshot} from './map-polish/snapshot.mjs';
import {tavernRoofUnderside} from '../tools/gen/blacksail/architecture.ts';

// The broader building-repair request now regenerates Nassau's hip roofs.
// Compressed BIN offsets are not stable across a rebuild; protect the decoded
// collider/layout contract and the old tavern's exact six-face shape instead.
test('Nassau rebuild preserves all original decoded collision nodes and layout',async()=>{
 const baseline=JSON.parse(readFileSync(new URL('./map-polish/baseline.json',import.meta.url),'utf8')).regions.blacksail;
 const now=await snapshot(fileURLToPath(new URL('../public/assets/',import.meta.url)),'blacksail');
 assert.equal(now.layoutSha256,baseline.layoutSha256);
 for(const [name,node]of Object.entries(baseline.nodes))if(name.startsWith('COL_')&&name!=='COL_Terrain')assert.deepEqual(now.nodes[name],node,name);
});

test('shipped tavern retains six inward FrontSide timber faces after compression',async()=>{
 const bytes=readFileSync(new URL('../public/assets/world_blacksail.glb',import.meta.url));
 const gltf=await regionLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');bakeQuantized(gltf.scene);
 const node=gltf.scene.getObjectByName('Nassau_Tavern_Timber_Underside') as THREE.Mesh;
 assert(node?.isMesh);assert.equal(node.parent?.name,'ART');assert.equal(node.userData.outline,false);assert.equal(node.userData.dynamic,false);
 const material=node.material as THREE.Material;assert.equal(material.name,'M_BlackSailTimber');assert.equal(material.side,THREE.FrontSide);
 const g=node.geometry.index?node.geometry.toNonIndexed():node.geometry;assert.equal(g.attributes.position.count,18);
 // Original authoring dimensions, independently of the regenerated GLB layout.
 const expected=tavernRoofUnderside(-128,3.4,128,16,11).vis[0].attributes.position;
 const actual=g.attributes.position;
 for(let i=0;i<actual.count;i++){
  const a=new THREE.Vector3().fromBufferAttribute(actual,i);
  let nearest=Infinity;for(let j=0;j<expected.count;j++)nearest=Math.min(nearest,a.distanceTo(new THREE.Vector3().fromBufferAttribute(expected,j)));
  assert.ok(nearest<.002,`original lining moved ${nearest}m`);
  assert.ok(g.attributes.normal.getY(i)<-.1);
 }
 for(const x of [-129.5,-126.5])for(const z of [126,130]){
  const hits=new THREE.Raycaster(new THREE.Vector3(x,5,z),new THREE.Vector3(0,1,0),0,15).intersectObject(node);
  assert.equal(hits.length,1);assert.ok(hits[0].point.y>8.4&&hits[0].point.y<10.84);
 }
});

/** Structural regressions against actual decoded production GLB triangles. */
import {test}from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';import*as THREE from'three';import{MeshBVH}from'three-mesh-bvh';import{mergeGeometries}from'three/examples/jsm/utils/BufferGeometryUtils.js';import{regionLoader,bakeQuantized}from'../src/glb.ts';
const bytes=readFileSync(new URL('../public/assets/world_winter.glb',import.meta.url));const gltf=await regionLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');bakeQuantized(gltf.scene);gltf.scene.updateMatrixWorld(true);
function subset(prefix:string){const geos:THREE.BufferGeometry[]=[];gltf.scene.traverse(o=>{const m=o as THREE.Mesh;if(!m.isMesh||!m.name.startsWith(prefix))return;const g=new THREE.BufferGeometry().setAttribute('position',m.geometry.attributes.position.clone());if(m.geometry.index)g.setIndex(m.geometry.index.clone());geos.push((g.index?g.toNonIndexed():g).applyMatrix4(m.matrixWorld));});assert.ok(geos.length,`actual export ${prefix}`);return new MeshBVH(mergeGeometries(geos));}
const kremlin=subset('Kremlin_Winter'),basil=subset('Red_Square_Winter'),allKremlin=subset('Kremlin');
function cast(bvh:MeshBVH,origin:number[],dir:number[]){return bvh.raycast(new THREE.Ray(new THREE.Vector3(...origin),new THREE.Vector3(...dir)),THREE.DoubleSide).sort((a,b)=>a.distance-b.distance);}
test('Everwinter actual gate lintels have no overlapping coplanar pier faces or black self-shadow panels',()=>{
 // The old six-metre overlap yielded each front/back hit twice, causing visible black rectangles.
 for(const [o,d]of[[[-1.63,26.6,-143],[0,0,-1]],[[57,34.6,-210.37],[-1,0,0]]]as number[][][]){const hits=cast(kremlin,o,d).filter(h=>h.distance<20);assert.equal(hits.length,2,`one front and one back surface at ${o}; hits ${hits.map(h=>h.distance)}`);}
});
test('Everwinter Ivan belfries have actual open arcades flanked by supporting masonry',()=>{
 for(const y of[38,46])assert.equal(cast(kremlin,[20,y,-214],[-1,0,0]).length,0,`open cross-section at y=${y}, not a black painted window`);
 assert.ok(cast(kremlin,[20,46,-212.5],[-1,0,0]).length>=2,'side piers support the open belfry');
 assert.ok(cast(kremlin,[20,42.2,-214],[-1,0,0]).length>=2,'solid cornice between open tiers');
});
test('Everwinter St Basil export has eight surrounding dome volumes and a higher central tent tower',()=>{
 const highest=(x:number,z:number)=>cast(basil,[x,90,z],[0,-1,0])[0]?.point.y;
 const center=highest(96,-252);assert.ok(center&&center>40,'central tent and finial have actual height');
 for(let k=0;k<8;k++){const a=k*Math.PI/4,r=k%2?9:10.5;const y=highest(96+Math.cos(a)*r+.12,-252+Math.sin(a)*r+.07);assert.ok(y&&y>26&&y<center,`dome ${k} distinct surrounding volume, y=${y}`);}
});

test('Everwinter upper scaffold landing has a single visible deck surface, not overlapping black panels',()=>{
 const hits=cast(allKremlin,[-14.2,60,-205.7],[0,-1,0]).filter(h=>Math.abs(h.point.y-42)<.02);
 assert.equal(hits.length,1,`one top landing surface; hits ${hits.map(h=>h.point.toArray())}`);
});

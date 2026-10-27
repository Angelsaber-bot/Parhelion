/** Structural assertions against actual decoded production ART, not source-only mocks. */
import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import * as THREE from 'three';import {MeshBVH} from 'three-mesh-bvh';import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';import {regionLoader,bakeQuantized} from '../src/glb.ts';
const bytes=readFileSync(new URL('../public/assets/world_blacksail.glb',import.meta.url));const gltf=await regionLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');bakeQuantized(gltf.scene);gltf.scene.updateMatrixWorld(true);
function subset(prefix:string){const geos:THREE.BufferGeometry[]=[];gltf.scene.getObjectByName('ART')!.traverse(o=>{const m=o as THREE.Mesh;if(!m.isMesh||!m.name.startsWith(prefix))return;const g=new THREE.BufferGeometry().setAttribute('position',m.geometry.attributes.position.clone());if(m.geometry.index)g.setIndex(m.geometry.index.clone());geos.push((g.index?g.toNonIndexed():g).applyMatrix4(m.matrixWorld));});assert.ok(geos.length,`actual export ${prefix}`);return new MeshBVH(mergeGeometries(geos));}
function cast(bvh:MeshBVH,o:number[],d:number[]){return bvh.raycast(new THREE.Ray(new THREE.Vector3(...o),new THREE.Vector3(...d)),THREE.DoubleSide).sort((a,b)=>a.distance-b.distance);}
test('Black Sail W4 bow deck has a single visible top surface, not overlapping rectangle/diamond faces',()=>{
 const bvh=subset('Sky_Wrecks_Ship_-160_-214_Timber'),a=.2;
 // Offset avoids plank seams, mast and centerline. Former rectangle and diamond shared y=68.
 for(const [v,u] of [[1.13,-8.37],[-1.17,-8.43]]){const x=-160+Math.cos(a)*v+Math.sin(a)*u,z=-214-Math.sin(a)*v+Math.cos(a)*u;
  const hits=cast(bvh,[x,69,z],[0,-1,0]).filter(h=>Math.abs(h.point.y-68)<.025);
  assert.equal(hits.length,1,`single top at local ${v},${u}, actual heights ${hits.map(h=>h.point.y)}`);
 }
});
test('Black Sail lighthouse gallery joins its central disk without coplanar black overlap',()=>{
 const bvh=subset('');const top=36.02726745605469;
 // The old radial boxes began at r=3.3 while the central disk extended to r=3.4.
 for(const a of [.47,.83,1.17]){const x=266+3.35*Math.cos(a),z=-14+3.35*Math.sin(a);
  const hits=cast(bvh,[x,top+1,z],[0,-1,0]).filter(h=>Math.abs(h.point.y-top)<.025);
  assert.equal(hits.length,1,`single gallery top at angle ${a}: ${hits.map(h=>h.point.y)}`);
 }
});
test('Black Sail flagship bow approach has no opaque high hull wall above the original deck route',()=>{
 const bvh=subset('Ghost_Fleet_Ship_296_104_Timber'),a=.15,u=-20.1,v=15;
 const x=296+Math.cos(a)*v+Math.sin(a)*u,z=104-Math.sin(a)*v+Math.cos(a)*u;
 const hits=cast(bvh,[x,9,z],[-Math.cos(a),0,Math.sin(a)]).filter(h=>h.distance<30);
 assert.equal(hits.length,0,'bow side hull must not rise two metres above walkable deck / bridge approach');
});
test('Black Sail sky wreck full-height mast colliders remain visibly represented by stripped spars',()=>{
 const wrecks=[[-112,-160,26,22,.4],[-146,-142,40,26,-.5],[-178,-170,54,22,1.2],[-160,-214,68,30,.2],[-108,-214,46,18,-1.1]];
 for(const [cx,cz,deck,len,a] of wrecks){const bvh=subset(`Sky_Wrecks_Ship_${cx}_${cz}_Timber`),masts=len>24?2:1;
  for(let k=0;k<masts;k++){const u=-len*.22+k*len*.48/Math.max(1,masts-1),x=cx+Math.cos(a)+Math.sin(a)*u,z=cz-Math.sin(a)+Math.cos(a)*u;
   const hits=cast(bvh,[x,deck+len*.75*.9,z],[-Math.cos(a),0,Math.sin(a)]).filter(h=>h.distance<2);
   assert.ok(hits.length>=2,`wreck ${cx},${cz} mast ${k}: full-height old COL needs visible upper spar`);
  }
 }
});

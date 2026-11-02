import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {RegionVisualStreaming} from '../src/regionVisualStreaming';
function tinyGlb(){
 const positions=new Float32Array([0,0,0,1,0,0,0,1,0]);
 const json=new TextEncoder().encode(JSON.stringify({asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0}],meshes:[{primitives:[{attributes:{POSITION:0}}]}],buffers:[{byteLength:positions.byteLength}],bufferViews:[{buffer:0,byteOffset:0,byteLength:positions.byteLength}],accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3',min:[0,0,0],max:[1,1,0]}]}));
 const padded=(json.length+3)&~3,buffer=new ArrayBuffer(12+8+padded+8+positions.byteLength),v=new DataView(buffer);v.setUint32(0,0x46546c67,true);v.setUint32(4,2,true);v.setUint32(8,buffer.byteLength,true);v.setUint32(12,padded,true);v.setUint32(16,0x4e4f534a,true);new Uint8Array(buffer,20,padded).fill(32);new Uint8Array(buffer,20,json.length).set(json);v.setUint32(20+padded,positions.byteLength,true);v.setUint32(24+padded,0x004e4942,true);new Uint8Array(buffer,28+padded).set(new Uint8Array(positions.buffer));return buffer;
}
test('stream failure is retryable; concurrent callers deduplicate; eviction owns real geometry/material disposal',async()=>{
 const original=globalThis.fetch,parent=new THREE.Group();let fail=true,requests=0,now=0;globalThis.fetch=async()=>{requests++;await Promise.resolve();return fail?new Response('',{status:503}):new Response(tinyGlb());};
 const s=new RegionVisualStreaming({parent,outlines:false,lowQuality:true,now:()=>now});
 try{
  assert.equal(await s.ensure('alpha'),false);assert.deepEqual(s.diagnostics.failed,['alpha']);assert.deepEqual(s.diagnostics.pending,[]);
  fail=false;const results=await Promise.all([s.retry('alpha'),s.ensure('alpha')]);assert.deepEqual(results,[true,true]);assert.equal(requests,2);assert.equal(parent.children.length,1);
  let g=0,m=0;parent.traverse(o=>{const mesh=o as THREE.Mesh;if(mesh.isMesh){mesh.geometry.addEventListener('dispose',()=>g++);(mesh.material as THREE.Material).addEventListener('dispose',()=>m++);}});
  now=20;s.update(new THREE.Vector3(600,0,0),new THREE.Vector3(600,5,0));await s.ensure('blacksail');assert.equal(s.ready('alpha'),false);assert.ok(g>0&&m>0);assert.ok(s.diagnostics.disposedGeometries>0&&s.diagnostics.disposedMaterials>0);assert.equal(parent.children.length,1);
 }finally{s.dispose();globalThis.fetch=original;}assert.equal(parent.children.length,0);
});
test('aborted and late region downloads cannot install after departure or disposal',async()=>{
 const original=globalThis.fetch,parent=new THREE.Group();let finish!:(r:Response)=>void,signal:AbortSignal|undefined;
 globalThis.fetch=(_input,init)=>{signal=init?.signal??undefined;return new Promise(resolve=>{finish=resolve;});};
 const s=new RegionVisualStreaming({parent,outlines:false,lowQuality:true,eager:true});
 try{const request=s.ensure('kyoto');s.dispose();assert.ok(signal?.aborted);finish(new Response(tinyGlb()));assert.equal(await request,false);assert.equal(parent.children.length,0);assert.equal(s.diagnostics.installs,0);assert.deepEqual(s.diagnostics.pending,[]);assert.equal(await s.ensure('alpha'),false);}finally{s.dispose();globalThis.fetch=original;}
});

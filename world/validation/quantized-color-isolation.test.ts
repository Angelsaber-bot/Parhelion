/** Storage-format proof, not a GPU normalization/pixel comparison. */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const root=process.env.WORLD_SOURCE_QA_ROOT??resolve(import.meta.dirname,'..');
const {bakeQuantized}=await import(pathToFileURL(resolve(root,'src/glb.ts')).href);
test('quantized shared mesh clones isolate authored colors and transforms',()=>{
 for(const interleaved of [false,true]){
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(new Int16Array([0,0,0,32767,0,0,0,32767,0]),3,true));
  const source=new Uint8Array(interleaved?[0,128,255,17,255,64,0,19,1,2,3,23]:[0,128,255,255,64,0,1,2,3]);
  const color=interleaved?new THREE.InterleavedBufferAttribute(new THREE.InterleavedBuffer(source,4),3,0,true):new THREE.BufferAttribute(source,3,true);
  geometry.setAttribute('color',color);geometry.setIndex([0,1,2]);
  const group=new THREE.Group(),a=new THREE.Mesh(geometry),b=new THREE.Mesh(geometry);a.position.x=2;b.position.x=7;group.add(a,b);bakeQuantized(group);
  assert.notEqual(a.geometry,b.geometry);assert.equal(a.geometry.attributes.position.getX(0),2);assert.equal(b.geometry.attributes.position.getX(0),7);
  const ac=a.geometry.attributes.color,bc=b.geometry.attributes.color;
  for(let i=0;i<3;i++)for(let c=0;c<3;c++)assert.equal(Math.fround(ac.getComponent(i,c)),Math.fround(bc.getComponent(i,c)));
  if(process.env.WORLD_EXPECT_PACKED_COLOR==='1'){
   assert.equal(ac.normalized,true);assert.equal(bc.normalized,true);
   const aa=(ac as any).isInterleavedBufferAttribute?(ac as any).data.array:ac.array;
   const ba=(bc as any).isInterleavedBufferAttribute?(bc as any).data.array:bc.array;
   assert.ok(aa instanceof Uint8Array&&ba instanceof Uint8Array);assert.notEqual(aa.buffer,ba.buffer);
   assert.equal(Boolean((ac as any).isInterleavedBufferAttribute),interleaved);
   if(interleaved){assert.equal((ac as any).data.stride,4);assert.equal((ac as any).offset,0);assert.equal(aa[3],17);}
  }
  ac.setX(0,1);assert.equal(bc.getX(0),0,'one transformed mesh cannot recolor another');
 }
});

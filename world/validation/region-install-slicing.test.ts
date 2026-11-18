import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {bakeQuantized,bakeQuantizedSliced,frameSlicer} from '../src/rendering/glb';
import {RegionVisualStreaming} from '../src/map/regionVisualStreaming';

/** A quantized, transformed scene with one shared geometry, as region GLBs ship. */
function quantizedScene(){
 const root=new THREE.Group();
 const shared=new THREE.BufferGeometry();
 shared.setAttribute('position',new THREE.BufferAttribute(new Int16Array([0,0,0,32767,0,0,0,32767,0,-32767,-32767,12000]),3,true));
 shared.setAttribute('color',new THREE.BufferAttribute(new Uint8Array([255,0,0,255,0,255,0,255,0,0,255,255,9,9,9,255]),4,true));
 shared.setIndex([0,1,2,0,2,3]);
 for(let i=0;i<5;i++){const m=new THREE.Mesh(shared,new THREE.MeshBasicMaterial());m.position.set(i*3,1,-i);m.rotation.y=i*.4;m.scale.setScalar(2+i);root.add(m);}
 const plain=new THREE.Mesh(new THREE.BoxGeometry(1,2,3),new THREE.MeshBasicMaterial());plain.position.set(-4,0,2);root.add(plain);
 return root;
}
const dump=(root:THREE.Object3D)=>{const out:unknown[]=[];root.traverse(o=>{const m=o as THREE.Mesh;if(!m.isMesh)return;
 out.push([m.position.toArray(),m.quaternion.toArray(),m.scale.toArray(),Object.entries(m.geometry.attributes).map(([k,a])=>[k,a.normalized,Array.from(a.array as ArrayLike<number>)]),m.geometry.boundingSphere?.radius]);});return JSON.stringify(out);};

test('sliced baking produces exactly the same geometry as the one-shot bake',async()=>{
 const a=quantizedScene(),b=quantizedScene();bakeQuantized(a);
 let yields=0;await bakeQuantizedSliced(b,()=>{yields++;return undefined;});
 assert.equal(dump(b),dump(a));assert.equal(yields,6,'one yield opportunity per mesh');
});

test('frame slicer continues synchronously within budget and pauses only after it',async()=>{
 let t=0;const clock=()=>t,slice=frameSlicer(8,clock);
 t=5;assert.equal(slice(),undefined,'within budget: no pause, no microtask hop');
 t=20;const pause=slice();assert.ok(pause instanceof Promise,'past the budget it hands back a pause');let resumed=false;void pause!.then(()=>{resumed=true;});await Promise.resolve();assert.equal(resumed,false,'the pause lasts until the next task');await pause;assert.equal(resumed,true);
 assert.equal(slice(),undefined,'the budget restarts after a pause');
 const never=frameSlicer(0,clock);t=1e9;assert.equal(never(),undefined);
});

function tinyGlb(){
 const positions=new Float32Array([0,0,0,1,0,0,0,1,0]);
 const json=new TextEncoder().encode(JSON.stringify({asset:{version:'2.0'},scene:0,scenes:[{nodes:[0,1]}],nodes:[{mesh:0},{mesh:0,translation:[2,0,0]}],meshes:[{primitives:[{attributes:{POSITION:0}}]}],buffers:[{byteLength:positions.byteLength}],bufferViews:[{buffer:0,byteLength:positions.byteLength}],accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3',min:[0,0,0],max:[1,1,0]}]}));
 const padded=(json.length+3)&~3,buffer=new ArrayBuffer(12+8+padded+8+positions.byteLength),v=new DataView(buffer);v.setUint32(0,0x46546c67,true);v.setUint32(4,2,true);v.setUint32(8,buffer.byteLength,true);v.setUint32(12,padded,true);v.setUint32(16,0x4e4f534a,true);
 new Uint8Array(buffer,20,padded).fill(0x20);new Uint8Array(buffer,20,json.length).set(json);v.setUint32(20+padded,positions.byteLength,true);v.setUint32(24+padded,0x004e4942,true);new Uint8Array(buffer,28+padded).set(new Uint8Array(positions.buffer));return buffer;
}
test('a sliced install still completes, and disposing mid-install releases everything',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>new Response(tinyGlb());
 try{
  const parent=new THREE.Group(),s=new RegionVisualStreaming({parent,outlines:false,lowQuality:true,eager:true});s.sliceMs=1e-9;
  assert.equal(await s.ensure('alpha'),true);assert.equal(parent.children.length,1);assert.equal(s.diagnostics.installs,1);s.dispose();
  const other=new THREE.Group(),t=new RegionVisualStreaming({parent:other,outlines:false,lowQuality:true,eager:true});t.sliceMs=1e-9;
  const pending=t.ensure('alpha');await new Promise(r=>setTimeout(r,0));t.dispose();
  assert.equal(await pending,false);assert.equal(other.children.length,0);assert.equal(t.diagnostics.installs,0);
 }finally{globalThis.fetch=original;}
});

import {chunkMesh} from '../src/rendering/chunk';
/** The pre-optimisation chunker (string cell keys), kept as the reference. */
function chunkReference(mesh:THREE.Mesh,cell:number){
 const g=mesh.geometry,pos=g.attributes.position as THREE.BufferAttribute,index=g.index,tris=index?index.count/3:pos.count/3,vid=(t:number,k:number)=>index?index.getX(t*3+k):t*3+k;
 const buckets=new Map<string,number[]>();
 for(let t=0;t<tris;t++){const a=vid(t,0),b=vid(t,1),c=vid(t,2),x=(pos.getX(a)+pos.getX(b)+pos.getX(c))/3,z=(pos.getZ(a)+pos.getZ(b)+pos.getZ(c))/3,key=`${Math.floor(x/cell)},${Math.floor(z/cell)}`;let list=buckets.get(key);if(!list)buckets.set(key,(list=[]));list.push(a,b,c);}
 return [...buckets.values()];
}
test('chunking with integer cell keys keeps the same pieces in the same order',()=>{
 let seed=3;const rand=()=>((seed=(seed*1103515245+12345)>>>0)/2**32);
 const n=3000,positions=new Float32Array(n*3);for(let i=0;i<n*3;i++)positions[i]=(rand()-.5)*(i%3===1?40:900);
 positions[0]=NaN;positions[5]=Infinity;
 const indices:number[]=[];for(let i=0;i<4000;i++)indices.push(Math.floor(rand()*n),Math.floor(rand()*n),Math.floor(rand()*n));
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setIndex(indices);
 const parent=new THREE.Group(),mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial());mesh.name='Leaves';parent.add(mesh);
 const want=chunkReference(mesh,64),got=chunkMesh(mesh,64);
 assert.equal(got.length,want.length);assert.ok(got.length>20);
 got.forEach((piece,i)=>{assert.deepEqual(Array.from(piece.geometry.index!.array),want[i]);assert.equal(piece.parent,parent);assert.equal(piece.name,'Leaves');});
 assert.equal(mesh.parent,null);
});

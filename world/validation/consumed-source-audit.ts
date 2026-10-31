/** Same-process paired actual-runtime matrix proxy. Not browser/GPU/FPS.
 * Only detaches consumed import metadata; never disposes geometry or changes gameplay. */
import {bootWorldWithoutGpu} from './world-dom-boot.fixture';
import {sourceNodeHandles} from './source-node-detach.fixture';
import {writeFileSync} from 'node:fs';
import * as THREE from 'three';
const h=await bootWorldWithoutGpu({deterministic:true});
try{
 const w=h.world;h.frame(1000);await h.settleAssets();const sources=sourceNodeHandles(w.scene);
 if(!sources.handles.length){
  if(!w.consumedSourceReceipt)throw new Error('No source nodes or production consumption receipt');
  const json=JSON.stringify({scope:'Production already detached; no fresh attached comparison is claimed. Use archived paired baseline for timing comparison.',receipt:w.consumedSourceReceipt,errors:h.errors},null,2);if(process.argv[2])writeFileSync(process.argv[2],json);console.log(json);
 }else{
 const buffers=new Set<ArrayBufferLike>(),geometries=new Set<THREE.BufferGeometry>();let objects=0,meshes=0;
 for(const {node}of sources.handles)node.traverse(o=>{objects++;if((o as THREE.Mesh).isMesh){meshes++;geometries.add((o as THREE.Mesh).geometry);}});
 for(const g of geometries){for(const a of Object.values(g.attributes)){const attr=a as THREE.BufferAttribute|THREE.InterleavedBufferAttribute;buffers.add(('array'in attr?attr.array:attr.data.array).buffer);}if(g.index)buffers.add(g.index.array.buffer);}
 const samples:{attached:number[];detached:number[]}={attached:[],detached:[]};
 for(let repeat=0;repeat<9;repeat++)for(const detached of repeat%2?[true,false]:[false,true]){
  if(detached)sources.detach();else sources.restore();
  for(let i=0;i<100;i++)w.scene.updateMatrixWorld();const start=performance.now();
  for(let i=0;i<600;i++)w.scene.updateMatrixWorld();samples[detached?'detached':'attached'].push((performance.now()-start)/600);
 }
 sources.restore();
 const median=(v:number[])=>[...v].sort((a,b)=>a-b)[Math.floor(v.length/2)];
 const report={scope:'Same-runtime paired matrix traversal proxy only, no rendering, GPU memory or FPS. Detached source buffers remain retained by test handles; candidate memory is not a measured memory reduction.',sourceRoots:sources.handles.length,objects,meshes,geometries:geometries.size,backingBytes:[...buffers].reduce((n,b)=>n+b.byteLength,0),medianMs:{attached:median(samples.attached),detached:median(samples.detached)},samples,errors:h.errors};
 const json=JSON.stringify(report,null,2);if(process.argv[2])writeFileSync(process.argv[2],json);console.log(json);
 }
}finally{await h.close();}

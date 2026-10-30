/** Manual actual-implementation matrix microbenchmark; no GPU/FPS evidence.
 * Run from world/: node --import tsx validation/static-subtree-cpu.ts
 * Compare original Three recursion with guarded frozen roots on the same scene/heap. */
import { bootWorldWithoutGpu } from './world-dom-boot.fixture';
import * as THREE from 'three';
import { performance } from 'node:perf_hooks';
const h=await bootWorldWithoutGpu({deterministic:true});
try{
 const {world:w}=h;h.frame(1000);await new Promise(r=>setTimeout(r,50));const roots:any[]=[];
 w.scene.traverse((o:any)=>{if(o.updateMatrixWorld.name==='updateFrozenMatrixWorld')roots.push(o);});
 const saved=roots.map(o=>o.updateMatrixWorld);let descendants=0;roots.forEach(o=>o.traverse(()=>descendants++));
 const samples:{normal:number[];skip:number[]}={normal:[],skip:[]};
 for(let repeat=0;repeat<9;repeat++)for(const skip of repeat%2?[true,false]:[false,true]){
  roots.forEach((o,i)=>o.updateMatrixWorld=skip?saved[i]:THREE.Object3D.prototype.updateMatrixWorld);
  for(let i=0;i<150;i++)w.scene.updateMatrixWorld();
  const start=performance.now();for(let i=0;i<350;i++)w.scene.updateMatrixWorld();
  samples[skip?'skip':'normal'].push((performance.now()-start)/350);
 }
 roots.forEach((o,i)=>o.updateMatrixWorld=saved[i]);
 const median=(a:number[])=>[...a].sort((x,y)=>x-y)[Math.floor(a.length/2)];
 console.log(JSON.stringify({kind:'CPU-only actual guarded immutable-root traversal versus original Three traversal, same frozen scene and heap; no GPU/FPS evidence',roots:roots.length,staticNodes:descendants,normal:median(samples.normal),skip:median(samples.skip),samples,errors:h.errors,warnings:h.warnings.map(a=>a.map(String))}));
}finally{await h.close();}

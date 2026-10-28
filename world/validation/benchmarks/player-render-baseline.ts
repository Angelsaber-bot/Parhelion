/** CPU-only deterministic rig inventory; NOT a GPU/frame-rate measurement. */
import * as THREE from 'three';
import { writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
const baseline = process.argv.includes('--baseline');
const {buildCharacter, CharacterAnimator} = baseline ? await import('./baseline-character.ts') : await import('../../src/character.ts');
const rig = buildCharacter(new THREE.MeshBasicMaterial({vertexColors:true}));
const animator = new CharacterAnimator(rig);
const states = [
 {speed:0,onGround:true,swimming:false,vy:0,moveYaw:0},
 {speed:9,onGround:true,swimming:false,vy:0,moveYaw:.6},
 {speed:4,onGround:false,swimming:false,vy:2,moveYaw:1,gliding:true},
 {speed:3,onGround:false,swimming:true,vy:0,moveYaw:2},
 {speed:0,onGround:true,swimming:false,vy:0,moveYaw:0,aim:1,pitch:.3},
];
const tick=(i:number)=>{animator.update(1/60,states[Math.floor(i/120)%states.length]);rig.root.updateMatrixWorld(true);};
for(let i=0;i<6000;i++)tick(i);
const samples=[];for(let batch=0;batch<9;batch++){const start=performance.now();for(let i=0;i<12000;i++)tick(i);samples.push((performance.now()-start)/12000);}
samples.sort((a,b)=>a-b);
const output={scope:'CPU animation + hierarchy update only; not FPS; no rendering',baseline,inputs:{dt:1/60,warmup:6000,iterationsPerBatch:12000,batches:9,states},meshes:rig.meshes.length,triangles:rig.meshes.reduce((n,m)=>n+(m.geometry.index?.count??m.geometry.attributes.position.count)/3,0),joints:Object.keys(rig.joints),bounds:new THREE.Box3().setFromObject(rig.root).getSize(new THREE.Vector3()).toArray(),medianCpuMilliseconds:samples[4],samples};
console.log(JSON.stringify(output,null,2));
if(process.env.REPORT_PATH)writeFileSync(process.env.REPORT_PATH,JSON.stringify(output,null,2));

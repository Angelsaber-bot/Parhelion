/** CPU/query-only paired component audit. No render/FPS/WCET claim. */
import assert from 'node:assert/strict';import * as THREE from 'three';import {MeshBVH}from'three-mesh-bvh';import {mkdir,writeFile}from'node:fs/promises';
import{bootWorldWithoutGpu}from'../world-dom-boot.fixture';import{CompanionNavigation}from'../fixtures/companion-navigation-pre-detour';import{CompanionNavigationCandidate}from'./companion-navigation-candidate';
const h=await bootWorldWithoutGpu({deterministic:true}),flat=new THREE.PlaneGeometry(100,100).rotateX(-Math.PI/2),flatCollider={name:'flat',enabled:true,bvh:new MeshBVH(flat)},saved=new Map<any,any>();let casts=0;
for(const c of [...h.world.colliders,flatCollider])if(!saved.has(c.bvh)){const original=c.bvh.raycastFirst;saved.set(c.bvh,original);c.bvh.raycastFirst=function(...args:any[]){casts++;return original.apply(this,args);};}
try{
 const rows:any[]=[];
 for(const scenario of[{name:'captured-winter',colliders:h.world.colliders,from:[62.66984599982088,4.068777896927346,-632.0656221598102],goal:[66.5277175071886,4.105068961160227,-630.7433508552547]},{name:'flat-control',colliders:[flatCollider],from:[0,0,0],goal:[0,0,8]}]){
  const timings:[number[],number[]]=[[],[]],recovery:number[]=[],rejected:number[]=[],counters=[{maxCasts:0,maxPaths:0,totalCasts:0,totalPaths:0},{maxCasts:0,maxPaths:0,totalCasts:0,totalPaths:0}],ends:any[]=[];
  for(let trial=0;trial<14;trial++)for(const variant of trial%2?[1,0]:[0,1]){
   const nav=variant?new CompanionNavigationCandidate(scenario.colliders):new CompanionNavigation(scenario.colliders),root=new THREE.Group(),goal=new THREE.Vector3().fromArray(scenario.goal);root.position.fromArray(scenario.from);let paths=0;const path=nav.path.bind(nav);nav.path=(a,b)=>{paths++;return path(a,b);};
   for(let i=0;i<1200;i++){
    casts=0;paths=0;const before=variant?(nav as CompanionNavigationCandidate).detourDiagnostics:null,stamp=process.hrtime.bigint();nav.step(root,goal,1/120,5.9949);const elapsed=Number(process.hrtime.bigint()-stamp)/1e6,after=variant?(nav as CompanionNavigationCandidate).detourDiagnostics:null;
    if(trial>=2){timings[variant].push(elapsed);const c=counters[variant];c.maxCasts=Math.max(c.maxCasts,casts);c.maxPaths=Math.max(c.maxPaths,paths);c.totalCasts+=casts;c.totalPaths+=paths;if(variant&&((before?.active??0)>0||(after?.active??0)>0))recovery.push(elapsed);if(variant&&(after!.rejectedDirections>before!.rejectedDirections))rejected.push(elapsed);}
   }
   if(trial===13)ends[variant]={position:root.position.toArray(),distance:root.position.distanceTo(goal),stuck:nav.stuckSeconds,detour:variant?(nav as CompanionNavigationCandidate).detourDiagnostics:null};
  }
  assert.ok(counters[1].maxPaths<=10);if(scenario.name==='captured-winter'){assert.ok(ends[0].distance>3);assert.ok(ends[1].distance<.26);}else assert.deepEqual(ends[0].position,ends[1].position);
  rows.push({scenario:scenario.name,baseline:summary(timings[0]),candidate:summary(timings[1]),candidateRecovery:summary(recovery),candidateRejectedStep:summary(rejected),counters,ends});
 }
 const report={evidence:'CPU/query component probe,12 measured trials after2 warmups, alternating paired order,120Hz over10simulated seconds/trial. Captured Winter positions are geometry setup, not a playable encounter. Timed interval nav.step only; counter wrappers add small common instrumentation overhead. Max is observed host sample, not WCET/FPS/device guarantee.',rows};await mkdir('../artifacts/enemy-performance',{recursive:true});await writeFile('../artifacts/enemy-performance/companion-detour-cpu.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{for(const[bvh,original]of saved)bvh.raycastFirst=original;flat.dispose();await h.close();}
function summary(values:number[]){if(!values.length)return{samples:0};values.sort((a,b)=>a-b);return{samples:values.length,medianMs:values[Math.floor(values.length*.5)],p95Ms:values[Math.floor(values.length*.95)],p99Ms:values[Math.floor(values.length*.99)],maxMs:values.at(-1)};}

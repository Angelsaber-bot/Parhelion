/** CPU-only component probe against production world BVHs; not full-frame/FPS.
 * Geometry setup/teleport/settling and diagnostic reads are outside timed steps.
 * Dense control adds64 synthetic non-touching annular colliders, deliberately
 * overlapping the support AABB without changing the actual walking surface.
 */
import assert from 'node:assert/strict';import * as THREE from 'three';import {MeshBVH} from 'three-mesh-bvh';import {mkdir,writeFile} from 'node:fs/promises';
import {bootWorldWithoutGpu} from '../world-dom-boot.fixture';import {Player,type Collider} from '../../src/player';import {PlayerEvade} from '../../src/playerMelee';
const instrument=process.argv.includes('--instrument'),suffix=instrument?'-instrumented':'';
const h=await bootWorldWithoutGpu({deterministic:true}),w=h.world,position={x:-54.303720415746646,y:3.9185068458863785,z:-105.20407474105565},yaw=Math.atan2(position.x-(-53.87395070094748),position.z-(-102.1539371039129)),direction={x:Math.cos(yaw),z:-Math.sin(yaw)},idle={x:0,z:0,jump:false,sprint:false},dt=1/120;
const owned:THREE.BufferGeometry[]=[],dense:Collider[]=[];
for(let i=0;i<64;i++){const geometry=new THREE.TorusGeometry(4.2+(i%4)*.05,.06,6,24).rotateX(Math.PI/2).rotateY(i*.07).translate(position.x,position.y-.02+(i%3)*.015,position.z);owned.push(geometry);dense.push({name:`synthetic-dense-ring-${i}`,enabled:true,bvh:new MeshBVH(geometry)});}
const flat=new THREE.BoxGeometry(30,.2,30).translate(position.x,20,position.z);owned.push(flat);
const cases=[{name:'production-slope',colliders:w.colliders as Collider[],y:position.y+.04},{name:'synthetic-flat',colliders:[...w.colliders,{name:'flat-control',enabled:true,bvh:new MeshBVH(flat)}],y:20.14},{name:'bounded-dense64-annuli',colliders:[...w.colliders,...dense],y:position.y+.04}],results:any[]=[];
try{
 for(const scenario of cases){const player=new Player(scenario.colliders,w.layout.world.waterLevel),support=(player as any).evadeSupport,ordinary:number[]=[],affected:number[]=[],recoveries:number[]=[],starts:number[][]=[],ends:number[][]=[],helperTimes:number[]=[],capsuleTimes:number[]=[];let helperElapsed=0,capsuleElapsed=0;const originalRecover=support.tryRecover;
  if(instrument)support.tryRecover=function(body:any,colliders:any,resolve:()=>void){const begin=process.hrtime.bigint();try{return originalRecover.call(this,body,colliders,()=>{const stamp=process.hrtime.bigint();try{resolve();}finally{capsuleElapsed+=Number(process.hrtime.bigint()-stamp)/1e6;}});}finally{helperElapsed+=Number(process.hrtime.bigint()-begin)/1e6;}};
  let maxPasses=0,maxRetries=0,maxBvh=0;
  for(let trial=0;trial<(instrument?186:66);trial++){
   player.teleport(position.x,scenario.y,position.z);for(let i=0;i<120;i++)player.step(dt,idle);assert.equal(player.onGround,true);const from=player.pos.clone(),clock=new PlayerEvade();clock.start(direction.x,direction.z);if(trial>=6)starts.push(from.toArray());
   for(let i=0;i<29;i++){helperElapsed=0;capsuleElapsed=0;const remaining=clock.remaining,before=support.diagnostics,input={...idle,evade:remaining>0?{...direction,strength:Math.min(remaining,dt)/dt}:undefined},start=process.hrtime.bigint();player.step(dt,input);const elapsed=Number(process.hrtime.bigint()-start)/1e6,after=support.diagnostics,passes=after.supportPasses-before.supportPasses,retries=after.capsuleRetries-before.capsuleRetries;
    if(!player.onGround)clock.update(0,false);clock.update(dt,true);maxPasses=Math.max(maxPasses,passes);maxRetries=Math.max(maxRetries,retries);maxBvh=Math.max(maxBvh,after.bvhRaycasts-before.bvhRaycasts);
    if(trial>=6){if(instrument&&passes){helperTimes.push(helperElapsed);capsuleTimes.push(capsuleElapsed);}(passes?affected:ordinary).push(elapsed);if(after.recovered>before.recovered)recoveries.push(elapsed);}
   }
   assert.ok(Math.abs(Math.hypot(player.pos.x-from.x,player.pos.z-from.z)-3.12)<1e-7);if(trial>=6)ends.push(player.pos.toArray());
  }
  assert.ok(maxPasses<=1&&maxRetries<=1);results.push({name:scenario.name,colliders:scenario.colliders.length,ordinary:summary(ordinary),affected:summary(affected),recovered:summary(recoveries),helperIncludingCapsule:summary(helperTimes),capsuleRetry:summary(capsuleTimes),maxSupportPassesPerStep:maxPasses,maxCapsuleRetriesPerStep:maxRetries,maxIndividualBvhRaycastsPerStep:maxBvh,start:starts[0],end:ends[0]});
 }
 assert.deepEqual(results[0].end,results[2].end,'dense stress props must not alter the actual surface/trajectory');
 const report={evidence:`CPU-only actual World Player.step over production BVHs,${instrument?180:60} measured trials after 6 warmups/case,120Hz component dt; no renderer/GPU/DOM/full-frame/FPS claim. Max is worst observed shared-host sample, not WCET or a device guarantee. Dense case has64extra synthetic annuli whose bounds overlap but geometry never touches the path. Timing instrumentation: ${instrument}.`,results};await mkdir('../artifacts/enemy-performance',{recursive:true});await writeFile(`../artifacts/enemy-performance/evade-support-cpu${suffix}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{owned.forEach(geometry=>geometry.dispose());await h.close();}
function summary(values:number[]){if(!values.length)return{samples:0};values.sort((a,b)=>a-b);return{samples:values.length,medianMs:values[Math.floor(values.length*.5)],p95Ms:values[Math.floor(values.length*.95)],p99Ms:values[Math.floor(values.length*.99)],maxMs:values.at(-1)};}

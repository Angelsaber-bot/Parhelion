/** Manual NON-GPU CPU probe, never a CI timing threshold or FPS measurement.
 * node --expose-gc --import tsx validation/world-cpu-comparison.ts [world-root] [label]
 * Use clean git archive + same node_modules for baseline. Run fresh processes in
 * alternating order; aggregate process medians, not one optimistic frame.
 */
import { bootWorldWithoutGpu } from './world-dom-boot.fixture';
import { sourceNodeHandles } from './source-node-detach.fixture';
import { performance } from 'node:perf_hooks';
import { resolve } from 'node:path';
const harness=await bootWorldWithoutGpu({worldRoot:resolve(process.argv[2]??'.'),deterministic:true});
const percentile=(a:number[],q:number)=>[...a].sort((x,y)=>x-y)[Math.min(a.length-1,Math.floor(a.length*q))];
const {world,window}=harness;
if(process.env.CPU_DETACH_SOURCE==='1')sourceNodeHandles(world.scene).detach(); // Isolated consumed-source experiment only.
if(process.env.CPU_SKIP_HIDDEN_ENEMIES==='1')for(const v of world.combat.visuals.values()){const original=v.root.updateMatrixWorld;v.root.updateMatrixWorld=function(force:boolean){if(this.visible)original.call(this,force);};}
if(process.env.CPU_SKIP_RENDER==='1')world.renderer.render=()=>{}; // Diagnostic only: excluded from primary comparison.
let recording=false;const costs:Record<string,{ms:number;calls:number}>={};
if(process.env.CPU_PROFILE==='1')for(const [owner,names]of [[world.player,['step']],[world.combat,['update','simulate','present']],[world.renderer,['render']],[world.anim,['update']],[world.servant,['update']],[world.actions,['update','present','flush']]] as [any,string[]][]){
 if(!owner)continue;
 for(const name of names){if(typeof owner[name]!=='function')continue;const original=owner[name];const key=(owner===world.player?'player':owner===world.combat?'combat':owner===world.renderer?'renderer':owner===world.anim?'anim':owner===world.servant?'servant':'actions')+'.'+name;
 owner[name]=function(...args:any[]){if(!recording)return original.apply(this,args);const t=performance.now();try{return original.apply(this,args);}finally{const c=costs[key]??={ms:0,calls:0};c.ms+=performance.now()-t;c.calls++;}};
 }
}
if(process.env.CPU_TREE_PROFILE==='1')for(const [index,child]of world.scene.children.entries()){
 const original=child.updateMatrixWorld,key=`tree.${index}.${child.name||child.type}`;
 child.updateMatrixWorld=function(...args:any[]){if(!recording)return original.apply(this,args);const t=performance.now();try{return original.apply(this,args);}finally{const c=costs[key]??={ms:0,calls:0};c.ms+=performance.now()-t;c.calls++;}};
}
try{
 (window.document.getElementById('start') as HTMLElement).click();await Promise.resolve();
 let now=window.performance.now();harness.frame(now);
 const results=[];
 const hq=world.layout.markers.find((m:any)=>m.id==='hq_terminal');
 for(const [name,x,z]of [['valley_hq',hq.p[0],hq.p[2]],['winter_pack',-120,-680],['kyoto_node',100,560]] as [string,number,number][]){
  world.player.teleport(x,world.ground(x,z)+.02,z);
  const samples:number[]=[];for(const key of Object.keys(costs))delete costs[key];
  // Keep the same passive player alive so neither version falls into a cheaper
  // defeated/menu path. No enemy/animation/state work is stubbed or timed out.
  for(let i=0;i<780;i++){
   world.combat.state.hp=100;
   recording=i>=180;const start=performance.now();harness.frame(now+=1000/60);const elapsed=performance.now()-start;
   if(i>=180)samples.push(elapsed);
   if(i%60===59)await new Promise(r=>setTimeout(r,10)); // Allow real lazy asset promises to settle outside timed frames.
  }
  const blocks=Array.from({length:10},(_,i)=>samples.slice(i*60,(i+1)*60).reduce((a,b)=>a+b,0)/60);
  results.push({name,position:world.player.pos.toArray(),medianMs:percentile(samples,.5),p95Ms:percentile(samples,.95),meanMs:samples.reduce((a,b)=>a+b,0)/samples.length,blockMedianMs:percentile(blocks,.5),blockP95Ms:percentile(blocks,.95),profile:JSON.parse(JSON.stringify(costs)),activeEnemies:world.combat.state.enemies.filter((e:any)=>e.active).length});
 }
 await new Promise(r=>setTimeout(r,250));
 globalThis.gc?.();
 const geometries=new Set<any>(),materials=new Set<any>(),buffers=new Set<ArrayBuffer>();let objects=0,meshes=0,lights=0,triangles=0;
 world.scene.traverse((o:any)=>{objects++;if(o.isLight)lights++;if(!o.isMesh)return;meshes++;geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);});
 for(const g of geometries){triangles+=(g.index?.count??g.attributes.position?.count??0)/3;for(const a of Object.values(g.attributes) as any[])if(a.array?.buffer)buffers.add(a.array.buffer);if(g.index?.array?.buffer)buffers.add(g.index.array.buffer);}
 console.log(JSON.stringify({label:process.argv[3]??'working',rendererTraversal:process.env.CPU_SKIP_RENDER!=='1',sourceNodesDetached:process.env.CPU_DETACH_SOURCE==='1',hiddenEnemiesSkipped:process.env.CPU_SKIP_HIDDEN_ENEMIES==='1',node:process.version,warmupFrames:180,sampledFrames:600,frameDt:1/60,results,memory:process.memoryUsage(),resources:{objects,meshes,lights,geometries:geometries.size,materials:materials.size,uniqueGeometryBackingBytes:[...buffers].reduce((n,b)=>n+b.byteLength,0),uniqueGeometryTriangles:triangles},errors:harness.errors,warnings:harness.warnings.map(args=>args.map(String))}));
}finally{await harness.close();}

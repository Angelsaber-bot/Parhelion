/** NON-GPU local matrix microbenchmark; isolated candidates, not a frame/FPS gain. */
import { bootWorldWithoutGpu } from './world-dom-boot.fixture';
import { sourceNodeHandles } from './source-node-detach.fixture';
import { performance } from 'node:perf_hooks';
import { resolve } from 'node:path';
const h=await bootWorldWithoutGpu({worldRoot:resolve(process.argv[2]??'.'),deterministic:true});
const median=(values:number[])=>values.sort((a,b)=>a-b)[Math.floor(values.length/2)];
try{
 const w=h.world;
 const candidates=[
  {name:'consumed_source_nodes',roots:sourceNodeHandles(w.scene).handles.map(h=>h.node),world:true},
  {name:'four_static_stations',roots:w.scene.children.filter((o:any)=>o.name.startsWith('EraStory_')),world:true},
  {name:'traversal_apron',roots:w.scene.children.filter((o:any)=>o.name==='AuthoredTraversalAprons'),world:true},
  {name:'enemy_role_labels_local_only',roots:[...w.combat.visuals.values()].map((v:any)=>v.roleLabel).filter(Boolean),world:false},
  {name:'inactive_skill_pool',roots:[w.scene.getObjectByName('contract-skill-effects')].filter(Boolean),world:true},
 ];
 const results=[];
 for(const candidate of candidates){
  const nodes:any[]=[];for(const root of candidate.roots){root.updateWorldMatrix(true,true);root.traverse((o:any)=>nodes.push({o,local:o.matrixAutoUpdate,world:o.matrixWorldAutoUpdate}));}
  const samples:{normal:number[];frozen:number[]}={normal:[],frozen:[]};
  const configure=(freeze:boolean)=>{for(const {o,local,world}of nodes){o.matrixAutoUpdate=freeze?false:local;o.matrixWorldAutoUpdate=freeze&&candidate.world?false:world;}};
  for(let repeat=0;repeat<10;repeat++)for(const freeze of repeat%2?[true,false]:[false,true]){
   configure(freeze);
   for(let i=0;i<300;i++)for(const root of candidate.roots)root.updateMatrixWorld(true);
   const start=performance.now();for(let i=0;i<3000;i++)for(const root of candidate.roots)root.updateMatrixWorld(true);
   samples[freeze?'frozen':'normal'].push((performance.now()-start)/3000);
  }
  configure(false);
  results.push({name:candidate.name,roots:candidate.roots.length,nodes:nodes.length,normalMedianMs:median(samples.normal),frozenMedianMs:median(samples.frozen),samples});
 }
 console.log(JSON.stringify({node:process.version,kind:'isolated forced subtree matrix update, NOT total frame or FPS',results,errors:h.errors,warnings:h.warnings.map(a=>a.map(String))}));
}finally{await h.close();}

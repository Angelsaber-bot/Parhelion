import { EXPANSION_PLANS } from '../src/map/worldPlan';
import { buildExpansion } from './gen/expansion/build';
import { writeRegion } from './gen/export';

const selected=process.argv.find(arg=>arg.startsWith('--region='))?.slice(9);
if(selected&&!EXPANSION_PLANS.some(p=>p.id===selected))throw new Error(`Unknown expansion: ${selected}`);
for(const plan of EXPANSION_PLANS.filter(p=>!selected||p.id===selected)) {
  const result=buildExpansion(plan);
  const {bytes,tris}=await writeRegion({file:`world_${plan.id}`,...result,layout:{...result.layout,development:{stage:plan.id==='orleans'?'environment-pass-2':'environment-pass-1',identity:plan.identity,servant:plan.servant,outline:plan.outline,routes:plan.routes,access:result.access,...(plan.id==='orleans'?{houses:result.pieces.find(p=>p.name==='orleans_RiverTown')?.userData?.houses,streetLanes:result.pieces.find(p=>p.name==='orleans_OrchardsAndLanes')?.userData?.streetLanes}:{}),...(plan.id==='qin'?{houses:result.pieces.find(p=>p.name==='qin_ArtisanTown')?.userData?.houses}:{}),...(plan.id==='egypt'?{houses:result.pieces.find(p=>p.name==='egypt_OasisTown')?.userData?.houses}:{})}}});
  console.log(`${plan.name}: ${(bytes/1048576).toFixed(2)} MB, ${Math.round(tris/1000)}k triangles`);
}

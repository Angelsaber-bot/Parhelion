import { EXPANSION_PLANS } from '../src/map/worldPlan';
import { buildExpansion } from './gen/expansion/build';
import { writeRegion } from './gen/export';

for(const plan of EXPANSION_PLANS) {
  const result=buildExpansion(plan);
  const {bytes,tris}=await writeRegion({file:`world_${plan.id}`,...result,layout:{...result.layout,development:{stage:'blockout',identity:plan.identity,servant:plan.servant,outline:plan.outline,routes:plan.routes,access:result.access}}});
  console.log(`${plan.name}: ${(bytes/1048576).toFixed(2)} MB, ${Math.round(tris/1000)}k triangles`);
}

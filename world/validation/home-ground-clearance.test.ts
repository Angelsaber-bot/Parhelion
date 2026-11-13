import test from 'node:test';
import assert from 'node:assert/strict';
import { HOME_BUILDINGS, HOME_ROUTES, HOME_GRASS_PATHS } from '../src/map/homePlan';
import { settlementGrassClearance } from '../src/map/grassClearance';
test('town streets and all twenty front ramps exclude grass across their actual paved width',()=>{
 const grid={nx:721,nz:721,x0:360,z0:-360,cell:1};
 const mask=settlementGrassClearance(grid,[],HOME_GRASS_PATHS);
 assert.equal(HOME_GRASS_PATHS.length,HOME_BUILDINGS.length+HOME_ROUTES.length);
 for(const route of HOME_GRASS_PATHS)for(let i=1;i<route.points.length;i++){
  const a=route.points[i-1],b=route.points[i],dx=b[0]-a[0],dz=b[2]-a[2],length=Math.hypot(dx,dz);
  if(length<.1)continue;
  for(const t of [.1,.5,.9])for(const side of [-1,0,1]){
   const x=a[0]+dx*t-dz/length*side*route.width*.49,z=a[2]+dz*t+dx/length*side*route.width*.49;
   assert.equal(mask[Math.round((z-grid.z0)/grid.cell)*grid.nx+Math.round((x-grid.x0)/grid.cell)],1,`grass on paved surface ${x},${z}`);
  }
 }
});

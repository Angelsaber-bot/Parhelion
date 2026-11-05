import type {WorldGrid} from './grid';
import type {SettlementPlacement} from './settlements/types';
import type {SettlementApproach} from './settlementApproaches';

/** Rasterize authored occupied ground once, rather than mistaking a low floor
 * for bare terrain. One cell of padding prevents linearly filtered grass leaks. */
export function settlementGrassClearance(
 grid:Pick<WorldGrid,'nx'|'nz'|'x0'|'z0'|'cell'>,
 placements:readonly SettlementPlacement[], routes:readonly SettlementApproach[],
 rectangles:readonly (readonly [number,number,number,number])[]=[],
){
 const mask=new Uint8Array(grid.nx*grid.nz),pad=grid.cell;
 const fill=(x0:number,z0:number,x1:number,z1:number,inside:(x:number,z:number)=>boolean)=>{
  const ix0=Math.max(0,Math.floor((x0-grid.x0)/grid.cell)),ix1=Math.min(grid.nx-1,Math.ceil((x1-grid.x0)/grid.cell));
  const iz0=Math.max(0,Math.floor((z0-grid.z0)/grid.cell)),iz1=Math.min(grid.nz-1,Math.ceil((z1-grid.z0)/grid.cell));
  for(let iz=iz0;iz<=iz1;iz++)for(let ix=ix0;ix<=ix1;ix++)if(inside(grid.x0+ix*grid.cell,grid.z0+iz*grid.cell))mask[iz*grid.nx+ix]=1;
 };
 for(const [x0,z0,x1,z1] of rectangles)fill(x0-pad,z0-pad,x1+pad,z1+pad,()=>true);
 for(const p of placements){
  const [x,,z]=p.position,[w,d]=p.footprint;
  fill(x-w/2-pad,z-d/2-pad,x+w/2+pad,z+d/2+pad,()=>true);
  fill(p.entry[0]-1.7-pad,p.entry[2]-pad,p.entry[0]+1.7+pad,p.entry[2]+9+pad,()=>true);
 }
 for(const route of routes)for(let i=1;i<route.points.length;i++){
  const a=route.points[i-1],b=route.points[i],dx=b[0]-a[0],dz=b[2]-a[2],r=1.2+pad;
  fill(Math.min(a[0],b[0])-r,Math.min(a[2],b[2])-r,Math.max(a[0],b[0])+r,Math.max(a[2],b[2])+r,(x,z)=>{
   const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[2])*dz)/(dx*dx+dz*dz||1)));
   return Math.hypot(x-a[0]-t*dx,z-a[2]-t*dz)<=r;
  });
 }
 return mask;
}

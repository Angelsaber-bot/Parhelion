/** Grounded visual approaches connect the authored roads to living hubs.
 * They do not create floors or change collision: every route is sampled against
 * the existing terrain and prop BVH before a single decorative stone is placed.
 */
import * as THREE from 'three';
import { settlementHeight, type PlacementContext } from './settlements/core';
import { mergeParts } from './settlements/merge';
import type { SettlementPlacement, RegionId } from './settlements/types';
import { REGIONS } from './regions';
type V2=[number,number];type V3=[number,number,number];
export const APPROACH_LIMITS=Object.freeze({cell:2,maxRadius:76,clearance:.65,maxRise:.72,visible:205,triangles:2400});
export interface SettlementApproach { region:RegionId; points:V3[]; length:number; reason?:string; }
const COLORS:Record<RegionId,[string,string]>={alpha:['#b1bec0','#70918e'],britain:['#aea184','#807461'],blacksail:['#a9a28c','#6b8884'],winter:['#a7b5bd','#768a96'],kyoto:['#a8a79a','#7b8980']};
function nearSegment(p:V2,a:V2,b:V2):V2{const dx=b[0]-a[0],dz=b[1]-a[1],t=THREE.MathUtils.clamp(((p[0]-a[0])*dx+(p[1]-a[1])*dz)/(dx*dx+dz*dz||1),0,1);return[a[0]+dx*t,a[1]+dz*t];}
/** Independent planning API: useful for geometry audits without creating rendering resources. */
export function planSettlementApproach(p:SettlementPlacement,ctx:PlacementContext):SettlementApproach {
 const [ox,oz]=REGIONS.find(r=>r.id===p.id)!.offset;
 const start:V2=[p.entry[0],p.entry[2]+9],segments:[V2,V2][]=[];
 for(const path of ctx.layout.paths)for(let i=1;i<path.length;i++)if(Math.abs(path[i][0]-ox)<340&&Math.abs(path[i][1]-oz)<340)segments.push([path[i-1],path[i]]);
 if(!segments.length)return{region:p.id,points:[],length:0,reason:'No authored road in this region'};
 let goal:V2=start,distance=Infinity;
 for(const [a,b]of segments){const n=nearSegment(start,a,b),d=Math.hypot(n[0]-start[0],n[1]-start[1]);if(d<distance){goal=n;distance=d;}}
 if(distance<3)return{region:p.id,points:[],length:0,reason:'Ramp already joins the authored road'};
 const cell=APPROACH_LIMITS.cell,n=Math.floor(APPROACH_LIMITS.maxRadius/cell),width=n*2+1,total=width*width;
 const heights=new Float64Array(total).fill(NaN),status=new Int8Array(total),cost=new Float64Array(total).fill(Infinity),prev=new Int32Array(total).fill(-1),closed=new Uint8Array(total);
 const box=new THREE.Box3(),matrix=new THREE.Matrix4();
 const coords=(id:number):V2=>[start[0]+(id%width-n)*cell,start[1]+(Math.floor(id/width)-n)*cell];
 function accessible(id:number){
  if(status[id])return status[id]>0;const [x,z]=coords(id),h=settlementHeight(ctx.grid,x,z);heights[id]=h;
  if(!Number.isFinite(h)||h<2.2||Math.abs(x-ox)>308||Math.abs(z-oz)>308){status[id]=-1;return false;}
  if(Math.abs(x-p.position[0])<p.footprint[0]/2+1&&Math.abs(z-p.position[2])<p.footprint[1]/2+1){status[id]=-1;return false;}
  box.set(new THREE.Vector3(x-.65,h+.15,z-.65),new THREE.Vector3(x+.65,h+2,z+.65));
  if(ctx.blockers.intersectsBox(box,matrix)){status[id]=-1;return false;}status[id]=1;return true;
 }
 const begin=n*width+n;if(!accessible(begin))return{region:p.id,points:[],length:0,reason:'Ramp landing lacks a clear grounded approach'};
 // Tiny binary heap keeps path planning bounded, independent of frame work.
 const heap:{id:number;rank:number}[]=[];
 function push(id:number,rank:number){let at=heap.length;heap.push({id,rank});while(at){const parent=(at-1)>>1;if(heap[parent].rank<=rank)break;heap[at]=heap[parent];at=parent;}heap[at]={id,rank};}
 function pop(){const result=heap[0],last=heap.pop()!;if(heap.length){let at=0;while(at*2+1<heap.length){let child=at*2+1;if(child+1<heap.length&&heap[child+1].rank<heap[child].rank)child++;if(heap[child].rank>=last.rank)break;heap[at]=heap[child];at=child;}heap[at]=last;}return result.id;}
 cost[begin]=0;push(begin,distance);let end=-1,expanded=0;
 while(heap.length&&expanded<total){const id=pop();if(closed[id])continue;closed[id]=1;expanded++;const [x,z]=coords(id);
  if(segments.some(([a,b])=>{const q=nearSegment([x,z],a,b);return Math.hypot(x-q[0],z-q[1])<2.6;})){end=id;break;}
  const ix=id%width,iz=Math.floor(id/width);
  for(const[dx,dz]of[[1,0],[-1,0],[0,1],[0,-1]]){const nx=ix+dx,nz=iz+dz;if(nx<0||nz<0||nx>=width||nz>=width)continue;const next=nz*width+nx;if(closed[next]||!accessible(next)||Math.abs(heights[next]-heights[id])>APPROACH_LIMITS.maxRise)continue;
   const [xx,zz]=coords(next),midX=(x+xx)/2,midZ=(z+zz)/2,midH=settlementHeight(ctx.grid,midX,midZ);
   if(!Number.isFinite(midH)||Math.abs(midH-(heights[id]+heights[next])/2)>.3)continue;
   box.set(new THREE.Vector3(Math.min(x,xx)-.5,Math.min(heights[id],heights[next])+.18,Math.min(z,zz)-.5),new THREE.Vector3(Math.max(x,xx)+.5,Math.max(heights[id],heights[next])+1.9,Math.max(z,zz)+.5));if(ctx.blockers.intersectsBox(box,matrix))continue;
   const value=cost[id]+cell+Math.abs(heights[next]-heights[id])*.7;if(value>=cost[next])continue;cost[next]=value;prev[next]=id;push(next,value+Math.hypot(xx-goal[0],zz-goal[1]));
  }
 }
 if(end<0)return{region:p.id,points:[],length:0,reason:'No safe slope/collision route within approach radius'};
 const points:V3[]=[];for(let id=end;id>=0;id=prev[id]){const[x,z]=coords(id);points.push([x,heights[id],z]);}points.reverse();
 return{region:p.id,points,length:points.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p[0]-points[i][0],p[2]-points[i][2]),0)};
}
export function createSettlementApproaches(placements:readonly SettlementPlacement[],ctx:PlacementContext){
 const root=new THREE.Group();root.name='Settlement_Road_Approaches';const routes=placements.map(p=>planSettlementApproach(p,ctx));const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.97});let disposed=false;
 for(const route of routes){if(route.points.length<2)continue;const parts:THREE.BufferGeometry[]=[],palette=COLORS[route.region];
  const add=(g:THREE.BufferGeometry,color:string)=>{const c=new THREE.Color(color),values=new Float32Array(g.attributes.position.count*3);for(let i=0;i<values.length;i+=3){values[i]=c.r;values[i+1]=c.g;values[i+2]=c.b;}g.setAttribute('color',new THREE.BufferAttribute(values,3));parts.push(g);};
  // Thin irregular stepping stones sit on the sampled terrain; no deceptive bridge surfaces.
  for(let i=1;i<route.points.length;i++){
   const a=route.points[i-1],b=route.points[i],dx=b[0]-a[0],dz=b[2]-a[2],angle=Math.atan2(dx,dz);
   for(const fraction of[.25,.75]){const x=THREE.MathUtils.lerp(a[0],b[0],fraction),z=THREE.MathUtils.lerp(a[2],b[2],fraction);
    const g=new THREE.CylinderGeometry(.72,.75,.035,5,1).rotateY(angle+(i%3)*.14).scale(1,1,.56).translate(x,0,z);const positions=g.attributes.position;for(let vertex=0;vertex<positions.count;vertex++)positions.setY(vertex,settlementHeight(ctx.grid,positions.getX(vertex),positions.getZ(vertex))+.018+positions.getY(vertex));g.computeVertexNormals();add(g,palette[i%4===0?1:0]);
   }
  }
  // A pair of low shoulder stones marks the junction; all pieces are visual-only and ankle high.
  const last=route.points.at(-1)!,before=route.points.at(-2)!,dx=last[0]-before[0],dz=last[2]-before[2],len=Math.hypot(dx,dz);
  for(const side of[-1,1]){const x=last[0]+side*dz/len*1.1,z=last[2]-side*dx/len*1.1,y=settlementHeight(ctx.grid,x,z);add(new THREE.CylinderGeometry(.18,.23,.28,6).translate(x,y+.14,z),palette[1]);}
  const geometry=mergeParts(parts);parts.forEach(g=>g.dispose());const mesh=new THREE.Mesh(geometry,material);mesh.name=`Approach_${route.region}`;mesh.receiveShadow=true;mesh.castShadow=false;mesh.userData.region=route.region;mesh.userData.routeCenter=route.points[Math.floor(route.points.length/2)];root.add(mesh);
 }
 return{root,routes,update(player:Pick<THREE.Vector3,'x'|'z'>){if(disposed)return;for(const child of root.children){const p=child.userData.routeCenter as V3,dx=player.x-p[0],dz=player.z-p[2];child.visible=dx*dx+dz*dz<APPROACH_LIMITS.visible**2;}},dispose(){if(disposed)return;disposed=true;root.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});material.dispose();root.removeFromParent();root.clear();}};
}

import * as THREE from 'three';
/** Flagship-local deck hatches. u points sternward; v points starboard. */
export const SHIP_INTERIOR={center:[296,104] as const,yaw:.15,deck:7,floor:3.4,hatches:[[-8,4,2.35,5.15],[-8,4,-5.15,-2.35]] as const};
export function flagshipPoint(u:number,v:number,y:number,world=true):[number,number,number]{const{center,yaw}=SHIP_INTERIOR;return[center[0]+Math.sin(yaw)*u+Math.cos(yaw)*v+(world?720:0),y,center[1]+Math.cos(yaw)*u-Math.sin(yaw)*v];}
type Vertex={values:Record<string,number[]>;u:number;v:number};
/** Subtract a convex rectangle using disjoint outside strips. No triangle-wide
 * deletion: original deck remains continuous right up to each hatch coaming. */
function subtract(poly:Vertex[],rect:readonly number[]):Vertex[][]{
 let inside=poly;const outside:Vertex[][]=[];
 for(const [axis,edge,sign]of[['u',rect[0],1],['u',rect[1],-1],['v',rect[2],1],['v',rect[3],-1]]as const){
  const split=(keepInside:boolean)=>{const result:Vertex[]=[];for(let i=0;i<inside.length;i++){const a=inside[i],b=inside[(i+1)%inside.length],da=(a[axis]-edge)*sign,db=(b[axis]-edge)*sign,ka=keepInside?da>=0:da<=0,kb=keepInside?db>=0:db<=0;if(ka)result.push(a);if(ka!==kb){const t=da/(da-db),values:Record<string,number[]>={};for(const key of Object.keys(a.values))values[key]=a.values[key].map((x,c)=>x+(b.values[key][c]-x)*t);result.push({u:a.u+(b.u-a.u)*t,v:a.v+(b.v-a.v)*t,values});}}return result;};
  const out=split(false),next=split(true);if(out.length>=3)outside.push(out);inside=next;if(inside.length<3)break;
 }return outside;
}
export function carveFlagshipDeck(geometry:THREE.BufferGeometry):THREE.BufferGeometry|null{
 const position=geometry.getAttribute('position');if(!position)return null;
 const names=Object.keys(geometry.attributes),sizes=Object.fromEntries(names.map(n=>[n,geometry.getAttribute(n).itemSize]));
 const arrays:Record<string,number[]>=Object.fromEntries(names.map(n=>[n,[]]));let changed=false;
 const index=geometry.index,count=index?.count??position.count;
 const read=(i:number):Vertex=>{const values:Record<string,number[]>={};for(const n of names){const a=geometry.getAttribute(n);values[n]=Array.from({length:a.itemSize},(_,c)=>a.getComponent(i,c));}const dx=values.position[0]-296,dz=values.position[2]-104;return{values,u:dx*Math.sin(.15)+dz*Math.cos(.15),v:dx*Math.cos(.15)-dz*Math.sin(.15)};};
 const emit=(p:Vertex[])=>{for(let i=1;i<p.length-1;i++)for(const vertex of[p[0],p[i],p[i+1]])for(const n of names)arrays[n].push(...vertex.values[n]);};
 for(let i=0;i<count;i+=3){const tri=[0,1,2].map(j=>read(index?index.getX(i+j):i+j));const ys=tri.map(v=>v.values.position[1]);
  if(Math.min(...ys)>=6.35&&Math.max(...ys)<=7.16&&Math.max(...tri.map(v=>v.u))>=-8&&Math.min(...tri.map(v=>v.u))<=4&&Math.max(...tri.map(v=>v.v))>=-5.15&&Math.min(...tri.map(v=>v.v))<=5.15){
   let polys=[tri];for(const hatch of SHIP_INTERIOR.hatches)polys=polys.flatMap(p=>subtract(p,hatch));for(const p of polys)emit(p);changed=true;
  }else emit(tri);
 }
 if(!changed)return null;
 const out=new THREE.BufferGeometry();for(const n of names)out.setAttribute(n,new THREE.Float32BufferAttribute(arrays[n],sizes[n]));out.computeBoundingBox();out.computeBoundingSphere();return out;
}

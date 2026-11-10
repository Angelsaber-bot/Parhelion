// Shared world-space surface at production joins. Tiles are export units, never islands.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { smoothstep, lerp, fbm } from './rng.js';

export const CONTINENT_OFFSETS: Record<string, readonly [number,number]> = {
  alpha:[0,0],britain:[-720,0],blacksail:[720,0],winter:[0,-720],kyoto:[0,720],
  orleans:[-720,-720],egypt:[720,720],qin:[720,-720],
};
export function continentBase(x:number,z:number):number {
  let h=16+3*Math.sin(x*.006)*Math.cos(z*.007)+1.5*Math.sin((x+z)*.011);
  h+=smoothstep(320,500,-x)*smoothstep(300,500,z)*7*Math.sin(x*.009+z*.004)**2;
  // The four existing story approaches stay at their authored, low crossing levels.
  for(const [cx,cz,y,axis] of [[360,30,16,0],[-360,-30,6,0],[0,-360,1.1,1],[40,360,10,1]]) {
    const across=axis===0?Math.abs(z-cz):Math.abs(x-cx),along=axis===0?Math.abs(x-cx):Math.abs(z-cz);
    h=lerp(h,y,(1-smoothstep(10,34,across))*(1-smoothstep(45,105,along)));
  }
  return h;
}
export function continentalHeight(id:string,x:number,z:number,authored:number):number {
  const [ox,oz]=CONTINENT_OFFSETS[id],wx=x+ox,wz=z+oz;
  // The fleet's existing eastern bay remains sea; its north/south shores join the mainland.
  const edge=id==='blacksail'?Math.max(-x,Math.abs(z)):Math.max(Math.abs(x),Math.abs(z));
  const join=smoothstep(id==='blacksail'?240:300,360,edge);
  let h=lerp(authored,continentBase(wx,wz),join);
  // One irregular outer coast; no coastline or water gutter on interior joins.
  const radial=(Math.abs(wx)**6+Math.abs(wz)**6)**(1/6);
  let coast=1020+12*Math.sin(wx*.009+wz*.004)+9*Math.cos(wz*.012);
  // Camlann's western march and throne reward stand on an existing dry headland.
  // Carry that landform into the outer shoreline rather than flooding its actors.
  coast+=48*Math.exp(-(((wx+995)/100)**2+((wz-115)/105)**2));
  // Kyoto's southern shrine keeps its low dry shore; the lobe ends before the
  // eastern production join, preserving a shared coast with the desert region.
  coast+=72*(1-smoothstep(30,180,Math.abs(wx-146)))*(1-smoothstep(20,100,Math.abs(wz-1020)));
  const outerCoast=id==='blacksail'?smoothstep(280,350,Math.abs(z)):1;
  h=lerp(h,-8,smoothstep(coast-55,coast+25,radial)*outerCoast);
  return h;
}
const soils=[
  [-720,-720,'#718d60'],[0,-720,'#e3ebf6'],[720,-720,'#7d926e'],
  [-720,0,'#a8c46a'],[0,0,'#8fb269'],[720,0,'#b8c978'],
  [-720,720,'#6d8a52'],[0,720,'#7f9a5e'],[720,720,'#c6a168'],
] as const;
const palette=soils.map(([x,z,hex])=>({x,z,c:new THREE.Color(hex)}));
export function continentColor(x:number,z:number,target=new THREE.Color()):THREE.Color {
  const wx=x+40*Math.sin(z*.008),wz=z+45*Math.sin(x*.007);
  let total=0;target.setRGB(0,0,0);
  for(const soil of palette){const w=Math.exp(-((wx-soil.x)**2+(wz-soil.z)**2)/(2*260**2));total+=w;target.r+=soil.c.r*w;target.g+=soil.c.g*w;target.b+=soil.c.b*w;}
  target.multiplyScalar(1/total);
  const grain=fbm(x*.025,z*.025,3,8221),patch=fbm(x*.009,z*.009,3,731);
  target.multiplyScalar(1+grain*.20+patch*.12);
  return target;
}
/** Blend surface colours across broad ecotones, including both copies of a shared edge. */
export function blendContinentalColors(g:THREE.BufferGeometry,id:string) {
  const [ox,oz]=CONTINENT_OFFSETS[id],p=g.attributes.position,c=g.attributes.color,tmp=new THREE.Color(),old=new THREE.Color();
  for(let i=0;i<p.count;i++) {
    const x=p.getX(i),z=p.getZ(i);
    const bend=35*Math.sin((x+ox)*.012+(z+oz)*.008);
    const w=smoothstep(185+bend,360,Math.hypot(x,z));
    if(w===0)continue;
    continentColor(x+ox,z+oz,tmp);old.fromBufferAttribute(c,i).lerp(tmp,w);c.setXYZ(i,old.r,old.g,old.b);
  }
}
/** Southwest is a broad wooded continuation of Britain and Kyoto, not an empty ninth slot. */
export function appendSouthwest(terrain:{vis:THREE.BufferGeometry;col:THREE.BufferGeometry}) {
  const p:number[]=[],c:number[]=[],idx:number[]=[],n=361,color=new THREE.Color();
  for(let j=0;j<n;j++)for(let i=0;i<n;i++) {
    const x=-360+i*2,z=360+j*2,wx=x-720;
    p.push(x,continentalHeight('britain',x,z,continentBase(wx,z)),z);
    continentColor(wx,z,color);c.push(color.r,color.g,color.b);
  }
  for(let j=0;j<n-1;j++)for(let i=0;i<n-1;i++){const a=j*n+i,b=a+1,d=a+n;idx.push(a,d,b,b,d,d+1);}
  const vis=new THREE.BufferGeometry();vis.setAttribute('position',new THREE.Float32BufferAttribute(p,3));vis.setAttribute('color',new THREE.Float32BufferAttribute(c,3));vis.setIndex(idx);vis.computeVertexNormals();
  const col=new THREE.BufferGeometry();col.setAttribute('position',vis.attributes.position.clone());col.setIndex(idx);
  terrain.vis=mergeGeometries([terrain.vis,vis]);terrain.col=mergeGeometries([terrain.col,col]);
}

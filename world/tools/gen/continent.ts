// Shared world-space surface at production joins. Tiles are export units, never islands.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { smoothstep, lerp, fbm } from './rng.js';
import { readFileSync, existsSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

export const CONTINENT_OFFSETS: Record<string, readonly [number,number]> = {
  alpha:[0,0],britain:[-720,0],blacksail:[720,0],winter:[0,-720],kyoto:[0,720],
  orleans:[-720,-720],egypt:[720,720],qin:[720,-720],
};
/** Continental relief without the authored story crossings. */
export function continentNoise(x:number,z:number):number {
  let h=16+3*Math.sin(x*.006)*Math.cos(z*.007)+1.5*Math.sin((x+z)*.011);
  h+=smoothstep(320,500,-x)*smoothstep(300,500,z)*7*Math.sin(x*.009+z*.004)**2;
  return h;
}
// The four existing story approaches stay at their authored, low crossing levels.
const APPROACHES=[[360,30,16,0],[-360,-30,6,0],[0,-360,1.1,1],[40,360,10,1]] as const;
function applyApproaches(h:number,x:number,z:number):number {
  for(const [cx,cz,y,axis] of APPROACHES) {
    const across=axis===0?Math.abs(z-cz):Math.abs(x-cx),along=axis===0?Math.abs(x-cx):Math.abs(z-cz);
    h=lerp(h,y,(1-smoothstep(10,34,across))*(1-smoothstep(45,105,along)));
  }
  return h;
}
export function continentBase(x:number,z:number):number {return applyApproaches(continentNoise(x,z),x,z);}
/** Optional observer for tools that need a region's pre-continental (authored) height. */
export const authoredTap:{fn?:(id:string,x:number,z:number,h:number)=>void}={};

type Side='N'|'S'|'E'|'W';
/** Which tile sides are shared with another production tile (the rest face the outer sea). */
export const TILE_JOINS:Record<string,readonly Side[]>={
  alpha:['N','S','E','W'],britain:['N','E','S'],blacksail:['N','S','W'],winter:['S','E','W'],kyoto:['N','E','W'],
  orleans:['E','S'],qin:['W','S'],egypt:['W','N'],southwest:['N','E'],
};
export const TILE_OFFSETS:Record<string,readonly [number,number]>={...CONTINENT_OFFSETS,southwest:[-720,720]};
/** A join is a world-space line: axis 'x' is the line x=jx (s runs along z), axis 'z' is z=jz (s runs along x). */
export function sideJoin(id:string,side:Side){
  const [ox,oz]=TILE_OFFSETS[id];
  return side==='N'?{axis:'z' as const,jx:ox,jz:oz-360}:side==='S'?{axis:'z' as const,jx:ox,jz:oz+360}:side==='W'?{axis:'x' as const,jx:ox-360,jz:oz}:{axis:'x' as const,jx:ox+360,jz:oz};
}
export const joinKey=(j:{axis:'x'|'z';jx:number;jz:number})=>`${j.axis}:${j.jx}:${j.jz}`;
// Shared seam levels (one profile per join, written by tools/build-seam-data.ts) and
// per-tile protection of reviewed content (1 = keep the reviewed ground exactly).
const SEAM_FILE=new URL('./continent-seams.json',import.meta.url),PROTECT_FILE=new URL('./continent-protect.json',import.meta.url);
let seamData:{step:number;profiles:Record<string,number[]>}|null|undefined;
let protectData:Record<string,{n:number;cell:number;bytes:Uint8Array}>|undefined;
function seams(){
  if(seamData===undefined){try{seamData=existsSync(SEAM_FILE)?JSON.parse(readFileSync(SEAM_FILE,'utf8')):null;}catch{seamData=null;}}
  return seamData;
}
function protection(id:string,x:number,z:number):number {
  if(!protectData){
    protectData={};
    if(existsSync(PROTECT_FILE)){const raw=JSON.parse(readFileSync(PROTECT_FILE,'utf8'));for(const [k,v] of Object.entries(raw) as [string,{n:number;cell:number;data:string}][])protectData[k]={n:v.n,cell:v.cell,bytes:new Uint8Array(inflateSync(Buffer.from(v.data,'base64')))};}
  }
  const m=protectData[id];if(!m)return 0;
  const fx=Math.max(0,Math.min(m.n-1.001,(x+360)/m.cell)),fz=Math.max(0,Math.min(m.n-1.001,(z+360)/m.cell)),i=Math.floor(fx),j=Math.floor(fz),tx=fx-i,tz=fz-j;
  const v=(a:number,b:number)=>m.bytes[b*m.n+a]/255;
  return lerp(lerp(v(i,j),v(i+1,j),tx),lerp(v(i,j+1),v(i+1,j+1),tx),tz);
}
const hash=(key:string)=>{let h=0;for(const c of key)h=(h*31+c.charCodeAt(0))%9973;return h/9973*Math.PI*2;};
/** Width of the blend band: irregular along the seam so no transition reads as a ruled line. */
function bandWidth(key:string,j:{axis:'x'|'z';jx:number;jz:number},s:number,wx:number,wz:number):number {
  const phase=hash(key);
  let w=88+22*Math.sin(s*.019+phase)+12*Math.sin(s*.047+phase*2)+6*Math.sin(s*.11+phase*3);
  for(const [cx,cz,,axis] of APPROACHES) {
    if((axis===0)!==(j.axis==='x'))continue;
    if(j.axis==='x'?cx!==j.jx:cz!==j.jz)continue;
    w=lerp(w,60,1-smoothstep(45,105,j.axis==='x'?Math.abs(wz-cz):Math.abs(wx-cx)));
  }
  return w;
}
export function seamTarget(key:string,s:number,wx:number,wz:number):number {
  const noise=continentNoise(wx,wz),data=seams(),profile=data?.profiles[key];
  let t=noise;
  if(profile){
    const f=Math.max(0,Math.min(profile.length-1.001,(s+360)/data!.step)),i=Math.floor(f),level=lerp(profile[i],profile[i+1],f-i);
    t=lerp(level+(noise-16)*.6,noise,smoothstep(250,300,Math.abs(s)));
  }
  return applyApproaches(t,wx,wz);
}
function outerCoast(id:string,wx:number,wz:number,z:number,h:number):number {
  const radial=(Math.abs(wx)**6+Math.abs(wz)**6)**(1/6);
  let coast=1020+12*Math.sin(wx*.009+wz*.004)+9*Math.cos(wz*.012);
  // Camlann's western march and throne reward stand on an existing dry headland.
  // Carry that landform into the outer shoreline rather than flooding its actors.
  coast+=48*Math.exp(-(((wx+995)/100)**2+((wz-115)/105)**2));
  // Kyoto's southern shrine keeps its low dry shore; the lobe ends before the
  // eastern production join, preserving a shared coast with the desert region.
  coast+=72*(1-smoothstep(30,180,Math.abs(wx-146)))*(1-smoothstep(20,100,Math.abs(wz-1020)));
  const outer=id==='blacksail'?smoothstep(280,350,Math.abs(z)):1;
  return lerp(h,-8,smoothstep(coast-55,coast+25,radial)*outer);
}
/** The surface before seam levels existed: every tile edge fell to one shared base. */
function legacyContinental(id:string,x:number,z:number,authored:number):number {
  const [ox,oz]=TILE_OFFSETS[id],wx=x+ox,wz=z+oz;
  if(id==='southwest')return outerCoast(id,wx,wz,z,continentBase(wx,wz));
  // The fleet's existing eastern bay remains sea; its north/south shores join the mainland.
  const edge=id==='blacksail'?Math.max(-x,Math.abs(z)):Math.max(Math.abs(x),Math.abs(z));
  const join=smoothstep(id==='blacksail'?240:300,360,edge);
  return outerCoast(id,wx,wz,z,lerp(authored,continentBase(wx,wz),join));
}
/** Seam-side reshaping of a tile's own ground (applied only on the new surface, never under protected content). */
export function shapeTile(id:string,x:number,z:number,h:number):number {
  if(id==='blacksail'&&z>150) {
    // The southern strait used to run the full width of the tile, a straight canal beside
    // the desert. Close its western reach with low dune-marsh so the sea becomes the fleet
    // bay's south-western arm, curling out to the east.
    const coastX=40+170*smoothstep(150,360,z)+28*Math.sin(z*.045)+12*Math.sin(z*.11+1.3);
    const k=(1-smoothstep(coastX-45,coastX+12,x))*smoothstep(165,235,z);
    h=Math.max(h,lerp(h,5.5+1.8*Math.sin(x*.031)*Math.cos(z*.043)+fbm(x*.02,z*.02,2,412)*2,k));
  }
  return h;
}
export function continentalHeight(id:string,x:number,z:number,authored:number):number {
  authoredTap.fn?.(id,x,z,authored);
  const [ox,oz]=TILE_OFFSETS[id],wx=x+ox,wz=z+oz,original=authored;
  authored=shapeTile(id,x,z,authored);
  // Interior joins: both tiles meet one shared seam level taken from their own
  // neighbouring ground, across a band whose width wanders along the seam.
  let qSum=0,tSum=0,keep=1;
  for(const side of TILE_JOINS[id]) {
    const j=sideJoin(id,side),key=joinKey(j);
    const d=side==='N'?z+360:side==='S'?360-z:side==='W'?x+360:360-x;
    const s=j.axis==='x'?wz-j.jz:wx-j.jx;
    const w=1-smoothstep(0,bandWidth(key,j,s,wx,wz),d);
    if(w<=0)continue;
    const q=w/(1-w+1e-6);qSum+=q;tSum+=q*seamTarget(key,s,wx,wz);keep*=1-w;
  }
  let h=qSum>0?lerp(authored,tSum/qSum,1-keep):authored;
  // Outer sides keep their original treatment (fall to the base, then the sea).
  if(id!=='blacksail') {
    const sides=TILE_JOINS[id];
    const outer=Math.max(sides.includes('N')?-Infinity:-z,sides.includes('S')?-Infinity:z,sides.includes('W')?-Infinity:-x,sides.includes('E')?-Infinity:x);
    if(outer>-Infinity)h=lerp(h,continentBase(wx,wz),smoothstep(300,360,outer));
  }
  h=outerCoast(id,wx,wz,z,h);
  const p=protection(id,x,z);
  return p>0?lerp(h,legacyContinental(id,x,z,original),p):h;
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
    p.push(x,continentalHeight('southwest',x,z-720,continentBase(wx,z)),z);
    continentColor(wx,z,color);c.push(color.r,color.g,color.b);
  }
  for(let j=0;j<n-1;j++)for(let i=0;i<n-1;i++){const a=j*n+i,b=a+1,d=a+n;idx.push(a,d,b,b,d,d+1);}
  const vis=new THREE.BufferGeometry();vis.setAttribute('position',new THREE.Float32BufferAttribute(p,3));vis.setAttribute('color',new THREE.Float32BufferAttribute(c,3));vis.setIndex(idx);vis.computeVertexNormals();
  const col=new THREE.BufferGeometry();col.setAttribute('position',vis.attributes.position.clone());col.setIndex(idx);
  terrain.vis=mergeGeometries([terrain.vis,vis]);terrain.col=mergeGeometries([terrain.col,col]);
}

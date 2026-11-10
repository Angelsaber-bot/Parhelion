// Shared world-space surface at production joins. Tiles are export units, never islands.
import * as THREE from 'three';
import { smoothstep, lerp, fbm } from './rng.js';
import { readFileSync, existsSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

// The journey grows north from 幻日谷 (2026-11-10 layout):
//   奥尔良 | 古埃及 | 京都
//   秦     | 永冬   | 黑帆
//   落日王国 | 幻日谷 | 主角城镇
export const CONTINENT_OFFSETS: Record<string, readonly [number,number]> = {
  alpha:[0,0],britain:[-720,0],blacksail:[720,-720],winter:[0,-720],kyoto:[720,-1440],
  orleans:[-720,-1440],egypt:[0,-1440],qin:[-720,-720],home:[720,0],
};
/** Tiles turned half a circle in place: authored (x,z) sits at tile (-x,-z). */
export const TILE_ROTATED:Record<string,boolean>={kyoto:true,egypt:true,qin:true};
/** Authoring frame → tile frame (and back: a half turn is its own inverse). */
export const toTile=(id:string,x:number,z:number):[number,number]=>TILE_ROTATED[id]?[-x,-z]:[x,z];
/** Positions before the relayout; reviewed ground under protected content is still computed there. */
const LEGACY_OFFSETS: Record<string, readonly [number,number]> = {
  alpha:[0,0],britain:[-720,0],blacksail:[720,0],winter:[0,-720],kyoto:[0,720],
};
/** World centre of the 3×3 continent (the outer coast is drawn around it). */
export const CONTINENT_CENTER:readonly [number,number]=[0,-720];
/** Continental relief without the authored story crossings. */
export function continentNoise(x:number,z:number):number {
  let h=16+3*Math.sin(x*.006)*Math.cos(z*.007)+1.5*Math.sin((x+z)*.011);
  h+=smoothstep(320,500,-x)*smoothstep(300,500,z)*7*Math.sin(x*.009+z*.004)**2;
  return h;
}
// The four existing story approaches stay at their authored, low crossing levels.
// Black Sail's west pass now meets 永冬; Kyoto's torii approach (turned south) meets Black Sail.
// 幻日谷's old east pass keeps its level where it now opens onto the home town.
const APPROACHES=[[360,-690,16,0],[-360,-30,6,0],[0,-360,1.1,1],[680,-1080,10,1],[360,30,16,0]] as const;
// Before the relayout (legacy ground under protected content).
const LEGACY_APPROACHES=[[360,30,16,0],[-360,-30,6,0],[0,-360,1.1,1],[40,360,10,1]] as const;
function applyApproaches(h:number,x:number,z:number,list:readonly (readonly number[])[]=APPROACHES):number {
  for(const [cx,cz,y,axis] of list) {
    const across=axis===0?Math.abs(z-cz):Math.abs(x-cx),along=axis===0?Math.abs(x-cx):Math.abs(z-cz);
    h=lerp(h,y,(1-smoothstep(10,34,across))*(1-smoothstep(45,105,along)));
  }
  return h;
}
export function continentBase(x:number,z:number):number {return applyApproaches(continentNoise(x,z),x,z);}
const legacyBase=(x:number,z:number)=>applyApproaches(continentNoise(x,z),x,z,LEGACY_APPROACHES);
/** Optional observer for tools that need a region's pre-continental (authored) height. */
export const authoredTap:{fn?:(id:string,x:number,z:number,h:number)=>void}={};

type Side='N'|'S'|'E'|'W';
/** Which tile sides are shared with another production tile (the rest face the outer sea). */
/** Sides in the tile frame (after any half turn). */
export const TILE_JOINS:Record<string,readonly Side[]>={
  alpha:['N','E','W'],britain:['N','E'],blacksail:['N','S','W'],winter:['N','S','E','W'],kyoto:['S','W'],
  orleans:['E','S'],qin:['N','E','S'],egypt:['W','E','S'],home:['N','W'],
};
export const TILE_OFFSETS:Record<string,readonly [number,number]>=CONTINENT_OFFSETS;
/** A join is a world-space line: axis 'x' is the line x=jx (s runs along z), axis 'z' is z=jz (s runs along x). */
export function sideJoin(id:string,side:Side){
  const [ox,oz]=TILE_OFFSETS[id];
  return side==='N'?{axis:'z' as const,jx:ox,jz:oz-360}:side==='S'?{axis:'z' as const,jx:ox,jz:oz+360}:side==='W'?{axis:'x' as const,jx:ox-360,jz:oz}:{axis:'x' as const,jx:ox+360,jz:oz};
}
export const joinKey=(j:{axis:'x'|'z';jx:number;jz:number})=>`${j.axis}:${j.jx}:${j.jz}`;
/** Joins whose two tiles were already neighbours before the relayout (幻日谷–落日王国, 幻日谷–永冬). */
const UNCHANGED_JOINS=new Set(['x:-360:0','z:0:-360']);
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
function outerCoast(id:string,wx:number,wz:number,z:number,h:number,legacy=false):number {
  // The relayout moved old mid-edge coasts toward corners; a squarer outline (power 12) keeps
  // every edge's coast where it was and rounds only the corners themselves.
  const [cx,cz]=legacy?[0,0]:CONTINENT_CENTER,k=legacy?6:12,radial=(Math.abs(wx-cx)**k+Math.abs(wz-cz)**k)**(1/k);
  let coast=1020+12*Math.sin(wx*.009+wz*.004)+9*Math.cos(wz*.012);
  // Camlann's western march and throne reward stand on an existing dry headland.
  // Carry that landform into the outer shoreline rather than flooding its actors.
  coast+=48*Math.exp(-(((wx+995)/100)**2+((wz-115)/105)**2));
  // Kyoto's shrine shore (now facing the northern sea) keeps its low dry land.
  if(legacy)coast+=72*(1-smoothstep(30,180,Math.abs(wx-146)))*(1-smoothstep(20,100,Math.abs(wz-1020)));
  else {
    coast+=72*(1-smoothstep(30,180,Math.abs(wx-574)))*(1-smoothstep(20,100,Math.abs(wz+1740)));
    // Sides that were inland before the relayout (落日王国 and 幻日谷 south, Kyoto's old west
    // edge, now facing east) keep their land almost to the tile edge, ending in a beach.
    coast+=75*smoothstep(150,300,wz)*(1-smoothstep(330,450,wx));
    coast+=75*smoothstep(850,960,wx)*(1-smoothstep(-1150,-1050,wz));
  }
  const outer=id==='blacksail'?smoothstep(280,350,Math.abs(z)):1;
  return lerp(h,-8,smoothstep(coast-55,coast+25,radial)*outer);
}
/** Sides (tile frame) that already faced the outer sea before the relayout: their shore stays put. */
const LEGACY_OUTER:Record<string,readonly Side[]>={britain:['W'],kyoto:['N'],blacksail:['E']};
function coastFor(id:string,ax:number,az:number,x:number,z:number,wx:number,wz:number,h:number):number{
  const fresh=outerCoast(id,wx,wz,z,h),legacySides=LEGACY_OUTER[id];
  if(!legacySides)return fresh;
  const dist=(side:Side)=>side==='N'?z+360:side==='S'?360-z:side==='W'?x+360:360-x;
  const others=(['N','S','E','W'] as Side[]).filter(side=>!legacySides.includes(side)&&!TILE_JOINS[id].includes(side));
  const dLegacy=Math.min(...legacySides.map(dist)),dOther=others.length?Math.min(...others.map(dist)):Infinity;
  const [lox,loz]=LEGACY_OFFSETS[id],old=outerCoast(id,ax+lox,az+loz,az,h,true);
  return lerp(fresh,old,smoothstep(-40,40,dOther-dLegacy));
}
/** The surface before seam levels existed: every tile edge fell to one shared base. */
function legacyContinental(id:string,x:number,z:number,authored:number):number {
  const [ox,oz]=LEGACY_OFFSETS[id],wx=x+ox,wz=z+oz;
  // The fleet's existing eastern bay remains sea; its north/south shores join the mainland.
  const edge=id==='blacksail'?Math.max(-x,Math.abs(z)):Math.max(Math.abs(x),Math.abs(z));
  const join=smoothstep(id==='blacksail'?240:300,360,edge);
  return outerCoast(id,wx,wz,z,lerp(authored,legacyBase(wx,wz),join),true);
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
/** x,z are in the tile's authoring frame (the frame its generator and GLB use). */
export function continentalHeight(id:string,ax:number,az:number,authored:number):number {
  authoredTap.fn?.(id,ax,az,authored);
  const [x,z]=toTile(id,ax,az),[ox,oz]=TILE_OFFSETS[id],wx=x+ox,wz=z+oz,original=authored;
  authored=shapeTile(id,ax,az,authored);
  // Interior joins: both tiles meet one shared seam level taken from their own
  // neighbouring ground, across a band whose width wanders along the seam.
  let qSum=0,tSum=0,keep=1,newSeam=Infinity;
  for(const side of TILE_JOINS[id]) {
    const j=sideJoin(id,side),key=joinKey(j);
    const d=side==='N'?z+360:side==='S'?360-z:side==='W'?x+360:360-x;
    if(!UNCHANGED_JOINS.has(key))newSeam=Math.min(newSeam,d);
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
  h=coastFor(id,ax,az,x,z,wx,wz,h);
  // Reviewed ground is kept exactly, except along joins whose neighbour changed in the
  // relayout: there both sides must meet the new seam level (approaches keep their old levels).
  const p=protection(id,ax,az)*(Number.isFinite(newSeam)?smoothstep(0,28,newSeam):1);
  return p>0?lerp(h,legacyContinental(id,ax,az,original),p):h;
}
const soils=[
  [-720,-1440,'#718d60'],[0,-1440,'#c6a168'],[720,-1440,'#7f9a5e'],
  [-720,-720,'#7d926e'],[0,-720,'#e3ebf6'],[720,-720,'#b8c978'],
  [-720,0,'#a8c46a'],[0,0,'#8fb269'],[720,0,'#6d8a52'],
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
    const [x,z]=toTile(id,p.getX(i),p.getZ(i));
    const bend=35*Math.sin((x+ox)*.012+(z+oz)*.008);
    const w=smoothstep(185+bend,360,Math.hypot(x,z));
    if(w===0)continue;
    continentColor(x+ox,z+oz,tmp);old.fromBufferAttribute(c,i).lerp(tmp,w);c.setXYZ(i,old.r,old.g,old.b);
  }
}

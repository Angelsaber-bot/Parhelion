/** Bounded visual-only frost geology: no RNG, collision, quests or terrain edits. */
import * as THREE from 'three';
import { Batch, T } from '../geo.js';
import type { Piece } from '../structures.js';
import { CAVERN, ICE_Y, RIVER } from './layout.js';
type HeightAt = (x: number, z: number) => number;
type P = [number, number, number];
const TAU=Math.PI*2;
const colors=['#657589','#708092','#607286','#788797','#65788b'];
function mesh(b:Batch,p:P[],color:string){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p.flat(),3));b.add(g,color,T(0,0,0),false);}
function quad(b:Batch,a:P,c:P,d:P,e:P,color:string){mesh(b,[a,c,d,a,d,e],color);}
const mouth=Math.atan2(RIVER[RIVER.length-2][1]-CAVERN.c[1],RIVER[RIVER.length-2][0]-CAVERN.c[0]);
const angleDistance=(a:number,b:number)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));
const pieces=(bs:Batch[]):Piece[]=>bs.map(batch=>({name:batch.name,material:batch.material,batch,outline:false,userData:{winterFrostwork:true}}));
/** Replaces ONLY old cavern rock-ring/hemisphere VIS range; preserve its COL. */
export function frostCavernPieces():Piece[]{
 const stone=new Batch('Cavern_FracturedStrata','M_WinterStone'),snow=new Batch('Cavern_SnowShelves','M_WinterSnow'),ice=new Batch('Cavern_FrostFacets','M_WinterStone');
 const [cx,cz]=CAVERN.c;
 // Tapered bedding-plane buttresses retain the old ring footprint and rooted base.
 for(let k=0;k<14;k++){
  const a=k/14*TAU;if(angleDistance(a,mouth)<.45)continue;
  const x=cx+Math.cos(a)*(CAVERN.r+2),z=cz+Math.sin(a)*(CAVERN.r+2);
  const ys=[ICE_Y-1.2,ICE_Y+3.5,ICE_Y+7.2,ICE_Y+11.8,ICE_Y+13.4+(k%5)*1.1],rs=[6.1,6.5,5.7,5.95,3.9];
  const ring=(j:number,i:number):P=>{const t=a+i/7*TAU+.12*Math.sin(k*2),w=1+.18*Math.sin(i*2.7+k),scale=.9+.16*Math.sin(k*1.9);return[x+Math.cos(t)*rs[j]*w*scale+j*.45*Math.sin(k),ys[j]+.8*Math.sin(i*2+k)+.25*j*Math.sin(i*1.3+k),z+Math.sin(t)*rs[j]*w*(1.05+.18*Math.cos(k*2))+j*.4*Math.cos(k)];};
  for(let j=0;j<4;j++)for(let i=0;i<7;i++)quad(stone,ring(j,i),ring(j+1,i),ring(j+1,(i+1)%7),ring(j,(i+1)%7),colors[(j+k+i%2)%5]);
  for(let i=0;i<7;i++)mesh(snow,[[x,ys[4]+.18,z],ring(4,(i+1)%7),ring(4,i)],'#d4e3ed');
 }
 // Interlocking, asymmetric slab field rather than a radial dome or umbrella.
 // Shared jittered grid nodes form a continuous ceiling; only boundary edges get
 // a thick rock fascia. The walkable entrance retains at least 8m of headroom.
 const nodes=new Map<string,P>(), edges=new Map<string,{a:P;b:P;n:number}>();
 const node=(i:number,j:number):P=>{
  const key=i+','+j,old=nodes.get(key);if(old)return old;
  let x=-28+i*7,z=-28+j*7;
  x+=1.1*Math.sin(i*2.9+j*1.7);z+=1.2*Math.cos(i*1.4+j*2.3);
  const r=Math.hypot(x,z),limit=26.4+1.2*Math.sin(Math.atan2(z,x)*3+.7);
  if(r>limit){x*=limit/r;z*=limit/r;}
  const h=20.5-9*Math.pow(Math.hypot(x+2,z-1)/29,1.6)+1.2*Math.sin(x*.22)+.7*Math.cos(z*.18);
  const p:P=[cx+x,ICE_Y+Math.max(9.5,h),cz+z];nodes.set(key,p);return p;
 };
 const edge=(a:P,b:P)=>{const key=[a.join(','),b.join(',')].sort().join('|'),e=edges.get(key);if(e)e.n++;else edges.set(key,{a,b,n:1});};
 for(let i=0;i<8;i++)for(let j=0;j<8;j++){
  if(Math.hypot(-24.5+i*7,-24.5+j*7)>27)continue;
  const a=node(i,j),b=node(i,j+1),c=node(i+1,j+1),d=node(i+1,j);
  quad(stone,a,b,c,d,colors[(i+2*j)%5]);
  // Snow lies in broad connected irregular patches, exposing broken slate edges.
  if((i*3+j*5)%11!==0){const up=(p:P):P=>[p[0],p[1]+.18,p[2]];quad(snow,up(a),up(b),up(c),up(d),(i+j)%4?'#dce8ef':'#cbdde8');}
  edge(a,b);edge(b,c);edge(c,d);edge(d,a);
 }
 for(const {a,b,n} of edges.values())if(n===1){
  const low=(p:P):P=>[p[0],p[1]-1.25,p[2]];
  quad(stone,a,low(a),low(b),b,'#536a7d');
  const centerAngle=Math.atan2((a[2]+b[2])/2-cz,(a[0]+b[0])/2-cx);
  if(angleDistance(centerAngle,mouth)<.8&&a[0]%3>1){
   mesh(ice,[low(a),low(b),[(a[0]+b[0])/2,Math.min(a[1],b[1])-2,(a[2]+b[2])/2]],'#acd2e2');
  }
 }
 return pieces([stone,snow,ice]);
}
/** Reserved integration hook. Steep terrain ribbon overlays failed pixel QA and
 * were removed rather than introducing floating geometry or changing terrain. */
export function frostGorgePieces(_heightAt:HeightAt):Piece[]{return [];}

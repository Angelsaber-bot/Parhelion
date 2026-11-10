// Seam levels shared by both sides of every production join, and protection masks
// that keep the ground under reviewed content in the five original tiles unchanged.
//   node --import tsx tools/build-seam-data.ts            (seam levels only)
//   node --import tsx tools/build-seam-data.ts --protect  (also re-derive the masks from the reviewed GLBs)
import {readFileSync,writeFileSync} from 'node:fs';
import {deflateSync} from 'node:zlib';
import * as THREE from 'three';
import {heightFn as alpha} from './gen/terrain';
import {heightFn as britain} from './gen/britain/terrain';
import {heightFn as winter} from './gen/winter/terrain';
import {heightFn as kyoto} from './gen/kyoto/terrain';
import {heightFn as blacksail} from './gen/blacksail/terrain';
import {orleansAuthoredHeight} from './gen/orleans/landscape';
import {qinAuthoredHeight} from './gen/qin/landscape';
import {egyptAuthoredHeight} from './gen/egypt/landscape';
import {EXPANSION_PLANS} from '../src/map/worldPlan';
import {TILE_JOINS,TILE_OFFSETS,sideJoin,joinKey,authoredTap,shapeTile,toTile} from './gen/continent';
import {homeAuthoredHeight} from './gen/home/landscape';
import {regionLoader,bakeQuantized} from '../src/rendering/glb';
import {EXTRA_PROTECTION} from './gen/continent-protect-extra';

const plan=(id:string)=>EXPANSION_PLANS.find(p=>p.id===id)!;
let tapped=0;authoredTap.fn=(_id,_x,_z,h)=>{tapped=h;};
const viaTap=(fn:(x:number,z:number)=>number)=>(x:number,z:number)=>{fn(x,z);return tapped;};
const AUTHORED:Record<string,(x:number,z:number)=>number>={
  alpha:viaTap(alpha),britain:viaTap(britain),winter:viaTap(winter),kyoto:viaTap(kyoto),blacksail:viaTap(blacksail),
  orleans:(x,z)=>orleansAuthoredHeight(plan('orleans'),x,z),qin:(x,z)=>qinAuthoredHeight(plan('qin'),x,z),egypt:(x,z)=>egyptAuthoredHeight(plan('egypt'),x,z),
  home:(x,z)=>homeAuthoredHeight(plan('home'),x,z),
};
const STEP=8,profiles:Record<string,number[]>={};
const joins=new Map<string,{j:ReturnType<typeof sideJoin>;tiles:{id:string;side:string}[]}>();
for(const [id,sides] of Object.entries(TILE_JOINS))for(const side of sides){const j=sideJoin(id,side),k=joinKey(j);(joins.get(k)??joins.set(k,{j,tiles:[]}).get(k)!).tiles.push({id,side});}
for(const [key,{j,tiles}] of joins){
  if(tiles.length!==2)throw new Error(`join ${key} has ${tiles.length} tiles`);
  const raw:number[]=[];
  for(let s=-360;s<=360;s+=STEP){
    const means=tiles.map(({id,side})=>{
      const [ox,oz]=TILE_OFFSETS[id];let t=0,n=0;
      for(let d=50;d<=120;d+=10){
        const wx=j.axis==='x'?j.jx+(side==='W'?d:-d):j.jx+s,wz=j.axis==='z'?j.jz+(side==='N'?d:-d):j.jz+s;
        const [ax,az]=toTile(id,wx-ox,wz-oz); // tile frame → authoring frame (a half turn is its own inverse)
        t+=shapeTile(id,ax,az,AUTHORED[id](ax,az));n++;
      }
      return t/n;
    });
    let level=(means[0]+means[1])/2;
    // A sea on one side does not drag the seam under water: the shore rises toward the land.
    if(Math.min(...means)<2)level=Math.max(level,Math.max(...means)-8);
    raw.push(Math.max(3,level));
  }
  const smooth=raw.map((_,i)=>{let t=0,w=0;for(let k=-6;k<=6;k++){const v=raw[Math.max(0,Math.min(raw.length-1,i+k))],g=Math.exp(-(k*k)/(2*3*3));t+=v*g;w+=g;}return +(t/w).toFixed(2);});
  profiles[key]=smooth;
  console.log(key,tiles.map(t=>t.id).join('|'),smooth.filter((_,i)=>i%10===0).map(v=>v.toFixed(0)).join(' '));
}
writeFileSync(new URL('./gen/continent-seams.json',import.meta.url),JSON.stringify({step:STEP,profiles}));

if(process.argv.includes('--protect')){
  const CELL=4,N=720/CELL+1,out:Record<string,{n:number;cell:number;data:string}>={};
  const scatter=/^(Terrain|Water|Trees_|Bushes|Rocks|Grass|Sky|Dark_Sun|Sun_Core_Beam|COL_Terrain|COL_Props)/;
  for(const id of ['alpha','britain','winter','kyoto','blacksail']){
    const hit=new Uint8Array(N*N),mark=(x:number,z:number)=>{const i=Math.round((x+360)/CELL),k=Math.round((z+360)/CELL);if(i>=0&&k>=0&&i<N&&k<N)hit[k*N+i]=1;};
    const bytes=readFileSync(new URL(`../public/assets/world_${id}.glb`,import.meta.url));
    const {scene}=await regionLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
    bakeQuantized(scene);scene.updateMatrixWorld(true);const v=new THREE.Vector3();
    scene.traverse(o=>{
      const m=o as THREE.Mesh;
      if(o.name.startsWith('MK_')){o.getWorldPosition(v);mark(v.x,v.z);}
      if(!m.isMesh||scatter.test(m.name))return;
      const p=m.geometry.attributes.position;for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(m.matrixWorld);if(Math.abs(v.x)<=362&&Math.abs(v.z)<=362)mark(v.x,v.z);}
      // long faces (walls, decks) also protect their interiors
      const box=new THREE.Box3().setFromObject(m);if(box.max.x-box.min.x<40&&box.max.z-box.min.z<40)for(let x=box.min.x;x<=box.max.x;x+=CELL)for(let z=box.min.z;z<=box.max.z;z+=CELL)mark(x,z);
    });
    const layout=JSON.parse(readFileSync(new URL(`../public/assets/world_${id}.layout.json`,import.meta.url),'utf8'));
    for(const path of layout.paths??[])for(let i=1;i<path.length;i++){const [a,b]=[path[i-1],path[i]],n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/2);for(let t=0;t<=n;t++)mark(a[0]+(b[0]-a[0])*t/n,a[1]+(b[1]-a[1])*t/n);}
    for(const [x,z,r] of EXTRA_PROTECTION[id]??[])for(let dx=-r;dx<=r;dx+=CELL)for(let dz=-r;dz<=r;dz+=CELL)if(dx*dx+dz*dz<=r*r)mark(x+dx,z+dz);
    // distance (m) to the nearest protected cell → 1 within 10 m, 0 beyond 40 m
    const R=Math.ceil(40/CELL),cells:number[]=[];for(let k=0;k<N*N;k++)if(hit[k])cells.push(k);
    const dist=new Float32Array(N*N).fill(Infinity);
    for(const k of cells){const ci=k%N,ck=(k-ci)/N;for(let dk=-R;dk<=R;dk++)for(let di=-R;di<=R;di++){const i=ci+di,kk=ck+dk;if(i<0||kk<0||i>=N||kk>=N)continue;const d=Math.hypot(di,dk)*CELL,idx=kk*N+i;if(d<dist[idx])dist[idx]=d;}}
    const mask=new Uint8Array(N*N);for(let k=0;k<N*N;k++){const t=Math.max(0,Math.min(1,(dist[k]-10)/30));mask[k]=Math.round(255*(1-t*t*(3-2*t)));}
    out[id]={n:N,cell:CELL,data:deflateSync(mask).toString('base64')};
    console.log(id,'protected cells',cells.length,'of',N*N);
  }
  writeFileSync(new URL('./gen/continent-protect.json',import.meta.url),JSON.stringify(out));
}

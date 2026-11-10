import * as THREE from 'three';
import {Batch,T} from '../geo';
import type {Piece} from '../structures';
import {ORLEANS_UNDERPASS} from '../../../src/map/orleansWorks';
import {C,Frame,strip,pointedArch} from './craft';

/** A dry maintenance walk above a narrow drain, under the town's existing bank. */
export function buildOrleansWatercourse():Piece[]{
 const stone=new Batch('orleans_OldWatercourse','M_OrleansCraft');
 // The descent/return are already the map's collision ribbons. Sheltered stone
 // vaults belong only to the flat middle; both sloping mouths remain open-air.
 for(let i=4;i<=5;i++){
  const a=ORLEANS_UNDERPASS[i-1],b=ORLEANS_UNDERPASS[i],dx=b[0]-a[0],dz=b[2]-a[2],length=Math.hypot(dx,dz),yaw=Math.atan2(dx,dz);
  const f=new Frame(stone,(a[0]+b[0])/2,2.5,(a[2]+b[2])/2,yaw);
  for(const side of [-1,1]){
   f.box(side*2.75,1.55,0,.45,3.1,length+.5,C.joint);
   f.box(side*2.48,.12,0,.35,.24,length+.5,C.stone);
   for(let z=-length/2+2;z<length/2;z+=6)f.box(side*2.5,1.2,z,.11,2.2,.55,C.pale,false);
  }
  // A closed curved shell with distinct inner soffit and outer stone thickness.
  const points:number[]=[],indices:number[]=[],n=18;
  for(const end of [-1,1])for(const shell of [0,1])for(let j=0;j<=n;j++){
   const angle=j/n*Math.PI,r=2.5+shell*.4;
   points.push(Math.cos(angle)*r,3+Math.sin(angle)*(2.1+shell*.4),end*(length/2+.2));
  }
  const ring=n+1,layer=ring*2;
  const face=(a:number,b:number,c:number,nx:number,ny:number,nz:number)=>{
   const p=new THREE.Vector3().fromArray(points,a*3),q=new THREE.Vector3().fromArray(points,b*3),r=new THREE.Vector3().fromArray(points,c*3);
   const normal=q.sub(p).cross(r.sub(p));
   indices.push(a,...(normal.dot(new THREE.Vector3(nx,ny,nz))>=0?[b,c]:[c,b]));
  };
  for(let j=0;j<n;j++){
   const angle=(j+.5)/n*Math.PI,nx=Math.cos(angle),ny=Math.sin(angle);
   face(j,j+1,layer+j,-nx,-ny,0);face(j+1,layer+j+1,layer+j,-nx,-ny,0);
   face(ring+j,layer+ring+j,ring+j+1,nx,ny,0);face(ring+j+1,layer+ring+j,layer+ring+j+1,nx,ny,0);
   for(const end of [0,layer]){const nz=end===0?-1:1;face(end+j,end+ring+j,end+j+1,0,0,nz);face(end+j+1,end+ring+j,end+ring+j+1,0,0,nz);}
  }
  for(const j of [0,n]){face(j,layer+j,ring+j,0,-1,0);face(ring+j,layer+j,layer+ring+j,0,-1,0);}
  f.mesh(points,indices,C.stone);
  for(let z=-length/2+1;z<length/2;z+=6){
   const q=f.point(0,0,z),arch=new Frame(stone,q.x,q.y,q.z,yaw);
   // Joint rings are visual, preserving the full clear opening beneath the vault.
   for(let j=1;j<=18;j++){
    const t0=(j-1)/18*Math.PI,t1=j/18*Math.PI;
    arch.beam([Math.cos(t0)*2.48,3+Math.sin(t0)*2.08,0],[Math.cos(t1)*2.48,3+Math.sin(t1)*2.08,0],.14,C.pale);
   }
  }
  // The shallow runnel stays beside the walking centre and above sea level.
  f.box(-1.95,.035,0,.45,.06,length,'#718b88',false);
  for(const z of [-length*.3,length*.25]){
   f.box(2.36,1.5,z,.18,1.3,.6,C.dark,false);f.box(2.25,1.5,z,.1,.85,.36,'#bda971',false);
  }
 }
 const entry=new Frame(stone,-163,2.5,-58,Math.atan2(17,-12));
 for(const side of [-1,1])entry.box(side*2.85,1.8,0,.7,3.6,1.2,C.pale);
 pointedArch(entry,0,0,-.4,5.8,5.25,.4,C.pale);
 // Worker's refuges and stone drain grates fit the river-engineering character.
 const alcove=new Frame(stone,-146,2.5,-70,Math.atan2(23,-18));
 alcove.box(2,1.05,0,.7,.2,2.2,C.oak);for(const z of [-.8,.8])alcove.box(2,.55,z,.3,1.1,.3,C.stone);
 for(const x of [-1.8,-1.35])for(let i=0;i<5;i++)alcove.box(x,.08,-1+i*.4,.08,.08,.35,C.dark,false);
 const landing=ORLEANS_UNDERPASS.slice(0,3).map(p=>[p[0],p[1]+.11,p[2]] as [number,number,number]);strip(stone,landing,5.6,C.stone);
 // A small drain outlet gives the river-facing mouth a visible purpose.
 for(const side of [-1,1]){
  const p=entry.point(side*3.6,.3,-.7);stone.add(new THREE.IcosahedronGeometry(.7,0),C.joint,T(p.x,p.y,p.z,0,1,.65,1));
 }
 return[{name:stone.name,batch:stone,material:'M_OrleansCraft',outline:false}];
}

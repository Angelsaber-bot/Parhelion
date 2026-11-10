import * as THREE from 'three';
import {Batch,BOX,T} from '../geo';
import type {RoutePoint} from '../../../src/map/worldPlan';

export const C={stone:'#cbbc9b',pale:'#e5d6b5',joint:'#9a8d73',dark:'#465665',blue:'#516c94',slate:'#53677b',wood:'#66513d',oak:'#987650',gold:'#cab56c',glass:'#557e9d',white:'#ece0c1',ash:'#746e62'};
export const CYL=new THREE.CylinderGeometry(1,1,1,12),CONE=new THREE.ConeGeometry(1,1,12);
export class Frame {
  constructor(public b:Batch,public x:number,public y:number,public z:number,public a=0){}
  point(x:number,y:number,z:number){return new THREE.Vector3(this.x+Math.cos(this.a)*x+Math.sin(this.a)*z,this.y+y,this.z-Math.sin(this.a)*x+Math.cos(this.a)*z);}
  box(x:number,y:number,z:number,w:number,h:number,d:number,c:string,collide=true,a=0){const p=this.point(x,y,z);this.b.add(BOX,c,T(p.x,p.y,p.z,this.a+a,w,h,d),collide);}
  cyl(x:number,y:number,z:number,r:number,h:number,c:string,collide=true){const p=this.point(x,y,z);this.b.add(CYL,c,T(p.x,p.y,p.z,0,r,h,r),collide);}
  beam(a:number[],b:number[],w:number,c:string,collide=false){const p=this.point(...a as [number,number,number]),q=this.point(...b as [number,number,number]);const m=new THREE.Matrix4().compose(p.clone().add(q).multiplyScalar(.5),new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),q.clone().sub(p).normalize()),new THREE.Vector3(w,p.distanceTo(q),w));this.b.add(BOX,c,m,collide);}
  mesh(p:number[],idx:number[],c:string,collide=true){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(idx);this.b.add(g,c,T(this.x,this.y,this.z,this.a),collide);g.dispose();}
}
export function gable(f:Frame,w:number,d:number,eave:number,rise:number,color:string){
  const x=w/2+.7,z=d/2+.65;
  // Closed triangular prism: roof underside and both gables are actual surfaces.
  f.mesh([-x,eave,-z,x,eave,-z,0,eave+rise,-z,-x,eave,z,x,eave,z,0,eave+rise,z],
    [0,2,1,3,4,5,0,3,5,0,5,2,1,2,5,1,5,4,0,1,4,0,4,3],color);
  for(const side of [-1,1]){f.beam([side*x,eave,-z],[side*x,eave,z],.22,C.wood);for(let row=1;row<7;row++){const t=row/7;f.beam([side*x*(1-t),eave+rise*t+.05,-z],[side*x*(1-t),eave+rise*t+.05,z],.075,row%2?color:C.slate);}}
  f.beam([0,eave+rise+.12,-z],[0,eave+rise+.12,z],.25,color);
}
/** Six-sided, fully capped hip roof used by the stone trade buildings. */
export function hipRoof(f:Frame,w:number,d:number,e:number,r:number,c:string){
  const x=w/2+.7,z=d/2+.7;
  f.mesh([-x,e,-z,x,e,-z,x,e,z,-x,e,z,0,e+r,-d*.25,0,e+r,d*.25],
    [0,4,1,1,4,5,1,5,2,2,5,3,3,5,4,3,4,0,0,1,2,0,2,3],c);
}
export function workshopRoof(f:Frame,w:number,d:number,e:number,c:string){
  const x=w/2+.7,z=d/2+.7;
  f.mesh([-x,e,-z,x,e,-z,x,e,z,-x,e,z,-x,e+3.4,-z,x,e+3.4,-z],
    [0,4,5,0,5,1,4,3,2,4,2,5,0,3,4,1,5,2,0,1,2,0,2,3],c);
}
/** Pointed arch ring in a facade; the centre is always an opening, never a box. */
export function pointedArch(f:Frame,x:number,y:number,z:number,w:number,h:number,t:number,color:string){
  const p=[[-w/2,0],[-w/2,h*.55],[-w*.32,h*.82],[0,h],[w*.32,h*.82],[w/2,h*.55],[w/2,0]];
  for(let i=1;i<p.length;i++)f.beam([x+p[i-1][0],y+p[i-1][1],z],[x+p[i][0],y+p[i][1],z],t,color);
}
export function window(f:Frame,x:number,y:number,z:number,w=1.2,h=2.1){
  f.box(x,y,z,w,h,.12,C.dark,false);f.box(x,y,z+.07,w*.7,h*.85,.07,C.glass,false);
  pointedArch(f,x,y-h/2,z+.15,w+.25,h+.16,.12,C.pale);
  f.box(x,y,z+.18,.08,h,.07,C.gold,false);f.box(x,y-.15,z+.18,w,.08,.07,C.gold,false);
}
export function banner(f:Frame,x:number,y:number,z:number,h=5){
  f.beam([x-1.6,y,z],[x+1.6,y,z],.15,C.oak);f.box(x,y-h/2,z,2.8,h,.08,C.blue,false);
  // Three pale petals and a crossbar give the local heraldic cloth its silhouette.
  for(const side of [-1,0,1])f.beam([x,y-h*.66,z+.08],[x+side*.62,y-h*.34,z+.08],.19,C.white);
  f.box(x,y-h*.57,z+.12,1.4,.2,.06,C.gold,false);
}
export function strip(b:Batch,points:RoutePoint[],width:number,color:string,collide=true){
  const v:number[]=[];for(let i=1;i<points.length;i++){
    const a=points[i-1],q=points[i],dx=q[0]-a[0],dz=q[2]-a[2],l=Math.hypot(dx,dz)||1,ox=-dz/l*width/2,oz=dx/l*width/2;
    const p=[[a[0]+ox,a[1],a[2]+oz],[a[0]-ox,a[1],a[2]-oz],[q[0]+ox,q[1],q[2]+oz],[q[0]-ox,q[1],q[2]-oz]];
    v.push(...p[0],...p[2],...p[1],...p[1],...p[2],...p[3]);
  }const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));b.add(g,color,new THREE.Matrix4(),collide);g.dispose();
}

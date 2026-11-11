import * as THREE from 'three';
import {Batch,BOX,T} from '../geo';
import {CYL,Frame} from './craft';

export const ICO0=new THREE.IcosahedronGeometry(1,0),ICO1=new THREE.IcosahedronGeometry(1,1);
/** Hand-built mesh whose faces are turned to a stated outward direction, never by vertex order. */
export class Solid{
  v:number[]=[];i:number[]=[];
  p(x:number,y:number,z:number){this.v.push(x,y,z);return this.v.length/3-1;}
  tri(a:number,b:number,c:number,n:readonly number[]){
    const A=new THREE.Vector3().fromArray(this.v,a*3),B=new THREE.Vector3().fromArray(this.v,b*3),D=new THREE.Vector3().fromArray(this.v,c*3);
    const normal=B.sub(A).cross(D.sub(A));
    if(normal.x*n[0]+normal.y*n[1]+normal.z*n[2]>=0)this.i.push(a,b,c);else this.i.push(a,c,b);
  }
  quad(a:number,b:number,c:number,d:number,n:readonly number[]){this.tri(a,b,c,n);this.tri(a,c,d,n);}
  emit(f:Frame,color:string,collide=true){if(this.i.length)f.mesh(this.v,this.i,color,collide);}
}
/** Round bar between two world points. */
export function rod(b:Batch,p:readonly number[],q:readonly number[],r:number,color:string,collide=false,geo:THREE.BufferGeometry=CYL){
  const a=new THREE.Vector3(p[0],p[1],p[2]),e=new THREE.Vector3(q[0],q[1],q[2]);
  b.add(geo,color,new THREE.Matrix4().compose(a.clone().add(e).multiplyScalar(.5),new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),e.clone().sub(a).normalize()),new THREE.Vector3(r,a.distanceTo(e),r)),collide);
}
/** Board centred on a world point: turned by yaw, then leaned back by tilt. */
export function plate(b:Batch,x:number,y:number,z:number,yaw:number,tilt:number,w:number,h:number,t:number,color:string,collide=false){
  b.add(BOX,color,T(x,y,z,yaw,w,h,t,tilt),collide);
}
export function blob(b:Batch,x:number,y:number,z:number,sx:number,sy:number,sz:number,color:string,geo:THREE.BufferGeometry=ICO0,ry=0,collide=false){
  b.add(geo,color,T(x,y,z,ry,sx,sy,sz),collide);
}
/** Closed ridge roof with optional darker courses (thatch, canvas). The ridge runs along local z. */
export function prismRoof(f:Frame,w:number,d:number,eave:number,rise:number,color:string,band?:string){
  const x=w/2+.6,z=d/2+.5;
  f.mesh([-x,eave,-z,x,eave,-z,0,eave+rise,-z,-x,eave,z,x,eave,z,0,eave+rise,z],[0,2,1,3,4,5,0,3,5,0,5,2,1,2,5,1,5,4,0,1,4,0,4,3],color);
  if(band)for(const s of [-1,1])for(const t of [.3,.62])f.beam([s*x*(1-t),eave+rise*t+.06,-z],[s*x*(1-t),eave+rise*t+.06,z],.1,band);
  f.beam([0,eave+rise+.1,-z],[0,eave+rise+.1,z],.3,band??color);
}

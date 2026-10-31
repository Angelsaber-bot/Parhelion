/** Optional west walking approach; original jump/glide/perch route and tower gates remain intact. */
import * as THREE from 'three';
import {Batch,T,BOX} from '../geo.js';
export const TOWER_ACCESS={name:'Tower_West_Access',x0:-26,x1:-15.5,landingEnd:-13,z:-159.5,width:3.6,deck:30.5,baseY:23.945749171617024}as const;
export function buildTowerAccess(heightAt:(x:number,z:number)=>number){
 const {x0,x1,z,width,deck}=TOWER_ACCESS,y0=TOWER_ACCESS.baseY,z0=z-width/2,z1=z+width/2,bottom=y0-1.2;
 // Freeze the collider-audited base for source/append parity; procedural and
 // decoded terrain differ by ~6 mm here. Reject unrelated terrain changes.
 const ground=heightAt(x0,z);
 if(!Number.isFinite(ground)||Math.abs(ground-y0)>.15)throw Error('Tower access terrain support changed');
 const geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute([x0,bottom,z0,x1,bottom,z0,x1,bottom,z1,x0,bottom,z1,x0,y0,z0,x1,deck,z0,x1,deck,z1,x0,y0,z1],3));
 geometry.setIndex([4,6,5,4,7,6,0,1,2,0,2,3,0,5,1,0,4,5,3,2,6,3,6,7,0,3,7,0,7,4,1,5,6,1,6,2]);
 const batch=new Batch(TOWER_ACCESS.name,'M_Toon');batch.add(geometry,'#c7c2b4',new THREE.Matrix4());geometry.dispose();
 batch.box((x1+TOWER_ACCESS.landingEnd)/2,deck-.22,z,TOWER_ACCESS.landingEnd-x1,.22,width,'#d6d2c8');
 const slope=(deck-y0)/(x1-x0),angle=Math.atan(slope),y=(x:number)=>y0+(x-x0)*slope;
 // Flush stone joints and low edge courses: visible ramp, not misleading steep stairs.
 for(let x=x0+.6;x<x1-.2;x+=.6)batch.add(BOX,'#a9a7a3',T(x,y(x)+.008,z,0,.045,.012,width-.22,0,angle),false);
 for(const side of[-1,1])batch.add(BOX,'#ece9e1',T((x0+x1)/2,(y0+deck)/2+.055,z+side*(width/2-.075),0,Math.hypot(x1-x0,deck-y0),.10,.15,0,angle),false);
 batch.box(-13.6,deck+.008,z,.08,.012,width-.2,'#3fb6b0',0,false);
 return{batch,start:[x0,y0,z]as[number,number,number],end:[x1,deck,z]as[number,number,number],slopeDegrees:angle*180/Math.PI};
}

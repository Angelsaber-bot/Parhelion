import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import type { Marker } from '../core/types';
import type { Collider } from '../player/player';
import { ORLEANS_CAMPAIGN as C, ORLEANS_CAMPAIGN_ACTIONS } from '../story/orleansCampaign';
import { createSettlementNpcs } from '../settlements/npcs';

type P=[number,number,number];
export function createOrleansCampaignScene(ground:(x:number,z:number,ceiling:number)=>number|null,clear:(p:THREE.Vector3)=>boolean){
 const root=new THREE.Group();root.name='OrleansChapterWorks';
 const geo=new Set<THREE.BufferGeometry>(),mats=new Map<number,THREE.MeshStandardMaterial>();
 const markers:Marker[]=[],colliders:Collider[]=[],targets:THREE.Mesh[]=[];
 const points=new Map<string,P>(),pieces=new Map<string,THREE.Group>();
 function material(color:number){let m=mats.get(color);if(!m){m=new THREE.MeshStandardMaterial({color,roughness:.85});mats.set(color,m);}return m;}
 function box(parent:THREE.Object3D,p:P,s:P,color=0x806145){const g=new THREE.BoxGeometry(...s);geo.add(g);const m=new THREE.Mesh(g,material(color));m.position.set(...p);m.receiveShadow=true;parent.add(m);return m;}
 function fixed(parent:THREE.Object3D,p:P,s:P,color:number){const m=box(parent,p,s,color);root.updateMatrixWorld(true);const g=m.geometry.clone().applyMatrix4(m.matrixWorld);geo.add(g);const collider={name:`OrleansChapter_${colliders.length}`,bvh:new MeshBVH(g),enabled:true};colliders.push(collider);return collider;}
 function place(local:P):P{
  const [lx,y,lz]=local,x=lx-720,z=lz-1440;
  for(const r of [0,2,4,6,8])for(let i=0;i<(r?12:1);i++){
   const xx=x+Math.cos(i*Math.PI/6)*r,zz=z+Math.sin(i*Math.PI/6)*r,yy=ground(xx,zz,y+12);
   if(yy!==null&&Math.abs(yy-y)<12&&clear(new THREE.Vector3(xx,yy+.12,zz)))return [xx,yy,zz];
  }
  // Never silently drop a required objective; fail authoring checks explicitly.
  throw new Error(`No safe Orleans chapter standing point at ${local.join(',')}`);
 }
 for(const a of ORLEANS_CAMPAIGN_ACTIONS){
  const key=a.at.join(','),p=points.get(key)??place(a.at);points.set(key,p);points.set(a.id,p);
  markers.push({id:a.id,type:'interact',label:`${a.chapter} · ${a.label[0]}`,p:[p[0],p[1]+.9,p[2]],radius:2.8});
  if(a.kind==='choice'||a.id===C.test||a.id===C.locked)continue;
  const group=new THREE.Group();group.position.set(...p);group.name=a.id;root.add(group);pieces.set(a.id,group);
  if(a.kind==='fight'){for(const x of [-2,2])box(group,[x,.6,1.7],[1.1,1.2,.7],0x9b947f);continue;}
  box(group,[.9,1.2,.7],[.08,2.4,.08],0x66513c);
  // Team silhouettes are different even without hue: notch, bars, and ring.
  if(a.id===C.builder){for(const y of [1.45,1.8])box(group,[1.25,y,.7],[.65,.12,.05],0xe7d4a5);}
  else if(a.id===C.archer){const g=new THREE.TorusGeometry(.28,.07,6,16);geo.add(g);const m=new THREE.Mesh(g,material(0xe7d4a5));m.position.set(1.25,1.75,.7);group.add(m);}
  else{const shape=new THREE.Shape();shape.moveTo(0,0);shape.lineTo(.8,0);shape.lineTo(.53,-.25);shape.lineTo(.8,-.5);shape.lineTo(0,-.5);shape.closePath();const g=new THREE.ShapeGeometry(shape);geo.add(g);const m=new THREE.Mesh(g,material(0xd2b87d));m.material.side=THREE.DoubleSide;m.position.set(.94,2,.7);group.add(m);}
 }
 const at=(id:string)=>points.get(id)!;
 const signal=pieces.get(C.relay)!;
 const screenSite=pieces.get(C.screen)!,screen=box(screenSite,[0,1.4,2],[4,2.8,.2],0xa08b63);screen.userData.target=C.screen;targets.push(screen);
 root.updateMatrixWorld(true);
 const screenGeometry=screen.geometry.clone().applyMatrix4(screen.matrixWorld);geo.add(screenGeometry);
 const screenCollider:Collider={name:'OrleansSignalScreen',bvh:new MeshBVH(screenGeometry),enabled:false};colliders.push(screenCollider);
 screenCollider.enabled=false;
 // Physical short observation ramp, held until the crew has finished its work.
 const ramp=new THREE.Group();root.add(ramp);ramp.position.set(...at(C.scout));
 const rampMesh=box(ramp,[0,.35,3],[3,.2,5.5]);rampMesh.rotation.x=-.08;
 root.updateMatrixWorld(true);const rampGeometry=rampMesh.geometry.clone().applyMatrix4(rampMesh.matrixWorld);geo.add(rampGeometry);
 const rampCollider:Collider={name:'OrleansObservationRamp',enabled:false,bvh:new MeshBVH(rampGeometry)};colliders.push(rampCollider);
 const model=new THREE.Group();model.position.set(...at(C.model));root.add(model);
 box(model,[0,.8,.8],[2.6,.15,1.8]);for(const x of [-1,1])box(model,[x,.4,.8],[.12,.8,1.6]);
 for(const [i,z]of[-.2,.2,.6,1,1.4].entries())box(model,[-.7+i*.3,1,z],[.3,.2,.3],i===2?0x416e85:0xb5a17d);
 const beam=box(model,[0,1.3,.8],[2.4,.12,.18]);
 const teamAt=[at(C.agree),at(C.model),at(C.screen)];
 const actors=createSettlementNpcs(teamAt.map((p,i)=>({id:`orleans_chapter_team_${i}`,role:([['玛戈 · 舟手','Margot · Boat crew'],['马丁 · 工兵','Martin · Engineers'],['弩手班长','Archer leader']] as [string,string][])[i],region:'britain' as const,worldRegion:'orleans' as const,position:[p[0]+1.6,p[1],p[2]-1.4] as P,appearance:{coat:[0x517487,0x89714d,0x656e47][i]},lines:[]})));
 root.add(actors.group);
 const planks=new THREE.Group();planks.position.set(...at(C.model));root.add(planks);
 for(let i=0;i<8;i++)box(planks,[2.5,.14,i*.5],[2.2,.18,.42]);
 const boat=new THREE.Group();boat.position.set(...at(C.agree));root.add(boat);box(boat,[0,.2,0],[2.3,.4,4.8]);for(const x of [-1.1,1.1])box(boat,[x,.65,0],[.13,.8,4.8]);
 const cover=new THREE.Group();root.add(cover);cover.position.set(...at(C.trial));
 const coverCollision=fixed(cover,[2,1.1,0],[.35,2.2,5.4],0x8f7757);
 const ferry=new THREE.Group();ferry.position.set(...at(C.trial));root.add(ferry);
 const ferryCollision=fixed(ferry,[-2,.12,0],[3,.24,6],0x8f7757);
 cover.visible=coverCollision.enabled=false;ferry.visible=ferryCollision.enabled=false;
 ramp.visible=false;screen.visible=false;planks.visible=false;boat.visible=false;
 let disposed=false,clock=0;
 return{root,markers,colliders,targets,
  apply(d:ReadonlySet<string>,progress:(flag:string)=>number){
   signal.visible=d.has(C.relay);ramp.visible=d.has(C.scout);ramp.scale.y=Math.max(.05,progress(C.ramp));rampCollider.enabled=d.has(C.ramp);
   screen.visible=d.has(C.agree);screen.position.y=d.has(C.screen)?1.4:4.4;screenCollider.enabled=d.has(C.screen);
   planks.scale.z=Math.max(.02,progress(C.planks));planks.visible=d.has(C.agree);
   const p=at(C.agree);boat.position.set(p[0]-6*(1-progress(C.moored)),p[1]-.2,p[2]+5);boat.visible=d.has(C.planks);
   beam.rotation.y=d.has(C.ferry)?Math.PI/2:0;
   cover.visible=coverCollision.enabled=d.has(C.assembled)&&d.has(C.bridge);
   ferry.visible=ferryCollision.enabled=d.has(C.assembled)&&d.has(C.ferry);
   const end=at(C.model);
   for(let i=0;i<3;i++){const start=teamAt[i],t=i===0?progress(C.moored):i===1?progress(C.planks):progress(C.shifted);
    const x=THREE.MathUtils.lerp(start[0]+1.6,end[0]+2+i,t),z=THREE.MathUtils.lerp(start[2]-1.4,end[2]+i,t),y=ground(x,z,Math.max(start[1],end[1])+3);
    if(y!==null)actors.pose(`orleans_chapter_team_${i}`,[x,y,z],Math.PI/2);
   }
  },
  update(dt:number,player:THREE.Vector3){if(disposed)return;clock+=Math.max(0,Math.min(dt,.1));root.visible=Math.hypot(player.x+720,player.z+1440)<650;signal.rotation.y=Math.sin(clock*2)*.1;actors.update(dt,player);},
  dispose(){if(disposed)return;disposed=true;colliders.forEach(c=>c.enabled=false);actors.dispose();geo.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());root.removeFromParent();},
 };
}

import * as THREE from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import type {Marker} from '../core/types';
import type {Collider} from '../player/player';
import {qinToWorld} from '../map/qinPlan';
import {QIN_CAMPAIGN as Q,QIN_CHAPTER_ACTIONS,qinTallyBorrowed} from '../story/qinCampaign';
import {createSettlementNpcs} from '../settlements/npcs';
type P=[number,number,number];
export function createQinCampaignScene(ground:(x:number,z:number,y:number)=>number|null,clear:(p:THREE.Vector3)=>boolean){
 const root=new THREE.Group();root.name='QinShieldFormationAndTally';const markers:Marker[]=[],targets:THREE.Mesh[]=[],colliders:Collider[]=[];
 const geometries=new Set<THREE.BufferGeometry>(),materials=new Map<number,THREE.MeshStandardMaterial>();
 const world=(p:P):P=>{const [x,z]=qinToWorld(p[0],p[2]);return[x,p[1],z];};
 function box(parent:THREE.Object3D,p:P,s:P,color:number){const g=new THREE.BoxGeometry(...s);geometries.add(g);let m=materials.get(color);if(!m){m=new THREE.MeshStandardMaterial({color,roughness:.9});materials.set(color,m);}const mesh=new THREE.Mesh(g,m);mesh.position.set(...p);parent.add(mesh);return mesh;}
 const cache=new Map<string,P>();
 for(const a of QIN_CHAPTER_ACTIONS){const key=a.local.join(',');let p=cache.get(key);if(!p){const [x,y,z]=world(a.local);outer:for(const r of [0,1.5,3,4.5])for(let i=0;i<(r?12:1);i++){
   const xx=x+r*Math.cos(i*Math.PI/6),zz=z+r*Math.sin(i*Math.PI/6),floor=ground(xx,zz,y+1.5);
   if(floor!==null&&Math.abs(floor-y)<1.5&&clear(new THREE.Vector3(xx,floor+.1,zz))){p=[xx,floor,zz];break outer;}
  }if(!p)throw new Error(`No Qin chapter standing point ${key}`);cache.set(key,p);}
  markers.push({id:a.id,type:'interact',p:[p[0],p[1]+.9,p[2]],label:`${a.chapter} · ${a.label[0]}`,radius:2.7});
 }
 const at=(id:string)=>{const p=markers.find(m=>m.id===id)!.p;return[p[0],p[1]-.9,p[2]] as P;};
 const shieldGroups=[world([103,46,-107]),world([35,10,-194])].map((p,index)=>{
  const group=new THREE.Group();group.position.set(...p);group.name=index?'QinTravelShields':'QinWorkshopShields';root.add(group);group.visible=false;
  for(let i=0;i<3;i++){box(group,[i*.85,1,0],[.55,1.5,.5],0x817e65);box(group,[i*.85,1.93,0],[.38,.45,.38],0x817e65);box(group,[i*.85,1,.35],[.77,1.65,.16],0x926e43);}
  root.updateMatrixWorld(true);const g=new THREE.BoxGeometry(2.6,2.3,.8).translate(.85,1.15,.12).applyMatrix4(group.matrixWorld);geometries.add(g);const c:Collider={name:`QinChapterShields${index}`,enabled:false,bvh:new MeshBVH(g)};colliders.push(c);return{group,c};
 });
 const latchAt=at(Q.road),latch=box(root,[latchAt[0]+1.2,latchAt[1]+1,latchAt[2]],[.35,.35,.3],0xc2a462);latch.userData.target=Q.road;targets.push(latch);
 const actors=createSettlementNpcs([{id:'qin_chapter_linhe',region:'alpha',worldRegion:'qin',role:['蔺禾 · 持符工匠','Lin He · Tally holder'],position:at(Q.loan),appearance:{coat:0x9c7659},lines:[]}]);root.add(actors.group);
 const tally=box(root,[0,0,0],[.1,.35,.09],0xc5a663);
 const crew=new THREE.Group();crew.name='QinReverseProcessionBeamCrew';root.add(crew);
 box(crew,[0,1.4,0],[1,.3,4.8],0x8e6c48);const carriers:THREE.Group[]=[];for(const z of [-1.6,1.6])for(const x of [-.7,.7]){const c=new THREE.Group();c.name=`QinBeamCarrier_${carriers.length}`;c.position.set(x,0,z);crew.add(c);carriers.push(c);box(c,[0,.5,0],[.4,1,.4],0x89876d);box(c,[0,1.15,0],[.3,.3,.3],0x89876d);}
 const route:P[]=[world([-17,28,-156]),world([-17,19,-190]),world([31,10,-190])];
 function along(t:number){const lengths=route.slice(1).map((b,i)=>new THREE.Vector3(...b).distanceTo(new THREE.Vector3(...route[i])));let n=t*lengths.reduce((a,b)=>a+b,0);for(let i=0;i<lengths.length;i++){if(n<=lengths[i]||i===lengths.length-1)return new THREE.Vector3(...route[i]).lerp(new THREE.Vector3(...route[i+1]),Math.min(1,n/lengths[i]));n-=lengths[i];}return new THREE.Vector3(...route[0]);}
 crew.visible=false;tally.visible=false;
 const kiln=box(root,world([155,46.25,-120]),[1.5,.2,1.5],0xe4a25b);
 return{root,markers,targets,colliders,
  apply(d:ReadonlySet<string>,progress:number){
   shieldGroups.forEach((g,i)=>g.group.visible=g.c.enabled=d.has(i?Q.take:Q.guard));
   kiln.visible=!d.has(Q.take);latch.visible=!d.has(Q.road);
   const p=along(progress);p.y=ground(p.x,p.z,p.y+3)??p.y;crew.position.copy(p);crew.visible=d.has(Q.halt);
   for(const c of carriers){const y=ground(p.x+c.position.x,p.z+c.position.z,p.y+3);if(y!==null)c.position.y=y-p.y;}
   const linheY=ground(p.x+1.3,p.z,p.y+3)??p.y;actors.pose('qin_chapter_linhe',[p.x+1.3,linheY,p.z],0);
   tally.position.set(p.x+1.5,linheY+1.1,p.z);tally.visible=qinTallyBorrowed(d);
  },
  update(dt:number,viewer:THREE.Vector3){root.visible=Math.hypot(viewer.x+720,viewer.z+720)<550;actors.update(dt,viewer);},
  dispose(){colliders.forEach(c=>c.enabled=false);actors.dispose();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());root.removeFromParent();},
 };
}

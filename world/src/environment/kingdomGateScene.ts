import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { SiteArt } from '../story/campaignSites';
import type { Collider } from '../player/player';
import type { Marker } from '../core/types';
import { KINGDOM_GATE as G, gatePoint, GATE_ESCORT_PATH, isKingdomGateOpen } from '../story/kingdomGate';
import {createSettlementNpcs} from '../settlements/npcs';
import {residentWalkRig} from '../settlements/residentWalk';
export function gateEscortPosition(fraction:number){
 const t=THREE.MathUtils.clamp(fraction,0,1)*(GATE_ESCORT_PATH.length-1),i=Math.min(Math.floor(t),GATE_ESCORT_PATH.length-2);
 return new THREE.Vector3(...GATE_ESCORT_PATH[i]).lerp(new THREE.Vector3(...GATE_ESCORT_PATH[i+1]),t-i);
}
export function createKingdomGateScene(terrain:(x:number,z:number)=>number=()=>34){
 const art=new SiteArt();
 // Give the return road an actual paved walking spine, not waist-high meadow
 // through the escort actors and gate mechanisms.
 const roadHeight=(x:number,z:number)=>Math.max(34,terrain(x,z))+.08;
 for(let out=-10;out<14;out++)for(let side=-2;side<2;side++){
  const vertices:number[]=[];
  for(const [s,o]of[[side,out],[side+1,out],[side+1,out+1],[side,out+1]]){const p=gatePoint(s,o);p[1]=roadHeight(p[0],p[2]);vertices.push(...p);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex([0,2,1,0,3,2]);g.computeVertexNormals();
  art.add(g,(out+side)%3?'#b4a68d':'#aea087',[0,0,0],[1,1,1],true,'ground');g.dispose();
 }
 const marker=(id:string,label:string,side:number,out:number):Marker=>({id,type:'interact',label,p:gatePoint(side,out,.9),radius:2.1});
 const markers=[marker(G.entry,'城门告示 · 打开归路',0,11),marker(G.latch,'金色旧锁 · 拆闩或射断',-4,5),marker(G.winch,'城门绞盘 · 按住交互',4,5),marker(G.service,'归人补给点',0,-8)];
 // Small tactical additions remain outside the old masonry; the gate uses the actual arch.
 for(const side of[-3,3]){art.box(gatePoint(side,10,.45),[2.5,.9,.65],'#8d8375',true,'body',[0,Math.PI/4,0]);}
 art.box(gatePoint(4,5,.6),[1.1,1.2,.8],'#695244');
 art.ring(gatePoint(4,5,1.1),.45,.07,'#b49a64');
 art.beam(gatePoint(-4,5,1.7),gatePoint(4,5,1.7),.045,'#b49a64');
 art.box(gatePoint(0,11,1.2),[1.8,.8,.12],'#dbc8a2',false,'body',[0,Math.PI/4,0]);
 for(const side of[-.7,.7])art.box(gatePoint(side,11,.5),[.1,1,.1],'#695244');
 art.box(gatePoint(2,-8,.55),[1.4,1.1,.8],'#695244');
 art.lantern(...gatePoint(2,-8,1.4));
 art.finish('britain');const root=art.root;root.name='KingdomGate_ReturnRoad';
 const gate=new THREE.Mesh(new THREE.BoxGeometry(11,6,.55),new THREE.MeshStandardMaterial({color:'#584838',roughness:.9}));
 gate.position.fromArray(gatePoint(0,0,3));gate.rotation.y=Math.PI/4;root.add(gate);gate.updateMatrixWorld(true);
 const collision=gate.geometry.clone().applyMatrix4(gate.matrixWorld);
 const collider:Collider={name:'COL_KingdomReturnGate',bvh:new MeshBVH(collision),enabled:true};
 const latch=new THREE.Mesh(new THREE.BoxGeometry(.55,.7,.3),new THREE.MeshStandardMaterial({color:'#efbf54',emissive:'#886020',emissiveIntensity:.4}));
 latch.position.fromArray(gatePoint(-4,5,1.4));latch.userData.target=G.latch;root.add(latch);
 const people=new THREE.Group();people.rotation.y=-Math.PI*3/4;root.add(people);
 const residents=createSettlementNpcs([
  {id:'britain_returning_carpenter',region:'britain',role:['归城木匠','Returning Carpenter'],position:[-.7,0,0],lines:[['家就在城门另一边。','Home is on the other side of the gate.']]},
  {id:'britain_returning_weaver',region:'britain',role:['归城织工','Returning Weaver'],position:[.7,0,0],lines:[['等大家一起走。','We go together.']]},
 ]);
 people.add(residents.group);
 const walkers=residents.group.children.map(residentWalkRig);
 const lamp=new THREE.Mesh(new THREE.SphereGeometry(.16,8,6),new THREE.MeshBasicMaterial({color:'#a6e5ab'}));lamp.position.fromArray(gatePoint(2,-8,1.4));root.add(lamp);
 let disposed=false;const localViewer=new THREE.Vector3();
 function apply(done:ReadonlySet<string>,fraction=0,dt=0,viewer?:THREE.Vector3){
  if(disposed)return;
  gate.visible=!isKingdomGateOpen(done);collider.enabled=gate.visible;latch.visible=!done.has(G.unlocked)&&!done.has(G.open);
  people.position.copy(gateEscortPosition(done.has(G.rescued)?1:fraction));lamp.visible=done.has(G.rescued);
  if(viewer)residents.update(dt,people.worldToLocal(localViewer.copy(viewer)));
  const moving=fraction>0&&fraction<1&&!done.has(G.rescued);walkers.forEach((walk,i)=>{const actor=residents.group.children[i],p=people.localToWorld(new THREE.Vector3(actor.position.x,0,0));walk.update(fraction*16*7+i*.65,moving,roadHeight(p.x,p.z)-people.position.y);});
 }
 return {root,markers,latch,collider,collisionGeometries:art.solids,people,apply,
  walkway:{region:'britain' as const,points:[gatePoint(0,14),gatePoint(0,-10)],length:24},
  dispose(){if(disposed)return;disposed=true;collider.enabled=false;residents.dispose();root.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});for(const g of art.solids)g.dispose();collision.dispose();root.removeFromParent();root.clear();},
 };
}

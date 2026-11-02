import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { SiteArt } from './campaignSites';
import type { Collider } from './player';
import type { Marker } from './types';
import { KINGDOM_GATE as G, gatePoint, GATE_ESCORT_PATH, isKingdomGateOpen } from './kingdomGate';
export function gateEscortPosition(fraction:number){
 const t=THREE.MathUtils.clamp(fraction,0,1)*(GATE_ESCORT_PATH.length-1),i=Math.min(Math.floor(t),GATE_ESCORT_PATH.length-2);
 return new THREE.Vector3(...GATE_ESCORT_PATH[i]).lerp(new THREE.Vector3(...GATE_ESCORT_PATH[i+1]),t-i);
}
export function createKingdomGateScene(){
 const art=new SiteArt();
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
 const walkJoints:{joint:THREE.Group;side:number;arm:boolean}[]=[];
 // Blockout residents: individual heads and coats, no additional AI companion.
 for(const side of[-.7,.7]){
  const person=new THREE.Group();person.position.x=side;
  const coat=new THREE.Mesh(new THREE.CylinderGeometry(.22,.33,1.1,6),new THREE.MeshStandardMaterial({color:side<0?'#8b7861':'#687f83'}));coat.position.y=.8;person.add(coat);
  for(const side of[-1,1]){
   for(const arm of[false,true]){const joint=new THREE.Group();joint.position.set(side*(arm?.3:.13),arm?1.2:.5,0);person.add(joint);const limb=new THREE.Mesh(new THREE.CylinderGeometry(arm?.065:.08,arm?.06:.08,arm?.55:.5,6),new THREE.MeshStandardMaterial({color:arm?'#a7957c':'#403a35'}));limb.position.y=arm?-.23:-.25;joint.add(limb);walkJoints.push({joint,side,arm});}
  }
  const head=new THREE.Mesh(new THREE.SphereGeometry(.2,8,6),new THREE.MeshStandardMaterial({color:'#d5b89c'}));head.position.y=1.6;person.add(head);people.add(person);
 }
 const lamp=new THREE.Mesh(new THREE.SphereGeometry(.16,8,6),new THREE.MeshBasicMaterial({color:'#a6e5ab'}));lamp.position.fromArray(gatePoint(2,-8,1.4));root.add(lamp);
 function apply(done:ReadonlySet<string>,fraction=0){
  gate.visible=!isKingdomGateOpen(done);collider.enabled=gate.visible;latch.visible=!done.has(G.unlocked)&&!done.has(G.open);
  const moving=fraction>0&&fraction<1&&!done.has(G.rescued);for(const {joint,side,arm}of walkJoints)joint.rotation.x=moving?Math.sin(fraction*16*7+side*Math.PI/2)*(arm?-.28:.34):0;
  people.position.copy(gateEscortPosition(done.has(G.rescued)?1:fraction));lamp.visible=done.has(G.rescued);
 }
 return {root,markers,latch,collider,collisionGeometries:art.solids,people,apply,
  dispose(){root.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});for(const g of art.solids)g.dispose();collision.dispose();root.removeFromParent();},
 };
}

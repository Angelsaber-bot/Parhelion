import * as THREE from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {SiteArt} from './campaignSites';
import {flagshipPoint as P} from './shipInteriorCut';
import type {Collider} from './player';
import type {Marker} from './types';
/** Built into the carved ship hull, with two dry, continuous stair-ramp exits.
 * The room has actual ceiling, ribs, furnishings and collision, not a teleport. */
export function createFlagshipInterior(){
 const art=new SiteArt(),yaw=.15,rot:[number,number,number]=[0,yaw,0];
 const box=(u:number,v:number,y:number,w:number,h:number,d:number,color:string,solid=false)=>art.box(P(u,v,y),[w,h,d],color,solid,'body',rot);
 box(2,0,3.15,10.6,.5,30,'#65513c',true);
 // Sealed fore/aft bulkheads; the escape ramps are inside their footprint.
 for(const u of[-13.1,17.1])box(u,0,5,10.5,3.3,.28,'#514537',true);
 for(const v of[-5.15,5.15])box(2,v,5,.22,3.2,30,'#514537',true);
 for(let u=-12;u<17;u+=1.1)box(u,0,3.412,10.3,.025,.045,'#423a32');
 // Rounded beams and bolted ribs communicate a ship interior instead of another kiosk.
 for(const u of[-11,-5,1,7,13,16]){
  for(const v of[-4.9,4.9])box(u,v,5,.28,3.2,.26,'#aa8b60');
  box(u,0,6.5,10.2,.25,.32,'#aa8b60');
  for(const v of[-4.7,4.7])art.ring(P(u,v,5.5),.08,.025,'#b6a172','metal',rot);
 }
 // Ramp top at bow side, bottom at stern side. Two sides remain independent.
 for(const v of[-3.75,3.75]){
  const a=P(-8,v,7),b=P(4,v,3.45),bottom=2.9,side=1.35,c=Math.cos(yaw),s=-Math.sin(yaw);
  const p=new THREE.Vector3(...a),q=new THREE.Vector3(...b),verts=[p.x-c*side,p.y,p.z-s*side,p.x+c*side,p.y,p.z+s*side,q.x+c*side,q.y,q.z+s*side,q.x-c*side,q.y,q.z-s*side,p.x-c*side,bottom,p.z-s*side,p.x+c*side,bottom,p.z+s*side,q.x+c*side,bottom,q.z+s*side,q.x-c*side,bottom,q.z-s*side];
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));g.setIndex([0,2,1,0,3,2,0,1,5,0,5,4,1,2,6,1,6,5,2,3,7,2,7,6,3,0,4,3,4,7,4,5,6,4,6,7]);g.computeVertexNormals();art.add(g,'#9d8058',[0,0,0],[1,1,1],true);g.dispose();
  // Coamings keep a sprinting player from accidentally falling sideways into the well.
  for(const side of[-1,1]){const vv=v+side*1.48;art.beam(P(-7.8,vv,7.75),P(3.8,vv,4.2),.1,'#b5a178',true);for(const u of[-7.8,-4,0,3.8])box(u,vv,7-(u+8)*3.55/12+.35,.08,.8,.08,'#7b684e',true);}
  for(let u=-7.6;u<=3.8;u+=.65)box(u,v,7-(u+8)*3.55/12+.012,2.6,.035,.12,'#524235');
 }
 // Chart room at the aft end, brass-edged drawers, instrument rack, restrained light.
 box(11,-1.8,4.1,3,.2,2.2,'#9d8058',true);for(const u of[10.2,11.8])for(const v of[-2.6,-1])box(u,v,3.7,.16,.6,.16,'#554435',true);
 for(const u of[10.2,10.7,11.2,11.7]){art.box(P(u,-1.8,4.22),[.42,.018,1.6],'#d7c7a1',false,'body',rot);art.beam(P(u,-2.35,4.24),P(u+.1,-1.3,4.24),.012,'#586b70');}
 art.ring(P(10.8,-1.8,4.26),.23,.025,'#b8a36e','metal',[Math.PI/2,yaw,0]);
 for(const u of[-10,6,15])for(const v of[-4.7,4.7])art.lantern(...P(u,v,5.7));
 for(const u of[7,14])for(const v of[3.2,4.4]){box(u,v,3.8,.9,.75,1.4,'#755e45',true);for(const dy of[-.2,.2])box(u,v,3.8+dy,.94,.06,1.44,'#3d4c51');}
 box(-10,1.8,4.55,.7,1.1,.28,'#3f5053',true);box(-10,1.8,5.15,.78,.1,.34,'#ad9968');for(const v of[1.58,2.02])box(-10.17,v,4.6,.035,.55,.035,'#b39d6c');
 art.finish('blacksail');art.root.name='Flagship_RecordsHold';
 const colliders:Collider[]=art.solids.map((g,i)=>({name:`COL_FlagshipHold_${i}`,bvh:new MeshBVH(g),enabled:true}));
 const markers:Marker[]=[{id:'adventure_harbor_alarm',type:'interact',label:'船腹警报断路器',p:P(-10,0,4.3),radius:2.1}];
 const alarm=new THREE.Mesh(new THREE.SphereGeometry(.18,10,8),new THREE.MeshBasicMaterial({color:'#b64c37'}));alarm.position.fromArray(P(-10.2,1.8,4.95));art.root.add(alarm);
 const lever=new THREE.Mesh(new THREE.BoxGeometry(.08,.42,.08),new THREE.MeshStandardMaterial({color:'#bc9c5e',metalness:.5,roughness:.45}));lever.position.fromArray(P(-10.25,1.8,4.45));art.root.add(lever);
 return{root:art.root,colliders,markers,recordStand:P(10,.7,3.4),rampRoutes:[-3.75,3.75].map(v=>[[-12,v,7],[-8,v,7],[4,v,3.45],[10,0,3.4]].map(p=>P(...p as[number,number,number]))),
  apply(done:ReadonlySet<string>,time=0){const quiet=done.has('adventure_harbor_alarm_disabled')||done.has('adventure_harbor_alarm_cleared');lever.rotation.x=quiet?-.65:.65;(alarm.material as THREE.MeshBasicMaterial).color.set(quiet?'#6f9276':'#b64c37');alarm.visible=quiet||!done.has('adventure_harbor_records')||Math.sin(time*5)>0;},
  dispose(){const materials=new Set<THREE.Material>();art.root.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});for(const m of materials)m.dispose();for(const g of art.solids)g.dispose();art.root.removeFromParent();},
 };
}

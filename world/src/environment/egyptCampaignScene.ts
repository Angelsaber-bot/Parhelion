import * as THREE from 'three';
import type {Marker} from '../core/types';
import {egyptToWorld} from '../map/egyptPlan';
import {EGYPT_CAMPAIGN as E,EGYPT_CHAPTER_ACTIONS} from '../story/egyptCampaign';
import {selectedEgyptWaterPlan} from '../story/egyptWaterPlan';
import {createSettlementNpcs} from '../settlements/npcs';
import {createFloodTrial,floodStage} from './egyptFloodTrial';
type P=[number,number,number];
export function createEgyptCampaignScene(ground:(x:number,z:number,ceiling:number)=>number|null,clear:(p:THREE.Vector3)=>boolean){
 const root=new THREE.Group();root.name='EgyptChapterFieldwork';const markers:Marker[]=[],targets:THREE.Mesh[]=[];
 const geo=new Set<THREE.BufferGeometry>(),mat=new Map<number,THREE.MeshStandardMaterial>();
 function box(p:P,s:P,color:number){const g=new THREE.BoxGeometry(...s);geo.add(g);let m=mat.get(color);if(!m){m=new THREE.MeshStandardMaterial({color,roughness:.78});mat.set(color,m);}const mesh=new THREE.Mesh(g,m);mesh.position.set(...p);root.add(mesh);return mesh;}
 function place(local:P):P{const [x,z]=egyptToWorld(local[0],local[2]);for(const r of [0,1.5,3,4.5,6])for(let i=0;i<(r?12:1);i++){
  const xx=x+r*Math.cos(i*Math.PI/6),zz=z+r*Math.sin(i*Math.PI/6),y=ground(xx,zz,local[1]+1.8);
  if(y!==null&&Math.abs(y-local[1])<4&&clear(new THREE.Vector3(xx,y+.1,zz)))return [xx,y,zz];
 }throw new Error(`No Egypt chapter standing point: ${local.join(',')}`);}
 for(const a of EGYPT_CHAPTER_ACTIONS){const p=place(a.local);markers.push({id:a.id,type:'interact',label:`${a.chapter} · ${a.label[0]}`,p:[p[0],p[1]+.9,p[2]],radius:2.8});}
 const at=(id:string)=>{const p=markers.find(m=>m.id===id)!.p;return [p[0],p[1]-.9,p[2]] as P;};
 const p=at(E.armor),plate=box([p[0]-1.2,p[1]+1.2,p[2]-1],[1.4,1.6,.5],0x756653);plate.rotation.z=.2;plate.userData.target=E.armor;targets.push(plate);
 const b=at(E.brake),brake=box([b[0]-1.2,b[1]+1.3,b[2]],[.3,.35,.4],0xccaa53);brake.userData.target=E.brake;targets.push(brake);
 // E06 试洪: a working sluice, a flowing channel that backs up at the plate, and the bypass basin.
 const flood=createFloodTrial({gate:at(E.trial),outlet:at(E.armor),basin:at(E.bypass)},ground);root.add(flood.root);
 const h=at(E.relocated),boat=at(E.moored),field=at(E.irrigation);
 const actors=createSettlementNpcs([
  {id:'egypt_chapter_haru',role:['哈鲁 · 船匠','Haru · Boatwright'],region:'alpha',worldRegion:'egypt',position:h,appearance:{coat:0xc5ab7e},lines:[]},
  {id:'egypt_chapter_nakht',role:['娜赫','Nakht'],region:'alpha',worldRegion:'egypt',position:[h[0]+2,h[1],h[2]+2],appearance:{coat:0xdac69c},lines:[]},
 ]);root.add(actors.group);
 const bench=box([h[0]+2,h[1]+.75,h[2]-1],[1.8,.15,.8],0x806343);
 const supper=box([h[0]+2,h[1]+.9,h[2]+2],[1.6,.2,1],0xc6af87);
 return{root,markers,targets,
  apply(d:ReadonlySet<string>){
   plate.visible=d.has(E.trial)&&![E.armor,E.side,E.steady].some(f=>d.has(f));brake.visible=!d.has(E.brake);
   flood.apply(floodStage(d,E),d.has(E.drained)?'draining':d.has(E.bypass)?'tested':'dry');
   const target=d.has(E.relocated)?selectedEgyptWaterPlan(d)?.startsWith('east')?field:boat:h;
   // Workstations are persistent destinations, not a second companion follower.
   actors.pose('egypt_chapter_haru',[target[0]+1.5,target[1],target[2]+1.5],Math.PI);
   bench.position.set(target[0]+2,target[1]+.75,target[2]-1);supper.visible=d.has(E.meal);
  },
  update(dt:number,viewer:THREE.Vector3){root.visible=Math.hypot(viewer.x,viewer.z+1440)<600;actors.update(dt,viewer);if(root.visible)flood.update(dt);},
  dispose(){flood.dispose();actors.dispose();geo.forEach(g=>g.dispose());mat.forEach(m=>m.dispose());root.removeFromParent();},
 };
}

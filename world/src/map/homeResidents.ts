import * as THREE from 'three';
import {CompanionNavigation} from '../companions/companionNavigation';
import {residentWalkRig} from '../settlements/residentWalk';
import type {Collider} from '../player/player';
import {homeWorld} from './homePlan';
import type {RoutePoint} from './worldPlan';

export const HOME_RESIDENT_ROUTES:readonly {id:string;path:readonly RoutePoint[]}[]=[
 {id:'home_gardener',path:[[-104,16.12,110],[-110,16.12,118],[-100,16.12,123],[-90,16.12,112]]},
 {id:'home_dock_keeper',path:[[234,6.12,125],[245,6.12,125],[245,6.12,118],[234,6.12,118]]},
];
type Host={group:THREE.Group;pose(id:string,p:[number,number,number],yaw:number):boolean;};
/** Residents use the same ground/body checks as companions, and stop to speak or let players pass. */
export function createHomeResidentLife(host:Host,colliders:Collider[]){
 const walkers=HOME_RESIDENT_ROUTES.map(r=>{const root=host.group.getObjectByName(`Resident_${r.id}`)!;return{...r,root,rig:residentWalkRig(root),nav:new CompanionNavigation(colliders),index:0,phase:0,y:root.position.y};});
 let disposed=false;
 return{update(dt:number,p:THREE.Vector3,speaking:string|null,active:boolean,ready:boolean){
  if(disposed||!active||!ready)return;dt=Number.isFinite(dt)?Math.min(.05,Math.max(0,dt)):0;
  for(const w of walkers){if(p.distanceTo(w.root.position)>100)continue;
   const pause=speaking===w.id||p.distanceTo(w.root.position)<3;
   const goal=new THREE.Vector3(...homeWorld(w.path[(w.index+1)%w.path.length]));
   if(w.root.position.distanceTo(goal)<.3)w.index=(w.index+1)%w.path.length;
   const speed=pause?0:w.nav.step(w.root,goal,dt,.8);w.phase+=speed*dt*5;
   host.pose(w.id,w.root.position.toArray(),w.root.rotation.y);w.rig.update(w.phase,speed>.04,w.root.position.y-w.y);
  }
 },dispose(){disposed=true;}};
}

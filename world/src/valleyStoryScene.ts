/** Authored Valley residence signal and optional manual maintenance entrance.
 * Six small material batches, no light, particles, timers or per-frame allocations.
 */
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { mergeParts } from './settlements/merge';
import type { SettlementPlacement } from './settlements/types';
import type { Collider } from './player';
import type { Marker } from './types';
export interface ValleySceneState { powered:boolean; shortcutOpen:boolean; resolved:boolean; discovered?:boolean; }
export const VALLEY_STORY_LOCAL = Object.freeze({ gate:[6.7,0,14] as const, panel:[8.8,1.2,13.6] as const, archivistReturn:[-3,.02,8] as const });
export function createValleyStoryScene(placement:SettlementPlacement){
 const [ox,oy,oz]=placement.position;
 const group=new THREE.Group(); group.name='ValleyStory_ResidenceSignal';
 const metal=new THREE.MeshStandardMaterial({color:0x344c69,roughness:.75,metalness:.15});
 const trim=new THREE.MeshStandardMaterial({color:0xb89c67,roughness:.5,metalness:.35});
 const glow=new THREE.MeshStandardMaterial({color:0x486568,emissive:0x8ce7d4,emissiveIntensity:0,roughness:.7});
 const panelMaterial=new THREE.MeshStandardMaterial({color:0x56666b,emissive:0x64dac6,emissiveIntensity:0,roughness:.65});
 const darkParts:THREE.BufferGeometry[]=[],trimParts:THREE.BufferGeometry[]=[],glowParts:THREE.BufferGeometry[]=[],solidParts:THREE.BufferGeometry[]=[];
 const box=(p:number[],s:number[])=>new THREE.BoxGeometry(...s as [number,number,number]).translate(ox+p[0],oy+p[1],oz+p[2]);
 function part(bucket:THREE.BufferGeometry[],p:number[],s:number[],solid=false){const g=box(p,s);bucket.push(g);if(solid)solidParts.push(g.clone());}
 // 3.2m clear opening sits between the original central gate and the existing planter.
 for(const x of [4.95,8.45]){part(darkParts,[x,1.65,14],[.22,3.3,.30],true);part(trimParts,[x,3.37,14],[.34,.12,.42]);part(glowParts,[x,2.45,14.17],[.10,.72,.025]);}
 part(darkParts,[6.7,3.35,14],[3.72,.22,.35],true);
 part(trimParts,[6.7,3.50,14],[3.8,.08,.44]);
 // Three directional inlays lead into the court, not a floodlight or a map-wide glow.
 for(const z of [12.5,10.2,7.9])part(glowParts,[6.7,.025,z],[.55,.022,.18]);
 part(darkParts,[8.8,.5,13.2],[.38,1,.32],true);
 part(trimParts,[8.8,1.03,13.2],[.65,.12,.50]);
 const add=(name:string,parts:THREE.BufferGeometry[],mat:THREE.Material)=>{const g=mergeParts(parts);parts.forEach(p=>p.dispose());const m=new THREE.Mesh(g,mat);m.name=name; m.receiveShadow=true;group.add(m);return m;};
 add('MaintenanceFrame',darkParts,metal);add('MaintenanceBrass',trimParts,trim);add('RestoredPathInlays',glowParts,glow);
 const panel=new THREE.Mesh(box([8.8,1.10,13.2],[.46,.035,.32]),panelMaterial);panel.name='MaintenanceLatchPanel';group.add(panel);
 const bars:THREE.BufferGeometry[]=[];for(const x of [5.25,5.75,6.25,6.75,7.25,7.75,8.15])bars.push(box([x,1.25,14],[.07,2.5,.10]));
 for(const y of [.18,1.35,2.45])bars.push(box([6.7,y,14],[3.3,.09,.14]));
 const gate=add('MaintenanceLiftGate',bars,metal);gate.geometry.translate(0,-oy,0);
 const gateGeometry=box([6.7,1.25,14],[3.3,2.5,.16]);
 const frameGeometry=mergeParts(solidParts);solidParts.forEach(g=>g.dispose());
 const colliders:Collider[]=[{name:'VALLEY_MaintenanceFrame',bvh:new MeshBVH(frameGeometry),enabled:true},{name:'VALLEY_MaintenanceGate',bvh:new MeshBVH(gateGeometry),enabled:true}];
 const markers:Marker[]=[{id:'valley_route_note',type:'interact',label:'检修侧门手动锁扣',p:[ox+8.8,oy+1.2,oz+13.6],radius:2.4}];
 let disposed=false;
 function applyState(state:ValleySceneState){if(disposed)return;colliders[1].enabled=!state.shortcutOpen;gate.scale.y=state.shortcutOpen?.12:1;gate.position.y=oy+(state.shortcutOpen?2.82:0);glow.emissiveIntensity=state.powered?1.5:0;glow.color.setHex(state.powered?0xa5e8d9:0x486568);panelMaterial.emissiveIntensity=state.discovered?.9:state.powered?.35:0;panelMaterial.color.setHex(state.discovered?0x8ce2b0:0x56666b);group.userData.storyResolved=state.resolved;group.updateMatrixWorld(true);}
 applyState({powered:false,shortcutOpen:false,resolved:false});
 return{group,markers,colliders,applyState,archivistInitial:[ox+5.2,oy-.035,oz+16.5] as [number,number,number],archivistReturn:[ox-3,oy+.02,oz+8] as [number,number,number],dispose(){if(disposed)return;disposed=true;colliders.forEach(c=>c.enabled=false);group.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});frameGeometry.dispose();gateGeometry.dispose();[metal,trim,glow,panelMaterial].forEach(m=>m.dispose());group.removeFromParent();group.clear();}};
}

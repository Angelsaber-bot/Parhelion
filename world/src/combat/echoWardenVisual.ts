import * as THREE from 'three';
import type {Enemy} from './combat';
/** Three back-mounted signal vanes identify the new Warden without a new hitbox,
 * light, damage target or mutable native material. Only the authored phase changes
 * their stance/color; paused presentation cannot advance a separate animation clock. */
export function createEchoWardenVisual(actor:THREE.Object3D){
 const chest=actor.getObjectByName('chest');if(!chest)return null;
 const root=new THREE.Group();root.name='EchoWardenSignalVanes';root.userData.visualOnly=true;
 const metal=new THREE.MeshStandardMaterial({name:'EchoWardenVaneMetal',color:0x293e4c,metalness:.7,roughness:.36});
 const inlay=new THREE.MeshStandardMaterial({name:'EchoWardenVaneSignal',color:0x8bd4db,emissive:0x347a83,emissiveIntensity:.22,metalness:.25,roughness:.42});
 const vane=new THREE.BoxGeometry(.105,.43,.075),strip=new THREE.BoxGeometry(.035,.31,.079),pivots:THREE.Group[]=[];
 actor.add(root);actor.updateWorldMatrix(true,true);
 // Native/root-space metres, behind the head/shoulder silhouette rather than
 // extending in front of the authoritative melee contact corridor.
 for(let i=0;i<3;i++){
  const pivot=new THREE.Group();pivot.position.set((i-1)*.22,1.35,-.18);pivot.rotation.z=(1-i)*.32;
  const shell=new THREE.Mesh(vane,metal),signal=new THREE.Mesh(strip,inlay);shell.position.y=signal.position.y=.17;signal.position.z=.004;shell.name=`EchoVane_${i}`;signal.name=`EchoInlay_${i}`;pivot.add(shell,signal);root.add(pivot);pivots.push(pivot);
 }
 chest.attach(root);let disposed=false;
 return {root,update(enemy:Pick<Enemy,'phase'|'mode'|'timer'>){
  if(disposed)return;const broken=enemy.phase===2;
  for(let i=0;i<3;i++)pivots[i].rotation.z=(1-i)*(broken?.62:.32);
  inlay.color.setHex(broken?0xe7b879:0x8bd4db);inlay.emissive.setHex(broken?0x93652d:0x347a83);
  // A fixed bright edge during a tell, not a flashing hazard or new effect clock.
  inlay.emissiveIntensity=enemy.mode==='windup'?.32:.22;
 },dispose(){if(disposed)return;disposed=true;root.removeFromParent();vane.dispose();strip.dispose();metal.dispose();inlay.dispose();}};
}

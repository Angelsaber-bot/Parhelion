/** Presentation-only rotors on sculpted skins (coil, drum, fan, rings). Each
 * spinning group carries `userData.spin` from `Sculpture.spin`; firing kick
 * temporarily speeds it up. Never touches sockets, timing or simulation. */
import type * as THREE from 'three';

export interface SpinSpec {axis:'x'|'y'|'z';speed:number;boost:number}
export function spinSignatureParts(parts:Record<string,THREE.Object3D>,seconds:number,kick=0){
 if(!Number.isFinite(seconds))return;
 for(const part of Object.values(parts)){
  const spin=part.userData.spin as SpinSpec|undefined;if(!spin)continue;
  const last=part.userData.spinTime as number|undefined,dt=last===undefined?0:Math.min(.1,Math.max(0,seconds-last));
  part.userData.spinTime=seconds;
  const angle=((part.userData.spinAngle as number|undefined)??0)+dt*spin.speed*(1+spin.boost*Math.min(1,Math.max(0,kick)));
  part.userData.spinAngle=angle%(Math.PI*2);part.rotation[spin.axis]=part.userData.spinAngle;
 }
}

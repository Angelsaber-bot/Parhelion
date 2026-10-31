import * as THREE from 'three';
import { weaponFinish, type WeaponFinishId } from './weaponFinishes';
export const WEAPON_FINISH_PATTERN_SIZE = 128;
/** Original authored weapon UVs receive restrained lacquer/etched marks. This changes
 * albedo only: no geometry, opacity, emissive gain, metalness or roughness advantage.
 * Five identities are recognizable even in grayscale, without logos or added meshes.
 */
export function weaponFinishPatternInk(id: WeaponFinishId, u: number, v: number): boolean {
  u = ((u % 1) + 1) % 1; v = ((v % 1) + 1) % 1;
  const line = (value: number, center: number, width: number) => Math.abs(value-center) < width;
  if (id === 'signal') { const x=u%.25; return x<.014||(x>.035&&x<.046)||(u>.3&&u<.7&&line(v,.5,.012)); }
  if (id === 'oath') return ((u+v)%.4)<.024||((u-v+2)%.4)<.010;
  if (id === 'tide') { const wave=.045*Math.sin(u*Math.PI*4); return ((v-wave+2)%.25)<.027; }
  if (id === 'frost') return ((u+v)%.5)<.014||((u-v+2)%.5)<.014;
  if (id === 'ember') return ((u-v*.28+2)%.32)<.027||((u-v*.28+2)%.32)>.308;
  return false;
}
export function makeWeaponFinishPattern(id: WeaponFinishId, channel: 'ivory'|'dark' = 'ivory'): THREE.DataTexture {
  const size=WEAPON_FINISH_PATTERN_SIZE,data=new Uint8Array(size*size*4);
  const palette=weaponFinish(id)?.colors;
  const rgb=(hex:string)=>[parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16)];
  const base=rgb(palette?.[channel]??'#ffffff'),accent=rgb(palette?.[channel==='ivory'?'dark':'copper']??'#aaaaaa');
  const ink=base.map((value,index)=>Math.round(value+(accent[index]-value)*(channel==='ivory'?.62:.85)));
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const color=weaponFinishPatternInk(id,(x+.5)/size,(y+.5)/size)?ink:base,index=(y*size+x)*4;
    data[index]=color[0];data[index+1]=color[1];data[index+2]=color[2];data[index+3]=255;
  }
  const texture=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);
  texture.name=`JourneyFinish_${id}_${channel}`;texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;
  return texture;
}

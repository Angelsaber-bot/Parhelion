import * as THREE from 'three';
export type CraftSurface='wood'|'stone'|'plaster'|'cloth'|'slate'|'paper';
const surfaces=new Map<CraftSurface,THREE.DataTexture>();
/** Shared, quiet construction marks. Mipmaps keep the fine grain from sparkling
 * at gameplay distance. The builders and toon renderer keep the same texture. */
export function applyCraftSurface(material:THREE.MeshStandardMaterial,kind:CraftSurface){
 let texture=surfaces.get(kind);
 if(!texture){
  const size=64,data=new Uint8Array(size*size*4),tau=Math.PI*2;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
   const u=x/size,v=y/size,noise=((x*73+y*151+x*y*19)%97)/96;
   let value=246+noise*6;
   if(kind==='wood')value=241+Math.sin(tau*(u*9+.18*Math.sin(v*tau*2)))*7+Math.sin(tau*u*23)*2+noise*4;
   if(kind==='stone')value=243+Math.sin(tau*u*3)*Math.sin(tau*v*4)*5+noise*5;
   if(kind==='cloth')value=246+(x%2?2:-2)+(y%2?2:-2)+noise*3;
   if(kind==='slate')value=243+Math.sin(tau*v*8)*4+Math.sin(tau*(u*6+(y>>3)%2*.5))*2+noise*4;
   if(kind==='paper')value=249+Math.sin(tau*v*23)*2+noise*3;
   const i=(y*size+x)*4;data[i]=data[i+1]=data[i+2]=Math.round(value);data[i+3]=255;
  }
  texture=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);texture.name=`SettlementCraft_${kind}`;
  texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;surfaces.set(kind,texture);
 }
 material.map=texture;material.userData.craftSurface=kind;return material;
}

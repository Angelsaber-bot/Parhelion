import * as THREE from 'three';
import type {PortraitPart as Part} from './residentPortrait';

/** Shoulder, ribcage, waist and skirt have their own volumes, not a single cone. */
export const tailoredTorso=new THREE.LatheGeometry([
 [.208,-.23],[.212,-.18],[.181,-.08],[.187,.035],[.205,.14],[.19,.21],[.135,.245],
].map(([r,y])=>new THREE.Vector2(r,y)),14);

const box=new THREE.BoxGeometry(1,1,1),stud=new THREE.OctahedronGeometry(1,0);
/** Low-contrast piping and functional fasteners survive the existing six batches. */
export function tailoringParts(coat:number,trim:number,accent:number,region:string,craft:boolean):Part[]{
 const parts:Part[]=[];
 if(region!=='kyoto')for(const sign of[-1,1]){
  parts.push({g:box,c:trim,p:[sign*.085,.168,.141],s:[.03,.18,.014],r:[0,0,-sign*.35]},
   {g:box,c:trim,p:[sign*.13,-.07,.143],s:[.075,.012,.014]},
   {g:box,c:coat,p:[sign*.13,-.102,.147],s:[.07,.06,.009]});
 }
 if(craft){
  // Leather apron follows the torso; separate waist and bib explain how it is worn.
  const apron=new THREE.CylinderGeometry(.203,.226,.34,10,2,true,-.68,1.36);
  apron.scale(1,1,.73);parts.push({g:apron,c:trim,p:[0,-.18,.023]});
  for(const sign of[-1,1])parts.push({g:box,c:trim,p:[sign*.075,.14,.158],s:[.018,.22,.012],r:[0,0,-sign*.22]},
   {g:stud,c:accent,p:[sign*.087,.05,.174],s:[.008,.008,.005]});
  parts.push({g:box,c:coat,p:[0,-.19,.19],s:[.14,.085,.012]});
 }
 return parts;
}

export function bootLacing(sign:number,trim:number):Part[]{
 const parts:Part[]=[];
 for(let i=0;i<4;i++)for(const s of[-1,1]){
  parts.push({g:stud,c:trim,p:[sign*.11+s*.024,.15+i*.026,.075],s:[.007,.007,.005]},
   {g:box,c:0x998169,p:[sign*.11,.15+i*.026,.079],s:[.054,.006,.005],r:[0,0,s*.27]});
 }
 return parts;
}

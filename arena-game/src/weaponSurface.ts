/** Close-range PBR detail shared by gallery, first-person and remote weapons.
 * Analytic grain is filtered by screen derivatives, so distant surfaces do not
 * turn into glitter/noise. No new texture downloads or shared GPU ownership. */
import * as THREE from 'three';
import type {SignatureId} from '../shared/signatureSkins.ts';

export type SurfaceRole='coat'|'metal'|'frame'|'grip'|'accent'|'pearl'|'crystal';
type Finish={kind:string;frequency:number;relief:number;variation:number;coat:number;coatRoughness:number};
const finish=(kind:string,frequency:number,relief:number,variation:number,coat:number,coatRoughness:number):Finish=>({kind,frequency,relief,variation,coat,coatRoughness});
export const WEAPON_SURFACES:Record<SignatureId,Finish>={
 'tidal-engine':finish('enamel',160,.000035,.025,.8,.16),
 'celadon-atlas':finish('porcelain',120,.000024,.035,1,.11),
 'abyssal-requiem':finish('titanium',220,.000040,.035,.3,.25),
 'vermilion-plume':finish('lacquer',175,.000034,.030,.9,.15),
 'foundry-bell':finish('cast',115,.000100,.065,.16,.38),
 'amber-apiary':finish('resin',135,.000035,.035,1,.13),
 'mint-arcade':finish('polymer',175,.000042,.035,.65,.21),
 'abyssal-maw':finish('scale',120,.000080,.055,.55,.27),
 'velvet-thorn':finish('satin',190,.000045,.045,.6,.20),
 'prismwing':finish('crystal',90,.000015,.018,1,.08),
 'ink-bamboo':finish('bamboo',190,.000075,.060,.55,.24),
 'sugar-crash':finish('icing',145,.000060,.050,.4,.28),
 'graviton-crucible':finish('ceramic',160,.000025,.030,.85,.13),
 'koi-current':finish('porcelain',135,.000030,.030,1,.11),
 'owl-canticle':finish('obsidian',160,.000035,.035,.75,.16),
 'cloudline':finish('brushed',160,.00004,.035,.75,.18),
 'cinder-express':finish('cast',160,.00004,.035,.75,.18),
 'brass-horizon':finish('enamel',160,.00004,.035,.75,.18),
 'mixtape':finish('polymer',160,.00004,.035,.75,.18),
 'glacier-survey':finish('ceramic',160,.00004,.035,.75,.18),
 'crescent-sabre':finish('titanium',160,.00004,.035,.75,.18),
 'reef-regalia':finish('porcelain',160,.00004,.035,.75,.18),
 'cathedral-chime':finish('obsidian',160,.00004,.035,.75,.18),
 'meridian-key':finish('wood',165,.000080,.060,.65,.21),
};

export function surfaceRole(name:string):SurfaceRole{
 if(/rubber|grip/i.test(name))return 'grip';
 if(/metal|steel|copper/i.test(name))return 'metal';
 if(/dark|black|frame/i.test(name))return 'frame';
 if(/glow|core|light/i.test(name))return 'accent';
 if(/pearl/i.test(name))return 'pearl';
 if(/glass|crystal/i.test(name))return 'crystal';
 return 'coat';
}
export function refineWeaponMaterial(material:THREE.Material,id:SignatureId,role=surfaceRole(material.name)){
 if(!(material instanceof THREE.MeshStandardMaterial)||material.userData.surfaceRefinement)return;
 const profile=WEAPON_SURFACES[id];
 material.userData.surfaceRefinement={skin:id,role,kind:profile.kind,version:1};
 const physical=material as THREE.MeshPhysicalMaterial;
 if(physical.isMeshPhysicalMaterial){
  if(role==='coat'){physical.clearcoat=profile.coat;physical.clearcoatRoughness=profile.coatRoughness;if(['wood','bamboo','icing','porcelain'].includes(profile.kind))physical.metalness=Math.min(physical.metalness,.18);}
  if(role==='grip'){physical.clearcoat=.03;physical.iridescence=0;}
  if(role==='metal'){physical.clearcoat=.25;physical.clearcoatRoughness=.25;}
  if(role==='pearl'){physical.clearcoat=.65;physical.clearcoatRoughness=.18;}
 }
 if(role==='grip'){material.metalness=.025;material.roughness=.83;}
 if(role==='metal')material.roughness=Math.max(.24,material.roughness);
 const frequency=role==='grip'?155:role==='metal'||role==='frame'?225:profile.frequency;
 const relief=role==='grip'?.00012:role==='metal'?.000026:role==='accent'||role==='crystal'?.000012:profile.relief;
 const variation=role==='grip'?.045:role==='metal'?.035:profile.variation;
 const kind=role==='grip'?'weave':role==='metal'?'brushed':profile.kind;
 const previous=material.onBeforeCompile,key=material.customProgramCacheKey();
 material.customProgramCacheKey=()=>`${key}|surface-${id}-${role}-v1`;
 material.onBeforeCompile=function(shader,renderer){
  previous.call(this,shader,renderer);
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 phSurfacePosition;').replace('#include <begin_vertex>','#include <begin_vertex>\nphSurfacePosition=position;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 phSurfacePosition;');
  const pattern=kind==='wood'||kind==='bamboo'
   ?'sin(phP.y*phF*.66+phP.z*phF*.48+sin(phP.x*13.0+phP.z*11.0)*1.7)'
   :kind==='brushed'||kind==='titanium'
   ?'sin(phP.y*phF+sin(phP.x*19.0)*.23)*.7+sin(phP.z*phF*.8+phP.y*phF*.36)*.3'
   :kind==='weave'||kind==='satin'
   ?'sin((phP.x+phP.y)*phF)*sin((phP.x-phP.y+phP.z)*phF*.83)'
   :'sin(phP.x*phF+sin(phP.y*phF*.51))*.55+sin(phP.y*phF*.87+phP.z*phF*.73)*sin(phP.x*phF*.59)*.45';
  shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
   vec3 phP=phSurfacePosition;float phF=${frequency.toFixed(1)};
   float phFootprint=max(length(dFdx(phP)),length(dFdy(phP)))*phF;
   float phDetailFade=1.0-smoothstep(.35,1.35,phFootprint);
   float phMicro=(${pattern})*phDetailFade;
   float phHeight=phMicro*${relief.toFixed(7)};
   roughnessFactor=clamp(roughnessFactor+phMicro*${variation.toFixed(4)},.08,.97);
   diffuseColor.rgb*=1.0+phMicro*.018;`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
   vec3 phDx=dFdx(-vViewPosition),phDy=dFdy(-vViewPosition);
   vec3 phR1=cross(phDy,normal),phR2=cross(normal,phDx);
   float phDet=dot(phDx,phR1);
   if(abs(phDet)>1e-12){vec3 phGradient=sign(phDet)*(dFdx(phHeight)*phR1+dFdy(phHeight)*phR2);normal=normalize(abs(phDet)*normal-phGradient);}`);
 };
}

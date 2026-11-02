/** Presentation-only premium finishes. No simulation, hitboxes or audio timing. */
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
export type FinishId='astral'|'sunforged'|'petalglass';
export const FINISH_DETAILS:Record<FinishId,{zh:string;en:string;description:[string,string];trim:number;light:number}>={
 astral:{zh:'星穹棱镜',en:'Astral Prism',description:['深空烤漆、变色镀膜与星轨镶线。','Deep-space lacquer, iridescent plating and constellation inlays.'],trim:0x9ba6da,light:0x7fcfff},
 sunforged:{zh:'赤金日冕',en:'Sunforged',description:['暖白陶瓷、鎏金日轮与熔芯光带。','Warm ceramic, gilt sunbursts and a molten light core.'],trim:0xd8ac57,light:0xffad54},
 petalglass:{zh:'樱华琉璃',en:'Petalglass',description:['珠光釉面、玫瑰金刻花与琉璃花瓣。','Pearl glaze, rose-gold engraving and glass petals.'],trim:0xc789a2,light:0xf1aedb},
};
export const finishOf=(id?:string):FinishId|null=>id&&Object.hasOwn(FINISH_DETAILS,id)?id as FinishId:null;
const clock={value:0};
export function updateFinishClock(seconds:number){if(Number.isFinite(seconds))clock.value=seconds;}
export function finishMaterial(source:THREE.MeshStandardMaterial,id:FinishId){
 const info=FINISH_DETAILS[id],m=new THREE.MeshPhysicalMaterial();THREE.MeshStandardMaterial.prototype.copy.call(m,source);m.defines={...m.defines,PHYSICAL:''};
 // MeshPhysicalMaterial.copy expects physical extension fields; retain sensible
 // values explicitly when converting the original standard PBR material.
 m.clearcoat=1;m.clearcoatRoughness=.16;m.iridescence=id==='astral'?.8:id==='petalglass'?.48:.12;
 m.iridescenceIOR=1.32;m.iridescenceThicknessRange=id==='astral'?[180,490]:[110,340];
 const body=/^PH_ivory(?:[._]?\d+)?$/.test(source.name),glow=/^PH_glow(?:[._]?\d+)?$/.test(source.name),rubber=/rubber/i.test(source.name),glass=/glass/i.test(source.name);
 if(body){m.roughness=id==='sunforged'?.30:.24;m.metalness=id==='astral'?.78:.34;}
 else if(glow){m.emissive.setHex(info.light);m.emissiveIntensity=.62;m.roughness=.19;}
 else if(rubber){m.metalness=.02;m.roughness=.8;m.clearcoat=.08;m.iridescence=0;}
 else if(glass){m.color.setHex(info.light);m.roughness=.12;m.metalness=.3;}
 else if(!/dark|black/i.test(source.name)){m.color.setHex(info.trim);m.metalness=.88;m.roughness=.25;}
 m.userData.finish=id;m.customProgramCacheKey=()=>`parhelion-finish-${id}-${body?'body':glow?'glow':'trim'}-1`;
 if(body||glow){
  m.onBeforeCompile=shader=>{
   shader.uniforms.phSkinTime=clock;
   shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 phSkinPosition;').replace('#include <begin_vertex>','#include <begin_vertex>\nphSkinPosition=position;');
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 phSkinPosition;\nuniform float phSkinTime;\nfloat phHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}');
   const pattern=id==='astral'?`
    vec2 q=phSkinPosition.xy*11.0;vec2 cell=floor(q);vec2 fp=fract(q)-.5;
    float star=(1.0-smoothstep(.012,.055,length(fp)))*step(.77,phHash(cell));
    float orbit=1.0-smoothstep(.008,.025,abs(sin(phSkinPosition.x*4.4+phSkinPosition.y*6.0+sin(phSkinPosition.x*2.0)*1.8)));
    diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.16,.21,.44),.22+.12*sin(phSkinPosition.x*2.5+phSkinPosition.y*3.0));
    diffuseColor.rgb+=vec3(.32,.56,.8)*star*.8+vec3(.24,.34,.52)*orbit*.18;`
    :id==='sunforged'?`
    float engraving=1.0-smoothstep(.025,.07,abs(sin(phSkinPosition.x*18.0+sin(phSkinPosition.y*19.0))));
    float panel=step(.4,fract(phSkinPosition.y*9.0));
    diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.43,.25,.075),engraving*panel*.26);`
    :`
    vec2 q=phSkinPosition.xy*7.0;vec2 tile=floor(q);vec2 uv=fract(q)-.5;
    float a=atan(uv.y,uv.x);float petal=abs(length(uv)-(.20+.09*cos(a*5.0)));
    float flower=(1.0-smoothstep(.012,.035,petal))*step(.50,phHash(tile));
    float ribbon=1.0-smoothstep(.01,.035,abs(sin(phSkinPosition.x*5.0+phSkinPosition.y*7.0)));
    diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.72,.34,.52),flower*.48+ribbon*.12);`;
   shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n'+(body?pattern:'')+(glow?'\ndiffuseColor.rgb*=.9+.1*sin(phSkinTime*1.3+phSkinPosition.x*2.0);':''));
  };
 }
 return m;
}

/** Inlaid relief stays inside the authored receiver/head bounds. It follows the
 * body pivot and cannot change any muzzle, grip, magazine or sight anchor. */
export function addFinishInlay(body:THREE.Object3D,id:FinishId){
 body.updateWorldMatrix(true,true);
 const inverse=body.matrixWorld.clone().invert();let box=new THREE.Box3().setFromObject(body).applyMatrix4(inverse),panelArea=0;
 const paintedCenter=new THREE.Vector3();let paintedWeight=0;
 // Use the painted receiver/head primitive rather than a shaft-spanning box.
 // In particular the hammer's inlay belongs on its head, not in empty space
 // above the handle. All primitives still borrow the unchanged combat asset.
 body.traverse(o=>{if(!(o instanceof THREE.Mesh))return;const mats=Array.isArray(o.material)?o.material:[o.material];if(!mats.some(m=>/^PH_ivory(?:[._]?\d+)?$/.test(m.name)))return;const candidate=new THREE.Box3().setFromObject(o).applyMatrix4(inverse),s=candidate.getSize(new THREE.Vector3()),area=s.x*s.y;if(area>panelArea){panelArea=area;box=candidate;}
  const p=o.geometry.getAttribute('position'),index=o.geometry.index,relative=inverse.clone().multiply(o.matrixWorld),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),ab=new THREE.Vector3(),ac=new THREE.Vector3();
  for(let i=0;i<(index?.count??p.count);i+=3){a.fromBufferAttribute(p,index?index.getX(i):i).applyMatrix4(relative);b.fromBufferAttribute(p,index?index.getX(i+1):i+1).applyMatrix4(relative);c.fromBufferAttribute(p,index?index.getX(i+2):i+2).applyMatrix4(relative);const weight=Math.abs(ab.subVectors(b,a).cross(ac.subVectors(c,a)).z);paintedCenter.addScaledVector(a,weight/3).addScaledVector(b,weight/3).addScaledVector(c,weight/3);paintedWeight+=weight;}
 });
 const size=box.getSize(new THREE.Vector3());
 if(!Number.isFinite(size.length())||size.y<.04||size.z<.02)return;
 const info=FINISH_DETAILS[id],r=Math.min(size.x*.09,size.y*.20),center=box.getCenter(new THREE.Vector3());
 if(paintedWeight>0)center.copy(paintedCenter.multiplyScalar(1/paintedWeight));
 const metal=new THREE.MeshPhysicalMaterial({color:info.trim,metalness:.88,roughness:.22,clearcoat:1}),glass=new THREE.MeshPhysicalMaterial({color:info.light,metalness:.35,roughness:.15,iridescence:.6,clearcoat:1,emissive:info.light,emissiveIntensity:.12});
 const bins:THREE.BufferGeometry[][]=[[],[]];
 const add=(g:THREE.BufferGeometry,x:number,y:number,z:number,bin=0,rz=0)=>{g.scale(1,1,.005).rotateZ(rz).translate(x,y,z);bins[bin].push(g.index?g.toNonIndexed():g);if(g.index)g.dispose();};
 for(const side of[-1,1]){
  const ray=new THREE.Raycaster();let contact:THREE.Vector3|null=null;
  for(const [dx,dy]of [[0,0],[r,0],[-r,0],[0,r],[0,-r]]){const origin=new THREE.Vector3(center.x+dx,center.y+dy,side===1?box.max.z+1:box.min.z-1).applyMatrix4(body.matrixWorld),direction=new THREE.Vector3(0,0,-side).transformDirection(body.matrixWorld);ray.set(origin,direction);const hit=ray.intersectObject(body,true)[0];if(hit){contact=body.worldToLocal(hit.point.clone());break;}}
  if(!contact)continue;
  center.x=contact.x;center.y=contact.y;const z=contact.z+side*.0001;
  if(id==='astral'){
   add(new THREE.TorusGeometry(r*.77,r*.035,5,36),center.x,center.y,z);
   for(let i=0;i<4;i++){const a=i*Math.PI/2+.28;add(new THREE.OctahedronGeometry(r*.15).scale(1,1,.20),center.x+Math.cos(a)*r*.65,center.y+Math.sin(a)*r*.65,z,1);}
   add(new THREE.OctahedronGeometry(r*.30).scale(1,1,.18),center.x,center.y,z,1);
  }else if(id==='sunforged'){
   add(new THREE.TorusGeometry(r*.58,r*.055,6,32),center.x,center.y,z);
   for(let i=0;i<12;i++){const a=i/12*Math.PI*2;add(new THREE.BoxGeometry(r*.06,r*.29,r*.06),center.x+Math.cos(a)*r*.80,center.y+Math.sin(a)*r*.80,z,0,a-Math.PI/2);}
   add(new THREE.SphereGeometry(r*.37,16,10).scale(1,1,.16),center.x,center.y,z,1);
  }else{
   for(let i=0;i<5;i++){const a=i/5*Math.PI*2;add(new THREE.SphereGeometry(r*.36,12,8).scale(.58,1,.15),center.x+Math.cos(a)*r*.38,center.y+Math.sin(a)*r*.38,z,1,a-Math.PI/2);}
   add(new THREE.TorusGeometry(r*.17,r*.035,5,16),center.x,center.y,z);
  }
 }
 const group=new THREE.Group();group.name=`FinishInlay_${id}`;
 bins.forEach((parts,i)=>{if(!parts.length)return;const geometry=mergeGeometries(parts,false)!;for(const p of parts)p.dispose();const mesh=new THREE.Mesh(geometry,i?glass:metal);mesh.name=`Finish_${i?'crystal':'engraving'}`;group.add(mesh);});body.add(group);
 return {group,dispose(){group.removeFromParent();group.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});metal.dispose();glass.dispose();}};
}

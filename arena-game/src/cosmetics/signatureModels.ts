/** Complete original silhouettes for selected skins. +X forward, +Y up.
 * Gameplay sockets remain the registry sockets; every mesh/material is owned by
 * this instance and no original GLB is downloaded for these modeled finishes. */
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {mergeGeometries,mergeVertices,toCreasedNormals} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {signatureOf,signatureModelOf,type SignatureStyle,type SignatureId} from '../../shared/signatureSkins.ts';
import type {ArtDef,ArtInstance} from '../weapons/weaponArt.ts';
import {gravitonRifle,koiSmg,owlMarksman,clockSniper,grip as sharedGrip} from './signatureGunModels.ts';
import {buildSecondCollection} from './signatureCollectionTwo.ts';
import {buildThirdCollection,THIRD_COLLECTION_MODELS} from './signatureCollectionThree.ts';
import {buildFourthCollection,FOURTH_COLLECTION_MODELS} from './signatureCollectionFour.ts';
import {refineWeaponMaterial} from '../weapons/weaponSurface.ts';
import {addSignatureMotes} from './signatureMotes.ts';

export type V=readonly[number,number,number];
export type P=readonly[number,number];
export class Sculpture{
 readonly root=new THREE.Group();readonly asset=new THREE.Group();readonly parts:Record<string,THREE.Group>={};
 readonly coat:THREE.MeshPhysicalMaterial;readonly metal:THREE.MeshPhysicalMaterial;readonly dark:THREE.MeshStandardMaterial;readonly glow:THREE.MeshPhysicalMaterial;readonly soft:THREE.MeshStandardMaterial;readonly pearl:THREE.MeshPhysicalMaterial;
 constructor(readonly def:ArtDef,readonly style:SignatureStyle){
  this.root.name=`Sculpture_${style.id}`;this.root.userData.structuralSkin=style.id;this.asset.name=`${def.file}_ROOT`;this.root.add(this.asset);
  this.coat=new THREE.MeshPhysicalMaterial({name:'Sculpt_coat',color:style.body,metalness:style.metal,roughness:style.rough,clearcoat:1,clearcoatRoughness:.19,iridescence:style.iris});
  this.metal=new THREE.MeshPhysicalMaterial({name:style.model==='confection'?'Sculpt_candy_trim':'Sculpt_metal',color:style.trim,metalness:style.model==='confection'?.18:.82,roughness:style.model==='confection'?.34:.26,clearcoat:.5});
  this.dark=new THREE.MeshStandardMaterial({name:'Sculpt_frame',color:style.shadow??0x132a2b,metalness:.4,roughness:.48});
  this.glow=new THREE.MeshPhysicalMaterial({name:'Sculpt_glow',color:style.accent,emissive:style.accent,emissiveIntensity:.18,metalness:.2,roughness:.22,clearcoat:1});
  this.soft=new THREE.MeshStandardMaterial({name:'Sculpt_grip',color:style.model==='confection'?0xbe9cad:style.model==='bamboo'?0x243c31:style.model==='butterfly'?0x3b365b:style.model==='chronograph'?0x352c2b:style.model==='maw'?0x293c34:0x26313e,roughness:.85,metalness:.03});
  this.pearl=new THREE.MeshPhysicalMaterial({name:'Sculpt_pearl',color:0xf2e9d1,metalness:.13,roughness:.27,clearcoat:1});
  for(const material of [this.coat,this.metal,this.dark,this.glow,this.soft,this.pearl])material.userData.finish=style.id;
 }
 readonly pivots:Record<string,THREE.Vector3>={};
 part(role='body'){if(!this.parts[role]){const group=new THREE.Group();group.name=`${this.def.file}__${role}`;this.parts[role]=group;this.asset.add(group);}return this.parts[role];}
 /** A rigid rotor around `pivot`. Authored in model coordinates; the group sits
  * at the pivot so `signatureMotion.ts` can turn it without moving any socket. */
 spin(role:string,pivot:V,speed:number,boost=0,axis:'x'|'y'|'z'='x'){const group=this.part(role);group.position.fromArray(pivot);this.pivots[role]=group.position.clone();group.userData.spin={axis,speed,boost};return group;}
 mesh(g:THREE.BufferGeometry,m:THREE.Material,p:V=[0,0,0],role='body',rotation:V=[0,0,0]){const mesh=new THREE.Mesh(g,m);mesh.position.fromArray(p);if(this.pivots[role])mesh.position.sub(this.pivots[role]);mesh.rotation.set(...rotation);mesh.castShadow=true;mesh.receiveShadow=true;this.part(role).add(mesh);return mesh;}
 /** Rounding detail follows size: slivers and sharp keys are plain boxes, small
  * parts get one bevel step, and only large forms carry the full rounded edge. */
 box(size:V,p:V,m:THREE.Material=this.coat,role='body',round=.025){
  const r=Math.min(round,...size.map(n=>n*.35)),big=Math.max(...size);
  const g=r<.0025?new THREE.BoxGeometry(...size):new RoundedBoxGeometry(...size,big<.12?1:2,r);
  return this.mesh(g,m,p,role);
 }
 rod(a:V,b:V,r:number,m:THREE.Material=this.metal,role='body',top=r,segments=12){const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),d=end.clone().sub(start);const mesh=this.mesh(new THREE.CylinderGeometry(top,r,d.length(),segments),m,start.clone().add(end).multiplyScalar(.5).toArray()as[number,number,number],role);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return mesh;}
 /** Tessellation follows size: a rivet does not need the 24×16 of a hammer pommel. */
 sphere(r:number,p:V,m:THREE.Material=this.glow,scale:V=[1,1,1],role='body'){const big=r*Math.max(...scale),mesh=this.mesh(new THREE.SphereGeometry(r,Math.max(10,Math.min(24,Math.round(big*260))),Math.max(7,Math.min(16,Math.round(big*170)))),m,p,role);mesh.scale.fromArray(scale);return mesh;}
 ring(r:number,t:number,p:V,m:THREE.Material=this.metal,role='body',axis:'x'|'z'='z'){return this.mesh(new THREE.TorusGeometry(r,t,t<.01?5:8,Math.max(16,Math.min(40,Math.round(r*320)))),m,p,role,axis==='x'?[0,Math.PI/2,0]:[0,0,0]);}
 outline(points:V[],r:number,m:THREE.Material=this.metal,role='body'){const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));return this.mesh(new THREE.TubeGeometry(curve,Math.max(12,Math.min(128,points.length*6)),r,6,false),m,[0,0,0],role);}
 plate(points:P[],depth:number,p:V,m:THREE.Material=this.coat,role='body',bevel=.007,smooth=false){const contour=smooth?new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p,0)),true).getPoints(points.length*4).map(p=>[p.x,p.y]as P):points;const shape=new THREE.Shape();shape.moveTo(...contour[0]);for(const point of contour.slice(1))shape.lineTo(...point);shape.closePath();const g=new THREE.ExtrudeGeometry(shape,{depth,steps:1,bevelEnabled:bevel>0,bevelSize:bevel,bevelThickness:bevel,bevelSegments:2});g.translate(0,0,-depth/2);const rounded=toCreasedNormals(g,Math.PI/3);if(rounded!==g)g.dispose();return this.mesh(rounded,m,p,role);}
 grip(a:V,b:V,r:number,role='body'){
  this.rod(a,b,r,this.soft,role);const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),axis=end.clone().sub(start).normalize();
  const u=new THREE.Vector3(Math.abs(axis.y)>.9?1:0,Math.abs(axis.y)>.9?0:1,0).cross(axis).normalize(),v=axis.clone().cross(u).normalize();
  const melee=['blade','polearm','hammer'].includes(this.style.weapon);
  if(melee){for(const sign of[-1,1]){const points:V[]=Array.from({length:73},(_,i)=>{const t=i/72,angle=t*Math.PI*12*sign,p=start.clone().lerp(end,t).addScaledVector(u,Math.cos(angle)*r*1.035).addScaledVector(v,Math.sin(angle)*r*1.035);return p.toArray()as[number,number,number];});this.outline(points,.0055,this.style.model==='confection'?this.coat:this.soft,role);}}
  else for(let i=1;i<10;i++){const p=start.clone().lerp(end,i/10),ring=this.mesh(new THREE.TorusGeometry(r*1.012,.0038,4,20),this.soft,p.toArray()as[number,number,number],role);ring.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),axis);}
  for(const t of [.035,.965]){const ring=this.mesh(new THREE.TorusGeometry(r*1.02,.006,6,24),this.metal,start.clone().lerp(end,t).toArray()as[number,number,number],role);ring.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),axis);}
 }
 /** Open reflex sight: a hooded window around the authored sight axis (never on it),
  * lens bezel, emitter and turrets. The ADS ray passes through the empty window. */
 gunSight(){
  const p=this.def.sight;if(!p)return;const [x,y,z]=p;
  const frame=(w:number,h:number,iw:number,ih:number,r:number)=>{const shape=new THREE.Shape(),round=(sh:THREE.Shape|THREE.Path,hw:number,hh:number,rr:number)=>{sh.moveTo(-hw+rr,-hh);sh.lineTo(hw-rr,-hh);sh.quadraticCurveTo(hw,-hh,hw,-hh+rr);sh.lineTo(hw,hh-rr);sh.quadraticCurveTo(hw,hh,hw-rr,hh);sh.lineTo(-hw+rr,hh);sh.quadraticCurveTo(-hw,hh,-hw,hh-rr);sh.lineTo(-hw,-hh+rr);sh.quadraticCurveTo(-hw,-hh,-hw+rr,-hh);return sh;};round(shape,w,h,r);const hole=new THREE.Path();round(hole,iw,ih,r*.6);shape.holes.push(hole);return shape;};
  const tunnel=(shape:THREE.Shape,depth:number,at:number,m:THREE.Material,bevel=.006)=>{const g=new THREE.ExtrudeGeometry(shape,{depth,steps:1,bevelEnabled:bevel>0,bevelSize:bevel,bevelThickness:bevel,bevelSegments:2,curveSegments:6});g.translate(0,0,-depth/2);g.rotateY(Math.PI/2);this.mesh(g,m,[at,y,z],'optic');};
  this.box([.17,.11,.13],[x+.01,y-.13,z],this.dark,'optic',.02);
  for(const dx of[-.05,.07])this.box([.03,.025,.15],[x+dx,y-.17,z],this.metal,'optic',.006);
  tunnel(frame(.095,.085,.064,.058,.03),.13,x+.02,this.dark,.008);
  tunnel(frame(.07,.064,.062,.057,.02),.008,x+.09,this.glow,0);
  tunnel(frame(.098,.088,.088,.078,.03),.012,x-.045,this.metal,.003);
  this.sphere(.009,[x-.02,y-.054,z],this.glow,[1,.6,1],'optic');
  this.mesh(new THREE.CylinderGeometry(.024,.026,.032,14),this.metal,[x+.02,y+.105,z],'optic');
  this.mesh(new THREE.CylinderGeometry(.022,.024,.03,14),this.metal,[x+.02,y,z+.11],'optic',[Math.PI/2,0,0]);
  for(let i=0;i<8;i++){const a=i/8*Math.PI*2;this.box([.006,.034,.006],[x+.02+Math.cos(a)*.025,y+.105,z+Math.sin(a)*.025],this.dark,'optic',.002);}
 }
 /** Asset-space bounds of every authored piece, captured before batching (for continuity checks). */
 readonly pieces:{role:string;box:THREE.Box3}[]=[];
 finish():ArtInstance{
  this.part();this.asset.updateMatrixWorld(true);
  for(const [role,part]of Object.entries(this.parts))for(const child of part.children){const box=new THREE.Box3().setFromObject(child);this.root.worldToLocal(box.min);this.root.worldToLocal(box.max);this.pieces.push({role,box});}
  // Batch by material within each articulated part, retaining the pump, bolt
  // and stock pivots without issuing one draw call per tooth or icing bead.
  for(const part of Object.values(this.parts)){
   const batches=new Map<THREE.Material,THREE.BufferGeometry[]>();
   for(const child of [...part.children]){const mesh=child as THREE.Mesh;mesh.updateMatrix();const copy=mesh.geometry.clone().applyMatrix4(mesh.matrix);const g=copy.index?copy.toNonIndexed():copy;if(g!==copy)copy.dispose();if(!g.getAttribute('uv'))g.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(g.getAttribute('position').count*2),2));const material=mesh.material as THREE.Material;const list=batches.get(material)??[];list.push(g);batches.set(material,list);mesh.removeFromParent();mesh.geometry.dispose();}
   for(const [material,geometries]of batches){refineWeaponMaterial(material,this.style.id as SignatureId);const merged=mergeGeometries(geometries,false)!,geometry=mergeVertices(merged,1e-5);merged.dispose();geometries.forEach(g=>g.dispose());const mesh=new THREE.Mesh(geometry,material);mesh.name=`${part.name}_${material.name}`;mesh.castShadow=true;mesh.receiveShadow=true;part.add(mesh);}
  }
  this.root.updateMatrixWorld(true);return{root:this.root,parts:this.parts};
 }
}

function beastGun(s:Sculpture){
 // Two sculpted jaws wrap a real barrel; the lower jaw follows the pump pivot.
 s.plate([[-.8,.22],[-.64,.52],[-.18,.57],[.25,.47],[.48,.30],[.12,.12],[-.53,.08]],.33,[0,0,0]);
 s.sphere(.35,[-.29,.3,0],s.coat,[1.45,.65,.55]);
 s.plate([[-1.43,.07],[-1.43,.36],[-1.17,.49],[-.66,.35],[-.64,.22],[-1.12,.16]],.24,[0,0,0],s.coat,'stock');
 s.box([.11,.36,.29],[-1.39,.22,0],s.soft,'stock');
 sharedGrip(s);s.box([.15,.24,.14],[-.47,.07,0],s.dark);
 s.rod([.22,.31,0],[1.773,.31,0],.072,s.dark);
 s.ring(.080,.019,[1.74,.31,0],s.metal,'body','x');
 s.plate([[.10,.42],[.31,.61],[.82,.65],[1.35,.53],[1.65,.42],[1.52,.37],[.65,.43]],.30,[0,0,0]);
 s.plate([[.18,.11],[.40,-.025],[.99,-.015],[1.52,.13],[1.62,.21],[1.39,.18],[.61,.11]],.31,[0,0,0],s.coat,'fore_end');
 for(const side of[-1,1]){
  for(let i=0;i<8;i++){const x=.30+i*.15;s.mesh(new THREE.ConeGeometry(.031,.105,5),s.pearl,[x,.393,side*.133],'body',[0,0,Math.PI]);s.mesh(new THREE.ConeGeometry(.029,.09,5),s.pearl,[x+.04,.155,side*.135],'fore_end');}
  s.sphere(.058,[-.23,.40,side*.205],s.metal,[1,.62,.32]);s.sphere(.028,[-.23,.4,side*.225],s.glow,[1,1,.25]);
  s.ring(.061,.012,[.16,.31,side*.183],s.metal);s.sphere(.035,[.16,.31,side*.20],s.dark,[1,1,.5]);
  for(let i=0;i<3;i++)s.outline([[-.65+i*.12,.38,side*.18],[-.56+i*.12,.31,side*.20],[-.63+i*.12,.22,side*.18]],.008,s.dark);
  for(let i=0;i<5;i++)s.plate([[0,0],[.11,.075],[.23,0],[.11,-.025]],.008,[.41+i*.20,.52-i*.018,side*.16],s.dark);
 }
 for(let i=0;i<5;i++){const x=.32+i*.20,y=.615-i*.015;s.plate([[0,0],[.09,.045],[.19,.005],[.09,-.018]],.06,[x,y,0],i%2?s.dark:s.coat,'body',.005);}
 s.box([.30,.06,.06],[-.38,.48,-.19],s.metal,'bolt');s.box([.09,.10,.10],[-.306,.57,0],s.dark,'optic',.01);s.gunSight();
}

function butterflySword(s:Sculpture){
 s.grip([-.66,0,0],[-.15,0,0],.064);s.sphere(.073,[-.67,0,0],s.metal,[.6,1,1]);s.sphere(.044,[-.687,0,0],s.glow,[.55,1,1]);
 // A faceted, tapering crystal blade, rather than the original frame blade.
 const vertices:number[]=[],positions:P[]=[[.03,0],[.25,.11],[.92,.075],[1.56,0],[.92,-.075],[.25,-.11]];
 for(const side of[-1,1])for(let i=0;i<positions.length;i++){const a=positions[i],b=positions[(i+1)%positions.length];vertices.push(.36,0,side*.068,a[0],a[1],0,b[0],b[1],0);}
 const blade=new THREE.BufferGeometry();blade.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));blade.computeVertexNormals();const bladeMat=s.coat.clone();bladeMat.side=THREE.DoubleSide;s.mesh(blade,bladeMat);
 for(const side of[-1,1]){
  s.outline([[.06,0,side*.074],[.51,0,side*.052],[1.34,0,side*.012]],.008,s.glow);
  for(const sign of[-1,1]){
   const wing:P[]=[[-.13,0],[-.21,sign*.12],[-.14,sign*.29],[.02,sign*.26],[.21,sign*.11],[.11,sign*.025]];
   s.plate(wing,.025,[0,0,side*.045],s.metal,'body',.007,true);
   s.plate(wing.map(([x,y])=>[x*.77,y*.78]as P),.028,[0,0,side*.066],s.coat,'body',.007,true);
   s.outline([[-.12,0,side*.09],[-.1,sign*.12,side*.09],[.05,sign*.20,side*.09]],.007,s.glow);
   s.sphere(.027,[.02,sign*.15,side*.091],s.glow,[1,1,.35]);
  }
 }
 for(const sign of[-1,1])s.outline([[.25,sign*.11,0],[.92,sign*.075,0],[1.56,0,0]],.0055,s.metal);
 s.sphere(.058,[-.10,0,0],s.glow,[1.1,1,1]);
}

function bambooSpear(s:Sculpture){
 s.rod([-1.72,0,0],[.88,0,0],.045,s.coat);
 for(let i=0;i<10;i++){const x=-1.59+i*.255;s.rod([x-.021,0,0],[x+.021,0,0],.056,i%3===0?s.metal:s.dark);}
 s.grip([-.96,0,0],[-.43,0,0],.047);s.grip([-.09,0,0],[.18,0,0],.047);
 s.rod([.55,0,0],[.92,0,0],.062,s.metal,undefined,.036);
 s.plate([[.80,0],[1.06,.19],[1.48,.13],[1.82,0],[1.46,-.10],[1.05,-.12]],.035,[0,0,0],s.metal);
 s.plate([[.91,0],[1.15,.13],[1.48,.09],[1.73,0],[1.43,-.065],[1.13,-.08]],.05,[0,0,0]);
 for(const side of[-1,1]){
  s.outline([[.84,0,side*.04],[1.22,.025,side*.04],[1.72,0,side*.03]],.008,s.glow);
  for(let i=0;i<3;i++){const x=.98+i*.20;s.outline([[x,0,side*.043],[x+.13,.10,side*.043]],.005,s.metal);s.outline([[x,0,side*.043],[x+.12,-.065,side*.043]],.005,s.metal);}
 }
 // Small bronze leaves wrap the socket, without a floating spear frame.
 for(const side of[-1,1])s.plate([[.62,.015],[.67,side*.13],[.93,side*.22],[.82,side*.04]],.022,[0,0,.01],s.coat);
 for(const sign of[-1,1])s.outline([[.81,0,0],[1.06,sign*.16,0],[1.48,sign*.11,0],[1.82,0,0]],.005,s.metal);
 s.rod([-1.76,0,0],[-1.61,0,0],.061,s.metal,undefined,.044);
}

function confectionHammer(s:Sculpture){
 s.rod([-1.38,0,0],[.55,0,0],.058,s.coat);s.grip([-1.20,0,0],[-.50,0,0],.065);
 // Candy-cane stripes on the exposed haft.
 for(const start of[0,Math.PI]){const points:V[]=Array.from({length:49},(_,i)=>{const t=i/48,a=start+t*Math.PI*9;return[-.48+.53*t,Math.cos(a)*.059,Math.sin(a)*.059];});this_outline(s,points);}
 s.sphere(.087,[-1.32,0,0],s.pearl,[.7,1,1]);s.ring(.07,.015,[-1.32,0,0],s.metal,'body','x');
 s.rod([-.17,0,0],[.15,0,0],.092,s.metal,undefined,.075);
 // A round, double-faced mallet with a scalloped icing rim.
 s.mesh(new THREE.CylinderGeometry(.43,.43,.46,36),s.coat,[.48,.04,0],'body',[Math.PI/2,0,0]);
 const sprinkleMats=[s.glow,s.pearl,s.metal,s.soft];
 for(const side of[-1,1]){
  s.mesh(new THREE.CylinderGeometry(.39,.39,.035,32),s.pearl,[.48,.04,side*.239],'body',[Math.PI/2,0,0]);
  s.ring(.37,.022,[.48,.04,side*.265],s.metal);
  const swirl:V[]=Array.from({length:73},(_,i)=>{const t=i/72*Math.PI*4,r=.018+.29*i/72;return[.48+Math.cos(t)*r,.04+Math.sin(t)*r,side*.269];});s.outline(swirl,.015,s.coat);
  // Frosting: a wavy piped ring around the face edge.
  s.outline(Array.from({length:97},(_,i)=>{const t=i/96*Math.PI*2,r=.40+.012*Math.sin(t*16);return[.48+Math.cos(t)*r,.04+Math.sin(t)*r,side*(.232+.012*Math.cos(t*16))]as const;}),.022,s.pearl);
  for(let i=0;i<12;i++){const t=i/12*Math.PI*2;s.mesh(new THREE.SphereGeometry(.037,12,8),i%3?s.pearl:s.glow,[.48+Math.cos(t)*.418,.04+Math.sin(t)*.418,side*.19]).scale.set(1,1,.65);}
  // Drips running down the barrel of the mallet.
  for(let i=0;i<7;i++){const t=Math.PI*(.15+i*.1),x=.48+Math.cos(t)*.432,y=.04+Math.sin(t)*.432,len=.05+.04*((i*5)%3);s.rod([x,y,side*.22],[x,y,side*(.22-len)],.02,s.pearl,'body',.02,8);s.mesh(new THREE.SphereGeometry(.022,8,6),s.pearl,[x,y,side*(.22-len)]);}
  for(let i=0;i<7;i++){const t=i/7*Math.PI*2;s.rod([.48+Math.cos(t)*.31,.04+Math.sin(t)*.31,side*.281],[.49+Math.cos(t)*.31,.065+Math.sin(t)*.31,side*.281],.009,i%2?s.glow:s.metal);}
  // Sprinkles scattered between the spiral arms.
  for(let i=0;i<16;i++){const a=i*2.39996,r=.08+.24*((i*.618)%1),x=.48+Math.cos(a)*r,y=.04+Math.sin(a)*r,d=.022;s.rod([x-Math.cos(a*3)*d,y-Math.sin(a*3)*d,side*.262],[x+Math.cos(a*3)*d,y+Math.sin(a*3)*d,side*.262],.008,sprinkleMats[i%4],'body',.008,6);}
 }
 // A cherry on top.
 s.sphere(.07,[.48,.52,0],s.glow,[1,.92,1]);s.outline([[.48,.58,0],[.50,.65,0],[.55,.70,.01]],.008,s.soft);
 s.plate([[-.04,0],[-.16,.14],[-.31,.13],[-.21,.01],[-.31,-.13],[-.16,-.14]],.04,[0,0,0],s.coat);s.sphere(.07,[-.075,0,0],s.glow);
}
function this_outline(s:Sculpture,points:V[]){s.outline(points,.012,s.pearl);}

/** Groups authored pieces whose bounds touch (within `gap`); one group means nothing floats. */
export function pieceIslands(pieces:readonly{role:string;box:THREE.Box3}[],gap=.012){
 const parent=pieces.map((_,i)=>i),find=(i:number):number=>parent[i]===i?i:(parent[i]=find(parent[i]));
 for(let i=0;i<pieces.length;i++)for(let j=i+1;j<pieces.length;j++)if(pieces[i].box.clone().expandByScalar(gap).intersectsBox(pieces[j].box))parent[find(i)]=find(j);
 const groups=new Map<number,number[]>();pieces.forEach((_,i)=>{const r=find(i);groups.set(r,[...(groups.get(r)??[]),i]);});
 return[...groups.values()].sort((a,b)=>b.length-a.length);
}
export function sculptSignature(def:ArtDef,id?:string):Sculpture|null{
 const model=signatureModelOf(id,def.combat),style=signatureOf(id,def.combat);if(!model||!style)return null;
 const sculpture=new Sculpture(def,style);switch(model){case'maw':beastGun(sculpture);break;case'butterfly':butterflySword(sculpture);break;case'bamboo':bambooSpear(sculpture);break;case'confection':confectionHammer(sculpture);break;case'orrery':gravitonRifle(sculpture);break;case'koi':koiSmg(sculpture);break;case'nocturne':owlMarksman(sculpture);break;case'chronograph':clockSniper(sculpture);break;default:if((THIRD_COLLECTION_MODELS as readonly string[]).includes(model))buildThirdCollection(sculpture,model);else if((FOURTH_COLLECTION_MODELS as readonly string[]).includes(model))buildFourthCollection(sculpture,model);else buildSecondCollection(sculpture,model);break;}
 return sculpture;
}
export function buildSignatureModel(def:ArtDef,id?:string,motes=true):ArtInstance|null{
 const sculpture=sculptSignature(def,id);if(!sculpture)return null;
 const instance=sculpture.finish();
 if(motes){const points=addSignatureMotes(sculpture.asset,def.file,sculpture.style);if(points)instance.parts.motes=points;}
 return instance;
}

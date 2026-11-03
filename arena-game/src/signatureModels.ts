/** Complete original silhouettes for selected skins. +X forward, +Y up.
 * Gameplay sockets remain the registry sockets; every mesh/material is owned by
 * this instance and no original GLB is downloaded for these modeled finishes. */
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {mergeGeometries,mergeVertices} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {signatureOf,signatureModelOf,type SignatureStyle} from '../shared/signatureSkins.ts';
import type {ArtDef,ArtInstance} from './weaponArt.ts';

type V=readonly[number,number,number];
type P=readonly[number,number];
class Sculpture{
 readonly root=new THREE.Group();readonly asset=new THREE.Group();readonly parts:Record<string,THREE.Group>={};
 readonly coat:THREE.MeshPhysicalMaterial;readonly metal:THREE.MeshPhysicalMaterial;readonly dark:THREE.MeshStandardMaterial;readonly glow:THREE.MeshPhysicalMaterial;readonly soft:THREE.MeshStandardMaterial;readonly pearl:THREE.MeshPhysicalMaterial;
 constructor(readonly def:ArtDef,readonly style:SignatureStyle){
  this.root.name=`Sculpture_${style.id}`;this.root.userData.structuralSkin=style.id;this.asset.name=`${def.file}_ROOT`;this.root.add(this.asset);
  this.coat=new THREE.MeshPhysicalMaterial({name:'Sculpt_coat',color:style.body,metalness:style.metal,roughness:style.rough,clearcoat:1,clearcoatRoughness:.19,iridescence:style.iris});
  this.metal=new THREE.MeshPhysicalMaterial({name:'Sculpt_metal',color:style.trim,metalness:.82,roughness:.26,clearcoat:.5});
  this.dark=new THREE.MeshStandardMaterial({name:'Sculpt_frame',color:style.shadow??0x132a2b,metalness:.4,roughness:.48});
  this.glow=new THREE.MeshPhysicalMaterial({name:'Sculpt_glow',color:style.accent,emissive:style.accent,emissiveIntensity:.18,metalness:.2,roughness:.22,clearcoat:1});
  this.soft=new THREE.MeshStandardMaterial({name:'Sculpt_grip',color:style.model==='confection'?0xc1a4bb:0x263744,roughness:.85,metalness:.03});
  this.pearl=new THREE.MeshPhysicalMaterial({name:'Sculpt_pearl',color:0xf2e9d1,metalness:.13,roughness:.27,clearcoat:1});
  for(const material of [this.coat,this.metal,this.dark,this.glow,this.soft,this.pearl])material.userData.finish=style.id;
 }
 part(role='body'){if(!this.parts[role]){const group=new THREE.Group();group.name=`${this.def.file}__${role}`;this.parts[role]=group;this.asset.add(group);}return this.parts[role];}
 mesh(g:THREE.BufferGeometry,m:THREE.Material,p:V=[0,0,0],role='body',rotation:V=[0,0,0]){const mesh=new THREE.Mesh(g,m);mesh.position.fromArray(p);mesh.rotation.set(...rotation);mesh.castShadow=true;mesh.receiveShadow=true;this.part(role).add(mesh);return mesh;}
 box(size:V,p:V,m:THREE.Material=this.coat,role='body',round=.025){return this.mesh(new RoundedBoxGeometry(...size,2,Math.min(round,...size.map(n=>n*.35))),m,p,role);}
 rod(a:V,b:V,r:number,m:THREE.Material=this.metal,role='body',top=r,segments=12){const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),d=end.clone().sub(start);const mesh=this.mesh(new THREE.CylinderGeometry(top,r,d.length(),segments),m,start.clone().add(end).multiplyScalar(.5).toArray()as[number,number,number],role);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return mesh;}
 sphere(r:number,p:V,m:THREE.Material=this.glow,scale:V=[1,1,1],role='body'){const mesh=this.mesh(new THREE.SphereGeometry(r,16,10),m,p,role);mesh.scale.fromArray(scale);return mesh;}
 ring(r:number,t:number,p:V,m:THREE.Material=this.metal,role='body',axis:'x'|'z'='z'){return this.mesh(new THREE.TorusGeometry(r,t,6,28),m,p,role,axis==='x'?[0,Math.PI/2,0]:[0,0,0]);}
 outline(points:V[],r:number,m:THREE.Material=this.metal,role='body'){const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));return this.mesh(new THREE.TubeGeometry(curve,Math.max(12,Math.min(128,points.length*6)),r,6,false),m,[0,0,0],role);}
 plate(points:P[],depth:number,p:V,m:THREE.Material=this.coat,role='body',bevel=.007,smooth=false){const contour=smooth?new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p,0)),true).getPoints(points.length*4).map(p=>[p.x,p.y]as P):points;const shape=new THREE.Shape();shape.moveTo(...contour[0]);for(const point of contour.slice(1))shape.lineTo(...point);shape.closePath();const g=new THREE.ExtrudeGeometry(shape,{depth,steps:1,bevelEnabled:bevel>0,bevelSize:bevel,bevelThickness:bevel,bevelSegments:1});g.translate(0,0,-depth/2);return this.mesh(g,m,p,role);}
 grip(a:V,b:V,r:number,role='body'){this.rod(a,b,r,this.soft,role);const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b);for(let i=1;i<7;i++){const p=start.clone().lerp(end,i/7);const ring=this.mesh(new THREE.TorusGeometry(r*1.01,.009,4,16),this.metal,p.toArray()as[number,number,number],role);ring.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),end.clone().sub(start).normalize());}}
 gunSight(){const p=this.def.sight;if(!p)return;this.box([.19,.10,.19],[p[0],p[1]-.135,p[2]],this.dark,'optic');this.ring(.082,.018,p as[number,number,number],this.metal,'optic','x');}
 finish():ArtInstance{
  this.part();
  // Batch by material within each articulated part, retaining the pump, bolt
  // and stock pivots without issuing one draw call per tooth or icing bead.
  for(const part of Object.values(this.parts)){
   const batches=new Map<THREE.Material,THREE.BufferGeometry[]>();
   for(const child of [...part.children]){const mesh=child as THREE.Mesh;mesh.updateMatrix();const copy=mesh.geometry.clone().applyMatrix4(mesh.matrix);const g=copy.index?copy.toNonIndexed():copy;if(g!==copy)copy.dispose();if(!g.getAttribute('uv'))g.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(g.getAttribute('position').count*2),2));const material=mesh.material as THREE.Material;const list=batches.get(material)??[];list.push(g);batches.set(material,list);mesh.removeFromParent();mesh.geometry.dispose();}
   for(const [material,geometries]of batches){const merged=mergeGeometries(geometries,false)!,geometry=mergeVertices(merged,1e-5);merged.dispose();geometries.forEach(g=>g.dispose());const mesh=new THREE.Mesh(geometry,material);mesh.name=`${part.name}_${material.name}`;mesh.castShadow=true;mesh.receiveShadow=true;part.add(mesh);}
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
 s.grip([-.46,.13,0],[-.52,-.43,0],.085);s.outline([[-.50,-.04,-.02],[-.12,-.10,-.02],[-.08,-.30,-.02],[-.40,-.36,-.02]],.024,s.metal);
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
 s.box([.30,.06,.06],[-.38,.48,-.23],s.metal,'bolt');s.gunSight();
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
 s.rod([-1.76,0,0],[-1.61,0,0],.061,s.metal,undefined,.044);
}

function confectionHammer(s:Sculpture){
 s.rod([-1.38,0,0],[.55,0,0],.058,s.coat);s.grip([-1.20,0,0],[-.50,0,0],.065);
 s.sphere(.087,[-1.32,0,0],s.pearl,[.7,1,1]);s.ring(.07,.015,[-1.32,0,0],s.metal,'body','x');
 s.rod([-.17,0,0],[.15,0,0],.092,s.metal,undefined,.075);
 // A round, double-faced mallet with a scalloped icing rim.
 s.mesh(new THREE.CylinderGeometry(.43,.43,.46,36),s.coat,[.48,.04,0],'body',[Math.PI/2,0,0]);
 for(const side of[-1,1]){
  s.mesh(new THREE.CylinderGeometry(.39,.39,.035,32),s.pearl,[.48,.04,side*.239],'body',[Math.PI/2,0,0]);
  s.ring(.37,.022,[.48,.04,side*.265],s.metal);
  const swirl:V[]=Array.from({length:73},(_,i)=>{const t=i/72*Math.PI*4,r=.018+.29*i/72;return[.48+Math.cos(t)*r,.04+Math.sin(t)*r,side*.269];});s.outline(swirl,.015,s.coat);
  for(let i=0;i<12;i++){const t=i/12*Math.PI*2;s.sphere(.037,[.48+Math.cos(t)*.418,.04+Math.sin(t)*.418,side*.19],i%3?s.pearl:s.glow,[1,1,.65]);}
  for(let i=0;i<7;i++){const t=i/7*Math.PI*2;s.rod([.48+Math.cos(t)*.31,.04+Math.sin(t)*.31,side*.281],[.49+Math.cos(t)*.31,.065+Math.sin(t)*.31,side*.281],.009,i%2?s.glow:s.metal);}
 }
 s.plate([[-.04,0],[-.16,.14],[-.31,.13],[-.21,.01],[-.31,-.13],[-.16,-.14]],.04,[0,0,0],s.coat);s.sphere(.07,[-.075,0,0],s.glow);
}

export function buildSignatureModel(def:ArtDef,id?:string):ArtInstance|null{
 const model=signatureModelOf(id,def.combat),style=signatureOf(id,def.combat);if(!model||!style)return null;
 const sculpture=new Sculpture(def,style);switch(model){case'maw':beastGun(sculpture);break;case'butterfly':butterflySword(sculpture);break;case'bamboo':bambooSpear(sculpture);break;case'confection':confectionHammer(sculpture);break;}
 return sculpture.finish();
}

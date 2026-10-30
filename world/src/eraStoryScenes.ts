/** Grounded, batched chapter stations. Renderer projects saved progress, never owns it.
 * Seven draws per station; tiny deterministic surface maps; no lights or per-frame animation. */
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { mergeParts } from './settlements/merge';
import type { SettlementPlacement } from './settlements/types';
import type { Collider } from './player';
import type { Marker } from './types';
import { ERA_OPTIONALS, type EraId, type EraStoryState } from './eraStories';
type V3 = [number, number, number];
export const ERA_SCENE_LOCAL:Record<EraId,V3> = {britain:[-6,0,11],blacksail:[-3.5,0,11],winter:[-7.8,0,6.8],kyoto:[5,0,10]};
/** Small, tileable craft surfaces. No canvas, image requests or shader hooks: the
 * same deterministic maps work in the runtime and offline geometry inspection.
 * Broad grain is deliberate: high-contrast noise would shimmer at gameplay range. */
function craftSurface(kind:string){
 const size=64,data=new Uint8Array(size*size*4),tau=Math.PI*2;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=x/size,v=y/size,grain=Math.sin(tau*(u*7+.22*Math.sin(v*tau*2)));
  const noise=((x*73+y*151+x*y*19)%97)/96;
  let value=244;
  if(kind==='wood')value=230+grain*10+Math.sin(tau*u*19)*3+noise*5;
  if(kind==='stone')value=232+Math.sin(tau*u*3)*Math.sin(tau*v*4)*8+noise*9;
  if(kind==='metal')value=239+Math.sin(tau*(u*11+v*3))*2+noise*8;
  if(kind==='paper')value=246+Math.sin(tau*v*23)*2+noise*5;
  if(kind==='cloth')value=246+(x%2?2:-2)+(y%2?2:-2)+noise*3;
  const i=(y*size+x)*4;data[i]=data[i+1]=data[i+2]=Math.round(value);data[i+3]=255;
 }
 const map=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);
 map.name=`EraCraft_${kind}`;map.colorSpace=THREE.SRGBColorSpace;
 map.wrapS=map.wrapT=THREE.RepeatWrapping;map.magFilter=THREE.LinearFilter;
 map.minFilter=THREE.LinearMipmapLinearFilter;map.generateMipmaps=true;map.needsUpdate=true;
 return map;
}
class Art {
 group=new THREE.Group(); solids:THREE.BufferGeometry[]=[]; bins=new Map<string,THREE.BufferGeometry[]>(); materials:Record<string,THREE.MeshStandardMaterial>;
 constructor(region:EraId){
  const palette={britain:[0xbfb29b,0x625044,0x4e5967,0xe5d5b0,0x657da2],blacksail:[0x899893,0x70533d,0x354b50,0xe8d6b1,0x398585],winter:[0xa8b7bf,0x75604d,0x445665,0xe7decc,0x66839c],kyoto:[0x9eaaa2,0x614c38,0x494f5b,0xf2dfb8,0xa24b3c]}[region];
  this.materials=Object.fromEntries(['stone','wood','metal','paper','cloth','signal','complete'].map((name,i)=>{const m=new THREE.MeshStandardMaterial({color:i<5?palette[i]:0xffce7c,roughness:name==='metal'?.5:.86,metalness:name==='metal'?.38:0,vertexColors:true,side:name==='cloth'?THREE.DoubleSide:THREE.FrontSide});m.name=`Era_${region}_${name}`;if(i<5)m.map=craftSurface(name);if(name==='signal'||name==='complete')m.emissive.setHex(0xffb85e);return[name,m];}));
 }
 add(k:string,g:THREE.BufferGeometry,p:V3=[0,0,0],solid=false,r:V3=[0,0,0],tint=1){g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...r))).translate(...p);g.setAttribute('color',new THREE.BufferAttribute(new Float32Array(g.attributes.position.count*3).fill(tint),3));const list=this.bins.get(k)??[];list.push(g);this.bins.set(k,list);if(solid)this.solids.push(g.clone());}
 box(k:string,p:V3,s:V3,solid=false,r:V3=[0,0,0],tint=1){this.add(k,new THREE.BoxGeometry(...s),p,solid,r,tint);}
 cyl(k:string,p:V3,r:number,h:number,solid=false,top=r){this.add(k,new THREE.CylinderGeometry(top,r,h,12),p,solid);}
 beam(k:string,a:V3,b:V3,r:number,solid=false){const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b),d=to.clone().sub(from),g=new THREE.CylinderGeometry(r,r,d.length(),8);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize()));this.add(k,g,from.add(to).multiplyScalar(.5).toArray() as V3,solid);}
 /** Chamfered footprint and bevel catches, not a floating stack of boxes. */
 plinth(k:string,w:number,d:number,y:number,h:number){const b=.13,s=new THREE.Shape();s.moveTo(-w/2+b,-d/2);for(const[x,z]of[[w/2-b,-d/2],[w/2,-d/2+b],[w/2,d/2-b],[w/2-b,d/2],[-w/2+b,d/2],[-w/2,d/2-b],[-w/2,-d/2+b]])s.lineTo(x,z);s.closePath();const g=new THREE.ExtrudeGeometry(s,{depth:h,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.035,bevelThickness:.025});g.rotateX(-Math.PI/2);this.add(k,g,[0,y,0],true);}
 cloth(x:number,y:number,z:number,w:number,h:number,cut:'worn'|'swallowtail'|'split'='worn'){const g=new THREE.PlaneGeometry(w,h,8,5),a=g.attributes.position;for(let i=0;i<a.count;i++){const px=a.getX(i),py=a.getY(i);a.setZ(i,Math.sin(px*5+py*2)*.055);if(py< -h*.45)a.setY(i,py+(cut==='swallowtail'?.22*(1-Math.abs(px)/(w/2)):cut==='split'?(Math.abs(px)<w*.14?.17:0):.08*Math.abs(Math.sin(px*6))));}g.computeVertexNormals();this.add('cloth',g,[x,y,z]);}
 lantern(x:number,y:number,z:number,s=1){const profile=[[.18,0],[.29,.1],[.34,.28],[.34,.5],[.29,.7],[.18,.8]].map(([r,h])=>new THREE.Vector2(r*s,h*s));this.add('signal',new THREE.LatheGeometry(profile,12),[x,y,z]);for(const dy of[0,.8])this.cyl('metal',[x,y+dy*s,z],.22*s,.06*s);for(let j=1;j<6;j++)this.cyl('paper',[x,y+j*.13*s,z],[.3,.336,.342,.337,.305][j-1]*s,.016*s);this.beam('metal',[x,y+.8*s,z],[x,y+1.04*s,z],.025*s);}
 cageLantern(x:number,y:number,z:number,s=1){this.add('signal',new THREE.CylinderGeometry(.22*s,.22*s,.5*s,8),[x,y+.28*s,z]);for(const dy of[0,.55])this.cyl('metal',[x,y+dy*s,z],.27*s,.075*s);this.cyl('metal',[x,y+.68*s,z],.34*s,.2*s,false,.08*s);for(const side of[-1,1])for(const front of[-1,1])this.beam('metal',[x+side*.18*s,y,z+front*.18*s],[x+side*.18*s,y+.56*s,z+front*.18*s],.023*s);this.add('metal',new THREE.TorusGeometry(.09*s,.018*s,5,10),[x,y+.86*s,z]);}
 /** A shallow heraldic plate with a tapered foot, not a modern rectangular screen. */
 shield(p:V3,w:number,h:number){const s=new THREE.Shape();s.moveTo(-w/2,h/2);s.lineTo(w/2,h/2);s.lineTo(w/2,-h*.18);s.lineTo(w*.3,-h*.38);s.lineTo(0,-h/2);s.lineTo(-w*.3,-h*.38);s.lineTo(-w/2,-h*.18);s.closePath();this.add('metal',new THREE.ExtrudeGeometry(s,{depth:.026,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.018,bevelThickness:.012}),p);}
 /** Swept eaves with an underside: visible from both the approach and overhead. */
 eave(side:number){const shape=new THREE.Shape(),edge=(t:number)=>3.68-.28*t+.13*t*t*t;shape.moveTo(0,edge(0));for(let i=1;i<=4;i++)shape.lineTo(side*i*.23,edge(i/4));for(let i=4;i>=0;i--)shape.lineTo(side*i*.23,edge(i/4)-.055);shape.closePath();this.add('metal',new THREE.ExtrudeGeometry(shape,{depth:.86,bevelEnabled:false,steps:1}),[0,0,-.43]);}
 finish(origin:V3,region:EraId){for(const[k,parts]of this.bins){const g=mergeParts(parts);parts.forEach(p=>p.dispose());const m=new THREE.Mesh(g,this.materials[k]);m.name=`EraStation_${region}_${k}`;m.castShadow=false;m.receiveShadow=true;this.group.add(m);}this.bins.clear();this.group.name=`EraStory_${region}`;this.group.position.set(...origin);this.group.updateMatrixWorld(true);}
}
function britain(a:Art){
 a.plinth('stone',2.1,1.45,.04,.18);a.plinth('stone',1.8,1.2,.24,.18);a.box('stone',[0,1.04,0],[1.35,1.28,.65],true);a.plinth('stone',1.55,.9,1.68,.12);
 a.shield([0,1.1,.335],1.12,.98);
 // Weathered coping joints, plaque rivets and a small wax seal anchor the memorial.
 for(const x of[-.57,.57])for(const y of[.82,1.45])a.add('paper',new THREE.SphereGeometry(.028,6,4),[x,y,.39]);
 for(const x of[-.39,.32])a.box('wood',[x,.325,.605],[.014,.11,.006],false,[0,0,0],.65);
 a.add('complete',new THREE.CylinderGeometry(.075,.075,.025,10),[0,.85,.4],false,[Math.PI/2,0,0]);
 for(let i=0;i<5;i++){a.box('paper',[i===4?-.1:-.13,1.38-i*.15,.392],[i===4?.34:.58-(i%2)*.12,.022,.018],false,[0,0,0],.8+i*.035);a.box('complete',[i===4?.28:.36,1.38-i*.15,.398],[.04,.04,.02]);}
 a.box('paper',[0,1.94,0],[.065,.44,.08]);a.box('paper',[0,2.02,.012],[.29,.06,.08]);
 for(const x of[-.85,.85]){a.cyl('metal',[x,.63,.38],.09,.4);a.cageLantern(x,.84,.38,.64);}
 a.cyl('wood',[-1.2,1.8,-.23],.065,3.6,true);a.beam('metal',[-1.22,3.35,-.23],[-.12,3.35,-.23],.035);a.cloth(-.7,2.7,-.23,.9,1.15);a.box('paper',[-.7,2.76,-.15],[.065,.45,.02]);a.box('paper',[-.7,2.84,-.135],[.3,.06,.02]);
}
function blacksail(a:Art){
 a.plinth('stone',1.55,1.5,.04,.18);a.cyl('wood',[0,2.1,0],.12,4.2,true,.08);for(const y of[.35,1.25,2.1,3.1])a.cyl('metal',[0,y,0],.135,.09);
 for(const s of[-1,1]){a.beam('wood',[s*.65,.2,.5],[0,1.1,0],.065,true);a.beam('paper',[s*.67,.15,-.5],[0,3.85,0],.018);}
 a.beam('wood',[-.9,3.75,0],[.9,3.75,0],.065);a.cageLantern(0,2.6,0,1.1);a.beam('metal',[0,3.54,0],[0,3.75,0],.018);a.cloth(-.6,3.25,.03,.5,.7,'swallowtail');a.cloth(.6,3.25,.03,.5,.7,'swallowtail');
 // Three rope turns and a belaying pin make the repaired hoist intelligible.
 for(const y of[1.4,1.46,1.52])a.add('paper',new THREE.TorusGeometry(.135,.016,4,12),[0,y,0],false,[Math.PI/2,0,0]);
 a.beam('wood',[-.3,1.38,0],[.3,1.38,0],.03);
 for(const x of[-.6,.6])a.box('paper',[x,3.43,.09],[.055,.22,.02]);
 a.add('metal',new THREE.TorusGeometry(.34,.035,6,16),[.26,1.25,.12],false,[0,Math.PI/2,0]);a.beam('metal',[.26,1.25,.12],[.45,1.25,.12],.035);a.beam('wood',[.45,1.25,.12],[.45,1.05,.12],.04);
 for(const x of[-.58,.58])a.box('complete',[x,3.24,.09],[.26,.055,.025]);a.box('wood',[.48,.8,.3],[.52,.54,.16],true,[0,0,-.12]);a.box('paper',[.48,.82,.39],[.38,.35,.02]);
}
function winter(a:Art){
 a.plinth('stone',1.65,1.55,.04,.16);a.cyl('metal',[0,.55,0],.5,.75,true,.44);a.cyl('stone',[0,.95,0],.51,.12);a.cyl('metal',[0,1.08,0],.54,.14,true,.44);
 a.box('metal',[0,.59,.46],[.55,.53,.12]);a.box('signal',[0,.61,.53],[.38,.32,.018]);for(const x of[-.13,0,.13])a.box('metal',[x,.61,.55],[.025,.35,.025]);a.box('paper',[.27,.56,.55],[.12,.045,.05]);
 // Readable cast-iron door, brass pressure dial and a cold-weather windbreak.
 for(const y of[.41,.8])a.box('metal',[-.29,y,.53],[.08,.055,.09],false,[0,0,0],.68);
 a.add('metal',new THREE.CylinderGeometry(.11,.11,.045,12),[.24,.89,.45],false,[Math.PI/2,0,0]);
 a.add('paper',new THREE.CircleGeometry(.081,12),[.24,.89,.476]);
 a.beam('metal',[.24,.89,.483],[.28,.94,.483],.009);
 for(const y of[.34,.85])a.add('metal',new THREE.TorusGeometry(.49,.018,4,12),[0,y,0],false,[Math.PI/2,0,0]);
 a.cyl('metal',[0,1.9,-.12],.13,1.6,true);a.cyl('metal',[0,2.72,-.12],.28,.16,false,.12);a.cyl('paper',[0,2.83,-.12],.29,.06,false,.15);
 for(const x of[-1.15,1.15])a.beam('wood',[x,0,-.65],[x,1.8,-.65],.075,true);for(let i=0;i<7;i++)a.box('wood',[0,.25+i*.21,-.7],[2.3,.16,.12],true,[0,0,0],i%2?.86:1.08);
 a.box('paper',[0,1.76,-.7],[2.5,.12,.28]);a.cloth(.8,1.28,-.58,.46,.65);
 for(const x of[-.85,.85]){a.cyl('wood',[x,.27,.13],.13,.5);a.box('complete',[x,.54,.13],[.3,.06,.3]);}for(let i=0;i<3;i++)a.beam('wood',[-.8,.16+i*.14,.5],[-.8,.16+i*.14,-.3],.085);
}
function kyoto(a:Art){
 a.plinth('stone',1.55,1.35,.04,.15);a.cyl('wood',[0,1.85,0],.075,3.7,true);for(let y=.4;y<3.7;y+=.48)a.cyl('paper',[0,y,0],.087,.045);
 a.beam('wood',[-.8,3.4,0],[.8,3.4,0],.065);a.beam('wood',[0,2.9,0],[.65,3.4,0],.045);a.lantern(-.55,2.25,0,.8);a.lantern(.55,2.05,0,1);a.beam('metal',[-.55,3.08,0],[-.55,3.4,0],.018);a.beam('metal',[.55,3.09,0],[.55,3.4,0],.018);
 for(const s of[-1,1]){a.eave(s);a.box('wood',[s*.84,3.52,0],[.12,.12,.98]);
  for(const z of[-.34,0,.34])a.beam('wood',[0,3.53,z],[s*.84,3.4,z],.023);
 }a.beam('metal',[0,3.68,-.475],[0,3.68,.475],.075);
 a.cloth(.2,1.55,.08,.34,.65,'split');a.box('paper',[.2,1.58,.15],[.045,.29,.02]);for(let i=0;i<3;i++){const x=-.47+i*.3;a.box('complete',[x,.66,.23],[.19,.32,.05],false,[0,0,(i-1)*.09]);a.box('metal',[x,.7,.26],[.07,.1,.018]);}
 a.box('wood',[0,.42,.1],[1.25,.13,.65],true);for(const x of[-.46,.46])a.box('wood',[x,.22,.1],[.1,.4,.45],true);
}
export function createEraStoryScene(placement:SettlementPlacement){
 if(placement.id==='alpha')throw new Error('Valley has its own scene');const region=placement.id,spec=ERA_OPTIONALS[region],origin=placement.position.map((v,i)=>v+ERA_SCENE_LOCAL[region][i]) as V3;
 const art=new Art(region);({britain,blacksail,winter,kyoto}[region])(art);art.finish(origin,region);
 const collisionGeometry=mergeParts(art.solids);art.solids.forEach(g=>g.dispose());art.solids.length=0;collisionGeometry.translate(...origin);const colliders:Collider[]=[{name:`EraStation_${region}`,enabled:true,bvh:new MeshBVH(collisionGeometry)}];
 const markers:Marker[]=[{id:spec.id,type:'interact',label:spec.label[0],p:[origin[0],origin[1]+1.15,origin[2]+.9],radius:2.35}];let disposed=false;
 function applyState(state:Pick<EraStoryState,'routeReady'|'complete'|'discovered'>){if(disposed)return;art.materials.signal.emissiveIntensity=state.discovered?1.25:0;art.materials.signal.color.setHex(state.discovered?0xffd58c:0x9a947e);art.materials.complete.emissiveIntensity=state.complete?.4:0;art.materials.complete.color.setHex(state.complete?0xf4d797:state.discovered?0xb7a178:0x8d8b79);art.materials.cloth.color.setHex(state.routeReady||state.complete?({britain:0x6e91ca,blacksail:0x4eac9b,winter:0x7d9db7,kyoto:0xc76644}[region]):({britain:0x657da2,blacksail:0x398585,winter:0x66839c,kyoto:0xa24b3c}[region]));art.group.userData.state={...state};}
 applyState({routeReady:false,complete:false,discovered:false});
 return {group:art.group,markers,colliders,applyState,updateVisibility(player:Pick<THREE.Vector3,'x'|'z'>){if(!disposed)art.group.visible=Math.hypot(player.x-origin[0],player.z-origin[2])<180;},dispose(){if(disposed)return;disposed=true;colliders.forEach(c=>c.enabled=false);art.group.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});collisionGeometry.dispose();Object.values(art.materials).forEach(m=>{m.map?.dispose();m.dispose();});art.group.removeFromParent();art.group.clear();}};
}

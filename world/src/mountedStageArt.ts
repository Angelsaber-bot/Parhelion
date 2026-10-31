import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {radialGeometry} from './saberStageArt';
import {EraBladeTrace} from './eraBladeTrace';
import type {EraArtFrame,EraArtOwner} from './eraStageArt';
export class MountedStageArt {
 readonly root=new THREE.Group();private blade:EraBladeTrace;private hooves:THREE.Object3D[];private shadows:THREE.Mesh[]=[];
 private snow:THREE.Mesh[]=[];private origins:THREE.Vector3[]=[];private flags:THREE.Group[]=[];private count=0;private fired=-100;
 private chargeLight=new THREE.PointLight(0xffe6b0,0,14,2); private clothMeshes:THREE.Mesh[]=[];
 private hoofFloor:number[]=[];private hoofLast:number[]=[];private hoofDown:boolean[]=[];private puffAges=new Float32Array(16).fill(10);private prints:THREE.Mesh[]=[];private slot=0;private lastTime=0;
 private point=new THREE.Vector3();private impact:THREE.Mesh;private material:THREE.MeshBasicMaterial;
 constructor(private actor:THREE.Group,clone:THREE.Object3D,owner:EraArtOwner){
  this.root.name='Napoleon: white horse snow charge';
  const ground=owner.material(0x536778,1);const floor=owner.mesh(new THREE.PlaneGeometry(36,70),ground,this.root);floor.rotation.x=-Math.PI/2;floor.position.set(0,-.035,-20);
  this.hooves=['H_ForeHoof_L','H_ForeHoof_R','H_HindHoof_L','H_HindHoof_R'].map(n=>clone.getObjectByName(n)).filter((n):n is THREE.Object3D=>!!n);
  const shadowMaterial=owner.material(0x102638,.55);shadowMaterial.vertexColors=true;const shadowGeometry=radialGeometry(.38);
  for(let i=0;i<4;i++){const shadow=owner.mesh(shadowGeometry,shadowMaterial,this.root);shadow.rotation.x=-Math.PI/2;shadow.position.y=.012;shadow.name='Napoleon hoof contact '+i;this.shadows.push(shadow);}
  const powderGeometry=radialGeometry(.35),powderMaterial=owner.material(0xd1e4ed,.3);powderMaterial.vertexColors=true;
  for(let i=0;i<16;i++){const particle=owner.mesh(powderGeometry,powderMaterial,this.root);particle.name='Napoleon hoof snow '+i;this.snow.push(particle);this.origins.push(new THREE.Vector3());}
  actor.updateWorldMatrix(true,true);this.hooves.forEach(hoof=>{const y=hoof.getWorldPosition(new THREE.Vector3()).y;this.hoofFloor.push(y);this.hoofLast.push(y);this.hoofDown.push(true);});
  const printMaterial=owner.material(0x456171,.24);printMaterial.vertexColors=true;for(let i=0;i<8;i++){const mark=owner.mesh(radialGeometry(1),printMaterial,this.root);mark.name='Napoleon grounded hoofprint '+i;mark.rotation.x=-Math.PI/2;mark.scale.set(.10,.17,1);mark.visible=false;this.prints.push(mark);}
  this.material=owner.material(0xf4dfac,.65);this.material.vertexColors=true;this.impact=owner.mesh(radialGeometry(1),this.material,this.root);this.impact.name='Napoleon ground impact';this.impact.rotation.x=-Math.PI/2;this.impact.visible=false;
  // Swallow-tail cloth with original gold wing mark, not rectangular light pillars.
  const cloth=new THREE.MeshStandardMaterial({color:0x671f32,roughness:.9,side:THREE.DoubleSide}),gold=owner.material(0xc7a055,.9),pole=owner.material(0x5c6570,1);
  const flagGeometry=new THREE.PlaneGeometry(1.3,2.4,8,12);flagGeometry.translate(.65,-1.2,0);const fp=flagGeometry.attributes.position;for(let i=0;i<fp.count;i++){const x=fp.getX(i),y=fp.getY(i);fp.setY(i,y+(Math.max(0,(-y-1.8)/.6))*.45*(1-Math.abs(x-.65)/.65));}
  const markGeometry=new THREE.BufferGeometry();markGeometry.setAttribute('position',new THREE.Float32BufferAttribute([.2,-.65,.08,.65,-.95,.09,1.1,-.65,.15,.65,-1.3,.12],3));markGeometry.setIndex([0,1,3,1,2,3]);
  for(const side of[-1,1])for(let i=0;i<4;i++){const group=new THREE.Group();group.position.set(side*(3.7+i*.4),0,-2-i*5.5);this.root.add(group);const mast=owner.mesh(new THREE.CylinderGeometry(.025,.04,5.2,5),pole,group);mast.position.y=2.6;const banner=owner.mesh(flagGeometry.clone(),cloth,group);banner.name='Napoleon animated dimensional banner';this.clothMeshes.push(banner);banner.position.y=4.9;banner.scale.x=side<0?1:-1;const mark=owner.mesh(markGeometry,gold,group);mark.position.y=4.9;mark.scale.x=banner.scale.x;this.flags.push(group);}
  flagGeometry.dispose();
  this.buildSnowAvenue(owner);
  this.blade=new EraBladeTrace('Napoleon sword',clone.getObjectByName('SaberSocket'),clone.getObjectByName('SaberTip'),new THREE.Vector3(0,1,0),this.root,owner,0xe5c791);
 }
 private buildSnowAvenue(owner:EraArtOwner){
  const stone:THREE.BufferGeometry[]=[],snow:THREE.BufferGeometry[]=[],dark:THREE.BufferGeometry[]=[],needles:THREE.BufferGeometry[]=[];
  const box=(list:THREE.BufferGeometry[],x:number,y:number,z:number,sx:number,sy:number,sz:number)=>{const g=new THREE.BoxGeometry(sx,sy,sz);g.translate(x,y,z);list.push(g);};
  // Uneven frozen banks, with a broad uninterrupted central charge corridor.
  for(const side of[-1,1]){
   for(let i=0;i<13;i++){
    const z=7-i*4.8,x=side*(4.1+.18*Math.sin(i*2));
    const mound=new THREE.SphereGeometry(1,10,6);mound.scale(1.7,.32+(i%3)*.08,3.2);mound.translate(x,.12,z);snow.push(mound);
    if(i%2===0){
     const tx=side*(6.8+(i%3)*.65);box(dark,tx,1.0,z,.18,2.0,.18);
     for(let j=0;j<3;j++){const g=new THREE.ConeGeometry(1.1-j*.2,1.7,7);g.translate(tx,1.8+j*.72,z);needles.push(g);const cap=new THREE.ConeGeometry(1.02-j*.2,1.25,7);cap.translate(tx,2.01+j*.72,z);snow.push(cap);}
    }
   }
   // Rhythm of actual stone posts creates lateral parallax in the tracking shot.
   for(let i=0;i<7;i++){
    const z=2-i*7.0,x=side*4.65;box(stone,x,.25,z,.7,.5,.7);box(stone,x,1.18,z,.40,1.5,.40);box(stone,x,1.98,z,.64,.12,.64);box(snow,x,2.07,z,.67,.07,.67);
    if(i<6)box(dark,x,1.0,z-3.5,.10,.11,6.6);
   }
  }
  // Distant triumphal gate frames the white horse without placing a wall in its path.
  for(const x of[-5.5,5.5]){box(stone,x,4.1,-31,2.8,8.2,2.4);box(stone,x,.4,-31,3.3,.8,2.9);box(stone,x,8.4,-31,3.4,.5,2.8);box(snow,x,8.7,-31,3.5,.13,2.9);}
  box(stone,0,8.7,-31,14.6,.8,2.7);box(stone,0,9.5,-31,13.8,.8,2.3);box(snow,0,9.95,-31,14,.12,2.5);
  // Pillar fluting is merged, so more architectural shape does not add draw calls.
  for(const side of[-1,1])for(let j=0;j<4;j++){const col=new THREE.CylinderGeometry(.14,.16,6.4,8);col.translate(side*5.5-.75+j*.5,4.3,-29.73);stone.push(col);}
  const emit=(list:THREE.BufferGeometry[],material:THREE.Material,name:string)=>{const g=mergeGeometries(list);for(const p of list)p.dispose();if(g){const mesh=owner.mesh(g,material,this.root);mesh.name=name;}};
  emit(stone,new THREE.MeshStandardMaterial({color:0x8e9ba2,roughness:.9}),'Napoleon stone avenue and triumphal gate');
  emit(snow,new THREE.MeshStandardMaterial({color:0xe4edf0,roughness:.95}),'Napoleon sculpted snowbanks and snowy pine branches');
  emit(dark,new THREE.MeshStandardMaterial({color:0x43484d,roughness:.92}),'Napoleon avenue rail and tree trunks');
  emit(needles,new THREE.MeshStandardMaterial({color:0x253f43,roughness:1}),'Napoleon dimensional pine foliage');
  const terrain=new THREE.PlaneGeometry(9,80,12,60);terrain.rotateX(-Math.PI/2);terrain.translate(0,-.024,-24);const p=terrain.attributes.position;
  for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i);p.setY(i,-.018+.012*Math.sin(x*5+z*.7)+.009*Math.cos(z*2.2));}terrain.computeVertexNormals();
  const road=owner.mesh(terrain,new THREE.MeshStandardMaterial({color:0xc5d5df,roughness:.95}),this.root);road.name='Napoleon uneven frozen road';
  this.chargeLight.name='Napoleon saber reflected gold light';this.root.add(this.chargeLight);
 }
 update(frame:EraArtFrame,camera:THREE.Camera,reduced:boolean){
  const next=frame.strikeCount??0;if(frame.phase==='release'&&next>this.count){this.count=next;this.fired=frame.elapsed;this.blade.trigger(frame.elapsed);}
  this.chargeLight.position.set(this.actor.position.x,2.3,this.actor.position.z+.8);this.chargeLight.intensity=reduced?0:Math.max(0,1-(frame.elapsed-this.fired)/.45)*9;
  this.actor.updateMatrixWorld(true);this.blade.update(frame,camera,reduced);
  for(let i=0;i<this.shadows.length;i++){const hoof=this.hooves[i];if(hoof)hoof.getWorldPosition(this.point);else this.point.set((i%2?1:-1)*.4,0,i<2?.8:-.8);this.shadows[i].position.x=this.point.x;this.shadows[i].position.z=this.point.z;}
  const moving=frame.phase==='charge'||frame.phase==='release',dt=Math.max(0,Math.min(.1,frame.elapsed-this.lastTime));this.lastTime=frame.elapsed;
  // Snow comes from measured descending hoof contact, not a constant floating
  // particle fountain. Snapshot each impact so powder stays on the road as the
  // white horse travels onward. This is private visual state, never gameplay.
  for(let i=0;i<this.hooves.length;i++){
   this.hooves[i].getWorldPosition(this.point);const down=this.point.y<=this.hoofFloor[i]+.045,descending=this.point.y<this.hoofLast[i]-.0001;
   if(moving&&down&&!this.hoofDown[i]&&descending){const slot=this.slot++%this.snow.length;this.puffAges[slot]=0;this.origins[slot].set(this.point.x,.015,this.point.z);const mark=this.prints[slot%this.prints.length];mark.position.copy(this.origins[slot]);mark.visible=!reduced;}
   this.hoofDown[i]=down;this.hoofLast[i]=this.point.y;
  }
  for(let i=0;i<this.snow.length;i++){this.puffAges[i]+=dt;const age=this.puffAges[i],p=this.snow[i];p.visible=age<.55&&(!reduced||i%4===0);p.position.copy(this.origins[i]);p.position.x+=Math.sin(i*2.4)*age*.25;p.position.y+=age*.28;p.position.z-=age*.45;p.quaternion.copy(camera.quaternion);p.scale.setScalar((.10+age*.8)*(1-age/.65));}
  for(const mark of this.prints)if(reduced||frame.phase==='intro')mark.visible=false;
  const age=frame.elapsed-this.fired;this.impact.visible=(frame.phase==='release'||frame.phase==='outro')&&age>=0&&age<.55;this.impact.position.set(this.actor.position.x,.006,this.actor.position.z+.6);this.impact.scale.setScalar(.3+Math.max(0,age)*(reduced?2:4));this.material.opacity=Math.max(0,1-age/.55)*(reduced?.3:.65);
  for(let i=0;i<this.flags.length;i++){this.flags[i].rotation.z=reduced?0:Math.sin(frame.elapsed*1.2+i)*.018;const geometry=this.clothMeshes[i].geometry,p=geometry.attributes.position;for(let v=0;v<p.count;v++){const x=p.getX(v),y=p.getY(v);p.setZ(v,(reduced?0:.055*Math.sin(x*4+y*3+frame.elapsed*4+i*.7))*(x/1.3));}p.needsUpdate=true;geometry.computeVertexNormals();}
 }
 dispose(){this.blade.dispose();this.root.clear();this.hooves=[];this.shadows=[];this.snow=[];this.origins=[];this.flags=[];this.clothMeshes=[];this.prints=[];this.hoofFloor=[];this.hoofLast=[];this.hoofDown=[];}
}

import * as THREE from 'three';
import {radialGeometry} from './saberStageArt';
import {EraBladeTrace} from './eraBladeTrace';
import type {EraArtFrame,EraArtOwner} from './eraStageArt';
export class MountedStageArt {
 readonly root=new THREE.Group();private blade:EraBladeTrace;private hooves:THREE.Object3D[];private shadows:THREE.Mesh[]=[];
 private snow:THREE.Mesh[]=[];private origins:THREE.Vector3[]=[];private flags:THREE.Group[]=[];private count=0;private fired=-100;
 private point=new THREE.Vector3();private impact:THREE.Mesh;private material:THREE.MeshBasicMaterial;
 constructor(private actor:THREE.Group,clone:THREE.Object3D,owner:EraArtOwner){
  this.root.name='Napoleon: white horse snow charge';
  const ground=owner.material(0x536778,1);const floor=owner.mesh(new THREE.PlaneGeometry(36,70),ground,this.root);floor.rotation.x=-Math.PI/2;floor.position.set(0,-.035,-20);
  this.hooves=['H_ForeHoof_L','H_ForeHoof_R','H_HindHoof_L','H_HindHoof_R'].map(n=>clone.getObjectByName(n)).filter((n):n is THREE.Object3D=>!!n);
  const shadowMaterial=owner.material(0x102638,.55);shadowMaterial.vertexColors=true;const shadowGeometry=radialGeometry(.38);
  for(let i=0;i<4;i++){const shadow=owner.mesh(shadowGeometry,shadowMaterial,this.root);shadow.rotation.x=-Math.PI/2;shadow.position.y=-.018;shadow.name='Napoleon hoof contact '+i;this.shadows.push(shadow);}
  const powderGeometry=radialGeometry(.35),powderMaterial=owner.material(0xd1e4ed,.3);powderMaterial.vertexColors=true;
  for(let i=0;i<16;i++){const particle=owner.mesh(powderGeometry,powderMaterial,this.root);particle.name='Napoleon hoof snow '+i;this.snow.push(particle);this.origins.push(new THREE.Vector3());}
  this.material=owner.material(0xf4dfac,.65);this.material.vertexColors=true;this.impact=owner.mesh(radialGeometry(1),this.material,this.root);this.impact.name='Napoleon ground impact';this.impact.rotation.x=-Math.PI/2;this.impact.visible=false;
  // Swallow-tail cloth with original gold wing mark, not rectangular light pillars.
  const cloth=owner.material(0x501f2c,1),gold=owner.material(0xc7a055,.9),pole=owner.material(0x5c6570,1);
  const flagGeometry=new THREE.BufferGeometry();flagGeometry.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,1.3,0,.12,1.3,-2.4,0,.65,-1.95,-.05,0,-2.4,0],3));flagGeometry.setIndex([0,1,3,1,2,3,0,3,4]);
  const markGeometry=new THREE.BufferGeometry();markGeometry.setAttribute('position',new THREE.Float32BufferAttribute([.2,-.65,.08,.65,-.95,.09,1.1,-.65,.15,.65,-1.3,.12],3));markGeometry.setIndex([0,1,3,1,2,3]);
  for(const side of[-1,1])for(let i=0;i<4;i++){const group=new THREE.Group();group.position.set(side*(3.7+i*.4),0,-2-i*5.5);this.root.add(group);const mast=owner.mesh(new THREE.CylinderGeometry(.025,.04,5.2,5),pole,group);mast.position.y=2.6;const banner=owner.mesh(flagGeometry,cloth,group);banner.position.y=4.9;banner.scale.x=side<0?1:-1;const mark=owner.mesh(markGeometry,gold,group);mark.position.y=4.9;mark.scale.x=banner.scale.x;this.flags.push(group);}
  this.blade=new EraBladeTrace('Napoleon sword',clone.getObjectByName('SaberSocket'),clone.getObjectByName('SaberTip'),new THREE.Vector3(0,1,0),this.root,owner,0xe5c791);
 }
 update(frame:EraArtFrame,camera:THREE.Camera,reduced:boolean){
  const next=frame.strikeCount??0;if(frame.phase==='release'&&next>this.count){this.count=next;this.fired=frame.elapsed;this.blade.trigger(frame.elapsed);}
  this.actor.updateMatrixWorld(true);this.blade.update(frame,camera,reduced);
  for(let i=0;i<this.shadows.length;i++){const hoof=this.hooves[i];if(hoof)hoof.getWorldPosition(this.point);else this.point.set((i%2?1:-1)*.4,0,i<2?.8:-.8);this.shadows[i].position.x=this.point.x;this.shadows[i].position.z=this.point.z;}
  const moving=frame.phase==='charge'||frame.phase==='release';
  for(let i=0;i<this.snow.length;i++){const p=this.snow[i];p.visible=moving&&(!reduced||i%4===0);const t=(frame.elapsed*(reduced?.7:1.8)+i/4)%1,hoof=this.shadows[i%4];p.position.set(hoof.position.x+Math.sin(i*2.4)*t*.4,.04+t*.18,hoof.position.z-t*(reduced?.6:1.5));p.quaternion.copy(camera.quaternion);p.scale.setScalar(.15+t*.7);}
  const age=frame.elapsed-this.fired;this.impact.visible=(frame.phase==='release'||frame.phase==='outro')&&age>=0&&age<.55;this.impact.position.set(this.actor.position.x,.006,this.actor.position.z+.6);this.impact.scale.setScalar(.3+Math.max(0,age)*(reduced?2:4));this.material.opacity=Math.max(0,1-age/.55)*(reduced?.3:.65);
  for(let i=0;i<this.flags.length;i++)this.flags[i].rotation.z=reduced?0:Math.sin(frame.elapsed*1.2+i)*.018;
 }
 dispose(){this.blade.dispose();this.root.clear();this.hooves=[];this.shadows=[];this.snow=[];this.origins=[];this.flags=[];}
}

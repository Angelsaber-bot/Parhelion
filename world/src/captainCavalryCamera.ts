import * as THREE from 'three';
import type {EraArtFrame} from './eraStageArt';
const ease=(x:number)=>{x=THREE.MathUtils.clamp(x,0,1);return x*x*(3-2*x);};
/** Dedicated composition after the current pose and base shot. Aim also drives narrow-aspect fitting. */
export class CaptainCavalryCamera {
 readonly aim=new THREE.Vector3();private head?:THREE.Object3D;private point=new THREE.Vector3();
 shot='';
 constructor(private identity:string,private actor:THREE.Group,clone:THREE.Object3D){this.head=clone.getObjectByName('Head');}
 update(frame:EraArtFrame,camera:THREE.PerspectiveCamera,reduced:boolean):THREE.Vector3 {
  const mounted=this.identity==='napoleon'||this.identity==='napoleonMounted',p=ease(frame.progress),center=this.actor.position;
  if(!this.actor.visible){this.shot='real broadside barrel insert';camera.getWorldDirection(this.aim).multiplyScalar(6).add(camera.position);return this.aim;}
  this.actor.updateWorldMatrix(true,true);if(this.head)this.head.getWorldPosition(this.point);else this.point.copy(center).y+=2.5;
  if(reduced){this.shot='steady complete silhouette';this.aim.set(center.x,center.y+(mounted?1.9:1.43),center.z+.1);camera.position.set(center.x+(mounted?-3.3:1.15),center.y+2.3,center.z+(mounted?8:7.1));camera.fov=41;}
  else if(frame.phase==='intro'){
   this.shot=mounted?'rider resolve and sword guard':'tricorn captain and flintlock reveal';this.aim.copy(this.point).add(new THREE.Vector3(mounted?-.08:-.10,mounted?-.10:.045,.03));
   camera.position.copy(this.point).add(new THREE.Vector3(mounted?-.65:-.85+p*.25,mounted?.04:.18,mounted?2.55:2.85));camera.fov=38;
  }else if(frame.phase==='charge'){
   this.shot=mounted?'white-horse acceleration and rein control':'planted quarterdeck broadside command';this.aim.set(center.x+(mounted?-.1:.18),center.y+(mounted?1.9:1.48),center.z+.08);
   camera.position.set(center.x+(mounted?-3.4-p*.6:-1.5-p*.8),center.y+(mounted?2.35:2.25),center.z+(mounted?7.4:6.1)+p*.45);camera.fov=40;
  }else if(frame.phase==='release'){
   this.shot=mounted?'native cavalry blade contact':'native flintlock fire and body recoil';this.aim.set(center.x+(mounted?-.15:.1),center.y+(mounted?1.72:1.45),center.z+.2);
   camera.position.set(center.x+(mounted?-5.1:1.75),center.y+(mounted?2.7:2.1),center.z+(mounted?5.7:6.5));camera.fov=41;
  }else{
   this.shot=mounted?'controlled cavalry recovery':'captain lowers command after broadside';this.aim.set(center.x,center.y+(mounted?1.75:1.5),center.z+.1);
   camera.position.set(center.x+(mounted?-3.8:1.4),center.y+2.45,center.z+6.9);camera.fov=41;
  }
  camera.lookAt(this.aim);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);return this.aim;
 }
}

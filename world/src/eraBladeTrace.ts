import * as THREE from 'three';
import {radialGeometry} from './saberStageArt';
import {ultimateEnergyGeometry} from './ultimateEnergy';
import type {EraArtOwner,EraArtFrame} from './eraStageArt';
export interface EraBladeTraceReadability {
 /** Multipliers default to one; only explicitly opted-in identities change. */
 readonly trailOpacityScale?: number; readonly edgeOpacityScale?: number;
 readonly glintOpacityScale?: number; readonly glintScale?: number; readonly edgeWidthScale?: number;
}
/** Time-bounded actual blade samples, not a detached pre-drawn arc. */
export class EraBladeTrace {
 readonly grip=new THREE.Vector3();readonly tip=new THREE.Vector3();
 private points=Array.from({length:10},()=>({grip:new THREE.Vector3(),tip:new THREE.Vector3(),time:0}));
 private positions=new THREE.BufferAttribute(new Float32Array(10*3*3),3);private colors=new THREE.BufferAttribute(new Float32Array(10*3*4),4);
 private trail:THREE.Mesh;private edge:THREE.Mesh;private glint:THREE.Mesh;private ready=false;private lastTime=-1;private fired=-100;
 private axis=new THREE.Vector3();private cameraDir=new THREE.Vector3();private x=new THREE.Vector3();private z=new THREE.Vector3();private p=new THREE.Vector3();private basis=new THREE.Matrix4();
 constructor(name:string,private socket:THREE.Object3D|undefined,private tipNode:THREE.Object3D|undefined,private localTip:THREE.Vector3,parent:THREE.Object3D,owner:EraArtOwner,color:number,private readonly readability:EraBladeTraceReadability={}){
  const geometry=new THREE.BufferGeometry(),indices:number[]=[];this.positions.setUsage(THREE.DynamicDrawUsage);this.colors.setUsage(THREE.DynamicDrawUsage);
  for(let i=0;i<9;i++)for(let j=0;j<2;j++){let a=i*3+j;indices.push(a,a+3,a+1,a+1,a+3,a+4);}geometry.setAttribute('position',this.positions);geometry.setAttribute('color',this.colors);geometry.setIndex(indices);
  const material=owner.material(color,.75);material.vertexColors=true;material.toneMapped=false;
  this.trail=owner.mesh(geometry,material,parent);this.trail.frustumCulled=false;this.trail.name=name+' sampled trail';this.trail.visible=false;
  const edgeMaterial=owner.material(color,.72);edgeMaterial.vertexColors=true;edgeMaterial.toneMapped=false;
  this.edge=owner.mesh(ultimateEnergyGeometry('lance'),edgeMaterial,parent);this.edge.name=name+' blade edge';
  const glintMaterial=owner.material(0xfff2dc,.8);glintMaterial.vertexColors=true;glintMaterial.toneMapped=false;
  this.glint=owner.mesh(radialGeometry(.22),glintMaterial,parent);this.glint.name=name+' tip contact';this.glint.visible=false;
 }
 trigger(elapsed:number){this.fired=elapsed;}
 update(frame:EraArtFrame,camera:THREE.Camera,reduced:boolean){
  if(this.socket)this.socket.getWorldPosition(this.grip);else this.grip.set(0,1.4,0);
  if(this.tipNode)this.tipNode.getWorldPosition(this.tip);else if(this.socket)this.tip.copy(this.localTip).applyMatrix4(this.socket.matrixWorld);else this.tip.copy(this.grip).add(this.localTip);
  if(!this.ready){for(const p of this.points){p.grip.copy(this.grip);p.tip.copy(this.tip);p.time=frame.elapsed;}this.ready=true;}
  if(frame.elapsed>this.lastTime){for(let i=9;i>0;i--){this.points[i].grip.copy(this.points[i-1].grip);this.points[i].tip.copy(this.points[i-1].tip);this.points[i].time=this.points[i-1].time;}this.points[0].grip.copy(this.grip);this.points[0].tip.copy(this.tip);this.points[0].time=frame.elapsed;this.lastTime=frame.elapsed;}
  const age=frame.elapsed-this.fired,releaseVisual=(frame.phase==='release'||frame.phase==='outro')&&age>=0&&age<.48;
  for(let i=0;i<10;i++)for(let j=0;j<3;j++){this.p.lerpVectors(this.points[i].grip,this.points[i].tip,j/2);this.positions.setXYZ(i*3+j,this.p.x,this.p.y,this.p.z);this.colors.setXYZW(i*3+j,1,.96,.90,j===1?Math.max(0,1-(frame.elapsed-this.points[i].time)/.16)*.8:0);}
  this.positions.needsUpdate=this.colors.needsUpdate=true;this.trail.visible=releaseVisual&&!reduced;
  (this.trail.material as THREE.MeshBasicMaterial).opacity=Math.max(0,1-age/.48)*.75*(this.readability.trailOpacityScale??1);
  this.axis.copy(this.tip).sub(this.grip);const length=Math.max(.01,this.axis.length());this.axis.multiplyScalar(1/length);
  this.edge.position.copy(this.grip).add(this.tip).multiplyScalar(.5);this.cameraDir.copy(camera.position).sub(this.edge.position).normalize();this.x.crossVectors(this.axis,this.cameraDir).normalize();if(this.x.lengthSq()<.01)this.x.set(1,0,0);this.z.crossVectors(this.x,this.axis).normalize();this.basis.makeBasis(this.x,this.axis,this.z);this.edge.quaternion.setFromRotationMatrix(this.basis);this.edge.position.addScaledVector(this.cameraDir,.025);
  this.edge.visible=frame.phase==='charge'||releaseVisual;this.edge.scale.set((reduced?.035:frame.phase==='charge'?.05+.035*frame.progress:.09)*(this.readability.edgeWidthScale??1),length/12*1.08,1);
  (this.edge.material as THREE.MeshBasicMaterial).opacity=(reduced?.38:frame.phase==='charge'?.35+frame.progress*.3:Math.max(0,1-age/.48)*.8)*(this.readability.edgeOpacityScale??1);
  this.glint.visible=releaseVisual&&age<.18;this.glint.position.copy(this.tip);this.glint.quaternion.copy(camera.quaternion);this.glint.scale.setScalar((reduced?.6:1+age*2)*(this.readability.glintScale??1));
  (this.glint.material as THREE.MeshBasicMaterial).opacity=Math.max(0,1-age/.18)*(reduced?.3:.8)*(this.readability.glintOpacityScale??1);
 }
 dispose(){this.socket=undefined;this.tipNode=undefined;this.points=[];}
}

import * as THREE from 'three';
import type { EraArtFrame, EraArtOwner } from './eraStageArt';
import { attachCinematicTricorn } from './cinematicTricorn';
const clamp=(x:number)=>THREE.MathUtils.clamp(Number.isFinite(x)?x:0,0,1);
const ease=(x:number)=>{x=clamp(x);return x*x*(3-2*x);};
interface VertexPose{mesh:THREE.Mesh;original:THREE.BufferGeometry;geometry:THREE.BufferGeometry;base:Float32Array;kind:'eye'|'jaw'|'brow'|'cloth'|'hair';ids:Uint32Array;centerY:number;}
interface MorphPose{mesh:THREE.Mesh;values:number[];names:Record<string,number>;}
/** Clone-local real 3D geometry/morph acting and shots. No actor portraits, damage
 * events, texture downloads, or ownership of original character resources. */
export class EraCinematicRemake{
 readonly root=new THREE.Group();readonly aim=new THREE.Vector3();
 private head?:THREE.Object3D;private poses:VertexPose[]=[];private morphs:MorphPose[]=[];
 private materials:{mesh:THREE.Mesh;original:THREE.Material|THREE.Material[];copies:THREE.Material[]}[]=[];
 private headPosition=new THREE.Vector3();private scale=new THREE.Vector3();private lastStrike=0;private strikeTime=-100;private disposed=false;
 private key=new THREE.PointLight(0xffcf8c,0,8,2);private fill=new THREE.PointLight(0x89b9ff,.7,7,2);private currentShot='portrait';private disposeHat?:()=>void;
 get shot(){return this.currentShot;}
 get expressionChannels(){return{morphMeshes:this.morphs.length,geometryChannels:this.poses.length};}
 constructor(private actor:THREE.Group,private clone:THREE.Object3D,private identity:string,_owner:EraArtOwner){
  this.root.name=`${identity}: real 3D expressions and cinematic lighting`;
  if(identity==='musashi')this.fill.intensity=.35;
  this.head=clone.getObjectByName(identity==='musashi'?'mixamorigHead':'Head');this.root.add(this.key,this.fill);
  clone.traverse(object=>{
   const mesh=object as THREE.Mesh;if(!mesh.isMesh)return;
   const original=Array.isArray(mesh.material)?mesh.material:[mesh.material],copies=original.map(source=>{
    const m=source.clone() as THREE.MeshStandardMaterial;
    if(m.isMeshStandardMaterial){if(/skin|porcelain/i.test(m.name)){m.roughness=.58;m.metalness=0;}if(/steel|silver|brass|gold|gilded/i.test(m.name))m.roughness=Math.max(.24,Math.min(.48,m.roughness));if(/iris|pupil|sclera|eyes/i.test(m.name))m.roughness=.28;}return m;
   });this.materials.push({mesh,original:mesh.material,copies});mesh.material=Array.isArray(mesh.material)?copies:copies[0];
   if(mesh.morphTargetDictionary&&mesh.morphTargetInfluences){this.morphs.push({mesh,values:[...mesh.morphTargetInfluences],names:mesh.morphTargetDictionary});return;}
   const names=original.map(m=>m.name).join(' ');let kind:VertexPose['kind']|undefined;
   if(identity!=='musashi'&&/sclera|iris|pupil|eye glint|eye catchlight/i.test(names)&&!/Horse|Eyes ·/i.test(names))kind='eye';
   else if(identity!=='musashi'&&/eyebrows/i.test(names))kind='brow';
   else if(identity!=='musashi'&&/warm tan skin|Napoleon warm skin|mouth interior|tooth enamel/i.test(names))kind='jaw';
   else if(/hair|mane|tail/i.test(names)&&!/eyebrow/i.test(names))kind='hair';
   else if(/kimono|coat|crimson|linen|fur|twill/i.test(names)&&!/saddle|photographed microdetail/i.test(names)&&!/Horse_Body/i.test(mesh.name))kind='cloth';
   if(!kind||!mesh.geometry.attributes.position)return;
   const old=mesh.geometry,geometry=old.clone(),position=geometry.attributes.position,base=new Float32Array(position.array),ids:number[]=[],offset=identity==='napoleon'?.735:0;
   for(let i=0;i<position.count;i++){const x=position.getX(i),y=position.getY(i),z=position.getZ(i);if(kind==='eye'||kind==='brow'||kind==='hair'||kind==='jaw'&&Math.abs(x)<.085&&y>1.68+offset&&y<1.81+offset&&z>.09||kind==='cloth'&&y<1.30+offset)ids.push(i);}
   if(!ids.length){geometry.dispose();return;}mesh.geometry=geometry;this.poses.push({mesh,original:old,geometry,base,kind,ids:Uint32Array.from(ids),centerY:1.857+offset});
  });
  if(identity==='blackbeard')this.disposeHat=attachCinematicTricorn(clone);
 }
 update(frame:EraArtFrame,camera:THREE.PerspectiveCamera,reduced:boolean){
  if(this.disposed||!Number.isFinite(frame.elapsed))return;
  const p=clamp(frame.progress),time=frame.elapsed,count=frame.strikeCount??0,releasing=frame.phase==='release';
  if(count>this.lastStrike&&releasing){this.lastStrike=count;this.strikeTime=time;}
  const age=Math.max(0,time-this.strikeTime),contact=Math.exp(-age*9);
  const blink=frame.phase==='intro'?Math.pow(Math.max(0,Math.sin(p*Math.PI)),10)*.92:frame.phase==='charge'&&this.identity==='musashi'?(1-ease((p-.3)/.28))*.82:0;
  const resolve=frame.phase==='charge'?ease(p):releasing?1:frame.phase==='outro'?1-p:0,shout=releasing?(count?(.28+.65*contact):.2):0;
  for(const pose of this.morphs){const values=pose.mesh.morphTargetInfluences!;for(let i=0;i<values.length;i++)values[i]=pose.values[i]??0;const set=(name:string,v:number)=>{const i=pose.names[name];if(i!==undefined)values[i]=v;};set('Blink',blink);set('Angry',resolve*.52);set('MouthOpenA',shout*.78);set('Surprised',0);}
  for(const pose of this.poses){const pos=pose.geometry.attributes.position,b=pose.base;
   for(const i of pose.ids){const k=i*3,x=b[k],y=b[k+1],z=b[k+2];let dx=0,dy=0,dz=0;
    if(pose.kind==='eye')dy=(pose.centerY-y)*blink*.94;
    else if(pose.kind==='brow')dy=-resolve*.007*(1-Math.min(1,Math.abs(x)/.08));
    else if(pose.kind==='jaw'){const cy=1.77+(this.identity==='napoleon'?.735:0),w=Math.max(0,1-Math.abs(x)/.085)*Math.max(0,1-Math.abs(y-cy)/.095);dy=-shout*.022*w;dz=shout*.008*w;}
    else if(pose.kind==='hair'){const motion=reduced?.25:1,w=Math.min(1,Math.abs(x)*2+.15);dx=Math.sin(time*3.6+y*7+z*3)*.005*w*motion;dz=Math.sin(time*4.2+x*8+y*5)*.008*w*motion;}
    else{const offset=this.identity==='napoleon'?.735:0,w=clamp((1.3+offset-y)/.7),motion=reduced?.2:1;dx=Math.sin(time*3.3+y*6+z*2)*.009*w*motion;dz=Math.sin(time*4+x*9)*.015*w*motion;}
    pos.setXYZ(i,x+dx,y+dy,z+dz);
   }pos.needsUpdate=true;
  }
  this.actor.updateWorldMatrix(true,true);this.clone.getWorldScale(this.scale);
  if(this.head)this.head.getWorldPosition(this.headPosition);else this.headPosition.copy(this.actor.position).add(new THREE.Vector3(0,2.4,0));
  this.headPosition.y+=Math.abs(this.scale.y)*.10;
  this.fill.position.copy(this.headPosition).add(new THREE.Vector3(-1.5,.5,2));this.key.position.copy(this.headPosition).add(new THREE.Vector3(1,.3,1.8));this.key.intensity=releasing?(reduced?.6:this.identity==='musashi'?.9:2.2)*contact:frame.phase==='charge'?(this.identity==='musashi'?.15+p*.25:.25+p*.5):.1;
  // Keep the established genuine 3D cannon insert, including its hidden actor.
  if(!this.actor.visible||!this.head){this.currentShot=this.head?'broadside':'fallback';camera.getWorldDirection(this.aim).multiplyScalar(6).add(camera.position);return;}
  const center=this.actor.position,head=this.headPosition;
  if(reduced){
   // Reduced effects means a stable shot, not merely dimmer flashes. Track only
   // the actor's slow stage translation, never head bob, pulse counters or cuts.
   this.currentShot='reduced steady wide';
   const mounted=this.identity==='napoleon';
   this.aim.set(center.x,mounted?1.75:1.5,center.z+(mounted?.25:.05));
   camera.position.set(center.x+(mounted?-3.2:.6),mounted?2.35:2.1,center.z+(mounted?6.5:6.6));
   camera.fov=40;camera.lookAt(this.aim);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);return;
  }
  if(this.identity==='blackbeard'){
   if(frame.phase==='intro'){this.currentShot='captain portrait';this.aim.copy(head).add(new THREE.Vector3(0,.095,.04));camera.position.copy(head).add(new THREE.Vector3(-.45+p*.22,.10,1.95-p*.12));camera.fov=35;}
   else if(frame.phase==='charge'){this.currentShot=p<.48?'flintlock command':'quarterdeck reveal';const w=ease((p-.3)/.7);this.aim.copy(head).lerp(new THREE.Vector3(center.x,1.5,center.z),w);camera.position.set(center.x-1-w*1.5,head.y-.05-w*.35,center.z+2.8+w*3.2);camera.fov=36+w*7;}
   else{this.currentShot=frame.phase==='outro'?'captain aftermath':'command recoil';this.aim.copy(head).add(new THREE.Vector3(.1,-.35,.1));camera.position.copy(head).add(new THREE.Vector3(1.2,-.15,3.4));camera.fov=39;}
  }else if(this.identity==='napoleon'){
   if(frame.phase==='intro'){this.currentShot='rider resolve';this.aim.copy(head).add(new THREE.Vector3(0,-.04,.02));camera.position.copy(head).add(new THREE.Vector3(-.48,.02,1.8-p*.2));camera.fov=34;}
   else if(frame.phase==='charge'){this.currentShot=p<.32?'horse low tracking':'mounted charge';const w=ease(p/.6);this.aim.set(center.x,THREE.MathUtils.lerp(Math.max(1.75,head.y*.55),1.75,w),center.z+.4);camera.position.set(center.x-2.5-w*1.8,1.45+w*.75,center.z+4.5+w);camera.fov=42;}
   else{this.currentShot=frame.phase==='outro'?'snow aftermath':'cavalry cut';this.aim.set(center.x-.2,1.75,center.z+.3);camera.position.set(center.x-(reduced?4.8:5.3-p*.8),2.1,center.z+4.7);camera.fov=42;}
  }else{
   if(frame.phase==='intro'||frame.phase==='charge'&&p<.3){this.currentShot='swordswoman focus';this.aim.copy(head).add(new THREE.Vector3(0,-.01,.04));camera.position.copy(head).add(new THREE.Vector3(.4,.04,1.55));camera.fov=32;}
   else if(frame.phase==='charge'){this.currentShot='dual blade windup';const w=ease((p-.3)/.7);this.aim.copy(head).lerp(new THREE.Vector3(center.x,1.55,center.z),w);camera.position.set(center.x+1.1+w*.5,head.y-w*.7,center.z+2.6+w*3.8);camera.fov=35+w*5;}
   else{this.currentShot=count>=3?'cross finishing cut':count===2?'left blade cut':'right blade cut';this.aim.set(center.x,1.55,center.z+.12);camera.position.set(center.x+(count>=3?.15:count===2?-1.55:1.55),2,center.z+(count>=3?7:6.2));camera.fov=40;if(frame.phase==='outro'){this.currentShot='dual blade recovery';camera.position.x=center.x+.45;camera.position.z=center.z+5.8;}}
  }
  if(!reduced&&releasing&&age<.18){camera.position.x+=Math.sin(age*91)*contact*.025;camera.position.y+=Math.sin(age*71)*contact*.018;}
  camera.lookAt(this.aim);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
 }
 dispose(){if(this.disposed)return;this.disposed=true;this.disposeHat?.();this.disposeHat=undefined;for(const p of this.poses){p.mesh.geometry=p.original;p.geometry.dispose();}for(const p of this.morphs)if(p.mesh.morphTargetInfluences)p.mesh.morphTargetInfluences.splice(0,p.values.length,...p.values);for(const item of this.materials){item.mesh.material=item.original;item.copies.forEach(m=>m.dispose());}this.poses=[];this.morphs=[];this.materials=[];this.root.clear();}
}

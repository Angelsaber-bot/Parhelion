import { saberBladeTip } from './saberPresentationGeometry';
import * as THREE from 'three';
import type { UltimateStageFrame } from './ultimateStage';
interface Owner { mesh(g:THREE.BufferGeometry,m:THREE.Material,p:THREE.Object3D):THREE.Mesh; material(c:number,o:number):THREE.MeshBasicMaterial; }
const ease=(n:number)=>{n=THREE.MathUtils.clamp(n,0,1);return n*n*(3-2*n);};
/** Authored six-shot 3D film: world-space light volumes and camera, never gameplay. */
export class SaberCinematicRemake {
 readonly root=new THREE.Group();
 private head?:THREE.Object3D;private socket?:THREE.Object3D;
 private beamOrigin=new THREE.Vector3(); private offset=new THREE.Vector3();
 private eye=new THREE.Vector3();readonly aim=new THREE.Vector3();private grip=new THREE.Vector3();
 private beams:THREE.Mesh[]=[];private pillar:THREE.Mesh[]=[];private rings:THREE.Mesh[]=[];private sparks:THREE.Mesh[]=[];
 private flow: {mesh:THREE.Mesh;kind:'beam'|'column'|'flare';index:number}[]=[];
 private halo:THREE.Mesh;private glowLight=new THREE.PointLight(0xffcf64,0,10,1.8);
 private hitAt=-1;private strike=0;
 constructor(private actor:THREE.Group,private clone:THREE.Object3D,owner:Owner){
  this.root.name='Saber R3 crowned light Excalibur performance';this.head=clone.getObjectByName('mixamorigHead');this.socket=clone.getObjectByName('WeaponSocket_R');
  this.root.add(this.glowLight);
  const energy=owner.material(0xe9b34b,.24),white=owner.material(0xffe7a8,.42),rim=owner.material(0xe7bb64,.12);
  for(const m of [energy,white,rim]){m.toneMapped=false;m.blending=THREE.AdditiveBlending;m.depthWrite=false;}
  const beamVolume=flowingVolume(),columnVolume=flowingVolume();
  for(let i=0;i<3;i++){const mat=owner.material([0xffe7af,0xe9b34b,0xe7bb64][i],[.92,.46,.24][i]);mat.vertexColors=true;mat.toneMapped=false;mat.blending=THREE.AdditiveBlending; const b=owner.mesh(beamVolume,mat,this.root);b.name=`Saber volumetric beam ${i}`;b.visible=false;this.beams.push(b);}
  for(let i=0;i<3;i++){const mat=owner.material([0xffe7af,0xe9b34b,0xe7bb64][i],[.92,.46,.24][i]);mat.vertexColors=true;mat.toneMapped=false;mat.blending=THREE.AdditiveBlending; const b=owner.mesh(columnVolume,mat,this.root);b.name=`Saber rising aftermath column ${i}`;b.visible=false;this.pillar.push(b);}
  for(const kind of ['beam','column','flare'] as const)for(let i=0;i<(kind==='flare'?7:6);i++){
   const mat=owner.material(i%3===0?0xffffde:i%2?0xffdf70:0xffb62b,kind==='flare'?.38:.55);mat.vertexColors=true;mat.toneMapped=false;mat.blending=THREE.AdditiveBlending;
   const m=owner.mesh(flowRibbon(),mat,this.root);m.name=`Saber ${kind} turbulent light ribbon ${i}`;m.frustumCulled=false;m.visible=false;this.flow.push({mesh:m,kind,index:i});
  }
  const moteGeo=new THREE.SphereGeometry(.014,6,4);
  for(let i=0;i<48;i++){const m=owner.mesh(moteGeo,i%3?energy:white,this.root);m.name='Saber rising 3D light mote';this.sparks.push(m);}
  this.halo=owner.mesh(new THREE.SphereGeometry(1,24,12),rim,this.root);this.halo.name='Saber charge light volume';this.halo.scale.set(.7,.035,.7);this.halo.position.y=.04;
 }
 update(f:UltimateStageFrame,camera:THREE.PerspectiveCamera,reduced:boolean){
  const p=THREE.MathUtils.clamp(f.progress,0,1),intro=f.phase==='intro',charge=f.phase==='charge',release=f.phase==='release',outro=f.phase==='outro';
  this.actor.updateMatrixWorld(true);this.socket?.getWorldPosition(this.grip);
  if((f.strikeCount??0)>this.strike){this.strike=f.strikeCount??0;this.hitAt=f.elapsed;}
  const age=this.hitAt<0?-1:Math.max(0,f.elapsed-this.hitAt),hit=age>=0;
  const strength=reduced?.32:1;
  this.glowLight.position.copy(this.grip).add(this.offset.set(0,.3,.3));this.glowLight.intensity=(charge?.55+1.65*p:hit?1.8*Math.max(0,1-age/3):.35)*strength;
  this.halo.visible=false;this.halo.scale.setScalar((intro?.6:1+p*.7));this.halo.scale.y=.025;
  for(let i=0;i<this.sparks.length;i++){
   const m=this.sparks[i],t=(f.elapsed*.19+i/48)%1,r=(1-t)*2.5+.08,a=i*2.399+f.elapsed*.18;
   m.visible=(intro||charge)&&(reduced?i%6===0:i%2===0);const gather=charge?ease(p):0;m.position.set(Math.cos(a)*r*(1-gather*.65),t*(4-gather)+gather*.35,Math.sin(a)*r*(1-gather*.65));m.rotation.set(t*5,a,t*3);m.scale.set(.7+t*.5,1.8+t*.8,.7+t*.5);
  }
  if(this.socket)this.socket.localToWorld(this.beamOrigin.set(0,saberBladeTip(this.socket),0));else this.beamOrigin.set(.03,.72,.7);
  const beamLength=Math.max(3,11-this.beamOrigin.z);
  const beamOn=hit&&age>.17&&age<2.25;
  if(hit){updateVolume(this.beams[0].geometry,f.elapsed,false);updateVolume(this.pillar[0].geometry,f.elapsed,true);}
  const attack= ease((age-.10)/.25),fade=1-ease((age-1.55)/.70);
  for(let i=0;i<3;i++){
   const b=this.beams[i];b.visible=beamOn;b.position.copy(this.beamOrigin);b.rotation.x=Math.PI/2;
   b.scale.set([.36,.60,.94][i]*attack*strength,(3+(beamLength-3)*attack),[.36,.60,.94][i]*attack*strength);
   (b.material as THREE.MeshBasicMaterial).opacity=[.43,.09,.035][i]*fade*strength;
   const col=this.pillar[i];col.visible=hit&&age>.65;col.position.set(0,.05,11);col.rotation.x=0;
   const rise=ease((age-.65)/.9),fall=outro?1-ease((p-.68)/.32):1;
   col.scale.set([.65,1,1.45][i]*rise,9*rise,[.65,1,1.45][i]*rise);(col.material as THREE.MeshBasicMaterial).opacity=[.38,.075,.028][i]*fall*strength;
  }
  const columnRise=ease((age-.65)/.9),outFade=outro?1-ease((p-.65)/.35):1;
  for(const flow of this.flow){
   const {mesh,kind,index}=flow;const show=kind==='beam'?beamOn:hit&&age>(kind==='flare'?.18:.65);
   mesh.visible=show&&(kind==='beam'?(reduced?index===0:index<2):kind==='column'?(reduced?index===0:index<3):(reduced?index===0:index%2===0));
   if(mesh.visible)updateRibbon(mesh.geometry,kind,index,f.elapsed,Math.max(0,age),beamLength);
   if(kind==='beam')mesh.position.copy(this.beamOrigin);else mesh.position.set(0,.05,11);
   const grow=kind==='beam'?attack:kind==='column'?columnRise:ease((age-.18)/.45);
   mesh.scale.setScalar(grow);
   (mesh.material as THREE.MeshBasicMaterial).opacity=(kind==='beam'?.25:kind==='column'?.21:.16)*(kind==='beam'?fade:outFade)*strength;
  }
  // Synthetic fixtures retain generic stage framing. Actual actors use measured head/socket.
  if(!this.head||!this.socket)return;
  this.head.getWorldPosition(this.eye);this.eye.y+=.075;this.eye.z+=.025;
  if(reduced){camera.position.set(.6,2.1,6.4);this.aim.set(0,1.55,0);camera.fov=38;}
  else if(intro){
   // Establish entire figure briefly, then cut to the eyes and blade for a held expression.
   if(p<.27){camera.position.set(1.2,1.65,6.1-p*.5);this.aim.set(0,1.5,0);camera.fov=38;}
   else {const t=ease((p-.27)/.73);camera.position.copy(this.eye).add(this.offset.set(.65-.10*t,.10,1.65-.08*t));this.aim.copy(this.eye).add(this.offset.set(-.035,.055,.015));camera.fov=31;}
  }else if(charge){
   if(p<.55){camera.position.copy(this.eye).add(this.offset.set(.54-p*.25,.10,1.60));this.aim.copy(this.eye).add(this.offset.set(-.04,.055,0));camera.fov=32;}
   else {const t=ease((p-.55)/.45);camera.position.set(1.5-t*.6,1.5+t*.40,7.6-t*.35);this.aim.set(0,2.15+t*.20,.08);camera.fov=43;}
  }else if(release&&!hit){camera.position.copy(this.eye).add(this.offset.set(.75,.10,1.72));this.aim.copy(this.eye).add(this.offset.set(0,.055,.02));camera.fov=32;}
  else if(hit&&age<.32){camera.position.set(-1.55,1.48,5.35);this.aim.set(.05,1.43,.45);camera.fov=40;}
  else if(!outro||p<.40){camera.position.set(-8.5,3.5,5.4);this.aim.set(.1,1.5,4.2);camera.fov=50;}
  else {const t=ease((p-.40)/.60);camera.position.set(-5.9+t*.9,4.4+t*2,15.5);this.aim.set(0,3.5,10.6);camera.fov=48;}
  camera.lookAt(this.aim);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
 }
 dispose(){this.root.clear();this.head=undefined;this.socket=undefined;}
}
function flowingVolume(){
 const p:number[]=[],c:number[]=[],ix:number[]=[],rings=32,segs=16;
 for(let j=0;j<=rings;j++)for(let i=0;i<=segs;i++){
  const t=j/rings,a=i/segs*Math.PI*2;p.push(Math.cos(a),t,Math.sin(a));
  c.push(1,1,1,Math.sin(Math.PI*t)**.6);
 }
 for(let j=0;j<rings;j++)for(let i=0;i<segs;i++){const a=j*(segs+1)+i,b=a+segs+1;ix.push(a,b,a+1,b,b+1,a+1);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3).setUsage(THREE.DynamicDrawUsage));g.setAttribute('color',new THREE.Float32BufferAttribute(c,4));g.setIndex(ix);g.computeVertexNormals();return g;
}
function updateVolume(g:THREE.BufferGeometry,time:number,column:boolean){
 const p=g.attributes.position,rings=32,segs=16;
 for(let j=0;j<=rings;j++)for(let i=0;i<=segs;i++){
  const t=j/rings,a=i/segs*Math.PI*2;
  const envelope=Math.pow(Math.sin(Math.PI*t),column?.45:.25)*(column?1.05-.30*t:.9);
  const r=envelope*(1+.055*Math.sin(t*17-time*6+a*3)+.025*Math.sin(t*29+time*4-a*5));
  const x=.12*Math.sin(t*15-time*3)*Math.sin(Math.PI*t),z=.10*Math.cos(t*21+time*2)*Math.sin(Math.PI*t);
  p.setXYZ(j*(segs+1)+i,x+Math.cos(a)*r,t,z+Math.sin(a)*r);
 }
 p.needsUpdate=true;g.computeBoundingSphere();
}
function flowRibbon(){
 const p:number[]=[],c:number[]=[],ix:number[]=[],segments=40;
 for(let j=0;j<=segments;j++)for(let k=0;k<3;k++){p.push(0,0,0);c.push(1,1,1,k===1?Math.sin(j/segments*Math.PI):0);}
 for(let j=0;j<segments;j++)for(let k=0;k<2;k++){const a=j*3+k,b=a+3;ix.push(a,b,a+1,b,b+1,a+1);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3).setUsage(THREE.DynamicDrawUsage));g.setAttribute('color',new THREE.Float32BufferAttribute(c,4));g.setIndex(ix);return g;
}
function updateRibbon(g:THREE.BufferGeometry,kind:'beam'|'column'|'flare',index:number,time:number,age:number,beamLength:number){
 const p=g.attributes.position,segments=40;
 for(let j=0;j<=segments;j++){
  const t=j/segments,a=kind==='beam'?index*Math.PI+t*2.4+time*.35:index*2.399+t*10+time*(index%2?.7:-.9),pulse=Math.sin(t*19-time*8+index)*.12;
  let x=0,y=0,z=0,width=0;
  if(kind==='beam'){
   const radius=(.20+.14*Math.sin(t*Math.PI)+pulse*.35);
   x=Math.cos(a)*radius;y=Math.sin(a)*radius;z=t*beamLength;width=(.025+.035*Math.sin(Math.PI*t));
  }else if(kind==='column'){
   const radius=(.5+.9*Math.sin(t*Math.PI)+pulse)*(1+.12*Math.sin(index*2));
   x=Math.cos(a)*radius;y=t*(7.8+index*.31);z=Math.sin(a)*radius;width=.035+.08*Math.sin(Math.PI*t);
  }else{
   const theta=index/7*Math.PI*2+t*.9+time*.12,r=t*(2.6+index%3*.6);
   x=Math.cos(theta)*r;y=Math.sin(t*Math.PI)*(.65+index%3*.3)+Math.max(0,age-1)*.2;z=Math.sin(theta)*r;
   width=.025+.08*Math.sin(Math.PI*t);
  }
  for(let k=0;k<3;k++){
   const w=(k-1)*width;
   if(kind==='beam')p.setXYZ(j*3+k,x+Math.cos(a)*w,y+Math.sin(a)*w,z);
   else p.setXYZ(j*3+k,x+Math.cos(a)*w,y+w*.3,z+Math.sin(a)*w);
  }
 }
 p.needsUpdate=true;g.computeBoundingSphere();
}

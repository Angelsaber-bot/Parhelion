import * as THREE from 'three';
import {radialGeometry} from './saberStageArt';
import {EraBladeTrace} from './eraBladeTrace';
import type {EraArtFrame,EraArtOwner} from './eraStageArt';
/** Red right blade, blue left blade, then a contact-authorized monumental crossing. */
export class MusashiStageArt {
 readonly root=new THREE.Group();private right:EraBladeTrace;private left:EraBladeTrace;private shadow:THREE.Mesh;
 private cross:THREE.Mesh[]=[];private centerCut:THREE.Mesh;private petals:THREE.Mesh[]=[];private count=0;private crossedAt=-100;private center=new THREE.Vector3();
 constructor(private actor:THREE.Group,clone:THREE.Object3D,owner:EraArtOwner){
  this.root.name='Musashi: paper dojo and three crossing cuts';
  const floor=owner.mesh(new THREE.PlaneGeometry(40,45),owner.material(0xc9beb4,1),this.root);floor.rotation.x=-Math.PI/2;floor.position.set(0,-.032,-14);
  const shadowMaterial=owner.material(0x342630,.45);shadowMaterial.vertexColors=true;this.shadow=owner.mesh(radialGeometry(.85),shadowMaterial,this.root);this.shadow.name='Musashi contact shadow';this.shadow.rotation.x=-Math.PI/2;this.shadow.scale.y=.55;this.shadow.position.y=-.018;
  const ink=owner.material(0x3f303d,.35);ink.vertexColors=true;const brush=brushGeometry();
  for(let i=0;i<3;i++){const stroke=owner.mesh(brush,ink,this.root);stroke.position.set(-4+i*4,2.9,-6-i);stroke.rotation.z=(i-1)*.38;stroke.scale.set(.7+i*.15,1.2+i*.18,1);}
  const paper=owner.material(0xeee5da,.6);for(const side of[-1,1])for(let i=0;i<3;i++){const panel=owner.mesh(new THREE.PlaneGeometry(.85,6),paper,this.root);panel.position.set(side*(3.6+i*1.3),2.5,-2-i*4);panel.rotation.y=side*.15;}
  this.right=new EraBladeTrace('Musashi red right',clone.getObjectByName('Attachment_RightHand_Katana'),undefined,new THREE.Vector3(0,.075,1.285),this.root,owner,0xee466a);
  this.left=new EraBladeTrace('Musashi blue left',clone.getObjectByName('Attachment_LeftHand_Katana'),undefined,new THREE.Vector3(0,.075,1.125),this.root,owner,0x3686d5);
  const geometry=finisherBladeGeometry();
  for(let i=0;i<2;i++){const material=owner.material(i?0x397fe0:0xd82d58,.8);material.vertexColors=true;material.toneMapped=false;const wave=owner.mesh(geometry,material,this.root);wave.name=i?'Musashi third blue crossing':'Musashi third red crossing';wave.visible=false;this.cross.push(wave);}
  const white=owner.material(0xf8e5ff,.75);white.vertexColors=true;white.toneMapped=false;this.centerCut=owner.mesh(geometry,white,this.root);this.centerCut.name='Musashi third central cut';this.centerCut.visible=false;
  const petalGeo=new THREE.PlaneGeometry(.055,.10),petalMaterials=[owner.material(0xb33858,.75),owner.material(0x517c9c,.65)];
  for(let i=0;i<18;i++){const petal=owner.mesh(petalGeo,petalMaterials[i%2],this.root);this.petals.push(petal);}
 }
 update(frame:EraArtFrame,camera:THREE.Camera,reduced:boolean){
  this.actor.updateMatrixWorld(true);const next=frame.strikeCount??0;
  if(frame.phase==='release'&&next>this.count){if(next===1)this.right.trigger(frame.elapsed);else if(next===2)this.left.trigger(frame.elapsed);else if(next>=3){this.right.trigger(frame.elapsed);this.left.trigger(frame.elapsed);this.crossedAt=frame.elapsed;}this.count=next;}
  this.right.update(frame,camera,reduced);this.left.update(frame,camera,reduced);
  const age=frame.elapsed-this.crossedAt,visible=(frame.phase==='release'||frame.phase==='outro')&&age>=0&&age<.65;
  if(age>=0&&age<.10)this.center.copy(this.right.tip).add(this.left.tip).multiplyScalar(.5);
  for(let i=0;i<2;i++){const cross=this.cross[i];cross.visible=visible;cross.position.copy(this.center);cross.position.z-=.3;cross.rotation.set(0,0,(i?-1:1)*(.65+Math.min(age,.2)*.35));cross.scale.set((reduced?.22:1.2)*Math.max(0,1-age/.65),.88+Math.max(0,age)*.25,1);(cross.material as THREE.MeshBasicMaterial).opacity=Math.max(0,1-age/.65)*(reduced?.3:1);}
  this.centerCut.visible=visible&&age>.10;this.centerCut.position.copy(this.center);this.centerCut.position.z-=.25;this.centerCut.scale.set(reduced?.055:.14,.95,1);(this.centerCut.material as THREE.MeshBasicMaterial).opacity=Math.max(0,1-(age-.1)/.55)*(reduced?.25:1);
  this.shadow.position.x=this.actor.position.x;this.shadow.position.z=this.actor.position.z;
  for(let i=0;i<this.petals.length;i++){const petal=this.petals[i];petal.visible=!reduced||i%3===0;const a=i*2.399,fall=(frame.elapsed*.28+i*.31)%4;petal.position.set(Math.cos(a)*(2+i%4),3.8-fall,-4+Math.sin(a)*3);petal.rotation.set(.15*Math.sin(a),0,a+(reduced?0:frame.elapsed*.35));}
 }
 dispose(){this.right.dispose();this.left.dispose();this.root.clear();this.cross=[];this.petals=[];}
}
function brushGeometry(){const g=new THREE.PlaneGeometry(.55,7,4,16),p=g.attributes.position,colors:number[]=[];for(let i=0;i<p.count;i++){const x=p.getX(i)/.275,y=p.getY(i)/3.5;const envelope=Math.pow(Math.max(0,1-Math.abs(y)),.4);p.setX(i,p.getX(i)*(1+.25*Math.sin(y*19))*envelope+.14*Math.sin(y*2));colors.push(1,1,1,Math.max(0,1-Math.abs(x))*envelope);}g.setAttribute('color',new THREE.Float32BufferAttribute(colors,4));return g;}

/** Pointed, high-contrast blade afterimage; one RGBA surface, no coplanar layers. */
function finisherBladeGeometry(){
 const positions:number[]=[],colors:number[]=[],indices:number[]=[];
 const across=[-1,-.65,-.22,0,.22,.65,1],alpha=[0,.8,1,1,1,.8,0];
 for(let row=0;row<=24;row++){const t=row/24,envelope=Math.pow(Math.sin(Math.PI*t),.45);for(let j=0;j<across.length;j++){positions.push(across[j]*.34*envelope,(t-.5)*8,0);colors.push(1,1,1,alpha[j]*Math.min(1,envelope*3));}}
 for(let row=0;row<24;row++)for(let j=0;j<6;j++){const a=row*7+j,b=a+7;indices.push(a,b,a+1,b,b+1,a+1);}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,4));geometry.setIndex(indices);geometry.computeBoundingSphere();return geometry;
}

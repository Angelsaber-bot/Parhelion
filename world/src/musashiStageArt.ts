import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {radialGeometry} from './saberStageArt';
import {EraBladeTrace} from './eraBladeTrace';
import type {EraArtFrame,EraArtOwner} from './eraStageArt';
/** Red right blade, blue left blade, then a contact-authorized monumental crossing. */
export class MusashiStageArt {
 readonly root=new THREE.Group();private right:EraBladeTrace;private left:EraBladeTrace;private shadow:THREE.Mesh;
 private leftLight=new THREE.PointLight(0x4f8eff,0,8,2);private rightLight=new THREE.PointLight(0xff4363,0,8,2);private lanterns:THREE.PointLight[]=[];
 private cross:THREE.Mesh[]=[];private centerCut:THREE.Mesh;private petals:THREE.Mesh[]=[];private count=0;private crossedAt=-100;private center=new THREE.Vector3();
 constructor(private actor:THREE.Group,clone:THREE.Object3D,owner:EraArtOwner){
  this.root.name='Musashi: paper dojo and three crossing cuts';
  const floor=owner.mesh(new THREE.PlaneGeometry(40,45),owner.material(0xc9beb4,1),this.root);floor.rotation.x=-Math.PI/2;floor.position.set(0,-.032,-14);
  const shadowMaterial=owner.material(0x342630,.45);shadowMaterial.vertexColors=true;this.shadow=owner.mesh(radialGeometry(.85),shadowMaterial,this.root);this.shadow.name='Musashi contact shadow';this.shadow.rotation.x=-Math.PI/2;this.shadow.scale.y=.55;this.shadow.position.y=.006;
  this.right=new EraBladeTrace('Musashi red right',clone.getObjectByName('Attachment_RightHand_Katana'),undefined,new THREE.Vector3(0,.075,1.285),this.root,owner,0xee466a);
  this.left=new EraBladeTrace('Musashi blue left',clone.getObjectByName('Attachment_LeftHand_Katana'),undefined,new THREE.Vector3(0,.075,1.125),this.root,owner,0x3686d5);
  const geometry=finisherBladeGeometry();
  for(let i=0;i<2;i++){const material=owner.material(i?0x397fe0:0xd82d58,.8);material.vertexColors=true;material.toneMapped=false;material.blending=THREE.AdditiveBlending;material.depthWrite=false;const wave=owner.mesh(geometry,material,this.root);wave.name=i?'Musashi third blue crossing':'Musashi third red crossing';wave.visible=false;this.cross.push(wave);}
  const white=owner.material(0xf8e5ff,.75);white.vertexColors=true;white.toneMapped=false;this.centerCut=owner.mesh(geometry,white,this.root);this.centerCut.name='Musashi third central cut';this.centerCut.visible=false;
  const petalGeo=new THREE.PlaneGeometry(.055,.10),petalMaterials=[owner.material(0xb33858,.75),owner.material(0x517c9c,.65)];
  for(let i=0;i<18;i++){const petal=owner.mesh(petalGeo,petalMaterials[i%2],this.root);this.petals.push(petal);}
  this.buildDojo(owner);
 }
 private buildDojo(owner:EraArtOwner){
  const timber:THREE.BufferGeometry[]=[],dark:THREE.BufferGeometry[]=[],paper:THREE.BufferGeometry[]=[],gold:THREE.BufferGeometry[]=[];
  const box=(list:THREE.BufferGeometry[],x:number,y:number,z:number,sx:number,sy:number,sz:number,ry=0)=>{const g=new THREE.BoxGeometry(sx,sy,sz);g.rotateY(ry);g.translate(x,y,z);list.push(g);};
  // Physical floorboards preserve depth/parallax and are all one draw call.
  for(let row=0;row<25;row++)for(let j=0;j<5;j++)box(timber,-4.8+j*2.4,-.03,-10+row*.62,2.37,.055,.59);
  for(const side of[-1,1]){
   for(let i=0;i<5;i++){
    const x=side*6,z=2-i*3.0;box(dark,x,2.7,z,.22,5.4,.24);box(dark,x,5.35,z-1.5,.25,.20,3.15);box(dark,x,.18,z-1.5,.26,.28,3.15);
    box(paper,x,2.6,z-1.5,.06,4.65,2.75);
    // Shoji lattice really projects from the paper, not a painted panel.
    for(let y=.6;y<5;y+=.7)box(timber,x-side*.05,y,z-1.5,.06,.045,2.75);
    for(let j=0;j<4;j++)box(timber,x-side*.055,2.6,z-.38-j*.73,.065,4.7,.04);
   }
   // Stone lantern bases and glowing lantern cages flank the performance lane.
   for(let i=0;i<2;i++){
    const x=side*4.8,z=-2-i*5.5;box(dark,x,.22,z,.55,.44,.55);box(dark,x,.95,z,.15,1.1,.15);box(dark,x,1.6,z,.6,.14,.6);box(dark,x,2.35,z,.65,.15,.65);
    box(paper,x,1.97,z,.40,.60,.40);
    for(const dx of[-.23,.23])for(const dz of[-.23,.23])box(dark,x+dx,1.97,z+dz,.04,.68,.04);
    const light=new THREE.PointLight(0xffc995,1.8,5,2);light.position.set(x,1.97,z);light.name='Musashi dojo lantern';this.root.add(light);this.lanterns.push(light);
   }
  }
  // Recessed back gate gives the blade poses a clean central dark opening.
  for(const x of[-3.8,3.8]){box(dark,x,2.75,-9.5,.42,5.5,.48);box(gold,x,1.0,-9.5,.46,.12,.52);box(gold,x,4.8,-9.5,.46,.12,.52);}
  box(dark,0,5.45,-9.5,8.6,.34,.55);box(timber,0,5.85,-9.5,9.4,.20,.76);box(dark,0,6.05,-9.5,10,.16,1.2);
  for(const x of[-5.0,5.0])box(paper,x,2.75,-9.7,1.9,5.0,.10);
  // Raised roof ribs sit at the edges and never obscure the sword silhouettes.
  for(let i=0;i<5;i++){box(dark,0,5.9,2-i*3,12.5,.18,.22);box(timber,0,6.08,2-i*3,12.8,.12,.30);}
  // Actual paired practice blades stored in a rear rack, not screen decals.
  for(const side of[-1,1]){const x=side*4.5;box(dark,x,.6,-7.2,.10,1.2,.15);box(dark,x+side*.8,.6,-7.2,.10,1.2,.15);for(let j=0;j<3;j++){box(timber,x+side*.4,.35+j*.28,-7.2,1.4,.055,.07);box(gold,x+side*.9,.35+j*.28,-7.2,.06,.13,.10);}}
  const emit=(list:THREE.BufferGeometry[],material:THREE.Material,name:string)=>{const g=mergeGeometries(list);for(const p of list)p.dispose();if(g){const mesh=owner.mesh(g,material,this.root);mesh.name=name;}};
  emit(timber,new THREE.MeshStandardMaterial({color:0x8f6954,roughness:.8}),'Musashi modeled cedar floor and shoji lattice');
  emit(dark,new THREE.MeshStandardMaterial({color:0x382e32,roughness:.85}),'Musashi timber dojo beams and lantern frames');
  emit(paper,new THREE.MeshStandardMaterial({color:0xe5d7bd,roughness:1,emissive:0x463326,emissiveIntensity:.2,side:THREE.DoubleSide}),'Musashi recessed warm shoji paper');
  emit(gold,new THREE.MeshStandardMaterial({color:0xa98b52,metalness:.65,roughness:.4}),'Musashi gate and sword rack fittings');
  this.leftLight.name='Musashi blue blade reflected light';this.rightLight.name='Musashi red blade reflected light';this.root.add(this.leftLight,this.rightLight);
 }
 update(frame:EraArtFrame,camera:THREE.Camera,reduced:boolean){
  this.actor.updateMatrixWorld(true);const next=frame.strikeCount??0;
  if(frame.phase==='release'&&next>this.count){if(next===1)this.right.trigger(frame.elapsed);else if(next===2)this.left.trigger(frame.elapsed);else if(next>=3){this.right.trigger(frame.elapsed);this.left.trigger(frame.elapsed);this.crossedAt=frame.elapsed;}this.count=next;}
  this.right.update(frame,camera,reduced);this.left.update(frame,camera,reduced);
  this.leftLight.position.copy(this.left.tip);this.rightLight.position.copy(this.right.tip);const lightStrength=reduced?0:frame.phase==='release'?2+Math.min(1,Math.max(0,frame.pulse))*7:frame.phase==='charge'?1.2:0;this.leftLight.intensity=this.rightLight.intensity=lightStrength;
  const age=frame.elapsed-this.crossedAt,visible=(frame.phase==='release'||frame.phase==='outro')&&age>=0&&age<.65;
  if(age>=0&&age<.10)this.center.copy(this.right.tip).add(this.left.tip).multiplyScalar(.5);
  for(let i=0;i<2;i++){const cross=this.cross[i];cross.visible=visible;cross.position.copy(this.center);cross.position.z-=.72;cross.rotation.set(0,0,(i?-1:1)*(.65+Math.min(age,.2)*.35));cross.scale.set((reduced?.14:.48)*Math.max(0,1-age/.65),.88+Math.max(0,age)*.25,1);(cross.material as THREE.MeshBasicMaterial).opacity=Math.max(0,1-age/.65)*(reduced?.24:.68);}
  this.centerCut.visible=visible&&age>.10;this.centerCut.position.copy(this.center);this.centerCut.position.z-=.25;this.centerCut.scale.set(reduced?.055:.14,.95,1);(this.centerCut.material as THREE.MeshBasicMaterial).opacity=Math.max(0,1-(age-.1)/.55)*(reduced?.25:1);
  this.shadow.position.x=this.actor.position.x;this.shadow.position.z=this.actor.position.z;
  for(let i=0;i<this.petals.length;i++){const petal=this.petals[i];petal.visible=!reduced||i%3===0;const a=i*2.399,fall=(frame.elapsed*.28+i*.31)%4;petal.position.set(Math.cos(a)*(2+i%4),3.8-fall,-4+Math.sin(a)*3);petal.rotation.set(.15*Math.sin(a),0,a+(reduced?0:frame.elapsed*.35));}
 }
 dispose(){this.right.dispose();this.left.dispose();this.root.clear();this.cross=[];this.petals=[];this.lanterns=[];}
}
/** Pointed, high-contrast blade afterimage; one RGBA surface, no coplanar layers. */
function finisherBladeGeometry(){
 const positions:number[]=[],colors:number[]=[],indices:number[]=[];
 const across=[-1,-.65,-.22,0,.22,.65,1],alpha=[0,.8,1,1,1,.8,0];
 for(let row=0;row<=24;row++){const t=row/24,envelope=Math.pow(Math.sin(Math.PI*t),.45);for(let j=0;j<across.length;j++){positions.push(across[j]*.34*envelope,(t-.5)*8,0);colors.push(1,1,1,alpha[j]*Math.min(1,envelope*3));}}
 for(let row=0;row<24;row++)for(let j=0;j<6;j++){const a=row*7+j,b=a+7;indices.push(a,b,a+1,b,b+1,a+1);}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,4));geometry.setIndex(indices);geometry.computeBoundingSphere();return geometry;
}

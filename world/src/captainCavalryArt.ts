import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { attachCinematicTricorn } from './cinematicTricorn';
import { sculptCaptainCavalry } from './captainCavalrySculpt';

/** Original, bone-bound tailoring. No source mesh/material mutation, hitbox or gameplay state. */
export function attachCaptainCavalryArt(model:THREE.Object3D,identity:string):()=>void {
 const mounted=identity==='napoleon'||identity==='napoleonMounted';
 if(identity!=='blackbeard'&&!mounted||(model.getObjectByName('CaptainCavalry remaster tailoring')||model.getObjectByName('CaptainCavalry_remaster_tailoring')))return()=>{};
 let source:THREE.SkinnedMesh|undefined;
 model.traverse(o=>{const m=o as THREE.SkinnedMesh;if(!source&&m.isSkinnedMesh&&m.skeleton.bones.some(b=>b.name==='Chest'))source=m;});
 if(!source)return()=>{};const restoreSculpt=sculptCaptainCavalry(model,mounted);const skin=source,added:THREE.SkinnedMesh[]=[],materials:THREE.Material[]=[],geometries:THREE.BufferGeometry[]=[];
 const hat=mounted?()=>{}:attachCinematicTricorn(model);
 const material=(name:string,color:number,metalness=0,roughness=.82)=>{const m=new THREE.MeshStandardMaterial({name,color,metalness,roughness,side:THREE.DoubleSide});materials.push(m);return m;};
 const cloth=material(mounted?'Remaster cavalry oxblood mantle':'Remaster captain midnight coat',mounted?0x671d29:0x142b35);
 const lining=material(mounted?'Remaster cavalry pale lining':'Remaster captain oxblood facing',mounted?0xe1d9bf:0x792d32);
 const gold=material('Remaster worn warm gold piping',0xb48b45,.68,.38);
 function bind(g:THREE.BufferGeometry,m:THREE.Material,name:string,weight:(x:number,y:number,z:number)=>[string,string,number]){
  const p=g.attributes.position,j=new Uint16Array(p.count*4),w=new Float32Array(p.count*4);
  for(let i=0;i<p.count;i++){const[a,b,t]=weight(p.getX(i),p.getY(i),p.getZ(i)),ai=skin.skeleton.bones.findIndex(n=>n.name===a),bi=skin.skeleton.bones.findIndex(n=>n.name===b);if(ai<0||bi<0){g.dispose();return;}j[i*4]=ai;j[i*4+1]=bi;w[i*4]=1-t;w[i*4+1]=t;}
  g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(j,4));g.setAttribute('skinWeight',new THREE.Float32BufferAttribute(w,4));g.computeVertexNormals();
  const mesh=new THREE.SkinnedMesh(g,m);mesh.name=name;mesh.userData.captainCavalryRemaster=true;mesh.frustumCulled=false;mesh.castShadow=true;mesh.receiveShadow=true;
  mesh.bind(skin.skeleton,skin.bindMatrix);mesh.position.copy(skin.position);mesh.quaternion.copy(skin.quaternion);mesh.scale.copy(skin.scale);(skin.parent??model).add(mesh);added.push(mesh);geometries.push(g);
 }
 const torsoWeight=(_x:number,y:number):[string,string,number]=>['Chest','Hips',THREE.MathUtils.clamp(((mounted?2.25:1.52)-y)/.65,0,1)];
 function panel(rows:number,columns:number,point:(u:number,v:number)=>THREE.Vector3){const pos:number[]=[],idx:number[]=[];for(let y=0;y<=rows;y++)for(let x=0;x<=columns;x++)pos.push(...point(x/columns,y/rows).toArray());for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){const a=y*(columns+1)+x,b=a+columns+1;idx.push(a,b,a+1,a+1,b,b+1);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);return g;}
 const edge:THREE.BufferGeometry[]=[];
 const trim=(points:THREE.Vector3[],radius=.006)=>edge.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),Math.max(8,points.length*3),radius,5,false));
 if(!mounted){
  const back=(u:number,v:number)=>new THREE.Vector3((u-.5)*(.60+.035*v),1.58-.79*v,-.15-.065*v-.018*Math.cos(u*Math.PI*8)*v+.13*Math.pow(Math.abs(u-.5)*2,3)*(1-.3*v));
  bind(panel(14,12,back),cloth,'CaptainCavalry remaster tailoring',torsoWeight);
  for(const side of[-1,1]){
   const shoulder=(u:number,v:number)=>new THREE.Vector3(side*(.15+.14*u),1.575+.027*Math.sin(v*Math.PI),-.135+.245*v);bind(panel(8,4,shoulder),cloth,`Captain joined shoulder tailoring ${side}`,torsoWeight);
   const front=(u:number,v:number)=>new THREE.Vector3(side*(.16+u*.10+.07*v),1.56-.57*v,.085+.045*Math.sin(v*Math.PI)+.014*u);
   bind(panel(12,3,front),lining,`Captain open coat facing ${side}`,torsoWeight);
   trim(Array.from({length:13},(_,i)=>front(0,i/12)));
   trim(Array.from({length:15},(_,i)=>back(side<0?0:1,i/14)));
  }
  trim(Array.from({length:13},(_,i)=>back(i/12,1)));
 }else{
  const cape=(u:number,v:number)=>new THREE.Vector3((u-.5)*(.64+.10*v)+.02*v,2.31-.66*v,-.135-.075*v-.035*Math.sin(v*Math.PI)-.018*Math.cos(u*Math.PI*8)*v+.075*Math.pow(Math.abs(u-.5)*2,3)*(1-v*.25));
  bind(panel(18,16,cape),cloth,'CaptainCavalry remaster tailoring',torsoWeight);
  const inset=(u:number,v:number)=>cape(u,v).add(new THREE.Vector3(0,0,.009));bind(panel(18,16,inset),lining,'Cavalry mantle warm lining',torsoWeight);
  for(const side of[0,1])trim(Array.from({length:19},(_,i)=>cape(side,i/18)));
  trim(Array.from({length:17},(_,i)=>cape(i/16,1)));
  // Dimensional feathered breast badge: cavalry identity, never a firearm or target.
  const crest:THREE.BufferGeometry[]=[];
  for(const side of[-1,1])for(let i=0;i<5;i++){const g=new THREE.SphereGeometry(1,8,5);g.scale(.025,.075-i*.006,.012);g.rotateZ(side*(-.50-i*.11));g.translate(side*(.035+i*.023),1.25+i*.012,.99-i*.008);crest.push(g);}
  const gem=new THREE.OctahedronGeometry(.047);gem.scale(.75,1.15,.35);gem.translate(0,1.225,1.005);crest.push(gem);
  const flat=crest.map(g=>g.index?g.toNonIndexed():g);const merged=mergeGeometries(flat);for(const g of new Set([...crest,...flat]))g.dispose();if(merged)bind(merged,gold,'White horse cavalry breast crest',()=>['H_Chest','H_Chest',0]);
 }
 const border=mergeGeometries(edge);edge.forEach(g=>g.dispose());if(border)bind(border,gold,'Remaster dimensional garment piping',torsoWeight);
 let disposed=false;return()=>{if(disposed)return;disposed=true;hat();restoreSculpt();for(const mesh of added)mesh.removeFromParent();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();};
}

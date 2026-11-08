import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
import * as THREE from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {regionLoader,bakeQuantized} from '../src/rendering/glb';
import {Player} from '../src/player/player';
import {createArmoryWorkshop} from '../src/story/armoryWorkshop';

const bytes=readFileSync(new URL('../public/assets/world_alpha.glb',import.meta.url));
const proof=JSON.parse(readFileSync(new URL('./alpha-surface-contact.edits.json',import.meta.url),'utf8'));
const {scene}=await regionLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
bakeQuantized(scene);scene.updateMatrixWorld(true);
const parts:THREE.BufferGeometry[]=[];
scene.getObjectByName('COLLISION')!.traverse(o=>{
 const m=o as THREE.Mesh;if(!m.isMesh||m.userData.dynamic)return;
 let g=new THREE.BufferGeometry().setAttribute('position',m.geometry.attributes.position.clone());
 if(m.geometry.index)g.setIndex(m.geometry.index.clone());g.applyMatrix4(m.matrixWorld);
 if(g.index){const indexed=g;g=g.toNonIndexed();indexed.dispose();}parts.push(g);
});
const bvh=new MeshBVH(mergeGeometries(parts));parts.forEach(g=>g.dispose());
const idle={x:0,z:0,jump:false,sprint:false};
const make=()=>new Player([{name:'alpha static',bvh,enabled:true}],1);
const settle=(x:number,y:number,z:number)=>{const p=make();p.teleport(x,y,z);for(let i=0;i<180;i++)p.step(1/120,idle);return p;};
const down=(object:THREE.Object3D,x:number,y:number,z:number,far=1)=>new THREE.Raycaster(new THREE.Vector3(x,y,z),new THREE.Vector3(0,-1,0),0,far).intersectObject(object,true)[0];
const campus=scene.getObjectByName('Campus')!,crossings=scene.getObjectByName('Crossings')!;
const axis=new THREE.Vector2(-12,-38).normalize();
const point=(s:number,side=0)=>new THREE.Vector2(81,-36).addScaledVector(axis,s).addScaledVector(new THREE.Vector2(-axis.y,axis.x),side);

test('Alpha workshop floor changes exactly 24 authored Y components and restores the historical accessor',async()=>{
 await MeshoptDecoder.ready;
 const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
 const doc=await io.readBinary(bytes),node=doc.getRoot().listNodes().find(n=>n.getName()==='Campus')!;
 const p=node.getMesh()!.listPrimitives()[0].getAttribute('POSITION')!,positions=p.getArray()!.slice() as Int16Array;
 const hash=()=>createHash('sha256').update(Buffer.from(positions.buffer,positions.byteOffset,positions.byteLength)).digest('hex');
 assert.equal(p.getComponentType(),5122);assert.equal(p.getNormalized(),true);
 assert.equal(hash(),proof.campus.afterPositionSha256);assert.equal(proof.campus.edits.length,24);
 const [tx,ty,tz]=node.getTranslation(),[sx,sy,sz]=node.getScale();
 for(const edit of proof.campus.edits){
  assert.equal(edit.component%3,1);assert.equal(positions[edit.component],edit.after);
  const x=positions[edit.component-1]/32767*sx+tx,z=positions[edit.component+1]/32767*sz+tz;
  const oldY=edit.before/32767*sy+ty,newY=edit.after/32767*sy+ty;
  assert.ok(x>=-85.51&&x<=-62.49&&z>=238.49&&z<=261.51,'only the existing floor slab footprint');
  assert.ok(oldY>=9.99&&oldY<=10.13&&newY>=9.88&&newY<=10.03);
  assert.ok(oldY-newY>.10&&oldY-newY<.11);positions[edit.component]=edit.before;
 }
 assert.equal(proof.campus.beforePositionSha256,'a5e11eaa7a7d1d18310e6f220312b0b1ac9ff5b4d2d3b4eba7333d99efb65c9f');
 assert.equal(hash(),proof.campus.beforePositionSha256,'reversing the exact 24 floor Y values restores every original position byte');
});

test('Alpha bridge replacement preserves all 456 other Crossings triangles byte-for-byte',async()=>{
 await MeshoptDecoder.ready;
 const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
 const doc=await io.readBinary(bytes),node=doc.getRoot().listNodes().find(n=>n.getName()==='Crossings')!;
 const p=node.getMesh()!.listPrimitives()[0],indices=p.getIndices()!.getArray()!,positions=p.getAttribute('POSITION')!.getArray()!;
 const attributes=['POSITION','NORMAL','COLOR_0'].map(name=>p.getAttribute(name)!.getArray()!);
 const shift=node.getTranslation(),scale=node.getScale(),unchanged:string[]=[];let logTriangles=0;
 for(let i=0;i<indices.length;i+=3){
  const ids=Array.from(indices.slice(i,i+3));
  const log=ids.every(j=>{const x=positions[j*3]/32767*scale[0]+shift[0],z=positions[j*3+2]/32767*scale[2]+shift[2];return x>74&&x<88&&z>-52&&z<-20;});
  if(log){logTriangles++;continue;}
  const v=ids.map(j=>attributes.flatMap(a=>[a[j*3],a[j*3+1],a[j*3+2]]).join(','));
  unchanged.push([v.join('|'),[v[1],v[2],v[0]].join('|'),[v[2],v[0],v[1]].join('|')].sort()[0]);
 }
 assert.equal(logTriangles,32);assert.equal(unchanged.length,456);
 assert.equal(createHash('sha256').update(unchanged.sort().join('\n')).digest('hex'),'e3688ce19ec0e8e8fe5a7af5124485d12c718c5bf8683da16f650729f006e49d','complete original position/normal/colour triangle tuples, preserving winding');
});

test('actual workshop aisles and fitted paint meet grounded feet',()=>{
 const kit=createArmoryWorkshop();kit.root.updateMatrixWorld(true);
 try{
  for(const [x,z]of[[-81,246],[-81,254],[-74,244],[-74,257],[-68,246],[-68,255]]){
   const p=settle(x,10.6,z),floor=down(campus,x,p.pos.y+.5,z);
   assert.ok(p.onGround&&!p.swimming&&floor);assert.ok(Math.abs(floor.point.y-p.pos.y)<.025,`floor vs feet ${floor.point.y-p.pos.y}`);
  }
  for(const [x,z]of[[-74,248.45],[-77.55,250],[-81,246.3],[-68,253.7]]){
   const floor=down(campus,x,10.5,z),paint=down(kit.root,x,10.5,z);
   assert.ok(floor&&paint);assert.ok(paint.point.y-floor.point.y>.005&&paint.point.y-floor.point.y<.025,'paint remains immediately above the repaired paving');
  }
 }finally{kit.dispose();}
});

test('original workshop cabinet, racks, crates and portal feet remain supported',()=>{
 for(const [x,z]of[[-74,250],[-63.2,244],[-63.2,250],[-63.2,256],[-82,241],[-80.4,241.2],[-66,259]]){
  const underside=new THREE.Raycaster(new THREE.Vector3(x,9.97,z),new THREE.Vector3(0,1,0),0,.1).intersectObject(campus,true)[0];
  assert.ok(underside,`real furniture underside at ${x},${z}`);assert.ok(Math.abs(underside.point.y-10)<.01,'cabinet, original rack and crate bases stay on the unchanged terrain');
 }
 const kit=createArmoryWorkshop();kit.root.updateMatrixWorld(true);
 try{for(const z of[242.68,257.32]){
  const foot=new THREE.Raycaster(new THREE.Vector3(-86.49,9.97,z),new THREE.Vector3(0,1,0),0,.1).intersectObject(kit.root,true)[0];
  assert.ok(foot&&Math.abs(foot.point.y-10)<.015,'portal feet still reach ground outside the paving');
 }}finally{kit.dispose();}
});

test('the planed log matches actual grounded feet across its width, slope and both ends',()=>{
 for(const s of[-14,-10,-5,0,5,10,14])for(const side of[-.5,0,.5]){
  const q=point(s,side),p=settle(q.x,5,q.y),surface=down(crossings,q.x,p.pos.y+.6,q.y);
  assert.ok(p.onGround&&!p.swimming&&surface,`contact at ${s},${side}`);
  assert.ok(Math.abs(surface.point.y-p.pos.y)<.025,`log vs feet ${surface.point.y-p.pos.y} at ${s},${side}`);
 }
 const mesh=crossings as THREE.Mesh,g=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry;
 const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),pos=g.attributes.position;
 const normalMatrix=new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);let cutFaces=0;
 for(let i=0;i<pos.count;i+=3){
  a.fromBufferAttribute(pos,i).applyMatrix4(mesh.matrixWorld);b.fromBufferAttribute(pos,i+1).applyMatrix4(mesh.matrixWorld);c.fromBufferAttribute(pos,i+2).applyMatrix4(mesh.matrixWorld);
  if(a.x>74&&a.x<88&&a.z>-52&&a.z<-20){
   const triangle=new THREE.Triangle(a,b,c);assert.ok(triangle.getArea()>.001,'planed end caps and upper faces remain real nondegenerate triangles');
   const face=triangle.getNormal(new THREE.Vector3());
   if(face.y>.99){
    cutFaces++;
    for(let j=0;j<3;j++){
     const exported=new THREE.Vector3().fromBufferAttribute(g.attributes.normal,i+j).applyMatrix3(normalMatrix).normalize();
     assert.ok(exported.dot(face)>.999,'actual GLB normals follow the planed slope rather than the old round trunk');
    }
   }
  }
 }
 assert.equal(cutFaces,8,'four planar upper segments retain the existing triangle budget');
 if(g!==mesh.geometry)g.dispose();
});

test('both river banks connect through the real log in either direction without jump or flight',()=>{
 for(const direction of[-1,1]){
  const start=point(-direction*19),end=point(direction*19),p=settle(start.x,6,start.y);let ticks=0;
  for(;ticks<1200;ticks++){
   if(Math.hypot(p.pos.x-end.x,p.pos.z-end.y)<.3)break;
   p.yaw=Math.atan2(p.pos.x-end.x,p.pos.z-end.y);p.step(1/120,{...idle,z:1});
   assert.equal(p.swimming,false);assert.equal(p.flying,false);assert.equal(p.gliding,false);
   const s=(p.pos.x-81)*axis.x+(p.pos.z+36)*axis.y;
   if(Math.abs(s)<14&&ticks%12===0){const surface=down(crossings,p.pos.x,p.pos.y+.5,p.pos.z);assert.ok(surface&&Math.abs(surface.point.y-p.pos.y)<.03,'continuous bridge walking follows the rendered wood');}
  }
  assert.ok(ticks<1200,`direction ${direction} stalled at ${p.pos.toArray()}`);
  for(let i=0;i<120;i++)p.step(1/120,idle);assert.equal(p.onGround,true);
 }
});

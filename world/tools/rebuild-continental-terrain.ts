// Replace only terrain accessors; retain every reviewed building and collider byte.
import * as THREE from 'three';
import {GLTFExporter} from 'three/examples/jsm/exporters/GLTFExporter.js';
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {NodeIO,Accessor,type Node} from '@gltf-transform/core';
import {ALL_EXTENSIONS,EXTMeshoptCompression} from '@gltf-transform/extensions';
import {copyToDocument,prune,unpartition} from '@gltf-transform/functions';
import {MeshoptEncoder,MeshoptDecoder} from 'meshoptimizer';
import {buildTerrain} from './gen/terrain';
import {buildBritainTerrain} from './gen/britain/terrain';
import {buildBlacksailTerrain} from './gen/blacksail/terrain';
import {buildWinterTerrain} from './gen/winter/terrain';
import {buildKyotoTerrain} from './gen/kyoto/terrain';
import {blendContinentalColors} from './gen/continent';
import {compress} from './gen/export';
import {regionLoader,bakeQuantized} from '../src/rendering/glb';
import {WorldGrid} from '../src/map/grid';

const builders={alpha:buildTerrain,britain:buildBritainTerrain,blacksail:buildBlacksailTerrain,winter:buildWinterTerrain,kyoto:buildKyotoTerrain};
const selected=process.argv.find(arg=>arg.startsWith('--region='))?.slice(9);
const preserveArtFrom=process.argv.find(arg=>arg.startsWith('--preserve-art-from='))?.slice(20);
if(selected&&!(selected in builders))throw new Error(`Unknown original region: ${selected}`);
await Promise.all([MeshoptEncoder.ready,MeshoptDecoder.ready]);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
for(const [id,build] of Object.entries(builders).filter(([id])=>!selected||selected===id)) {
  const url=new URL(`../public/assets/world_${id}.glb`,import.meta.url);
  const bytes=preserveArtFrom?execFileSync('git',['show',`${preserveArtFrom}:world/public/assets/world_${id}.glb`],{maxBuffer:40*1024*1024}):readFileSync(url);
  const doc=await io.readBinary(bytes),terrain=build();blendContinentalColors(terrain.vis,id);
  // Keep original collision vertex/triangle order and exact inner-region decoded
  // coordinates. Quantizing a new whole tile can alter contact order at old doors.
  const loaded=await regionLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');bakeQuantized(loaded.scene);
  loaded.scene.updateMatrixWorld(true);
  const ruins=id==='winter'?(loaded.scene.getObjectByName('COL_Winter_Ruin_Shells')?.userData.houses??[]) as {p:[number,number,number];size:[number,number,number]}[]:[];
  const oldGround=ruins.length?new WorldGrid([loaded.scene.getObjectByName('Terrain') as THREE.Mesh],-360,-360,720,2):null;
  const reviewedHeight=(x:number,z:number)=>{
    const y=terrain.heightAt(x,z);if(!oldGround)return y;
    let weight=0;for(const h of ruins){const r=Math.hypot(h.size[0],h.size[2])/2+4;weight=Math.max(weight,1-THREE.MathUtils.smoothstep(Math.hypot(x-h.p[0],z-h.p[2]),r,r+8));}
    return THREE.MathUtils.lerp(y,oldGround.sampleHeight(x,z)??y,weight);
  };
  if(oldGround){const p=terrain.vis.attributes.position;for(let i=0;i<p.count;i++)p.setY(i,reviewedHeight(p.getX(i),p.getZ(i)));terrain.vis.computeVertexNormals();}
  const original=(loaded.scene.getObjectByName('COL_Terrain') as THREE.Mesh).geometry;
  terrain.col=new THREE.BufferGeometry().setAttribute('position',original.attributes.position.clone());
  if(original.index)terrain.col.setIndex(original.index.clone());
  if(id==='britain'){
    // A repeated build already contains southwest land. Retain only the original
    // tile here, then append one fresh extension below (never duplicate it).
    const p=terrain.col.attributes.position,index=terrain.col.index,vertices:number[]=[],indices:number[]=[],used=new Map<number,number>();
    const count=index?.count??p.count;
    for(let i=0;i<count;i+=3){
      const ids=[0,1,2].map(j=>index?index.getX(i+j):i+j);
      if(ids.some(j=>p.getZ(j)>360.01))continue;
      for(const j of ids){let next=used.get(j);if(next===undefined){next=vertices.length/3;used.set(j,next);vertices.push(p.getX(j),p.getY(j),p.getZ(j));}indices.push(next);}
    }
    terrain.col.dispose();terrain.col=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(vertices,3)).setIndex(indices);
  }
  const positions=terrain.col.attributes.position;
  for(let i=0;i<positions.count;i++){
    const x=Math.round(positions.getX(i)/2)*2,z=Math.round(positions.getZ(i)/2)*2,y=reviewedHeight(x,z);
    if(Math.abs(y-positions.getY(i))>.02)positions.setY(i,y);
  }
  loaded.scene.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();for(const m of [o.material].flat())m.dispose();}});
  const patchScene=new THREE.Scene();
  for(const [name,geometry] of [['Terrain',terrain.vis]] as const){
    const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({name:'M_Terrain',vertexColors:name==='Terrain'}));mesh.name=name;patchScene.add(mesh);
  }
  // Quantize/compress the NEW surface in isolation. Reprocessing reviewed actors
  // and architecture would invalidate their exact floor, repair and collision data.
  const buffer=await new GLTFExporter().parseAsync(patchScene,{binary:true,onlyVisible:false}) as ArrayBuffer;
  const patch=await io.readBinary(await compress(new Uint8Array(buffer),true));
  for(const ext of patch.getRoot().listExtensionsUsed())doc.createExtension(ext.constructor as never).setRequired(ext.isRequired());
  const nodes=patch.getRoot().listNodes().filter(n=>n.getName()==='Terrain');
  const copied=copyToDocument(doc,patch,nodes);
  for(const source of nodes){
    const target=doc.getRoot().listNodes().find(n=>n.getName()===source.getName()&&!Array.from(copied.values()).includes(n))!;
    if(!target)throw new Error(`Missing authored terrain node: ${source.getName()}`);
    const replacement=copied.get(source) as Node,material=target.getMesh()!.listPrimitives()[0].getMaterial();
    const oldMesh=target.getMesh()!;target.setMesh(replacement.getMesh()).setTranslation(replacement.getTranslation()).setRotation(replacement.getRotation()).setScale(replacement.getScale());
    for(const primitive of target.getMesh()!.listPrimitives())primitive.setMaterial(material);
    replacement.dispose();oldMesh.dispose();
  }
  const collision=doc.getRoot().listNodes().find(n=>n.getName()==='COL_Terrain')!,oldCollision=collision.getMesh()!,collisionMaterial=oldCollision.listPrimitives()[0].getMaterial();
  const storage=doc.getRoot().listBuffers()[0];
  const primitive=doc.createPrimitive().setMaterial(collisionMaterial).setAttribute('POSITION',doc.createAccessor('MainlandCollisionPositions',storage).setType(Accessor.Type.VEC3).setArray(new Float32Array(terrain.col.attributes.position.array)));
  if(terrain.col.index)primitive.setIndices(doc.createAccessor('MainlandCollisionIndices',storage).setType(Accessor.Type.SCALAR).setArray(new Uint32Array(terrain.col.index.array)));
  collision.setMesh(doc.createMesh('MainlandCollision').addPrimitive(primitive)).setTranslation([0,0,0]).setRotation([0,0,0,1]).setScale([1,1,1]);oldCollision.dispose();
  await doc.transform(prune({keepLeaves:true,keepAttributes:true}),unpartition());
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({method:EXTMeshoptCompression.EncoderMethod.QUANTIZE});
  writeFileSync(url,await io.writeBinary(doc));
  patchScene.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();(o.material as THREE.Material).dispose();}});
  console.log(`${id}: continental terrain replaced; reviewed accessor data retained exactly`);
}

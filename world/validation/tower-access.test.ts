import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {buildTowerAccess,TOWER_ACCESS} from '../tools/gen/valley/tower-access';
import {heightFn} from '../tools/gen/terrain';
const bytes=readFileSync(new URL('../public/assets/world_alpha.glb',import.meta.url));
const length=bytes.readUInt32LE(12), gltf=JSON.parse(bytes.subarray(20,20+length).toString());
const binary=bytes.subarray(28+length), hash=(b:Uint8Array|string)=>createHash('sha256').update(b).digest('hex');

test('optional tower access appends only two nodes and preserves all original art, collider and JSON bytes semantically',()=>{
 assert.equal(hash(binary.subarray(0,3672364)),'ee8b47f6622dd66ef27716a6a707eebcb1107a0d6dcc31c3429df0b136d7be20');
 assert.equal(binary.length,3672364+29376);
 const copy=structuredClone(gltf);
 for(const [key,count]of Object.entries({nodes:151,meshes:90,bufferViews:241,accessors:317})){
  assert.equal(copy[key].length,count+(key==='nodes'||key==='meshes'?2:4));copy[key]=copy[key].slice(0,count);
 }
 assert.equal(copy.nodes[1].children.pop(),151);assert.equal(copy.nodes[79].children.pop(),152);
 copy.buffers[0].byteLength=3672364;
 assert.equal(hash(JSON.stringify(copy)),'db3a7e79499941c677fa5ada50c2f911ebe4ffdf87dd405fefad19f3a0b2c223');
 const layout=JSON.parse(readFileSync(new URL('../public/assets/world_alpha.layout.json',import.meta.url),'utf8'));
 const marker=layout.markers.find((m:{id:string})=>m.id==='tower_console');
 assert.deepEqual(marker.requires,['relay_a','relay_b']);assert.deepEqual(marker.p,[0,30.5,-150.5]);
});

test('source ramp matches shipped positions/normals/colors/collision and retains north glide corridor',()=>{
 const candidate=buildTowerAccess(heightFn), built=candidate.batch.build();assert(built.vis&&built.col);
 const arrays=(nodeIndex:number)=>{
  const primitive=gltf.meshes[gltf.nodes[nodeIndex].mesh].primitives[0];
  return Object.fromEntries(Object.entries(primitive.attributes as Record<string,number>).map(([name,index])=>{
   const a=gltf.accessors[index],v=gltf.bufferViews[a.bufferView];assert.equal(a.componentType,5126);assert.equal(a.type,'VEC3');
   return[name,binary.subarray((v.byteOffset??0)+(a.byteOffset??0),(v.byteOffset??0)+(a.byteOffset??0)+a.count*12)];
  }));
 };
 const art=arrays(151),col=arrays(152);
 for(const [key,attribute]of Object.entries({POSITION:'position',NORMAL:'normal',COLOR_0:'color'})){
  // JSON transport preserves all float values but canonicalizes signed zero.
  const a=Float32Array.from(built.vis.getAttribute(attribute).array,v=>v===0?0:v);assert.deepEqual(Buffer.from(a.buffer,a.byteOffset,a.byteLength),art[key]);
 }
 const c=built.col.getAttribute('position').array;assert.deepEqual(Buffer.from(c.buffer,c.byteOffset,c.byteLength),col.POSITION);
 assert.equal(built.vis.getAttribute('position').count/3,264);assert.equal(built.col.getAttribute('position').count/3,24);
 assert(candidate.slopeDegrees<32&&candidate.slopeDegrees>31);assert(TOWER_ACCESS.z-TOWER_ACCESS.width/2>-165.94+1);
 const surface=new THREE.Mesh(built.col,new THREE.MeshBasicMaterial({side:THREE.FrontSide}));
 for(const x of[-25,-22,-19,-16,-14]){
  const hits=new THREE.Raycaster(new THREE.Vector3(x,40,TOWER_ACCESS.z),new THREE.Vector3(0,-1,0),0,30).intersectObject(surface);
  assert.equal(hits.length,1);assert(hits[0].face!.normal.y>Math.cos(32*Math.PI/180));
 }
 built.vis.dispose();built.col.dispose();surface.material.dispose();for(const g of[...candidate.batch.vis,...candidate.batch.col])g.dispose();
});

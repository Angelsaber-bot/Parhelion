/** Station-specific art contracts, deliberately independent of runtime WebGL. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {createEraStoryScene} from '../src/eraStoryScenes';
import type {EraId} from '../src/eraStories';
const collisionHashes={britain:'19a3d44e595667e9c8d795fbe6a8a2a730eba1a67001a2e76072a54cff5f8840',blacksail:'61115e7840fe46abfc211ede3e2e50345ecf5ab9564d60cf73f5c7795bff7a34',winter:'4d67ac07add3dba8c8a67d414a7bae77aab7bde6885d32669b9821c79a678497',kyoto:'910f70a28647538166c0a0835c67a0d8d417a4166e84a1bb10ad6287c7a00fe3'};
function make(id:EraId){return createEraStoryScene({id,name:[id,id],position:[0,0,0],entry:[0,0,0],footprint:[35,35],groundRange:0});}
test('Britain inscription clears the shield bevel; Kyoto eaves have a visible underside',()=>{
 const britain=make('britain');britain.group.position.set(0,0,0);britain.group.updateMatrixWorld(true);
 const ray=new THREE.Raycaster(new THREE.Vector3(-.13,1.38,2),new THREE.Vector3(0,0,-1));
 const paper=ray.intersectObject(britain.group.getObjectByName('EraStation_britain_paper')!)[0];
 const metal=ray.intersectObject(britain.group.getObjectByName('EraStation_britain_metal')!)[0];
 assert.ok(paper&&metal&&paper.distance<metal.distance,'inscription must not disappear behind the new plaque');britain.dispose();
 const kyoto=make('kyoto');kyoto.group.position.set(0,0,0);kyoto.group.updateMatrixWorld(true);
 const roof=kyoto.group.getObjectByName('EraStation_kyoto_metal')!;
 for(const x of[-.5,.5]){
  const hits=new THREE.Raycaster(new THREE.Vector3(x,3,.3),new THREE.Vector3(0,1,0)).intersectObject(roof);
  assert.ok(hits.length&&hits[0].distance<.7,'roof underside must survive front-face culling');
  const top=new THREE.Raycaster(new THREE.Vector3(x,4,0),new THREE.Vector3(0,-1,0));
  const metalTop=top.intersectObject(roof)[0],rafter=top.intersectObject(kyoto.group.getObjectByName('EraStation_kyoto_wood')!)[0];
  assert.ok(metalTop&&rafter&&metalTop.distance<rafter.distance,'wood rafters must not poke through the roof');
 }
 for(let j=1;j<6;j++){
  const ray=new THREE.Raycaster(new THREE.Vector3(.55,2.05+j*.13,2),new THREE.Vector3(0,0,-1));
  const rib=ray.intersectObject(kyoto.group.getObjectByName('EraStation_kyoto_paper')!)[0];
  const shade=ray.intersectObject(kyoto.group.getObjectByName('EraStation_kyoto_signal')!)[0];
  assert.ok(rib&&shade&&rib.distance<shade.distance,`lantern rib ${j} must sit outside the shade`);
 }
 kyoto.dispose();
});
for(const id of Object.keys(collisionHashes) as EraId[]){
 test(`${id}: craft polish leaves collision byte-for-byte unchanged`,()=>{
  const scene=make(id),g=scene.colliders[0].bvh.geometry,h=createHash('sha256');
  for(const a of[g.attributes.position.array,g.index!.array])h.update(Buffer.from(a.buffer,a.byteOffset,a.byteLength));
  assert.equal(h.digest('hex'),collisionHashes[id]);scene.dispose();
 });
 test(`${id}: deterministic mipmapped craft maps, finite UVs, exact disposal and tight budget`,()=>{
  const scene=make(id),again=make(id);let mapCount=0,bytes=0,disposals=0,triangles=0;
  scene.group.traverse(o=>{
   if(!(o instanceof THREE.Mesh))return;
   triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;
   const m=o.material as THREE.MeshStandardMaterial,peer=again.group.getObjectByName(o.name) as THREE.Mesh;
   if(!m.map)return;
   assert.ok(m.map instanceof THREE.DataTexture);const t=m.map;mapCount++;bytes+=t.image.data.byteLength;
   assert.equal(t.image.width,64);assert.equal(t.image.height,64);assert.equal(t.generateMipmaps,true);
   assert.equal(t.minFilter,THREE.LinearMipmapLinearFilter);assert.equal(t.colorSpace,THREE.SRGBColorSpace);
   assert.ok(o.geometry.attributes.uv);for(const n of o.geometry.attributes.uv.array)assert.ok(Number.isFinite(n));
   assert.deepEqual(t.image.data,((peer.material as THREE.MeshStandardMaterial).map as THREE.DataTexture).image.data);
   const values=new Set(Array.from(t.image.data).filter((_,i)=>i%4!==3));assert.ok(values.size>5,'surface is not a flat fill');
   t.addEventListener('dispose',()=>disposals++);
  });
  assert.equal(mapCount,5);assert.equal(bytes,81920);assert.ok(triangles<2200,`${triangles} triangles`);
  scene.dispose();scene.dispose();assert.equal(disposals,5);again.dispose();
 });
 test(`${id}: dormant, found and complete surfaces remain distinguishable and reversible`,()=>{
  const scene=make(id),get=(k:string)=>(scene.group.getObjectByName(`EraStation_${id}_${k}`) as THREE.Mesh).material as THREE.MeshStandardMaterial;
  const snapshot=()=>['signal','complete','cloth'].map(k=>[get(k).color.getHex(),get(k).emissiveIntensity]);
  const idle=snapshot();scene.applyState({discovered:true,routeReady:false,complete:false});const found=snapshot();
  scene.applyState({discovered:true,routeReady:true,complete:true});const complete=snapshot();
  assert.notDeepEqual(idle,found);assert.notDeepEqual(found[1],complete[1]);assert.notDeepEqual(found[2],complete[2]);
  scene.applyState({discovered:true,routeReady:false,complete:false});assert.deepEqual(snapshot(),found);
  scene.applyState({discovered:false,routeReady:false,complete:false});assert.deepEqual(snapshot(),idle);scene.dispose();
 });
}

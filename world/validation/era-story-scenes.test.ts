import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import {createEraStoryScene,ERA_SCENE_LOCAL} from '../src/eraStoryScenes';
import {ERA_OPTIONALS,type EraId} from '../src/eraStories';
import {buildBritainSettlement} from '../src/settlements/britain';
import {buildBlackSailSettlement} from '../src/settlements/blacksail';
import {buildWinterSettlement} from '../src/settlements/winter';
import {buildKyotoSettlement} from '../src/settlements/kyoto';
import {mergeParts} from '../src/settlements/merge';
import type {SettlementPlacement} from '../src/settlements/types';
const builds={britain:buildBritainSettlement,blacksail:buildBlackSailSettlement,winter:buildWinterSettlement,kyoto:buildKyotoSettlement};
for(const region of Object.keys(builds) as EraId[]){
 const kit=builds[region](),placement:SettlementPlacement={id:region,name:kit.name,position:[105,7,-221],entry:[105,7,-203],footprint:kit.footprint,groundRange:.1};
 test(`${region}: bounded authored art, state projection, culling and disposal`,()=>{
  const scene=createEraStoryScene(placement);let meshes=0,triangles=0,lights=0;
  scene.group.traverse(o=>{if(o instanceof THREE.Light)lights++;if(o instanceof THREE.Mesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;assert.equal(o.castShadow,false);for(const n of o.geometry.attributes.position.array)assert.ok(Number.isFinite(n));}});
  assert.ok(meshes<=8);assert.ok(triangles<5000);assert.equal(lights,0);assert.equal(scene.markers[0].id,ERA_OPTIONALS[region].id);
  const signal=scene.group.getObjectByName(`EraStation_${region}_signal`) as THREE.Mesh,mat=signal.material as THREE.MeshStandardMaterial;
  assert.equal(mat.emissiveIntensity,0);scene.applyState({routeReady:true,complete:true,discovered:true});assert.equal(mat.emissiveIntensity,1.25);scene.applyState({routeReady:false,complete:false,discovered:false});assert.equal(mat.emissiveIntensity,0);
  scene.updateVisibility(new THREE.Vector3(1e4,0,1e4));assert.equal(scene.group.visible,false);scene.updateVisibility(scene.group.position);assert.equal(scene.group.visible,true);
  const footprint=scene.group.position.toArray();assert.deepEqual(footprint,placement.position.map((v,i)=>v+ERA_SCENE_LOCAL[region][i]));
  console.log('Era station budget',region,{meshes,triangles,lights});scene.dispose();scene.dispose();scene.applyState({routeReady:true,complete:true,discovered:true});assert.ok(scene.colliders.every(c=>!c.enabled));assert.equal(scene.group.children.length,0);
 });
 test(`${region}: actual settlement foundation, standing point, interaction LOS and central spine stay clear`,()=>{
  const scene=createEraStoryScene({...placement,position:[0,0,0]});kit.group.updateMatrixWorld(true);const geos:THREE.BufferGeometry[]=[];
  kit.group.traverse(o=>{if(o instanceof THREE.Mesh&&o.userData.solid){let g=o.geometry.clone();g.applyMatrix4(o.matrixWorld);if(g.index)g=g.toNonIndexed();geos.push(g);}});
  const world=new MeshBVH(mergeParts(geos));const [x,,z]=ERA_SCENE_LOCAL[region],standing=new THREE.Vector3(x,.05,z+2.2),box=new THREE.Box3(standing.clone().add(new THREE.Vector3(-.35,.2,-.35)),standing.clone().add(new THREE.Vector3(.35,1.75,.35)));
  for(const bvh of[world,...scene.colliders.map(c=>c.bvh)])assert.equal(bvh.intersectsBox(box,new THREE.Matrix4()),false,`${region} standing clearance`);
  const target=new THREE.Vector3(...scene.markers[0].p),eye=standing.clone().add(new THREE.Vector3(0,1.62,0)),ray=new THREE.Ray(eye,target.clone().sub(eye).normalize());for(const bvh of[world,...scene.colliders.map(c=>c.bvh)]){const hit=bvh.raycastFirst(ray,THREE.DoubleSide);assert.ok(!hit||hit.distance>=eye.distanceTo(target)-.05,`${region} LOS: ${hit?.distance}`);}
  const stationBounds=new THREE.Box3().setFromObject(scene.group);stationBounds.min.y=.2;assert.equal(world.intersectsBox(stationBounds,new THREE.Matrix4()),false,`${region} station overlaps existing architecture`);
  const ground=world.raycastFirst(new THREE.Ray(new THREE.Vector3(x,1,z),new THREE.Vector3(0,-1,0)),THREE.DoubleSide);assert.ok(ground&&Math.abs(ground.point.y)<.15,`foundation ${ground?.point.y}`);
  // Keep the existing main entrance and walking spine available before and after story.
  const spine=new THREE.Box3(new THREE.Vector3(-1,.3,8),new THREE.Vector3(1,2,14));assert.equal(scene.colliders[0].bvh.intersectsBox(spine,new THREE.Matrix4()),false);
  scene.dispose();geos.forEach(g=>g.dispose());
 });
}

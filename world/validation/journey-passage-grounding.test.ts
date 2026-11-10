import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { createJourneyPassageArt } from '../src/environment/journeyPassageArt';
import { mergeParts } from '../src/settlements/merge';
import { legacyFrameMatrix } from '../src/map/regions';

const grade=4.1/18;
const floor=(x:number)=>8.8+(x+59)*grade-.07;
const passage=createJourneyPassageArt();
// The passage is authored in Kyoto's pre-relayout frame and placed in the world as a whole;
// these checks measure the authored construction, so the colliders are read back in that frame.
const collision=mergeParts(passage.houses.solids).applyMatrix4(legacyFrameMatrix('kyoto').invert()),collider=new MeshBVH(collision);
const render=mergeParts(passage.houses.root.children.filter((o):o is THREE.Mesh=>o instanceof THREE.Mesh).map(mesh=>mesh.geometry));
const visual=new MeshBVH(render);
const ray=(x:number,y:number,z:number,dx:number,dy:number,dz:number)=>new THREE.Ray(new THREE.Vector3(x,y,z),new THREE.Vector3(dx,dy,dz));

test('Kyoto machiya side walls meet the ramp at both ends in render and physical geometry',()=>{
 for(const cx of[-63.5,-72.5])for(const dx of[-3.5,-2,1.5,3.5])for(const sign of[-1,1])for(const bvh of[collider,visual]){
  const x=cx+dx,hit=bvh.raycastFirst(ray(x,floor(x)+.3,740+sign*6,0,0,-sign),THREE.DoubleSide);
  assert.ok(hit&&hit.distance<3,`floating wall at x=${x}, side=${sign}: ${hit?.point.toArray()}`);
  assert.ok(Math.abs(Math.abs(hit.point.z-740)-3.45)<.2,'hit is the actual side facade');
 }
});

test('Kyoto passage keeps full height through both end doors and the connecting corridor',()=>{
 for(let x=-76.8;x<=-59.2;x+=.4){
  const hit=collider.raycastFirst(ray(x,floor(x)+.2,740,0,1,0),THREE.DoubleSide);
  assert.ok(hit&&hit.distance>2.6,`low lintel or roof at x=${x}: ${hit?.distance}`);
 }
 for(const z of[739,740,741]){
  const a=new THREE.Vector3(-76.8,floor(-76.8)+1.2,z),b=new THREE.Vector3(-59.2,floor(-59.2)+1.2,z),direction=b.clone().sub(a);
  const hit=collider.raycastFirst(new THREE.Ray(a,direction.normalize()),THREE.DoubleSide);
  assert.ok(!hit||hit.distance>a.distanceTo(b),'three lanes through the original open central passage stay clear');
 }
});

test('paper shop tables have level tops and individually grounded unequal legs',()=>{
 // measured in the authored (pre-relayout) frame, like the merged colliders above
 const toAuthored=legacyFrameMatrix('kyoto').invert();
 const boxes=passage.houses.solids.map(g=>{const c=g.clone().applyMatrix4(toAuthored);c.computeBoundingBox();return c.boundingBox!;});
 for(const dx of[-2,0,2])for(const lx of[-.48,.48])for(const lz of[-.23,.23]){
  const x=-63.5+dx+lx,z=737.5+lz;
  const leg=boxes.find(box=>Math.abs((box.min.x+box.max.x)/2-x)<.005&&Math.abs((box.min.z+box.max.z)/2-z)<.005&&box.max.x-box.min.x<.1);
  assert.ok(leg,`individual table leg at ${x},${z}`);
  assert.ok(Math.abs(leg.min.y-(floor(x)-.015))<.002,'leg reaches the sloped floor');
  assert.ok(Math.abs(leg.max.y-(floor(-63.5+dx)+.88))<.002,'legs meet the same level tabletop');
 }
});

test('grounding refinement remains batched with a modest geometry budget',()=>{
 const meshes=passage.houses.root.children.filter((o):o is THREE.Mesh=>o instanceof THREE.Mesh);
 assert.ok(meshes.length<=3);
 const triangles=meshes.reduce((n,m)=>n+(m.geometry.index?.count??m.geometry.attributes.position.count)/3,0);
 assert.ok(triangles<5000,`${triangles} triangles`);
 for(const mesh of meshes)for(const n of mesh.geometry.attributes.position.array)assert.ok(Number.isFinite(n));
});

import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createParallaxGarden, PARALLAX_ART_BUDGET, PARALLAX_CLEARANCE } from '../src/environment/parallaxGarden';

test('observatory exhibit batches detail and keeps every geometry finite on sloping ground', () => {
  const garden = createParallaxGarden((x,z)=>10+(x+118)*.015+(z-284)*.012);
  const meshes: THREE.Mesh[] = [], materials = new Set<THREE.Material>();
  garden.root.traverse(object=>{if(object instanceof THREE.Mesh)meshes.push(object);});
  let triangles=0;
  for(const mesh of meshes) {
    const geometry=mesh.geometry;
    triangles+=(geometry.index?.count??geometry.attributes.position.count)/3;
    for(const value of geometry.attributes.position.array)assert.ok(Number.isFinite(value));
    for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])materials.add(material);
  }
  assert.ok(meshes.length<=PARALLAX_ART_BUDGET.meshes, `${meshes.length} render batches`);
  assert.ok(materials.size<=PARALLAX_ART_BUDGET.materials, `${materials.size} materials`);
  assert.ok(triangles<=PARALLAX_ART_BUDGET.triangles, `${triangles} triangles`);
  // Construction detail never creates a collider across either observation stand or baseline.
  for(const geometry of garden.collisionGeometries) {
    geometry.computeBoundingBox();const box=geometry.boundingBox!;
    assert.ok(!box.containsPoint(new THREE.Vector3(...garden.front).add(new THREE.Vector3(0,.05,0))));
    assert.ok(!box.containsPoint(new THREE.Vector3(...garden.side).add(new THREE.Vector3(0,.05,0))));
  }
  for(const [x,z] of[[-118,264],[-118,272],[-118,278],[-118,284],[-104,284]]) {
    assert.ok(PARALLAX_CLEARANCE.some(([x0,z0,x1,z1])=>x>=x0&&x<=x1&&z>=z0&&z<=z1),'instrument, path and footprints have a grass exclusion');
  }
  const owned=new Set([...meshes.map(mesh=>mesh.geometry),...garden.collisionGeometries]);
  let disposedGeometry=0,disposedMaterial=0;
  for(const geometry of owned)geometry.addEventListener('dispose',()=>disposedGeometry++);
  for(const material of materials)material.addEventListener('dispose',()=>disposedMaterial++);
  garden.dispose();garden.dispose();
  assert.equal(disposedGeometry,owned.size,'each owned geometry is released once');
  assert.equal(disposedMaterial,materials.size,'used materials are released once');
});

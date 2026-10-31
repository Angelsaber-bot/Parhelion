import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {detachConsumedSourceNodes} from '../src/consumedSourceNodes';

test('consumed source detachment is idempotent and never disposes shared ART or protected physics resources',()=>{
 const world=new THREE.Group(),region=new THREE.Group(),art=new THREE.Group(),collision=new THREE.Group(),markers=new THREE.Group();
 art.name='ART';collision.name='COLLISION';markers.name='MARKERS';world.add(region);region.add(art,collision,markers);
 const shared=new THREE.BoxGeometry(),material=new THREE.MeshBasicMaterial(),visible=new THREE.Mesh(shared,material),source=new THREE.Mesh(shared,material);
 art.add(visible);collision.add(source);markers.add(new THREE.Object3D());
 const geometryBytes=shared.attributes.position.array.byteLength,original=shared.attributes.position.array.slice();
 let disposed=0;shared.addEventListener('dispose',()=>disposed++);material.addEventListener('dispose',()=>disposed++);
 const receipt=detachConsumedSourceNodes(world,[shared]);
 assert.equal(receipt.roots.length,2);assert.equal(receipt.objects,4);assert.equal(receipt.meshes,1);assert.equal(receipt.geometries,1);
 assert.equal(receipt.sharedArtGeometryReferences,1);assert.equal(receipt.sharedProtectedGeometryReferences,1);
 assert.ok(receipt.sharedArtBackingBuffers>=1);assert.ok(receipt.sharedProtectedBackingBuffers>=1);assert.ok(receipt.backingBytes>=geometryBytes);
 assert.deepEqual(region.children,[art]);assert.equal(visible.geometry,shared);assert.deepEqual(shared.attributes.position.array,original);assert.equal(disposed,0);
 assert.doesNotThrow(()=>JSON.stringify(receipt));assert.equal(detachConsumedSourceNodes(world).objects,0);
 shared.dispose();material.dispose();
});
test('nested consumed metadata is counted once without retaining detached objects',()=>{
 const world=new THREE.Group(),source=new THREE.Group(),nested=new THREE.Group();source.name='COLLISION';nested.name='MARKERS';source.add(nested);world.add(source);
 const receipt=detachConsumedSourceNodes(world);assert.equal(receipt.roots.length,1);assert.equal(receipt.objects,2);assert.equal(world.children.length,0);
});

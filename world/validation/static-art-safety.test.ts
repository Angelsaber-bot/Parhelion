import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {isStaticArtEligible,freezeStaticArt} from '../src/chunk.ts';
const flags=['spin','bob','dynamic','showWhen','hideWhen','opensWhen'];
for(const flag of flags)for(const level of ['self','parent','descendant'])test(`immutable art excludes ${flag} on ${level}`,()=>{
 const parent=new THREE.Group(),mesh=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial()),child=new THREE.Group();parent.add(mesh);mesh.add(child);
 ({self:mesh,parent,descendant:child}[level]!).userData[flag]=true;
 assert.equal(isStaticArtEligible(mesh),false);
});
for(const name of ['TGT_training','Water'])for(const level of ['self','parent','descendant'])test(`immutable art excludes ${name} on ${level}`,()=>{
 const parent=new THREE.Group(),mesh=new THREE.Mesh(),child=new THREE.Group();parent.add(mesh);mesh.add(child);
 ({self:mesh,parent,descendant:child}[level]!).name=name;
 assert.equal(isStaticArtEligible(mesh),false);
});
test('freezing static art leaves actor siblings and visibility controls functional',()=>{
 const scene=new THREE.Scene(),staticArt=new THREE.Group(),actor=new THREE.Group(),hand=new THREE.Group();scene.add(staticArt,actor);actor.add(hand);
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());staticArt.add(mesh);
 assert.equal(isStaticArtEligible(mesh),true);freezeStaticArt(mesh);
 actor.position.x=2;hand.position.y=1;scene.updateMatrixWorld(true);
 assert.deepEqual(hand.getWorldPosition(new THREE.Vector3()).toArray(),[2,1,0]);assert.equal(actor.matrixAutoUpdate,true);assert.equal(hand.matrixWorldAutoUpdate,true);
 mesh.visible=false;assert.equal(mesh.visible,false);mesh.visible=true;assert.equal(mesh.visible,true);
});

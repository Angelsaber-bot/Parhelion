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

test('frozen subtree bypasses recursive passes but preserves explicit world queries and material/visibility state',()=>{
 const scene=new THREE.Scene(),root=new THREE.Group(),nested=new THREE.Group(),mesh=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());
 scene.position.set(12,3,-8);root.position.set(7,2,1);nested.rotation.y=.4;mesh.position.set(2,5,9);scene.add(root);root.add(nested);nested.add(mesh);
 scene.updateMatrixWorld(true);const expected=mesh.matrixWorld.clone();freezeStaticArt(root);
 let visits=0;const original=nested.updateMatrixWorld;nested.updateMatrixWorld=function(force){visits++;return original.call(this,force);};
 scene.updateMatrixWorld(true);scene.updateMatrixWorld();assert.equal(visits,0,'static descendants do not even enter matrix traversal');
 assert.deepEqual(mesh.matrixWorld.elements,expected.elements);
 // The existing freeze contract fixes world matrices even when ancestors move.
 scene.position.x+=100;scene.updateMatrixWorld(true);assert.deepEqual(mesh.matrixWorld.elements,expected.elements);
 assert.deepEqual(mesh.getWorldPosition(new THREE.Vector3()).toArray(),new THREE.Vector3().setFromMatrixPosition(expected).toArray());
 root.updateWorldMatrix(true,true);assert.deepEqual(mesh.matrixWorld.elements,expected.elements);
 mesh.visible=false;(mesh.material as THREE.MeshBasicMaterial).color.setHex(0xff0000);scene.updateMatrixWorld();assert.equal(mesh.visible,false);assert.equal((mesh.material as THREE.MeshBasicMaterial).color.getHex(),0xff0000);
});
for(const depth of [0,1,2])test(`late dynamic addition at depth ${depth} safely restores normal recursive traversal`,()=>{
 const scene=new THREE.Scene(),root=new THREE.Group(),middle=new THREE.Group(),leaf=new THREE.Group();scene.add(root);root.add(middle);middle.add(leaf);
 root.position.x=10;middle.position.y=2;leaf.position.z=3;freezeStaticArt(root);
 const parent=[root,middle,leaf][depth],child=new THREE.Group();child.position.set(1,4,7);parent.add(child);
 assert.equal(root.updateMatrixWorld,THREE.Object3D.prototype.updateMatrixWorld);
 scene.updateMatrixWorld(true);const expected=child.position.clone().applyMatrix4(parent.matrixWorld);assert.deepEqual(child.getWorldPosition(new THREE.Vector3()).toArray(),expected.toArray());
 child.position.x=8;scene.updateMatrixWorld(true);assert.deepEqual(new THREE.Vector3().setFromMatrixPosition(child.matrixWorld).toArray(),child.position.clone().applyMatrix4(parent.matrixWorld).toArray());
 assert.equal(child.matrixAutoUpdate,true);assert.equal(child.matrixWorldAutoUpdate,true);
});
test('removing/reparenting frozen children releases the fast-path ownership, and repeated freezing does not stack listeners',()=>{
 const scene=new THREE.Scene(),root=new THREE.Group(),leaf=new THREE.Group();scene.add(root);root.add(leaf);freezeStaticArt(root);freezeStaticArt(root);
 assert.equal((root as any)._listeners.childadded.length,1);assert.equal((leaf as any)._listeners.childremoved.length,1);
 root.remove(leaf);assert.equal(root.updateMatrixWorld,THREE.Object3D.prototype.updateMatrixWorld);assert.equal((leaf as any)._listeners.childadded.length,0);assert.equal((root as any)._listeners.childremoved.length,0);
 scene.add(leaf);const dynamic=new THREE.Group();leaf.add(dynamic);dynamic.position.y=4;scene.updateMatrixWorld();assert.equal(dynamic.getWorldPosition(new THREE.Vector3()).y,4);
});
test('explicitly enabling root matrix updates restores original behavior without thawing unrelated descendants',()=>{
 const scene=new THREE.Scene(),root=new THREE.Group(),leaf=new THREE.Group();scene.add(root);root.add(leaf);freezeStaticArt(root);
 root.matrixAutoUpdate=true;root.matrixWorldAutoUpdate=true;root.position.x=3;scene.updateMatrixWorld(true);
 assert.equal(root.updateMatrixWorld,THREE.Object3D.prototype.updateMatrixWorld);assert.equal(root.matrixWorld.elements[12],3);assert.equal(leaf.matrixWorldAutoUpdate,false);
});
test('custom matrix callbacks retain their behavior and are never elided by static freezing',()=>{
 class Custom extends THREE.Group {calls=0;override updateMatrixWorld(force?:boolean){this.calls++;super.updateMatrixWorld(force);}}
 const scene=new THREE.Scene(),root=new Custom();scene.add(root);const method=root.updateMatrixWorld;freezeStaticArt(root);scene.updateMatrixWorld();assert.equal(root.updateMatrixWorld,method);assert.ok(root.calls>0);
});

test('removing a frozen root from its scene restores its method and removes all owned listeners',()=>{
 const scene=new THREE.Scene(),root=new THREE.Group(),child=new THREE.Group();root.add(child);scene.add(root);freezeStaticArt(root);
 root.removeFromParent();assert.equal(root.parent,null);assert.equal(root.updateMatrixWorld,THREE.Object3D.prototype.updateMatrixWorld);
 assert.equal((root as any)._listeners.removed.length,0);assert.equal((child as any)._listeners.childadded.length,0);assert.equal((child as any)._listeners.childremoved.length,0);
});

test('explicit dirty root requests and nested custom callbacks are not swallowed',()=>{
 const scene=new THREE.Scene(),root=new THREE.Group();scene.add(root);freezeStaticArt(root);root.matrixWorldNeedsUpdate=true;scene.updateMatrixWorld();assert.equal(root.matrixWorldNeedsUpdate,false);assert.equal(root.updateMatrixWorld,THREE.Object3D.prototype.updateMatrixWorld);
 class Custom extends THREE.Group {calls=0;override updateMatrixWorld(force?:boolean){this.calls++;super.updateMatrixWorld(force);}}
 const parent=new THREE.Group(),child=new Custom();parent.add(child);scene.add(parent);freezeStaticArt(parent);scene.updateMatrixWorld();assert.ok(child.calls>0);assert.equal(parent.updateMatrixWorld,THREE.Object3D.prototype.updateMatrixWorld);
});
test('refreezing after a custom override or absorbing an already-frozen child leaves no stale owners/listeners',()=>{
 const scene=new THREE.Scene(),parent=new THREE.Group(),child=new THREE.Group();scene.add(parent);parent.add(child);freezeStaticArt(child);
 const normal=THREE.Object3D.prototype.updateMatrixWorld;let calls=0;
 child.updateMatrixWorld=function(force){calls++;normal.call(this,force);};
 freezeStaticArt(parent);assert.equal(parent.updateMatrixWorld,normal);assert.equal((child as any)._listeners.childadded.length,0);assert.equal((child as any)._listeners.removed.length,0);
 scene.updateMatrixWorld(true);assert.ok(calls>0);
 const root=new THREE.Group(),leaf=new THREE.Group();root.add(leaf);scene.add(root);freezeStaticArt(root);
 const custom=function(this:THREE.Object3D,force?:boolean){normal.call(this,force);};root.updateMatrixWorld=custom;freezeStaticArt(root);
 assert.equal(root.updateMatrixWorld,custom);assert.equal((leaf as any)._listeners.childadded.length,0);assert.equal((root as any)._listeners.childremoved.length,0);
 const dynamic=new THREE.Group();dynamic.position.x=9;leaf.add(dynamic);scene.updateMatrixWorld();assert.equal(dynamic.getWorldPosition(new THREE.Vector3()).x,9);
});

test('a saved or instrumented fast method falls back after ownership is invalidated',()=>{
 const scene=new THREE.Scene(),root=new THREE.Group(),nested=new THREE.Group();root.add(nested);scene.add(root);freezeStaticArt(root);
 const fast=root.updateMatrixWorld;let callbacks=0;root.updateMatrixWorld=function(force){callbacks++;fast.call(this,force);};
 const live=new THREE.Group();live.position.x=6;nested.add(live);scene.updateMatrixWorld(true);
 assert.ok(callbacks>0);assert.equal(live.getWorldPosition(new THREE.Vector3()).x,6);
 live.position.x=9;scene.updateMatrixWorld(true);assert.equal(live.matrixWorld.elements[12],9);
});

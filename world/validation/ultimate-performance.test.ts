import {test} from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {clone} from 'three/examples/jsm/utils/SkeletonUtils.js';import {readCharacter} from './characters/inspect.ts';import {SERVANT_MODELS} from '../src/servant.ts';import {fileURLToPath} from 'node:url';import {createUltimatePerformance} from '../src/ultimatePerformance.ts';
const load=()=>readCharacter(fileURLToPath(new URL(SERVANT_MODELS.armor)));
test('Saber performance authors a two-handed anticipation on private clone without touching source',async()=>{
 const {gltf}=await load();const source=gltf.scene,copy=clone(source);const before:any[]=[];source.traverse(o=>before.push([o.position.toArray(),o.quaternion.toArray(),o.scale.toArray()]));
 const p=createUltimatePerformance('saber',copy);p.update({phase:'intro',progress:1,elapsed:.65});const hand=copy.getObjectByName('mixamorigRightHand')!,start=hand.getWorldPosition(new THREE.Vector3());
 p.update({phase:'charge',progress:1,elapsed:2.55});const end=hand.getWorldPosition(new THREE.Vector3());assert.ok(end.y-start.y>.18,'new charge raises both-hand grip');
 const left=copy.getObjectByName('mixamorigLeftHand')!,socket=p.anchors.socket!;const target=socket.localToWorld(new THREE.Vector3(0,-.105,.018));assert.ok(left.getWorldPosition(new THREE.Vector3()).distanceTo(target)<.035,'left support hand reaches hilt');
 copy.traverse(o=>assert.ok(o.matrixWorld.elements.every(Number.isFinite)));const after:any[]=[];source.traverse(o=>after.push([o.position.toArray(),o.quaternion.toArray(),o.scale.toArray()]));assert.deepEqual(after,before);p.dispose();
});
test('Saber release creates a distinct contact-driven downward-forward stroke',async()=>{
 const {gltf}=await load();const copy=clone(gltf.scene),p=createUltimatePerformance('saber',copy),mixer=new THREE.AnimationMixer(copy);const clip=gltf.animations.find(c=>c.name==='Attack')!;mixer.clipAction(clip).play();
 p.update({phase:'charge',progress:1,elapsed:2.55});const hand=copy.getObjectByName('mixamorigRightHand')!,raised=hand.getWorldPosition(new THREE.Vector3());
 p.update({phase:'release',progress:.1,elapsed:2.8,strikeCount:0});assert.ok(hand.getWorldPosition(new THREE.Vector3()).distanceTo(raised)<.02);
 p.update({phase:'release',progress:.2,elapsed:3,strikeCount:1});p.update({phase:'release',progress:.3,elapsed:3.16,strikeCount:1});assert.ok(raised.y-hand.getWorldPosition(new THREE.Vector3()).y>.3,'decisive new hand stroke');
 copy.traverse(o=>assert.ok(o.matrixWorld.elements.every(Number.isFinite)));p.dispose();
});
test('non-Saber identity is a strict no-op',()=>{const root=new THREE.Group(),b=new THREE.Bone();root.add(b);const p=createUltimatePerformance('musashi',root);p.update({phase:'charge',progress:1,elapsed:2});assert.deepEqual(b.quaternion.toArray(),[0,0,0,1]);p.reset();p.dispose();});

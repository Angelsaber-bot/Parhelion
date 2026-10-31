/** Synthetic presentation boundary stress, separate from the actual follow-controller route. */
import{MeshBVH}from'three-mesh-bvh';
import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';import{fileURLToPath}from'node:url';
import{readCharacter}from'./characters/inspect.ts';import{ContractServant,SERVANT_MODELS}from'../src/servant.ts';import{FirstContract}from'../src/contracts.ts';import{ServantAppearance}from'../src/servantAppearance.ts';import{saberRunRate}from'../src/characters/saberStride.ts';
for(const hz of [30,60,120])test(`${hz}Hz: finite-leg sharp circular pivots release instead of stretching`,async t=>{
 const{gltf}=await readCharacter(fileURLToPath(SERVANT_MODELS.civilian)),appearance=new ServantAppearance();appearance.select('civilian');
 const actor=new ContractServant({scene:new THREE.Scene(),marker:{id:'test',type:'interact',label:'test',p:[0,0,0]},contract:new FirstContract(new Set(['saber_contract'])),appearance,colliders:[{name:'actual-pivot-floor',enabled:true,bvh:new MeshBVH(new THREE.PlaneGeometry(200,200).rotateX(-Math.PI/2))}],load:async()=>gltf,target:()=>null,strike:()=>null});await actor.ensureLoaded();const a=actor as any;const run=a.clips.get('run');a.play('run',false,saberRunRate(5.5,run.getClip().duration));a.strideSpeed=5.5;
 const bones=['Left','Right'].map(s=>['UpLeg','Leg','Foot'].map(n=>gltf.scene.getObjectByName('mixamorig'+s+n)!));gltf.scene.updateWorldMatrix(true,true);
 const lengths=bones.map(chain=>chain[0].getWorldPosition(new THREE.Vector3()).distanceTo(chain[1].getWorldPosition(new THREE.Vector3()))+chain[1].getWorldPosition(new THREE.Vector3()).distanceTo(chain[2].getWorldPosition(new THREE.Vector3())));
 let maxStretch=0,maxFootStep=0,previous=bones.map(c=>c[2].getWorldPosition(new THREE.Vector3()));
 for(let tick=0;tick<4*hz;tick++){const phase=4*tick/hz;actor.root.position.set(1.375*Math.sin(phase),0,1.375*Math.cos(phase));actor.root.rotation.y=phase+Math.PI/2;const root=actor.root.position.clone();a.tick(1/hz);assert.ok(actor.root.position.equals(root));
  bones.forEach((chain,side)=>{const hip=chain[0].getWorldPosition(new THREE.Vector3()),foot=chain[2].getWorldPosition(new THREE.Vector3());maxStretch=Math.max(maxStretch,hip.distanceTo(foot)-lengths[side]);if(tick>0)maxFootStep=Math.max(maxFootStep,foot.distanceTo(previous[side]));previous[side]=foot;assert.ok(foot.toArray().every(Number.isFinite));});
 }
 t.diagnostic(JSON.stringify({hz,maxStretch,maxFootSpeed:maxFootStep*hz,reachReleases:actor.strideDiagnostics!.reachReleases,maxAnchorError:actor.strideDiagnostics!.maxAnchorError}));assert.ok(maxStretch<1e-6);assert.ok(maxFootStep*hz<20);assert.ok(actor.strideDiagnostics!.reachReleases<20);
 for(let i=0;i<hz&&!actor.strideDiagnostics!.planted.some(Boolean);i++){actor.root.position.addScaledVector(new THREE.Vector3(Math.sin(actor.root.rotation.y),0,Math.cos(actor.root.rotation.y)),5.5/hz);a.tick(1/hz);}assert.ok(actor.strideDiagnostics!.planted.some(Boolean));
 const releases=actor.strideDiagnostics!.reachReleases;actor.root.position.y+=.25;a.tick(0);assert.ok(actor.strideDiagnostics!.reachReleases>releases,'unreachable support must release, never lengthen the rig');
 actor.root.rotation.y+=Math.PI;a.tick(1/hz);assert.deepEqual(actor.strideDiagnostics!.planted,[false,false],'discontinuous heading invalidates old world anchors');actor.dispose();
});

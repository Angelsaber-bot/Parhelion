import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';import{MeshBVH}from'three-mesh-bvh';import{fileURLToPath}from'node:url';
import{readCharacter}from'./characters/inspect.ts';import{ContractServant,SERVANT_MODELS}from'../src/servant.ts';import{FirstContract}from'../src/contracts.ts';import{ServantAppearance}from'../src/servantAppearance.ts';
for(const outfit of ['armor','civilian']as const)test(`${outfit}: grounded runtime preserves every upper carry local transform and original clip`,async()=>{
 const geometry=new THREE.PlaneGeometry(200,200).rotateX(-Math.PI/2),p=geometry.attributes.position;for(let i=0;i<p.count;i++)p.setY(i,.12*p.getZ(i));const colliders=[{name:'carry-slope',enabled:true,bvh:new MeshBVH(geometry)}];
 const actors:ContractServant[]=[],models:THREE.Object3D[]=[],originals:string[]=[],clips:THREE.AnimationClip[][]=[];
 for(let i=0;i<2;i++){const{gltf}=await readCharacter(fileURLToPath(SERVANT_MODELS[outfit])),appearance=new ServantAppearance();appearance.select(outfit);const actor=new ContractServant({scene:new THREE.Scene(),marker:{id:'test',type:'interact',label:'test',p:[0,0,0]},contract:new FirstContract(new Set(['saber_contract'])),appearance,colliders,load:async()=>gltf,target:()=>null,strike:()=>null});originals.push(JSON.stringify(gltf.animations.map(c=>c.toJSON())));clips.push(gltf.animations);await actor.ensureLoaded();actors.push(actor);models.push(gltf.scene);if(i===1){(actor as any).grounding=undefined;(actor as any).stride=undefined;}}
 try{const names:string[]=[];models[0].getObjectByName('mixamorigSpine')!.traverse(o=>{if(!(o as THREE.Mesh).isMesh)names.push(o.name);});assert.ok(names.length>=50,'positive actual upper rig');
  const player=new THREE.Vector3();for(let frame=0;frame<360;frame++){const time=frame/60,yaw=time<3?Math.PI/2:Math.PI/2*(4-time),speed=time>.5&&time<5?5.5:0;player.x+=Math.sin(yaw)*speed/60;player.z+=Math.cos(yaw)*speed/60;player.y=.12*player.z;
   for(const actor of actors)actor.update(1/60,player,yaw,true,false);
   assert.deepEqual(actors[0].root.position.toArray(),actors[1].root.position.toArray());assert.deepEqual(actors[0].root.quaternion.toArray(),actors[1].root.quaternion.toArray());
   for(const name of names){const a=models[0].getObjectByName(name)!,b=models[1].getObjectByName(name)!;assert.deepEqual(a.quaternion.toArray(),b.quaternion.toArray(),name);assert.deepEqual(a.position.toArray(),b.position.toArray(),name);assert.deepEqual(a.scale.toArray(),b.scale.toArray(),name);}
  }
  assert.ok(actors[0].groundDiagnostics!.patch.shapecasts>0);assert.equal(actors[1].groundDiagnostics,undefined);for(let i=0;i<2;i++)assert.equal(JSON.stringify(clips[i].map(c=>c.toJSON())),originals[i],'native authored clips unchanged');
 }finally{for(const actor of actors)actor.dispose();geometry.dispose();}
});

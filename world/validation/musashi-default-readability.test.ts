import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ultimateReadability } from '../src/ultimateReadability';
import { SkillPresentation } from '../src/skillPresentation';
test('Musashi default profile is local; Saber and other profiles remain exact',()=>{
 const old={hemisphere:2.8,key:3.5,rim:3,bloomStrength:.75,bloomRadius:.48,bloomThreshold:.72};
 for(const id of ['blackbeard','napoleon','unknown'])assert.deepEqual(ultimateReadability(id),old);
 assert.deepEqual(ultimateReadability('saber'),{hemisphere:1.6,key:2.4,rim:1.5,bloomStrength:.28,bloomRadius:.30,bloomThreshold:.90});
 const m=ultimateReadability('musashi');assert.ok(m.key<old.key&&m.rim<old.rim&&m.hemisphere<old.hemisphere&&m.bloomStrength<old.bloomStrength&&m.bloomThreshold>old.bloomThreshold);
 assert.ok(Object.isFrozen(m));assert.equal(ultimateReadability('musashi'),m);
});
test('Musashi Q lowers default stroke/contact opacity without changing event data',()=>{
 const fx=new SkillPresentation(new THREE.Scene());
 const event={type:'strike' as const,identity:'musashi' as const,slot:'skill' as const,origin:{x:0,y:0,z:0},direction:{x:0,y:0,z:1},range:9,halfWidth:1.5,damage:30,maxTargets:3,at:.2,pulse:0};
 const before=JSON.stringify(event);
 for(const reduced of [false,true]){fx.clear();fx.show(event,reduced);fx.root.traverseVisible(o=>{if((o as THREE.Mesh).isMesh)assert.equal(((o as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity,reduced?.09:.18);});fx.clear();fx.hit(event,{x:0,y:0,z:4},reduced);fx.root.traverseVisible(o=>{if((o as THREE.Mesh).isMesh)assert.equal(((o as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity,reduced?.07:.12);});}
 assert.equal(JSON.stringify(event),before);fx.dispose();
});

test('Musashi cinematic fill/key caps hold through normal and reduced phases',async()=>{
 const {EraCinematicRemake}=await import('../src/eraCinematicRemake');
 const owner={mesh(g:THREE.BufferGeometry,m:THREE.Material,p:THREE.Object3D){const mesh=new THREE.Mesh(g,m);p.add(mesh);return mesh;},material(c:number,o:number){return new THREE.MeshBasicMaterial({color:c,opacity:o,transparent:true});}};
 for(const identity of ['musashi','blackbeard','napoleon'])for(const reduced of [false,true]){
  const actor=new THREE.Group(),clone=new THREE.Group(),head=new THREE.Object3D();head.name=identity==='musashi'?'mixamorigHead':'Head';clone.add(head);actor.add(clone);
  const cinema=new EraCinematicRemake(actor,clone,identity,owner),camera=new THREE.PerspectiveCamera();let peak=0;
  for(const phase of ['intro','charge','release','outro'] as const)for(let i=0;i<=60;i++){
   cinema.update({elapsed:i/60,phase,progress:i/60,pulse:1,strikeCount:phase==='release'?1:0},camera,reduced);
   cinema.root.traverse(o=>{if((o as THREE.PointLight).isPointLight)peak=Math.max(peak,(o as THREE.PointLight).intensity);});
  }
  assert.ok(peak>0);assert.ok(peak<=(identity==='musashi'?.9:2.2));
  if(identity!=='musashi'&&!reduced)assert.equal(peak,2.2);
  cinema.dispose();
 }
});

test('actual stage switches local base lights back after Musashi',async()=>{
 const {UltimateStage}=await import('../src/ultimateStage');const source=new THREE.Group();source.add(new THREE.Mesh(new THREE.BoxGeometry(1,2,1),new THREE.MeshStandardMaterial()));const stage=new UltimateStage();
 for(const identity of ['musashi','blackbeard','saber','napoleon','musashi']){
  stage.begin({identity,sourceRoot:source});const p=ultimateReadability(identity);
  const hemi=stage.scene.children.find(o=>(o as THREE.HemisphereLight).isHemisphereLight) as THREE.HemisphereLight;
  const lights=stage.scene.children.filter(o=>(o as THREE.DirectionalLight).isDirectionalLight) as THREE.DirectionalLight[];
  assert.equal(hemi.intensity,p.hemisphere);assert.deepEqual(lights.map(l=>l.intensity),[p.key,p.rim]);stage.end();
 }
 stage.dispose();
});

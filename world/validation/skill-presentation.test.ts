import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';import {readFileSync}from'node:fs';
import {SkillPresentation}from'../src/skillPresentation';import {skillContains,type SkillStrike,type SkillEvent}from'../src/contractSkills';
const event=(identity:'saber'|'blackbeard'|'napoleon'|'musashi'|null=null):Exclude<SkillEvent,{type:'guard'}>=>({type:'strike',identity,slot:'skill',origin:{x:0,y:0,z:0},direction:{x:0,y:0,z:1},range:9,halfWidth:1.5,damage:30,maxTargets:3,at:.2,pulse:0});
const visible=(f:SkillPresentation)=>{const m:THREE.Mesh[]=[];f.root.traverseVisible(o=>{if(o instanceof THREE.Mesh)m.push(o);});return m;};
test('feathered open silhouettes use real Three vertex RGBA alpha, not black edge paint',()=>{const f=new SkillPresentation(new THREE.Scene());f.show(event('saber'));const g=visible(f)[0].geometry,c=g.getAttribute('color');assert.equal(c.itemSize,4);assert.ok(Array.from({length:c.count},(_,i)=>c.getW(i)).some(a=>a===0));assert.ok(Array.from({length:c.count},(_,i)=>c.getW(i)).some(a=>a>.9));assert.ok(Array.from({length:c.count},(_,i)=>c.getX(i)).every(x=>x>.7));const mat=visible(f)[0].material as THREE.MeshBasicMaterial;assert.equal(mat.vertexColors,true);assert.equal(mat.depthWrite,false);assert.equal(mat.depthTest,true);assert.equal(mat.map,null);assert.equal(mat.alphaMap,null);
 const programs=readFileSync(new URL('../node_modules/three/src/renderers/webgl/WebGLPrograms.js',import.meta.url),'utf8'),fragment=readFileSync(new URL('../node_modules/three/src/renderers/shaders/ShaderChunk/color_fragment.glsl.js',import.meta.url),'utf8');assert.match(programs,/vertexAlphas: material.vertexColors === true.*color.itemSize === 4/);assert.match(fragment,/diffuseColor \*= vColor/);f.dispose();});
test('ordinary melee is a brief blade-aligned arc, never the player ability expanding pulse',()=>{const f=new SkillPresentation(new THREE.Scene()),e=event();f.show(e,false,{style:'melee',origin:{x:2,y:1.1,z:3},bladeDirection:{x:0,y:.6,z:.8}});const m=visible(f)[0],scale=m.scale.clone(),position=m.position.clone();f.root.updateMatrixWorld(true);const axis=new THREE.Vector3(0,1,0).applyQuaternion(m.getWorldQuaternion(new THREE.Quaternion()));assert.ok(axis.distanceTo(new THREE.Vector3(0,.6,.8))<1e-6);assert.deepEqual(m.parent!.position.toArray(),[2,1.1,3]);f.update(.08);assert.deepEqual(m.scale.toArray(),scale.toArray());assert.deepEqual(m.position.toArray(),position.toArray());f.update(.09);assert.equal(visible(f).length,0);f.dispose();});
test('each skill uses one open arc or feathered stroke; source heights and reduced flashing stay bounded',()=>{const f=new SkillPresentation(new THREE.Scene());for(const id of['saber','blackbeard','napoleon','musashi',null]as const){f.clear();f.show({...event(id),origin:{x:0,y:2,z:0},losOffset:0,casterFeetY:.3},true);assert.equal(visible(f).length,1);const m=visible(f)[0],material=m.material as THREE.MeshBasicMaterial;assert.ok(material.opacity<=.09);assert.equal(m.parent!.position.y,id==='napoleon'?.37:id===null?.38:2);f.update(.05,true,false);assert.ok(material.opacity<=.09,'reduced activation cannot become bright later');}
 f.update(0,false);assert.equal(visible(f).length,0);f.show(event());f.update(NaN);assert.equal(visible(f).length,1);f.update(.1,true,true);assert.ok((visible(f)[0].material as THREE.MeshBasicMaterial).opacity<=.09);f.dispose();});
test('melee falls back safely from non-finite blade samples and finite pool resources are immutable',()=>{const f=new SkillPresentation(new THREE.Scene());f.show(event(),false,{style:'melee',bladeDirection:{x:NaN,y:0,z:0}});f.root.updateMatrixWorld(true);assert.ok(visible(f)[0].matrixWorld.elements.every(Number.isFinite));f.hit(event('saber') as SkillStrike,{x:0,y:0,z:4});const ids=new Set<string>(),buffers=new Set<ArrayBufferLike>();f.root.traverse(o=>{if(o instanceof THREE.Mesh){ids.add(o.geometry.uuid);Object.values(o.geometry.attributes).forEach(a=>buffers.add(a.array.buffer));if(o.geometry.index)buffers.add(o.geometry.index.array.buffer);}});assert.equal(ids.size,11);assert.ok([...buffers].reduce((n,b)=>n+b.byteLength,0)<=48*1024);for(let i=0;i<100;i++)f.show(event(i%2?'saber':'napoleon'));assert.ok(visible(f).length<=18);f.dispose();});

test('reduced-flash toggle never brightens a live effect again and malformed events do not poison pool transforms',()=>{const f=new SkillPresentation(new THREE.Scene());f.show(event());f.update(.01,true,true);const before=(visible(f)[0].material as THREE.MeshBasicMaterial).opacity;f.update(.01,true,false);assert.ok((visible(f)[0].material as THREE.MeshBasicMaterial).opacity<before);f.clear();f.show({...event(),range:Infinity}as SkillEvent);assert.equal(visible(f).length,0);f.show({...event(),type:'cast',duration:NaN});assert.equal(visible(f).length,0);f.dispose();});

// These are CPU geometry/event checks, not GPU screenshots or visual acceptance.
test('every servant Q/X has a distinct immutable footprint inside its actual strike corridor',()=>{
 const f=new SkillPresentation(new THREE.Scene()),geometries=new Set<string>();
 for(const identity of ['saber','blackbeard','napoleon','musashi'] as const)for(const slot of ['skill','ultimate'] as const){
  f.clear();const e={...event(identity),slot,origin:{x:3,y:0,z:-4},direction:{x:.6,y:0,z:.8}} as SkillStrike;f.show(e);f.root.updateMatrixWorld(true);
  const mesh=visible(f)[0];geometries.add(mesh.geometry.uuid);assert.match(mesh.name,/^SkillCorridor_/);
  const positions=mesh.geometry.getAttribute('position');
  for(let i=0;i<positions.count;i++){const p=new THREE.Vector3().fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld);p.y=0;assert.ok(skillContains(e,p),`${identity}/${slot} vertex ${i} exceeds hit corridor`);}
  const before=mesh.matrixWorld.clone();f.update(.1);f.root.updateMatrixWorld(true);assert.deepEqual(mesh.matrixWorld.elements,before.elements,'instantaneous damage must not be depicted as a delayed projectile');
 }
 assert.equal(geometries.size,8);f.dispose();
});
test('contact marks require an eligible point, expire quickly and share the fixed pool',()=>{
 const f=new SkillPresentation(new THREE.Scene()),e=event('saber') as SkillStrike;
 f.hit(e,{x:0,y:0,z:10});assert.equal(visible(f).length,0);
 f.hit(e,{x:0,y:0,z:4},true);assert.equal(visible(f).length,1);assert.ok((visible(f)[0].material as THREE.MeshBasicMaterial).opacity<=.07);
 f.update(.19);assert.equal(visible(f).length,0);for(let i=0;i<100;i++)f.hit(e,{x:0,y:0,z:4});assert.equal(visible(f).length,18);f.dispose();
});

test('eight motif switches reuse a single motif mesh per slot without growing the scene tree',()=>{
 const f=new SkillPresentation(new THREE.Scene()),objects=new Set<THREE.Object3D>(),geometries=new Set<THREE.BufferGeometry>();
 f.root.traverse(o=>{objects.add(o);if(o instanceof THREE.Mesh)geometries.add(o.geometry);});assert.equal([...objects].filter(o=>o instanceof THREE.Mesh).length,54);
 for(let n=0;n<500;n++)for(const identity of ['saber','blackbeard','napoleon','musashi'] as const)for(const slot of ['skill','ultimate'] as const){
  f.show({...event(identity),slot},n%2===0);f.update(.001,true,n%3===0);
  assert.ok(visible(f).length<=18);f.root.traverse(o=>{assert.ok(objects.has(o));if(o instanceof THREE.Mesh)assert.ok(geometries.has(o.geometry));});
 }
 f.clear();assert.equal(visible(f).length,0);f.dispose();
});


test('confirmed contact splinters are small feathered geometry, not tracer reuse, and pool reuse restores the tracer',()=>{
 const f=new SkillPresentation(new THREE.Scene()),e=event('blackbeard') as SkillStrike;
 f.hit(e,{x:0,y:0,z:4});const impact=visible(f)[0],g=impact.geometry;
 assert.equal(impact.name,'ConfirmedContactSplinters');assert.ok(g.boundingSphere!.radius<.4);
 const colors=g.getAttribute('color');assert.equal(colors.itemSize,4);assert.ok(Array.from({length:colors.count},(_,i)=>colors.getW(i)).some(a=>a===0));
 const firstScale=impact.scale.x;f.update(.06);assert.ok(impact.scale.x>firstScale);assert.ok(impact.scale.x<1.1);
 const positions=Float32Array.from(g.attributes.position.array);for(let i=0;i<60;i++){f.show(event());f.hit(e,{x:0,y:0,z:4},true);f.update(.01);}
 assert.deepEqual(Float32Array.from(g.attributes.position.array),positions);assert.ok(visible(f).length<=18);
 for(let i=0;i<18;i++)f.show(event());assert.ok(visible(f).every(m=>m.geometry!==g));f.dispose();
});

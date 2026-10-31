import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { UltimateStage } from '../src/ultimateStage';
function actor(){const root=new THREE.Group(),head=new THREE.Object3D(),socket=new THREE.Object3D();head.name='mixamorigHead';head.position.set(0,1.7,0);socket.name='WeaponSocket_R';socket.position.set(0,1.3,.2);root.add(head,socket,new THREE.Mesh(new THREE.BoxGeometry(.7,1.8,.3),new THREE.MeshStandardMaterial()));return root;}
test('Saber 3D beam and aftermath require accepted contact, not cinematic time',()=>{
 const source=actor(),stage=new UltimateStage();stage.begin({identity:'saber',sourceRoot:source});
 const beam=stage.scene.getObjectByName('Saber volumetric beam 0')!,column=stage.scene.getObjectByName('Saber rising aftermath column 0')!;
 for(const phase of ['intro','charge','release'] as const){stage.update({elapsed:20,phase,progress:.9,pulse:1,strikeCount:0});assert.equal(beam.visible,false);assert.equal(column.visible,false);}
 stage.update({elapsed:21,phase:'release',progress:.3,pulse:1,strikeCount:1});stage.update({elapsed:21.2,phase:'release',progress:.4,pulse:.8,strikeCount:1});assert.equal(beam.visible,true);assert.equal(column.visible,false);
 stage.update({elapsed:21.8,phase:'outro',progress:.1,pulse:0,strikeCount:1});assert.equal(column.visible,true);
 const geometry=stage.resourceCounts.geometries;for(let i=0;i<100;i++)stage.update({elapsed:21.8+i/60,phase:'outro',progress:i/100,pulse:0,strikeCount:1});assert.equal(stage.resourceCounts.geometries,geometry);stage.dispose();assert.equal(stage.scene.children.length,0);
});
test('Saber uses distinct real 3D portrait and full-body cameras without source mutation',()=>{
 const source=actor(),before=source.toJSON(),stage=new UltimateStage();stage.begin({identity:'saber',sourceRoot:source});stage.update({elapsed:1.8,phase:'intro',progress:.6,pulse:0});const close=stage.camera.position.clone();stage.update({elapsed:7.2,phase:'charge',progress:.95,pulse:0});assert.ok(close.distanceTo(stage.camera.position)>2);stage.scene.traverse(o=>assert.ok(o.matrixWorld.elements.every(Number.isFinite)));assert.deepEqual(source.toJSON(),before);stage.dispose();
});
test('unsupported bloom context falls back once and preserves caller framebuffer and viewport',()=>{
 const stage=new UltimateStage();stage.begin({identity:'saber',sourceRoot:actor()});
 const originalTarget={name:'caller'},view=new THREE.Vector4(3,4,50,60),scissor=new THREE.Vector4(1,2,30,40);let target:unknown=originalTarget,viewport=view.clone(),scissorEnabled=true,renders=0,attempts=0;
 const renderer=Object.assign(Object.create(THREE.WebGLRenderer.prototype),{
  autoClear:false,getRenderTarget:()=>target,setRenderTarget:(v:unknown)=>{target=v;},getViewport:(v:THREE.Vector4)=>v.copy(viewport),getScissor:(v:THREE.Vector4)=>v.copy(scissor),
  setViewport:(...args:any[])=>{viewport=args[0] instanceof THREE.Vector4?args[0].clone():new THREE.Vector4(...args as [number,number,number,number]);},setScissor:()=>{},
  getScissorTest:()=>scissorEnabled,setScissorTest:(v:boolean)=>{scissorEnabled=v;},getClearAlpha:()=>.4,getClearColor:(v:THREE.Color)=>v.set(0x123456),setClearColor:()=>{},
  getSize:(v:THREE.Vector2)=>v.set(1280,720),getDrawingBufferSize:(v:THREE.Vector2)=>v.set(1280,720),getContext:()=>({}),clear:()=>{},
  getPixelRatio:()=>{attempts++;throw Error('unsupported postprocess context');},render:()=>{renders++;assert.equal(target,null);assert.equal(scissorEnabled,false);assert.deepEqual(viewport.toArray(),[0,0,1280,720]);},
 });
 stage.render(renderer,16/9);stage.render(renderer,16/9);assert.equal(attempts,1);assert.equal(renders,2);assert.equal(target,originalTarget);assert.deepEqual(viewport,view);assert.equal(scissorEnabled,true);assert.equal(renderer.autoClear,false);stage.dispose();
});

import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {UltimateStage} from '../src/ultimateStage.ts';

test('failed bloom restores main target, falls back once and stops retrying that renderer',()=>{
 const stage=new UltimateStage(),source=new THREE.Group();source.add(new THREE.Mesh(new THREE.BoxGeometry(1,2,1),new THREE.MeshStandardMaterial()));stage.begin({identity:'saber',sourceRoot:source});
 const target={},viewport=new THREE.Vector4(2,3,4,5),scissor=new THREE.Vector4(6,7,8,9),color=new THREE.Color(0x123456);
 let activeTarget:unknown=target,activeViewport=viewport.clone(),activeScissor=scissor.clone(),scissorTest=true,clear=color.clone(),alpha=.4,renders=0,bloomRenders=0,disposals=0;
 const renderer={autoClear:false,
  clear(){},getContext(){return{};},getDrawingBufferSize(v:THREE.Vector2){return v.set(1920,1080);},
  getRenderTarget:()=>activeTarget,setRenderTarget:(x:unknown)=>{activeTarget=x;},
  getViewport:(v:THREE.Vector4)=>v.copy(activeViewport),getScissor:(v:THREE.Vector4)=>v.copy(activeScissor),
  setViewport:(...v:unknown[])=>{activeViewport=v[0] instanceof THREE.Vector4?v[0].clone():new THREE.Vector4(...v as [number,number,number,number]);},
  setScissor:(v:THREE.Vector4)=>{activeScissor=v.clone();},getScissorTest:()=>scissorTest,setScissorTest:(v:boolean)=>{scissorTest=v;},
  getClearColor:(v:THREE.Color)=>v.copy(clear),getClearAlpha:()=>alpha,setClearColor:(v:THREE.Color,a:number)=>{clear=v.clone();alpha=a;},
  getSize:(v:THREE.Vector2)=>v.set(1920,1080),render(){renders++;assert.equal(activeTarget,null);assert.deepEqual(activeViewport.toArray(),[0,0,1920,1080]);assert.equal(scissorTest,false);}
 };
 Object.setPrototypeOf(renderer,THREE.WebGLRenderer.prototype);
 const internals=stage as any;internals.bloomRenderer=renderer;
 const bloom={strength:.75,radius:.48,threshold:.72,dispose(){}};internals.bloomPass=bloom;
 internals.bloomComposer={passes:[{dispose(){disposals++;}}],setSize(w:number,h:number){assert.equal(w,1280);assert.equal(h,720);},render(){bloomRenders++;activeTarget={intermediate:true};activeViewport.set(0,0,1280,720);throw Error('simulated unsupported float target');},dispose(){disposals++;}};
 stage.render(renderer as unknown as THREE.WebGLRenderer,16/9);
 stage.render(renderer as unknown as THREE.WebGLRenderer,16/9);
 assert.deepEqual([bloom.strength,bloom.radius,bloom.threshold],[.28,.30,.90]);
 assert.equal(renders,2);assert.equal(bloomRenders,1);assert.equal(disposals,2);
 assert.equal(activeTarget,target);assert.deepEqual(activeViewport,viewport);assert.deepEqual(activeScissor,scissor);assert.equal(scissorTest,true);assert.equal(renderer.autoClear,false);assert.equal(alpha,.4);assert.ok(clear.equals(color));
 stage.dispose();
});

test('Saber and Musashi retain their approved local lights while other servants reset to standard',()=>{
 const stage=new UltimateStage(),source=new THREE.Group();source.add(new THREE.Mesh(new THREE.BoxGeometry(1,2,1),new THREE.MeshStandardMaterial()));
 for(const [identity,expected]of[['saber',[1.6,2.4,1.5]],['musashi',[1.6,2.4,1.5]],['blackbeard',[2.8,3.5,3]],['napoleon',[2.8,3.5,3]],['saber',[1.6,2.4,1.5]]]as const){
  stage.begin({identity,sourceRoot:source});
  const lights=stage.scene.children.filter((o):o is THREE.Light=>!!(o as THREE.Light).isLight);
  assert.deepEqual(lights.slice(0,3).map(light=>light.intensity),expected);
 }
 stage.dispose();
});

test('shared bloom composer reapplies identity settings across Saber and other casts',()=>{
 const stage=new UltimateStage(),source=new THREE.Group();source.add(new THREE.Mesh(new THREE.BoxGeometry(1,2,1),new THREE.MeshStandardMaterial()));
 const renderer={autoClear:false,clear(){},getContext(){return{};},getDrawingBufferSize:(v:THREE.Vector2)=>v.set(640,360),getSize:(v:THREE.Vector2)=>v.set(640,360),getRenderTarget:()=>null,setRenderTarget(){},getViewport:(v:THREE.Vector4)=>v.set(0,0,640,360),getScissor:(v:THREE.Vector4)=>v.set(0,0,640,360),setViewport(){},setScissor(){},getScissorTest:()=>false,setScissorTest(){},getClearColor:(c:THREE.Color)=>c.set(0),getClearAlpha:()=>1,setClearColor(){},render(){throw Error('unexpected fallback');}};
 Object.setPrototypeOf(renderer,THREE.WebGLRenderer.prototype);
 const internal=stage as unknown as {bloomRenderer:unknown;bloomPass:unknown;bloomComposer:unknown};
 const bloom={strength:0,radius:0,threshold:0,dispose(){}};let renders=0;
 internal.bloomRenderer=renderer;internal.bloomPass=bloom;internal.bloomComposer={passes:[],setSize(){},render(){renders++;},dispose(){}};
 for(const [identity,expected]of[['saber',[.28,.30,.90]],['musashi',[.24,.28,.92]],['blackbeard',[.75,.48,.72]],['saber',[.28,.30,.90]],['napoleon',[.75,.48,.72]]]as const){stage.begin({identity,sourceRoot:source});stage.render(renderer as unknown as THREE.WebGLRenderer,16/9);assert.deepEqual([bloom.strength,bloom.radius,bloom.threshold],expected);}
 assert.equal(renders,5);stage.dispose();
});

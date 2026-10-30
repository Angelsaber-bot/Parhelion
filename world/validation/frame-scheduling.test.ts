import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {MapRefreshPolicy,setTextIfChanged,ReflectionMaterialCache,FrameMetrics} from '../src/frameScheduling.ts';
test('map refresh avoids stationary redraws, limits movement and immediately reacts to UI changes',()=>{
 const p=new MapRefreshPolicy(1000/30);assert.equal(p.shouldDraw(0,0,0,0,'en'),true);
 for(let i=1;i<60;i++)assert.equal(p.shouldDraw(i*16,0,0,0,'en'),false);
 assert.equal(p.shouldDraw(1000,2,0,0,'en'),true);assert.equal(p.shouldDraw(1001,3,0,0,'en'),false);
 assert.equal(p.shouldDraw(1002,3,0,0,'zh'),true);assert.equal(p.shouldDraw(1003,3,0,0,'zh',false),false);assert.equal(p.shouldDraw(1004,3,0,0,'zh'),true);
});
test('unchanged text does not mutate DOM',()=>{let value='',writes=0;const el={get textContent(){return value},set textContent(v:string|null){writes++;value=v??''}};setTextIfChanged(el,'A');for(let i=0;i<60;i++)setTextIfChanged(el,'A');assert.equal(writes,1);setTextIfChanged(el,'B');assert.equal(writes,2)});
test('reflection cache avoids hierarchy traversal and invalidates on outfit replacement',()=>{
 const root=new THREE.Group(),one=new THREE.Group();root.add(one);const m=new THREE.MeshStandardMaterial({envMap:new THREE.Texture(),envMapIntensity:2});one.add(new THREE.Mesh(new THREE.BoxGeometry(),m));
 let walks=0;const traverse=root.traverse.bind(root);root.traverse=(cb)=>{walks++;traverse(cb)};const c=new ReflectionMaterialCache();c.update(root,.5);c.update(root,.25);assert.equal(walks,1);assert.equal(m.envMapIntensity,.5);
 root.remove(one);const n=new THREE.MeshStandardMaterial({envMap:new THREE.Texture(),envMapIntensity:3});root.add(new THREE.Mesh(new THREE.BoxGeometry(),n));c.update(root,.5);assert.equal(walks,2);assert.equal(n.envMapIntensity,1.5);
});
test('frame metrics bound memory and exclude resume gaps, never call CPU timing GPU time',()=>{
 const m=new FrameMetrics();m.record(1,20,false);assert.equal(m.summary().samples,0);for(let i=0;i<1000;i++)m.record(1/60,4);const s=m.summary();assert.equal(s.samples,240);assert.ok(Math.abs(s.fps-60)<.00001);assert.equal(s.meanMainThreadMs,4);assert.ok(Math.abs(s.p95FrameMs-1000/60)<.00001);
});

test('visible long stalls remain in frame metrics rather than being hidden',()=>{const m=new FrameMetrics();m.record(.4,350);assert.equal(m.summary().p95FrameMs,400);assert.equal(m.summary().samples,1);});
test('quest marker pulse continues while stationary at the map refresh limit',()=>{const p=new MapRefreshPolicy(33);assert.equal(p.shouldDraw(0,0,0,0,'target',true,true),true);assert.equal(p.shouldDraw(16,0,0,0,'target',true,true),false);assert.equal(p.shouldDraw(34,0,0,0,'target',true,true),true);});

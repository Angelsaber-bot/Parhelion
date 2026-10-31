import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { EnemyContactEffects, ENEMY_CONTACT_EFFECT_BUDGET } from '../src/enemyContactEffects';
import type { CombatEvent } from '../src/combat';
type Contact=Extract<CombatEvent,{type:'attackContact'}>;
const event=(attack:Contact['attack']='thrust',sequence=1):Contact=>({type:'attackContact',id:'warden',storyPattern:'echo-warden',attack,sequence,origin:{x:4,y:0,z:3},target:{x:4,y:0,z:6},radius:attack==='thrust'?.95:attack==='sweep'?3.5:2.8,...(attack==='thrust'?{length:7.5}:{})});
const surface={ground:(x:number,z:number)=>({point:{x,y:0,z}}),cast:()=>null};
function vertices(group:THREE.Group){return group.children.filter(o=>o.visible).flatMap(o=>{const mesh=o as THREE.Mesh,a=mesh.geometry.getAttribute('position');return Array.from({length:mesh.geometry.drawRange.count},(_,i)=>new THREE.Vector3(a.getX(i),a.getY(i),a.getZ(i)));});}
for(const attack of ['thrust','sweep','burst']as const)test(`${attack}: contact footprint stays inside immutable accepted shape and above terrain`,()=>{
 const group=new THREE.Group(),fx=new EnemyContactEffects(group,surface),e=event(attack);assert.equal(fx.emit(e),true);const points=vertices(group);assert.ok(points.length>100);const center=attack==='burst'?e.target:e.origin;
 for(const p of points){assert.ok(p.y>=.089&&p.y<=.571);if(attack==='thrust'){assert.ok(p.z>=3-1e-6&&p.z<=10.5+1e-6);assert.ok(Math.abs(p.x-4)<=.95+1e-6);}else assert.ok(Math.hypot(p.x-center.x,p.z-center.z)<=e.radius+1e-6);}
 assert.ok(fx.diagnostics.lastBuild.groundQueries<=ENEMY_CONTACT_EFFECT_BUDGET.samples);assert.ok(fx.diagnostics.lastBuild.coverQueries<=ENEMY_CONTACT_EFFECT_BUDGET.samples);
 e.origin.x=100;e.target.z=200;assert.deepEqual(vertices(group),points);fx.dispose();
});
test('once-only, paused fade, fixed pool saturation, reduced effects and idempotent disposal',()=>{
 const group=new THREE.Group(),fx=new EnemyContactEffects(group,surface),meshes=[...group.children],geometries=meshes.map(m=>(m as THREE.Mesh).geometry),materials=meshes.map(m=>(m as THREE.Mesh).material);
 assert.equal(fx.emit(event()),true);assert.equal(fx.emit(event()),false);fx.update(99,false);assert.equal(fx.diagnostics.active,1);
 for(let i=2;i<=100;i++)fx.emit(event('thrust',i),true);
 assert.equal(fx.diagnostics.active,3);assert.deepEqual(group.children,meshes);assert.deepEqual(meshes.map(m=>(m as THREE.Mesh).geometry),geometries);assert.deepEqual(meshes.map(m=>(m as THREE.Mesh).material),materials);
 assert.equal(fx.diagnostics.bytes,3*ENEMY_CONTACT_EFFECT_BUDGET.vertices*12);assert.ok(vertices(group).every(p=>p.y<.1));
 fx.update(.1,true);fx.update(.1,true);assert.equal(fx.diagnostics.active,0);assert.equal(fx.emit(event('thrust',100)),false);
 let disposed=0;for(const g of geometries)g.addEventListener('dispose',()=>disposed++);fx.dispose();fx.dispose();assert.equal(disposed,3);assert.equal(group.children.length,0);assert.equal(fx.emit(event('thrust',101)),false);
});
test('opaque cover clips the signal rather than showing energy behind it; ground conforms',()=>{
 const group=new THREE.Group(),fx=new EnemyContactEffects(group,{ground:(x,z)=>({point:{x,y:(z-3)*.04,z}}),cast:(p,d,max)=>{const t=(6-p.z)/d.z;return t>0&&t<1&&Math.hypot(d.x,d.y,d.z)*t<max?{point:{x:p.x+d.x*t,y:p.y+d.y*t,z:6}}:null;}});
 fx.emit(event());const points=vertices(group);assert.ok(points.length>0);assert.ok(points.every(p=>p.z<=6));assert.ok(points.some(p=>p.y>.12));fx.dispose();
});
test('ordinary enemies and malformed snapshots never emit; cancel/death/reset clears active effects',()=>{
 const group=new THREE.Group(),fx=new EnemyContactEffects(group,surface);const ordinary=event();delete ordinary.storyPattern;assert.equal(fx.emit(ordinary),false);
 for(const e of [{...event(),length:Infinity},{...event(),radius:99},{...event(),sequence:NaN},event('shot')])assert.equal(fx.emit(e),false);
 fx.emit(event());fx.cancel('warden');assert.equal(fx.diagnostics.active,0);assert.equal(fx.emit(event()),false);fx.emit(event('burst',2));fx.clear();assert.equal(fx.diagnostics.active,0);fx.dispose();
});

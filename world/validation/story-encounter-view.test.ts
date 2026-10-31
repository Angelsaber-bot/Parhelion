import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerHooks } from 'node:module';
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { parseLocalGlb } from './player-fixture.ts';
import type { Layout } from '../src/types.ts';
import type { StoryEncounterSpec } from '../src/storyEncounters.ts';
registerHooks({load(url,context,next){return url.endsWith('.css')?{format:'module',source:'',shortCircuit:true}:next(url,context);}});
class Element {
 id='';className='';textContent='';innerHTML='';hidden=false;title='';style:Record<string,string>={};children:Element[]=[]; selectors=new Map<string,Element>();
 classList={add(){},remove(){}};append(...nodes:Element[]){this.children.push(...nodes);}remove(){}setAttribute(){}
 querySelector(key:string){if(!this.selectors.has(key))this.selectors.set(key,new Element());return this.selectors.get(key)!;}
 getContext(){return{clearRect(){},strokeText(){},fillText(){},font:'',textAlign:'',textBaseline:'',lineWidth:0,strokeStyle:'',fillStyle:''};}
}
const body=new Element();(globalThis as any).document={documentElement:{lang:''},body,createElement:()=>new Element(),getElementById:()=>null};
(globalThis as any).window={addEventListener(){}};
const {WorldCombat}=await import('../src/combatView.ts');
const p=(x=0,z=0)=>({x,y:.04,z});
const spec:StoryEncounterSpec={id:'false_dawn_courier',anchor:p(),actors:[{role:'lancer',offset:[-4,4],title:['讯号使者','Signal courier']},{role:'musketeer',offset:[4,4]}]};
function fixture(){
 const scene=new THREE.Scene(),floor=new THREE.PlaneGeometry(500,500).rotateX(-Math.PI/2),victories:string[]=[];
 const layout={world:{seed:537,waterLevel:-2},areas:[],markers:[{id:'boss_vacant_king',type:'enemy',p:[100,0,100]},{id:'false_dawn_recorder',type:'interact',p:[0,0,0]}]} as unknown as Layout;
 const combat=new WorldCombat({scene,layout,colliders:[{name:'floor',enabled:true,bvh:new MeshBVH(floor)}],done:new Set(),toast(){},onVictory(){},onPlayerDefeated(){},onStoryEncounterVictory:id=>victories.push(id)});
 return{combat,scene,victories,floor};
}
test('authored sockets bypass ONLY their own new story-marker random exclusion; fresh atomic admission handles modal close/teleport',()=>{
 const {combat,floor}=fixture();assert.equal(combat.geometry.safeSpawn(-4,4),null,'random wilderness remains excluded from new interact markers');assert.ok(combat.geometry.safeStorySpawn(-4,4));
 assert.equal(combat.startStoryEncounter(spec).reason,'unavailable','cached paused context fails closed');
 assert.equal(combat.startStoryEncounter(spec,{position:p(100),playable:true}).reason,'out-of-range');
 assert.equal(combat.startStoryEncounter(spec,{position:p(),playable:false}).reason,'unavailable');
 assert.equal(combat.startStoryEncounter(spec,{position:p(),playable:true}).ok,true,'fresh context after modal close admits legitimate request');
 assert.equal(combat.beginBoss(),false,'ordinary boss cannot overlap active story encounter');
 assert.equal(combat.storyEncounter?.remaining,2);combat.dispose();floor.dispose();
});
test('repeated start/cancel/retry keeps three-slot resources bounded, IDs fresh and stale targets rejected',()=>{
 const {combat,scene,floor}=fixture(),internals=combat as any;
 const baseline={geometries:internals.shared.length,materials:internals.materials.length,textures:internals.textures.length,roots:scene.children.length,enemies:combat.state.enemies.length};
 let last:string[]=[];
 for(let cycle=0;cycle<30;cycle++){
  assert.equal(combat.startStoryEncounter(spec,{position:p(),playable:true}).ok,true);const ids=combat.state.enemies.filter(e=>e.storyEncounter).map(e=>e.id);
  assert.equal(ids.length,2);assert.ok(ids.every(id=>!last.includes(id)));assert.equal(internals.storyResources.size,2);
  for(const id of last)assert.equal(combat.damageEnemy(id,1000),false,'stale action reference cannot alias retried actor');
  combat.cancelStoryEncounter();assert.equal(combat.storyEncounter,null);assert.equal(internals.storyResources.size,0);assert.equal(combat.state.enemies.length,baseline.enemies);
  assert.equal(scene.children.length,baseline.roots);assert.equal(internals.shared.length,baseline.geometries);
  assert.ok(internals.materials.length<=baseline.materials+1,'one cached musketeer role label remains bounded');assert.ok(internals.textures.length<=baseline.textures+1);last=ids;
 }
 combat.dispose();floor.dispose();assert.equal(scene.children.length,0);
});
test('only actual last hostile kill completes once; death/reset/leash cancel and remove all owned tells',()=>{
 const {combat,victories,scene,floor}=fixture();combat.update(.05,p(),true);
 assert.equal(combat.startStoryEncounter(spec,{position:p(),playable:true}).ok,true);
 const actors=combat.state.enemies.filter(e=>e.storyEncounter);combat.damageEnemy(actors[0].id,1000);assert.deepEqual(victories,[]);
 combat.damageEnemy(actors[1].id,1000);assert.deepEqual(victories,[spec.id]);assert.equal(combat.storyEncounter,null);assert.ok(!scene.children.some(o=>o.name.startsWith('story_')));
 for(const reason of ['death','reset','leash'] as const){
  assert.equal(combat.startStoryEncounter(spec,{position:p(),playable:true}).ok,true);
  if(reason==='death'){combat.state.defeatedFor=2;combat.present(0,p(),false);combat.state.defeatedFor=0;}
  else if(reason==='reset')combat.reset();else combat.present(.05,p(31),true);
  assert.equal(combat.storyEncounter,null);assert.ok(!scene.children.some(o=>o.name.startsWith('story_')));assert.deepEqual(victories,[spec.id]);
 }
 combat.dispose();floor.dispose();
});
test('cancel and same-encounter retry before native load resolves never resurrects old actor roots',async()=>{
 const {combat,floor}=fixture(),internals=combat as any,assets=internals.enemyAssets as any;const callbacks:{url:string,load:(value:any)=>void}[]=[];
 assets.loader.load=(url:string,load:(value:any)=>void)=>callbacks.push({url,load});
 combat.startStoryEncounter(spec,{position:p(),playable:true});combat.present(0,p(),true);
 const old=combat.state.enemies.filter(e=>e.storyEncounter).map(e=>e.id);assert.ok(callbacks.length>=2);combat.cancelStoryEncounter();
 combat.startStoryEncounter(spec,{position:p(),playable:true});
 for(const callback of callbacks){const model=callback.url.split('/').at(-1)!;callback.load(await parseLocalGlb(new URL(`../public/assets/enemies/${model}`,import.meta.url)));}
 combat.present(0,p(),true);assert.ok(old.every(id=>!internals.visuals.has(id)&&!assets.instances.has(id)));
 assert.ok(combat.state.enemies.filter(e=>e.storyEncounter).every(e=>assets.instances.has(e.id)),'new generation uses valid shared template without old-root resurrection');
 combat.cancelStoryEncounter();combat.dispose();floor.dispose();
});

test('actual musket contact emits one tracer at measured barrel, never from a canceled or paused tell',async()=>{
 const {nativeMusketeerContactMuzzle,transformEnemyContactMuzzle}=await import('../src/enemyShotSocket.ts');
 const {combat,floor}=fixture(),internals=combat as any,assets=internals.enemyAssets as any,gltf=await parseLocalGlb(new URL('../public/assets/enemies/musketeer.glb',import.meta.url));assets.cache.set('musketeer',gltf);
 const single:StoryEncounterSpec={id:'false_dawn_muzzle_test',anchor:p(),actors:[{role:'musketeer',offset:[0,6]}]};assert.equal(combat.startStoryEncounter(single,{position:p(),playable:true}).ok,true);combat.present(0,p(),true);
 const enemy=combat.state.enemies.find(e=>e.storyEncounter)!,shots:THREE.Vector3[]=[];const shot=combat.shot.bind(combat);combat.shot=(muzzle,point,hit)=>{shots.push(muzzle.clone());shot(muzzle,point,hit);};
 for(let i=0;i<600&&enemy.mode!=='windup';i++){combat.simulate(1/120,p(),true);combat.present(1/120,p(),true);}assert.equal(enemy.mode,'windup');const timer=enemy.timer;
 for(let i=0;i<120;i++){combat.simulate(1/120,p(),false);combat.present(1/120,p(),false);}assert.equal(enemy.timer,timer);assert.equal(shots.length,0);
 for(let i=0;i<600&&!shots.length;i++){combat.simulate(1/120,p(),true);combat.present(1/120,p(),true);}assert.equal(shots.length,1);
 const expected=transformEnemyContactMuzzle(nativeMusketeerContactMuzzle(gltf)!,enemy.p,enemy.target);assert.ok(shots[0].distanceTo(expected)<1e-8,'visual tracer starts at native barrel using the committed snapshot');
 const before=shots.length;combat.cancelStoryEncounter();for(let i=0;i<120;i++){combat.simulate(1/120,p(),true);combat.present(1/120,p(),true);}assert.equal(shots.length,before);combat.dispose();floor.dispose();
});

test('cover appearing after musket lock stops the visual tracer at the actual surface and never damages through it',async()=>{
 const {combat,floor}=fixture(),internals=combat as any,gltf=await parseLocalGlb(new URL('../public/assets/enemies/musketeer.glb',import.meta.url));internals.enemyAssets.cache.set('musketeer',gltf);
 const single:StoryEncounterSpec={id:'false_dawn_shot_cover',anchor:p(),actors:[{role:'musketeer',offset:[0,6]}]};assert.equal(combat.startStoryEncounter(single,{position:p(),playable:true}).ok,true);combat.present(0,p(),true);
 const enemy=combat.state.enemies.find(e=>e.storyEncounter)!;for(let i=0;i<600&&enemy.mode!=='windup';i++){combat.simulate(1/120,p(),true);combat.present(1/120,p(),true);}assert.equal(enemy.mode,'windup');
 const wall=new THREE.BoxGeometry(5,4,.3).translate(0,2,3);internals.options.colliders.push({name:'contact-cover',enabled:true,bvh:new MeshBVH(wall)});
 const shots:{from:THREE.Vector3,to:THREE.Vector3,surface:boolean}[]=[];const shot=combat.shot.bind(combat);combat.shot=(from,to,surface)=>{shots.push({from:from.clone(),to:to.clone(),surface});shot(from,to,surface);};const hp=combat.state.hp;
 for(let i=0;i<600&&!shots.length;i++){combat.simulate(1/120,p(),true);combat.present(1/120,p(),true);}assert.equal(shots.length,1);assert.equal(combat.state.hp,hp);assert.equal(shots[0].surface,true);assert.ok(Math.abs(shots[0].to.z-3.15)<.001);assert.ok(internals.sparks.some((spark:any)=>spark.mesh.position.distanceTo(shots[0].to)<1e-8));
 combat.dispose();wall.dispose();floor.dispose();
});

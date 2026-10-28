// Independent integration QA: actual WorldCombat damage facade + mounted locomotion.
// Minimal DOM/animation fixtures, not browser or visual acceptance.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerHooks } from 'node:module';
import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshBVH } from 'three-mesh-bvh';
import { CharacterKit, type CharacterKitDefinition } from '../src/characters/characterKit.ts';
import { KitCompanion } from '../src/kitCompanion.ts';
import type { Layout } from '../src/types.ts';
import type { Collider } from '../src/player.ts';
registerHooks({ load(url,context,nextLoad){return url.endsWith('.css')?{format:'module',source:'',shortCircuit:true}:nextLoad(url,context);} });
class Element {
  id='';className='';textContent='';innerHTML='';hidden=false;title='';style:Record<string,string>={};
  children:Element[]=[];selectors=new Map<string,Element>();classList={add(){},remove(){}};
  append(...elements:Element[]){this.children.push(...elements);}remove(){}
  querySelector(selector:string){if(!this.selectors.has(selector))this.selectors.set(selector,new Element());return this.selectors.get(selector)!;}
}
const body=new Element(),crosshair=new Element();
(globalThis as any).document={documentElement:{lang:''},createElement:()=>new Element(),body,getElementById:(id:string)=>id==='crosshair'?crosshair:body.children.find(e=>e.id===id)};
(globalThis as any).window={setTimeout:()=>1,addEventListener(){}};
const {WorldCombat}=await import('../src/combatView.ts');
function fixture(){
  const scene=new THREE.Scene(),colliders:Collider[]=[{name:'floor',enabled:true,bvh:new MeshBVH(new THREE.PlaneGeometry(100,100).rotateX(-Math.PI/2))}];
  const layout={world:{seed:537,waterLevel:-10},areas:[],markers:[{id:'boss_vacant_king',type:'enemy',p:[0,0,7],label:'Boss'}]}as unknown as Layout;
  const combat=new WorldCombat({scene,colliders,layout,done:new Set(['saber_contract','shard_camp','shard_tower','shard_table']),toast(){},onVictory(){},onPlayerDefeated(){}});
  combat.beginBoss();
  // Controlled stationary target; retain the real damage facade and state machine.
  combat.geometry.terrain.walk=(p)=>({...p});
  const convert=(hit:{id:string;p:{x:number;y:number;z:number}}|null)=>hit?{id:hit.id,position:new THREE.Vector3(hit.p.x,hit.p.y,hit.p.z)}:null;
  const follow=new KitCompanion({colliders,range:4.5,damage:16,target:(position,range,id)=>convert(combat.allyTarget(position,range,id)),strike:(position,range,damage,id)=>convert(combat.allyStrike(position,range,damage,id)),engage:()=>convert(combat.allyEngage(15))});
  const root=new THREE.Group(),saddle=new THREE.Object3D();saddle.name='Saddle';root.add(saddle);
  const definition:CharacterKitDefinition={id:'qa-mounted',assetUrl:'qa-fixture',defaultState:'idle',rootMotion:'in-place',mount:{saddleSocket:'saddle',riderSeatSocket:'saddle'},sockets:{saddle:{node:'Saddle'}},clips:{idle:{name:'Idle',duration:3,loop:true},walk:{name:'Walk',duration:1,loop:true,nominalSpeed:.7},run:{name:'Run',duration:.8,loop:true,nominalSpeed:2.093},attack:{name:'Attack',duration:1.4,loop:false,events:[{at:23/30,kind:'hit'}]}}};
  const gltf={scene:root,animations:Object.values(definition.clips).map(c=>new THREE.AnimationClip(c.name,c.duration,[]))}as GLTF;
  let contacts=0;
  const actor=new CharacterKit(gltf,definition,{onEvent:event=>{if(event.kind==='hit')contacts++;follow.onEvent(actor,event);}}),player=new THREE.Vector3();
  const tick=()=>{combat.update(.05,player,true);follow.update(actor,.05,player,0,false);};
  const until=(condition:()=>boolean)=>{for(let i=0;i<400&&!condition();i++)tick();assert.ok(condition(),`no outcome at phase ${follow.mountedPhase}, HP ${combat.state.boss.hp}`);};
  const dispose=()=>{follow.release(actor);actor.dispose();combat.dispose();};
  return{combat,actor,follow,tick,until,dispose,get contacts(){return contacts;}};
}
test('mounted charge reaches real WorldCombat damage and removes exactly 16 boss HP once at contact',()=>{
  const f=fixture();try{
    const hp=f.combat.state.boss.hp;f.until(()=>f.follow.mountedPhase==='charge');
    for(let i=0;i<14;i++)f.tick();assert.equal(f.contacts,0);assert.equal(f.combat.state.boss.hp,hp,'no anticipation damage');
    f.until(()=>f.contacts===1);assert.equal(f.combat.state.boss.hp,hp-16,'real HP mutation, not just callback count');
    assert.equal(f.combat.allyStrike(f.actor.root.position,2.25,16,f.combat.state.boss.id),null,'real ally cooldown rejects duplicate damage');
    f.until(()=>f.follow.mountedPhase==='recover');assert.equal(f.contacts,1);assert.equal(f.combat.state.boss.hp,hp-16);
  }finally{f.dispose();}
});
test('WorldCombat revalidates LOS during a mounted charge and blocks real HP loss',()=>{
  const f=fixture();try{
    const hp=f.combat.state.boss.hp;f.until(()=>f.follow.mountedPhase==='charge');f.combat.geometry.terrain.lineOfSight=()=>false;
    for(let i=0;i<30;i++)f.tick();assert.equal(f.combat.state.boss.hp,hp);
  }finally{f.dispose();}
});

// Direct geometry regression for the independently reproduced rear-footprint hole.
// These private-helper probes supplement, rather than replace, end-to-end charge tests above.
const {MountedCharge}=await import('../src/mountedCharge.ts');
function navigationProbe(obstacle:THREE.BufferGeometry){
  const colliders:Collider[]=[{name:'floor',enabled:true,bvh:new MeshBVH(new THREE.PlaneGeometry(100,100).rotateX(-Math.PI/2))},{name:'obstacle',enabled:true,bvh:new MeshBVH(obstacle)}];
  return new MountedCharge({colliders,range:4.5,damage:16,target:()=>null,strike:()=>null})as any;
}
test('horse standing footprint rejects a wall behind its center, not only ahead of its nose',()=>{
  const nav=navigationProbe(new THREE.BoxGeometry(10,4,.3).translate(0,2,-.8)),origin=new THREE.Vector3();
  assert.equal(nav.path(origin,origin,0),false,'rear body overlaps the wall despite clear forward ray');
});
test('a horse cannot turn its rear/flank into a narrow side wall',()=>{
  const nav=navigationProbe(new THREE.BoxGeometry(.2,4,10).translate(1.1,2,0)),root=new THREE.Group();
  assert.equal(nav.path(root.position,root.position,0),true,'initial forward orientation fits');
  for(let i=0;i<30;i++)nav.turn(root,Math.PI/2,.05);
  assert.ok(root.rotation.y<Math.PI/2-.1,'rotation stops before broadside overlap');
  assert.equal(nav.bodyClear(root.position,root.rotation.y),true);
});
test('rider-height overhang blocks the whole mounted actor',()=>{
  const nav=navigationProbe(new THREE.BoxGeometry(3,.2,3).translate(0,2.8,0)),origin=new THREE.Vector3();
  assert.equal(nav.path(origin,origin,0),false);
});

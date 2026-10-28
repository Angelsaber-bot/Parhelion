/** Actual Musashi GLB and WorldCombat HP path; minimal DOM fixture, not browser QA. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { CharacterKit } from '../src/characters/characterKit.ts';
import { CHARACTER_KITS } from '../src/characters/catalog.ts';
import { KitCompanion } from '../src/kitCompanion.ts';
import { readCharacter } from './characters/inspect.ts';
import type { Layout } from '../src/types.ts';
import type { Collider } from '../src/player.ts';
registerHooks({load(url,context,next){return url.endsWith('.css')?{format:'module',source:'',shortCircuit:true}:next(url,context);}});
class Element {id='';className='';textContent='';innerHTML='';hidden=false;title='';style:Record<string,string>={};children:Element[]=[];selectors=new Map<string,Element>();classList={add(){},remove(){}};append(...v:Element[]){this.children.push(...v);}remove(){}querySelector(s:string){if(!this.selectors.has(s))this.selectors.set(s,new Element());return this.selectors.get(s)!;}}
const body=new Element(),crosshair=new Element();
(globalThis as any).document={documentElement:{lang:''},createElement:()=>new Element(),body,getElementById:(id:string)=>id==='crosshair'?crosshair:body.children.find(e=>e.id===id)};
(globalThis as any).window={setTimeout:()=>1,addEventListener(){}};
const {WorldCombat}=await import('../src/combatView.ts');
async function fixture(){
  const colliders:Collider[]=[{name:'floor',enabled:true,bvh:new MeshBVH(new THREE.PlaneGeometry(100,100).rotateX(-Math.PI/2))}],player=new THREE.Vector3();
  const layout={world:{seed:1582,waterLevel:-10},areas:[],markers:[{id:'boss_hellfire_lord',type:'enemy',p:[0,0,3],label:'Boss'}]}as unknown as Layout;
  const combat=new WorldCombat({scene:new THREE.Scene(),colliders,layout,done:new Set(['shard_kinkaku','shard_kiyomizu','shard_kikyo']),toast(){},onVictory(){},onPlayerDefeated(){}});
  assert.equal(combat.beginBoss('fire_core'),true);combat.geometry.terrain.walk=p=>({...p});
  const convert=(v:{id:string;p:{x:number;y:number;z:number}}|null)=>v?{id:v.id,position:new THREE.Vector3(v.p.x,v.p.y,v.p.z)}:null;
  const follow=new KitCompanion({colliders,range:3.5,damage:9,target:(p,r,id)=>convert(combat.allyTarget(p,r,id)),strike:(p,r,d,id)=>convert(combat.allyStrike(p,r,d,id)),engage:()=>convert(combat.allyEngage(15))});
  const {gltf}=await readCharacter(fileURLToPath(new URL(CHARACTER_KITS.musashi.assetUrl)));const hits:number[]=[],actor=new CharacterKit(gltf,CHARACTER_KITS.musashi,{onEvent:event=>{hits.push(event.at);follow.onEvent(actor,event);}});
  const tick=(dt=1/120,paused=false)=>{combat.update(dt,player,!paused);follow.update(actor,dt,player,0,paused);};
  const until=(p:()=>boolean)=>{for(let i=0;i<1000&&!p();i++)tick();assert.ok(p());};
  return{combat,follow,actor,hits,tick,until,dispose(){follow.release(actor);actor.dispose();combat.dispose();}};
}
test('Musashi real two-contact animation preserves 9 HP damage, reach, authored contact times and existing global ally cooldown',async()=>{
  const f=await fixture();try{const hp=f.combat.state.boss.hp;f.until(()=>f.actor.state==='attack');while(f.actor.clipTime<.62)f.tick();assert.equal(f.combat.state.boss.hp,hp);f.until(()=>f.hits.length===1);assert.equal(f.hits[0],19/30);assert.equal(f.combat.state.boss.hp,hp-9);
    f.until(()=>f.hits.length===2);assert.equal(f.hits[1],33/30);assert.equal(f.combat.state.boss.hp,hp-9,'existing 1.1s shared ally cooldown intentionally rejects the second contact; no damage retiming');
    f.until(()=>f.hits.length===3);assert.equal(f.combat.state.boss.hp,hp-18,'subsequent full combo still works');
  }finally{f.dispose();}
});
test('Musashi pause, release and loss of target prevent late real HP loss',async()=>{
  const f=await fixture();try{const hp=f.combat.state.boss.hp;f.until(()=>f.actor.state==='attack');const t=f.actor.clipTime;for(let i=0;i<180;i++)f.tick(1/120,true);assert.equal(f.actor.clipTime,t);assert.equal(f.combat.state.boss.hp,hp);
    f.follow.release(f.actor);for(let i=0;i<180;i++)f.actor.update(1/120);assert.equal(f.combat.state.boss.hp,hp);assert.equal(f.hits.length,0);
    f.until(()=>f.actor.state==='attack');f.combat.geometry.terrain.lineOfSight=()=>false;for(let i=0;i<190;i++)f.tick();assert.equal(f.combat.state.boss.hp,hp,'real LOS rechecked at contact');
  }finally{f.dispose();}
});

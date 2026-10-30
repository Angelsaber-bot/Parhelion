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
async function fixture(kit:'musashi'|'blackbeard'='musashi'){
  const ranged=kit==='blackbeard', range=ranged?12:3.5, damage=ranged?12:9, kind=ranged?'ranged':'melee';
  const colliders:Collider[]=[{name:'floor',enabled:true,bvh:new MeshBVH(new THREE.PlaneGeometry(100,100).rotateX(-Math.PI/2))}],player=new THREE.Vector3();
  const layout={world:{seed:1582,waterLevel:-10},areas:[],markers:[{id:'boss_hellfire_lord',type:'enemy',p:[0,0,3],label:'Boss'}]}as unknown as Layout;
  const combat=new WorldCombat({scene:new THREE.Scene(),colliders,layout,done:new Set(['shard_kinkaku','shard_kiyomizu','shard_kikyo']),toast(){},onVictory(){},onPlayerDefeated(){}});
  assert.equal(combat.beginBoss('fire_core'),true);combat.geometry.terrain.walk=p=>({...p});
  const convert=(v:{id:string;p:{x:number;y:number;z:number}}|null)=>v?{id:v.id,position:new THREE.Vector3(v.p.x,v.p.y,v.p.z)}:null;
  const follow=new KitCompanion({colliders,range,damage,target:(p,r,id)=>convert(combat.allyTarget(p,r,id,kind)),track:(p,r,id)=>convert(combat.allyTrack(p,r,id,kind)),strike:(p,r,d,id)=>convert(combat.allyStrike(p,r,d,id,kind)),engage:(_player,from)=>convert(combat.allyEngage(15,from))});
  const {gltf}=await readCharacter(fileURLToPath(new URL(CHARACTER_KITS[kit].assetUrl)));const hits:number[]=[],actor=new CharacterKit(gltf,CHARACTER_KITS[kit],{onEvent:event=>{hits.push(event.at);follow.onEvent(actor,event);}});
  const tick=(dt=1/120,paused=false)=>{combat.update(dt,player,!paused);follow.update(actor,dt,player,0,paused);};
  const until=(p:()=>boolean)=>{for(let i=0;i<1000&&!p();i++)tick();assert.ok(p());};
  return{combat,follow,actor,hits,tick,until,colliders,player,dispose(){follow.release(actor);actor.dispose();combat.dispose();}};
}
test('Musashi real two-contact animation preserves 9 HP damage, reach, authored contact times and existing global ally cooldown',async()=>{
  const f=await fixture();try{const hp=f.combat.state.boss.hp;f.until(()=>f.actor.state==='attack');while(f.actor.clipTime<.62)f.tick();assert.equal(f.combat.state.boss.hp,hp);f.until(()=>f.hits.length===1);assert.equal(f.hits[0],19/30);assert.equal(f.combat.state.boss.hp,hp-9);
    f.until(()=>f.hits.length===2);assert.equal(f.hits[1],33/30);assert.equal(f.combat.state.boss.hp,hp-9,'existing 1.1s shared ally cooldown intentionally rejects the second contact; no damage retiming');
    f.until(()=>f.hits.length===3);assert.equal(f.combat.state.boss.hp,hp-18,'subsequent full combo still works');
  }finally{f.dispose();}
});
test('Musashi pause, release and loss of target prevent late real HP loss',async()=>{
  const f=await fixture();try{const hp=f.combat.state.boss.hp;f.until(()=>f.actor.state==='attack');for(let i=0;i<180;i++)f.tick(1/120,true);assert.notEqual(f.actor.state,'attack','pause cancels the committed swing rather than resuming a stale contact');assert.equal(f.combat.state.boss.hp,hp);
    f.follow.release(f.actor);for(let i=0;i<180;i++)f.actor.update(1/120);assert.equal(f.combat.state.boss.hp,hp);assert.equal(f.hits.length,0);
    f.until(()=>f.actor.state==='attack');f.combat.geometry.terrain.lineOfSight=()=>false;for(let i=0;i<190;i++)f.tick();assert.equal(f.combat.state.boss.hp,hp,'real LOS rechecked at contact');
  }finally{f.dispose();}
});

test('real Musashi early windup follows a moving target, but a target dodging behind the committed blade is not hit',async()=>{
  const f=await fixture();try {
    const e=f.combat.state.boss;e.mode='recover';e.timer=100;
    const hp=e.hp;f.until(()=>f.actor.state==='attack');
    e.p.x+=.7;
    f.until(()=>e.hp<hp);assert.equal(hp-e.hp,9,'authored contact follows modest early lateral movement');
    f.follow.release(f.actor);for(let i=0;i<160;i++)f.tick();
    f.until(()=>f.actor.state==='attack');while(f.actor.clipTime<.55)f.tick();
    const before=e.hp;
    e.p.x=f.actor.root.position.x-Math.sin(f.actor.root.rotation.y)*1.4;
    e.p.z=f.actor.root.position.z-Math.cos(f.actor.root.rotation.y)*1.4;
    while(f.actor.state==='attack')f.tick();
    assert.equal(e.hp,before,'last-moment backstep cannot be hit by an invisible rear-facing sword');
  } finally {f.dispose();}
});
test('new cover or a high ledge before authored contact prevents actual ordinary HP loss',async()=>{
  for(const obstruction of ['wall','height'] as const) {
    const f=await fixture();try {
      const e=f.combat.state.boss;e.mode='recover';e.timer=100;
      f.until(()=>f.actor.state==='attack');const hp=e.hp;
      if(obstruction==='height')e.p.y+=4;
      else {
        const midpoint=f.actor.root.position.clone().lerp(new THREE.Vector3(e.p.x,e.p.y,e.p.z),.5);
        f.colliders.push({name:'new-cover',enabled:true,bvh:new MeshBVH(new THREE.BoxGeometry(12,4,.2).translate(midpoint.x,2,midpoint.z))});
      }
      for(let i=0;i<240;i++)f.tick();
      assert.equal(e.hp,hp,`${obstruction}: no contact through missing reach/LOS`);
    } finally {f.dispose();}
  }
});
test('Blackbeard actual authored muzzle event damages a visible target at pistol distance rather than the old five-metre clamp',async()=>{
  const f=await fixture('blackbeard');try {
    const e=f.combat.state.boss;e.p.z=10;e.mode='recover';e.timer=100;
    const hp=e.hp;f.until(()=>e.hp<hp);
    assert.ok(Math.hypot(e.p.x-f.actor.root.position.x,e.p.z-f.actor.root.position.z)>5);
    assert.equal(hp-e.hp,12);assert.equal(f.hits[0],17/30,'damage belongs to the real authored fire frame');
  } finally {f.dispose();}
});

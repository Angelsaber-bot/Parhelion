/** Production view/loader regression tests. CPU assertions, not browser or FPS acceptance. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerHooks } from 'node:module';
import * as THREE from 'three';
import { WorldCombatState, BOSSES, COMBAT } from '../src/combat.ts';
import { EnemyVisuals, enemyModel } from '../src/enemyVisuals.ts';
import { parseLocalGlb } from './player-fixture.ts';
import type { Layout } from '../src/types.ts';
registerHooks({ load(url, context, nextLoad) { return url.endsWith('.css') ? { format: 'module', source: '', shortCircuit: true } : nextLoad(url, context); } });
class Element {
  id=''; className=''; textContent=''; innerHTML=''; hidden=false; title=''; width=0; height=0;
  style:Record<string,string>={}; children:Element[]=[]; selectors=new Map<string,Element>();
  classList={add(){},remove(){}};
  append(...children:Element[]){this.children.push(...children);} remove(){}
  querySelector(key:string){if(!this.selectors.has(key))this.selectors.set(key,new Element());return this.selectors.get(key)!;}
  getContext(){return null;}
}
const body=new Element();
(globalThis as any).document={documentElement:{lang:'en'},createElement:()=>new Element(),body,getElementById:()=>null};
(globalThis as any).window={setTimeout:()=>1,addEventListener(){}};
const {WorldCombat}=await import('../src/combatView.ts');
const positions=[[-720,0],[720,0],[0,-720],[0,720]];
const layout={world:{seed:537,waterLevel:1},areas:[],paths:[],markers:BOSSES.map((b,i)=>({id:b.id,type:'enemy',label:b.id,p:[positions[i][0],2,positions[i][1]]}))} as unknown as Layout;
const make=()=>{
  const scene=new THREE.Scene(),done=new Set(BOSSES.flatMap(b=>[...b.requires]));
  const combat=new WorldCombat({scene,colliders:[],layout,done,toast(){},onVictory(){},onPlayerDefeated(){}});
  const internal=combat as any;internal.enemyAssets.loader.load=()=>{};
  const spawns=new WorldCombatState([
    {id:'alpha_probe',kind:'shade',p:{x:202,y:34,z:-4}},
    {id:'kyoto_probe',kind:'shade',p:{x:100,y:4,z:560}},
    {id:'winter_probe',kind:'shade',p:{x:40,y:9,z:-690}},
  ],[]).enemies;
  combat.state.enemies.push(...spawns);
  for(const enemy of spawns)internal.visuals.set(enemy.id,internal.makeEnemy(enemy));
  return {combat,internal,spawns,scene};
};

test('fresh paused/free-flight arrival presents encounters without activating AI, damage or timers',()=>{
  const {combat,internal,spawns}=make();
  for(const enemy of spawns){
    const before=JSON.stringify(enemy),hp=combat.state.hp;
    for(let frame=0;frame<120;frame++)combat.update(.05,{...enemy.p},false);
    assert.equal(internal.visuals.get(enemy.id).root.visible,true,`${enemy.id} must not require prior ground-combat tick`);
    assert.equal(JSON.stringify(enemy),before,'presentation cannot mutate simulation state');
    assert.equal(combat.state.hp,hp);assert.equal(combat.canShoot(),false);assert.equal(combat.allyEngage(),null);
    combat.update(.05,{x:enemy.p.x+COMBAT.activeRange+2,y:enemy.p.y,z:enemy.p.z},false);
    assert.equal(internal.visuals.get(enemy.id).root.visible,false,'distance cull still applies');
  }
  const dead=spawns[0];dead.mode='dead';combat.update(.05,dead.p,false);
  assert.equal(internal.visuals.get(dead.id).root.visible,false,'dead monsters do not reappear during flight');
  combat.dispose();assert.equal(internal.enemyAssets.activeMixers,0);
});

test('paused chapter challenge preserves its pose/state but dormant bosses are never revealed',()=>{
  const {combat,internal}=make();
  for(const def of BOSSES){
    const boss=combat.state.bosses.find(e=>e.id===def.id)!;
    combat.update(.05,boss.p,false);assert.equal(internal.visuals.get(boss.id).root.visible,false);
    assert.equal(combat.beginBoss(def.core),true);
    const before=JSON.stringify(boss),hp=combat.state.hp;
    combat.update(1,boss.p,false);
    assert.equal(internal.visuals.get(boss.id).root.visible,true);assert.equal(JSON.stringify(boss),before);assert.equal(combat.state.hp,hp);
    combat.state.resetBoss();combat.update(.05,boss.home,false);
    assert.equal(internal.visuals.get(boss.id).root.visible,false);
  }
  combat.dispose();
});

test('Valley and all chapter fallback silhouettes remove the old purple blob rather than recoloring it',()=>{
  const {combat,internal,spawns}=make();
  const valley=internal.visuals.get(spawns[0].id).fallback as THREE.Group;
  const guardian=valley.getObjectByName('Valley_Articulated_Prism_Hound');assert.ok(guardian,'new articulated creature exists');
  assert.equal(guardian.children.filter(n=>n.name.startsWith('Leg_')).length,4,'quadruped silhouette');
  const forbidden=new Set(['ac96fb','b9a6ff','3a3152']);
  for(const enemy of [...spawns,...combat.state.bosses]){
    const visual=internal.visuals.get(enemy.id);
    if(enemy.kind==='king'){
      assert.ok(enemyModel(enemy),'chapter bosses select a regional champion GLB');
      assert.ok(visual.body.getObjectByName('Champion_Gold_Crest'));
    }
    visual.fallback.traverse((o:THREE.Object3D)=>{
      if(!(o instanceof THREE.Mesh))return;
      assert.notEqual(o.geometry.type,'IcosahedronGeometry','no old broad humanoid blob body');
      for(const m of [o.material].flat())for(const key of ['color','emissive']){
        const color=(m as any)[key];if(color?.isColor)assert.ok(!forbidden.has(color.getHexString()),`removed palette ${color.getHexString()}`);
      }
    });
  }
  combat.dispose();
});

const dummy=()=>new WorldCombatState([{id:'loader_probe',kind:'shade',p:{x:0,y:0,z:720}}],[]).enemies[0];
test('transient model failure retries after backoff, then displays a real GLB even when AI is paused',async()=>{
  const visuals=new EnemyVisuals(),internal=visuals as any,parent=new THREE.Group(),fallback=new THREE.Group(),enemy=dummy();
  let calls=0,ok:Function=()=>{},fail:Function=()=>{};
  internal.loader.load=(_url:string,onLoad:Function,_progress:unknown,onError:Function)=>{calls++;ok=onLoad;fail=onError;};
  const draw=()=>visuals.update(enemy,'ashigaru',parent,fallback,0,5,true);
  draw();assert.equal(calls,1);fail(new Error('temporary HTTP failure'));
  for(let i=0;i<100;i++)draw();assert.equal(calls,1,'render count never drives retry timing');
  for(let i=0;i<4;i++){visuals.tick(1);draw();}assert.equal(calls,1);
  visuals.tick(1);draw();assert.equal(calls,2,'first retry after five seconds');
  ok(await parseLocalGlb(new URL('../public/assets/enemies/ashigaru.glb',import.meta.url)));draw();
  assert.equal(visuals.activeMixers,1);assert.equal(fallback.visible,false);assert.equal(enemy.active,false,'rendering is independent of AI activation');
  const instance=internal.instances.get(enemy.id),time=instance.action.time;
  assert.equal(instance.action.getEffectiveWeight(),1,'first paused pose has full weight, not a frozen zero-weight fade');
  for(let i=0;i<10;i++)draw();assert.equal(instance.action.time,time,'paused rendered skin does not advance animation');
  visuals.dispose();assert.equal(parent.children.length,0);
});

test('permanent missing asset stops after three requests and keeps visible fallback',()=>{
  const visuals=new EnemyVisuals(),internal=visuals as any,parent=new THREE.Group(),fallback=new THREE.Group(),enemy=dummy();let calls=0;
  internal.loader.load=(_url:string,_ok:Function,_progress:unknown,fail:Function)=>{calls++;fail(new Error('missing'));};
  const draw=()=>visuals.update(enemy,'ashigaru',parent,fallback,0,5,true);
  draw();for(let i=0;i<100;i++){visuals.tick(1);draw();}
  assert.equal(calls,3);assert.equal(visuals.activeMixers,0);assert.equal(fallback.visible,true);assert.equal(visuals.diagnostics.pending,0);assert.equal(visuals.diagnostics.exhausted,1);
  visuals.dispose();for(let i=0;i<20;i++){visuals.tick(1);draw();}assert.equal(calls,3,'disposed worlds cannot restart downloads');
});

import {VALLEY_STORY} from '../src/valleyStory.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import type { Layout } from '../src/types.ts';

// Headless structural/resource test, NOT browser/render QA. CSS has no bearing on these invariants.
registerHooks({ load(url, context, nextLoad) { return url.endsWith('.css') ? { format: 'module', source: '', shortCircuit: true } : nextLoad(url, context); } });
class Element {
  id = ''; className = ''; textContent = ''; innerHTML = ''; hidden = false; title = '';
  style: Record<string, string> = {}; removed = false;
  children: Element[] = []; selectors = new Map<string, Element>();
  classes = new Set<string>();
  classList = { add: (name: string) => this.classes.add(name), remove: (name: string) => this.classes.delete(name) };
  append(...elements: Element[]) { this.children.push(...elements); }
  remove() { this.removed = true; }
  querySelector(selector: string): Element { if (!this.selectors.has(selector)) this.selectors.set(selector, new Element()); return this.selectors.get(selector)!; }
}
const body = new Element(), crosshair = new Element();
(globalThis as any).document = { documentElement: { lang: '' }, createElement: () => new Element(), body, getElementById: (id: string) => id === 'crosshair' ? crosshair : body.children.find(e => e.id === id) };
(globalThis as any).window = { setTimeout: () => 1, addEventListener() {} };
const { WorldCombat } = await import('../src/combatView.ts');
const layout = {
  world: { seed: 537, waterLevel: 1 }, areas: [],
  markers: [{ id: 'boss_vacant_king', type: 'enemy', p: [0, 2, 0], label: 'Boss' }],
} as unknown as Layout;

const { BOSSES, COMBAT } = await import('../src/combat.ts');
const { WorldProgress } = await import('../src/progress.ts');
for(const def of BOSSES) test(`${def.id}: actual view grants first-clear reward once, reloads and resets repeated encounters`,()=>{
  const scene=new THREE.Scene(),storage={value:null as string|null,getItem(){return this.value;},setItem(_k:string,v:string){this.value=v;},removeItem(){}};
  const progress=new WorldProgress(storage);def.requires.forEach(x=>progress.done.add(x));
  const callbacks:string[]=[],messages:string[]=[];
  const testLayout={...layout,markers:[{id:def.id,type:'enemy',p:[0,2,0],label:'Boss'}]} as Layout;
  const make=()=>new WorldCombat({scene,colliders:[],layout:testLayout,done:progress.done,toast:m=>messages.push(m),onVictory:core=>{callbacks.push(core);progress.done.add(core);progress.save();},onPlayerDefeated(){}});
  let combat=make();const sceneRoots=scene.children.length;
  for(let round=0;round<8;round++) {
    assert.equal(combat.beginBoss(def.core),true);assert.equal(combat.state.boss.hp,COMBAT.bossHp);
    assert.equal(combat.beginBoss(def.core),false,'double interaction cannot restart active fight');
    combat.state.shotCooldown=.5;combat.state.hurtCooldown=.5;
    assert.equal(combat.damageEnemy(def.id,COMBAT.bossHp+1),true);
    assert.equal(combat.bossStarted,false);assert.equal(progress.done.has(def.reward),true);
    assert.deepEqual(callbacks,[def.core],'no second reward callback/save');assert.equal(scene.children.length,sceneRoots,'replays do not add scene roots');
    if(round>0)assert.match(messages.at(-1)!,/再次挑战成功|Rematch won/);
  }
  const saved=storage.value;combat.dispose();assert.equal(scene.children.length,0);
  const reload=new WorldProgress(storage);assert.equal(reload.done.has(def.core),true);assert.equal(reload.done.has(def.reward),true);
  progress.done.clear();reload.done.forEach(x=>progress.done.add(x));combat=make();
  assert.equal(combat.beginBoss(def.core),true,'completed save opens challenge after reload');
  combat.state.boss.phase=2;combat.state.boss.attackCount=4;combat.state.boss.timer=.2;
  combat.state.resetBoss();assert.equal(combat.state.isCleared(def.id),true,'exit preserves first-clear history');
  assert.equal(combat.beginBoss(def.core),true);assert.equal(combat.state.boss.phase,1);assert.equal(combat.state.boss.attackCount,0);
  combat.damageEnemy(def.id,COMBAT.bossHp);assert.deepEqual(callbacks,[def.core]);assert.equal(storage.value,saved);
  combat.reset();assert.equal(combat.state.boss.mode,'dead');assert.equal(combat.beginBoss(def.core),true);
  progress.done.clear();combat.reset();assert.equal(combat.state.isCleared(def.id),false);assert.equal(combat.beginBoss(def.core),false,'global progress reset restores gating');
  combat.dispose();combat.dispose();assert.equal(scene.children.length,0);
});

test('production interact function routes completed cores to challenge but still gates first clear',async()=>{
  const vm=await import('node:vm'),{transformSync}=await import('esbuild');
  const source=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8');
  const interaction=source.slice(source.indexOf('function interact()'),source.indexOf('function checkDiscoveries()'));
  const calls:string[]=[],toasts:string[]=[],done=new Set<string>();
  const marker={id:'sun_core',label:'Core',requires:['required']};
  const context=vm.createContext({VALLEY_STORY,nearestInteract:()=>marker,BOSSES,done,markers:new Map(),combat:{beginBoss:(id:string)=>{calls.push(id);return true;}},toast:(s:string)=>toasts.push(s),bilingual:(zh:string)=>zh,localizeText:(s:string)=>s});
  vm.runInContext(transformSync(interaction,{loader:'ts',format:'cjs'}).code,context);
  vm.runInContext('interact()',context);assert.equal(calls.length,0,'first-clear prerequisite retained');
  done.add('sun_core');vm.runInContext('interact()',context);vm.runInContext('interact()',context);
  assert.deepEqual(calls,['sun_core','sun_core'],'completed marker routes repeated actions to actual combat guard');
  assert.match(source,/再次挑战 Boss（不重复领取首通奖励）/,'source guard only: prompt advertises reward semantics');
});

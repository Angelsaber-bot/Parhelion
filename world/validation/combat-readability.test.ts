/** DOM/state/resource regressions only; no GPU rendering acceptance implied. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { setLanguage } from '../../shared-client/i18n.ts';
import { WorldCombatState, isMeleePunishWindow, COMBAT, BOSSES, type EnemyMode } from '../src/combat.ts';
import type { Layout } from '../src/types.ts';
registerHooks({load(url,context,next){return url.endsWith('.css')?{format:'module',source:'',shortCircuit:true}:next(url,context);}});
class Element {
  id='';className='';textContent='';innerHTML='';hidden=false;title='';style:Record<string,string>={};
  selectors=new Map<string,Element>();children:Element[]=[];
  classes=new Set<string>();
  classList={add:(name:string)=>{this.classes.add(name);},remove:(name:string)=>{this.classes.delete(name);}};
  append(...e:Element[]){this.children.push(...e);}remove(){}
  querySelector(key:string){if(!this.selectors.has(key))this.selectors.set(key,new Element());return this.selectors.get(key)!;}
}
const crosshair=new Element();let timers=0;
(globalThis as any).document={documentElement:{lang:''},createElement:()=>new Element(),body:new Element(),getElementById:()=>crosshair};
(globalThis as any).window={setTimeout:()=>{timers++;return 1;},addEventListener(){}};
const {WorldCombat}=await import('../src/combatView.ts');
const bossIds=['boss_vacant_king','boss_drowned_admiral','boss_winter_warden','boss_hellfire_lord'];
function fixture(id=bossIds[0]) {
  const scene=new THREE.Scene(),messages:string[]=[];
  const layout={world:{seed:537,waterLevel:1},areas:[],markers:[{id,type:'enemy',p:[0,2,0],label:'Boss'}]} as unknown as Layout;
  const combat=new WorldCombat({scene,colliders:[],layout,done:new Set(BOSSES.flatMap(b=>b.requires)),toast:s=>messages.push(s),onVictory(){},onPlayerDefeated(){}});
  assert.equal(combat.beginBoss(BOSSES.find(b=>b.id===id)!.core),true);
  const enemy=combat.state.boss;enemy.active=true;
  const internal=combat as any,visual=internal.visuals.get(enemy.id);
  return {scene,combat,enemy,internal,visual,messages};
}
test('shared natural-recovery predicate matches actual bonus damage and excludes forced stagger/cooldown',()=>{
  const s=new WorldCombatState([{id:'dummy',kind:'shade',p:{x:0,y:0,z:0}}],[]),e=s.enemies[0];
  for(const mode of ['idle','chase','windup','recover','stagger'] as EnemyMode[]) for(const cooldown of [0,.01,4]) {
    e.active=true;e.mode=mode;e.staggerCooldown=cooldown;e.hp=e.maxHp;
    const eligible=isMeleePunishWindow(e),hp=e.hp;
    s.hitEnemy(e.id,10,{source:'melee'});
    assert.equal(hp-e.hp,eligible?10*COMBAT.meleePunish:10,`${mode}/${cooldown}`);
  }
});
test('existing health bar and localized boss HUD show 2x only when a real playable punish exists',()=>{
  const {combat,enemy:e,internal,visual:v}=fixture();
  try {
    setLanguage('en');e.mode='recover';e.timer=1.2;e.staggerCooldown=0;
    combat.present(0,e.p,true);
    assert.equal(v.fill.material.color.getHexString(),'79efdc');assert.equal(v.bar.scale.y,1.65);
    assert.match(internal.bossHud.querySelector('small').textContent,/PUNISH · MELEE ×2 · 1.2s/);
    assert.match(internal.bossHud.querySelector('small').className,/--punish/);
    const hp=e.hp;combat.state.hitEnemy(e.id,10,{source:'melee'});combat.present(0,e.p,true);
    assert.equal(hp-e.hp,20);assert.match(internal.impact.textContent,/PUNISH ×2/);
    for(const [mode,cooldown] of [['stagger',4],['recover',3]] as const) {
      e.mode=mode;e.staggerCooldown=cooldown;combat.present(0,e.p,true);
      assert.equal(v.bar.scale.y,1);assert.notEqual(v.fill.material.color.getHexString(),'79efdc');
      assert.doesNotMatch(internal.bossHud.querySelector('small').textContent,/×2/);
      assert.match(internal.bossHud.querySelector('small').textContent,/Normal damage/);
    }
    e.mode='recover';e.staggerCooldown=0;
    combat.present(0,e.p,false);
    assert.equal(v.bar.scale.y,1);assert.match(internal.bossHud.querySelector('small').textContent,/Combat paused/);
    combat.present(0,e.p,true);setLanguage('zh');combat.present(0,e.p,true);
    assert.match(internal.bossHud.querySelector('small').textContent,/破绽 · 近战 ×2/);
    e.active=false;combat.present(0,e.p,true);assert.equal(v.bar.scale.y,1);assert.doesNotMatch(internal.bossHud.querySelector('small').textContent,/×2/);
    e.active=true;combat.state.hp=0;combat.state.defeatedFor=1;combat.present(0,e.p,true);assert.equal(v.bar.scale.y,1);assert.doesNotMatch(internal.bossHud.querySelector('small').textContent,/×2/);
  } finally {combat.dispose();setLanguage('zh');}
});
for(const id of bossIds) test(`${id}: hints follow every actual attack footprint, not its last attack or an invented core`,()=>{
  const {combat,enemy:e,internal,messages}=fixture(id);
  try {
    assert.ok(messages.length>0);assert.doesNotMatch(messages.join(' '),/射击.*核心|射击.*火核|shoot.*core|fire at|ice heart|cold lamp/);
    setLanguage('en');e.mode='windup';e.timer=.8;
    for(const [attack,words] of [['thrust',/sidestep the lane/],['shot',/small circle or take cover/],['burst',/circle/],['sweep',/sweep|move away/i]] as const) {
      e.attack=attack;combat.present(0,e.p,true);
      const text=internal.bossHud.querySelector('small').textContent;
      assert.match(text,words);assert.doesNotMatch(text,/shoot.*core|fire at|×2/i);
      assert.equal(internal.visuals.get(e.id).tell.visible,true);
    }
    e.mode='chase';combat.present(0,e.p,true);
    assert.match(internal.bossHud.querySelector('small').textContent,/Read tells/);
    assert.doesNotMatch(internal.bossHud.querySelector('small').textContent,/core|cold lamp|ice heart/);
  } finally {combat.dispose();setLanguage('zh');}
});
test('recovery presentation allocates no extra scene resources across repeated transitions and reset',()=>{
  const {scene,combat,enemy:e,internal}=fixture();
  function inventory(){const o=new Set<THREE.Object3D>(),g=new Set<THREE.BufferGeometry>(),m=new Set<THREE.Material>();scene.traverse(n=>{o.add(n);if(n instanceof THREE.Mesh){g.add(n.geometry);for(const v of Array.isArray(n.material)?n.material:[n.material])m.add(v);}assert.equal(n instanceof THREE.Light,false);});return{o,g,m};}
  const base=inventory();
  for(let i=0;i<100;i++) {
    e.mode=i%3===0?'windup':i%3===1?'recover':'stagger';e.staggerCooldown=i%3===2?4:0;e.timer=.8;
    combat.present(.001,e.p,true);
    const current=inventory();assert.deepEqual(current,base);
    assert.equal(internal.shots.length,0);assert.equal(internal.sparks.length,0);
  }
  combat.reset();combat.present(0,e.p,false);
  assert.doesNotMatch(internal.bossHud.querySelector('small').className,/--punish/);
  assert.equal(internal.visuals.get(e.id).root.visible,false);
  combat.dispose();assert.equal(scene.children.length,0);
  const css=readFileSync(new URL('../src/combat.css',import.meta.url),'utf8');
  assert.doesNotMatch(css.match(/\.combat-counter--punish\s*\{[^}]+\}/)![0],/animation|box-shadow|filter/);
});

test('nearest ordinary enemy cue distinguishes a real interrupted windup from a later earned recovery',()=>{
  const {combat,internal}=fixture();
  combat.state.bossStarted=false;combat.state.boss.active=false;
  const e=new WorldCombatState([{id:'ordinary',kind:'shade',role:'breaker',p:{x:3,y:2,z:0}}],[]).enemies[0];
  combat.state.enemies.push(e);internal.visuals.set(e.id,internal.makeEnemy(e));
  e.active=true;e.mode='windup';e.timer=1;
  try {
    setLanguage('en');combat.present(0,{x:0,y:2,z:0},true);
    assert.match(internal.hud.querySelector('small').textContent,/Breaker.*Close sweep/);
    combat.state.hitEnemy(e.id,10,{source:'melee'});combat.present(0,e.p,true);
    assert.equal(e.mode,'stagger');assert.equal(isMeleePunishWindow(e),false);
    assert.match(internal.hud.querySelector('small').textContent,/INTERRUPTED · Normal damage/);
    assert.doesNotMatch(internal.hud.querySelector('small').className,/--punish/);
    e.mode='recover';e.timer=1;e.staggerCooldown=.01;combat.present(0,e.p,true);
    assert.doesNotMatch(internal.hud.querySelector('small').textContent,/×2/);
    e.staggerCooldown=0;combat.present(0,e.p,true);
    assert.match(internal.hud.querySelector('small').textContent,/Breaker.*PUNISH · MELEE ×2/);
    assert.match(internal.hud.querySelector('small').className,/--punish/);
    e.pacified=true;combat.present(0,e.p,true);
    assert.doesNotMatch(internal.hud.querySelector('small').textContent,/×2/);
    assert.equal(internal.visuals.get(e.id).bar.scale.y,1);
  } finally {combat.dispose();setLanguage('zh');}
});

test('new hits extend one deterministic marker window without old timeouts or multi-target timer growth',()=>{
  const {combat,enemy:e,internal}=fixture();
  combat.present(0,e.p,true);const beforeTimers=timers;
  combat.damageEnemy(e.id,1);assert.ok(crosshair.classes.has('hit'));
  combat.present(.08,e.p,true);assert.ok(crosshair.classes.has('hit'));
  combat.damageEnemy(e.id,1);combat.present(.06,e.p,true);
  assert.ok(crosshair.classes.has('hit'),'first hit expiry cannot clear the newer hit');
  combat.present(.071,e.p,true);assert.equal(crosshair.classes.has('hit'),false);
  for(let i=0;i<200;i++) combat.damageEnemy(e.id,1);
  assert.equal(timers,beforeTimers,'no per-hit timer callbacks');assert.equal(internal.hitMarkerFor,.13);
  combat.flashHitMarker(100);assert.equal(internal.hitMarkerFor,.2,'external quest-hit window is bounded');
  combat.present(.201,e.p,true);assert.equal(crosshair.classes.has('hit'),false);
  combat.dispose();
});
test('pause/reset/dispose clear hit feedback immediately and paused or disposed callbacks cannot resurrect it',()=>{
  const {combat,enemy:e,internal}=fixture();combat.present(0,e.p,true);
  combat.flashHitMarker(.14);assert.ok(crosshair.classes.has('hit'));
  combat.simulate(0,e.p,false);assert.equal(crosshair.classes.has('hit'),false);assert.equal(internal.hitMarkerFor,0);
  combat.present(0,e.p,false);
  combat.flashHitMarker();assert.equal(crosshair.classes.has('hit'),false);
  combat.present(0,e.p,true);combat.flashHitMarker();combat.reset();assert.equal(crosshair.classes.has('hit'),false);
  combat.present(0,e.p,true);combat.flashHitMarker();combat.dispose();assert.equal(crosshair.classes.has('hit'),false);
  combat.flashHitMarker();assert.equal(crosshair.classes.has('hit'),false);
});

test('half-health phase transition exposes only the already-existing recovery bonus, not a premature bonus on the triggering hit',()=>{
  const {combat,enemy:e,internal,visual:v}=fixture();
  try {
    setLanguage('en');e.mode='windup';e.timer=.01;combat.present(0,e.p,true);
    combat.damageEnemy(e.id,e.maxHp/2,{source:'ranged',origin:e.p});
    assert.equal(e.phase,2);assert.equal(e.mode,'recover');
    assert.doesNotMatch(internal.impact.textContent,/PUNISH/,'threshold hit itself was not a melee recovery hit');
    combat.present(0,e.p,true);assert.equal(v.bar.scale.y,1.65);
    assert.match(internal.bossHud.querySelector('small').textContent,/PUNISH · MELEE ×2 · 1.2s/);
    const hp=e.hp;combat.damageEnemy(e.id,10,{source:'melee',origin:e.p});assert.equal(hp-e.hp,20);
  } finally {combat.dispose();setLanguage('zh');}
});

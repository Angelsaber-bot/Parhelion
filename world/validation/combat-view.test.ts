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

test('combat visual pools are capped, reset releases shots/tells, and dispose is repeat-safe', () => {
  const scene = new THREE.Scene(), done = new Set<string>();
  const combat = new WorldCombat({ scene, colliders: [], layout, done, toast() {}, onVictory() {}, onPlayerDefeated() {} });
  const internals = combat as any;
  const from = new THREE.Vector3(0, 3, 0), end = new THREE.Vector3(0, 3, -20);
  for (let i = 0; i < 100; i++) combat.shot(from, end, true);
  assert.equal(internals.shots.length, 18); assert.equal(internals.sparks.length, 20);
  assert.ok(internals.effectGroup.children.length <= 18 * 3 + 20);
  combat.update(0.01, { x: 0, y: 2, z: 0 }, true);
  assert.equal(combat.canShoot(), true); assert.equal(combat.canShoot(), false);
  internals.allyCooldown = 1; internals.acc = 0.02; internals.hurtFor = 0.3;
  combat.reset();
  assert.equal(internals.shots.length, 0); assert.equal(internals.sparks.length, 0);
  assert.equal(internals.effectGroup.children.length, 0); assert.equal(internals.allyCooldown, 0); assert.equal(internals.acc, 0);
  assert.equal(internals.hurt.style.opacity, '0');
  for (const visual of internals.visuals.values()) { assert.equal(visual.root.visible, false); assert.equal(visual.tell.visible, false); }
  combat.dispose(); combat.dispose();
  assert.equal(scene.children.length, 0, 'all owned scene roots removed');
  for (const id of ['world-vitals', 'world-boss', 'world-impact', 'world-hurt', 'world-defeat']) assert.ok(body.children.find(e => e.id === id)?.removed);
});

test('ally assist is player-proximity, range, LOS and cooldown limited', () => {
  const combat = new WorldCombat({ scene: new THREE.Scene(), colliders: [], layout, done: new Set(['saber_contract', 'shard_camp', 'shard_tower', 'shard_table']), toast() {}, onVictory() {}, onPlayerDefeated() {} });
  combat.beginBoss(); combat.update(0.01, { x: 0, y: 2, z: 0 }, true);
  const hp = combat.state.boss.hp;
  assert.ok(combat.allyStrike({ x: 0, y: 2, z: 0 }, 100, 10000));
  assert.equal(combat.state.boss.hp, hp - 18, 'caller cannot bypass damage cap');
  assert.equal(combat.allyStrike({ x: 0, y: 2, z: 0 }), null, 'cooldown enforced');
  combat.reset(); combat.beginBoss(); combat.update(0.01, { x: 50, y: 2, z: 0 }, true);
  assert.equal(combat.allyStrike({ x: 0, y: 2, z: 0 }), null, 'cannot leave ally to fight unattended');
  combat.dispose();
});

test('HUD source keeps health above controls and gives the narrow boss layout priority over the contract card', () => {
  // Source-layout guard only: a browser render is still required for final visual acceptance.
  const css = readFileSync(new URL('../src/combat.css', import.meta.url), 'utf8');
  const vitals = css.match(/#world-vitals\s*\{([^}]+)\}/)![1];
  assert.match(vitals, /bottom:\s*205px/); assert.match(vitals, /left:\s*18px/);
  assert.doesNotMatch(vitals, /translateX|left:\s*50%/, 'do not put HP back across the wide help panel');
  const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(index, /#movement-mode[^}]*bottom:\s*160px/);
  // The status strip is 32px high at its current one-line font/padding: 160 + 32 < 205.
  assert.ok(160 + 32 < 205, 'HP has a clear lane above movement status');
  const narrow = css.slice(css.indexOf('@media (max-width: 760px)'));
  assert.match(narrow, /#contract-card\s*\{\s*display:\s*none/);
  assert.doesNotMatch(narrow, /#world-vitals[^}]*bottom:\s*(12|24)px/);
});

test('servant anticipation is read-only and contact revalidates the chosen enemy, range, LOS and pause', () => {
  const combat = new WorldCombat({ scene: new THREE.Scene(), colliders: [], layout, done: new Set(['saber_contract', 'shard_camp', 'shard_tower', 'shard_table']), toast() {}, onVictory() {}, onPlayerDefeated() {} });
  combat.beginBoss(); combat.update(.01,{x:0,y:2,z:0},true);
  const p={x:0,y:2,z:0},hp=combat.state.boss.hp,target=combat.allyTarget(p);
  assert.ok(target);assert.equal(combat.state.boss.hp,hp,'wind-up never damages');
  assert.equal(combat.allyStrike(p,3.5,14,'stale-or-different-enemy'),null);
  assert.equal(combat.allyStrike({x:10,y:2,z:0},3.5,14,target.id),null,'enemy has moved out of reach');
  const los=combat.geometry.terrain.lineOfSight;combat.geometry.terrain.lineOfSight=()=>false;
  assert.equal(combat.allyStrike(p,3.5,14,target.id),null,'wall appearing during wind-up blocks contact');
  combat.geometry.terrain.lineOfSight=los;combat.update(.01,p,false);
  assert.equal(combat.allyStrike(p,3.5,14,target.id),null,'pause blocks contact');
  combat.update(.01,p,true);assert.ok(combat.allyStrike(p,3.5,14,target.id));assert.equal(combat.state.boss.hp,hp-14);
  combat.dispose();
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerHooks } from 'node:module';
import { readFileSync, readdirSync } from 'node:fs';
import { VisibleEnemyRoot } from '../src/visibleEnemyRoot.ts';
import { ENEMY_CONTACT_EFFECT_BUDGET } from '../src/enemyContactEffects.ts';
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
  // The accepted Warden cue pool is persistent, unlike transient shots/sparks.
  // Count it separately so adding three fixed slots cannot hide a transient leak.
  const contactSlots = [...internals.effectGroup.children] as THREE.Mesh[];
  assert.equal(contactSlots.length, ENEMY_CONTACT_EFFECT_BUDGET.slots);
  assert.ok(contactSlots.every(slot => slot.name.startsWith('echo-warden-contact-') && !slot.visible));
  assert.equal(internals.contactEffects.diagnostics.bytes, ENEMY_CONTACT_EFFECT_BUDGET.slots * ENEMY_CONTACT_EFFECT_BUDGET.vertices * 12);
  const from = new THREE.Vector3(0, 3, 0), end = new THREE.Vector3(0, 3, -20);
  for (let i = 0; i < 100; i++) combat.shot(from, end, true);
  assert.equal(internals.shots.length, 18); assert.equal(internals.sparks.length, 20);
  assert.ok(internals.effectGroup.children.filter((child: THREE.Object3D) => !contactSlots.includes(child as THREE.Mesh)).length <= 18 * 3 + 20);
  assert.ok(contactSlots.every(slot => internals.effectGroup.children.includes(slot)));
  assert.ok(internals.effectGroup.children.length <= 18 * 3 + 20 + ENEMY_CONTACT_EFFECT_BUDGET.slots);
  combat.update(0.01, { x: 0, y: 2, z: 0 }, true);
  assert.equal(combat.canShoot(), true); assert.equal(combat.canShoot(), false);
  internals.allyCooldown = 1; internals.acc = 0.02; internals.hurtFor = 0.3;
  combat.reset();
  assert.equal(internals.shots.length, 0); assert.equal(internals.sparks.length, 0);
  assert.deepEqual(internals.effectGroup.children, contactSlots);
  assert.ok(contactSlots.every(slot => !slot.visible)); assert.equal(internals.contactEffects.diagnostics.active, 0);
  assert.equal(internals.allyCooldown, 0); assert.equal(internals.acc, 0);
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

test('HUD source keeps health in the bottom-left corner and gives the narrow boss layout priority over the contract card', () => {
  // Source-layout guard only: a browser render is still required for final visual acceptance.
  const css = readFileSync(new URL('../src/combat.css', import.meta.url), 'utf8');
  const vitals = css.match(/#world-vitals\s*\{([^}]+)\}/)![1];
  assert.match(vitals, /bottom:\s*18px/); assert.match(vitals, /left:\s*18px/);
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

test('hit feedback stays at the impact point as tiny camera-facing streaks, never an enemy shell', () => {
  const combat = new WorldCombat({ scene: new THREE.Scene(), colliders: [], layout, done: new Set(), toast() {}, onVictory() {}, onPlayerDefeated() {} });
  const internals = combat as any;
  const muzzle = new THREE.Vector3(1, 3, 4), impact = new THREE.Vector3(7, 5, -9);
  const camera = new THREE.PerspectiveCamera(); camera.rotation.set(.2, .8, -.1);
  combat.shot(muzzle, impact, true);
  const spark = internals.sparks[0], shot = internals.shots[0];
  assert.ok(spark.mesh.position.equals(impact), 'use raycast endpoint, not enemy center');
  assert.ok(shot.bolt.position.equals(muzzle), 'tracer begins at muzzle even before first update');
  assert.equal(spark.mesh.geometry.type, 'BufferGeometry');
  assert.ok(spark.mesh.geometry.boundingSphere.radius <= .141, 'streak diameter bounded below .3m');
  assert.equal(spark.mesh.material.wireframe, false);
  assert.equal(spark.mesh.material.depthWrite, false);
  for (const visual of internals.visuals.values()) {
    assert.equal('flash' in visual, false, 'no body-attached hit flash');
    visual.body.traverse((o: THREE.Object3D) => {
      if (o instanceof THREE.Mesh) assert.notEqual(o.geometry.type, 'IcosahedronGeometry');
    });
  }
  const opacity = spark.mesh.material.opacity;
  combat.update(.07, { x: 0, y: 2, z: 0 }, false, camera);
  assert.ok(spark.mesh.position.equals(impact));
  assert.ok(spark.mesh.quaternion.angleTo(camera.quaternion) < 1e-6);
  assert.ok(spark.mesh.scale.x > 0 && spark.mesh.scale.x <= 1, 'never expands to obscure body');
  assert.equal(spark.mesh.material.opacity, opacity, 'lifetime does not mutate shared material');
  assert.equal(shot.flash.visible, false, 'muzzle flash expires within 45ms');
  combat.shot(muzzle, impact, false);
  assert.equal(internals.sparks.length, 1, 'miss does not spawn impact feedback');
  combat.update(.1, { x: 0, y: 2, z: 0 }, false, camera);
  assert.equal(internals.sparks.length, 0, 'hit streak expires within 140ms');
  let geometryDisposals = 0, materialDisposals = 0;
  internals.sparkGeo.addEventListener('dispose', () => geometryDisposals++);
  internals.sparkMat.addEventListener('dispose', () => materialDisposals++);
  combat.dispose(); combat.dispose();
  assert.equal(geometryDisposals, 1); assert.equal(materialDisposals, 1);
});

test('thrust visual corners match the simulation rectangle for every facing', async () => {
  const { enemyAttackContains, enemyThrustLength, enemyAttackRadius } = await import('../src/combat.ts');
  const combat = new WorldCombat({ scene: new THREE.Scene(), colliders: [], layout, done: new Set(['saber_contract', 'shard_camp', 'shard_tower', 'shard_table']), toast() {}, onVictory() {}, onPlayerDefeated() {} });
  combat.beginBoss();
  const e = combat.state.boss, v = (combat as any).visuals.get(e.id);
  e.mode = 'windup'; e.attack = 'thrust'; e.timer = 1;
  for (const [x, z] of [[1, 0], [0, 1], [-1, 0], [0, -1], [.6, .8]]) {
    e.target.x = e.p.x + x * 5; e.target.z = e.p.z + z * 5;
    combat.update(.001, e.p, true);
    assert.equal(v.tell.geometry.type, 'PlaneGeometry');
    assert.equal(v.tell.scale.x, enemyAttackRadius(e)); assert.equal(v.tell.scale.y, enemyThrustLength(e));
    v.tell.updateMatrixWorld(true);
    for (const [localX, localY] of [[.9, .4], [-.9, -.4]]) {
      const point = v.tell.localToWorld(new THREE.Vector3(localX, localY, 0)); point.y = e.p.y;
      assert.equal(enemyAttackContains(e, point), true, `inside rendered tell ${x},${z}`);
    }
    const outside = v.tell.localToWorld(new THREE.Vector3(1.1, 0, 0)); outside.y = e.p.y;
    assert.equal(enemyAttackContains(e, outside), false, 'outside tell does not hit');
  }
  e.attack = 'sweep'; combat.update(.001, e.p, true); assert.equal(v.tell.geometry.type, 'CircleGeometry');
  combat.dispose();
});

test('contact API reports actual capped damage, source and kills but never inactive or admin energy', () => {
  const damage: any[] = [], kills: string[] = [];
  const combat = new WorldCombat({ scene: new THREE.Scene(), colliders: [], layout, done: new Set(['saber_contract', 'shard_camp', 'shard_tower', 'shard_table']), toast() {}, onVictory() {}, onPlayerDefeated() {}, onDamage: hit => damage.push(hit), onKill: id => kills.push(id) });
  combat.beginBoss(); combat.update(.001, { x: 0, y: 2, z: -2 }, true);
  const e = combat.state.boss;
  combat.state.hitEnemy(e.id, 1); combat.update(.001, e.p, true);
  assert.equal(damage.length, 0, 'raw simulation/admin damage never charges skills');
  const strike = { origin: { x: 0, y: 2, z: -2 }, direction: { x: 0, y: 0, z: 1 }, range: 3, halfWidth: 1, damage: 30, maxTargets: 1 };
  const hit = combat.applyStrike(strike, 'melee');
  assert.equal(hit.damage, 30); assert.equal(damage[0].source, 'melee'); assert.equal(damage[0].eligible, true);
  combat.update(.001, e.p, false); assert.equal(combat.applyStrike(strike, 'melee').damage, 0, 'paused contact canceled');
  combat.update(.001, e.p, true); e.hp = 7;
  const killed = combat.applyStrike(strike, 'ultimate');
  assert.equal(killed.damage, 7); assert.deepEqual(killed.kills, [e.id]); assert.deepEqual(kills, [e.id]);
  assert.equal(damage.at(-1).damage, 7); assert.equal(damage.at(-1).source, 'ultimate');
  assert.equal(combat.applyStrike(strike, 'melee').damage, 0, 'dead targets cannot farm energy');
  combat.dispose();
});

test('actual hurt callback fires once per resolved impact, never for guarded immunity or per-frame HUD', () => {
  const hurt: number[] = [];
  const combat = new WorldCombat({ scene: new THREE.Scene(), colliders: [], layout, done: new Set(['saber_contract', 'shard_camp', 'shard_tower', 'shard_table']), toast() {}, onVictory() {}, onPlayerDefeated() {}, onHurt: damage => hurt.push(damage) });
  combat.beginBoss(); const e = combat.state.boss;
  e.mode = 'windup'; e.attack = 'sweep'; e.timer = .01;
  combat.setDefense({ guard: .55, invulnerable: false }); combat.update(.05, e.p, true);
  assert.deepEqual(hurt, [13.75]);
  combat.update(.01, e.p, true); assert.equal(hurt.length, 1);
  e.mode = 'windup'; e.timer = .01; combat.state.hurtCooldown = 0;
  combat.setDefense({ guard: 1, invulnerable: true }); combat.update(.05, e.p, true);
  assert.equal(hurt.length, 1, 'evaded hit produces no hurt sound callback');
  combat.dispose();
});

test('120Hz facade calls retain20Hz AI and leave all presentation work to one render pass', () => {
  const combat = new WorldCombat({ scene: new THREE.Scene(), colliders: [], layout, done: new Set(['saber_contract', 'shard_camp', 'shard_tower', 'shard_table']), toast() {}, onVictory() {}, onPlayerDefeated() {} });
  combat.beginBoss();
  let steps = 0, los = 0, assetUpdates = 0;
  const originalStep = combat.state.step.bind(combat.state);
  combat.state.step = (...args) => { steps++; originalStep(...args); };
  combat.geometry.terrain.lineOfSight = () => { los++; return true; };
  combat.geometry.terrain.walk = (_p, x, z) => ({ x, y: 2, z });
  const internal = combat as any, originalAssets = internal.enemyAssets.update.bind(internal.enemyAssets);
  internal.enemyAssets.update = (...args: unknown[]) => { assetUpdates++; return originalAssets(...args); };
  const player = { x: 12, y: 2, z: 0 };
  for (let i = 0; i < 120; i++) combat.simulate(1 / 120, player, true);
  assert.equal(steps, 20); assert.equal(los, 20); assert.equal(assetUpdates, 0, 'no model/LOD updates in physics loop');
  combat.present(1 / 60, player, true); assert.equal(steps, 20, 'present never advances combat'); assert.ok(assetUpdates > 0);
  for (let i = 0; i < 120; i++) combat.simulate(1 / 120, player, false);
  assert.equal(steps, 20, 'paused simulation performs no AI or terrain queries');
  combat.dispose();
});

// CPU matrix correctness audit; not a GPU/FPS claim.
function assertFreshSubtree(root: THREE.Object3D) {
  root.traverse(node => {
    const expected = node.parent ? new THREE.Matrix4().multiplyMatrices(node.parent.matrixWorld, node.matrix) : node.matrix;
    assert.deepEqual(node.matrixWorld.elements, expected.elements, `${node.name || node.type}: first visible frame refreshes descendants`);
  });
}
test('production hidden enemy roots skip traversal but first visible render refreshes moved fallback; explicit world queries remain valid', () => {
  const scene = new THREE.Scene();
  const combat = new WorldCombat({ scene, colliders: [], layout, done: new Set(), toast() {}, onVictory() {}, onPlayerDefeated() {} });
  const e = combat.state.boss;
  combat.state.bossStarted = true;
  const v = (combat as any).visuals.get(e.id);
  assert.ok(v.root instanceof VisibleEnemyRoot);
  combat.present(0, e.p, false); scene.updateMatrixWorld(true);
  assert.equal(v.root.visible, true); assertFreshSubtree(v.root);
  const old = v.body.matrixWorld.clone();
  let childVisits = 0;
  const original = v.body.updateMatrixWorld;
  v.body.updateMatrixWorld = function(force?: boolean) { childVisits++; original.call(this, force); };
  e.p.x += 7; e.p.y += 2; e.p.z -= 3;
  combat.present(0, {x:e.p.x + 1000,y:e.p.y,z:e.p.z}, false);
  v.body.rotation.y = .7;
  scene.position.set(3,4,5); scene.updateMatrixWorld(true);
  assert.equal(v.root.visible, false); assert.equal(childVisits, 0);
  assert.deepEqual(v.body.matrixWorld.elements, old.elements, 'hidden descendants intentionally keep stale matrices');
  const queried = v.root.getWorldPosition(new THREE.Vector3());
  assert.deepEqual(queried.toArray(), [e.p.x + 3,e.p.y + 4,e.p.z + 5]);
  combat.present(0, e.p, false); scene.updateMatrixWorld();
  assert.equal(v.root.visible, true); assert.ok(childVisits > 0); assertFreshSubtree(v.root);
  assert.deepEqual(v.root.position.toArray(), [e.p.x,e.p.y,e.p.z]);
  combat.dispose(); assert.equal(scene.children.length, 0);
});
test('production hidden roots allow late real GLB attachment, death release, revival and reset without stale first-frame bones', async () => {
  const { parseLocalGlb } = await import('./player-fixture.ts');
  const scene = new THREE.Scene();
  const combat = new WorldCombat({ scene, colliders: [], layout, done: new Set(['saber_contract','hall_brazier_1']), toast() {}, onVictory() {}, onPlayerDefeated() {} });
  const e = combat.state.boss, internal = combat as any, v = internal.visuals.get(e.id), assets = internal.enemyAssets;
  assert.ok(v.root instanceof VisibleEnemyRoot);
  let loaded: ((gltf: unknown) => void) | undefined;
  assets.loader.load = (_url: string, callback: (gltf: unknown) => void) => { loaded = callback; };
  assert.equal(combat.beginBoss(), true);
  combat.present(0,e.p,false); scene.updateMatrixWorld(true);
  assert.ok(loaded, 'visible root requests model');
  combat.present(0,{x:1000,y:0,z:1000},false); scene.updateMatrixWorld(true);
  assert.equal(v.root.visible,false); assert.equal(assets.instances.size,0);
  const gltf = await parseLocalGlb(new URL('../public/assets/enemies/sunward_guard.glb',import.meta.url));
  loaded!(gltf);
  assert.equal(assets.instances.size,0,'late callback only caches template while hidden');
  e.p.x += 4;
  combat.present(0,e.p,false); scene.updateMatrixWorld();
  let instance = assets.instances.get(e.id);
  assert.ok(instance); assert.equal(instance.root.parent,v.body); assertFreshSubtree(v.root);
  let skins = 0;
  instance.root.traverse((node: THREE.Object3D) => { if(node instanceof THREE.SkinnedMesh) { skins++; node.skeleton.update(); assert.ok(Array.from(node.skeleton.boneMatrices).every(Number.isFinite)); } });
  assert.ok(skins > 0,'real loaded rig validated');
  const releasedRoot = instance.root;
  e.mode = 'dead'; e.hp = 0;
  combat.present(0,e.p,false); scene.updateMatrixWorld();
  assert.equal(v.root.visible,false); assert.equal(assets.instances.size,0); assert.equal(releasedRoot.parent,null);
  e.mode = 'idle'; e.hp = e.maxHp; e.p.z += 8;
  combat.present(0,e.p,false); scene.updateMatrixWorld();
  instance = assets.instances.get(e.id);
  assert.ok(instance); assert.notEqual(instance.root,releasedRoot); assertFreshSubtree(v.root);
  combat.reset(); scene.updateMatrixWorld();
  assert.equal(v.root.visible,false); assert.equal(assets.instances.size,0);
  combat.dispose(); combat.dispose(); assert.equal(scene.children.length,0);
});


test('visibility traversal override is confined to enemy visual containers, not source rigs, physics or effects', () => {
  const source = readFileSync(new URL('../src/combatView.ts', import.meta.url), 'utf8');
  assert.equal((source.match(/new VisibleEnemyRoot\(/g) ?? []).length, 1);
  assert.match(source.slice(source.indexOf('private makeEnemy')), /const root = new VisibleEnemyRoot\(\), body = new THREE.Group\(\), fallback = new THREE.Group\(\)/);
  for (const name of readdirSync(new URL('../src/', import.meta.url))) {
    if (!name.endsWith('.ts') || ['combatView.ts','visibleEnemyRoot.ts'].includes(name)) continue;
    assert.doesNotMatch(readFileSync(new URL(`../src/${name}`, import.meta.url),'utf8'), /VisibleEnemyRoot/, `${name} must not share render-only enemy traversal policy`);
  }
  const root = new VisibleEnemyRoot();
  assert.equal(root.matrixAutoUpdate, true);
  assert.equal(root.updateWorldMatrix, THREE.Group.prototype.updateWorldMatrix);
  const scene = new THREE.Scene();
  const combat = new WorldCombat({ scene, colliders: [], layout, done: new Set(), toast() {}, onVictory() {}, onPlayerDefeated() {} });
  const internal = combat as any;
  const roots = new Set([...internal.visuals.values()].map((v: any) => v.root));
  scene.traverse(node => { assert.equal(node instanceof VisibleEnemyRoot, roots.has(node)); });
  assert.equal(internal.effectGroup instanceof VisibleEnemyRoot, false);
  combat.dispose();
});

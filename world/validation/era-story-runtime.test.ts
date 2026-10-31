import { campaignSourceContext } from './campaign-source-context';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transformSync } from 'esbuild';
import * as story from '../src/eraStories';
import { WorldCombatState, BOSSES } from '../src/combat';
import type { Layout } from '../src/types';

const source = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
const start = source.indexOf('function applyWorldState()');
const end = source.indexOf('// ───────────── quest guide', start);
assert.ok(start >= 0 && end > start, 'production state integration anchors exist');
const applyCode = transformSync(source.slice(start, end), { loader: 'ts' }).code;
function fixture() {
  const done = new Set<string>();
  const parts = story.ERA_IDS.map(region => ({ region, layout: JSON.parse(readFileSync(new URL(`../public/assets/world_${region}.layout.json`, import.meta.url), 'utf8')) as Layout }));
  const layout = { markers: parts.flatMap(p => p.layout.markers), objectives: parts.map(p => ({ region: p.region, objective: p.layout.objective })) };
  const bridge = { name: 'Ghost_Bridge', visible: false, userData: { showWhen: [...story.ERA_STORIES.blacksail.legacyRequires] } };
  const ice = { name: 'Ice_Gate', visible: true };
  const colliders = new Map([['COL_Ghost_Bridge', { enabled: false }], ['COL_Ice_Gate', { enabled: true }]]);
  const stateSnapshots = new Map<string, story.EraStoryState>();
  const context = vm.createContext({...campaignSourceContext,
    ...story, done, layout, hudRevision: 0, targets: [], combat: { syncWorldProgress() {} },
    eraStoryScenes: story.ERA_IDS.map(region => ({ region, applyState: (state: story.EraStoryState) => stateSnapshots.set(region, state) })),
    applyValleyStory() {}, getLanguage: () => 'en', haloMat: null,
    solids: [{ name: 'Ghost_Bridge', solidWhen: [...story.ERA_STORIES.blacksail.legacyRequires] }],
    gates: [{ name: 'Ice_Gate', opensWhen: ['frost_seal_1', 'frost_seal_2', 'frost_seal_3'] }],
    stateful: [bridge], collider: (name: string) => colliders.get(name),
    byName: (name: string) => name === 'Ghost_Bridge' ? bridge : name === 'Ice_Gate' ? ice : undefined,
    renderObjective() {},
  });
  vm.runInContext(applyCode + '\nglobalThis.apply = applyWorldState;', context);
  const core = (id: string) => layout.markers.find(m => m.id === id)!;
  return { done, apply: () => context.apply(), layout, core, bridge, ice, colliders, stateSnapshots };
}

test('production world state makes new BlackSail route visual/collision/core admission agree without optional content', () => {
  const f = fixture();
  const req = story.ERA_BOSS_REQUIREMENTS.sea_core;
  f.apply();
  assert.equal(f.bridge.visible, false); assert.equal(f.colliders.get('COL_Ghost_Bridge')!.enabled, false);
  assert.deepEqual([...f.core('sea_core').requires!], [...req]);
  req.forEach((flag, index) => {
    f.done.add(flag); f.apply();
    const expected = index === req.length - 1;
    assert.equal(f.bridge.visible, expected); assert.equal(f.colliders.get('COL_Ghost_Bridge')!.enabled, expected);
    assert.equal(f.stateSnapshots.get('blacksail')!.routeReady, expected);
  });
  assert.ok([...f.done].every(id => !id.startsWith('shard_') && !Object.values(story.ERA_OPTIONALS).some(s => s.id === id)));
  assert.equal(f.ice.visible, true); assert.equal(f.colliders.get('COL_Ice_Gate')!.enabled, true, 'optional ice gate remains seal-driven');
});

test('production state honors old readiness and contract-only completion, then restores new-game marker and bridge gates on reset', () => {
  const f = fixture();
  for (const flags of [story.ERA_STORIES.blacksail.legacyRequires, ['blackbeard_contract'], ['sea_core']]) {
    f.done.clear(); flags.forEach(id => f.done.add(id)); f.apply();
    assert.equal(f.bridge.visible, true); assert.equal(f.colliders.get('COL_Ghost_Bridge')!.enabled, true);
    assert.deepEqual([...f.core('sea_core').requires!], []);
    assert.equal(f.layout.objectives.find(o => o.region === 'blacksail')!.objective.steps.some(step => step.done.includes('blackbeard_meet')), false);
    f.done.clear(); f.apply();
    assert.equal(f.bridge.visible, false); assert.equal(f.colliders.get('COL_Ghost_Bridge')!.enabled, false);
    assert.deepEqual([...f.core('sea_core').requires!], [...story.ERA_BOSS_REQUIREMENTS.sea_core]);
    assert.equal(f.stateSnapshots.get('blacksail')!.complete, false);
  }
});

test('all four chapter requirements admit real combat without optional flags, and fresh reset restores the block', () => {
  for (const region of story.ERA_IDS) {
    const def = story.ERA_STORIES[region], boss = BOSSES.find(b => b.core === def.core)!;
    const done = new Set<string>();
    const combat = new WorldCombatState([], [{ id: boss.id, kind: 'king', p: { x: 0, y: 0, z: 0 }, requires: story.getEraBossRequirements(def.core, done) }]);
    assert.equal(combat.beginBoss(done, boss.id), false);
    story.ERA_BOSS_REQUIREMENTS[def.core].forEach(flag => done.add(flag));
    combat.setBossRequirements(boss.id, story.getEraBossRequirements(def.core, done)!);
    assert.equal(combat.beginBoss(done, boss.id), true);
    done.clear(); combat.resetAll(false); combat.setBossRequirements(boss.id, story.getEraBossRequirements(def.core, done)!);
    assert.equal(combat.beginBoss(done, boss.id), false);
  }
});

test('post-core contract-only legacy saves enter replay, never another first-clear reward', () => {
  for (const region of story.ERA_IDS.filter(id => id !== 'britain')) {
    const def = story.ERA_STORIES[region], boss = BOSSES.find(b => b.core === def.core)!;
    const done = new Set([def.contract]);
    const combat = new WorldCombatState([], [{ id: boss.id, kind: 'king', p: { x: 0, y: 0, z: 0 }, requires: story.getEraBossRequirements(def.core, done), cleared: story.isEraCoreCleared(def.core, done) }]);
    assert.equal(combat.isCleared(boss.id), true);
    assert.equal(combat.beginBoss(done, boss.id), true);
    combat.drainEvents();
    combat.hitEnemy(boss.id, 10000);
    const victory = combat.drainEvents().find(event => event.type === 'victory');
    assert.ok(victory && victory.type === 'victory');
    assert.equal(victory.firstClear, false);
  }
});

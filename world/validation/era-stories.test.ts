import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ERA_IDS, ERA_STORIES, ERA_OPTIONALS, ERA_RESIDENTS, ERA_BOSS_REQUIREMENTS,
  isEraId, getEraStoryState as state, getEraStoryGuide as guide,
  getEraBossRequirements as requirements, getEraObjective,
  applyEraMarkerRequirements, getEraPieceRequirements,
  interactEraStory as act, getEraResidentDialogue, getEraOptionalReward, ERA_KNIGHT_DEFEATED,
} from '../src/eraStories';
import type { Layout, Marker } from '../src/types';

for (const region of ERA_IDS) {
  const def = ERA_STORIES[region];
  test(`${region}: distinct mainline reaches boss without any shard or optional interaction`, () => {
    const done = new Set<string>();
    assert.equal(state(region, done).stage, 'prepare');
    assert.ok(ERA_BOSS_REQUIREMENTS[def.core].every(id => !id.startsWith('shard_')));
    let actions = 0;
    while (state(region, done).stage === 'prepare') {
      const next = guide(region, done)!;
      assert.equal(next.targetKind, 'marker');
      assert.ok(ERA_BOSS_REQUIREMENTS[def.core].includes(next.targetId));
      done.add(next.targetId);
      assert.ok(++actions < 10, 'finite forward-only route');
    }
    assert.equal(state(region, done).stage, 'challenge');
    assert.equal(guide(region, done)?.targetId, def.core);
    done.add(def.core);
    assert.equal(state(region, done).complete, true);
    if (region !== 'britain') {
      assert.equal(state(region, done).stage, 'return');
      assert.equal(guide(region, done)?.targetId, def.contract);
      done.add(def.contract);
    }
    assert.equal(state(region, done).stage, 'complete');
    assert.equal(guide(region, done), null);
    assert.equal(state(region, done).discovered, false);
  });
  test(`${region}: old ready/finished saves are read without new mandatory work or progress writes`, () => {
    const done = new Set(def.legacyRequires), snapshot = [...done];
    assert.deepEqual(requirements(def.core, done), []);
    assert.equal(state(region, done).stage, 'challenge');
    assert.equal(guide(region, done)?.targetId, def.core);
    assert.deepEqual([...done], snapshot);
    done.clear(); done.add(def.core);
    assert.equal(state(region, done).legacyComplete, true);
    assert.deepEqual(requirements(def.core, done), []);
    assert.notEqual(state(region, done).stage, 'prepare');
    if (region === 'britain') assert.equal(guide(region, done), null);
    else {
      assert.equal(guide(region, done)?.targetId, def.contract);
      done.clear(); done.add(def.contract);
      assert.equal(state(region, done).stage, 'complete');
      assert.equal(guide(region, done), null);
    }
  });
  test(`${region}: optional station persists and gives its own chapter-specific consequence`, () => {
    const done = new Set<string>(), found = new Set<string>(), optional = ERA_OPTIONALS[region];
    const initialGuide = guide(region, done);
    assert.equal(getEraOptionalReward(region, done), null);
    const first = act(optional.id, done, found);
    assert.equal(first.handled, true); assert.equal(first.changed, true);
    assert.equal(first.state?.discovered, true);
    assert.equal(first.reward?.kind, { britain: 'trial', blacksail: 'clue', winter: 'warmth', kyoto: 'quiet-route' }[region]);
    assert.deepEqual(guide(region, done), initialGuide);
    assert.equal(found.has(optional.id), true);
    const repeat = act(optional.id, done, found);
    assert.equal(repeat.changed, false);
    assert.deepEqual(repeat.reward, first.reward, 'directions/trial access/warmth are reusable, not duplicate consumable rewards');
    assert.deepEqual(guide(region, done), initialGuide);
    assert.ok([...done].every(id => !id.endsWith('_aid')), 'no duplicate generic health rewards');
    done.clear(); found.clear();
    assert.equal(state(region, done).discovered, false);
    assert.equal(getEraOptionalReward(region, done), null);
  });
  test(`${region}: residents react to live progress and use bounded flags with bilingual dialogue`, () => {
    const done = new Set<string>();
    for (const id of ERA_RESIDENTS[region]) {
      const result = act(id, done);
      assert.ok(result.dialogue?.every(line => line.length > 10));
      assert.equal(result.reward, null);
      assert.equal(act(id, done).changed, false);
    }
    assert.deepEqual([...done], [`era_${region}_met`]);
    const before = getEraResidentDialogue(def.npc, done);
    ERA_BOSS_REQUIREMENTS[def.core].forEach(id => done.add(id));
    assert.deepEqual(getEraResidentDialogue(def.npc, done), def.challenge);
    assert.notDeepEqual(before, def.challenge);
    done.add(def.core); done.add(def.contract);
    assert.deepEqual(getEraResidentDialogue(def.npc, done), def.completeText);
    assert.equal(state(region, done).legacyComplete, false);
  });
  test(`${region}: requirements and guide targets exist in unchanged generated layout`, () => {
    const layout = JSON.parse(readFileSync(new URL(`../public/assets/world_${region}.layout.json`, import.meta.url), 'utf8')) as Layout;
    const ids = new Set(layout.markers.map(m => m.id));
    for (const id of [...ERA_BOSS_REQUIREMENTS[def.core], def.core, def.contract]) assert.ok(ids.has(id), `missing ${id}`);
    for (const lang of [0, 1] as const) {
      const objective = getEraObjective(region, new Set(), lang);
      assert.ok(objective.name.length > 5);
      assert.ok(objective.steps.every(s => s.text.length > 10));
      assert.ok(objective.steps.flatMap(s => s.done).every(id => ids.has(id)));
      assert.ok(objective.steps.flatMap(s => s.done).every(id => !id.startsWith('shard_')));
    }
  });
}

test('Britain contract is an opening oath, never proof of boss victory', () => {
  const done = new Set(['saber_contract']);
  assert.equal(state('britain', done).complete, false);
  assert.equal(guide('britain', done)?.targetId, 'hall_brazier_1');
  assert.ok(requirements('sun_core', done)!.length > 0);
});

test('core marker and ghost bridge policies agree on fresh, progressed, legacy, finished, and reset saves', () => {
  const core: Marker = { id: 'sea_core', type: 'interact', label: 'Core', p: [0,0,0], requires: ['old'] };
  const other: Marker = { id: 'unrelated', type: 'interact', label: 'Other', p: [0,0,0], requires: ['unchanged'] };
  const done = new Set<string>();
  for (const flags of [[], ERA_BOSS_REQUIREMENTS.sea_core, ERA_STORIES.blacksail.legacyRequires, ['sea_core'], ['blackbeard_contract'], []]) {
    done.clear(); flags.forEach(f => done.add(f));
    applyEraMarkerRequirements([core, other], done);
    assert.deepEqual(core.requires, requirements('sea_core', done));
    assert.deepEqual(getEraPieceRequirements('Ghost_Bridge', done), core.requires);
    assert.deepEqual(getEraPieceRequirements('COL_Ghost_Bridge', done), core.requires);
    assert.deepEqual(other.requires, ['unchanged']);
  }
  assert.equal(getEraPieceRequirements('Ice_Gate', done), undefined);
  assert.equal(requirements('unknown_core', done), undefined);
});

test('unknown regions/interactions and Valley-owned interactions are not intercepted', () => {
  assert.equal(isEraId('alpha'), false); assert.equal(isEraId('constructor'), false);
  assert.equal(isEraId('kyoto'), true);
  const done = new Set<string>();
  for (const id of ['', 'hq_terminal', 'alpha_archivist', 'sun_core', 'hall_brazier_1', '__proto__']) {
    assert.equal(act(id, done).handled, false);
    assert.equal(getEraResidentDialogue(id, done), null);
  }
  assert.equal(done.size, 0);
});

test('mainline reactions distinguish oath hearth and optional shards and are bilingual', async () => {
  const { getEraProgressReaction: react } = await import('../src/eraStories');
  for (const region of ERA_IDS) {
    const done = new Set(ERA_BOSS_REQUIREMENTS[ERA_STORIES[region].core]);
    for (const id of done) assert.ok(react(id, done)?.every(line => line.length > 5));
    for (const shard of ERA_STORIES[region].legacyRequires.filter(id => id.startsWith('shard_'))) {
      assert.match(react(shard, done)![1], /optional/);
    }
  }
  assert.match(react('hall_brazier_1', new Set(['hall_brazier_1']))![1], /other hearths.*optional/);
  assert.match(react('hall_brazier_2', new Set())![1], /optional/);
  assert.equal(react('range_target_1', new Set()), null);
});


test('harbor signal advances only optional treasure clues, never marks fragments collected', () => {
  const done = new Set(['blacksail_harbor_signal']);
  for (const id of ['map_piece_1', 'map_piece_2', 'map_piece_3', 'shard_treasure']) {
    const clue = getEraOptionalReward('blacksail', done);
    assert.equal(clue?.kind, 'clue');
    assert.equal(clue?.kind === 'clue' && clue.targetId, id);
    assert.equal(done.has(id), false);
    done.add(id);
  }
  assert.equal(getEraOptionalReward('blacksail', done), null);
  assert.equal(state('blacksail', done).routeReady, false);
});

test('optional knight victory changes memorial dialogue without granting a core or contract', () => {
  const done = new Set(['britain_memorial', ERA_KNIGHT_DEFEATED]);
  const result = act('britain_memorial', done);
  assert.match(result.dialogue![1], /trial is won/);
  assert.equal(result.reward?.kind, 'trial');
  assert.equal(state('britain', done).complete, false);
  assert.equal(done.has('saber_contract'), false);
});

test('each settlement resident has a distinct practical role rather than a shared exposition loop', () => {
  for (const region of ERA_IDS) {
    const dialogue = ERA_RESIDENTS[region].map(id => getEraResidentDialogue(id, new Set())![1]);
    assert.equal(new Set(dialogue).size, dialogue.length);
  }
});

test('combat clear-state adapter shares legacy contract authority, except opening Saber pact', async () => {
  const { isEraCoreCleared } = await import('../src/eraStories');
  for (const region of ERA_IDS) {
    const def = ERA_STORIES[region];
    assert.equal(isEraCoreCleared(def.core, new Set([def.contract])), region !== 'britain');
    assert.equal(isEraCoreCleared(def.core, new Set([def.core])), true);
  }
  assert.equal(isEraCoreCleared('unknown', new Set()), undefined);
});

test('story uses bounded existing progress flags and reset clears visible optional outcomes', async () => {
  const { WorldProgress, WORLD_PROGRESS_KEY } = await import('../src/progress');
  const storage = new Map<string, string>();
  const backing = { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => { storage.set(key, value); } };
  const progress = new WorldProgress(backing);
  for (let i = 0; i < 100; i++) for (const region of ERA_IDS) {
    for (const resident of ERA_RESIDENTS[region]) act(resident, progress.done, progress.found);
    act(ERA_OPTIONALS[region].id, progress.done, progress.found);
  }
  assert.equal(progress.done.size, 8, 'four fixed met flags and four optional flags');
  assert.equal(progress.found.size, 4);
  assert.equal(progress.save(), true);
  assert.deepEqual(Object.keys(JSON.parse(storage.get(WORLD_PROGRESS_KEY)!)).sort(), ['done', 'found']);
  const restored = new WorldProgress(backing);
  for (const region of ERA_IDS) {
    assert.equal(state(region, restored.done).discovered, true);
    assert.equal(state(region, restored.done).routeReady, false);
  }
  restored.reset();
  const empty = new WorldProgress(backing);
  assert.equal(empty.done.size, 0); assert.equal(empty.found.size, 0);
  for (const region of ERA_IDS) assert.equal(state(region, empty.done).discovered, false);
});

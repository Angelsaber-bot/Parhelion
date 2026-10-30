import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transformSync } from 'esbuild';
import { interactEraStory } from '../src/eraStories';
import { WorldProgress } from '../src/progress';

// Execute the unchanged production adapter, not a reimplementation of reward routing.
const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
const start = main.indexOf('function handleEraInteraction('), end = main.indexOf('function interact()', start);
assert.ok(start >= 0 && end > start);
const adapter = transformSync(main.slice(start, end) + '\nglobalThis.interact = handleEraInteraction;', { loader: 'ts' }).code;
function fixture(flags: string[]) {
  const data = new Map<string, string>();
  const progress = new WorldProgress({ getItem: key => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value); } });
  flags.forEach(flag => progress.done.add(flag));
  let saves = 0, refreshes = 0, trials = 0;
  const lines: string[][] = [];
  const context = vm.createContext({
    interactEraStory, done: progress.done, found: progress.found, optionalPin: null, hudRevision: 0,
    cold: { warmth: 21, reserve: 0 },
    markers: new Map(['map_piece_1', 'map_piece_2', 'map_piece_3', 'shard_treasure'].map((id, i) => [id, { id, p: [i * 10, 1, 5] }])),
    combat: { startOptionalTrial() { trials++; }, state: { enemies: [] } },
    save() { saves++; return progress.save(); }, applyWorldState() { refreshes++; },
    speakDialogue(line: string[]) { lines.push(line); },
  });
  vm.runInContext(adapter, context);
  return { context, progress, data, lines, counts: () => ({ saves, refreshes, trials }) };
}

test('production resident adapter restores an earned treasure pin after dismissal and chooses the next actual uncollected marker', () => {
  const f = fixture(['era_blacksail_met', 'blacksail_harbor_signal']);
  const before = [...f.progress.done];
  assert.equal(f.context.interact('customs_runner'), true);
  assert.equal(f.context.optionalPin.targetId, 'map_piece_1');
  f.context.optionalPin = null; // closing a detour or traveling discarded the temporary pin
  f.progress.done.add('map_piece_1');
  f.context.interact('customs_runner');
  assert.equal(f.context.optionalPin.targetId, 'map_piece_2');
  assert.deepEqual([...f.context.optionalPin.p], [10, 1, 5]);
  assert.deepEqual(f.counts(), { saves: 0, refreshes: 0, trials: 0 });
  assert.deepEqual([...f.progress.done], [...before, 'map_piece_1']);
  f.progress.done.add('shard_treasure'); f.context.optionalPin = null;
  f.context.interact('customs_runner');
  assert.equal(f.context.optionalPin, null);
  assert.match(f.lines.at(-1)![1], /found the chest/);
});

test('production Kyoto resident can restore a lost route but never replaces it after banner or legacy completion', () => {
  const f = fixture(['era_kyoto_met', 'kyoto_lantern_route']);
  f.context.interact('kyoto_innkeeper');
  assert.equal(f.context.optionalPin.region, 'kyoto');
  assert.deepEqual([...f.context.optionalPin.p], [-224, 11.56, 840]);
  f.context.optionalPin = null;
  f.context.interact('kyoto_innkeeper');
  assert.equal(f.context.optionalPin.region, 'kyoto');
  f.progress.done.add('musashi_contract'); f.context.optionalPin = null;
  f.context.interact('kyoto_innkeeper');
  assert.equal(f.context.optionalPin, null);
  assert.deepEqual(f.counts(), { saves: 0, refreshes: 0, trials: 0 });
});

test('production conversations preserve physical reward ownership and saved scene refresh semantics', () => {
  const f = fixture(['era_winter_met', 'era_britain_met', 'winter_shelter_stove', 'britain_memorial', 'era_britain_knight_defeated']);
  for (let i = 0; i < 10; i++) {
    f.context.interact('winter_surgeon'); f.context.interact('britain_smith');
  }
  assert.equal(f.context.cold.warmth, 21); assert.equal(f.context.cold.reserve, 0);
  assert.deepEqual(f.counts(), { saves: 0, refreshes: 0, trials: 0 });
  f.context.interact('winter_shelter_stove');
  assert.equal(f.context.cold.warmth, 70); assert.equal(f.context.cold.reserve, 30);
  assert.deepEqual(f.counts(), { saves: 1, refreshes: 1, trials: 0 }, 'first discovery is saved even when old done state already exists');
  f.context.interact('winter_shelter_stove');
  assert.deepEqual(f.counts(), { saves: 1, refreshes: 1, trials: 0 }, 'repeat warmth does not rewrite progress or reapply the scene');
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WorldProgress, WORLD_PROGRESS_KEY, LEGACY_WORLD_PROGRESS_KEYS, parseProgressBackup, type ProgressStorage } from '../src/progress';

function storage() {
  const values = new Map<string, string>();
  return { values, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
}
test('save status distinguishes unavailable, malformed, failed and successful persistence without losing live flags', () => {
  assert.equal(new WorldProgress().persistence, 'unavailable');
  const memory = storage(); memory.values.set(WORLD_PROGRESS_KEY, '{broken');
  assert.equal(new WorldProgress(memory).persistence, 'invalid');
  let fails = true;
  const adapter: ProgressStorage = { ...memory, setItem(key, value) { if (fails) throw new Error('quota'); memory.setItem(key, value); } };
  const progress = new WorldProgress(adapter); progress.done.add('episode_one');
  const states: string[] = []; const unsubscribe = progress.subscribe(() => states.push(progress.persistence));
  assert.equal(progress.save(), false); assert.equal(progress.done.has('episode_one'), true);
  assert.equal(memory.getItem(WORLD_PROGRESS_KEY), '{broken');
  fails = false; assert.equal(progress.save(), true);
  assert.deepEqual(states, ['failed', 'saved']);
  unsubscribe(); progress.save(); assert.equal(states.length, 2);
  assert.equal(new WorldProgress(memory).done.has('episode_one'), true);
});
test('download snapshot contains quest flags only, and round-trip restore preserves live set identity and preferences', () => {
  const memory = storage(), progress = new WorldProgress(memory);
  memory.values.set('controls', 'custom'); progress.done.add('armory_rack'); progress.found.add('travel_alpha');
  const snapshot = progress.exportSnapshot(), done = progress.done, found = progress.found;
  progress.done.add('later');
  assert.equal(progress.restoreSnapshot(snapshot), 'restored');
  assert.equal(progress.done, done); assert.equal(progress.found, found);
  assert.deepEqual([...done], ['armory_rack']); assert.deepEqual([...found], ['travel_alpha']);
  assert.equal(memory.values.get('controls'), 'custom');
  assert.deepEqual(JSON.parse(snapshot), { done: ['armory_rack'], found: ['travel_alpha'] });
});
test('failed or malformed restore leaves both current save and live progress unchanged', () => {
  const memory = storage(); memory.setItem(WORLD_PROGRESS_KEY, JSON.stringify({ done: ['old'], found: [] }));
  const progress = new WorldProgress({ ...memory, setItem() { throw new Error('blocked'); } });
  assert.equal(progress.restoreSnapshot('{bad'), 'invalid');
  assert.equal(progress.restoreSnapshot(JSON.stringify({ done: ['new'], found: [] })), 'unavailable');
  assert.deepEqual([...progress.done], ['old']);
  assert.deepEqual(JSON.parse(memory.getItem(WORLD_PROGRESS_KEY)!).done, ['old']);
  assert.equal(new WorldProgress().restoreSnapshot('{"done":[],"found":[]}'), 'unavailable');
});
test('backup validation rejects oversized or malformed values, deduplicates valid flags and never imports arbitrary fields', () => {
  for (const value of [null, [], {}, { done: [], found: null }, { done: [1], found: [] }, { done: [''], found: [] }, { done: ['x'.repeat(161)], found: [] }, { done: ['a\n'], found: [] }, { done: Array(8193).fill('a'), found: [] }]) assert.equal(parseProgressBackup(JSON.stringify(value)), null);
  assert.equal(parseProgressBackup(' '.repeat(262145)), null);
  assert.deepEqual(parseProgressBackup('{"done":["a","a"],"found":["b"],"position":[99,2,3],"armed":true}'), { done: ['a'], found: ['b'] });
});
test('presentation observer exceptions cannot turn a committed save into a failed gameplay action', () => {
  const progress = new WorldProgress(storage()); progress.subscribe(() => { throw new Error('UI failure'); });
  assert.equal(progress.save(), true); assert.equal(progress.persistence, 'saved');
});

test('unrecognized current snapshots stay invalid and never revive legacy progress', () => {
  for (const raw of ['null', 'true', '42', '[]', '{}', '{"done":"not-flags","found":null}']) {
    const memory = storage(); memory.setItem(WORLD_PROGRESS_KEY, raw);
    memory.setItem(LEGACY_WORLD_PROGRESS_KEYS[0], '{"done":["armory_rack"],"found":[]}');
    const progress = new WorldProgress(memory);
    assert.equal(progress.persistence, 'invalid'); assert.equal(progress.armed, false);
    assert.equal(memory.getItem(WORLD_PROGRESS_KEY), raw);
  }
});
test('malformed legacy-only slots are not silently replaced by an empty migration', () => {
  for (const raw of ['{broken', 'null', '{}']) {
    const memory = storage(); memory.setItem(LEGACY_WORLD_PROGRESS_KEYS[0], raw);
    const progress = new WorldProgress({ ...memory, removeItem(key) { memory.values.delete(key); } });
    assert.equal(progress.persistence, 'invalid'); assert.equal(memory.getItem(WORLD_PROGRESS_KEY), null);
    assert.equal(memory.getItem(LEGACY_WORLD_PROGRESS_KEYS[0]), raw);
  }
  const memory = storage(); memory.setItem(LEGACY_WORLD_PROGRESS_KEYS[0], '{"done":["armory_rack",4,null]}');
  const migrated = new WorldProgress(memory); assert.equal(migrated.armed, true); assert.equal(migrated.persistence, 'saved');
});

test('a valid legacy region can migrate without deleting an unreadable sibling record', () => {
  const memory = storage(), bad = LEGACY_WORLD_PROGRESS_KEYS[0], good = LEGACY_WORLD_PROGRESS_KEYS[1];
  memory.setItem(bad, '{broken'); memory.setItem(good, '{"done":["sea_core"],"found":[]}');
  const progress = new WorldProgress({ ...memory, removeItem(key) { memory.values.delete(key); } });
  assert.ok(progress.done.has('sea_core')); assert.equal(memory.getItem(bad), '{broken'); assert.equal(memory.getItem(good), null);
  progress.save(); assert.equal(memory.getItem(bad), '{broken');
  new WorldProgress({ ...memory, removeItem(key) { memory.values.delete(key); } }).save(); assert.equal(memory.getItem(bad), '{broken', 'ordinary saves after reload preserve malformed recovery evidence');
  progress.reset(); assert.equal(memory.getItem(bad), null, 'explicit new game may remove superseded recovery records');
});

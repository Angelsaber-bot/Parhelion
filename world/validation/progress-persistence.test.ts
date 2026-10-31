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
  assert.equal(progress.saveBlocked, true);
  assert.equal(progress.restoreSnapshot(progress.exportSnapshot()), 'unavailable');
  fails = false; assert.equal(progress.restoreSnapshot(progress.exportSnapshot()), 'restored');
  assert.deepEqual(states, ['invalid', 'failed', 'saved']);
  unsubscribe(); progress.save(); assert.equal(states.length, 3);
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

test('ordinary autosaves never overwrite unreadable current bytes before explicit replacement', () => {
  const memory = storage(), raw = '{important broken original'; memory.setItem(WORLD_PROGRESS_KEY, raw);
  let writes = 0, blocked = false;
  const adapter = { ...memory, setItem(key: string, value: string) { writes++; if (blocked) throw new Error('quota'); memory.setItem(key, value); } };
  const progress = new WorldProgress(adapter); progress.done.add('new_session_work');
  for (let i = 0; i < 20; i++) assert.equal(progress.save(), false);
  assert.equal(writes, 0); assert.equal(memory.getItem(WORLD_PROGRESS_KEY), raw); assert.equal(progress.exportUnreadableSnapshot(), raw);
  blocked = true; const currentSession = progress.exportSnapshot();
  assert.equal(progress.restoreSnapshot(currentSession), 'unavailable'); assert.equal(progress.saveBlocked, true);
  assert.equal(memory.getItem(WORLD_PROGRESS_KEY), raw); assert.ok(progress.done.has('new_session_work'));
  blocked = false; assert.equal(progress.restoreSnapshot(currentSession), 'restored'); assert.equal(progress.saveBlocked, false);
  assert.equal(progress.exportUnreadableSnapshot(), null); assert.ok(new WorldProgress(memory).done.has('new_session_work'));
});
test('explicit new game authorizes replacement retries, while failed initial reads block blind autosave', () => {
  const memory = storage(); memory.setItem(WORLD_PROGRESS_KEY, '{broken'); let quota = true;
  const adapter = { ...memory, setItem(key: string, value: string) { if (quota) throw new Error('quota'); memory.setItem(key, value); } };
  const progress = new WorldProgress(adapter); assert.equal(progress.reset(), false); assert.equal(memory.getItem(WORLD_PROGRESS_KEY), '{broken');
  quota = false; assert.equal(progress.save(), true); assert.deepEqual(JSON.parse(memory.getItem(WORLD_PROGRESS_KEY)!), { done: [], found: [] });
  let writes = 0; const inaccessible = new WorldProgress({ getItem() { throw new Error('read denied'); }, setItem() { writes++; } });
  assert.equal(inaccessible.save(), false); assert.equal(writes, 0); assert.equal(inaccessible.persistence, 'unavailable');
  assert.equal(inaccessible.restoreSnapshot('{"done":[],"found":[]}'), 'restored'); assert.equal(writes, 1);
});


test('partially malformed CURRENT records preserve readable flags and exact original until guarded repair', () => {
  for (const value of [
    { done: ['armory_rack', 42, null], found: ['future_discovery'] },
    { done: ['armory_rack'], found: 'not-an-array' },
    { done: ['armory_rack', ''], found: [] },
  ]) {
    const memory = storage(), raw = JSON.stringify(value); memory.setItem(WORLD_PROGRESS_KEY, raw);
    memory.setItem(LEGACY_WORLD_PROGRESS_KEYS[0], '{"done":["legacy_should_not_return"],"found":[]}');
    const progress = new WorldProgress(memory);
    assert.equal(progress.armed, true); assert.equal(progress.done.has('legacy_should_not_return'), false);
    assert.equal(progress.persistence, 'invalid'); assert.equal(progress.saveBlocked, true);
    assert.equal(progress.save(), false); assert.equal(memory.getItem(WORLD_PROGRESS_KEY), raw);
    assert.equal(progress.exportUnreadableSnapshot(), raw);
    const expected = progress.captureStoredSnapshot()!;
    memory.setItem(WORLD_PROGRESS_KEY, '{"done":["new_tab"],"found":[]}');
    assert.equal(progress.restoreSnapshot(progress.exportSnapshot(), expected), 'conflict');
    assert.equal(progress.armed, true); assert.match(memory.getItem(WORLD_PROGRESS_KEY)!, /new_tab/);
    memory.setItem(WORLD_PROGRESS_KEY, raw);
    assert.equal(progress.restoreSnapshot(progress.exportSnapshot(), expected), 'restored');
    assert.equal(progress.saveBlocked, false); assert.equal(new WorldProgress(memory).armed, true);
  }
});
test('forward-compatible CURRENT flags, duplicates, optional arrays and newer fields do not require repair', () => {
  for (const value of [
    { done: ['future_quest_2030', 'future_quest_2030'], found: ['新发现'], newer: { unsupported: true } },
    { done: [], futureInventory: { arbitrary: ['data'] } },
    { found: ['unknown_discovery'], version: 7 },
  ]) {
    const memory = storage(); memory.setItem(WORLD_PROGRESS_KEY, JSON.stringify(value));
    const progress = new WorldProgress(memory);
    assert.equal(progress.saveBlocked, false); assert.equal(progress.persistence, 'ready');
    assert.equal(progress.exportUnreadableSnapshot(), null); assert.equal(progress.save(), true);
    if ('done' in value && value.done?.length) assert.ok(progress.done.has('future_quest_2030'));
    if ('found' in value) assert.ok(progress.found.has(value.found![0]));
  }
});

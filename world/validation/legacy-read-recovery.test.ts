import test from 'node:test';
import assert from 'node:assert/strict';
import { WorldProgress, WORLD_PROGRESS_KEY, LEGACY_WORLD_PROGRESS_KEYS } from '../src/progress';

for (const failingIndex of [0, 1]) test(`legacy read failure ${failingIndex} preserves both original records until complete migration`, () => {
  const raw = ['{"done":["armory_rack","unknown_alpha"],"found":["rare_alpha"]}', '{"done":["sea_core","unknown_coast"],"found":["rare_coast"]}'];
  const values = new Map(LEGACY_WORLD_PROGRESS_KEYS.map((key, i) => [key as string, raw[i]]));
  let readFails = true, quota = false, writes = 0;
  const storage = {
    getItem(key: string) { if (readFails && key === LEGACY_WORLD_PROGRESS_KEYS[failingIndex]) throw new Error('transient selective read failure'); return values.get(key) ?? null; },
    setItem(key: string, value: string) { writes++; if (quota) throw new Error('quota'); values.set(key, value); },
    removeItem(key: string) { values.delete(key); },
  };
  const partial = new WorldProgress(storage);
  assert.equal(partial.saveBlocked, true); assert.equal(partial.persistence, 'unavailable');
  assert.ok(partial.done.has(failingIndex === 0 ? 'sea_core' : 'armory_rack'));
  partial.done.add('new_session_progress');
  for (let i = 0; i < 10; i++) assert.equal(partial.save(), false);
  assert.equal(writes, 0); assert.equal(values.has(WORLD_PROGRESS_KEY), false);
  for (let i = 0; i < 2; i++) assert.equal(values.get(LEGACY_WORLD_PROGRESS_KEYS[i]), raw[i]);
  readFails = false; quota = true;
  const recoveredButFull = new WorldProgress(storage);
  assert.ok(recoveredButFull.armed && recoveredButFull.done.has('sea_core'));
  assert.equal(recoveredButFull.persistence, 'failed');
  for (let i = 0; i < 2; i++) assert.equal(values.get(LEGACY_WORLD_PROGRESS_KEYS[i]), raw[i]);
  quota = false; assert.equal(recoveredButFull.save(), true);
  assert.deepEqual(new Set(JSON.parse(values.get(WORLD_PROGRESS_KEY)!).done), new Set(['armory_rack', 'unknown_alpha', 'sea_core', 'unknown_coast']));
  assert.deepEqual(new Set(JSON.parse(values.get(WORLD_PROGRESS_KEY)!).found), new Set(['rare_alpha', 'rare_coast']));
  assert.equal(values.has(LEGACY_WORLD_PROGRESS_KEYS[0]), false); assert.equal(values.has(LEGACY_WORLD_PROGRESS_KEYS[1]), false);
});

test('explicit reset or guarded import can replace an incomplete migration without deleting unread bytes implicitly', () => {
  for (const action of ['reset', 'import']) {
    const values = new Map<string, string>([[LEGACY_WORLD_PROGRESS_KEYS[0], 'original-unread-bytes']]);
    const storage = { getItem(key: string) { if (key === LEGACY_WORLD_PROGRESS_KEYS[0]) throw new Error('blocked'); return values.get(key) ?? null; }, setItem(key: string, value: string) { values.set(key, value); }, removeItem(key: string) { values.delete(key); } };
    const progress = new WorldProgress(storage); assert.equal(progress.saveBlocked, true);
    if (action === 'reset') { assert.equal(progress.reset(), true); assert.equal(values.has(LEGACY_WORLD_PROGRESS_KEYS[0]), false); }
    else { const expected = progress.captureStoredSnapshot()!; assert.equal(progress.restoreSnapshot('{"done":["chosen_backup"],"found":[]}', expected), 'restored'); assert.equal(values.get(LEGACY_WORLD_PROGRESS_KEYS[0]), 'original-unread-bytes'); }
    assert.equal(progress.saveBlocked, false);
  }
});

test('malformed plus unread legacy stays unavailable, while failed replacement preserves raw records and recovered flags', () => {
  for (const sibling of ['{broken', '{"done":["sea_core"],"found":["old_discovery"]}']) {
    const raw = 'unread-original';
    const values = new Map<string, string>([[LEGACY_WORLD_PROGRESS_KEYS[0], raw], [LEGACY_WORLD_PROGRESS_KEYS[1], sibling]]);
    const storage = { getItem(key: string) { if (key === LEGACY_WORLD_PROGRESS_KEYS[0]) throw new Error('blocked'); return values.get(key) ?? null; }, setItem() { throw new Error('quota'); }, removeItem(key: string) { values.delete(key); } };
    const progress = new WorldProgress(storage), before = progress.exportSnapshot();
    assert.equal(progress.persistence, 'unavailable'); assert.equal(progress.saveBlocked, true);
    assert.equal(progress.restoreSnapshot('{"done":["replacement"],"found":[]}', progress.captureStoredSnapshot()!), 'unavailable');
    assert.equal(progress.exportSnapshot(), before); assert.equal(progress.saveBlocked, true);
    assert.equal(progress.save(), false); assert.equal(progress.persistence, 'unavailable');
    assert.equal(values.get(LEGACY_WORLD_PROGRESS_KEYS[0]), raw); assert.equal(values.get(LEGACY_WORLD_PROGRESS_KEYS[1]), sibling);
    assert.equal(values.has(WORLD_PROGRESS_KEY), false);
  }
});

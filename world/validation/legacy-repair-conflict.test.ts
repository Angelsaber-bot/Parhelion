import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { WorldProgress, WORLD_PROGRESS_KEY, LEGACY_WORLD_PROGRESS_KEYS } from '../src/progress';
import { createProgressPanel } from '../src/progressPanel';
import { setLanguage } from '../../shared-client/i18n';

for (const timing of ['before', 'confirm', 'unchanged', 'quota', 'read'] as const) test(`partial legacy repair ${timing} respects the originally absent current slot`, () => {
  const previous = new Map(['window', 'document'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const dom = new JSDOM('<!doctype html><body></body>');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: dom.window });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: dom.window.document });
  const legacy = ['unread-original', '{"done":["sea_core"],"found":["old_discovery"]}'];
  const values = new Map<string, string>(LEGACY_WORLD_PROGRESS_KEYS.map((key, i) => [key, legacy[i]]));
  const newer = '{"done":["newer_tab_quest"],"found":["newer_discovery"]}';
  let readFails = false, quota = false, writes = 0, confirms = 0, restored = 0;
  const progress = new WorldProgress({
    getItem(key) { if (key === LEGACY_WORLD_PROGRESS_KEYS[0] || (readFails && key === WORLD_PROGRESS_KEY)) throw Error('read blocked'); return values.get(key) ?? null; },
    setItem(key, raw) { writes++; if (quota) throw Error('quota'); values.set(key, raw); },
    removeItem(key) { values.delete(key); },
  });
  const initial = progress.exportSnapshot(), panel = createProgressPanel(progress, () => restored++);
  dom.window.document.body.append(panel.root); setLanguage('en');
  try {
    if (timing === 'before') values.set(WORLD_PROGRESS_KEY, newer);
    if (timing === 'quota') quota = true;
    if (timing === 'read') readFails = true;
    dom.window.confirm = () => { confirms++; if (timing === 'confirm') values.set(WORLD_PROGRESS_KEY, newer); return true; };
    [...panel.root.querySelectorAll<HTMLButtonElement>('button')].find(button => /Replace with session/.test(button.textContent!))!.click();
    assert.equal(confirms, timing === 'before' || timing === 'read' ? 0 : 1);
    assert.equal(restored, timing === 'unchanged' ? 1 : 0);
    assert.equal(writes, timing === 'unchanged' || timing === 'quota' ? 1 : 0);
    assert.equal(progress.exportSnapshot(), initial);
    assert.equal(values.get(WORLD_PROGRESS_KEY), timing === 'before' || timing === 'confirm' ? newer : timing === 'unchanged' ? initial : undefined);
    for (let i = 0; i < 2; i++) assert.equal(values.get(LEGACY_WORLD_PROGRESS_KEYS[i]), legacy[i]);
    if (timing === 'before') assert.match(panel.root.textContent!, /reload.*review/i);
  } finally {
    panel.dispose(); setLanguage('zh'); dom.window.close();
    for (const [key, value] of previous) { if (value) Object.defineProperty(globalThis, key, value); else Reflect.deleteProperty(globalThis, key); }
  }
});

test('stale session repair rejection does not prohibit deliberate backup import or reset', () => {
  for (const action of ['import', 'reset']) {
    const values = new Map<string, string>();
    const progress = new WorldProgress({ getItem(key) { if (key === LEGACY_WORLD_PROGRESS_KEYS[0]) throw Error('unread legacy'); return values.get(key) ?? null; }, setItem(key, raw) { values.set(key, raw); } });
    values.set(WORLD_PROGRESS_KEY, '{"done":["new_tab"],"found":[]}');
    const expected = progress.captureStoredSnapshot()!;
    assert.equal(progress.repairSnapshotMatchesOriginal(expected), false);
    if (action === 'import') assert.equal(progress.restoreSnapshot('{"done":["chosen_backup"],"found":[]}', expected), 'restored');
    else assert.equal(progress.reset(), true);
    assert.deepEqual(JSON.parse(values.get(WORLD_PROGRESS_KEY)!).done, action === 'import' ? ['chosen_backup'] : []);
  }
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { WorldProgress, WORLD_PROGRESS_KEY } from '../src/progress';
import { createProgressPanel } from '../src/progressPanel';
import { setLanguage } from '../../shared-client/i18n';

function fixture(initialRaw?: string) {
  const previous = new Map(['window', 'document'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://example.test/' });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: dom.window });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: dom.window.document });
  if (initialRaw !== undefined) dom.window.localStorage.setItem(WORLD_PROGRESS_KEY, initialRaw);
  const progress = new WorldProgress(dom.window.localStorage); progress.done.add('existing'); progress.save();
  let restored = 0, confirmations = 0, accept = false;
  dom.window.confirm = () => { confirmations++; return accept; };
  const panel = createProgressPanel(progress, () => restored++); dom.window.document.body.append(panel.root);
  const file = panel.root.querySelector('input')!;
  return { dom, progress, panel, get restored() { return restored; }, get confirmations() { return confirmations; }, accept() { accept = true; },
    async select(raw: string, size = raw.length) {
      Object.defineProperty(file, 'files', { configurable: true, value: [{ size, text: async () => raw }] });
      file.dispatchEvent(new dom.window.Event('change')); await new Promise(resolve => setTimeout(resolve, 0));
    },
    close() { panel.dispose(); setLanguage('zh'); dom.window.close(); for (const [key, value] of previous) { if (value) Object.defineProperty(globalThis, key, value); else Reflect.deleteProperty(globalThis, key); } },
  };
}
test('restore requires a validated local file and explicit confirmation, then persists before reloading', async () => {
  const f = fixture();
  try {
    await f.select('{bad'); assert.equal(f.confirmations, 0); assert.equal(f.restored, 0);
    await f.select('{"done":[],"found":[]}', 300000); assert.equal(f.confirmations, 0);
    await f.select('{"done":["episode_restored"],"found":[]}');
    assert.equal(f.confirmations, 1); assert.equal(f.restored, 0); assert.deepEqual([...f.progress.done], ['existing']);
    f.accept(); await f.select('{"done":["episode_restored"],"found":[]}');
    assert.equal(f.restored, 1); assert.deepEqual([...f.progress.done], ['episode_restored']);
    assert.deepEqual(JSON.parse(f.dom.window.localStorage.getItem(WORLD_PROGRESS_KEY)!).done, ['episode_restored']);
  } finally { f.close(); }
});
test('storage warnings refresh with locale and successful retry, and disposal unsubscribes presentation', () => {
  const f = fixture();
  try {
    // Model unavailable storage without replacing the actual progress observer.
    Object.defineProperty(f.dom.window.Storage.prototype, 'setItem', { configurable: true, value() { throw new Error('quota'); } });
    assert.equal(f.progress.save(), false);
    const warning = f.dom.window.document.getElementById('world-save-warning')!;
    assert.equal(warning.hidden, false); setLanguage('en'); assert.match(warning.textContent!, /not saved/);
    f.panel.dispose(); f.panel.dispose(); assert.equal(warning.isConnected, false); assert.equal(f.panel.root.isConnected, false);
    f.progress.save(); setLanguage('zh'); assert.equal(f.dom.window.document.body.children.length, 0);
  } finally { f.close(); }
});
test('a file read finishing after page disposal cannot confirm or replace progress', async () => {
  const f = fixture();
  try {
    let finish!: (value: string) => void;
    const pending = new Promise<string>(resolve => { finish = resolve; });
    const file = f.panel.root.querySelector('input')!;
    Object.defineProperty(file, 'files', { value: [{ size: 30, text: () => pending }] });
    file.dispatchEvent(new f.dom.window.Event('change')); f.panel.dispose();
    finish('{"done":[],"found":[]}'); await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(f.confirmations, 0); assert.equal(f.restored, 0); assert.deepEqual([...f.progress.done], ['existing']);
  } finally { f.close(); }
});
test('a newer file selection supersedes an older asynchronous read instead of restoring stale progress', async () => {
  const f = fixture();
  try {
    let finish!: (value: string) => void;
    const pending = new Promise<string>(resolve => { finish = resolve; });
    const file = f.panel.root.querySelector('input')!;
    Object.defineProperty(file, 'files', { configurable: true, value: [{ size: 30, text: () => pending }] });
    file.dispatchEvent(new f.dom.window.Event('change')); f.accept();
    await f.select('{"done":["newest"],"found":[]}');
    finish('{"done":["stale"],"found":[]}'); await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(f.confirmations, 1); assert.equal(f.restored, 1); assert.deepEqual([...f.progress.done], ['newest']);
  } finally { f.close(); }
});

test('retained controls cannot save, download or reopen a picker after disposal', () => {
  const f = fixture(); const originalUrl = URL.createObjectURL;
  try {
    const buttons = [...f.panel.root.querySelectorAll('button')];
    const file = f.panel.root.querySelector('input')!;
    let saves = 0, downloads = 0, pickers = 0;
    f.progress.save = () => { saves++; return true; };
    URL.createObjectURL = () => { downloads++; return 'blob:test'; };
    file.click = () => { pickers++; };
    f.panel.dispose();
    for (const button of buttons) button.click();
    assert.deepEqual({ saves, downloads, pickers }, { saves: 0, downloads: 0, pickers: 0 });
  } finally { URL.createObjectURL = originalUrl; f.close(); }
});

test('unreadable-save status is visible before the user opens settings', () => {
  const f = fixture();
  try {
    f.progress.persistence = 'invalid'; setLanguage('en');
    const warning = f.dom.window.document.getElementById('world-save-warning')!;
    assert.equal(warning.hidden, false); assert.match(warning.textContent!, /Existing save unreadable/);
    f.progress.save(); assert.equal(warning.hidden, true);
  } finally { f.close(); }
});


test('protected current-save repair is explicit, quota-safe and retains an inert exact original download', async () => {
  const raw = '<script>not executable</script>{broken' + String.fromCharCode(0xd800, 65, 0xdc00); const f = fixture(raw);
  const oldCreate = URL.createObjectURL, oldRevoke = URL.revokeObjectURL;
  try {
    setLanguage('en');
    assert.equal(f.progress.saveBlocked, true);
    assert.match(f.panel.root.textContent!, /session is not saved/);
    assert.equal(f.panel.root.querySelector('script'), null);
    const [repair,,, original] = [...f.panel.root.querySelectorAll('button')];
    let blob: Blob | undefined;
    URL.createObjectURL = value => { blob = value as Blob; return 'blob:original'; };
    URL.revokeObjectURL = () => {};
    f.dom.window.HTMLAnchorElement.prototype.click = () => {};
    original.click();
    const bytes = await blob!.arrayBuffer(), view = new DataView(bytes);
    assert.equal(bytes.byteLength, raw.length * 2);
    assert.equal(Array.from({ length: raw.length }, (_, i) => String.fromCharCode(view.getUint16(i * 2, true))).join(''), raw);
    assert.match(f.panel.root.textContent!, /Not a directly importable/);
    repair.click(); assert.equal(f.confirmations, 1); assert.equal(f.restored, 0);
    assert.equal(f.dom.window.localStorage.getItem(WORLD_PROGRESS_KEY), raw);
    f.accept();
    const write = f.dom.window.Storage.prototype.setItem;
    f.dom.window.Storage.prototype.setItem = () => { throw new Error('quota'); };
    repair.click(); assert.equal(f.restored, 0); assert.equal(f.progress.saveBlocked, true);
    assert.equal(f.dom.window.localStorage.getItem(WORLD_PROGRESS_KEY), raw);
    assert.deepEqual([...f.progress.done], ['existing']);
    f.dom.window.Storage.prototype.setItem = write;
    repair.click(); assert.equal(f.restored, 1); assert.equal(f.progress.saveBlocked, false);
  } finally { URL.createObjectURL = oldCreate; URL.revokeObjectURL = oldRevoke; f.close(); }
});
test('a stale corrupt-save confirmation cannot overwrite a newer tab save', async () => {
  for (const beforePrompt of [true, false]) {
    const f = fixture('{broken');
    try {
      const newer = '{"done":["other_tab"],"found":[]}';
      if (beforePrompt) f.dom.window.localStorage.setItem(WORLD_PROGRESS_KEY, newer);
      else f.dom.window.confirm = () => { f.dom.window.localStorage.setItem(WORLD_PROGRESS_KEY, newer); return true; };
      f.panel.root.querySelector('button')!.click();
      assert.equal(f.restored, 0); assert.equal(f.progress.saveBlocked, true);
      assert.equal(f.dom.window.localStorage.getItem(WORLD_PROGRESS_KEY), newer);
      assert.deepEqual([...f.progress.done], ['existing']);
      assert.equal(f.progress.exportUnreadableSnapshot(), '{broken');
      f.progress.save(); assert.equal(f.dom.window.localStorage.getItem(WORLD_PROGRESS_KEY), newer);
    } finally { f.close(); }
  }
});

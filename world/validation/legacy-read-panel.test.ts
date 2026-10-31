import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { WorldProgress, WORLD_PROGRESS_KEY, LEGACY_WORLD_PROGRESS_KEYS } from '../src/progress';
import { createProgressPanel } from '../src/progressPanel';
import { setLanguage } from '../../shared-client/i18n';

test('unavailable legacy source has truthful localized recovery copy and explicit partial-session replacement warning', () => {
  const previous = new Map(['window', 'document'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://example.test/' });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: dom.window });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: dom.window.document });
  let writes = 0, confirms = 0;
  const progress = new WorldProgress({ getItem(key) { if (key === LEGACY_WORLD_PROGRESS_KEYS[0]) throw new Error('unread'); return key === LEGACY_WORLD_PROGRESS_KEYS[1] ? '{"done":["sea_core"],"found":[]}' : null; }, setItem() { writes++; } });
  const panel = createProgressPanel(progress, () => assert.fail('canceled replacement must not reload'));
  dom.window.document.body.append(panel.root);
  try {
    for (const language of ['zh', 'en'] as const) {
      setLanguage(language);
      const buttons = [...panel.root.querySelectorAll<HTMLButtonElement>('button')];
      const original = buttons.find(button => /无损原始|lossless original/.test(button.textContent!))!;
      assert.equal(original.hidden, true, 'unread original bytes cannot be offered as a download');
      assert.match(panel.root.textContent!, language === 'zh' ? /重新载入可重试读取/ : /reloading to retry the reads/);
      dom.window.confirm = (message?: string) => { confirms++; assert.match(String(message), language === 'zh' ? /可能不包含其中的任务/ : /may omit their quests/); return false; };
      buttons.find(button => /用本次进度替换|Replace with session/.test(button.textContent!))!.click();
      assert.equal(writes, 0); assert.ok(progress.done.has('sea_core')); assert.equal(progress.saveBlocked, true);
    }
    assert.equal(confirms, 2); assert.equal(progress.captureStoredSnapshot()!.raw, null);
    assert.equal(WORLD_PROGRESS_KEY, 'parhelion.world.progress.v2');
  } finally {
    panel.dispose(); setLanguage('zh'); dom.window.close();
    for (const [key, value] of previous) { if (value) Object.defineProperty(globalThis, key, value); else Reflect.deleteProperty(globalThis, key); }
  }
});

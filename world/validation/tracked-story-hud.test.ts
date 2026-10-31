import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { createTrackedStoryHud } from '../src/trackedStoryHud';

test('explicit tracked context preserves original objectives, reattaches after rerenders and never inserts markup', () => {
  const dom = new JSDOM('<div id="objective"><h3>Original</h3><div>Main task</div></div>');
  const old = Object.getOwnPropertyDescriptor(globalThis, 'document'); Object.defineProperty(globalThis, 'document', { configurable: true, value: dom.window.document });
  try {
    const container = dom.window.document.getElementById('objective')!;
    const hud = createTrackedStoryHud(container), state = { title: 'False Dawn', instruction: '<b>Switch II</b>', returnHint: 'P for original story', status: '2 guards remain' };
    hud.update(null); assert.equal(container.children.length, 2);
    hud.update(state); const root = container.firstElementChild!;
    assert.match(container.textContent!, /OriginalMain task/); assert.equal(root.querySelector('b'), null);
    const observer = new dom.window.MutationObserver(() => {}); observer.observe(root, { subtree: true, childList: true, attributes: true, characterData: true });
    hud.update(state); assert.equal(container.firstElementChild, root); assert.equal(observer.takeRecords().length, 0, 'unchanged budget ticks do not churn DOM'); observer.disconnect();
    container.textContent = 'New main objective'; hud.update(state); assert.equal(container.firstElementChild, root); assert.match(container.textContent!, /New main objective/);
    hud.update({ ...state, title: '伪晓回声', status: undefined }); assert.equal(root.querySelectorAll('div')[1].hidden, true);
    hud.update(null); assert.equal(container.textContent, 'New main objective');
    hud.dispose(); hud.update(state); assert.equal(container.children.length, 0);
  } finally { dom.window.close(); if (old) Object.defineProperty(globalThis, 'document', old); else Reflect.deleteProperty(globalThis, 'document'); }
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { installNewGameControl } from '../src/ui/newGameControl';

test('new game requires both open dialogs and explicit confirmation, with Cancel focused first', () => {
  const dom = new JSDOM('<dialog open><section></section></dialog>');
  const { window } = dom, doc = window.document;
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: doc });
  window.HTMLDialogElement.prototype.showModal = function() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function() { this.open = false; this.dispatchEvent(new window.Event('close')); };
  let resets = 0;
  const menu = installNewGameControl(doc.querySelector('section')!, () => { resets++; });
  try {
    const button = doc.getElementById('world-new-game')!;
    const cancel = doc.getElementById('world-new-game-cancel')!;
    const confirm = doc.getElementById('world-new-game-confirm')!;
    const prompt = confirm.closest('dialog')!, settings = doc.querySelector('dialog')!;
    confirm.click();
    button.click();
    assert.equal(doc.activeElement, cancel);
    assert.match(prompt.textContent!, /任务、契约与发现|quests, contracts and discoveries/);
    assert.match(prompt.textContent!, /按键、语言和画质|controls, language and graphics/);
    for (const key of ['Enter', ' ']) {
      const repeat = new window.KeyboardEvent('keydown', { key, repeat: true, bubbles: true, cancelable: true });
      assert.equal(confirm.dispatchEvent(repeat), false);
    }
    cancel.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    assert.equal(prompt.open, false);
    confirm.click();
    button.click(); cancel.click(); confirm.click();
    button.click(); settings.close(); confirm.click();
    assert.equal(prompt.open, false);
    assert.equal(resets, 0);
    settings.showModal();
    button.click(); confirm.click(); confirm.click();
    assert.equal(resets, 1);
  } finally {
    menu.dispose(); dom.window.close();
    if (previous) Object.defineProperty(globalThis, 'document', previous);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});

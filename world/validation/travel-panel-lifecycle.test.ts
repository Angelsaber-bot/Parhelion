import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { createTravelPanel } from '../src/travelPanel';

test('stale travel buttons cannot act after refresh, close, successful travel or disposal', () => {
  const dom = new JSDOM('<!doctype html><body><button id="world-travel-open">Travel</button></body>', { pretendToBeVisual: true });
  const old = new Map(['document', 'getComputedStyle'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  Object.defineProperty(globalThis, 'document', { configurable: true, value: dom.window.document });
  Object.defineProperty(globalThis, 'getComputedStyle', { configurable: true, value: dom.window.getComputedStyle.bind(dom.window) });
  let calls = 0, closes = 0, success = false;
  const panel = createTravelPanel({ entries: () => [{ id: 'alpha', name: ['营地', 'Camp'], discovered: true, blocked: null }], onOpen() {}, onClose() { closes++; }, travel() { calls++; return success; } });
  const button = () => document.querySelector<HTMLButtonElement>('[data-travel-id]')!;
  try {
    panel.show(); const first = button(); panel.refresh(); first.click(); assert.equal(calls, 0);
    const second = button(); second.click(); assert.equal(calls, 1, 'current visible button can request travel');
    second.click(); assert.equal(calls, 1, 'rejected request refresh invalidates the old button');
    const third = button(); panel.hide(); third.click(); assert.equal(calls, 1); assert.equal(closes, 1);
    panel.show(); success = true; const accepted = button(); accepted.click(); accepted.click(); assert.equal(calls, 2); assert.equal(panel.open, false); assert.equal(closes, 2);
    panel.show(); const disposed = button(); panel.dispose(); panel.dispose(); disposed.click(); panel.show(); panel.refresh();
    assert.equal(calls, 2); assert.equal(closes, 3); assert.equal(panel.open, false); assert.equal(document.getElementById('world-travel-panel'), null);
  } finally { panel.dispose(); dom.window.close(); for (const [key, value] of old) { if (value) Object.defineProperty(globalThis, key, value); else Reflect.deleteProperty(globalThis, key); } }
});

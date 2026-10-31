import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { createWeaponFinishControl } from '../src/weaponFinishControl.ts';
import { WeaponFinishStore } from '../src/weaponFinishes.ts';
import { setLanguage } from '../../shared-client/i18n.ts';

test('real DOM finish control rejects locked programmatic selections, refreshes earned/reset flags and localizes without progress mutation', () => {
  const dom = new JSDOM('<!doctype html><body></body>'); (globalThis as any).document = dom.window.document;
  const done = new Set<string>(), store = new WeaponFinishStore(); const applied: string[] = [];
  const control = createWeaponFinishControl(store, done, finish => applied.push(finish)); document.body.append(control.root);
  const select = control.root.querySelector('select')!;
  assert.equal(select.value, 'original'); assert.equal(select.options.length, 6); assert.equal([...select.options].filter(o => o.disabled).length, 5);
  select.value = 'ember'; select.dispatchEvent(new dom.window.Event('change')); assert.equal(select.value, 'original'); assert.deepEqual(applied, []); assert.equal(done.size, 0);
  done.add('campaign_kyoto_complete'); control.refresh(); assert.equal(select.querySelector<HTMLOptionElement>('[value=ember]')!.disabled, false);
  select.value = 'ember'; select.dispatchEvent(new dom.window.Event('change')); assert.equal(store.preference, 'ember'); assert.deepEqual(applied, ['ember']);
  assert.deepEqual([...done], ['campaign_kyoto_complete']);
  done.clear(); control.refresh(); assert.equal(select.value, 'original'); assert.equal(store.preference, 'ember'); assert.match(control.root.querySelector('[role=status]')!.textContent!, /尚未解锁/);
  setLanguage('en'); assert.match(control.root.textContent!, /Colors only/); assert.match(control.root.querySelector('[role=status]')!.textContent!, /has not earned/);
  done.add('campaign_kyoto_complete'); control.refresh(); assert.equal(select.value, 'ember'); assert.match(control.root.querySelector('[role=status]')!.textContent!, /not saved/);
  assert.match(control.root.querySelector('summary')!.textContent!, /How to earn/);
  control.dispose(); control.dispose(); assert.equal(document.body.children.length, 0);
  const text = control.root.textContent; setLanguage('zh'); assert.equal(control.root.textContent, text, 'language listener is removed on disposal'); dom.window.close();
});

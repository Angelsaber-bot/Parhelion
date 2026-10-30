import test from 'node:test';
import assert from 'node:assert/strict';
import { bootWorldWithoutGpu } from './world-dom-boot.fixture';

// Production wiring and actual scene/state; this does not emulate native browser dialog rendering.
test('NON-GPU travel keyboard focus survives refresh, rejection and dismissal without stealing another modal', async t => {
  const harness = await bootWorldWithoutGpu({ deterministic: true });
  try {
    const { window, world } = harness, document = window.document;
    let now = 0;
    const frame = () => harness.frame(now += 1000 / 60);
    const key = (code: string, key: string) => {
      (document.activeElement ?? document.body).dispatchEvent(new window.KeyboardEvent('keydown', { code, key, bubbles: true, cancelable: true }));
      (document.activeElement ?? document.body).dispatchEvent(new window.KeyboardEvent('keyup', { code, key, bubbles: true }));
    };
    const opener = document.getElementById('world-travel-open') as HTMLButtonElement;
    const panel = document.getElementById('world-travel-panel')!;
    const back = () => panel.querySelector<HTMLButtonElement>('.travel-card > button')!;
    const stop = world.travelStops.find((stop: any) => stop.region === 'alpha');
    world.found.add(stop.foundFlag); world.player.teleport(...stop.position);
    for (let i = 0; i < 40; i++) frame();
    world.combat.state.quietFor = 6;
    const destination = () => panel.querySelectorAll<HTMLButtonElement>('.travel-stop')[world.travelStops.indexOf(stop)];
    await t.test('refresh preserves an available destination; stale-button rejection focuses Back', () => {
      opener.focus(); opener.click(); assert.equal(world.travelPanel.open, true);
      destination().focus();
      const language = document.querySelector<HTMLSelectElement>('body > .parhelion-language select')!;
      language.value = 'en'; language.dispatchEvent(new window.Event('change', { bubbles: true }));
      assert.equal(document.activeElement, destination());
      world.combat.state.quietFor = 0; destination().click();
      assert.equal(world.travelPanel.open, true); assert.equal(destination().disabled, true);
      assert.equal(document.activeElement, back());
      key('Escape', 'Escape');
      assert.equal(world.travelPanel.open, false); assert.equal(document.activeElement, opener);
      assert.equal(document.pointerLockElement, null);
    });
    await t.test('successful travel restores opener without pointer lock; repeated close is inert', () => {
      world.combat.state.quietFor = 6; opener.focus(); opener.click(); destination().focus(); destination().click();
      assert.equal(world.travelPanel.open, false); assert.equal(document.activeElement, opener);
      assert.equal(document.pointerLockElement, null);
      const settings = document.getElementById('settings-open') as HTMLButtonElement;
      settings.focus(); world.travelPanel.hide(); assert.equal(document.activeElement, settings);
      for (let i = 0; i < 40; i++) frame();
    });
    await t.test('closing does not steal newer settings focus or focus a detached opener', () => {
      opener.focus(); opener.click(); world.settingsPanel.show();
      const settingsFocus = document.activeElement;
      assert.ok(document.getElementById('world-settings')!.contains(settingsFocus));
      world.travelPanel.hide(); assert.equal(document.activeElement, settingsFocus);
      world.settingsPanel.close();
      opener.focus(); opener.click(); const parent = opener.parentElement!; opener.remove();
      world.travelPanel.hide(); assert.notEqual(document.activeElement, opener); parent.append(opener);
    });
    await t.test('hotkey-opened travel with no focusable opener returns focus to the visible travel control', async () => {
      (document.activeElement as HTMLElement)?.blur();
      (document.getElementById('start') as HTMLElement).click(); await Promise.resolve();
      assert.equal(document.pointerLockElement, document.getElementById('view'));
      key('KeyN', 'n'); assert.equal(world.travelPanel.open, true);
      key('Escape', 'Escape');
      assert.equal(document.pointerLockElement, null); assert.equal(document.activeElement, opener);
    });
    assert.equal(harness.errors.length, 0, JSON.stringify(harness.errors));
  } finally { await harness.close(); }
});

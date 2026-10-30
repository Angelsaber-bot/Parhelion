import test from 'node:test';
import assert from 'node:assert/strict';
import { bootWorldWithoutGpu } from './world-dom-boot.fixture';

test('NON-GPU production action HUD acknowledges action input on the next frame and keeps queued cues single', async () => {
  const h = await bootWorldWithoutGpu({ deterministic: true });
  try {
    const { window, world } = h, document = window.document;
    let now = 0, cues = 0;
    const frame = () => h.frame(now += 1000 / 60);
    const key = (code: string) => { document.body.dispatchEvent(new window.KeyboardEvent('keydown', { code, key: code.replace('Key', '').toLowerCase(), bubbles: true, cancelable: true })); document.body.dispatchEvent(new window.KeyboardEvent('keyup', { code, bubbles: true })); };
    const stop = world.travelStops.find((stop: any) => stop.region === 'alpha');
    world.done.add('armory_rack'); world.player.teleport(...stop.position);
    (document.getElementById('start') as HTMLElement).click(); await Promise.resolve();
    for (let i = 0; i < 40; i++) frame();
    const language = document.querySelector<HTMLSelectElement>('body > .parhelion-language select')!;
    language.value = 'en'; language.dispatchEvent(new window.Event('change', { bubbles: true })); frame();
    const row = (id: string) => document.querySelector<HTMLElement>(`#world-action-bar [data-action="${id}"]`)!;
    const status = (id: string) => row(id).querySelector('small')!.textContent!;
    assert.equal(row('melee').classList.contains('action-ready'), true);
    const original = world.audio.melee.bind(world.audio); world.audio.melee = () => { cues++; original(); };
    key('KeyB'); assert.equal(world.actions.melee.active, true); frame();
    assert.equal(row('melee').classList.contains('action-ready'), false, 'action HUD cannot keep Ready after accepted melee input');
    assert.match(status('melee'), /striking/);
    for (let i = 0; i < 25 && !row('melee').classList.contains('chain-open'); i++) frame();
    assert.equal(world.actions.melee.comboWindowOpen, true); assert.match(status('melee'), /Press again/);
    key('KeyB'); assert.equal(world.actions.melee.nextCutQueued, true); assert.equal(cues, 2);
    key('KeyB'); assert.equal(cues, 2, 'already queued input cannot emit another acceptance cue'); frame();
    assert.equal(row('melee').classList.contains('chain-open'), false); assert.match(status('melee'), /Next cut queued/);
    for (let i = 0; i < 100 && (world.actions.melee.active || world.actions.melee.cooldown > 0); i++) frame();
    language.value = 'zh'; language.dispatchEvent(new window.Event('change', { bubbles: true })); frame();
    key('KeyQ'); assert.equal(world.actions.skills.casting, true); const cooldown = world.actions.skills.cooldown('skill'); frame();
    assert.equal(row('skill').classList.contains('action-ready'), false); assert.equal(row('skill').classList.contains('cooling'), true);
    assert.ok(world.actions.skills.cooldown('skill') <= cooldown);
    assert.equal(h.errors.length, 0, JSON.stringify(h.errors));
  } finally { await h.close(); }
});

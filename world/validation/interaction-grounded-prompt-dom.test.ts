/** NON-GPU actual main: setup positioning is explicit; jump/landing/input are real. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { bootWorldWithoutGpu } from './world-dom-boot.fixture';

test('active interaction target tells the truth while airborne and resumes the custom key after landing', async () => {
  const h = await bootWorldWithoutGpu({ deterministic: true,
    initialStorage: { 'parhelion.world.progress.v2': JSON.stringify({ done: ['campaign_alpha_met'], found: [] }), 'parhelion.language': 'en' } });
  const w = h.world, d = h.window.document; let now = 0;
  const frame = () => h.frame(now += 1000 / 60);
  const key = (code: string) => { for (const type of ['keydown', 'keyup']) d.body.dispatchEvent(new h.window.KeyboardEvent(type, { code, bubbles: true })); };
  try {
    (d.getElementById('start') as HTMLElement).click(); await Promise.resolve();
    const m = w.layout.markers.find((m: any) => m.id === 'campaign_alpha_work');
    w.player.teleport(m.p[0], m.p[1] + .2, m.p[2]);
    for (let i = 0; i < 120 && !w.player.onGround; i++) frame();
    assert.equal(w.player.onGround, true);
    const binding = ['KeyJ', 'KeyY', 'KeyK'].find(code => !w.settings.action(code)); assert.ok(binding);
    assert.equal(w.settings.bind('interact', binding), null); frame();
    const prompt = d.getElementById('prompt')!;
    assert.match(prompt.textContent!, new RegExp(binding.slice(3)));
    const before = JSON.stringify([...w.done]);
    const jump = w.settings.bindingsFor('jump')[0];
    d.body.dispatchEvent(new h.window.KeyboardEvent('keydown', { code: jump, bubbles: true })); frame();
    d.body.dispatchEvent(new h.window.KeyboardEvent('keyup', { code: jump, bubbles: true }));
    assert.equal(w.player.onGround, false);
    assert.match(prompt.textContent!, /solid ground|稳固地面/);
    key(binding); assert.equal(w.narrative.open, false); assert.equal(JSON.stringify([...w.done]), before);
    // A second real jump press in the air deploys the original glider.
    frame();
    d.body.dispatchEvent(new h.window.KeyboardEvent('keydown', { code: jump, bubbles: true })); frame();
    d.body.dispatchEvent(new h.window.KeyboardEvent('keyup', { code: jump, bubbles: true }));
    assert.equal(w.player.gliding, true); assert.match(prompt.textContent!, /solid ground|稳固地面/);
    key(binding); assert.equal(w.narrative.open, false); assert.equal(JSON.stringify([...w.done]), before);
    frame();
    d.body.dispatchEvent(new h.window.KeyboardEvent('keydown', { code: jump, bubbles: true })); frame();
    d.body.dispatchEvent(new h.window.KeyboardEvent('keyup', { code: jump, bubbles: true }));
    assert.equal(w.player.gliding, false);
    for (let i = 0; i < 180 && !w.player.onGround; i++) frame(); frame();
    assert.equal(w.player.onGround, true); assert.doesNotMatch(prompt.textContent!, /solid ground|稳固地面/);
    assert.match(prompt.textContent!, new RegExp(binding.slice(3)));
    // A stationary target does not recreate its text node every render frame.
    const text = prompt.firstChild; for (let i = 0; i < 30; i++) frame(); assert.equal(prompt.firstChild, text);
    key(binding); assert.equal(w.narrative.open, true);
    assert.deepEqual(h.errors, []);
  } finally { await h.close(); }
});

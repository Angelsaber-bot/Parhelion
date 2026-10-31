/** Genuine main/frame/input and loaded GLB, with explicit QA recruitment/placement.
 * Renderer/image uploads are stubbed by the fixture; this is not GPU visual proof. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { bootWorldWithoutGpu } from './world-dom-boot.fixture.ts';
test('actual-main native Saber executes bounded support and restores attack ownership', async t => {
  const h = await bootWorldWithoutGpu({ deterministic: true });
  try {
    const w = h.world; let now = 0;
    const frame = (count = 1) => { for (let i = 0; i < count; i++) h.frame(now += 1000 / 60); };
    w.done.add('armory_rack'); w.contract.recruit('saber_contract'); w.contract.select('saber');
    for (const enemy of w.combat.state.enemies) { enemy.mode = 'dead'; enemy.hp = 0; enemy.active = false; enemy.timer = Infinity; }
    w.player.teleport(50, w.ground(50, -593.5) + .1, -593.5); w.player.yaw = Math.PI / 2;
    (h.window.document.getElementById('start') as HTMLElement).click(); frame(2); await h.settleAssets(); frame(45);
    h.window.document.body.dispatchEvent(new h.window.KeyboardEvent('keydown', { code: 'KeyW', bubbles: true }));
    frame(120);
    h.window.document.body.dispatchEvent(new h.window.KeyboardEvent('keyup', { code: 'KeyW', bubbles: true })); frame(30);
    const actor = w.servant, model = actor.presentationModel; assert.ok(model, 'native loaded actor');
    const diagnostics = actor.groundDiagnostics; assert.ok(diagnostics, 'real runtime helper, not a validation-injected replacement');
    assert.ok(diagnostics.patch.shapecasts > 0); assert.ok(diagnostics.patch.heightQueries > 100); assert.equal(diagnostics.patch.overflows, 0);
    assert.ok(diagnostics.patch.triangles <= 512); assert.ok(diagnostics.contact.maxFinalTargetError < .001);
    assert.ok(model.getObjectByName('mixamorigLeftFoot')); assert.ok(actor.root.position.toArray().every(Number.isFinite));
    // Exact action clock owns attacks; the support solver must detach during attack.
    actor.play('attack', true); actor.tick(1 / 60); assert.equal(actor.groundingActive, false); assert.equal(actor.stride.support, undefined);
    actor.play('idle'); actor.tick(1 / 60); assert.equal(actor.groundingActive, true); assert.equal(actor.stride.support, actor.grounding);
    t.diagnostic(JSON.stringify({ root: actor.root.position.toArray(), support: diagnostics, stride: actor.strideDiagnostics }));
    assert.deepEqual(h.errors, []);
  } finally { await h.close(); }
});

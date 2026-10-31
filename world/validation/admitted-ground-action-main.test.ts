/** Actual main input/physics/action ordering. Only entry placement is a fixture;
 * no support wrapper or grounded/action/HP/clock writes. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { bootWorldWithoutGpu } from './world-dom-boot.fixture';

test('main keeps real action clocks and contact on geometrically supported downhill movement', async () => {
  const h = await bootWorldWithoutGpu({ deterministic: true, initialStorage: {
    'parhelion.world.progress.v2': JSON.stringify({ done: ['armory_rack'], found: [] }),
  } });
  const w = h.world, d = h.window.document;
  let now = 0;
  const frame = () => h.frame(now += 1000 / 60);
  const key = (action: string, down: boolean) => d.body.dispatchEvent(new h.window.KeyboardEvent(down ? 'keydown' : 'keyup', {
    code: w.settings.bindingsFor(action)[0], bubbles: true, cancelable: true,
  }));
  const contacts: string[] = [], calls: { arguments: number; active: boolean; guardOnly: boolean; grounded: boolean }[] = [];
  const strike = w.actions.options.strike;
  w.actions.options.strike = (...args: any[]) => { contacts.push(args[1]); return strike(...args); };
  const step = w.player.step.bind(w.player);
  w.player.step = (...args: any[]) => {
    const active = !!(w.actions.melee.active || w.actions.skills.casting || w.actions.skills.guarding);
    const guardOnly = !!(w.actions.skills.guarding && !w.actions.skills.casting && !w.actions.melee.active);
    const result = step(...args);
    calls.push({ arguments: args.length, active, guardOnly, grounded: w.player.onGround });
    return result;
  };
  try {
    (d.getElementById('start') as HTMLElement).click(); frame(); await h.settleAssets();
    for (const action of ['melee', 'skill']) {
      const ground = w.combat.geometry.ground(-45, -98.8, 30); assert.ok(ground);
      w.player.teleport(-45, ground.point.y + .08, -98.8);
      for (let i = 0; i < 600; i++) frame();
      assert.equal(w.player.onGround, true);
      const yaw = Math.atan2(w.player.pos.x + 52, w.player.pos.z + 85);
      const delta = Math.atan2(Math.sin(w.player.yaw - yaw), Math.cos(w.player.yaw - yaw));
      const event = new h.window.MouseEvent('mousemove', { bubbles: true });
      Object.defineProperties(event, { movementX: { value: delta / (.0022 * w.settings.value.sensitivity) }, movementY: { value: 0 } });
      d.dispatchEvent(event); frame();
      const before = w.player.evadeSupport.diagnostics.recovered;
      contacts.length = 0; calls.length = 0;
      key('forward', true); key(action, true); key(action, false);
      assert.ok(action === 'melee' ? w.actions.melee.active : w.actions.skills.casting, `${action} admitted on ground`);
      for (let i = 0; i < 55; i++) frame();
      key('forward', false);
      assert.equal(contacts.length, 1, `${action} reaches its real contact once`);
      assert.ok(w.player.evadeSupport.diagnostics.recovered > before, 'real production support path exercised');
      // General prior-grounded support is geometric, not permission from an
      // active action. The former narrow bit contract is retained at dbff949.
      assert.ok(calls.every(call => call.arguments === 2), 'main cannot grant action-specific grounding');
      assert.ok(calls.some(call => call.active && call.grounded), 'real actions stay supported');
      assert.ok(calls.some(call => !call.active), 'action finishes without duplicate contact');
      if (action === 'skill') {
        const tail = calls.filter(call => call.guardOnly);
        assert.equal(tail.length, 6, 'original 50ms guard-only tail retains its exact six physics steps');
        assert.ok(tail.every(call => call.grounded));
      }
    }
    assert.deepEqual(h.errors, []);
  } finally { key('forward', false); await h.close(); }
});

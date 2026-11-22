import test from 'node:test';
import assert from 'node:assert/strict';
import { bootWorldWithoutGpu } from './world-dom-boot.fixture';
import { LOOKBACK_CHANNEL } from '../src/map/valleyFoundationPlan';
import { VALLEY_PROLOGUE } from '../src/story/valleyPrologue';
import { VT } from '../src/story/valleyTownSetPieces';
import { WORLD_PROGRESS_KEY } from '../src/core/progress';
import { homeChapterMemories } from '../src/story/homeTown';

test('Valley formal set pieces: stream bed, crossable bridge and bed, state-built footbridge, annex walls and doors', async () => {
  const h = await bootWorldWithoutGpu({ deterministic: true });
  try {
    const w = h.world; let time = 0;
    const frame = (n = 1) => { for (let i = 0; i < n; i++) h.frame(time += 1000 / 60); };
    (h.window.document.getElementById('start') as HTMLElement).click(); await Promise.resolve(); frame(3);
    const g = w.combat.geometry, c = LOOKBACK_CHANNEL;
    // The stream bed is carved into collision and the height grid alike.
    const bed = g.ground(c.x, -40, 30)!.point.y, bank = g.ground(c.x - 4.5, -40, 30)!.point.y;
    assert.ok(bank - bed > .6 && bank - bed < 1.3, `bed ${bed.toFixed(2)} below bank ${bank.toFixed(2)}`);
    assert.ok(Math.abs(w.grid.sampleHeight(c.x, -40) - bed) < .25, 'height grid follows the carved bed');
    for (const name of ['COL_ValleyLookbackBridge', 'COL_ValleyWestRidge', 'COL_ValleyCanteenAnnex', 'COL_HomewardSquareFixtures'])
      assert.equal(w.colliders.find((k: { name: string }) => k.name === name)?.enabled, true, name);
    const forwards = (yaw: number, seconds: number) => {
      w.player.yaw = yaw;
      for (let i = 0; i < seconds * 120; i++) w.player.step(1 / 120, { x: 0, z: 1, jump: false, sprint: false });
      return w.player.pos.clone();
    };
    const walk = (x: number, z: number, yaw: number, seconds: number) => {
      const floor = g.ground(x, z, 40)!; w.player.teleport(x, floor.point.y + .2, z);
      for (let i = 0; i < 120; i++) w.player.step(1 / 120, { x: 0, z: 0, jump: false, sprint: false });
      return forwards(yaw, seconds);
    };
    const west = Math.PI / 2; // facing −x: forward = (−sin yaw, −cos yaw)
    assert.ok(walk(-262, -29.9, west, 6).x < -278, 'the town route crosses the north Lookback deck westward');
    assert.ok(walk(-262, -25.5, west, 6).x < -278, 'and the south deck');
    assert.ok(walk(-262, -46, west, 6).x < -278, 'the stream bed itself stays walkable (gentle banks)');
    // H13: the residents' footbridge is solid only after the return from the sky.
    const foot = w.colliders.find((k: { name: string }) => k.name === 'COL_ValleyResidentsFootbridge');
    assert.equal(foot.enabled, false);
    w.done.add('journey_sky_return'); frame(2); assert.equal(foot.enabled, true); w.done.delete('journey_sky_return'); frame(2);
    // T02 annex: the kitchen door lets you in; the solid wall beside it does not.
    assert.ok(walk(-173.5, 192.4, west, 3).x < -178, 'through the kitchen door into the kitchen');
    assert.ok(walk(-173.5, 188.4, west, 3).x > -176.5, 'the room wall blocks where there is no door');
    const shelf = w.scene.getObjectByName('ValleyCanteenAnnex').getObjectByName('Campaign_alpha_resolved');
    assert.equal(shelf.visible, false);
    assert.equal(w.fieldChapters.ready(VT.supper), false);
    w.done.add(VALLEY_PROLOGUE.record);
    assert.equal(w.fieldChapters.ready(VT.supper), true);
    assert.doesNotMatch(homeChapterMemories(w.done)[0], /陈芮/);
    const landing = walk(-186, 182, Math.PI, 2.27);
    const rise = landing.y - g.ground(-186, 182, 40)!.point.y;
    assert.ok(Math.abs(landing.z - 194.4) < .42 && rise > 1.9, `lower road reaches landing at ${landing.toArray()} after climbing ${rise}`);
    const inside = forwards(-west, .8);
    assert.ok(inside.x > -183 && inside.x < -180, `turn at the landing and walk inside the kitchen: ${inside.x}`);
    frame(3);
    const key = w.settings.bindingsFor('interact')[0], d = h.window.document;
    assert.match(d.getElementById('prompt')!.textContent!, /复写联/);
    for (const type of ['keydown', 'keyup']) d.body.dispatchEvent(new h.window.KeyboardEvent(type, {code:key, bubbles:true}));
    frame(2);
    assert.ok(w.done.has(VT.supper));
    assert.equal(shelf.visible, true);
    assert.equal(w.fieldChapters.ready(VT.supper), false);
    const saved = new Set<string>(JSON.parse(h.window.localStorage.getItem(WORLD_PROGRESS_KEY)!).done);
    assert.ok(saved.has(VT.supper));
    assert.match(homeChapterMemories(saved)[0], /陈芮和顾桥/);
  } finally { await h.close(); }
});

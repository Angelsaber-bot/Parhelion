import assert from 'node:assert/strict';
import test from 'node:test';
import { WORLD_PROGRESS_KEY } from '../src/core/progress';
import { QX } from '../src/story/qinChapters';
import { WC } from '../src/story/winterChapters';
import { bootWorldWithoutGpu } from './world-dom-boot.fixture';

test('a player can pick up both escorts with the interact key and walk the groups to a saved handoff', async () => {
  const seed = ['armory_rack', 'adventure_v2', 'adventure_online', WC.w04, WC.crate, 'journey_qin_workers', QX.roster];
  const h = await bootWorldWithoutGpu({ deterministic: true, bootTimeoutMs: 150000, initialStorage: {
    [WORLD_PROGRESS_KEY]: JSON.stringify({ done: seed, found: [] }),
  } });
  const { window, world } = h;
  const { document } = window;
  let now = 0;
  const frame = () => h.frame(now += 1000 / 30);
  const key = (code: string, down: boolean) => document.body.dispatchEvent(
    new window.KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true, cancelable: true }));

  try {
    (document.getElementById('start') as HTMLElement).click();
    await Promise.resolve();
    frame();
    for (const id of [WC.stretcher, QX.guide]) {
      const pickup = world.fieldChapterScene.point(id);
      assert.ok(pickup, `pickup exists for ${id}`);
      // Position the player at the beginning of each chapter. From pickup to handoff, only walk input moves them.
      world.player.teleport(pickup[0], pickup[1] + .12, pickup[2]);
      for (let i = 0; i < 12; i++) frame();
      const interact = world.settings.bindingsFor('interact')[0];
      key(interact, true); key(interact, false); frame();
      const start = world.fieldChapters.escortPose(id);
      assert.ok(start?.active, `${id} pickup: ${document.getElementById('prompt')?.textContent} | ${document.getElementById('toast')?.textContent}`);
      assert.ok(Math.hypot(start.destination[0] - pickup[0], start.destination[2] - pickup[2]) > 6);
      const initialGuide = world.fieldChapters.escortGuide();
      assert.ok(initialGuide?.label[0], 'the group gives the player a direction');
      assert.equal(document.querySelector('#guide.on .label')?.textContent, initialGuide.label[0], 'the normal on-screen waypoint identifies the escort');
      const scene = world.fieldChapterScene.root;
      const handoff = scene.getObjectByName(`FieldDestination_${id}`);
      assert.ok(handoff?.visible, `${id} has a physical handoff site`);
      assert.ok(Math.hypot(handoff.position.x - start.destination[0], handoff.position.z - start.destination[2]) < .15);
      const names = id === WC.stretcher ? ['w_luc'] : ['q_potter', 'q_potter_sister', 'q_dyer', 'q_dyer_father'];
      const people = names.map(name => {
        const actor = scene.getObjectByName(`Resident_${name}`);
        assert.ok(actor?.visible, `${name} is present for the handoff`);
        return { actor, from: actor.position.clone() };
      });
      let forward = false;
      let resumed = false;
      try {
        for (let i = 0; i < 1000 && !world.done.has(id); i++) {
          if (id === WC.stretcher && !resumed && world.done.has(`${id}_1`)) {
            if (forward) key('KeyW', forward = false);
            key(interact, true); key(interact, false); frame();
            const resting = world.fieldChapters.escortPose(id);
            assert.equal(resting.active, false, 'the interact key sets the stretcher down');
            assert.ok(Math.hypot(resting.point[0] - pickup[0], resting.point[2] - pickup[2]) > 2);
            const marker = world.layout.markers.find((m: { id: string }) => m.id === id);
            assert.ok(Math.hypot(marker.p[0] - resting.point[0], marker.p[2] - resting.point[2]) < .05, 'pickup follows the resting group');
            key(interact, true); key(interact, false); frame();
            assert.ok(world.fieldChapters.escortPose(id).active, 'the interact key resumes at the saved handoff');
            resumed = true;
          }
          const target = world.fieldChapters.escortGuide();
          assert.ok(target, `${id}: guide lost at ${world.player.pos.toArray()}`);
          const dx = target.p[0] - world.player.pos.x;
          const dz = target.p[2] - world.player.pos.z;
          if (Math.hypot(dx, dz) > .08) world.player.yaw = Math.atan2(-dx, -dz);
          const walking = Math.hypot(dx, dz) > .08 && i % 3 === 0;
          if (walking !== forward) key('KeyW', forward = walking);
          frame();
        }
      } finally {
        if (forward) key('KeyW', false);
      }
      assert.ok(world.done.has(id), `${id} stopped at ${world.player.pos.toArray()} with group ${JSON.stringify(world.fieldChapters.escortPose(id))}`);
      if (id === WC.stretcher) assert.ok(resumed, 'the real-keyboard run included a drop and pickup at the first checkpoint');
      assert.ok(Math.hypot(world.player.pos.x - start.destination[0], world.player.pos.z - start.destination[2]) < 1.8);
      frame();
      for (const { actor, from } of people) {
        assert.ok(actor.position.distanceTo(from) > 5 && actor.position.distanceTo(handoff.position) < 3.5, `${actor.name} reached the handoff in the scene`);
      }
      assert.ok(JSON.parse(window.localStorage.getItem(WORLD_PROGRESS_KEY)!).done.includes(id));
    }
    assert.deepEqual(h.errors, []);
  } finally { await h.close(); }
});

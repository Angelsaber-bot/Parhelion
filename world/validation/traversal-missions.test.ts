import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { bootWorldWithoutGpu } from './world-dom-boot.fixture';
import { Player } from '../src/player/player';
import { TRIALS, flagGlide, flagTrial, glideScale, markerStele } from '../src/exploration/catalog';
import { ADVENTURE as A } from '../src/story/openWorldCampaign';

/** Real exported collision, Player inputs and production completion checks; no GPU or visual acceptance. */
test('all five glide trials and the medicine cart complete through their actual movement rules', async t => {
  const h = await bootWorldWithoutGpu({ deterministic: true }), w = h.world;
  const frame = { dt: 1 / 60, held: false, playable: true, inRange: false, grounded: true, moving: false, attacking: false };
  try {
    for (const level of Array.from({ length: 11 }, (_, i) => i)) for (const def of TRIALS) await t.test(`${def.id}: ordinary jump and glide, level ${level}`, () => {
      for (let n = 1; n <= 10; n++) level >= n ? w.done.add(flagGlide(n)) : w.done.delete(flagGlide(n));
      w.done.delete(flagTrial(def.id));
      const rt = w.exploration.state.trials.get(def.id), marker = w.layout.markers.find((m: any) => m.id === markerStele(def.id));
      const player = new Player(w.colliders, w.layout.world.waterLevel), scale = glideScale(level);
      player.glideSpeedScale = scale.speed; player.glideSinkScale = scale.sink; player.updrafts = w.player.updrafts;
      player.teleport(marker.p[0], marker.p[1] - .95, marker.p[2]);
      for (let i = 0; i < 60; i++) player.step(1 / 120, { x: 0, z: 0, jump: false, sprint: false });
      assert.equal(player.onGround, true, 'start on a real standing surface beside the stele');
      w.exploration.interact(marker.id);
      assert.equal(rt.active, true, 'use the production start action');
      let steps = 0, glidingSteps = 0;
      for (; steps < def.seconds * 120 && rt.active; steps++) {
        const index = rt.got.findIndex((got: boolean) => !got); if (index < 0) break;
        const target = rt.orbs[index].position;
        player.yaw = Math.atan2(player.pos.x - target.x, player.pos.z - target.z);
        player.step(1 / 120, { x: 0, z: 1, jump: steps === 0 || steps === 40, sprint: false });
        if (player.gliding) glidingSteps++;
        if (steps % 2 === 1) w.exploration.update(1 / 60, player, def.region, true);
      }
      assert.ok(w.done.has(flagTrial(def.id)), `not completed: got=${rt.got} position=${player.pos.toArray()} time=${steps / 120}`);
      assert.ok(glidingSteps > 120, 'actually glide through the course');
      assert.ok(steps / 120 < def.seconds - 1, 'leave a usable time margin');
      t.diagnostic(`${def.id} level ${level}: ${steps / 120}s`);
    });
    await t.test('cart traverses every real route segment, pauses, reloads a checkpoint and permits arrival acceptance', () => {
      w.done.add(A.convoy); w.adventureRuntime.reset();
      for (let i = 0; i < 100; i++) w.adventureRuntime.update(frame);
      const paused = w.adventureRuntime.cartPosition;
      for (let i = 0; i < 60; i++) w.adventureRuntime.update({ ...frame, playable: false });
      assert.deepEqual(w.adventureRuntime.cartPosition, paused);
      w.adventureRuntime.reset();
      assert.equal(w.adventureSites.convoyPath.length, 137, 'preserve old saved checkpoint numbers');
      const p = w.adventureRuntime.cartPosition;
      const obstacle = new THREE.BoxGeometry(8, 3, .3).translate(p[0], p[1] + 1.5, p[2] + .8);
      const gate = { name: 'test-cart-closed-gate', enabled: true, bvh: new MeshBVH(obstacle) };
      w.colliders.push(gate);
      const blocked = w.adventureRuntime.cartPosition;
      for (let i = 0; i < 10; i++) w.adventureRuntime.update(frame);
      assert.deepEqual(w.adventureRuntime.cartPosition, blocked, 'never bypass an actual blocking collider');
      gate.enabled = false;
      let stopped = 0, previous = w.adventureRuntime.cartPosition;
      for (let i = 0; i < 9000 && w.adventureRuntime.cartProgress < 1; i++) {
        w.adventureRuntime.update(frame);
        const p = w.adventureRuntime.cartPosition;
        stopped = p.every((v: number, n: number) => Math.abs(v - previous[n]) < 1e-8) ? stopped + 1 : 0;
        assert.ok(stopped < 90, `cart blocked at ${p} (progress ${w.adventureRuntime.cartProgress})`);
        previous = p;
      }
      assert.equal(w.adventureRuntime.cartProgress, 1);
      // Reproduce a save at the formerly blocked checkpoint, without restarting the quest.
      for (let leg = 23; leg < 137; leg++) w.done.delete(`adventure_cart_leg_${leg}`);
      w.adventureRuntime.reset();
      assert.equal(w.adventureRuntime.cartProgress, 22 / 136);
      for (let i = 0; i < 9000 && w.adventureRuntime.cartProgress < 1; i++) w.adventureRuntime.update(frame);
      assert.equal(w.adventureRuntime.cartProgress, 1, 'an old stuck save resumes to the crossing');
      obstacle.dispose();
      assert.equal(w.done.has(A.arrived), false, 'travel cannot forge the player’s acceptance');
      (h.window.document.getElementById('start') as HTMLElement).click();
      const marker = w.layout.markers.find((m: any) => m.id === 'adventure_winter_arrival');
      w.player.teleport(marker.p[0], marker.p[1], marker.p[2]);
      for (let i = 0; i < 120; i++) w.player.step(1 / 120, { x: 0, z: 0, jump: false, sprint: false });
      assert.equal(w.player.onGround, true);
      w.adventureRuntime.interact(marker.id);
      assert.ok(w.done.has(A.arrived), 'the delivered cart can actually be received at the crossing');
    });
    assert.deepEqual(h.errors, []);
  } finally { await h.close(); }
});

/** NON-GPU actual-main progression. Positions skip travel, and lethal test damage
 * isolates director->save delivery; this does not claim a balanced playthrough. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bootWorldWithoutGpu } from './world-dom-boot.fixture';
import { FALSE_DAWN, getFalseDawnState, falseDawnEncounterFlags } from '../src/falseDawnCampaign';
import { WORLD_PROGRESS_KEY, WorldProgress } from '../src/progress';

test('NON-GPU actual main runs both False Dawn routes with deliberate starts, physical emitters, real victory delivery and persistent endings', async t => {
  const h = await bootWorldWithoutGpu({ deterministic: true }); const { world: w, window } = h, document = window.document;
  let now = 0;
  const frame = (n = 1) => { for (let i = 0; i < n; i++) h.frame(now += 1000 / 60); };
  const key = (code: string) => { for (const type of ['keydown', 'keyup']) document.body.dispatchEvent(new window.KeyboardEvent(type, { code, bubbles: true, cancelable: true })); };
  const enter = async () => { if (!document.pointerLockElement) { (document.getElementById('start') as HTMLElement).click(); await Promise.resolve(); } };
  const close = () => { for (let i = 0; w.narrative.open && !w.narrative.choosing && i < 50; i++) key('KeyF'); };
  const at = (id: string) => {
    const marker = w.layout.markers.find((m: any) => m.id === id); assert.ok(marker, id);
    const x = marker.p[0], z = marker.p[2] + .65, ground = w.combat.geometry.ground(x, z, marker.p[1] + 3); assert.ok(ground, `ground ${id}`);
    w.player.teleport(x, ground.point.y + .04, z); w.player.onGround = true; w.player.flying = w.player.swimming = w.player.gliding = false;
  };
  const inspect = (id: string) => { close(); at(id); key('KeyF'); assert.equal(w.narrative.open, true, `dialogue ${id}`); };
  const choose = (id: string) => {
    for (let i = 0; w.narrative.open && !w.narrative.choosing && i < 50; i++) key('KeyF');
    assert.equal(w.narrative.choosing, true, `choice ${id}`);
    const button = document.querySelector<HTMLButtonElement>(`#world-dialogue-choices [data-choice="${id}"]`); assert.ok(button, id); button.click();
  };
  const start = (marker: string, id: string) => {
    inspect(marker); choose(`start:${id}`); assert.equal(w.combat.storyEncounter?.id, id, `director accepted ${id}: ${document.getElementById('toast')?.textContent}`);
    assert.equal(w.narrative.open, false, 'accepted combat start never pauses in dialogue'); frame(8);
    const tracked = document.getElementById('world-tracked-story'); assert.ok(tracked); assert.match(tracked.textContent!, new RegExp(String(w.combat.storyEncounter.remaining)));
    assert.ok(document.getElementById('objective')!.children.length > 1, 'original main objectives remain alongside tracked story');
  };
  const pinArc = async () => {
    (document.getElementById('world-campaign-journal-open') as HTMLButtonElement).click();
    document.querySelector<HTMLButtonElement>('[data-false-dawn-track]')!.click(); await enter(); frame(8);
    assert.ok(document.getElementById('world-tracked-story'), 'only explicit pin presents tracked objective');
  };
  const defeatActors = () => {
    const actors = w.combat.state.enemies.filter((enemy: any) => enemy.storyEncounter);
    assert.ok(actors.length > 0 && actors.length <= 3);
    for (const enemy of actors) w.combat.damageEnemy(enemy.id, 10000, { source: 'ranged', origin: w.player.pos });
    frame(1); assert.equal(w.combat.storyEncounter, null); assert.equal(w.combat.state.enemies.filter((enemy: any) => enemy.storyEncounter).length, 0);
  };
  try {
    for (const route of ['harbor', 'winter'] as const) await t.test(route, async () => {
      document.exitPointerLock(); w.worldProgress.reset(); w.falseDawnRuntime.invalidate();
      for (const flag of ['armory_rack', 'summon_circle', FALSE_DAWN.receiver]) w.done.add(flag);
      w.combat.reset(); w.worldProgress.save(); await enter(); frame(8);
      assert.equal(document.getElementById('world-tracked-story'), null, 'new session never auto-pins');
      await pinArc();
      assert.equal(w.settings.bind('mainRoute', 'KeyL', true), null); key('KeyL'); frame(8);
      assert.equal(document.getElementById('world-tracked-story'), null, 'custom original-route binding clears tracked block');
      await pinArc(); assert.match(document.getElementById('world-tracked-story')!.textContent!, /L/);
      start(FALSE_DAWN.recorder, 'false_dawn_courier');
      if (route === 'harbor') {
        // Actual cancellation is not victory and requires a new deliberate start.
        w.combat.cancelStoryEncounter(); frame(8); assert.equal(getFalseDawnState(w.done).stage, 'courier'); assert.ok(document.getElementById('world-tracked-story'));
        assert.equal(w.done.has(falseDawnEncounterFlags('false_dawn_courier').cleared), false);
        start(FALSE_DAWN.recorder, 'false_dawn_courier');
      }
      defeatActors(); assert.equal(getFalseDawnState(w.done).stage, 'route');
      inspect(FALSE_DAWN.recorder); choose(`route_${route}`); close();
      const station = route === 'harbor' ? FALSE_DAWN.harbor : FALSE_DAWN.winter;
      start(station, route === 'harbor' ? 'false_dawn_harbor' : 'false_dawn_winter_1'); defeatActors();
      if (route === 'winter') { start(station, 'false_dawn_winter_2'); defeatActors(); }
      inspect(station); choose('key_living'); close(); assert.equal(getFalseDawnState(w.done).stage, 'return');
      start(FALSE_DAWN.array, 'false_dawn_array');
      at(FALSE_DAWN.emitters[1]); key('KeyF'); assert.equal(w.done.has(FALSE_DAWN.anchors[1]), false);
      for (const [index, marker] of FALSE_DAWN.emitters.entries()) {
        at(marker);
        if (index === 0) { w.player.yaw = 0; document.body.dispatchEvent(new window.KeyboardEvent('keydown', { code: 'KeyS', bubbles: true })); }
        key('KeyF'); assert.equal(w.done.has(FALSE_DAWN.anchors[index]), true); assert.equal(w.narrative.open, false, 'physical switch is non-pausing');
        if (index === 0) {
          const before = w.player.pos.clone(); frame(5); key('KeyS');
          assert.ok(Math.hypot(w.player.pos.x - before.x, w.player.pos.z - before.z) > .01, 'accepted physical switch must not clear a held movement input');
          if (route === 'winter') {
            const oldIds = w.combat.state.enemies.filter((enemy: any) => enemy.storyEncounter).map((enemy: any) => enemy.id);
            w.combat.cancelStoryEncounter(); assert.ok(w.done.has(FALSE_DAWN.anchors[0]));
            assert.ok(new WorldProgress(window.localStorage).done.has(FALSE_DAWN.anchors[0]), 'partial work survives reload');
            start(FALSE_DAWN.array, 'false_dawn_array');
            assert.ok(w.combat.state.enemies.filter((enemy: any) => enemy.storyEncounter).every((enemy: any) => !oldIds.includes(enemy.id)), 'retry cannot alias stale actor targets');
          }
        }
      }
      defeatActors(); assert.equal(getFalseDawnState(w.done).stage, 'warden');
      start(FALSE_DAWN.array, 'false_dawn_warden'); defeatActors(); assert.equal(getFalseDawnState(w.done).stage, 'ending');
      inspect(FALSE_DAWN.array); choose(route === 'harbor' ? 'ending_repurpose' : 'ending_seal'); close();
      assert.equal(getFalseDawnState(w.done).stage, 'complete'); frame(8); assert.equal(document.getElementById('world-tracked-story'), null, 'completed continuation removes active objective');
      const reloaded = new WorldProgress(window.localStorage); assert.equal(getFalseDawnState(reloaded.done).ending, route === 'harbor' ? 'repurpose' : 'seal');
      assert.ok(window.localStorage.getItem(WORLD_PROGRESS_KEY)); assert.ok(w.done.has('summon_circle')); assert.equal(w.done.has('sun_core'), false);
      assert.ok(w.falseDawnSites.sites.every((site: any) => site.root.userData.falseDawnStage === 'complete'));
    });
    assert.deepEqual(h.errors, []); assert.deepEqual(h.warnings, []);
  } finally { await h.close(); }
});

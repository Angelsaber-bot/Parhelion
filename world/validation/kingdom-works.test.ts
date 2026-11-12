import assert from 'node:assert/strict';
import test from 'node:test';
import { Vector3 } from 'three';
import { WORLD_PROGRESS_KEY } from '../src/core/progress';
import { getEraBossRequirements } from '../src/story/eraStories';
import { KINGDOM_GATE } from '../src/story/kingdomGate';
import { KINGDOM_WORKS as K, KINGDOM_WATCH_ENCOUNTER, commitKingdomWork, kingdomWorksNext } from '../src/story/kingdomWorks';
import { ADVENTURE, adventureChapterComplete } from '../src/story/openWorldCampaign';
import { VALLEY_PROLOGUE } from '../src/story/valleyPrologue';
import { bootWorldWithoutGpu } from './world-dom-boot.fixture';

const seed = [ADVENTURE.started, ADVENTURE.online, 'armory_rack', 'saber_contract', KINGDOM_GATE.rescued, KINGDOM_GATE.open, 'hall_brazier_1'];

test('the watch lamp and evening bell gate a new journey without reopening cleared saves', () => {
  const done = new Set([...seed, VALLEY_PROLOGUE.room]);
  assert.equal(kingdomWorksNext(done)?.id, K.recall);
  assert.ok(getEraBossRequirements('sun_core', done)?.includes(K.lamp));
  assert.equal(commitKingdomWork(K.lamp, done), false);
  assert.equal(commitKingdomWork(K.bell, done), false);
  for (const work of [K.recall, K.release, K.abbey, K.secure, K.lamp]) assert.ok(commitKingdomWork(work, done), work);
  assert.equal(commitKingdomWork(K.market, done), false);
  assert.equal(commitKingdomWork(K.pin, done), false);
  done.add('sun_core');
  assert.equal(kingdomWorksNext(done)?.id, K.bell);
  assert.equal(adventureChapterComplete('britain', done), false);
  assert.ok(commitKingdomWork(K.bell, done));
  assert.equal(adventureChapterComplete('britain', done), true);
  assert.equal(adventureChapterComplete('britain', new Set([...seed, 'sun_core', VALLEY_PROLOGUE.room])), true);
});

test('the production kingdom can recall timber, shoot the hoist, repel guards, and ring the bell', async () => {
  const h = await bootWorldWithoutGpu({ deterministic: true, bootTimeoutMs: 120_000, initialStorage: {
    [WORLD_PROGRESS_KEY]: JSON.stringify({ done: [...seed, VALLEY_PROLOGUE.room, VALLEY_PROLOGUE.record], found: [] }),
  } });
  const w = h.world, d = h.window.document;
  let time = 0;
  const frame = (n = 1) => { for (let i = 0; i < n; i++) h.frame(time += 1000 / 60); };
  const marker = (id: string) => w.layout.markers.find((m: { id: string }) => m.id === id);
  function approach(id: string) {
    const m = marker(id); assert.ok(m, id);
    const floor = w.combat.geometry.ground(m.p[0], m.p[2], m.p[1] + 1.25);
    assert.ok(floor && Math.abs(floor.point.y + .9 - m.p[1]) < .65 && w.combat.geometry.clear(floor.point, .34, 1.7), id);
    w.player.teleport(floor.point.x, floor.point.y + .2, floor.point.z);
    frame(22);
  }
  function tap(id: string) {
    approach(id);
    const code = w.settings.bindingsFor('interact')[0];
    for (const type of ['keydown', 'keyup']) d.body.dispatchEvent(new h.window.KeyboardEvent(type, { code, bubbles: true, cancelable: true }));
  }
  try {
    (d.getElementById('start') as HTMLElement).click(); await Promise.resolve(); frame(3);
    tap(K.recall); assert.ok(w.done.has(K.recall), K.recall);
    tap(K.bread); assert.ok(w.done.has(K.bread), K.bread);
    tap(K.wheel); assert.ok(w.done.has(K.wheel), K.wheel);
    approach(K.release);
    const target = w.scene.getObjectByName('KingdomWatchLampTie');
    assert.ok(target?.visible);
    w.camera.position.copy(w.player.pos).add(new Vector3(0, 1.4, 0));
    w.camera.lookAt(target.getWorldPosition(new Vector3())); w.camera.updateMatrixWorld(true);
    const canvas = d.getElementById('view')!;
    for (const type of ['mousedown', 'mouseup']) canvas.dispatchEvent(new h.window.MouseEvent(type, { button: 0, bubbles: true, cancelable: true }));
    assert.ok(w.done.has(K.pin), K.pin);
    tap(K.market); assert.ok(w.done.has(K.market), K.market);
    tap(K.abbey); assert.ok(!w.done.has(K.abbey), K.abbey);
    tap(K.patrol);
    assert.equal(w.combat.storyEncounter?.id, KINGDOM_WATCH_ENCOUNTER, d.getElementById('toast')?.textContent ?? '');
    for (const enemy of [...w.combat.state.enemies].filter(e => e.storyEncounter === KINGDOM_WATCH_ENCOUNTER)) w.combat.damageEnemy(enemy.id, 1000);
    assert.ok(w.done.has(K.secure), K.secure);
    tap(K.lamp); assert.ok(w.done.has(K.lamp), K.lamp);
    assert.ok(marker('sun_core').requires.every((flag: string) => w.done.has(flag)));
    w.done.add('sun_core');
    tap(K.bell); assert.ok(w.done.has(K.bell), K.bell);
    assert.equal(adventureChapterComplete('britain', w.done), true);
    assert.ok(JSON.parse(h.window.localStorage.getItem(WORLD_PROGRESS_KEY)!).done.includes(K.bell));
  } finally { h.close(); }
});

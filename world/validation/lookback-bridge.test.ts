import assert from 'node:assert/strict';
import test from 'node:test';
import { Vector3 } from 'three';
import { WORLD_PROGRESS_KEY } from '../src/core/progress';
import { createWorldJourneySites } from '../src/environment/worldJourneySites';
import type { SettlementPlacement } from '../src/settlements/types';
import { Player } from '../src/player/player';
import { ADVENTURE as A } from '../src/story/openWorldCampaign';
import { VALLEY_PROLOGUE } from '../src/story/valleyPrologue';
import { commitJourneyStep, JOURNEY as J, journeyStepReady, worldJourneyGuide } from '../src/story/worldJourney';
import { bootWorldWithoutGpu } from './world-dom-boot.fixture';

const initial = [A.started, A.online, 'saber_contract', 'armory_rack', 'sun_core', VALLEY_PROLOGUE.record];
const routes = [J.bridge, J.bridgeSouth, J.bridgeRear] as const;

test('Lookback Bridge saves each choice, deploys its own collision and sends the visitor along it', () => {
  const residence = { position: [0, 5, 0] } as SettlementPlacement;
  for (const [index, route] of routes.entries()) {
    const done = new Set(initial);
    const create = () => createWorldJourneySites(residence, () => 4, () => true);
    const site = create(), restored = create();
    try {
      const marker = site.markers.find(value => value.id === J.bridge)!;
      const player = new Vector3(...marker.p);
      const actor = site.root.getObjectByName('Resident_journey_visitor_actor')!;
      const active = (s: typeof site, name: string) => s.colliders.find(c => c.name === name)?.enabled;
      site.apply(done);
      assert.equal(worldJourneyGuide('alpha', done)?.targetId, J.bridge);
      assert.equal(active(site, 'COL_LookbackNorthDeck'), false);
      assert.equal(active(site, 'COL_LookbackSouthDeck'), false);
      assert.equal(active(site, 'COL_JourneyLookbackRearGate'), true);
      assert.ok(commitJourneyStep(route, done));
      assert.ok(done.has(J.bridge));
      assert.equal(worldJourneyGuide('alpha', done)?.targetId, J.visitor);
      assert.equal(routes.some(id => journeyStepReady(id, done)), false);
      site.apply(done);
      site.update(.3, player);
      assert.equal(active(site, 'COL_LookbackNorthDeck'), false);
      assert.equal(active(site, 'COL_LookbackSouthDeck'), false);
      for (let i = 0; i < 10; i++) site.update(.2, player);
      const expectedZ = player.z + [0, 3.9, -4.6][index];
      assert.ok(Math.abs(actor.position.z - expectedZ) < .01);
      assert.equal(active(site, 'COL_LookbackNorthDeck'), index === 0);
      assert.equal(active(site, 'COL_LookbackSouthDeck'), index === 1);
      assert.equal(active(site, 'COL_JourneyLookbackRearGate'), index !== 2);
      for (let i = 0; i < 25; i++) site.update(.2, player);
      assert.ok(site.visitorArrived());
      assert.ok(commitJourneyStep(J.visitor, done));
      restored.apply(done);
      assert.ok(restored.visitorArrived());
      assert.equal(active(restored, 'COL_LookbackNorthDeck'), index === 0);
      assert.equal(active(restored, 'COL_LookbackSouthDeck'), index === 1);
      assert.equal(active(restored, 'COL_JourneyLookbackRearGate'), false);
      restored.apply(new Set([...done, J.finish]));
      assert.equal(active(restored, 'COL_LookbackSouthDeck'), false);
      assert.equal(active(restored, 'COL_LookbackRepairedWalk'), true);
    } finally {
      site.dispose();
      restored.dispose();
    }
  }
});

test('the south deck opens through actual World input and supports walking and the visitor handover', async () => {
  const h = await bootWorldWithoutGpu({ deterministic: true, initialStorage: {
    [WORLD_PROGRESS_KEY]: JSON.stringify({ done: initial, found: [] }),
  } });
  const w = h.world, d = h.window.document;
  let now = 0;
  const frame = (count: number, step = 1000 / 60) => { for (let i = 0; i < count; i++) h.frame(now += step); };
  const interact = () => {
    const code = w.settings.bindingsFor('interact')[0];
    for (const type of ['keydown', 'keyup']) d.body.dispatchEvent(new h.window.KeyboardEvent(type, { code, bubbles: true }));
  };
  const approach = (id: string) => {
    const marker = w.layout.markers.find(m => m.id === id)!;
    const floor = w.combat.geometry.ground(marker.p[0], marker.p[2], marker.p[1] + 1.25)!;
    w.player.teleport(floor.point.x, floor.point.y + .2, floor.point.z);
    frame(24);
  };
  try {
    (d.getElementById('start') as HTMLElement).click();
    frame(3);
    approach(J.bridgeSouth);
    interact();
    assert.ok(w.done.has(J.bridgeSouth));
    assert.ok(w.done.has(J.bridge));
    approach(J.visitor);
    interact();
    assert.equal(w.done.has(J.visitor), false);
    frame(78, 1000 / 12);
    const [x, y, z] = w.layout.markers.find(m => m.id === J.bridge)!.p;
    const southZ = z + 3.9;
    const deck = w.scene.getObjectByName('LookbackSouthDeck')!;
    assert.equal(deck.position.y, 0);
    const walker = new Player(w.colliders, w.layout.world.waterLevel);
    const floor = w.combat.geometry.ground(x, southZ, y + 2)!;
    walker.teleport(x, floor.point.y + .25, southZ);
    walker.yaw = -Math.PI / 2;
    let roseOntoDeck = false;
    for (let i = 0; i < 500 && walker.pos.x < x + 9.3; i++) {
      walker.step(1 / 120, { x: 0, z: 1, jump: false, sprint: false });
      if (Math.abs(walker.pos.x - x - 4.5) < .3) {
        const platform = w.combat.geometry.ground(walker.pos.x, southZ, y + 2)!;
        roseOntoDeck ||= walker.onGround && Math.abs(walker.pos.y - platform.point.y) < .15;
      }
    }
    assert.ok(roseOntoDeck, 'the walker used the deployed deck surface');
    assert.ok(walker.onGround && walker.pos.x >= x + 9.3, `crossing stopped at ${walker.pos.toArray()}`);
    interact();
    assert.ok(w.done.has(J.visitor));
    const saved = JSON.parse(h.window.localStorage.getItem(WORLD_PROGRESS_KEY)!);
    assert.ok(saved.done.includes(J.bridgeSouth));
    assert.ok(saved.done.includes(J.visitor));
    assert.deepEqual(h.errors, []);
  } finally { await h.close(); }
});

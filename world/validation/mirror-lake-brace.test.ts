import assert from 'node:assert/strict';
import test from 'node:test';
import { Vector3 } from 'three';
import { WORLD_PROGRESS_KEY } from '../src/core/progress';
import { createWorldJourneySites } from '../src/environment/worldJourneySites';
import type { SettlementPlacement } from '../src/settlements/types';
import { ADVENTURE as A } from '../src/story/openWorldCampaign';
import { VALLEY_PROLOGUE } from '../src/story/valleyPrologue';
import { commitJourneyStep, JOURNEY as J } from '../src/story/worldJourney';
import { bootWorldWithoutGpu } from './world-dom-boot.fixture';

const initial = [A.started, A.online, 'armory_rack', VALLEY_PROLOGUE.record];

test('both Mirror Lake solutions lower the frame and restore the settled pose from a save', () => {
  const residence = { position: [0, 5, 0] } as SettlementPlacement;
  const create = () => createWorldJourneySites(residence, () => 4.5, () => true);
  for (const route of [J.lakeWinch, J.lakePin]) {
    const sites = create(), restored = create(), done = new Set(initial);
    try {
      sites.apply(done);
      const frame = sites.root.getObjectByName('MirrorLakeGuideFrame')!;
      const winch = sites.markers.find(marker => marker.id === J.lakeWinch)!;
      const player = new Vector3(...winch.p);
      assert.equal(sites.lakeBrace(new Vector3()), undefined);
      assert.ok(sites.lakeBrace(player));
      assert.ok(commitJourneyStep(J.lake, done));
      sites.apply(done);
      assert.ok(sites.targets.find(target => target.userData.target === J.lakePin)?.visible);
      assert.ok(commitJourneyStep(route, done));
      sites.apply(done);
      assert.equal(sites.lakeBrace(player), undefined);
      assert.ok(frame.rotation.z > .2);
      sites.update(.27, player);
      assert.ok(frame.rotation.z > 0 && frame.rotation.z < .2);
      sites.update(.3, player);
      restored.apply(done);
      const saved = restored.root.getObjectByName('MirrorLakeGuideFrame')!;
      assert.equal(frame.rotation.z, 0);
      assert.deepEqual(frame.position.toArray(), saved.position.toArray());
      assert.equal(saved.rotation.z, 0);
      assert.equal(restored.lakeBrace(player), undefined);
    } finally {
      sites.dispose();
      restored.dispose();
    }
  }
});

test('the native Saber rig braces the guide and rejoins after the actual winch interaction', async () => {
  const h = await bootWorldWithoutGpu({ deterministic: true, initialStorage: {
    [WORLD_PROGRESS_KEY]: JSON.stringify({ done: initial, found: [] }),
  } });
  const w = h.world, d = h.window.document;
  let now = 0;
  const frame = (count: number) => { for (let i = 0; i < count; i++) h.frame(now += 1000 / 60); };
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
    approach(J.lake);
    await h.settleAssets();
    frame(30);
    const actor = w.servant;
    assert.equal(actor.state, 'ready');
    const grip = w.scene.getObjectByName('MirrorLakeGuideGrip')!.getWorldPosition(new Vector3());
    const hand = actor.root.getObjectByName('mixamorigLeftHand')!;
    assert.ok(hand, 'production rig');
    assert.ok(hand.getWorldPosition(new Vector3()).distanceTo(grip) < .08,
      `wrist at ${hand.getWorldPosition(new Vector3()).toArray()}, grip at ${grip.toArray()}`);
    const bracePosition = actor.root.position.clone();
    assert.ok(w.combat.geometry.clear(bracePosition.clone().add(new Vector3(0, .06, 0)), .32, 1.65));
    interact();
    assert.ok(w.done.has(J.lake));
    assert.ok(w.narrative.open);
    for (let i = 0; i < 5 && w.narrative.open; i++) interact();
    assert.equal(w.narrative.open, false);
    approach(J.lakeWinch);
    assert.deepEqual(actor.root.position.toArray(), bracePosition.toArray());
    interact();
    assert.ok(w.done.has(J.lakeWinch));
    frame(48);
    assert.equal(w.scene.getObjectByName('MirrorLakeGuideFrame')!.rotation.z, 0);
    assert.ok(w.contract.isFollowing('saber'));
    assert.ok(actor.root.position.distanceTo(w.player.pos) < 5);
    assert.ok(actor.root.position.distanceTo(bracePosition) > .2);
    assert.deepEqual(h.errors, []);
  } finally { await h.close(); }
});

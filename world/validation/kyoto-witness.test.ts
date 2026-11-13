import assert from 'node:assert/strict';
import test from 'node:test';
import { Vector3 } from 'three';
import { WORLD_PROGRESS_KEY } from '../src/core/progress';
import { createAdventureRuntime } from '../src/story/adventureRuntime';
import { ADVENTURE_ACTIONS } from '../src/story/adventureSites';
import { getEraBossRequirements } from '../src/story/eraStories';
import { KYOTO_WITNESS as Y } from '../src/story/kyotoWitness';
import { ADVENTURE as A, getAdventureGuide } from '../src/story/openWorldCampaign';
import { VALLEY_PROLOGUE } from '../src/story/valleyPrologue';
import { bootWorldWithoutGpu } from './world-dom-boot.fixture';

// The street-works chapter (letter, both cargo books) now precedes the witness flow.
const flags = [A.started, A.online, 'armory_rack', 'musashi_meet', 'kikyo_banner_1', 'kikyo_banner_2', 'kikyo_banner_3', VALLEY_PROLOGUE.room,
  'adventure_kyoto_street_envelope', 'adventure_kyoto_street_letter', 'adventure_kyoto_street_temple_record', 'adventure_kyoto_street_camp_record'];
const frame = { dt: .05, held: false, playable: true, grounded: true, moving: false, attacking: false, inRange: true };

test('Kyoto accepts manual rescue and a sealed handover, and protects existing victories', () => {
  const done = new Set(flags);
  const runtime = createAdventureRuntime({
    done, actions: new Map(ADVENTURE_ACTIONS.map(action => [action.id, action])), path: [[0, 0, 0], [1, 0, 0]],
    reachable: () => true, save: () => true, changed() {}, toast() {}, damage: () => 0,
    encounter: () => null, start: () => ({ ok: false }), cancel() {}, supply: () => false, moveCart: () => true,
  });
  assert.equal(getAdventureGuide('kyoto', done)?.targetId, Y.reel);
  runtime.interact(Y.private); assert.ok(!done.has(A.water));
  runtime.hit(Y.pin); assert.ok(!done.has(Y.pin));
  for (const id of [Y.reel, Y.stop, Y.winch]) runtime.interact(id);
  runtime.interact(Y.testimony); runtime.update(frame);
  for (let i = 0; i < 42; i++) runtime.update({ ...frame, held: true });
  assert.ok(done.has(Y.testimony));
  runtime.interact(Y.private); assert.ok(done.has(Y.private)); assert.ok(done.has(A.water));
  runtime.interact(Y.public); assert.ok(!done.has(Y.public));
  // The decree court chapters (J03 lords, J07 fire night, J08 entry) also gate the boss for new runs;
  // they are played in regional-field-chapters tests. With them done, the witness flow is the last gate.
  const witnessOnly = getEraBossRequirements('fire_core', done)!.filter(id => !done.has(id));
  assert.deepEqual(witnessOnly.filter(id => !/^j0[378]_/.test(id)), []);
  for (const id of ['j03_complete', 'j07_complete', 'j08_offer', 'j08_entered']) done.add(id);
  assert.ok(getEraBossRequirements('fire_core', done)?.every(id => done.has(id)));
  done.add('fire_core'); assert.equal(getAdventureGuide('kyoto', done)?.targetId, Y.gate);
  assert.equal(getAdventureGuide('kyoto', new Set([...flags, 'fire_core']))?.targetId, A.evidence);
});

test('the production Kyoto route responds to two shots, public handover and the fire screen', async () => {
  const h = await bootWorldWithoutGpu({ deterministic: true, bootTimeoutMs: 120_000, initialStorage: {
    [WORLD_PROGRESS_KEY]: JSON.stringify({ done: [...flags, VALLEY_PROLOGUE.record], found: [] }),
  } });
  const w = h.world, d = h.window.document;
  let time = 0;
  const step = (n = 1) => { for (let i = 0; i < n; i++) h.frame(time += 1000 / 60); };
  function approach(id: string) {
    const m = w.layout.markers.find((marker: { id: string }) => marker.id === id); assert.ok(m, id);
    const ground = w.combat.geometry.ground(m.p[0], m.p[2], m.p[1] + 1.25);
    assert.ok(ground && Math.abs(ground.point.y + .9 - m.p[1]) < .65 && w.combat.geometry.clear(new Vector3(ground.point.x, ground.point.y, ground.point.z), .34, 1.7), `${id}: stand ${m.p}, floor ${ground?.point.y}`);
    w.player.teleport(ground.point.x, ground.point.y + .2, ground.point.z); step(24);
  }
  function key(type: 'keydown' | 'keyup') {
    d.body.dispatchEvent(new h.window.KeyboardEvent(type, { code: w.settings.bindingsFor('interact')[0], bubbles: true, cancelable: true }));
  }
  function tap() { key('keydown'); key('keyup'); }
  function interact(id: string) { approach(id); tap(); }
  function hold(id: string) { interact(id); step(2); key('keydown'); step(130); key('keyup'); }
  function shoot(id: string, station: string) {
    approach(station);
    const mesh = w.scene.getObjectByName(id); assert.ok(mesh?.visible, id);
    w.camera.position.copy(w.player.pos).add(new Vector3(0, 1.4, 0));
    w.camera.lookAt(mesh.getWorldPosition(new Vector3())); w.camera.updateMatrixWorld(true);
    for (const type of ['mousedown', 'mouseup'])
      d.getElementById('view')!.dispatchEvent(new h.window.MouseEvent(type, { button: 0, bubbles: true, cancelable: true }));
  }
  try {
    (d.getElementById('start') as HTMLElement).click(); await Promise.resolve(); step(3);
    interact(Y.reel); assert.ok(w.done.has(Y.reel));
    shoot('KyotoScrollBelt', Y.stop); assert.ok(w.done.has(Y.cut));
    shoot('KyotoPaperLiftPin', Y.winch); assert.ok(w.done.has(Y.pin));
    hold(Y.testimony); assert.ok(w.done.has(Y.testimony));
    interact(Y.public); assert.ok(w.done.has(Y.public));
    approach(Y.private); assert.ok(!w.done.has(Y.private));
    w.done.add('fire_core');
    interact(A.evidence); assert.equal(w.adventureRuntime.channel, null);
    const screen = w.colliders.find(collider => collider.name === 'COL_KyotoWitnessFireScreen');
    assert.ok(screen?.enabled);
    interact(Y.gate); assert.ok(w.done.has(Y.gate));
    assert.equal(screen.enabled, false);
    hold(A.evidence); assert.ok(w.done.has(A.evidence));
  } finally { await h.close(); }
});

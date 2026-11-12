import assert from 'node:assert/strict';
import test from 'node:test';
import { Vector3 } from 'three';
import { WORLD_PROGRESS_KEY } from '../src/core/progress';
import { createAdventureRuntime } from '../src/story/adventureRuntime';
import { ADVENTURE_ACTIONS } from '../src/story/adventureSites';
import { getEraBossRequirements } from '../src/story/eraStories';
import { medicineCartPathClear } from '../src/story/medicineCartNavigation';
import { ADVENTURE as A, getAdventureGuide } from '../src/story/openWorldCampaign';
import { VALLEY_PROLOGUE } from '../src/story/valleyPrologue';
import { WINTER_WITHDRAWAL as W, WINTER_CART_PREFIX, WINTER_MILL_CART_PREFIX } from '../src/story/winterWithdrawal';
import { bootWorldWithoutGpu } from './world-dom-boot.fixture';

const flags = [A.started, A.online, 'armory_rack', 'napoleon_meet', 'shard_bell', A.road, VALLEY_PROLOGUE.room];
const frame = { dt: .05, held: false, playable: true, grounded: true, moving: false, attacking: false, inRange: true };
const actions = new Map(ADVENTURE_ACTIONS.map(action => [action.id, action]));
function runtime(done: Set<string>) {
  return createAdventureRuntime({
    done, actions, path: [[0, 4, 0], [1, 4, 0], [2, 4, 0]], millPath: [[0, 4, 0], [0, 4, 2], [2, 4, 0]],
    reachable: () => true, save: () => true, changed() {}, toast() {}, damage: () => 0, encounter: () => null,
    start: () => ({ ok: false }), cancel() {}, supply: () => false, moveCart: () => true,
  });
}

test('winter choice and route checkpoints survive reload without redirecting legacy convoys', () => {
  const done = new Set(flags), h = runtime(done);
  assert.equal(getAdventureGuide('winter', done)?.targetId, W.mill);
  assert.ok(getEraBossRequirements('winter_core', done)?.includes(W.retreat));
  h.interact(W.retreat); assert.equal(done.has(W.retreat), false);
  h.interact(W.mill); h.update(frame);
  for (let i = 0; i < 42; i++) h.update({ ...frame, held: true });
  h.interact(W.retreat); assert.ok(done.has(W.retreat));
  h.interact(W.redoubt); assert.equal(h.channel, null);
  done.add('winter_core'); h.interact('adventure_winter_convoy');
  for (let i = 0; i < 16; i++) h.update(frame);
  assert.ok(done.has(WINTER_MILL_CART_PREFIX + '1'));
  const restored = runtime(new Set(done));
  assert.deepEqual(restored.cartPosition, [0, 4, 2]);
  const original = runtime(new Set([...flags, 'winter_core', A.convoy, WINTER_CART_PREFIX + '1']));
  assert.deepEqual(original.cartPosition, [1, 4, 0]);
});

test('the actual withdrawal switches on the mill bridge and its cart route clears every segment', async () => {
  const h = await bootWorldWithoutGpu({ deterministic: true, bootTimeoutMs: 120_000, initialStorage: {
    [WORLD_PROGRESS_KEY]: JSON.stringify({ done: [...flags, VALLEY_PROLOGUE.record], found: [] }),
  } });
  const w = h.world, d = h.window.document;
  let time = 0;
  const step = (n = 1) => { for (let i = 0; i < n; i++) h.frame(time += 1000 / 60); };
  const marker = (id: string) => w.layout.markers.find((m: { id: string }) => m.id === id);
  function approach(id: string) {
    const m = marker(id); assert.ok(m, id);
    const floor = w.combat.geometry.ground(m.p[0], m.p[2], m.p[1] + 1.25);
    assert.ok(floor && Math.abs(floor.point.y + .9 - m.p[1]) < .65 && w.combat.geometry.clear(new Vector3(floor.point.x, floor.point.y, floor.point.z), .34, 1.7), id);
    w.player.teleport(floor.point.x, floor.point.y + .2, floor.point.z); step(22);
  }
  function key(type: 'keydown' | 'keyup') {
    d.body.dispatchEvent(new h.window.KeyboardEvent(type, { code: w.settings.bindingsFor('interact')[0], bubbles: true, cancelable: true }));
  }
  function tap() { key('keydown'); key('keyup'); }
  try {
    (d.getElementById('start') as HTMLElement).click(); await Promise.resolve(); step(3);
    const bridge = w.colliders.find(collider => collider.name === 'COL_WinterMillBridge'); assert.ok(bridge);
    assert.equal(bridge.enabled, false);
    approach(W.redoubt); approach(W.mill); tap(); step(2);
    key('keydown'); step(130); key('keyup');
    assert.ok(w.done.has(W.mill), d.getElementById('toast')?.textContent ?? W.mill);
    assert.equal(bridge.enabled, true);
    approach(W.retreat); tap(); assert.ok(w.done.has(W.retreat));
    assert.ok(marker('winter_core').requires.every((flag: string) => w.done.has(flag)));
    const original = w.adventureSites.convoyPath, mill = w.adventureSites.millConvoyPath;
    assert.ok(original.some(p => p[0] > 85 && p[2] > -600 && p[2] < -580));
    assert.ok(mill.some(p => p[0] < 68 && p[2] > -600 && p[2] < -580));
    for (const route of [original, mill]) for (let leg = 1; leg < route.length; leg++) {
      const a = route[leg - 1], b = route[leg];
      const surface = w.combat.geometry.contactSurface({ minX: Math.min(a[0],b[0])-3, maxX: Math.max(a[0],b[0])+3, minZ: Math.min(a[2],b[2])-3, maxZ: Math.max(a[2],b[2])+3 });
      assert.ok(medicineCartPathClear(surface, a, b), `blocked ${route === mill ? 'mill' : 'redoubt'} cart leg ${leg}: ${a}, ${b}`);
    }
  } finally { await h.close(); }
});

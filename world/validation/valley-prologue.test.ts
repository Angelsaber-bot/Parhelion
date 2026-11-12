import assert from 'node:assert/strict';
import test from 'node:test';
import { Vector3 } from 'three';
import { ARMORY_MARKER, WORLD_PROGRESS_KEY } from '../src/core/progress';
import { advanceValleyPrologue, VALLEY_PROLOGUE as P, valleyPrologueStage } from '../src/story/valleyPrologue';
import { bootWorldWithoutGpu } from './world-dom-boot.fixture';

test('prologue choices are exclusive, resume from saved actions and preserve existing campaigns', () => {
  for (const [cart, release] of [[P.cartStop, P.breaker], [P.cartReturn, P.pin]]) {
    const done = new Set<string>();
    const act = (id: string) => advanceValleyPrologue(valleyPrologueStage(done), id, done);
    assert.equal(act(P.radio), null);
    assert.ok(act(P.steward));
    assert.ok(act(cart));
    assert.equal(act(cart === P.cartStop ? P.cartReturn : P.cartStop), null);
    assert.equal(valleyPrologueStage(new Set(done)), 'armory');
    done.add(ARMORY_MARKER);
    assert.ok(act(P.radio));
    assert.ok(act(P.survey));
    assert.equal(act(P.ratchet), null);
    assert.ok(act(release));
    assert.equal(act(release === P.breaker ? P.pin : P.breaker), null);
    assert.equal(valleyPrologueStage(new Set(done)), 'secure');
    assert.equal(act(P.record), null);
    assert.ok(act(P.ratchet));
    assert.ok(act(P.record));
    assert.equal(act(P.record), null);
    assert.equal(valleyPrologueStage(new Set(done)), 'complete');
  }
  for (const id of ['armory_rack', 'hq_terminal', 'valley_story_met', 'valley_route_note', 'adventure_v2']) {
    assert.equal(valleyPrologueStage(new Set([id])), 'legacy', id);
  }
});

test('fresh World: real inputs save the cart and a shot opens the rescue route', async () => {
  const h = await bootWorldWithoutGpu({ deterministic: true });
  const w = h.world, d = h.window.document;
  let now = 0;
  const frame = (n = 1) => { for (let i = 0; i < n; i++) h.frame(now += 1000 / 60); };
  const tap = (action: string) => {
    const code = w.settings.bindingsFor(action)[0];
    for (const type of ['keydown', 'keyup']) d.body.dispatchEvent(new h.window.KeyboardEvent(type, { code, bubbles: true, cancelable: true }));
  };
  const marker = (id: string) => {
    const result = w.layout.markers.find((m: { id: string }) => m.id === id);
    assert.ok(result, id);
    return result.p as [number, number, number];
  };
  const place = (x: number, y: number, z: number) => {
    const floor = w.combat.geometry.ground(x, z, y + 1.7);
    assert.ok(floor && Math.abs(floor.point.y - y) < 1.4, `floor at ${[x, y, z]}`);
    assert.ok(w.combat.geometry.clear(floor.point, .34, 1.8), `clear stance at ${[x, y, z]}`);
    w.player.teleport(x, floor.point.y + .22, z);
    frame(30);
    assert.ok(w.player.onGround && !w.player.swimming);
  };
  const closeDialogue = () => {
    for (let i = 0; i < 12 && w.narrative.open; i++) tap('interact');
    assert.equal(w.narrative.open, false);
  };
  const use = (id: string, dx = 0, dz = 0) => {
    const [x, y, z] = marker(id);
    place(x + dx, y, z + dz);
    tap('interact');
  };
  try {
    (d.getElementById('start') as HTMLElement).click();
    await Promise.resolve();
    frame(30);
    assert.match(d.getElementById('objective')!.textContent!, /孟槐/);
    const [sx, sy, sz] = w.settlementNpcs.getPosition(P.steward);
    assert.ok(w.player.pos.distanceTo(new Vector3(sx, sy, sz)) < 6, 'new game starts at the residence');
    place(sx, sy, sz + 1.1);
    tap('interact');
    assert.ok(w.done.has(P.briefed));
    closeDialogue();
    use(P.cartStop, 0, .35);
    assert.ok(w.done.has(P.cartStop));
    closeDialogue();
    use(ARMORY_MARKER, -.6, -1);
    assert.ok(w.worldProgress.armed);
    closeDialogue();
    use(P.radio, 0, .4);
    assert.ok(w.done.has(P.radio));
    assert.match(d.getElementById('world-dialogue-text')!.textContent!, /18:39.*18:42/);
    closeDialogue();
    use(P.survey, 0, .25);
    assert.ok(w.done.has(P.survey));
    const pin = w.scene.getObjectByName('TGT_ValleyProloguePin');
    assert.ok(pin.visible);
    const point = pin.getWorldPosition(new Vector3());
    const cutoff = marker(P.breaker);
    const front = new Vector3(cutoff[0], cutoff[1] + .15, cutoff[2] + .55);
    place(cutoff[0], cutoff[1], cutoff[2] + .55);
    assert.match(d.getElementById('prompt')!.textContent!, /急停/);
    assert.ok(w.combat.geometry.cast(front, point.clone().sub(front), front.distanceTo(point) - .1), 'front approach is screened from the pin');
    place(point.x + 4, point.y, point.z);
    w.camera.position.copy(w.player.pos).add(new Vector3(0, 1.4, 0));
    w.camera.lookAt(point);
    w.camera.updateMatrixWorld(true);
    d.getElementById('view')!.dispatchEvent(new h.window.MouseEvent('mousedown', { button: 0, bubbles: true, cancelable: true }));
    d.getElementById('view')!.dispatchEvent(new h.window.MouseEvent('mouseup', { button: 0, bubbles: true, cancelable: true }));
    assert.ok(w.done.has(P.pin), 'shot goes through production weapon hit handling');
    const gate = w.colliders.find((c: { name: string }) => c.name === 'VALLEY_PrologueEscapeGate');
    assert.equal(gate.enabled, true, 'release alone leaves the gate closed');
    use(P.ratchet, 0, .35);
    assert.ok(w.done.has(P.ratchet));
    assert.equal(gate.enabled, false);
    frame(190);
    use(P.record, 0, .45);
    assert.ok(w.done.has(P.record));
    assert.ok(w.done.has('adventure_v2'));
    assert.match(d.getElementById('objective')!.textContent!, /岚/);
    const saved = JSON.parse(h.window.localStorage.getItem(WORLD_PROGRESS_KEY)!);
    assert.ok(saved.done.includes(P.record));
    assert.ok(!saved.done.includes('compact_relay_complete'), 'the rescue does not skip the next mission');
    assert.ok(w.combat.geometry.safeCompactRelaySpawn(-51, 228), 'the nearby prologue does not block the first uplink guard');
    assert.ok(w.combat.geometry.safeCompactRelaySpawn(-64, 218), 'the nearby prologue does not block the second uplink guard');
    assert.deepEqual(h.errors, []);
  } finally { await h.close(); }
});

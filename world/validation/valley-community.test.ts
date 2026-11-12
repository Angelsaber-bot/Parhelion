import assert from 'node:assert/strict';
import { test } from 'node:test';
import { COMPANIONS } from '../src/companions/contracts';
import { WORLD_PROGRESS_KEY } from '../src/core/progress';
import { FREIGHT_YARD as Y, MIST_RESCUE as M, NEXT_SHIFT as N, OLD_TICKET as T,
  VALLEY_COMMUNITY_STEPS, chooseFreightYard, valleyCommunityReady } from '../src/story/valleyCommunity';
import { JOURNEY } from '../src/story/worldJourney';
import { bootWorldWithoutGpu } from './world-dom-boot.fixture';

test('the yard requires both trials and the final layout remains exclusive', () => {
  const done = new Set<string>([Y.notice, Y.loadTest]);
  assert.ok(!valleyCommunityReady(Y.decision, done));
  done.add(Y.east);
  assert.ok(valleyCommunityReady(Y.decision, done));
  for (const choice of ['training', 'workshop'] as const) {
    chooseFreightYard(done, choice);
    assert.ok(done.has(Y[choice]));
    assert.ok(!done.has(Y[choice === 'training' ? 'workshop' : 'training']));
  }
  assert.ok(!valleyCommunityReady(Y.decision, done));
  assert.ok(!valleyCommunityReady(N.orders, done));
});

test('normal World input rescues the worker, runs both freight trials, follows Tao and sends out the next cart', async () => {
  const h = await bootWorldWithoutGpu({ deterministic: true, initialStorage: {
    [WORLD_PROGRESS_KEY]: JSON.stringify({ done: ['armory_rack', 'summon_circle', COMPANIONS[0].contract, JOURNEY.cargo, JOURNEY.epilogue], found: [] }),
  } });
  const { world: w, window } = h, d = window.document;
  let time = 0, saved = '';
  const frame = (n = 1) => { for (let i = 0; i < n; i++) h.frame(time += 1000 / 60); };
  const tap = (action = 'interact') => {
    const code = w.settings.bindingsFor(action)[0];
    for (const type of ['keydown', 'keyup']) d.body.dispatchEvent(new window.KeyboardEvent(type, { code, bubbles: true, cancelable: true }));
  };
  const marker = (id: string) => w.layout.markers.find((m: { id: string }) => m.id === id);
  const approach = (id: string) => {
    const m = marker(id);
    assert.ok(m, id);
    const floor = w.combat.geometry.ground(m.p[0], m.p[2], m.p[1] + 1.3);
    assert.ok(floor && Math.abs(floor.point.y + .9 - m.p[1]) < .7, id + ' floor ' + floor?.point.y);
    w.player.teleport(m.p[0], floor.point.y + .16, m.p[2]);
    frame(30);
    assert.ok(w.player.onGround, id);
  };
  const dismiss = () => { for (let i = 0; i < 8 && w.narrative.open; i++) tap(); assert.ok(!w.narrative.open); };
  const use = (id: string) => { approach(id); tap(); dismiss(); };
  const act = (id: string) => {
    use(id);
    assert.ok(w.done.has(id), id + ' ' + d.getElementById('prompt')?.textContent + ' ' + d.getElementById('toast')?.textContent);
  };
  const nearbyPartner = (id: string) => {
    approach(id);
    frame(125);
    tap(); dismiss();
    assert.ok(w.done.has(id), id + ' ' + d.getElementById('toast')?.textContent);
  };
  const findCollider = (id: string) => w.colliders.find((c: { name: string }) => c.name === 'COL_' + id);
  try {
    (d.getElementById('start') as HTMLElement).click(); await Promise.resolve(); frame(8); await h.settleAssets(); frame(10);
    for (const id of VALLEY_COMMUNITY_STEPS.keys()) assert.ok(marker(id), 'missing site ' + id);

    [M.intake, M.lower, M.upper, M.hatch].forEach(act);
    assert.equal(findCollider('ValleyMistBentHatch').enabled, false);
    use(M.safe);
    assert.ok(!w.done.has(M.safe), 'must wait for the worker');
    frame(270); act(M.safe);
    assert.equal(findCollider('ValleyMistMaintenanceRamp').enabled, true);
    assert.ok(w.scene.getObjectByName('ValleyOutpostRepairedCanopy').visible);
    const [endX, , endZ] = marker(M.upper).p;
    for (const [x, z] of [[162.4, -60], [endX, endZ]]) {
      const distance = () => Math.hypot(w.player.pos.x - x, w.player.pos.z - z);
      for (let i = 0; i < 800 && distance() > .35; i++) {
        w.player.yaw = Math.atan2(w.player.pos.x - x, w.player.pos.z - z);
        w.player.step(1 / 120, { x: 0, z: 1, jump: false, sprint: false });
      }
      assert.ok(distance() < .35, `maintenance path blocked at ${w.player.pos.toArray()} toward ${x},${z}`);
    }

    act(Y.notice);
    if (!w.contract.following) { tap('summon'); await h.settleAssets(); frame(20); }
    assert.equal(w.contract.following, 'saber');
    [Y.practice, Y.west, Y.east, Y.variant, Y.variantDone].forEach(nearbyPartner);
    act(Y.load); use(Y.loadTest);
    assert.ok(!w.done.has(Y.loadTest));
    frame(150); act(Y.loadTest);
    approach(Y.decision); tap();
    const choices = Array.from(d.querySelectorAll('button')).filter(b => b.textContent?.includes('保留共同工坊'));
    assert.equal(choices.length, 1);
    choices[0].click(); dismiss();
    assert.ok(w.done.has(Y.workshop));
    assert.ok(!w.scene.getObjectByName('ValleyFreightTrainingLayout').visible);
    assert.ok(w.scene.getObjectByName('ValleyFreightWorkshopLayout').visible);

    act(T.meet); use(T.mile); assert.ok(!w.done.has(T.mile));
    frame(285); act(T.mile); frame(285); act(T.terminus);
    assert.ok(w.scene.getObjectByName('ValleyUnsentRailTicket').visible);

    act(N.orders); act(N.load); act(N.brake);
    const cart = w.scene.getObjectByName('ValleyNextDepartureCart');
    const before = cart.position.clone();
    act(N.handoff); frame(310);
    assert.ok(cart.position.distanceTo(before) > 5);
    saved = window.localStorage.getItem(WORLD_PROGRESS_KEY)!;
    const done: string[] = JSON.parse(saved).done;
    for (const id of [M.safe, Y.workshop, Y.variantDone, T.terminus, N.handoff]) assert.ok(done.includes(id), id);
    assert.deepEqual(h.errors, []);
  } finally { await h.close(); }

  const reloaded = await bootWorldWithoutGpu({ deterministic: true, initialStorage: { [WORLD_PROGRESS_KEY]: saved } });
  try {
    const w = reloaded.world;
    assert.ok(w.scene.getObjectByName('ValleyFreightWorkshopLayout').visible);
    assert.ok(w.scene.getObjectByName('ValleyUnsentRailTicket').visible);
    assert.equal(w.colliders.find((c: { name: string }) => c.name === 'COL_ValleyMistMaintenanceRamp').enabled, true);
  } finally { await reloaded.close(); }
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Vector3 } from 'three';
import { WORLD_PROGRESS_KEY } from '../src/core/progress';
import { VALLEY_FIELD as F } from '../src/story/valleyField';
import { FIFTH_ROAD as R, REPLAY_TEST as B, WATERWORKS as W, VALLEY_INVESTIGATIONS, valleyInvestigationReady } from '../src/story/valleyInvestigations';
import { bootWorldWithoutGpu } from './world-dom-boot.fixture';

test('the investigation tools accept either evidence order and require both independent observations', () => {
  for (const first of [B.plate, B.bell]) {
    const done = new Set<string>([B.desk, first]);
    assert.equal(valleyInvestigationReady(B.cache, done), false);
    done.add(first === B.plate ? B.bell : B.plate);
    assert.ok(valleyInvestigationReady(B.cache, done));
    assert.ok(valleyInvestigationReady(first, done), 'the experiments can be repeated');
  }
});

test('Valley investigations use the melee contact path, safe water transitions and repeatable window experiments', async () => {
  const h = await bootWorldWithoutGpu({ deterministic: true, initialStorage: {
    [WORLD_PROGRESS_KEY]: JSON.stringify({ done: ['armory_rack'], found: [] }),
  } });
  const { world: w, window } = h, d = window.document;
  let time = 0;
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
    assert.ok(floor && Math.abs(floor.point.y + .9 - m.p[1]) < .7, `${id}: floor ${floor?.point.y} at ${m.p}`);
    w.player.teleport(m.p[0], floor.point.y + .16, m.p[2]);
    frame(25);
    assert.ok(w.player.onGround, id);
  };
  const dismiss = () => {
    for (let i = 0; i < 8 && w.narrative.open; i++) tap();
    assert.equal(w.narrative.open, false);
  };
  const use = (id: string) => { approach(id); tap(); dismiss(); };
  const act = (id: string) => { use(id); assert.ok(w.done.has(id), `${id}: ${d.getElementById('prompt')?.textContent}`); };
  const collider = (id: string) => w.colliders.find((c: { name: string }) => c.name === 'COL_' + id);
  const walk = (x: number, z: number) => {
    const distance = () => Math.hypot(w.player.pos.x - x, w.player.pos.z - z);
    for (let i = 0; i < 360 && distance() > .3; i++) {
      w.player.yaw = Math.atan2(w.player.pos.x - x, w.player.pos.z - z);
      w.player.step(1 / 120, { x: 0, z: 1, jump: false, sprint: false });
    }
    assert.ok(distance() <= .3, `blocked at ${w.player.pos.toArray()} toward ${x},${z}`);
  };
  try {
    (d.getElementById('start') as HTMLElement).click(); await Promise.resolve(); frame(4);
    for (const chain of VALLEY_INVESTIGATIONS) for (const step of chain.steps) assert.ok(marker(step.id), step.id);
    assert.equal(collider('ValleyDryChannelGrate').enabled, true);
    act(R.map); act(R.trace);
    const lock = w.scene.getObjectByName('ValleyFifthRoadRustLock');
    assert.ok(lock?.visible);
    const point = lock.getWorldPosition(new Vector3());
    w.player.yaw = Math.atan2(w.player.pos.x - point.x, w.player.pos.z - point.z);
    tap('melee'); frame(60);
    assert.ok(w.done.has(R.lock), 'ordinary melee breaks the rusted lock');
    assert.equal(collider('ValleyDryChannelGrate').enabled, false);
    const [, , entranceZ] = marker(R.trace).p;
    const [exitX, , exitZ] = marker(R.gate).p;
    walk(exitX, exitZ);
    frame(2); tap(); dismiss();
    assert.ok(w.done.has(R.gate));
    assert.equal(collider('ValleyFifthRoadBackGate').enabled, false);
    walk(exitX, exitZ - 1.5);
    assert.ok(w.player.pos.z < entranceZ - 5);

    [W.gauge, W.seal, W.fill].forEach(act);
    frame(151); act(W.divert);
    use(W.drain);
    const waterStatus = () => JSON.stringify({
      prompt: d.getElementById('prompt')?.textContent, toast: d.getElementById('toast')?.textContent,
      pool: w.scene.getObjectByName('MirrorLakeServicePool')?.position.toArray(), player: w.player.pos.toArray(),
    });
    const requested = waterStatus();
    assert.equal(w.done.has(W.low), false, 'transient water levels are not persisted');
    frame(105);
    assert.ok(w.done.has(W.low), `${requested} → ${waterStatus()}`);
    assert.equal(collider('MirrorLakePoolGate').enabled, false);
    const [basinX, , basinZ] = marker(W.foundation).p;
    const ground = w.combat.geometry.ground(basinX, basinZ + 3.2, marker(W.foundation).p[1] + 1.3);
    assert.ok(ground);
    w.player.teleport(basinX, ground.point.y + .12, basinZ + 3.2);
    frame(25); walk(basinX, basinZ);
    frame(25); tap(); dismiss();
    assert.ok(w.done.has(W.foundation), `${waterStatus()} foundation at ${marker(W.foundation).p}`);
    use(W.restore); frame(105);
    assert.equal(w.done.has(W.low), false);
    assert.equal(collider('MirrorLakePoolGate').enabled, true);
    assert.ok(w.done.has(W.foundation), 'refilling preserves the evidence');
    use(W.drain); frame(105);
    assert.ok(w.done.has(W.low));

    act(B.desk); act(B.bell);
    assert.equal(w.done.has(B.cache), false);
    const real = w.scene.getObjectByName('BroadcastActualPlate');
    const recorded = w.scene.getObjectByName('BroadcastRecordedPlate');
    const recordingAngle = recorded.rotation.z;
    act(B.plate); frame(54);
    assert.ok(real.rotation.y > 2.7);
    assert.equal(recorded.rotation.z, recordingAngle);
    act(B.plate); frame(54);
    assert.ok(real.rotation.y < .2);
    act(B.cache); act(B.compare);
    assert.ok(w.done.has(F.replay), 'the full investigation satisfies the later recording check');
    const saved: { done: string[] } = JSON.parse(window.localStorage.getItem(WORLD_PROGRESS_KEY)!);
    for (const id of [R.gate, W.low, W.foundation, B.compare, F.replay]) assert.ok(saved.done.includes(id), id);
    assert.deepEqual(h.errors, []);
  } finally { await h.close(); }
});

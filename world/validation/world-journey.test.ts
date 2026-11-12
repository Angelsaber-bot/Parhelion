import assert from 'node:assert/strict';
import test from 'node:test';
import { Vector3 } from 'three';
import { WORLD_PROGRESS_KEY } from '../src/core/progress';
import { EGYPT_MIRRORS } from '../src/map/egyptPlan';
import { ORLEANS_WORKS } from '../src/map/orleansWorks';
import { QIN_ARMY } from '../src/map/qinPlan';
import { createHelionFight, SKY_BOSS, SKY_ORIGIN, SKY_SHUTTERS } from '../src/story/helionFight';
import { ADVENTURE as A } from '../src/story/openWorldCampaign';
import { commitJourneyStep, JOURNEY as J, SKY_MARKERS as M, SKY_PHASES, journeyTowerReady, worldJourneyGuide } from '../src/story/worldJourney';
import { VALLEY_PROLOGUE } from '../src/story/valleyPrologue';
import { bootWorldWithoutGpu } from './world-dom-boot.fixture';

const four = [A.started, A.online, 'armory_rack', 'saber_contract', 'sun_core', A.arrived, 'napoleon_contract', A.departed, 'blackbeard_contract', A.evidence, 'musashi_contract'];

test('seven-region route keeps saved demo endings, accepts either branch, and requires a real sky victory', () => {
  const done = new Set([...four, A.ending]);
  const act = (id: string) => assert.ok(commitJourneyStep(id, done), id);
  assert.equal(worldJourneyGuide('alpha', done)?.targetId, J.meal);
  assert.equal(commitJourneyStep(J.finish, done), null);
  assert.equal(journeyTowerReady(done), false);
  [J.meal, J.cargo, J.signal, J.compare, J.bypass, J.orleansRead].forEach(act);
  assert.equal(commitJourneyStep(J.cutoff, done), null);
  assert.equal(commitJourneyStep(J.qinRead, done), null);
  for (const flag of [ORLEANS_WORKS.craneDone, ORLEANS_WORKS.sluiceDone, ORLEANS_WORKS.bellDone]) done.add(flag);
  [J.orleansFlag, J.orleansBrace, J.orleansDone, J.egyptRead].forEach(act);
  assert.equal(commitJourneyStep(J.egyptTie, done), null);
  done.add(EGYPT_MIRRORS.solved);
  [J.egyptTie, J.egyptDone, J.qinRead, J.qinMarch, J.qinHalt].forEach(act);
  act(J.qinTurn);
  assert.equal(commitJourneyStep(J.qinDone, done), null);
  done.add(QIN_ARMY.flag);
  [J.qinDone, J.skyBearing, J.skySight, J.handover, J.groundWatch].forEach(act);
  assert.ok(journeyTowerReady(done));
  assert.equal(commitJourneyStep(J.launch, done), null);
  done.add(A.takeover);
  [J.launch, J.feed, J.test, J.isolate].forEach(act);
  assert.equal(worldJourneyGuide('sky', done)?.targetId, M.start);
  for (const phase of SKY_PHASES) done.add(phase);
  act(J.finish);
  assert.equal(worldJourneyGuide('alpha', done)?.targetId, J.launch, 'a player who left before the return ceremony can board again');
  [J.returnHome, J.epilogue].forEach(act);
  assert.equal(worldJourneyGuide('alpha', done), null);

  const fresh = new Set([A.started, A.online, VALLEY_PROLOGUE.record]);
  assert.equal(worldJourneyGuide('alpha', fresh)?.targetId, J.lake);
  assert.ok(commitJourneyStep(J.lake, fresh));
  assert.ok(commitJourneyStep(J.lakePin, fresh));
  assert.ok(fresh.has(J.lakeWinch));
});

test('Helion locks his aim, can be reflected by a late shutter, and checkpoints each phase', () => {
  const done = new Set<string>();
  let damage = 0;
  const fight = createHelionFight({ done, phaseCleared: id => done.add(id), hurt: amount => { damage += amount; }, cue() {} });
  const run = (seconds: number, x: number, z: number) => { for (let n = 0; n < Math.ceil(seconds / .025); n++) fight.update(.025, { x, z }); };
  assert.ok(fight.start());
  assert.equal(fight.hit(1000), false);
  // Put the player behind the west panel on the bearing that intersects it.
  const [px, , pz] = SKY_SHUTTERS[0];
  const x = px + (px - SKY_BOSS[0]) * .35, z = pz + (pz - SKY_BOSS[2]) * .35;
  fight.turn(0);
  run(2.45, x, z);
  assert.equal(fight.beat, 'locked');
  fight.turn(0);
  run(.86, x, z);
  assert.equal(fight.beat, 'recovering');
  assert.equal(damage, 0);
  assert.ok(fight.hp < fight.maxHp, 'late shutter turns damage the execution rig');
  assert.ok(fight.hit(1000));
  assert.ok(done.has(J.phase1));
  assert.ok(fight.start());
  run(2.45, x, z);
  const locked = fight.tell && { ...fight.tell };
  run(.9, SKY_ORIGIN[0] + 21, SKY_ORIGIN[2] + 8);
  assert.equal(locked?.x, x);
  assert.equal(damage, 0);
  fight.hit(1000);
  assert.ok(done.has(J.phase2));
  assert.ok(fight.start());
  run(3.35, x, z);
  fight.hit(1000);
  assert.equal(done.has(J.phase3), false, 'the last write requires its own tell and counterattack');
  run(2.1, x, z);
  assert.equal(fight.tell?.shape, 'write');
  run(1.2, SKY_ORIGIN[0] + 21, SKY_ORIGIN[2] + 8);
  fight.hit(1000);
  assert.ok(done.has(J.phase3));
  assert.equal(fight.start(), false);
});

test('production map geometry admits every new quest stand and the sky handover survives real input', async () => {
  const seed = [...four, J.egyptDone, J.orleansDone, J.qinDone, J.skySight, J.handover, J.groundWatch, A.takeover];
  const h = await bootWorldWithoutGpu({ deterministic: true, initialStorage: { [WORLD_PROGRESS_KEY]: JSON.stringify({ done: seed, found: [] }) } });
  const w = h.world, d = h.window.document;
  let time = 0;
  const frame = (n = 1) => { for (let i = 0; i < n; i++) h.frame(time += 1000 / 60); };
  const tap = () => {
    const code = w.settings.bindingsFor('interact')[0];
    for (const type of ['keydown', 'keyup']) d.body.dispatchEvent(new h.window.KeyboardEvent(type, { code, bubbles: true, cancelable: true }));
  };
  const marker = (id: string) => w.layout.markers.find((m: { id: string }) => m.id === id);
  const interact = (id: string) => {
    const m = marker(id);
    assert.ok(m, id);
    const floor = w.combat.geometry.ground(m.p[0], m.p[2], m.p[1] + 1.25);
    assert.ok(floor, id);
    w.player.teleport(floor.point.x, floor.point.y + .2, floor.point.z);
    frame(22); tap();
  };
  try {
    (d.getElementById('start') as HTMLElement).click(); await Promise.resolve(); frame(3);
    const missing: string[] = [];
    for (const m of w.layout.markers.filter((candidate: { id: string }) => /^journey_/.test(candidate.id))) {
      const [x, y, z] = m.p;
      const floor = w.combat.geometry.ground(x, z, y + 1.25);
      if (!floor || Math.abs(floor.point.y + .92 - y) > .7 || !w.combat.geometry.clear(new Vector3(x, floor.point.y + .04, z), .32, 1.65)) missing.push(`${m.id} ${m.p} floor ${floor?.point.y}`);
    }
    assert.deepEqual(missing, []);
    interact(J.launch);
    assert.ok(w.done.has(J.launch));
    assert.ok(w.player.pos.y > 200);
    [J.feed, J.test, J.isolate].forEach(interact);
    assert.ok(w.done.has(J.isolate));
    interact(M.start);
    frame(2);
    assert.equal((d.getElementById('helion-status') as HTMLElement).hidden, false);
    assert.equal(commitJourneyStep(J.finish, w.done), null);
    const hud = d.getElementById('helion-status')!;
    const canvas = d.getElementById('view')!;
    const shift = (x: number) => {
      w.player.teleport(x, SKY_ORIGIN[1] + .21, SKY_ORIGIN[2] - 19);
      frame(12);
    };
    let side = 1;
    shift(SKY_ORIGIN[0] + 5);
    for (let cycle = 0; cycle < 16 && !w.done.has(J.phase3); cycle++) {
      for (let i = 0; i < 500 && !/射界锁定|核心暴露/.test(hud.textContent ?? ''); i++) frame();
      if (/射界锁定/.test(hud.textContent ?? '')) { side *= -1; shift(SKY_ORIGIN[0] + side * 5); }
      for (let i = 0; i < 110 && !/核心暴露/.test(hud.textContent ?? ''); i++) frame();
      for (let shot = 0; shot < 20 && !hud.hidden && /核心暴露/.test(hud.textContent ?? ''); shot++) {
        const target = ['HelionCore', 'HelionEmitter_0', 'HelionEmitter_1'].map(name => w.scene.getObjectByName(name))
          .find(node => node?.visible && node.material.emissiveIntensity > 1);
        assert.ok(target, 'an exposed core or emitter must be visible');
        w.camera.position.copy(w.player.pos).add(new Vector3(0, 1.4, 0));
        w.camera.lookAt(target.position);
        w.camera.updateMatrixWorld(true);
        for (const type of ['mousedown', 'mouseup']) canvas.dispatchEvent(new h.window.MouseEvent(type, { button: 0, bubbles: true, cancelable: true }));
        frame(11);
      }
    }
    assert.ok(SKY_PHASES.every(phase => w.done.has(phase)), `all three phases cleared by input (${[...w.done].filter(id => id.startsWith('journey_helion'))})`);
    interact(J.finish); assert.ok(w.done.has(J.finish));
    interact(J.returnHome); assert.ok(w.done.has(J.returnHome));
    assert.ok(w.player.pos.y < 50, 'the boarding cradle returns to the valley');
    interact(J.epilogue); assert.ok(w.done.has(J.epilogue));
    assert.ok(JSON.parse(h.window.localStorage.getItem(WORLD_PROGRESS_KEY)!).done.includes(J.epilogue));
    assert.deepEqual(h.errors, []);
  } finally { await h.close(); }
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { Vector3 } from 'three';
import { WORLD_PROGRESS_KEY } from '../src/core/progress';
import { createWorldJourneySites } from '../src/environment/worldJourneySites';
import { createSkyCrownScene } from '../src/environment/skyCrownScene';
import { SKY_APPROACH_DECKS, SKY_UP_LIFT } from '../src/environment/skyCrownApproach';
import { Player } from '../src/player/player';
import { EGYPT_MIRRORS } from '../src/map/egyptPlan';
import { ORLEANS_WORKS, ORLEANS_WORK_ACTIONS } from '../src/map/orleansWorks';
import { QIN_ARMY } from '../src/map/qinPlan';
import { createHelionFight, SKY_BOSS, SKY_ORIGIN, SKY_SHUTTERS } from '../src/story/helionFight';
import { ADVENTURE as A } from '../src/story/openWorldCampaign';
import { climaxCheckpoint, climaxCleared, climaxMarker, createRealmClimax, QIN_GENERAL_DOWN, type RealmClimaxId } from '../src/story/realmClimaxes';
import { commitJourneyStep, JOURNEY as J, SKY_MARKERS as M, SKY_PHASES, journeyTowerReady, worldJourneyGuide } from '../src/story/worldJourney';
import { VALLEY_PROLOGUE } from '../src/story/valleyPrologue';
import { VALLEY_FIELD as F, VALLEY_NIGHT_ENCOUNTER } from '../src/story/valleyField';
import type { SettlementPlacement } from '../src/settlements/types';
import { bootWorldWithoutGpu } from './world-dom-boot.fixture';

const four = [A.started, A.online, 'armory_rack', 'saber_contract', 'sun_core', A.arrived, 'napoleon_contract', A.departed, 'blackbeard_contract', A.evidence, 'musashi_contract'];

test('east landing supports the siding, a moving coupler, and recovery at the end of the rails', () => {
  const residence = { position: [0, 5, 0] } as SettlementPlacement;
  const make = () => createWorldJourneySites(residence, (_x, _z, ceiling = 7) => ceiling - 2, () => true);
  for (const route of ['switch', 'shot', 'depot']) {
    const sites = make(), done = new Set(four);
    try {
      assert.ok(commitJourneyStep(J.cargoCall, done)); sites.apply(done);
      const cart = sites.root.getObjectByName('JourneyCargoCart')!;
      const start = cart.position.clone();
      assert.equal(sites.update(2, start), false);
      if (route === 'switch') assert.ok(commitJourneyStep(J.cargoSwitch, done));
      if (route === 'shot') {
        assert.ok(commitJourneyStep(J.cargoPin, done)); sites.saveCargoBrake(done);
      }
      sites.apply(done);
      for (let i = 0; i < 80; i++) {
        if (sites.update(.25, start)) { done.add(J.cargoParked); sites.apply(done); break; }
      }
      assert.ok(done.has(J.cargoParked), route);
      assert.equal(cart.position.z > start.z + 1, route === 'switch');
      assert.equal(cart.position.x - start.x, route === 'depot' ? 42 : route === 'switch' ? 33 : 9);
      const savedPosition = cart.position.clone();
      assert.ok(commitJourneyStep(J.cargo, done));
      const resumed = make();
      try {
        resumed.apply(done);
        assert.deepEqual(resumed.root.getObjectByName('JourneyCargoCart')!.position.toArray(), savedPosition.toArray());
      } finally { resumed.dispose(); }
    } finally { sites.dispose(); }
  }
});

test('seven-region route keeps saved demo endings, accepts either branch, and requires a real sky victory', () => {
  const done = new Set([...four, A.ending]);
  const act = (id: string) => assert.ok(commitJourneyStep(id, done), id);
  assert.equal(worldJourneyGuide('alpha', done)?.targetId, J.meal);
  assert.equal(commitJourneyStep(J.finish, done), null);
  assert.equal(journeyTowerReady(done), false);
  act(J.meal); act(J.cargoCall);
  assert.equal(commitJourneyStep(J.cargo, done), null);
  act(J.cargoSwitch);
  assert.equal(commitJourneyStep(J.cargoPin, done), null);
  done.add(J.cargoParked);
  [J.cargo, J.signalLamp, J.signal, J.compare, J.bypass].forEach(act);
  assert.equal(commitJourneyStep(J.orleansRead, done), null);
  [F.nightStart, F.paperMap, F.dimWatch].forEach(act);
  assert.equal(commitJourneyStep(F.soundDecoy, done), null);
  assert.equal(commitJourneyStep(F.nightPatrol, done), null);
  assert.equal(commitJourneyStep(F.radioRemove, done), null);
  done.add(F.patrolCleared);
  [F.countPatch, F.nightBrace, F.nightDone, J.orleansRead].forEach(act);
  assert.equal(commitJourneyStep(J.cutoff, done), null);
  assert.equal(commitJourneyStep(J.qinRead, done), null);
  for (const flag of [ORLEANS_WORKS.craneDone, ORLEANS_WORKS.sluiceDone, ORLEANS_WORKS.bellDone]) done.add(flag);
  [J.orleansFlag, J.orleansBrace].forEach(act);
  assert.equal(commitJourneyStep(J.orleansDone, done), null);
  assert.equal(worldJourneyGuide('orleans', done)?.targetId, climaxMarker('orleans', 'start'));
  done.add(climaxCleared('orleans'));
  [J.orleansDone, J.egyptRead].forEach(act);
  assert.equal(commitJourneyStep(J.egyptTie, done), null);
  done.add(EGYPT_MIRRORS.solved);
  act(J.egyptTie);
  assert.equal(commitJourneyStep(J.egyptDone, done), null);
  done.add(climaxCleared('egypt'));
  [J.egyptDone, J.qinRead, J.qinMarch, J.qinHalt].forEach(act);
  assert.equal(worldJourneyGuide('qin', done)?.targetId, QIN_ARMY.levers[1].id);
  act(J.qinTurn);
  assert.equal(commitJourneyStep(J.qinDone, done), null);
  done.add(QIN_ARMY.flag);
  assert.equal(worldJourneyGuide('qin', done)?.targetId, climaxMarker('qin', 'start'));
  done.add(climaxCleared('qin'));
  [J.qinDone, F.roofSight, J.skyBearing, J.skySight, F.replay, F.disconnect, F.doorPower, F.doorDisconnect, F.doorRequest, F.doorNear, F.doorFar, F.doorLoad, F.drillStart, F.drillBeacon, F.drillDone, J.handover, F.towerHigh, J.groundWatch].forEach(act);
  assert.ok(journeyTowerReady(done));
  assert.equal(commitJourneyStep(J.launch, done), null);
  done.add(A.takeover);
  [J.launch, J.skyRanging, J.skyScan, J.skyReview].forEach(act);
  assert.equal(commitJourneyStep(J.test, done), null);
  act(J.eastLatch);
  assert.equal(commitJourneyStep(J.westService, done), null);
  [J.feed, J.test, J.isolate, J.skyReturnSight, J.skyCourt].forEach(act);
  assert.equal(worldJourneyGuide('sky', done)?.targetId, M.start);
  for (const phase of SKY_PHASES) done.add(phase);
  act(J.finish);
  assert.equal(worldJourneyGuide('alpha', done)?.targetId, J.launch, 'a player who left before the return ceremony can board again');
  [J.returnHome, J.epilogue].forEach(act);
  assert.equal(worldJourneyGuide('alpha', done)?.targetId, F.chair);
  [F.chair, F.nextSlip].forEach(act);
  assert.equal(worldJourneyGuide('alpha', done), null);

  const fresh = new Set([A.started, A.online, VALLEY_PROLOGUE.record]);
  assert.equal(worldJourneyGuide('alpha', fresh)?.targetId, J.lake);
  assert.ok(commitJourneyStep(J.lake, fresh));
  assert.ok(commitJourneyStep(J.lakePin, fresh));
  assert.ok(fresh.has(J.lakeWinch));

  const existing = new Set([...four, J.meal, J.cargo, J.signal]);
  assert.equal(worldJourneyGuide('alpha', existing)?.targetId, J.compare);
  const restored = new Set([...four, J.egyptDone, J.orleansDone, J.qinDone]);
  assert.equal(worldJourneyGuide('alpha', restored)?.targetId, J.skyBearing, 'old completed handovers stay complete');
});

test('both Sky Crown approaches and side decks have continuous walkable collision', () => {
  const crown = createSkyCrownScene();
  const D = SKY_APPROACH_DECKS;
  crown.apply(new Set([J.skyScan, J.skyReview, J.isolate, J.skyCourt]));
  const walk = (decks: readonly (keyof typeof D)[]) => {
    const p = new Player(crown.colliders, 0), start = D[decks[0]].p;
    p.teleport(start[0], start[1] + .25, start[2]);
    for (const id of decks.slice(1)) {
      const [x, y, z] = D[id].p;
      let frames = 0;
      while (Math.hypot(x - p.pos.x, z - p.pos.z) > .85 && frames++ < 3500 && p.pos.y > 129) {
        p.yaw = Math.atan2(p.pos.x - x, p.pos.z - z);
        p.step(1 / 120, { x: 0, z: 1, jump: false, sprint: true });
      }
      assert.ok(Math.hypot(x - p.pos.x, z - p.pos.z) < .9 && Math.abs(y - p.pos.y) < .65, `${id}: ${p.pos.toArray()}`);
    }
  };
  try {
    walk(['dock', 'range', 'hall', 'light', 'throat', 'back', 'court', 'oldDock']);
    walk(['anchor', 'hall', 'service', 'archive', 'service', 'throat']);
    walk(['oldDock', 'court', 'back', 'throat', 'service', 'hall', 'range', 'dock']);
  } finally { crown.dispose(); }
});

test('regional fights checkpoint engineering and accept Qin’s nonlethal or early-defeat routes', () => {
  const origin = { x: 0, y: 5, z: 0 }, player = { x: 0, y: 5, z: 8 };
  const done = new Set<string>();
  let damage = 0;
  const hooks = { done, save: (flag: string) => done.add(flag), hurt: (amount: number) => { damage += amount; }, warn() {} };
  const tick = (fight: ReturnType<typeof createRealmClimax>) => { for (let i = 0; i < 160; i++) fight.update(.02, player); };
  const egypt = createRealmClimax('egypt', origin, hooks);
  assert.ok(egypt.start()); assert.equal(egypt.hit(0, 300), false);
  tick(egypt); assert.equal(damage, 21); assert.equal(egypt.hit(0, 300), false);
  assert.ok(egypt.work('west')); assert.ok(egypt.hit(0, 300));
  egypt.reset(); assert.ok(egypt.start()); assert.equal(egypt.phase, 1);
  assert.equal(egypt.work('east'), false); assert.ok(egypt.work('west')); assert.ok(egypt.work('east'));
  tick(egypt); assert.ok(egypt.hit(1, 300)); assert.equal(done.has(climaxCleared('egypt')), false);
  assert.ok(egypt.work('east')); assert.ok(done.has(climaxCleared('egypt')));

  for (const defeat of [true, false]) {
    const flags = new Set<string>();
    const general = createRealmClimax('qin', origin, { ...hooks, done: flags, save: flag => flags.add(flag) });
    assert.ok(general.start()); assert.equal(general.work('east'), false);
    if (defeat) assert.ok(general.hit(0, 500));
    else assert.ok(general.work('west'));
    assert.equal(flags.has(QIN_GENERAL_DOWN), defeat);
    general.reset(); assert.ok(general.start());
    if (!defeat) assert.ok(general.work('west'));
    assert.ok(general.work('east'));
    assert.ok(general.work('west')); assert.ok(general.work('east'));
    assert.ok(general.work('west')); assert.ok(flags.has(climaxCleared('qin')));
  }
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
  assert.equal(fight.hit(1000, 1), false, 'the opposite rig remains shielded');
  fight.hit(1000);
  assert.equal(fight.emitterOnline(0), false);
  assert.equal(done.has(J.phase2), false);
  run(3, SKY_ORIGIN[0] + 21, SKY_ORIGIN[2] + 8);
  assert.equal(fight.exposedEmitter, 1);
  fight.hit(1000, 1);
  assert.ok(done.has(J.phase2));
  assert.ok(fight.start());
  run(3.35, x, z);
  fight.hit(135);
  assert.equal(fight.hp, 50, 'the emergency write retains the remaining health');
  run(2.1, x, z);
  assert.equal(fight.tell?.shape, 'write');
  run(1.2, SKY_ORIGIN[0] + 21, SKY_ORIGIN[2] + 8);
  fight.hit(1000);
  assert.ok(done.has(J.phase3));
  assert.equal(fight.start(), false);
  done.delete(J.phase3);
  assert.ok(fight.start());
  run(3.35, x, z);
  assert.ok(fight.hit(185));
  assert.ok(done.has(J.phase3), 'a lethal attack ends the fight before the write');
});

test('production quest stands, three regional handovers and the sky finale work with actual input', async () => {
  const seed = [...four.filter(flag => flag !== 'saber_contract'), VALLEY_PROLOGUE.record, A.takeover];
  const h = await bootWorldWithoutGpu({ deterministic: true, bootTimeoutMs: 120_000, initialStorage: { [WORLD_PROGRESS_KEY]: JSON.stringify({ done: seed, found: [] }) } });
  const w = h.world, d = h.window.document;
  let time = 0;
  const frame = (n = 1) => { for (let i = 0; i < n; i++) h.frame(time += 1000 / 60); };
  const key = (type: 'keydown' | 'keyup') => {
    const code = w.settings.bindingsFor('interact')[0];
    d.body.dispatchEvent(new h.window.KeyboardEvent(type, { code, bubbles: true, cancelable: true }));
  };
  const tap = () => { key('keydown'); key('keyup'); };
  const marker = (id: string) => w.layout.markers.find((m: { id: string }) => m.id === id);
  const approach = (id: string) => {
    const m = marker(id);
    assert.ok(m, id);
    const floor = w.combat.geometry.ground(m.p[0], m.p[2], m.p[1] + 1.25);
    assert.ok(floor, id);
    w.player.teleport(floor.point.x, floor.point.y + .2, floor.point.z);
    frame(22);
  };
  const interact = (id: string) => { approach(id); tap(); };
  const hold = (id: string) => {
    const action = ORLEANS_WORK_ACTIONS.find(action => action.id === id)!;
    approach(id);
    key('keydown'); frame(2); key('keyup'); frame(2);
    assert.equal(w.orleansWorksRuntime.active, id);
    key('keydown'); frame(Math.ceil((action.seconds + .4) * 60)); key('keyup');
    assert.ok(w.done.has(action.flag), action.flag);
  };
  const shootAt = (point: Vector3) => {
    const canvas = d.getElementById('view')!;
    w.camera.position.copy(w.player.pos).add(new Vector3(0, 1.4, 0));
    w.camera.lookAt(point);
    w.camera.updateMatrixWorld(true);
    for (const type of ['mousedown', 'mouseup']) canvas.dispatchEvent(new h.window.MouseEvent(type, { button: 0, bubbles: true, cancelable: true }));
  };
  const station = (region: RealmClimaxId, which: 'start' | 'west' | 'east') => interact(climaxMarker(region, which));
  const shootPhase = (region: RealmClimaxId, phase: number, model: string) => {
    const flag = climaxCheckpoint(region, phase);
    const target = w.scene.getObjectByName(model);
    approach(climaxMarker(region, 'west'));
    assert.ok(target?.visible, model);
    for (let i = 0; i < 36 && !w.done.has(flag); i++) {
      for (let f = 0; f < 450 && target.visible && target.material.emissiveIntensity < 1; f++) frame();
      if (!target.visible) break;
      shootAt(target.getWorldPosition(new Vector3())); frame(15);
    }
    assert.ok(w.done.has(flag), `${model}: ${d.getElementById('realm-climax-status')?.textContent} | ${d.getElementById('objective')?.textContent}`);
  };
  try {
    (d.getElementById('start') as HTMLElement).click(); await Promise.resolve(); frame(3);
    const missing: string[] = [];
    for (const m of w.layout.markers.filter((candidate: { id: string; type: string }) => candidate.type === 'interact' && /^(journey_|realm_)/.test(candidate.id))) {
      const [x, y, z] = m.p;
      const floor = w.combat.geometry.ground(x, z, y + 1.25);
      if (!floor || floor.point.y < w.layout.world.waterLevel + .05 || Math.abs(floor.point.y + .92 - y) > .7 || !w.combat.geometry.clear(new Vector3(x, floor.point.y + .04, z), .32, 1.65)) missing.push(`${m.id} ${m.p} floor ${floor?.point.y}`);
    }
    assert.deepEqual(missing, []);
    interact(J.lake); assert.ok(w.done.has(J.lake));
    for (let line = 0; line < 3 && w.narrative.open; line++) tap();
    interact(J.lakeWinch); assert.ok(w.done.has(J.lakeWinch));
    assert.ok(w.done.has('saber_contract'));
    interact(J.bridge); assert.ok(w.done.has(J.bridge));
    frame(380); interact(J.visitor); assert.ok(w.done.has(J.visitor));
    interact(J.meal); assert.ok(w.done.has(J.meal));
    interact(J.cargoCall); assert.ok(w.done.has(J.cargoCall));
    const pin = w.scene.getObjectByName('JourneyCargoCoupler');
    assert.ok(pin?.visible);
    shootAt(pin.getWorldPosition(new Vector3()));
    assert.ok(w.done.has(J.cargoPin), 'firing at the moving cart activates the saved braking route');
    for (let i = 0; i < 300 && !w.done.has(J.cargoParked); i++) frame();
    assert.ok(w.done.has(J.cargoParked));
    interact(J.cargo); assert.ok(w.done.has(J.cargo));
    interact(J.signalLamp); assert.ok(w.done.has(J.signalLamp));
    interact(J.signal); assert.ok(w.done.has(J.signal));
    interact(J.compare); interact(J.bypass); assert.ok(w.done.has(J.bypass));
    for (const id of [F.nightStart, F.paperMap, F.dimWatch]) { interact(id); assert.ok(w.done.has(id), id); }
    interact(F.nightPatrol);
    assert.equal(w.combat.storyEncounter?.id, VALLEY_NIGHT_ENCOUNTER, d.getElementById('prompt')?.textContent ?? 'night patrol');
    for (const enemy of w.combat.state.enemies.filter((e: { storyEncounter?: string }) => e.storyEncounter === VALLEY_NIGHT_ENCOUNTER)) {
      for (let round = 0; round < 30 && enemy.hp > 0; round++) w.combat.damageEnemy(enemy.id, 80);
      assert.ok(enemy.hp <= 0);
    }
    frame(8); assert.ok(w.done.has(F.patrolCleared));
    interact(F.countPatch); interact(F.nightBrace); frame(285); interact(F.nightDone);
    assert.ok(w.done.has(F.nightDone));
    interact(J.egyptRead); assert.ok(w.done.has(J.egyptRead));
    EGYPT_MIRRORS.mirrors.forEach(({ id }, index) => {
      for (let turn = 0; turn < [3, 0, 2][index]; turn++) interact(id);
    });
    frame(2);
    assert.ok(w.done.has(EGYPT_MIRRORS.solved));
    interact(J.egyptWeir); assert.ok(w.done.has(J.egyptWeir));
    station('egypt', 'start'); station('egypt', 'west');
    shootPhase('egypt', 0, 'TideEaterTarget1');
    station('egypt', 'west'); station('egypt', 'east');
    shootPhase('egypt', 1, 'TideEaterTarget2');
    station('egypt', 'east'); assert.ok(w.done.has(climaxCleared('egypt')));
    frame(690); interact(J.egyptDone); assert.ok(w.done.has(J.egyptDone));
    interact(J.orleansRead); hold(ORLEANS_WORKS.crane); hold(ORLEANS_WORKS.sluice);
    interact(J.orleansFlag); hold(ORLEANS_WORKS.bell);
    interact(J.orleansBattery); assert.ok(w.done.has(J.orleansBattery));
    station('orleans', 'start'); station('orleans', 'west');
    shootPhase('orleans', 0, 'BridgefortTarget1');
    station('orleans', 'east'); shootPhase('orleans', 1, 'BridgefortTarget2');
    station('orleans', 'west'); assert.ok(w.done.has(climaxCleared('orleans')));
    frame(260); interact(J.orleansDone); assert.ok(w.done.has(J.orleansDone));
    interact(J.qinRead); interact(J.qinMarch);
    frame(500); interact(J.qinHalt); assert.ok(w.done.has(J.qinHalt));
    interact(QIN_ARMY.levers[1].id); frame(150);
    assert.ok(w.done.has(J.qinTurn));
    station('qin', 'start'); station('qin', 'west'); station('qin', 'east');
    station('qin', 'west'); station('qin', 'east'); station('qin', 'west');
    assert.ok(w.done.has(climaxCleared('qin'))); assert.equal(w.done.has(QIN_GENERAL_DOWN), false);
    interact(J.qinDone); assert.ok(w.done.has(J.qinDone));
    for (const id of [F.roofSight, J.skyBearing, J.skySight, F.replay, F.disconnect, F.doorPower, F.doorDisconnect, F.doorRequest, F.doorNear, F.doorFar, F.doorLoad, F.drillStart, F.drillBeacon]) {
      interact(id);
      assert.ok(w.done.has(id), `${id}: ${d.getElementById('prompt')?.textContent} (${w.player.pos.toArray()}, grounded ${w.player.onGround})`);
    }
    frame(1050); interact(F.drillDone); assert.ok(w.done.has(F.drillDone));
    [J.handover, F.towerLow, J.groundWatch].forEach(interact); assert.ok(w.done.has(J.groundWatch));
    interact(J.launch);
    assert.ok(w.done.has(J.launch));
    assert.ok(w.player.pos.y > 130 && w.player.pos.y < 150);
    interact(J.skyRanging);
    const scanner = w.scene.getObjectByName('SkyRangingScanner');
    assert.ok(scanner?.visible);
    shootAt(scanner.getWorldPosition(new Vector3())); assert.ok(w.done.has(J.skyScan));
    [J.skyReview, J.westService, J.feed, J.test, J.isolate, J.skyReturnSight, J.skyCourt].forEach(interact);
    assert.ok(w.done.has(J.isolate));
    interact(M.start);
    frame(2);
    assert.equal((d.getElementById('helion-status') as HTMLElement).hidden, false);
    assert.equal(commitJourneyStep(J.finish, w.done), null);
    const hud = d.getElementById('helion-status')!;
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
        shootAt(target.position);
        frame(11);
      }
    }
    assert.ok(SKY_PHASES.every(phase => w.done.has(phase)), `all three phases cleared by input (${[...w.done].filter(id => id.startsWith('journey_helion'))})`);
    interact(J.finish); assert.ok(w.done.has(J.finish));
    interact(SKY_UP_LIFT); assert.ok(w.player.pos.y < 160 && w.player.pos.y > 150);
    interact(J.returnHome); assert.ok(w.done.has(J.returnHome));
    assert.ok(w.player.pos.y < 50, 'the boarding cradle returns to the valley');
    interact(J.epilogue); assert.ok(w.done.has(J.epilogue));
    for (let line = 0; line < 3 && w.narrative.open; line++) tap();
    [F.chair, F.nextSlip].forEach(interact); assert.ok(w.done.has(F.nextSlip));
    assert.ok(JSON.parse(h.window.localStorage.getItem(WORLD_PROGRESS_KEY)!).done.includes(J.epilogue));
    assert.deepEqual(h.errors, []);
  } finally { await h.close(); }
});

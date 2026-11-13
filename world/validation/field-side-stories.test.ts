import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Vector3 } from 'three';
import { WORLD_PROGRESS_KEY } from '../src/core/progress';
import {
  FIELD_SIDE_STORIES, ROYAL_BOAT as B, HARBOR_WAGES as W, ICE_BELL as I, KYOTO_REFLECTION as K, VALLEY_RADIO as V, SKY_MAINTENANCE as S, EGYPT_SEEDS as E, ORLEANS_SOUP as O, QIN_QUIET_ROOM as Q,
  KYOTO_PASS as KP, KYOTO_PAPERLINE as KL, HARBOR_KEEPSAKES as HK, CAPTAINS_CHAIR as CC, fieldSideNext, fieldSideReady,
  WINTER_BREAD as WB, WINTER_SHOES as WS, WINTER_RANGE as WR,
  EGYPT_MAIL as EM, EGYPT_REED_RACE as ER, EGYPT_SHIP_HINGE as EH, EGYPT_REVERSE_WHEEL as EW,
  EGYPT_HERD as EG, EGYPT_THRONE as ET,
} from '../src/story/fieldSideStories';
import { QIN_FIELD as QF } from '../src/story/qinFieldStories';
import { ORLEANS_FIELD as OF } from '../src/story/orleansFieldStories';
import { JOURNEY as J } from '../src/story/worldJourney';
import { HARBOR_WORKBOAT as HB } from '../src/story/harborRelief';
import { VALLEY_PROLOGUE as P } from '../src/story/valleyPrologue';
import { ADVENTURE } from '../src/story/openWorldCampaign';
import { bootWorldWithoutGpu } from './world-dom-boot.fixture';

test('the wage store stays accessible after the officers leave and the bell routes are interchangeable', () => {
  const wages = FIELD_SIDE_STORIES.find(story => story.id === 'dock-wages')!;
  const early = new Set<string>(['blackbeard_meet', W.bench]);
  const late = new Set([...early, 'sea_core']);
  assert.equal(fieldSideNext(wages, early)?.id, W.divert);
  assert.equal(fieldSideNext(wages, late)?.id, W.chest);
  late.add(W.chest); assert.equal(fieldSideNext(wages, late)?.id, W.return);
  const ice = new Set<string>(['napoleon_meet', I.hear]);
  assert.ok(fieldSideReady(I.pin, ice));
  for (const release of [I.pin, I.rope]) {
    const released = new Set([...ice, release]);
    assert.equal(fieldSideReady(I.pin, released), false);
    assert.ok(fieldSideReady(I.raise, released));
  }
});

test('field side quests accept actual inputs and restore their route rewards from a saved game', async () => {
  const starting = ['armory_rack', 'saber_contract', 'blackbeard_meet', 'napoleon_meet', 'musashi_meet', P.record, J.skyReview, J.skyReturnSight, J.egyptRead, J.orleansRead, J.qinRead, ADVENTURE.road];
  const first = await bootWorldWithoutGpu({ deterministic: true, initialStorage: {
    [WORLD_PROGRESS_KEY]: JSON.stringify({ done: starting, found: [] }),
  } });
  const { world: w, window } = first;
  const d = window.document;
  let time = 0, saved = '';
  const frame = (n = 1) => { for (let i = 0; i < n; i++) first.frame(time += 1000 / 60); };
  const tap = () => {
    const code = w.settings.bindingsFor('interact')[0];
    for (const type of ['keydown', 'keyup']) d.body.dispatchEvent(new window.KeyboardEvent(type, { code, bubbles: true, cancelable: true }));
  };
  const marker = (id: string) => w.layout.markers.find((m: { id: string }) => m.id === id);
  const approach = (id: string) => {
    const m = marker(id);
    assert.ok(m, `missing production marker ${id}`);
    const [x, y, z] = m.p;
    const floor = w.combat.geometry.ground(x, z, y + 1.3);
    assert.ok(floor && Math.abs(floor.point.y + .9 - y) < .7, `no floor at ${id}: ${m.p} / ${floor?.point.y}`);
    w.player.teleport(x, floor.point.y + .18, z);
    frame(26);
    assert.ok(w.player.onGround, `not grounded at ${id}: ${w.player.pos.toArray()}`);
  };
  const finishDialogue = () => {
    for (let i = 0; i < 5 && w.narrative.open; i++) tap();
    assert.equal(w.narrative.open, false);
  };
  const complete = (id: string) => {
    approach(id); tap();
    assert.ok(w.done.has(id), `${id} did not advance: ${d.getElementById('prompt')?.textContent} / ${d.getElementById('toast')?.textContent}`);
    finishDialogue();
  };
  const choose = (id: string, option: string) => {
    approach(id); tap();
    const button = d.querySelector<HTMLButtonElement>(`[data-choice="${option}"]`);
    assert.ok(button, `missing choice ${id}/${option}`);
    button.click(); frame(2);
  };
  const passage = (name: string) => w.colliders.find((c: { name: string }) => c.name === 'COL_' + name);
  try {
    (d.getElementById('start') as HTMLElement).click(); await Promise.resolve(); frame(5);
    for (const story of FIELD_SIDE_STORIES) for (const step of story.steps) assert.ok(marker(step.id), step.id);
    assert.equal(passage('SwordLakeViewingDeck')?.enabled, false);
    [B.shed, B.haul, B.brace, B.launch].forEach(complete);
    assert.equal(passage('SwordLakeViewingDeck').enabled, true);
    const boat = w.scene.getObjectByName('SwordLakeRoyalBoat');
    const from = boat.position.clone(); frame(38);
    assert.ok(boat.position.distanceTo(from) > .1, 'the completed boat sails along the shore');
    approach(B.watch); tap(); finishDialogue();
    approach(B.board); frame(450); tap();
    const fromShore = w.player.pos.clone();
    frame(220);
    assert.ok(w.player.pos.distanceTo(fromShore) > 6, 'the player is carried by the boat');
    assert.ok(w.player.pos.distanceTo(boat.position) < 2, 'the player stays inside the hull');
    assert.ok(!w.done.has(B.crossed), 'an unfinished crossing is not saved');
    frame(460);
    const west = marker(B.returnFerry).p;
    assert.ok(Math.hypot(w.player.pos.x - west[0], w.player.pos.z - west[2]) < .5, 'the player arrives on the west platform');
    assert.ok(w.player.onGround && w.done.has(B.crossed));
    tap(); frame(660);
    const east = marker(B.board).p;
    assert.ok(Math.hypot(w.player.pos.x - east[0], w.player.pos.z - east[2]) < .5, 'the player can ride back');

    assert.equal(passage('NassauFoldingRamp')?.enabled, false);
    approach(W.chest); tap(); assert.equal(w.done.has(W.chest), false);
    complete(W.bench);
    approach(W.divert);
    const guard = w.scene.getObjectByName('Resident_field_wages_guard');
    assert.ok(guard, 'wage store sentry');
    const guardStart = guard.position.clone();
    complete(W.divert); frame(65);
    assert.ok(guard.position.distanceTo(guardStart) > .5, 'the sentry walks toward the unloading signal');
    [W.chest, W.return].forEach(complete);
    assert.equal(passage('NassauFoldingRamp').enabled, true);
    complete(HB.inspect);
    complete(HB.gangway);
    assert.ok(w.done.has(HB.access) && !w.done.has(HB.fought));
    approach(HB.release); tap();
    assert.ok(!w.done.has(HB.release), 'the guards need time to clear the rear gangway');
    frame(290); complete(HB.release);
    const workboat = w.scene.getObjectByName('EliNassauWorkboat');
    const originalMooring = workboat.position.clone();
    frame(190);
    assert.ok(workboat.position.distanceTo(originalMooring) > 3);
    assert.ok(w.scene.getObjectByName('NassauWorkboatReception').visible);

    complete(HK.sight);
    for (const [id, deck] of [[HK.forward, 'NassauForwardWreckDeck'], [HK.aft, 'NassauAftWreckDeck']] as const) {
      approach(id); tap();
      assert.equal(passage(deck).enabled, false);
      tap(); finishDialogue();
      assert.ok(w.done.has(id) && passage(deck).enabled);
    }
    const cabin = marker(HK.chest).p;
    for (const [x, z] of [[607, -883.4], [598.1, -883.4], [cabin[0], cabin[2]]]) {
      const distance = () => Math.hypot(w.player.pos.x - x, w.player.pos.z - z);
      for (let i = 0; i < 430 && distance() > .29; i++) {
        w.player.yaw = Math.atan2(w.player.pos.x - x, w.player.pos.z - z);
        w.player.step(1 / 120, { x: 0, z: 1, jump: false, sprint: false });
      }
      assert.ok(distance() <= .3 && w.player.pos.y > 25.5, `wreck passage: ${w.player.pos.toArray()} toward ${x},${z}`);
    }
    frame(25); tap(); finishDialogue(); assert.ok(w.done.has(HK.chest));
    choose(HK.choose, 'memorial');
    assert.ok(w.done.has(HK.memorial) && w.scene.getObjectByName('NassauPublicMemorialCase').visible);
    assert.ok(w.scene.getObjectByName('NassauRepairedWreckBeacon').visible);

    complete(CC.talk);
    choose(CC.throw, 'right');
    assert.ok(!w.done.has(CC.throw));
    frame(105);
    assert.ok(w.done.has(CC.throw) && w.done.has(CC.win));
    complete(CC.repair);

    complete(I.hear); approach(I.rope);
    const clevis = w.scene.getObjectByName('BerezinaBellClevis');
    assert.ok(clevis?.visible);
    w.camera.position.copy(w.player.pos).add(new Vector3(0, 1.4, 0));
    w.camera.lookAt(clevis.getWorldPosition(new Vector3())); w.camera.updateMatrixWorld(true);
    const view = d.getElementById('view')!;
    for (const type of ['mousedown', 'mouseup']) view.dispatchEvent(new window.MouseEvent(type, { button: 0, bubbles: true, cancelable: true }));
    assert.ok(w.done.has(I.pin));
    complete(I.raise); choose(I.choose, 'camp');
    assert.ok(w.done.has(I.camp));
    approach(I.test); tap(); frame(3);
    assert.ok(Math.abs(w.scene.getObjectByName('BerezinaRecoveredBell').rotation.z) > .01);

    [WB.box, WB.house].forEach(complete);
    choose(WB.plan, 'warm-house');
    assert.ok(w.done.has(WB.leave) && !w.done.has(WB.chimney));
    assert.equal(passage('WinterWarmHouseRoofRoute')?.enabled, true);
    complete(WB.report);
    [WS.line, WS.cellar].forEach(complete);
    choose(WS.choose, 'shoe-stall');
    assert.ok(w.done.has(WS.crossing));
    assert.ok(w.scene.getObjectByName('WinterCrossingShoeStall').visible);
    [WR.meet, WR.crest, WR.valley, WR.bend].forEach(complete);
    choose(WR.choose, 'railings');
    assert.ok(w.done.has(WR.rails));
    assert.equal(passage('WinterGunnerMillRailings')?.enabled, true);

    assert.equal(passage('KinkakuServiceWalk')?.enabled, false);
    [K.shore, K.upper, K.inspect].forEach(complete);
    assert.equal(passage('KinkakuServiceWalk').enabled, true);
    assert.equal(passage('KyotoHandoffShutter')?.enabled, true);
    complete(KP.register); choose(KP.choice, 'sealed');
    assert.ok(w.done.has(KP.sealed));
    assert.equal(passage('KyotoHandoffShutter').enabled, false);
    assert.ok(w.scene.getObjectByName('KyotoWorkNumberPass').visible);

    assert.equal(passage('KyotoPaperRoofShortcut')?.enabled, false);
    complete(KL.shop);
    for (const id of [KL.rooftop, KL.counterweight]) {
      const [x, , z] = marker(id).p;
      const distance = () => Math.hypot(w.player.pos.x - x, w.player.pos.z - z);
      for (let i = 0; i < 500 && distance() > .28; i++) {
        w.player.yaw = Math.atan2(w.player.pos.x - x, w.player.pos.z - z);
        w.player.step(1 / 120, { x: 0, z: 1, jump: false, sprint: false });
      }
      frame(25); tap(); finishDialogue();
      assert.ok(w.done.has(id), `${id} blocked at ${w.player.pos.toArray()} toward ${marker(id).p}, ${d.getElementById('prompt')?.textContent}`);
    }
    assert.equal(passage('KyotoPaperRoofShortcut')?.enabled, true);
    const carrier = w.scene.getObjectByName('KyotoPaperSampleCarrier');
    assert.ok(carrier.visible);
    const paperOrigin = carrier.position.clone();
    frame(140);
    assert.ok(carrier.position.distanceTo(paperOrigin) > 2, 'the paper travels on the overhead line');
    complete(V.desk);
    choose(V.repeater, 'late'); assert.equal(w.done.has(V.repeater), false);
    choose(V.repeater, 'match'); assert.ok(w.done.has(V.repeater));
    complete(V.return);
    approach(V.listen); tap(); assert.ok(w.narrative.open); finishDialogue();

    complete(E.yard); complete(E.cart);
    const seedCart = w.scene.getObjectByName('EgyptSeedRailCart');
    const cartStart = seedCart.position.clone(); frame(110);
    assert.ok(seedCart.position.distanceTo(cartStart) > 2);
    complete(E.rack);
    const crops = w.scene.getObjectByName('EgyptTestPlantings');
    assert.equal(crops.visible, false);
    w.done.add(J.egyptDone); frame();
    assert.equal(crops.visible, true);
    complete(EM.flag);
    assert.ok(w.scene.getObjectByName('EgyptSalvageRackBag').visible);
    assert.ok(!w.scene.getObjectByName('EgyptMailHoldBag').visible);
    complete(EM.late); complete(EM.return);
    assert.equal(passage('EgyptMailHoldLatch').enabled, false);
    assert.ok(w.scene.getObjectByName('EgyptDeliveredMail').visible);
    complete(ER.meet); choose(ER.race, 'long');
    const reed = w.scene.getObjectByName('EgyptRacingReed_1');
    const reedStart = reed.position.clone();
    frame(290);
    assert.ok(reed.position.distanceTo(reedStart) > 2);
    assert.ok(w.done.has(ER.win));
    complete(ER.prize);
    complete(EH.inspect);
    const hinge = w.scene.getObjectByName('EgyptRustedHingePin');
    assert.ok(hinge.visible);
    w.camera.position.copy(w.player.pos).add(new Vector3(0, 1.38, 0));
    w.camera.lookAt(hinge.getWorldPosition(new Vector3())); w.camera.updateMatrixWorld(true);
    for (const type of ['mousedown', 'mouseup']) view.dispatchEvent(new window.MouseEvent(type, { button: 0, bubbles: true, cancelable: true }));
    assert.ok(w.done.has(EH.pin));
    complete(EH.brace);
    approach(EH.shutter); tap(); assert.ok(w.done.has(EH.coverOpen));
    assert.ok(passage('EgyptConfluenceFoldingShield').enabled);
    tap(); assert.ok(!passage('EgyptConfluenceFoldingShield').enabled);
    [EW.trace, EW.ladder].forEach(complete);
    const wheel = w.scene.getObjectByName('EgyptReverseWheel');
    const angleBefore = wheel.rotation.z;
    frame(50); assert.ok(wheel.rotation.z < angleBefore);
    complete(EW.baffle);
    const afterSwitch = wheel.rotation.z; frame(75);
    assert.ok(wheel.rotation.z > afterSwitch);
    assert.ok(passage('EgyptHighChannelShortcut').enabled);
    [EG.bell, EG.rig].forEach(complete);
    approach(EG.settle); tap(); assert.ok(!w.done.has(EG.settle));
    const goat = w.scene.getObjectByName('EgyptUphillGoat_0');
    const goatStart = goat.position.clone(); frame(405); complete(EG.settle);
    assert.ok(goat.position.distanceTo(goatStart) > 4);
    assert.ok(passage('EgyptHerdFloatBridge').enabled);
    complete(ET.colonnade);
    choose(ET.terrace, 'west'); assert.ok(w.done.has(ET.west));
    choose(ET.revisit, 'east'); assert.ok(w.done.has(ET.east));
    assert.equal(passage('OrleansWorkshopSideGate').enabled, true);
    [O.pot, O.gate, O.share].forEach(complete);
    assert.equal(passage('OrleansWorkshopSideGate').enabled, false);
    const maxHealth = w.combat.state.maxHp;
    approach(O.bowl); w.combat.state.hp = maxHealth - 32; tap();
    assert.equal(w.combat.state.hp, maxHealth - 9);
    assert.ok(w.done.has(O.bowl));

    complete(OF.bell.listen); complete(OF.bell.roof); complete(OF.bell.flag);
    assert.ok(w.scene.getObjectByName('OrleansBelfrySpareSignal').visible);
    assert.equal(passage('OrleansChartLanding').enabled, false);
    [OF.chart.read, OF.chart.upstream, OF.chart.turn, OF.chart.quay, OF.chart.shadow].forEach(complete);
    assert.ok(passage('OrleansChartLanding').enabled);
    complete(OF.rescue.approach);
    choose(OF.rescue.help, 'call'); assert.ok(w.done.has(OF.rescue.medic));
    approach(OF.rescue.exchange); tap(); assert.ok(!w.done.has(OF.rescue.exchange));
    frame(500); complete(OF.rescue.exchange);
    [OF.timber.inspect, OF.timber.sling].forEach(complete);
    choose(OF.timber.trim, 'left'); assert.ok(!w.done.has(OF.timber.trim));
    choose(OF.timber.trim, 'right'); assert.ok(!w.done.has(OF.timber.trim));
    choose(OF.timber.trim, 'right'); assert.ok(w.done.has(OF.timber.trim));
    assert.ok(passage('OrleansCarpentersDitchBridge').enabled);
    complete(OF.timber.cross);
    [OF.under.toolbag, OF.under.lower, OF.under.upper].forEach(complete);
    assert.ok(passage('OrleansServiceEscapeDeck').enabled);
    w.done.add(J.orleansBattery);
    [OF.shields.repair, OF.shields.blue, OF.shields.red, OF.shields.mural].forEach(complete);

    [QF.lists.people, QF.lists.tools, QF.lists.seats].forEach(complete);
    assert.ok(w.scene.getObjectByName('QinReservedFamilySeats').visible);
    [QF.cart.find, QF.cart.align, QF.cart.wheel].forEach(complete);
    approach(QF.cart.push); tap();
    const qinCart = w.scene.getObjectByName('QinRepairedSupplyCart');
    for (let i = 0; i < 10 && !w.done.has(QF.cart.push); i++) {
      frame(34);
      const p = qinCart.position;
      const floor = w.combat.geometry.ground(p.x, p.z, p.y + 1.5);
      assert.ok(floor, 'cart siding supports the player');
      w.player.teleport(p.x, floor.point.y + .08, p.z);
    }
    assert.ok(w.done.has(QF.cart.push));
    approach(QF.cart.cache); w.combat.state.ammo = 10; tap();
    assert.ok(w.done.has(QF.cart.cache));
    complete(QF.stars.foot);
    assert.equal(passage('QinAstronomerHingedDeck').enabled, false);
    complete(QF.stars.latch);
    assert.ok(passage('QinAstronomerHingedDeck').enabled);
    complete(QF.stars.view);
    [QF.oldRank.traces, QF.oldRank.first, QF.oldRank.second, QF.oldRank.exit].forEach(complete);
    assert.equal(passage('QinOldRankSlidingPanel').enabled, false);
    [QF.troupe.entry, QF.troupe.frame, QF.troupe.finish].forEach(complete);
    assert.ok(passage('QinAcrobatJumpBoard').enabled);
    complete(QF.range.read);
    approach(QF.range.start); tap();
    frame(122);
    const [rx, ry, rz] = marker(QF.range.start).p;
    w.player.teleport(rx + 1.85, ry - .82, rz);
    frame(110);
    w.player.teleport(rx, ry - .82, rz);
    frame(130);
    assert.ok(w.done.has(QF.range.start));
    assert.ok(w.scene.getObjectByName('QinSealGeneralRangeMark').visible);

    assert.equal(passage('QinQuietRoomDoor').enabled, true);
    [Q.alcove, Q.door, Q.sketch].forEach(complete);
    assert.equal(passage('QinQuietRoomDoor').enabled, false);
    approach(Q.supplies); w.combat.state.ammo = 12; tap();
    assert.equal(w.combat.state.ammo, 36);
    assert.ok(w.done.has(Q.supplies));

    [S.log, S.playback].forEach(complete);
    const projection = w.scene.getObjectByName('SkyRescueMemoryProjection');
    const evacuee = w.scene.getObjectByName('MemoryLastEvacuee');
    assert.equal(projection.visible, true);
    const queue = evacuee.position.x; frame(138);
    assert.ok(evacuee.position.x < queue - .15);
    [S.conduit, S.repair, S.lookout].forEach(complete);
    approach(S.medicine); tap(); assert.equal(w.done.has(S.medicine), false);
    const full = w.combat.state.maxHp;
    w.combat.state.hp = full - 51;
    tap(); assert.ok(w.done.has(S.medicine)); assert.equal(w.combat.state.hp, full - 11);
    saved = window.localStorage.getItem(WORLD_PROGRESS_KEY)!;
    const flags: string[] = JSON.parse(saved).done;
    for (const id of [B.launch, W.return, I.choose, I.camp, K.inspect, KP.sealed, KL.counterweight, V.return, E.rack, O.bowl, Q.supplies, S.playback, S.repair, S.medicine, S.lookout]) assert.ok(flags.includes(id), id);
    assert.deepEqual(first.errors, []);
  } finally { await first.close(); }

  const restored = await bootWorldWithoutGpu({ deterministic: true, initialStorage: { [WORLD_PROGRESS_KEY]: saved } });
  try {
    restored.frame(1000 / 60);
    const { world } = restored;
    assert.equal(world.colliders.find((c: { name: string }) => c.name === 'COL_KinkakuServiceWalk')?.enabled, true);
    assert.equal(world.colliders.find((c: { name: string }) => c.name === 'COL_NassauFoldingRamp')?.enabled, true);
    assert.ok(world.done.has(B.crossed) && world.done.has(HB.release));
    assert.ok(world.done.has(HK.memorial) && world.done.has(CC.repair));
    assert.ok(world.done.has(WB.leave) && world.done.has(WS.crossing) && world.done.has(WR.rails));
    assert.ok(world.done.has(EM.return) && world.done.has(ER.prize) && world.done.has(EH.brace) && world.done.has(EW.baffle));
    assert.ok(world.done.has(QF.cart.cache) && world.done.has(QF.stars.view) && world.done.has(QF.range.start));
    assert.ok(world.done.has(OF.bell.flag) && world.done.has(OF.rescue.medic) && world.done.has(OF.shields.mural));
    assert.ok(world.done.has(EG.settle) && world.done.has(ET.east) && world.done.has(ET.west));
    assert.equal(world.colliders.find((c: { name: string }) => c.name === 'COL_KyotoHandoffShutter')?.enabled, false);
    assert.equal(world.colliders.find((c: { name: string }) => c.name === 'COL_KyotoPaperRoofShortcut')?.enabled, true);
    assert.ok(world.done.has(I.camp));
    assert.ok(world.done.has(S.medicine));
    assert.equal(world.scene.getObjectByName('SkyReserveStatus')?.visible, false);
    assert.deepEqual(restored.errors, []);
  } finally { await restored.close(); }
});

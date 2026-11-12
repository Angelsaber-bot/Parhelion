import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Vector3 } from 'three';
import { WORLD_PROGRESS_KEY } from '../src/core/progress';
import {
  FIELD_SIDE_STORIES, ROYAL_BOAT as B, HARBOR_WAGES as W, ICE_BELL as I, KYOTO_REFLECTION as K, VALLEY_RADIO as V, SKY_MAINTENANCE as S, EGYPT_SEEDS as E, ORLEANS_SOUP as O, QIN_QUIET_ROOM as Q,
  fieldSideNext, fieldSideReady,
} from '../src/story/fieldSideStories';
import { JOURNEY as J } from '../src/story/worldJourney';
import { VALLEY_PROLOGUE as P } from '../src/story/valleyPrologue';
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
  const starting = ['armory_rack', 'saber_contract', 'blackbeard_meet', 'napoleon_meet', 'musashi_meet', P.record, J.skyReview, J.skyReturnSight, J.egyptRead, J.orleansRead, J.qinRead];
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

    assert.equal(passage('KinkakuServiceWalk')?.enabled, false);
    [K.shore, K.upper, K.inspect].forEach(complete);
    assert.equal(passage('KinkakuServiceWalk').enabled, true);
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
    assert.equal(passage('OrleansWorkshopSideGate').enabled, true);
    [O.pot, O.gate, O.share].forEach(complete);
    assert.equal(passage('OrleansWorkshopSideGate').enabled, false);
    const maxHealth = w.combat.state.maxHp;
    approach(O.bowl); w.combat.state.hp = maxHealth - 32; tap();
    assert.equal(w.combat.state.hp, maxHealth - 9);
    assert.ok(w.done.has(O.bowl));

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
    for (const id of [B.launch, W.return, I.choose, I.camp, K.inspect, V.return, E.rack, O.bowl, Q.supplies, S.playback, S.repair, S.medicine, S.lookout]) assert.ok(flags.includes(id), id);
    assert.deepEqual(first.errors, []);
  } finally { await first.close(); }

  const restored = await bootWorldWithoutGpu({ deterministic: true, initialStorage: { [WORLD_PROGRESS_KEY]: saved } });
  try {
    restored.frame(1000 / 60);
    const { world } = restored;
    assert.equal(world.colliders.find((c: { name: string }) => c.name === 'COL_KinkakuServiceWalk')?.enabled, true);
    assert.equal(world.colliders.find((c: { name: string }) => c.name === 'COL_NassauFoldingRamp')?.enabled, true);
    assert.ok(world.done.has(I.camp));
    assert.ok(world.done.has(S.medicine));
    assert.equal(world.scene.getObjectByName('SkyReserveStatus')?.visible, false);
    assert.deepEqual(restored.errors, []);
  } finally { await restored.close(); }
});

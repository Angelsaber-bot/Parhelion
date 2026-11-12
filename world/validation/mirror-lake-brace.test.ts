import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Frustum, Matrix4, Mesh, PerspectiveCamera, Vector3 } from 'three';
import { WORLD_PROGRESS_KEY } from '../src/core/progress';
import { createWorldJourneySites } from '../src/environment/worldJourneySites';
import type { SettlementPlacement } from '../src/settlements/types';
import { ADVENTURE as A } from '../src/story/openWorldCampaign';
import { VALLEY_PROLOGUE } from '../src/story/valleyPrologue';
import { VALLEY_FIELD as F } from '../src/story/valleyField';
import { commitJourneyStep, JOURNEY as J, journeyStepReady, worldJourneyGuide } from '../src/story/worldJourney';
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

test('actual World input completes Mirror Lake, West Ridge, and the optional winter return interactions', async () => {
  const h = await bootWorldWithoutGpu({ deterministic: true, initialStorage: {
    [WORLD_PROGRESS_KEY]: JSON.stringify({ done: initial, found: [] }),
  } });
  const w = h.world, d = h.window.document;
  let now = 0;
  const frame = (count: number, step = 1000 / 60) => { for (let i = 0; i < count; i++) h.frame(now += step); };
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
    assert.equal(w.contract.recruited, false, 'meet first, then make the pact after solving the guide');
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
    const lamp = w.scene.getObjectByName('WestRidgeRouteLamp')!;
    assert.ok(lamp.material.emissiveIntensity > 0);
    for (const flag of [A.arrived, 'napoleon_contract', J.bridge, J.visitor]) w.done.add(flag);
    approach(J.ridge);
    interact();
    assert.ok(w.done.has(J.ridge));
    approach(J.mealGear);
    interact();
    assert.ok(w.done.has(J.mealGear));
    approach(J.mealWindow);
    interact();
    assert.ok(w.done.has(J.mealWindow));
    assert.ok(w.done.has(J.meal));
    const window = w.layout.markers.find(m => m.id === J.mealWindow)!;
    const bowl = w.scene.getObjectByName('WinterReturnMealBowl')!;
    assert.equal(bowl.position.x, window.p[0]);
    approach(J.mealSketch);
    interact();
    assert.ok(w.done.has(J.mealSketch));
    const cart = w.scene.getObjectByName('WinterReturnMedicineCart')!;
    const crate = w.scene.getObjectByName('WinterReturnMedicineDelivered')!;
    assert.ok(cart.visible, 'a usable delivery lane was found on the production map');
    for (let i = 0; i < 65 && !crate.visible; i++) {
      frame(1, 1000 / 12);
      const p = cart.position.clone().add(new Vector3(0, .1, 0));
      assert.ok(w.combat.geometry.clear(p, .32, .9), `medicine route blocked at ${p.toArray()}`);
    }
    assert.ok(crate.visible);
    assert.deepEqual(h.errors, []);
  } finally { await h.close(); }
});

test('the ridge and visitor workbench reflect persistent World outcomes', () => {
  const site = createWorldJourneySites({ position: [0, 5, 0] } as SettlementPlacement, () => 4.5, () => true);
  const done = new Set(initial);
  try {
    const bench = site.root.getObjectByName('LookbackVisitorWorkbench')!;
    site.apply(done);
    assert.equal(bench.visible, false);
    assert.equal(journeyStepReady(J.ridge, done), false);
    assert.ok(commitJourneyStep(J.lake, done));
    assert.ok(commitJourneyStep(J.lakePin, done));
    assert.equal(worldJourneyGuide('alpha', done)?.targetId, J.ridge);
    assert.ok(commitJourneyStep(J.ridge, done));
    assert.equal(commitJourneyStep(J.visitorDesk, done), null);
    done.add(J.bridge);
    assert.ok(commitJourneyStep(J.visitor, done));
    site.apply(done);
    assert.equal(bench.visible, true);
    const desk = site.markers.find(marker => marker.id === J.visitorDesk)!;
    site.update(.1, new Vector3(...desk.p));
    const visitor = site.root.getObjectByName('Resident_journey_visitor_actor')!;
    assert.ok(visitor.position.distanceTo(new Vector3(...desk.p)) < 3);
    assert.ok(commitJourneyStep(J.visitorDesk, done));
    assert.equal(commitJourneyStep(J.visitorDesk, done), null);
  } finally { site.dispose(); }
});

test('the shared table and porch window satisfy the same winter return requirement', () => {
  for (const seat of [J.meal, J.mealWindow]) {
    const done = new Set([...initial, A.arrived, 'napoleon_contract', J.bridge]);
    assert.equal(commitJourneyStep(seat, done), null);
    done.add(J.visitor);
    assert.equal(journeyStepReady(J.mealSketch, done), false);
    assert.ok(commitJourneyStep(J.mealGear, done));
    assert.ok(commitJourneyStep(seat, done));
    assert.ok(done.has(J.meal));
    assert.equal(journeyStepReady(J.mealWindow, done), false);
    assert.ok(commitJourneyStep(J.mealSketch, done));
  }
});

test('merged World fixture draws can be culled independently in each distant region', () => {
  const site = createWorldJourneySites({ position: [0, 5, 0] } as SettlementPlacement, (_x, _z, ceiling = 7) => ceiling - 2, () => true);
  try {
    site.root.updateMatrixWorld(true);
    const groups = ['Egypt', 'Orleans', 'Qin'].map(region => {
      const group = site.root.getObjectByName('WorldJourneyFixtures' + region)!;
      const geometry = group.children.filter(child => child instanceof Mesh);
      assert.ok(geometry.length > 0, region);
      return { bounds: new Box3().setFromObject(group), geometry };
    });
    for (const [index, group] of groups.entries()) {
      const center = group.bounds.getCenter(new Vector3());
      const camera = new PerspectiveCamera(60, 1, .1, 40);
      camera.position.copy(center).add(new Vector3(0, 8, 18));
      camera.lookAt(center);
      camera.updateMatrixWorld(true);
      const frustum = new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
      const visible = groups.map(candidate => candidate.geometry.some(mesh => frustum.intersectsObject(mesh)));
      assert.deepEqual(visible, groups.map((_candidate, i) => i === index));
    }
  } finally { site.dispose(); }
});

test('winter medicine moves to the residence stock point and returns there on a completed save', () => {
  const create = () => createWorldJourneySites({ position: [0, 5, 0] } as SettlementPlacement, () => 4.5, () => true);
  const site = create(), restored = create();
  const done = new Set([...initial, A.arrived, 'napoleon_contract', J.bridge, J.visitor]);
  try {
    site.apply(done);
    const cart = site.root.getObjectByName('WinterReturnMedicineCart')!;
    const crate = site.root.getObjectByName('WinterReturnMedicineDelivered')!;
    const seat = site.markers.find(marker => marker.id === J.mealWindow)!;
    const player = new Vector3(...seat.p);
    const start = cart.position.clone();
    assert.equal(crate.visible, false);
    for (let i = 0; i < 30; i++) site.update(.1, player);
    assert.ok(cart.position.distanceTo(start) > 2);
    for (let i = 0; i < 50; i++) site.update(.1, player);
    assert.equal(crate.visible, true);
    assert.ok(commitJourneyStep(J.mealWindow, done));
    restored.apply(done);
    assert.equal(restored.root.getObjectByName('WinterReturnMedicineDelivered')!.visible, true);
    assert.deepEqual(restored.root.getObjectByName('WinterReturnMedicineCart')!.position.toArray(), cart.position.toArray());
  } finally {
    site.dispose();
    restored.dispose();
  }
});

test('shooting the Mirror Lake clevis through the actual rifle input also signs Saber’s pact', async () => {
  const h = await bootWorldWithoutGpu({ deterministic: true, initialStorage: {
    [WORLD_PROGRESS_KEY]: JSON.stringify({ done: [...initial, J.lake], found: [] }),
  } });
  const w = h.world, d = h.window.document;
  let now = 0;
  const frame = (count: number) => { for (let i = 0; i < count; i++) h.frame(now += 1000 / 60); };
  try {
    (d.getElementById('start') as HTMLElement).click();
    frame(3);
    const pin = w.scene.getObjectByName('TGT_' + J.lakePin)!;
    assert.ok(pin?.visible);
    const aim = pin.getWorldPosition(new Vector3());
    const floor = w.combat.geometry.ground(aim.x + 3.2, aim.z + .75, aim.y + 1)!;
    assert.ok(floor, 'dry firing position on the east bank');
    w.player.teleport(floor.point.x, floor.point.y + .15, floor.point.z, Math.PI / 2);
    frame(22);
    assert.equal(w.contract.recruited, false);
    const canvas = d.getElementById('view')!;
    for (let i = 0; i < 3 && !w.done.has(J.lakePin); i++) {
      w.camera.position.copy(w.player.pos).add(new Vector3(0, 1.45, 0));
      w.camera.lookAt(aim);
      w.camera.updateMatrixWorld(true);
      for (const type of ['mousedown', 'mouseup'])
        canvas.dispatchEvent(new h.window.MouseEvent(type, { button: 0, bubbles: true, cancelable: true }));
      frame(14);
    }
    assert.ok(w.done.has(J.lakePin));
    assert.ok(w.done.has(J.lakeWinch));
    assert.ok(w.contract.recruited);
    assert.ok(w.contract.isFollowing('saber'));
    assert.deepEqual(h.errors, []);
  } finally { await h.close(); }
});

test('returning from Egypt unlocks H09 observations while the Sky handover still requires all three realms', () => {
  const done = new Set([...initial, F.nightDone, J.egyptDone]);
  assert.equal(worldJourneyGuide('alpha', done)?.targetId, F.roofSight);
  assert.equal(commitJourneyStep(J.skyBearing, done), null);
  assert.ok(commitJourneyStep(F.roofSight, done));
  assert.equal(worldJourneyGuide('alpha', done)?.targetId, J.skyBearing);
  assert.ok(commitJourneyStep(J.skyBearing, done));
  assert.equal(worldJourneyGuide('alpha', done)?.targetId, J.skySight);
  assert.ok(commitJourneyStep(J.skySight, done));
  done.add(F.drillDone);
  assert.equal(commitJourneyStep(J.handover, done), null);
  done.add(J.orleansDone);
  assert.equal(commitJourneyStep(J.handover, done), null);
  done.add(J.qinDone);
  assert.ok(commitJourneyStep(J.handover, done));
});

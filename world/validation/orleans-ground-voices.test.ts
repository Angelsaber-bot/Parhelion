import test from 'node:test';
import assert from 'node:assert/strict';
import { Mesh, Raycaster, Vector3 } from 'three';
import { createSkyCrownScene } from '../src/environment/skyCrownScene';
import { skyHallRouteMarks, SKY_APPROACH_DECKS } from '../src/environment/skyCrownApproach';
import { commitFieldAction } from '../src/story/fieldChapters';
import { ORLEANS_FINALE_ACTIONS, OF } from '../src/story/orleansFinale';
import { ADVENTURE } from '../src/story/openWorldCampaign';
import { VALLEY_PROLOGUE } from '../src/story/valleyPrologue';
import { commitJourneyStep, journeyStepById, JOURNEY as J } from '../src/story/worldJourney';

const crossing = [ADVENTURE.started, VALLEY_PROLOGUE.record, OF.watch, OF.road, J.skyScan, J.returnHome];
test('one salvaged bell has one home; both its ground signal and its return call survive a reload', () => {
  for (const [id, other, place] of [[OF.bridgeBell, OF.quayBell, /cart|wheels/], [OF.quayBell, OF.bridgeBell, /ferry|boat/]] as const) {
    const done = new Set<string>(crossing);
    const ring = (flag: string) => commitFieldAction(ORLEANS_FINALE_ACTIONS.find(a => a.id === flag)!, done, ORLEANS_FINALE_ACTIONS);
    assert.ok(ring(id));
    assert.equal(ring(other), false);
    const restored = new Set(done);
    assert.match(commitJourneyStep(J.skyReview, restored)![1], place);
    assert.match(commitJourneyStep(J.epilogue, restored)![1], place);
    assert.equal(commitJourneyStep(J.epilogue, restored), null);
  }
  assert.deepEqual(commitJourneyStep(J.epilogue, new Set(crossing)), journeyStepById.get(J.epilogue)!.result);
});

test('the live observation changes on the actual hall deck while its recorded twin stays frozen', () => {
  const sky = createSkyCrownScene();
  try {
    const monitor = sky.root.getObjectByName('SkyLiveCrossing')!;
    const recording = sky.root.getObjectByName('SkyRecordedCrossing')!;
    const pos = new Vector3(...SKY_APPROACH_DECKS.hall.p);
    for (const [flag, glyph] of [[OF.quayBell, 0], [OF.bridgeBell, 1]] as const) {
      sky.apply(new Set([...crossing, flag]));
      assert.ok(monitor.visible && monitor.children[glyph].visible);
      const frozen = recording.children[glyph].matrix.clone();
      for (let i = 0; i < 6; i++) sky.updateApproach(.25, pos, () => {});
      sky.root.updateMatrixWorld(true);
      assert.ok(recording.children[glyph].matrix.equals(frozen));
      assert.ok(!monitor.children[glyph].matrix.equals(frozen));
    }
    sky.apply(new Set(crossing));
    assert.equal(monitor.visible, false);
  } finally { sky.dispose(); }
});


test('both junction trails are visible past the hall screen from the console and respawn approaches', () => {
  const sky = createSkyCrownScene();
  try {
    sky.apply(new Set([J.skyScan, J.skyReview]));
    sky.root.updateMatrixWorld(true);
    const meshes: Mesh[] = [];
    sky.root.traverseVisible(node => {
      const mesh = node as Mesh;
      if (!mesh.isMesh) return;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      if (materials.some(material => material.visible && material.opacity > .5)) meshes.push(mesh);
    });
    const desk = new Vector3(...sky.markers.find(m => m.id === J.skyReview)!.p);
    const checkpoint = new Vector3(...SKY_APPROACH_DECKS.hall.p);
    desk.y += .65;
    checkpoint.y += 1.65;
    const eyes = [desk, checkpoint, desk.clone().add(new Vector3(-1, 0, 0)),
      desk.clone().add(new Vector3(1, 0, 0)), checkpoint.clone().add(new Vector3(-.5, 0, 0))];
    for (const route of ['light', 'service'] as const) {
      const marks = skyHallRouteMarks(route);
      assert.equal(marks.length, route === 'light' ? 6 : 3);
      for (const eye of eyes) for (const { from, to } of marks) {
        const point = from.clone().lerp(to, .5);
        point.y += .06;
        const ray = new Raycaster(eye, point.clone().sub(eye).normalize(), .02, eye.distanceTo(point) + .5);
        const hit = ray.intersectObjects(meshes, false)[0];
        assert.ok(hit && hit.object.name === 'Campaign_alpha_glow' && hit.point.distanceTo(point) < .25,
          `${route} at ${eye.toArray()} sees ${hit?.object.name} before the floor inlay at ${point.toArray()}`);
      }
    }
  } finally { sky.dispose(); }
});

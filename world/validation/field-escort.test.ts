import assert from 'node:assert/strict';
import test from 'node:test';
import { createFieldChapters } from '../src/story/fieldChapters';
import { QIN_CHAPTERS, QX } from '../src/story/qinChapters';
import { WC, WINTER_CHAPTERS } from '../src/story/winterChapters';

const pickups = [
  { set: WINTER_CHAPTERS.set, id: WC.stretcher, prerequisites: ['adventure_v2', WC.w04, WC.crate] },
  { set: QIN_CHAPTERS.set, id: QX.guide, prerequisites: ['journey_qin_workers', QX.roster] },
];

type Point = [number, number, number];
const route: Point[] = [[0, 0, 0], [20, 0, 0], [20, 0, 12]];
const along = (metres: number): Point => [Math.min(20, metres), 0, Math.max(0, metres - 20)];

for (const { set, id, prerequisites } of pickups) {
  test(`${id} cannot be completed by waiting at the pickup, even with three legacy timer quarters`, () => {
    const quarters = [1, 2, 3].map(n => `${id}_${n}`);
    const done = new Set([...prerequisites, ...quarters]);
    let saves = 0;
    const runtime = createFieldChapters({
      sets: [set], done, reachable: () => true, position: () => route[0], escortRoute: () => route,
      save: () => { saves++; return true; }, changed() {}, toast() {}, start: () => false,
    });
    assert.ok(runtime.ready(id));
    assert.deepEqual(runtime.escortPose(id)?.point, along(24), 'three old timer quarters place the group at the last checkpoint');
    runtime.interact(id);
    for (let frame = 0; frame < 1200; frame++) runtime.update(1 / 60, true, [0, 0, 0]);
    assert.equal(done.has(id), false, 'a stationary player has never escorted anyone');
    assert.equal(saves, 0, 'waiting produces no chapter progress');
    done.add(id);
    assert.equal(runtime.ready(id), false, 'a save with the existing completion flag stays complete');
  });

  test(`${id} follows the player around the turn, resumes at a saved point and commits the handoff once`, () => {
    const done = new Set(prerequisites);
    let canSave = true;
    const saves: string[][] = [];
    const makeRuntime = () => createFieldChapters({
      sets: [set], done, reachable: () => true, position: () => route[0], escortRoute: () => route,
      save: () => { if (canSave) saves.push([...done]); return canSave; },
      changed() {}, toast() {}, start: () => false,
    });
    let runtime = makeRuntime();
    const hold = (point: Point, frames = 180, playable = true) => {
      for (let i = 0; i < frames; i++) runtime.update(1 / 60, playable, point);
    };
    const walk = (from: number, to: number) => {
      const steps = Math.ceil((to - from) * 60);
      for (let step = 0; step < steps; step++) {
        runtime.update(1 / 60, true, along(from + (to - from) * (step + 1) / steps));
      }
    };
    assert.ok(runtime.interact(id));
    assert.ok(runtime.escortGuide(), 'pickup supplies the player with a direction');
    hold(route[0]);
    hold(route.at(-1)!);
    assert.equal(runtime.progress(id), 0, 'running ahead to the destination leaves the group waiting');
    hold([1, 6, 0]);
    hold([1, 0, 3]);
    assert.equal(runtime.progress(id), 0, 'standing on another level or across the route cannot move the group');
    hold(route[0], 2);
    walk(0, 13);
    assert.ok(done.has(`${id}_1`) && !done.has(`${id}_2`), 'the party makes real progress after the player returns');
    const atPause = runtime.progress(id);
    hold(along(16), 180, false);
    assert.equal(runtime.progress(id), atPause, 'paused time cannot move the party');

    runtime.reset();
    runtime = makeRuntime();
    const resume = runtime.escortPose(id);
    assert.ok(resume && !resume.active && resume.point[0] > 0 && resume.point[0] < 13, 'group returns to its saved quarter on reload');
    assert.ok(runtime.interact(id));
    walk(resume.point[0], 27);
    assert.ok(done.has(`${id}_3`) && !done.has(id), 'passing the corner alone does not deliver the group');
    canSave = false;
    walk(27, 32);
    hold(route.at(-1)!);
    assert.ok(!done.has(id), 'a failed save rolls back the handoff');
    canSave = true;
    const restart = runtime.escortPose(id);
    assert.ok(restart);
    if (!restart.active) runtime.interact(id);
    walk(restart.point[0] + restart.point[2], 32);
    hold(route.at(-1)!);
    assert.ok(done.has(id), 'arriving together commits the handoff');
    const snapshotCount = saves.length;
    runtime.interact(id);
    hold(route.at(-1)!);
    assert.equal(saves.length, snapshotCount, 'another interaction cannot duplicate the handoff');
    assert.equal(runtime.escortGuide(), null);
  });
}

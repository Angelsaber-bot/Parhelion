import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createOrleansCrossingTeams, CROSSING, figureGeometry } from '../src/environment/orleansCrossingTeams';

test('O08 teams rehearse the crossing together, then hold the finished positions', () => {
  const g = figureGeometry('#2f4d8c', true); g.computeBoundingBox(); assert.ok(g.boundingBox!.max.y > 1.6 && g.boundingBox!.max.y < 1.9); g.dispose();
  const spots = { deckFrom: [0, 10, 0], deckMark: [0, 10, -30], boatFrom: [20, 1, -40], boatPier: [5, 1, -32], coverFrom: [10, 10, 5], coverTo: [8, 10, -5] } as const;
  const teams = createOrleansCrossingTeams(spots, () => 10), near = new THREE.Vector3(0, 10, -20);
  teams.apply('hidden'); assert.equal(teams.root.visible, false);
  teams.apply('rehearsing'); teams.update(.5, near); assert.ok(teams.progress() < .1, 'a rehearsal starts at the beginning');
  teams.update(CROSSING.cycle - 2.6, near); assert.ok(teams.progress() > .9, 'and reaches the mark within one cycle');
  teams.update(2.5, near); assert.ok(teams.progress() < .2, 'then loops');
  teams.apply('done'); teams.update(.1, near); assert.equal(teams.progress(), 1, 'after the run they hold the finished positions');
  const [engineers] = teams.root.children as THREE.InstancedMesh[], m = new THREE.Matrix4(), p = new THREE.Vector3();
  engineers.getMatrixAt(0, m); p.setFromMatrixPosition(m); assert.ok(Math.hypot(p.x - spots.deckMark[0], p.z - spots.deckMark[2]) < 2, 'engineers stand at the mark');
  teams.update(.1, new THREE.Vector3(5000, 0, 5000)); assert.equal(teams.root.visible, false, 'not drawn from far away');
  teams.dispose();
});

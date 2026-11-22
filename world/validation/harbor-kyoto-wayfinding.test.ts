import assert from 'node:assert/strict';
import test from 'node:test';
import { DoubleSide, Ray, Vector3 } from 'three';
import { createBlackSailCivilLandscape } from '../src/environment/blackSailCivilLandscape';
import { createKyotoWitnessScene } from '../src/environment/kyotoWitnessScene';
import { ADVENTURE_ACTIONS } from '../src/story/adventureSites';
import { BC, BLACKSAIL_CHAPTER_ACTIONS } from '../src/story/blacksailChapters';
import { JC } from '../src/story/kyotoDecreeCourt';
import { KYOTO_WITNESS as Y } from '../src/story/kyotoWitness';

test('the auction starts on the walkable lookout above the open customs gate', () => {
  const harbor = createBlackSailCivilLandscape(() => null);
  const station = (id: string) => {
    const action = BLACKSAIL_CHAPTER_ACTIONS.find(entry => entry.id === id)!;
    const anchor = harbor.markers.find(entry => entry.id === action.near)!;
    const [dx, dz] = action.off ?? [0, 0];
    const ray = new Ray(new Vector3(anchor.p[0] + dx, anchor.p[1] + 1, anchor.p[2] + dz), new Vector3(0, -1, 0));
    const floor = harbor.collider.bvh.raycastFirst(ray, DoubleSide);
    assert.ok(floor, `standing surface for ${id}`);
    return floor.point;
  };
  try {
    const deck = station(BC.watch), gate = station(BC.chest);
    assert.ok(deck.y - gate.y > 8, 'the lookout overlooks the auction yard');
    assert.ok(deck.distanceTo(gate) > 50, 'the player must leave the lookout to read the document');
    const eye = deck.clone().add(new Vector3(0, 1.65, 0));
    const pennant = new Vector3(647.15, 17.85, -606.2);
    const view = new Ray(eye, pennant.clone().sub(eye).normalize());
    const obstruction = harbor.collider.bvh.raycastFirst(view, DoubleSide, 0, eye.distanceTo(pennant));
    assert.equal(obstruction, null, 'the twin customs pennants are visible from the standing point');
  } finally { harbor.dispose(); }
});

test('both Kyoto deliveries lead Aki through the same fire screen and reload beyond it', () => {
  const actions = new Map(ADVENTURE_ACTIONS.map(action => [action.id, action]));
  const gateZ = actions.get(Y.gate)!.p[2] - 1.6;
  for (const branch of [Y.public, Y.private]) {
    const scene = createKyotoWitnessScene(actions), restored = createKyotoWitnessScene(actions);
    const aki = scene.root.getObjectByName('KyotoCopyistAki')!;
    const reading = scene.root.getObjectByName('KyotoPublicCorrections')!;
    const bystander = scene.root.getObjectByName('Resident_kyoto_court_witness')!;
    const officer = scene.root.getObjectByName('Resident_kyoto_temple_envoy')!;
    const done = new Set<string>(['musashi_meet', Y.reel, Y.winch, Y.testimony]);
    try {
      scene.apply(done, 0);
      assert.ok(scene.root.visible);
      assert.ok(officer.parent!.visible);
      done.add(branch); scene.apply(done, 0);
      assert.ok(aki.position.distanceTo(new Vector3(...actions.get(branch)!.p)) < 2);
      assert.equal(reading.visible, branch === Y.public);
      assert.equal(officer.parent!.visible, branch === Y.private);
      done.add(Y.gate); scene.apply(done, 0);
      assert.equal(scene.screenCollider.enabled, false);
      assert.equal(officer.parent!.visible, false);
      const inside = aki.position.z;
      assert.ok(inside < gateZ && bystander.position.z < gateZ);
      done.add(JC.walk); scene.apply(done, 0);
      assert.equal(aki.position.z, inside, 'pause does not advance their walk');
      scene.apply(done, .5);
      assert.ok(aki.position.z > inside && aki.position.z < gateZ);
      scene.apply(done, 3);
      assert.ok(aki.position.z > gateZ && bystander.position.z > gateZ);
      restored.apply(done, 0);
      assert.deepEqual(restored.root.getObjectByName('KyotoCopyistAki')!.position, aki.position);
      assert.deepEqual(restored.root.getObjectByName('Resident_kyoto_court_witness')!.position, bystander.position);
    } finally { scene.dispose(); restored.dispose(); }
  }
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { createKingdomRoadLandscape } from '../src/environment/kingdomRoadLandscape';
import { createWinterCivilLandscape } from '../src/environment/winterCivilLandscape';
import { createWinterCustomsWorks } from '../src/environment/winterCustomsWorks';
import { WINTER_FLAG_RAIL as rail } from '../src/map/winterCivilPlan';
import { type Collider } from '../src/player/player';
import { KINGDOM_ROAD as K, commitKingdomRoad, kingdomRoadNext } from '../src/story/kingdomRoad';
import { WC, WINTER_CHAPTERS } from '../src/story/winterChapters';

test('Camelot plans lead to different working handles and reconstruct the chosen crossing on load', () => {
  for (const plan of [K.front, K.side]) {
    const scene = createKingdomRoadLandscape(() => 31);
    try {
      const done = new Set(['kingdom_works_lamp_fixed']);
      const handle = scene.markers.find(m => m.id === K.finish)!;
      assert.ok(commitKingdomRoad(plan, done));
      scene.apply(done);
      assert.ok(commitKingdomRoad(K.start, done));
      assert.equal(kingdomRoadNext(done), null);
      done.add('sun_core');
      assert.equal(kingdomRoadNext(done)?.id, handle.id);
      const namedAsset = plan === K.front ? 'COL_KingdomIntactOuterWinch' : 'COL_KingdomAbbeyDonatedSpan';
      const geometry = scene.colliders.find(c => c.name === namedAsset)!.bvh.geometry;
      geometry.computeBoundingBox();
      assert.ok(geometry.boundingBox!.distanceToPoint(new THREE.Vector3(...handle.p)) < handle.radius!);
      assert.ok(commitKingdomRoad(K.finish, done));
      scene.apply(done);
      assert.equal(scene.colliders.find(c => c.name === 'COL_KingdomPermanentCartBridge')!.enabled, plan === K.front);
      assert.equal(scene.colliders.find(c => c.name === 'COL_KingdomAbbeyDonatedSpan')!.enabled, plan === K.front);
      assert.equal(kingdomRoadNext(done), null);
    } finally { scene.dispose(); }
  }
});

test('the customs flag moves from its pole to a real railing, leaving the stretcher lane clear', () => {
  const civil = createWinterCivilLandscape(() => 8);
  const works = createWinterCustomsWorks();
  const fallen = works.root.getObjectByName('WinterFallenStandard')!;
  const railCollider = works.colliders.find(c => c.name === 'COL_WinterStandardBridgeRail')!;
  const flag = WINTER_CHAPTERS.props.find(p => p.at === WC.flag && p.show)!;
  const hit = (c: Collider, x: number, z: number, dz: number) => c.enabled &&
    !!c.bvh.raycastFirst(new THREE.Ray(new THREE.Vector3(x, rail.deck + .99, z - 720), new THREE.Vector3(0, 0, dz)), THREE.DoubleSide, 0, 1.1);
  try {
    const before = new Set<string>([WC.flag]);
    works.apply(before, 0);
    assert.ok(flag.show!(before)); assert.equal(fallen.visible, false);
    const delivered = new Set<string>([WC.flag, WC.key]);
    works.apply(delivered, 0);
    assert.equal(flag.show!(delivered), false); assert.ok(fallen.visible);
    assert.equal(hit(civil.collider, rail.x, rail.z + .8, -1), false);
    assert.equal(railCollider.enabled, false);
    const after = new Set<string>(['winter_core', WC.pole]);
    works.apply(after, 0);
    assert.equal(fallen.visible, false); assert.ok(hit(railCollider, rail.x, rail.z + .8, -1));
    assert.equal(hit(railCollider, rail.x, 228, 1), false);
    works.apply(before, 0);
    assert.equal(railCollider.enabled, false);
  } finally { works.dispose(); civil.dispose(); }
});

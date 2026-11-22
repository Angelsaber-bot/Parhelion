import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { SiteArt } from '../src/story/campaignSites';
import { addSkyCrownArchitecture } from '../src/environment/skyCrownArchitecture';
import { SKY_APPROACH_DECKS as decks } from '../src/environment/skyCrownApproach';

test('each canopy sheet in the five Sky Crown buildings bears onto both end rafters', () => {
  const art = new SiteArt();
  addSkyCrownArchitecture(art, decks);
  art.finish('alpha');
  const geometry = art.layers.get('body')!.geometry, bvh = new MeshBVH(geometry);
  const steel = new THREE.Color('#293f52'), tint = new THREE.Color();
  const up = new THREE.Vector3(0, 1, 0);
  const canopies = [
    [decks.dock, -11, 0, 12, 16, 5.3],
    [decks.hall, 0, -7, 35, 21, 9.4],
    [decks.service, -14, -4.5, 15, 15, 5.6],
    [decks.archive, 0, 0, 28, 19, 5.2],
    [decks.court, 6.7, -9, 10, 9, 4.6],
  ] as const;
  try {
    for (const [deck, x, z, w, depth, height] of canopies) {
      for (let i = 0; i < 8; i++) for (const side of [-1, 1]) {
        const px = deck.p[0] + x + (i - 3.5) * w / 8, pz = deck.p[2] + z + side * (depth / 2 - .25);
        const u = i / 4 - 1, v = (i + 1) / 4 - 1;
        const spring = deck.p[1] + height + .58 * (1 - (u * u + v * v) / 2);
        const rafter = new THREE.Ray(new THREE.Vector3(px, spring - .38, pz), up);
        const roof = new THREE.Ray(new THREE.Vector3(px, spring - .06, pz - side * .6), up);
        const supports = bvh.raycast(rafter, THREE.DoubleSide, 0, .46).filter(hit => {
          tint.fromBufferAttribute(geometry.attributes.color, hit.face!.a);
          return Math.abs(tint.r - steel.r) + Math.abs(tint.g - steel.g) + Math.abs(tint.b - steel.b) < .001;
        });
        const sheet = bvh.raycastFirst(roof, THREE.DoubleSide, 0, .17);
        assert.ok(supports.length && sheet, `unsupported roof at ${px},${pz}`);
        const bearing = Math.max(...supports.map(hit => hit.point.y));
        assert.ok(Math.abs(sheet.point.y - bearing) < .035, `gap under the sheet at ${px},${pz}`);
      }
    }
  } finally {
    for (const mesh of art.layers.values()) mesh.geometry.dispose();
    for (const geometry of art.solids) geometry.dispose();
    for (const material of Object.values(art.materials)) material.dispose();
  }
});

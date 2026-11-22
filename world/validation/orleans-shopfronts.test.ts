import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { regionLoader, bakeQuantized } from '../src/rendering/glb';

interface House {
  position: [number, number, number];
  rotation: number;
  width: number;
  depth: number;
  family: string;
}

test('issued Orleans shopfronts keep the inhabited doorways visible and carry their trade fittings', async () => {
  const bytes = readFileSync(new URL('../public/assets/world_orleans.visual.glb', import.meta.url));
  const { scene } = await regionLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  bakeQuantized(scene);
  const town = scene.getObjectByName('orleans_RiverTown') as THREE.Mesh;
  const houses: House[] = town.userData.houses;
  const tree = new MeshBVH(town.geometry);
  const down = new THREE.Vector3(0, -1, 0);
  const families = new Set<string>();
  for (const h of houses) {
    families.add(h.family);
    const [x, y, z] = h.position, w = h.width;
    const cos = Math.cos(h.rotation), sin = Math.sin(h.rotation);
    const point = (u: number, v: number, out: number) =>
      new THREE.Vector3(x + u * cos + (h.depth / 2 + out) * sin, y + v, z - u * sin + (h.depth / 2 + out) * cos);
    const inward = new THREE.Vector3(-sin, 0, -cos);
    for (const level of [.4, .5, 1.05, 1.6, 2.15, 2.7, 3.25]) {
      const door = new THREE.Ray(point(0, level, 3.2), inward);
      assert.equal(tree.raycastFirst(door, THREE.DoubleSide, 0, 3.86), null, `${h.family} at ${h.position}, crossbar at ${level} m`);
    }
    for (const u of [-.62, .62]) for (const v of [.48, 1.6, 2.1]) {
      const passage = new THREE.Ray(point(u, v, 3.2), inward);
      assert.equal(tree.raycastFirst(passage, THREE.DoubleSide, 0, 3.86), null, `${h.family} passage ${u},${v}`);
    }
    const fittings: Record<string, [number, number, number]> = {
      'river-merchant': [w * .31, 5.96, .95],
      'stone-arcade': [-w * .30 + .67, 1.55, .93],
      'harbour-warehouse': [0, 6.18, 3.22],
      'narrow-street-house': [w * .28, 7.9, .98],
      'artisan-workshop': [(w * .46 + 1.58) / 2 + .34, 2.78, 1.32],
      'oriel-corner-house': [-w * .20 + 1.39, 4.14, .65],
    };
    assert.ok(fittings[h.family], h.family);
    const fitting = new THREE.Ray(point(...fittings[h.family]), down);
    assert.ok(tree.raycastFirst(fitting, THREE.DoubleSide, 0, .35), `${h.family} missing fixture at ${h.position}`);
  }
  assert.equal(houses.length, 45);
  assert.equal(families.size, 6);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { regionLoader, bakeQuantized } from '../src/rendering/glb';
import { CITY_Y, HONNOJI } from '../tools/gen/kyoto/layout';

// Check compressed production geometry, including the visual stream used by the
// game. Roof skins and wall infill live in different batches and must still join.
const up = new THREE.Vector3(0, 1, 0), y = CITY_Y + .6;
const [hx, hz] = HONNOJI.c;
for (const suffix of ['', '.visual']) {
  const bytes = readFileSync(new URL(`../public/assets/world_kyoto${suffix}.glb`, import.meta.url));
  const { scene } = await regionLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  bakeQuantized(scene);
  const mesh = (name: string) => {
    const object = scene.getObjectByName(name) as THREE.Mesh;
    assert.ok(object?.isMesh, `delivered ${name}`);
    return new MeshBVH(object.geometry);
  };
  const walls = mesh('Honnoji'), roofs = mesh('Kyoto_RoofCraft');
  const hit = (bvh: MeshBVH, p: number[], direction: THREE.Vector3) =>
    bvh.raycastFirst(new THREE.Ray(new THREE.Vector3(...p), direction), THREE.DoubleSide);

  function closedAttic(x: number, z: number, base: number, w: number, d: number) {
    for (const axis of [0, 2]) for (const side of [-1, 1]) for (const fraction of [-.75, -.35, .15, .65]) {
      const p = [x, base - .2, z];
      p[axis] += side * (axis === 0 ? w : d) / 2;
      p[axis === 0 ? 2 : 0] += fraction * (axis === 0 ? d : w) / 2;
      const roof = hit(roofs, p, up);
      assert.ok(roof, 'actual roof underside above the wall');
      for (const height of [base + .10, (base + roof.point.y) / 2, roof.point.y - .10]) {
        const from = [...p]; from[1] = height; from[axis] += side * 2;
        const direction = new THREE.Vector3(); direction.setComponent(axis, -side);
        const wall = hit(walls, from, direction);
        assert.ok(wall && wall.distance < 2.12,
          `continuous attic at ${p}, height ${height}; gap or recessed hit ${wall?.distance}`);
      }
    }
  }

  test(`Honnoji${suffix}: main hall and priests' quarters close against all four roof slopes`, () => {
    closedAttic(hx - 18, hz, y + 8, 22, 30);
    closedAttic(hx - 22, hz + 35, y + 5, 26, 10);
  });

  test(`Honnoji${suffix}: all four lookout roofs have connected upper columns and roof collars`, () => {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const x = hx + sx * 42, z = hz + sz * 42;
      for (const px of [-1.6, 1.6]) for (const pz of [-1.6, 1.6]) for (const dy of [6.3, 7.2, 8.5]) {
        const column = hit(walls, [x + px + .6, y + dy, z + pz], new THREE.Vector3(-1, 0, 0));
        assert.ok(column && column.distance < .61, `upper column on lookout ${sx},${sz} at ${dy}`);
      }
      closedAttic(x, z, y + 8.6, 3.4, 3.4);
      assert.equal(hit(walls, [x + 1, y + 7.3, z], new THREE.Vector3(-1, 0, 0)), null, 'lookout remains open between columns');
    }
  });

  test(`Honnoji${suffix}: east gate trusses and bell suspension connect to their roof framing`, () => {
    for (const side of [-1, 1]) for (const height of [5.25, 5.8, 6.8, 7.4]) {
      const truss = hit(walls, [hx + 47, y + height, hz + side * 3.9], new THREE.Vector3(-1, 0, 0));
      assert.ok(truss && truss.distance < 2.2, 'gate has king posts between lintel and ridge');
    }
    const bx = hx + 28, bz = hz - 32;
    closedAttic(bx, bz, y + 7.2, 4.2, 4.2);
    for (const dy of [5.85, 6.5, 7.35]) {
      const hanger = hit(walls, [bx + .5, y + dy, bz], new THREE.Vector3(-1, 0, 0));
      assert.ok(hanger && hanger.distance < .51, 'bell crown joins suspension and crossbeam');
    }
  });
}

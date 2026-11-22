import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import * as THREE from 'three';
import { createEgyptReedMarket } from '../src/environment/egyptReedMarket';
import { createEgyptRiverworksLandscape } from '../src/environment/egyptRiverworksLandscape';
import { craftSwatchKey, egyptCraftSurfaces, qinCraftSurfaces } from '../src/environment/egyptQinCraftPalettes';
import { createQinCommandLandscape, QIN_COMMAND_RETURN } from '../src/environment/qinCommandLandscape';
import { egyptToWorld } from '../src/map/egyptPlan';
import { qinToWorld } from '../src/map/qinPlan';
import type { Collider } from '../src/player/player';

type MapPoint = (x: number, z: number) => [number, number];
function point(map: MapPoint, x: number, y: number, z: number) {
  const [wx, wz] = map(x, z);
  return new THREE.Vector3(wx, y, wz);
}

function blocked(solids: Collider[], start: THREE.Vector3, end: THREE.Vector3) {
  const ray = new THREE.Ray(start, end.clone().sub(start).normalize());
  return solids.some(s => s.enabled && s.bvh.raycastFirst(ray, THREE.DoubleSide, 0, start.distanceTo(end)));
}

test('Egyptian shelters slope to both eaves and both warehouses have two usable doors', t => {
  const market = createEgyptReedMarket(() => 14), port = createEgyptRiverworksLandscape(() => 14);
  t.after(() => { market.dispose(); port.dispose(); });
  market.root.updateMatrixWorld(true);
  const down = new THREE.Vector3(0, -1, 0);
  function roofHeight(x: number, z: number) {
    const hits = new THREE.Raycaster(point(egyptToWorld, x, 20, z), down).intersectObject(market.root);
    assert.ok(hits.length);
    return hits[0].point.y;
  }
  for (const x of [-179.45, -173.45]) {
    const ridge = roofHeight(x, 142.3);
    for (const z of [140.05, 144.55]) {
      const eave = roofHeight(x, z);
      assert.ok(eave > 17 && ridge - eave > .5, 'fabric covers both sides with standing clearance');
    }
  }
  for (const [x, z, depth] of [[-119, 213, 15], [-87, 214, 12]]) {
    for (const dx of [-.46, 0, .46]) {
      assert.equal(blocked([port.collider], point(egyptToWorld, x + dx, 15.65, z - depth / 2 - 1),
        point(egyptToWorld, x + dx, 15.65, z + depth / 2 + 1)), false, 'cargo stays beside the central aisle');
    }
  }
  assert.ok(blocked([market.collider], point(egyptToWorld, -180.69, 14.44, 142.69),
    point(egyptToWorld, -180.69, 14.44, 143.09)), 'scale table stands on a solid leg');
});

test('Qin command hall trusses reach the vault and the west gate opens between the fixed jambs', t => {
  const hall = createQinCommandLandscape();
  t.after(() => hall.dispose());
  hall.root.updateMatrixWorld(true);
  for (const z of [-216, -236]) {
    const hits = new THREE.Raycaster(point(qinToWorld, 6, 24, z), new THREE.Vector3(0, -1, 0))
      .intersectObject(hall.root);
    assert.ok(hits[0].point.y > 22.98, 'upper chord bears against the 23 m excavated ceiling');
  }
  const start = point(qinToWorld, -7, 11.3, -220), end = point(qinToWorld, -13, 11.3, -220);
  for (const open of [false, true, false]) {
    hall.apply(new Set(open ? [QIN_COMMAND_RETURN] : []));
    assert.equal(blocked(hall.colliders, start, end), !open);
  }
  assert.ok(blocked(hall.colliders, point(qinToWorld, 1, 12, -240), point(qinToWorld, 1, 12, -238.9)),
    'trestle legs bear the elevated deck');
  assert.equal(blocked(hall.colliders, point(qinToWorld, -91, 28.28, -155),
    point(qinToWorld, -94, 28.28, -155)), false, 'the sleeping shelf has clearance below the deck');
});

test('regional material families survive the quantization of the shipped visual GLBs', async () => {
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  for (const [name, material, families] of [
    ['egypt', 'M_EgyptCraft', egyptCraftSurfaces], ['qin', 'M_QinCraft', qinCraftSurfaces],
  ] as const) {
    const bytes = readFileSync(new URL('../public/assets/world_' + name + '.visual.glb', import.meta.url));
    const scene = await io.readBinary(bytes);
    const keys = new Set<number>();
    for (const mesh of scene.getRoot().listMeshes()) for (const surface of mesh.listPrimitives()) {
      if (surface.getMaterial()?.getName() !== material) continue;
      const colors = surface.getAttribute('COLOR_0')!;
      const rgb: number[] = [];
      for (let i = 0; i < colors.getCount(); i++) {
        colors.getElement(i, rgb);
        keys.add(Math.round(rgb[0] * 255) * 65536 + Math.round(rgb[1] * 255) * 256 + Math.round(rgb[2] * 255));
      }
    }
    const authored = new Set<number>();
    for (const [family, swatches] of Object.entries(families)) {
      assert.ok(swatches.some(swatch => keys.has(craftSwatchKey(swatch))), name + ' ships geometry for ' + family);
      for (const swatch of swatches) {
        const key = craftSwatchKey(swatch);
        assert.ok(!authored.has(key), name + ' ambiguous quantized colour ' + swatch);
        authored.add(key);
      }
    }
  }
});

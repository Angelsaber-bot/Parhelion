import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { toonMaterial } from '../src/rendering/look';
import { terrainGrainTexture, tileNoise } from '../src/rendering/surfaceGrain';
import { batchSettlementVisuals } from '../src/settlements/core';
import { applyCraftSurface } from '../src/settlements/craftSurface';

test('installed timber keeps metre scale and follows the long axis of a rotated beam', () => {
  const source = new THREE.PlaneGeometry(1, 1);
  const timber = applyCraftSurface(new THREE.MeshStandardMaterial(), 'wood');
  const beam = new THREE.Mesh(source, timber);
  beam.scale.set(8, .4, 1);
  beam.rotation.z = .7;
  const group = new THREE.Group().add(beam);
  batchSettlementVisuals(group);
  const result = group.children[0] as THREE.Mesh;
  const uv = result.geometry.getAttribute('uv');
  const mapped = Math.hypot(uv.getX(2) - uv.getX(0), uv.getY(2) - uv.getY(0));
  assert.ok(Math.abs(mapped * .85 - 8) < .00001);
  assert.ok(Math.abs(uv.getX(2) - uv.getX(0)) < .00001, 'the beam length follows the grain');
  assert.equal(source.getAttribute('uv').getX(1), 1, 'shared source geometry retains its mapping');
  const originalUV = Array.from(uv.array);
  batchSettlementVisuals(group);
  const rebuilt = group.children[0] as THREE.Mesh;
  const rebuiltUV = rebuilt.geometry.getAttribute('uv').array;
  originalUV.forEach((value, i) => assert.ok(Math.abs(value - rebuiltUV[i]) < .00001));
  source.dispose(); result.geometry.dispose(); rebuilt.geometry.dispose(); timber.dispose();
});

test('a merged stone face without an authored chart gets metre-sized planar coordinates', () => {
  const geometry = new THREE.PlaneGeometry(2.3, 1.15);
  geometry.deleteAttribute('uv');
  const stone = applyCraftSurface(new THREE.MeshStandardMaterial(), 'stone');
  const group = new THREE.Group().add(new THREE.Mesh(geometry, stone));
  batchSettlementVisuals(group);
  const batched = (group.children[0] as THREE.Mesh).geometry;
  const uv = batched.getAttribute('uv');
  assert.ok(Math.abs(uv.getX(2) - uv.getX(0) - 2) < .00001);
  assert.ok(Math.abs(uv.getY(0) - uv.getY(1) - 1) < .00001);
  geometry.dispose(); batched.dispose(); stone.dispose();
});

test('six finishes share filtered colour and relief maps through toon conversion', () => {
  const identities = new Set<THREE.Texture>();
  for (const kind of ['wood', 'stone', 'plaster', 'cloth', 'slate', 'paper'] as const) {
    const a = applyCraftSurface(new THREE.MeshStandardMaterial(), kind);
    const b = applyCraftSurface(new THREE.MeshStandardMaterial(), kind);
    const toon = toonMaterial(a) as THREE.MeshToonMaterial;
    assert.equal(a.map, b.map); assert.equal(a.normalMap, toon.normalMap);
    assert.equal(a.map!.colorSpace, THREE.SRGBColorSpace);
    assert.equal(a.normalMap!.colorSpace, THREE.NoColorSpace);
    for (const texture of [a.map!, a.normalMap!]) {
      identities.add(texture);
      assert.equal(texture.generateMipmaps, true);
      assert.equal(texture.wrapS, THREE.RepeatWrapping);
    }
    const bytes = (a.normalMap as THREE.DataTexture).image.data as Uint8Array;
    assert.ok(bytes.some((value, index) => index % 4 === 0 && Math.abs(value - 128) > 1));
    a.dispose(); b.dispose(); toon.dispose();
  }
  assert.equal(identities.size, 12);
  assert.equal(terrainGrainTexture(), terrainGrainTexture());
  assert.equal(terrainGrainTexture().minFilter, THREE.LinearMipmapLinearFilter);
  assert.ok(Math.abs(tileNoise(-.1, .35, 4, 5, 10) - tileNoise(.9, 1.35, 4, 5, 10)) < 1e-12);
});

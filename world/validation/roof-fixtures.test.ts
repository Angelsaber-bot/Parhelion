import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import footings from '../src/map/roof-mounts.json';
import { RegionVisualStreaming } from '../src/map/regionVisualStreaming';
import { measureRoofMounts } from '../tools/roof-mounts';

test('every mounted roof part has nine supported samples on the shipped visual roof or coping', async () => {
  for (const [region, saved] of Object.entries(footings)) {
    assert.deepEqual(await measureRoofMounts(region), saved, region);
    assert.ok(saved.length > 0 && new Set(saved.map(row => row.id)).size === saved.length);
  }
  assert.equal(footings.orleans.length, 45);
});

test('streamed fixtures sit on their host chunks and leave with them, with open French clay pots', async t => {
  t.mock.method(globalThis, 'fetch', async (input: string) => new Response(
    readFileSync(new URL('../public/' + input.replace(/^\.\//, ''), import.meta.url)),
  ));
  const parent = new THREE.Group();
  const counts: Record<string, [number, number]> = {};
  for (const [region, rows] of Object.entries(footings)) {
    const stream = new RegionVisualStreaming({ parent, outlines: false, lowQuality: true, eager: true });
    try {
      assert.equal(await stream.ensure(region), true, region);
      const batch: THREE.Mesh[] = [];
      parent.traverse(o => { if (o.name.startsWith('RoofFixtures_')) batch.push(o as THREE.Mesh); });
      assert.ok(batch.length && batch.length <= (region === 'orleans' ? 20 : rows.length), region);
      const bounds = batch.map(mesh => {
        assert.equal(mesh.name, 'RoofFixtures_' + mesh.parent!.name);
        return new MeshBVH(mesh.geometry);
      });
      const triangles = batch.reduce((n, mesh) => n + mesh.geometry.index!.count / 3, 0);
      counts[region] = [batch.length, triangles];
      assert.ok(triangles <= rows.length * 300);
      let released = 0, releasedMaterials = 0;
      const materials = new Set(batch.map(mesh => mesh.material as THREE.Material));
      materials.forEach(material => material.addEventListener('dispose', () => releasedMaterials++));
      batch.forEach(mesh => mesh.geometry.addEventListener('dispose', () => released++));
      for (const r of rows) {
        const cs = Math.cos(r.yaw), sn = Math.sin(r.yaw);
        const local = (x: number, y: number) => new THREE.Vector3(r.x + x * cs, y, r.z - x * sn);
        const height = region === 'orleans' ? r.low + .1 : r.high + .07;
        const cross = new THREE.Ray(local(1, height), new THREE.Vector3(-cs, 0, sn));
        assert.ok(bounds.some(bvh => bvh.raycastFirst(cross, THREE.FrontSide, 0, .7)), region + ' ' + r.id);
        if (region !== 'orleans') continue;
        const potX = r.id % 6 === 4 ? .265 : 0;
        const fromTop = (x: number) => new THREE.Ray(local(x, r.high + 1.1), new THREE.Vector3(0, -1, 0));
        assert.ok(bounds.some(b => b.raycastFirst(fromTop(potX + .18), THREE.FrontSide, 0, 1.09)), 'terracotta rim');
        assert.ok(bounds.every(b => !b.raycastFirst(fromTop(potX), THREE.FrontSide, 0, 1.09)), 'open pot bore');
      }
      stream.dispose();
      assert.equal(released, batch.length);
      assert.equal(releasedMaterials, materials.size);
      assert.equal(parent.children.length, 0);
    } finally { stream.dispose(); }
  }
  t.diagnostic(JSON.stringify(counts));
});

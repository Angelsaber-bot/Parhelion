/** Actual main quality/state wiring; renderer is explicitly no-GPU. */
import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { bootWorldWithoutGpu } from './world-dom-boot.fixture';

test('actual main keeps low fields unshadowed and normal structural casters bounded without recreating quest objects', async t => {
  for (const quality of ['low', 'med'] as const) await t.test(quality, async () => {
    const h = await bootWorldWithoutGpu({ deterministic: true, effectsQuality: quality });
    const w = h.world, sites = w.falseDawnSites; let now = 0;
    const frame = () => h.frame(now += 1000 / 60);
    const meshes: THREE.Mesh[] = []; sites.root.traverse((o: THREE.Object3D) => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh); });
    const geometry = meshes.map(m => m.geometry), materials = meshes.map(m => m.material), colliders = [...w.colliders], markers = [...sites.markers];
    const casters = () => meshes.filter(m => m.castShadow);
    const visit = (site: any, distance: number) => { w.player.teleport(site.origin[0] + distance, site.origin[1] + .04, site.origin[2]); frame(); };
    try {
      assert.equal(sites.structureShadowsSupported, quality !== 'low');
      assert.equal(sites.sites[0].root.children.filter((o: THREE.Object3D) => (o as THREE.Mesh).isMesh).length, quality === 'low' ? 7 : 8);
      for (const site of sites.sites) {
        visit(site, 90); assert.equal(casters().length, 0);
        visit(site, 69); assert.equal(casters().length, quality === 'low' ? 0 : 2);
        for (const mesh of casters()) assert.ok(['body', 'metal'].includes(mesh.userData.campaignLayer), 'thin ground and state/glow layers never cast');
        visit(site, 80); assert.equal(casters().length, quality === 'low' ? 0 : 2, 'exit hysteresis retains near structural casters');
        visit(site, 86); assert.equal(casters().length, 0);
      }
      visit(sites.sites[0], 0);
      const done = [...w.done], found = [...w.found];
      for (let i = 0; i < 40; i++) {
        assert.equal(sites.setStructureShadowsEnabled(false), true); assert.equal(casters().length, 0);
        assert.equal(sites.setStructureShadowsEnabled(true), quality !== 'low'); frame();
        sites.applyState({ stage: i % 2 ? 'array' : 'complete', anchors: [true, false, true], route: 'harbor', ending: i % 2 ? null : 'repurpose' });
        assert.ok(casters().length <= 2); assert.equal(quality !== 'low' || casters().length === 0, true);
      }
      assert.ok(meshes.every((m, i) => m.geometry === geometry[i] && m.material === materials[i]), 'geometry/material identity preserved');
      assert.equal(w.colliders.length, colliders.length); assert.ok(colliders.every((c, i) => c === w.colliders[i]), 'collider identity preserved');
      assert.equal(sites.markers.length, markers.length); assert.ok(markers.every((m, i) => m === sites.markers[i]), 'marker identity preserved');
      assert.deepEqual([...w.done], done); assert.deepEqual([...w.found], found);
      assert.deepEqual(h.errors, []); assert.deepEqual(h.warnings, []);
    } finally { await h.close(); }
  });
});

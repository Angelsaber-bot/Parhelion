import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { EGYPT_TOMB_FRONTS } from '../src/map/egyptPlan';
import { clearProductionLandscape } from '../src/map/regionAssets';
import { bakeQuantized, regionLoader } from '../src/rendering/glb';
import { createFieldChapterScene } from '../src/environment/fieldChapterScene';
import { KINGDOM_K04, K04, K01 } from '../src/story/kingdomBackPassage';
import { KINGDOM_GATE } from '../src/story/kingdomGate';

for (const region of ['britain', 'egypt'] as const) test(region + ' foundations meet the shipped terrain and collision', async () => {
  const bytes = await readFile(new URL('../public/assets/world_' + region + '.core.glb', import.meta.url));
  const { scene } = await regionLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length), '');
  bakeQuantized(scene);
  for (const name of ['Terrain', 'COL_Terrain']) {
    const mesh = scene.getObjectByName(name) as THREE.Mesh;
    const surface = clearProductionLandscape(region, name, mesh.geometry)!;
    const ground = new MeshBVH(surface);
    const ray = new THREE.Ray(new THREE.Vector3(), new THREE.Vector3(0, -1, 0));
    const sample = (x: number, z: number) => {
      ray.origin.set(x, 160, z);
      return ground.raycastFirst(ray, THREE.DoubleSide)!.point.y;
    };
    if (region === 'britain') {
      const shell = scene.getObjectByName('COL_Props') as THREE.Mesh;
      const placed = clearProductionLandscape(region, shell.name, shell.geometry)!;
      const walls = new MeshBVH(placed);
      for (const u of [-30, 0, 30]) for (const v of [-16, 0, 16]) {
        const x = -215 + u * Math.cos(.6) + v * Math.sin(.6), z = -305 - u * Math.sin(.6) + v * Math.cos(.6);
        const y = sample(x, z);
        ray.origin.set(x, 27, z); ray.direction.y = 1;
        const roof = walls.raycastFirst(ray, THREE.DoubleSide);
        ray.origin.y = 12;
        const bottom = walls.raycastFirst(ray, THREE.DoubleSide);
        assert.ok(bottom && bottom.point.y <= y && y - bottom.point.y < .6, 'stone base touches ground');
        assert.ok(roof && roof.point.y - y > 10, 'full plinth face clears the hillside');
        ray.direction.y = -1;
      }
      placed.dispose();
    } else {
      assert.equal(EGYPT_TOMB_FRONTS.length, 7);
      for (const {x, y, z, yaw} of EGYPT_TOMB_FRONTS) for (const u of [-2, 0, 2]) for (const v of [.5, 1.5, 2.5]) {
        const surfaceY = sample(x + u * Math.cos(yaw) + v * Math.sin(yaw), z - u * Math.sin(yaw) + v * Math.cos(yaw));
        assert.ok(Math.abs(surfaceY - y) < .18, 'rock-cut doorway and approach meet the sill');
      }
    }
    surface.dispose();
  }
});

test('market shutters remain in ground-supported guides in all work poses and the old outer grille clears on rescue', () => {
  const scene = createFieldChapterScene([KINGDOM_K04], () => [0, 34.9, 0], () => 34, () => true);
  try {
    const key = K04.winch;
    const panel = scene.root.children.find(o => o.name === 'FieldProp_' + key && o.children.some(c => c.name === 'FieldPropIron') && (new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3()).x > 3))!;
    const guides = scene.root.children.filter(o => o.name === 'FieldPropPost_' + key);
    assert.equal(guides.length, 2);
    for (const k of [0, .5, 1]) {
      scene.apply(new Set(k === 1 ? [key] : [])); scene.update(0, new THREE.Vector3(0, 34, 0), () => k);
      const leaf = new THREE.Box3().setFromObject(panel);
      const ropes = scene.root.children.filter(o => o.name === 'FieldLiftRope_' + key);
      assert.equal(ropes.length, 2);
      for (const rope of ropes) {
        const span = new THREE.Box3().setFromObject(rope);
        assert.ok(Math.abs(span.min.y - leaf.max.y) < .005, 'hoist stays attached during travel');
      }
      for (const guide of guides) {
        const box = new THREE.Box3().setFromObject(guide);
        assert.ok(box.min.y <= 34 && box.max.y >= leaf.max.y);
        assert.ok(box.expandByScalar(.005).intersectsBox(leaf), 'guide touches edge of shutter');
      }
    }
    scene.apply(new Set([KINGDOM_GATE.rescued]));
    assert.equal(scene.root.getObjectByName('FieldProp_' + K01.portcullis)!.visible, false);
  } finally { scene.dispose(); }
});

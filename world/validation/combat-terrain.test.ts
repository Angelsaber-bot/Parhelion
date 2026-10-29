import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MeshBVH } from 'three-mesh-bvh';
import { regionLoader, bakeQuantized } from '../src/glb.ts';
import { REGIONS, mergeLayouts, boundaryWalls } from '../src/regions.ts';
import { makeMinibossSpawns, MINIBOSSES } from '../src/minibosses.ts';
import { makeCombatTerrain } from '../src/combatTerrain.ts';
import { makeWildernessSpawns, WorldCombatState, BOSS_REQUIREMENTS } from '../src/combat.ts';
import type { Collider } from '../src/player.ts';
import type { Layout } from '../src/types.ts';

const geos: THREE.BufferGeometry[] = [boundaryWalls()];
const colliders: Collider[] = [];
const parts = await Promise.all(REGIONS.map(async def => {
  const bytes = readFileSync(new URL(`../public/assets/${def.file}.glb`, import.meta.url));
  const gltf = await regionLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  bakeQuantized(gltf.scene); gltf.scene.position.set(def.offset[0], 0, def.offset[1]); gltf.scene.updateMatrixWorld(true);
  gltf.scene.getObjectByName('COLLISION')!.traverse(o => {
    const m = o as THREE.Mesh; if (!m.isMesh) return;
    let g = new THREE.BufferGeometry().setAttribute('position', m.geometry.attributes.position.clone());
    if (m.geometry.index) g.setIndex(m.geometry.index.clone());
    g.applyMatrix4(m.matrixWorld); if (g.index) g = g.toNonIndexed();
    if (m.userData.dynamic) colliders.push({ name: m.name, bvh: new MeshBVH(g), enabled: true }); else geos.push(g);
  });
  return { def, layout: JSON.parse(readFileSync(new URL(`../public/assets/${def.file}.layout.json`, import.meta.url), 'utf8')) as Layout };
}));
colliders.unshift({ name: 'static', enabled: true, bvh: new MeshBVH(mergeGeometries(geos)) });
const layout = mergeLayouts(parts), query = makeCombatTerrain(colliders, layout);
const spawns = makeWildernessSpawns(layout.world.seed ^ 537, query.safeSpawn);

test('actual five-region map admits bounded dry, clear wilderness encounters away from quest hubs', () => {
  assert.equal(spawns.length, 113, `expected 113 accepted seeded wilderness locations: ${JSON.stringify(spawns)}`);
  assert.equal(spawns.filter(s => s.p.x < -360).length, 21);
  assert.equal(spawns.filter(s => s.p.x > 360).length, 23);
  assert.equal(spawns.filter(s => s.p.z < -360).length, 23);
  assert.equal(spawns.filter(s => s.p.z > 360).length, 23);
  assert.equal(spawns.filter(s => s.p.x >= -360 && s.p.x <= 360 && s.p.z >= -360 && s.p.z <= 360).length, 23);
  for (const s of spawns) {
    assert.ok(query.clear(s.p), `${s.id} has capsule clearance`);
    assert.ok(s.p.y > layout.world.waterLevel + 0.45, `${s.id} is on dry ground`);
    assert.ok(query.safeSpawn(s.p.x, s.p.z), `${s.id} passes the same safe-region filters`);
  }
});

test('actual closed west-seam gate blocks combat rays and disabled gate does not', () => {
  const gate = colliders.find(c => c.name === 'COL_Seam_west_Gate')!;
  assert.ok(gate);
  const box = gate.bvh.getBoundingBox(new THREE.Box3());
  const center = box.getCenter(new THREE.Vector3());
  const start = { x: box.max.x + 0.3, y: center.y, z: center.z }, end = { x: box.min.x - 0.3, y: center.y, z: center.z };
  assert.equal(query.terrain.lineOfSight(start, end), false);
  gate.enabled = false;
  assert.equal(query.terrain.lineOfSight(start, end), true);
  gate.enabled = true;
});

test('target colliders can be excluded from the muzzle wall query without opening terrain', () => {
  const target = colliders.find(c => c.name === 'COL_TGT_camp_dummy_1')!;
  assert.ok(target);
  const box = target.bvh.getBoundingBox(new THREE.Box3());
  const center = box.getCenter(new THREE.Vector3());
  const from = { x: center.x, y: center.y, z: center.z + 4 };
  const direction = { x: 0, y: 0, z: -1 };
  assert.ok(query.cast(from, direction, 4), 'the target collider is present in the normal query');
  assert.equal(query.cast(from, direction, 4, c => c.name.startsWith('COL_TGT_')), null,
    'the shooting wall query ignores the target itself');
});

test('actual boss arena home is above valid dry ground and open toward the Sun Core approach', () => {
  const m = layout.markers.find(m => m.id === 'boss_vacant_king')!;
  const p = { x: m.p[0], y: m.p[1] + 0.05, z: m.p[2] };
  const g = query.ground(p.x, p.z); assert.ok(g); assert.ok(Math.abs(g!.point.y - p.y) < 0.2);
  assert.ok(query.clear(p, 1.5, 4));
  const s = new WorldCombatState(spawns, { id: m.id, kind: 'king', p });
  assert.equal(s.beginBoss(new Set(BOSS_REQUIREMENTS)), true);
  const player = { x: p.x + 9, y: query.ground(p.x + 9, p.z)!.point.y, z: p.z };
  for (let i = 0; i < 60; i++) s.step(0.05, player, true, query.terrain);
  assert.equal(s.bossStarted, true); assert.ok(s.boss.active);
  assert.ok(s.boss.attackCount > 0, 'boss actually acquires a player and starts a telegraphed attack');
});

test('boss begins threatening from the actual Sun Core interaction approach without phasing through the mound', () => {
  const m = layout.markers.find(m => m.id === 'boss_vacant_king')!;
  const core = layout.markers.find(m => m.id === 'sun_core')!;
  const p = { x: m.p[0], y: m.p[1] + 0.05, z: m.p[2] };
  const s = new WorldCombatState([], { id: m.id, kind: 'king', p });
  const player = { x: core.p[0] + 2.7, y: query.ground(core.p[0] + 2.7, core.p[2])!.point.y, z: core.p[2] };
  assert.ok(Math.hypot(player.x-core.p[0], player.y-core.p[1], player.z-core.p[2]) < (core.radius ?? 0));
  s.beginBoss(new Set(BOSS_REQUIREMENTS));
  for (let i = 0; i < 400 && s.boss.attackCount === 0; i++) s.step(0.05, player, true, query.terrain);
  assert.ok(s.boss.attackCount > 0, `boss must acquire the actual interact position; stopped at ${JSON.stringify(s.boss.p)}`);
});

test('actual map admits exactly one sparse elite per region using unchanged settlement and quest exclusions', () => {
  const elites = makeMinibossSpawns(query.safeSpawn, spawns);
  assert.equal(elites.length, MINIBOSSES.length, `missing elite: ${JSON.stringify(elites)}`);
  for (const e of elites) {
    assert.ok(query.safeSpawn(e.p.x, e.p.z));
    assert.ok(spawns.every(s => Math.hypot(s.p.x - e.p.x, s.p.z - e.p.z) >= 16));
    assert.ok(query.clear(e.p));
  }
});

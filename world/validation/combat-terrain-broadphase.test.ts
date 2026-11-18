import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { makeCombatTerrain } from '../src/combat/combatTerrain.ts';
import type { Collider } from '../src/player/player.ts';
import type { Layout } from '../src/core/types.ts';

/** Reference: every enabled collider's BVH, nearest hit within max (the pre-broad-phase behaviour). */
function brute(colliders: readonly Collider[], o: THREE.Vector3, d: THREE.Vector3, max: number, ignore?: (c: Collider) => boolean) {
  const ray = new THREE.Ray(o.clone(), d.clone().normalize());
  let best: { distance: number; point: THREE.Vector3 } | null = null;
  for (const c of colliders) if (c.enabled && !ignore?.(c)) {
    const hit = c.bvh.raycastFirst(ray, THREE.DoubleSide, 0, max);
    if (hit && hit.distance < max && (!best || hit.distance < best.distance)) best = hit;
  }
  return best;
}
let seed = 7;
const rand = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32);
function scatter(): Collider[] {
  const out: Collider[] = [];
  const terrain = new THREE.PlaneGeometry(400, 400, 40, 40).rotateX(-Math.PI / 2);
  const pos = terrain.getAttribute('position');
  for (let i = 0; i < pos.count; i++) pos.setY(i, Math.sin(pos.getX(i) * .05) * 3 + Math.cos(pos.getZ(i) * .04) * 2);
  out.push({ name: 'COL_Terrain', bvh: new MeshBVH(terrain), enabled: true });
  for (let i = 0; i < 120; i++) {
    const g = (i % 3 === 0 ? new THREE.BoxGeometry(2 + rand() * 8, 1 + rand() * 9, 2 + rand() * 8) : i % 3 === 1 ? new THREE.CylinderGeometry(1, 2, 6, 8) : new THREE.TorusGeometry(3, .6, 6, 12))
      .rotateY(rand() * Math.PI).rotateX(i % 5 === 0 ? .4 : 0).translate((rand() - .5) * 360, rand() * 6, (rand() - .5) * 360);
    out.push({ name: i % 7 === 0 ? `COL_SunwardExploration_${i}` : `COL_${i}`, bvh: new MeshBVH(g), enabled: i % 11 !== 0 });
  }
  return out;
}
function randomRay(): [THREE.Vector3, THREE.Vector3, number] {
  const o = new THREE.Vector3((rand() - .5) * 380, rand() * 30 - 2, (rand() - .5) * 380);
  const kind = rand();
  const d = kind < .25 ? new THREE.Vector3(0, -1, 0) : new THREE.Vector3(rand() - .5, (rand() - .5) * .6, rand() - .5);
  const max = kind < .1 ? Infinity : kind < .5 ? rand() * 12 : rand() * 260;
  return [o, d, max];
}
const layout = { areas: [], markers: [] } as unknown as Layout;

test('collider broad phase returns exactly the brute-force nearest hit for random rays', () => {
  const colliders = scatter(), terrain = makeCombatTerrain(colliders, layout);
  const ignore = (c: Collider) => c.name.startsWith('COL_SunwardExploration');
  let hits = 0;
  for (let i = 0; i < 4000; i++) {
    const [o, d, max] = randomRay(), skip = i % 4 === 0 ? ignore : undefined;
    const got = terrain.cast(o, d, max, skip), want = brute(colliders, o, d, max, skip);
    assert.equal(!!got, !!want, `ray ${i}`);
    if (got && want) { assert.equal(got.distance, want.distance, `ray ${i} distance`); assert.ok(got.point.equals(want.point), `ray ${i} point`); hits++; }
  }
  assert.ok(hits > 800, `only ${hits} hits: the scene must exercise the broad phase`);
});

test('broad phase follows colliders that move and refit, toggle, or start the ray inside their bounds', () => {
  const colliders = scatter(), terrain = makeCombatTerrain(colliders, layout);
  const lift = new THREE.BoxGeometry(4, .4, 4).translate(50, 2, 50), bvh = new MeshBVH(lift);
  const collider: Collider = { name: 'COL_Lift', bvh, enabled: true }; colliders.push(collider);
  const down = new THREE.Vector3(0, -1, 0);
  assert.ok(Math.abs(terrain.cast(new THREE.Vector3(50, 10, 50), down, 20)!.distance - 7.8) < 1e-5);
  // Raise the lift 6 m and refit in place, as the lifts, waterwheel and customs works do.
  const position = lift.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < position.count; i++) position.setY(i, position.getY(i) + 6);
  position.needsUpdate = true; bvh.refit();
  assert.ok(Math.abs(terrain.cast(new THREE.Vector3(50, 10, 50), down, 20)!.distance - 1.8) < 1e-5);
  collider.enabled = false;
  const below = terrain.cast(new THREE.Vector3(50, 10, 50), down, 40), want = brute(colliders, new THREE.Vector3(50, 10, 50), down, 40);
  assert.equal(below?.distance, want?.distance);
  collider.enabled = true;
  // Origin inside the lift's bounds, pointing out sideways and up through its top face.
  for (const dir of [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(.3, .2, -1)]) {
    const o = new THREE.Vector3(50.5, 8, 49.5), got = terrain.cast(o, dir, 10), ref = brute(colliders, o, dir, 10);
    assert.equal(got?.distance, ref?.distance);
  }
  // Degenerate input is still rejected.
  assert.equal(terrain.cast(new THREE.Vector3(0, 5, 0), new THREE.Vector3(0, 0, 0), 10), null);
  assert.equal(terrain.cast(new THREE.Vector3(0, 5, 0), down, 0), null);
});

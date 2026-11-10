import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MeshBVH } from 'three-mesh-bvh';
import { regionLoader, bakeQuantized } from '../src/rendering/glb';
import { Player, type Collider } from '../src/player/player';
import { WorldGrid } from '../src/map/grid';
import { EGYPT_OFFSET, EGYPT_MIRRORS, EGYPT_ROOMS, EGYPT_CORRIDORS, EGYPT_LAKE, EGYPT_RIVER } from '../src/map/egyptPlan';
import { createEgyptSunMirrors, traceSunlight, turnEgyptMirror, egyptMirrorSetting, reflect } from '../src/environment/egyptSunMirrors';
import { egyptResidentSockets, createEgyptResidentLife } from '../src/map/egyptResidents';
import { createSettlementNpcs } from '../src/settlements/npcs';

const [OX, OZ] = EGYPT_OFFSET;
const bytes = readFileSync(new URL('../public/assets/world_egypt.core.glb', import.meta.url));
const { scene } = await regionLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
bakeQuantized(scene); scene.position.set(OX, 0, OZ); scene.rotation.y = Math.PI; scene.updateMatrixWorld(true); // the region stands turned half a circle
const geos: THREE.BufferGeometry[] = [];
scene.getObjectByName('COLLISION')!.traverse(o => { const m = o as THREE.Mesh; if (!m.isMesh) return; let g = new THREE.BufferGeometry().setAttribute('position', m.geometry.attributes.position.clone()); if (m.geometry.index) g.setIndex(m.geometry.index.clone()); g.applyMatrix4(m.matrixWorld); if (g.index) g = g.toNonIndexed(); geos.push(g); });
const bvh = new MeshBVH(mergeGeometries(geos)), staticCollider: Collider = { name: 'egypt', bvh, enabled: true };
const grid = new WorldGrid([scene.getObjectByName('Terrain') as THREE.Mesh], OX - 360, OZ - 360, 720, 2);
const layout = JSON.parse(readFileSync(new URL('../public/assets/world_egypt.layout.json', import.meta.url), 'utf8'));
function walk(colliders: Collider[], start: readonly [number, number, number], path: readonly (readonly [number, number])[], tol = .6) {
  const p = new Player(colliders, 0); p.teleport(OX - start[0], start[1] + .5, OZ - start[2]); for (let i = 0; i < 90; i++) p.step(1 / 120, { x: 0, z: 0, jump: false, sprint: false });
  for (const [lx, lz] of path) { const x = OX - lx, z = OZ - lz; for (let i = 0; i < 6000 && Math.hypot(p.pos.x - x, p.pos.z - z) > tol; i++) { p.yaw = Math.atan2(-(x - p.pos.x), -(z - p.pos.z)); p.step(1 / 120, { x: 0, z: 1, jump: false, sprint: false }); } if (Math.hypot(p.pos.x - x, p.pos.z - z) > tol) return { ok: false, at: [OX - p.pos.x, p.pos.y, OZ - p.pos.z] }; assert.equal(p.swimming, false); }
  return { ok: true, at: [OX - p.pos.x, p.pos.y, OZ - p.pos.z] };
}

test('landscape: a mesa with cliffs, a cut canyon, a spring lake and a river falling to the sea', () => {
  const plateau = grid.sampleHeight(OX - 0, OZ - -200)!, desert = grid.sampleHeight(OX - -200, OZ - 40)!;
  assert.ok(plateau - desert > 12, `plateau ${plateau} stands over the desert ${desert}`);
  let steep = 0; for (let z = -90; z < -40; z += 2) steep = Math.max(steep, Math.abs(grid.sampleHeight(OX - -150, OZ - z)! - grid.sampleHeight(OX - -150, OZ - z - 2)!));
  assert.ok(steep > 2, 'the escarpment is a cliff, not a long ramp');
  assert.ok(grid.sampleHeight(OX - -92, OZ - -104)! < grid.sampleHeight(OX - -74.6, OZ - -93.8)! - 8, 'the canyon is cut deep into the plateau');
  const lakeFloor = grid.sampleHeight(OX - EGYPT_LAKE.x, OZ - EGYPT_LAKE.z)!; assert.ok(lakeFloor < EGYPT_LAKE.surface && lakeFloor > .5, 'the spring lake has a dry-land basin above sea level');
  for (const [x, y, z] of EGYPT_RIVER.slice(1, -2)) assert.ok(grid.sampleHeight(OX - x, OZ - z)! < y, `river bed at ${x},${z}`);
  for (const r of EGYPT_ROOMS) for (let x = r.x0; x <= r.x1; x += 4) for (let z = r.z0; z <= r.z1; z += 4) assert.ok(grid.sampleHeight(OX - x, OZ - z)! > r.floor + r.height + 1.2, `tomb buried at ${x},${z}`);
  for (const c of EGYPT_CORRIDORS) for (let t = .3; t <= 1; t += .1) { const z = c.a[2] + (c.b[2] - c.a[2]) * t, y = c.a[1] + (c.b[1] - c.a[1]) * t; assert.ok(grid.sampleHeight(OX - c.a[0], OZ - z)! > y + c.height + 1.2, `incline buried at ${z}`); }
});

test('sun mirrors: light travels straight, reflects only from the bright face, and the right turns light the disc', () => {
  assert.deepEqual(reflect([-1, 0], 3), [0, -1]); assert.equal(reflect([1, 0], 3), null, 'the back of a mirror stops the light');
  const done = new Set<string>();
  assert.equal(traceSunlight(done).lit, false, 'the default arrangement leaves the sanctuary dark');
  const solution = [3, 0, 2];
  for (const [i, m] of EGYPT_MIRRORS.mirrors.entries()) while (egyptMirrorSetting(done, m.id) !== solution[i]) turnEgyptMirror(done, m.id);
  const lit = traceSunlight(done); assert.equal(lit.lit, true); assert.equal(lit.points.length, 5, 'emitter, three mirrors and the disc');
  turnEgyptMirror(done, EGYPT_MIRRORS.mirrors[1].id); assert.equal(traceSunlight(done).lit, false, 'one wrong mirror breaks the path');
  // every one of the 64 arrangements is evaluated; exactly one lights the disc
  let solutions = 0; const probe = new Set<string>();
  for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) for (let c = 0; c < 4; c++) { probe.clear(); [a, b, c].forEach((k, i) => probe.add(`${EGYPT_MIRRORS.mirrors[i].id}_${k}`)); if (traceSunlight(probe).lit) solutions++; }
  assert.equal(solutions, 1);
});

test('the sun door seals the tomb incline until the disc is lit, then the tomb is walkable', () => {
  const mirrors = createEgyptSunMirrors(), done = new Set<string>(), colliders = [staticCollider, ...mirrors.colliders];
  mirrors.apply(done);
  assert.equal(walk(colliders, [80, 30, -182], [[80, -196]]).ok, false, 'the stone door blocks the way');
  const solution = [3, 0, 2]; for (const [i, m] of EGYPT_MIRRORS.mirrors.entries()) while (egyptMirrorSetting(done, m.id) !== solution[i]) turnEgyptMirror(done, m.id);
  mirrors.apply(done); assert.equal(mirrors.update(1 / 60, done), true, 'lighting the disc is reported once');
  done.add(EGYPT_MIRRORS.solved); mirrors.apply(done); for (let i = 0; i < 400; i++) mirrors.update(1 / 60, done);
  assert.equal(mirrors.open, true);
  const r = walk(colliders, [80, 30, -182], [[80, -196], [80, -236], [80, -244], [72, -252]]);
  assert.ok(r.ok && Math.abs(r.at[1] - 14) < .6, `down to the solar barque: ${r.at}`);
  // the mirrors themselves can be reached from the court floor
  for (const m of EGYPT_MIRRORS.mirrors) assert.ok(walk(colliders, [80, 30, -100], [[m.p[0] + (m.p[0] < 70 ? 2.2 : -2.2), m.p[1] + 2.2]], 1).ok, `${m.id} reachable`);
  mirrors.dispose();
});

test('oasis town: mudbrick houses are enterable from the street, residents are grounded and the camel driver walks', () => {
  const houses = layout.development.houses as { position: [number, number, number]; width: number; depth: number; rotation: number; approach: [number, number, number] }[];
  assert.ok(houses.length >= 12, `${houses.length} houses`);
  for (const [i, h] of houses.entries()) {
    const [x, , z] = h.position, inside = h.depth / 2 - 1.2, dx = Math.sin(h.rotation), dz = Math.cos(h.rotation);
    const p = walk([staticCollider], [h.approach[0], h.approach[1], h.approach[2]], [[x + dx * inside, z + dz * inside], [x, z], [h.approach[0], h.approach[2]]], .35);
    assert.ok(p.ok, `house ${i} at ${h.position}: blocked at ${p.at}`);
  }
  const sockets = egyptResidentSockets(), system = createSettlementNpcs(sockets);
  const ground = (x: number, z: number, ceiling: number) => bvh.raycastFirst(new THREE.Ray(new THREE.Vector3(x, ceiling, z), new THREE.Vector3(0, -1, 0)), THREE.DoubleSide)?.point.y ?? null;
  const life = createEgyptResidentLife(system, ground);
  assert.ok(sockets.length >= 8 && sockets.every(s => s.worldRegion === 'egypt'));
  for (const s of sockets) { const p = system.getPosition(s.id)!, floor = ground(p[0], p[2], p[1] + 1); assert.ok(floor !== null && Math.abs(floor - p[1]) < .18, `${s.id} grounded at ${p}`); }
  const start = system.getPosition('egypt_courier')!, viewer = new THREE.Vector3(start[0] + 8, start[1], start[2] + 5);
  for (let i = 0; i < 900; i++) { system.update(1 / 60, viewer); life.update(1 / 60, viewer, null, true); }
  const end = system.getPosition('egypt_courier')!; assert.ok(Math.hypot(end[0] - start[0], end[2] - start[2]) > 5);
  life.dispose(); system.dispose();
});

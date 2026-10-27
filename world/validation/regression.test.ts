import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { Player } from '../src/player.ts';
const idle = { x: 0, z: 0, jump: false, sprint: false };
test('teleport clears stale floor and water contacts, preventing an air jump', () => {
  const p = new Player([], 1);
  p.onGround = true; p.swimming = true;
  p.teleport(0, 100, 0);
  assert.equal(p.onGround, false);
  assert.equal(p.swimming, false);
  p.step(1 / 120, { ...idle, jump: true });
  assert.ok(p.pos.y < 100, 'teleporting off the floor must not retain a jump');
});
test('floor collision remains stable and supports a normal jump', () => {
  const g = new THREE.PlaneGeometry(100, 100).rotateX(-Math.PI / 2);
  const p = new Player([{ name: 'floor', bvh: new MeshBVH(g), enabled: true }], -100);
  p.teleport(0, 2, 0);
  for (let i = 0; i < 240; i++) p.step(1 / 120, idle);
  assert.ok(Math.abs(p.pos.y) < 1e-6);
  assert.equal(p.onGround, true);
  p.step(1 / 120, { ...idle, jump: true });
  assert.ok(p.pos.y > 0 && p.vel.y > 0);
});

test('minimap applies its own north/south origin to arrows, labels and markers', async () => {
  const { WorldMap } = await import('../src/map.ts');
  const map = Object.create(WorldMap.prototype) as InstanceType<typeof WorldMap>;
  Object.assign(map, { half: 240, size: 241, base: {}, layout: { areas: [{ name: 'camp', c: [5, 165] }], markers: [{ type: 'spawn', p: [5, 0, 165] }] } });
  const translated: number[][] = [], labels: number[][] = [], markers: number[][] = [];
  const ctx = { canvas: { width: 380 }, save() {}, restore() {}, clearRect() {}, drawImage() {}, strokeText(_s: string, x: number, y: number) { labels.push([x,y]); }, fillText() {}, beginPath() {}, arc(x: number, y: number) { markers.push([x,y]); }, fill() {}, stroke() {}, translate(x: number,y: number) { translated.push([x,y]); }, rotate() {}, moveTo() {}, lineTo() {}, closePath() {} };
  map.draw(ctx as unknown as CanvasRenderingContext2D, new THREE.Vector3(3, 21, 159), 0, { full: false, done: new Set(), found: new Set() });
  assert.ok(Math.abs(translated[0][0] - 190) < 1e-6);
  assert.ok(Math.abs(translated[0][1] - 190) < 1e-6, `arrow y=${translated[0][1]}, expected 190`);
  assert.ok(Math.abs(labels[0][1] - (190 + 6 * 380 / 140)) < 1e-6);
  assert.deepEqual(markers[0], labels[0]);
});

test('leaving flight cannot reuse a stale grounded jump', () => {
  const p = new Player([], -100);
  p.onGround = true;
  p.flying = true;
  p.pos.y = 100;
  p.flying = false;
  p.step(1 / 120, { ...idle, jump: true });
  assert.ok(p.pos.y < 100, 'flight exit must clear the old floor contact');
});

test('full map keeps both axes aligned to the map rather than the player', async () => {
  const { WorldMap } = await import('../src/map.ts');
  const map = Object.create(WorldMap.prototype) as InstanceType<typeof WorldMap>;
  Object.assign(map, { half: 240, size: 241, base: {}, layout: { areas: [], markers: [] } });
  let xy: number[] = [];
  const ctx = { canvas: { width: 1200 }, save() {}, restore() {}, clearRect() {}, drawImage() {}, beginPath() {}, fill() {}, stroke() {}, translate(x: number,y: number) { xy=[x,y]; }, rotate() {}, moveTo() {}, lineTo() {}, closePath() {} };
  map.draw(ctx as unknown as CanvasRenderingContext2D, new THREE.Vector3(3, 21, 159), 0, { full: true, done: new Set(), found: new Set() });
  assert.ok(Math.abs(xy[0] - 607.5) < 1e-6);
  assert.ok(Math.abs(xy[1] - 997.5) < 1e-6);
});
test('normal diagonal walking is not faster than straight walking', () => {
  const a = new Player([], -100), b = new Player([], -100);
  a.teleport(0, 10, 0); b.teleport(0, 10, 0);
  a.step(1/120, { ...idle, z: 1 }); b.step(1/120, { ...idle, z: 1, x: 1 });
  assert.ok(Math.abs(Math.hypot(a.pos.x, a.pos.z) - Math.hypot(b.pos.x,b.pos.z)) < 1e-8);
});

test('debug free-flight follows full camera pitch and does not use obsolete vertical input', () => {
  for (const pitch of [-1.3, 0, 1.3]) {
    const p = new Player([], -100); p.teleport(0, 25, 0); p.flying = true; p.pitch = pitch;
    for (let i = 0; i < 120; i++) p.step(1/120, { ...idle, z: 1, jump: true, up: -1 } as typeof idle);
    assert.ok(Math.abs(p.pos.y - (25 + 40 * Math.sin(pitch))) < 1e-8);
    assert.ok(Math.abs(p.pos.z + 40 * Math.cos(pitch)) < 1e-8);
  }
});
test('debug flight normalizes diagonals and camera-pitched backward reverses altitude', () => {
  const a = new Player([], -100), b = new Player([], -100);
  for (const p of [a,b]) { p.teleport(0, 25, 0); p.flying = true; p.pitch = .7; p.yaw = .9; }
  a.step(1, { ...idle, z: 1 }); b.step(1, { ...idle, z: 1, x: 1 });
  assert.ok(Math.abs(a.pos.distanceTo(new THREE.Vector3(0,25,0)) - 40) < 1e-8);
  assert.ok(Math.abs(b.pos.distanceTo(new THREE.Vector3(0,25,0)) - 40) < 1e-8);
  a.step(1, { ...idle, z: -1 }); assert.ok(a.pos.distanceTo(new THREE.Vector3(0,25,0)) < 1e-8);
});
test('removing manual flight controls preserves jump, glide toggles, water jump and updraft lift', () => {
  const p = new Player([], -100); p.teleport(0, 10, 0);
  p.step(1/120, { ...idle, jump: true }); assert.equal(p.gliding, true);
  p.step(1/120, idle); p.step(1/120, { ...idle, jump: true }); assert.equal(p.gliding, false);
  p.updrafts = [{ x: 0, z: 0, r: 10, y0: 0, y1: 60 }];
  const initial = p.pos.y;
  for (let i = 0; i < 120; i++) p.step(1/120, idle);
  assert.equal(p.gliding, true); assert.ok(p.pos.y > initial + 1);
  const swimmer = new Player([], 10); swimmer.teleport(0, 8.7, 0); swimmer.step(1/120, { ...idle, jump: true });
  assert.equal(swimmer.swimming, true); assert.ok(swimmer.vel.y > 0);
});

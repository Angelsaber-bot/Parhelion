import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { createValleyPrologueScene } from '../src/environment/valleyPrologueScene';
import { VALLEY_PROLOGUE as P } from '../src/story/valleyPrologue';
import { AREA_BANNER, shouldAnnounceArea } from '../src/ui/areaBanner';

const scene = () => createValleyPrologueScene({ id: 'alpha', name: ['生活馆', 'Residence'], position: [-166, 10, 214], entry: [-166, 10, 220], footprint: [20, 20], groundRange: 1 }, () => 10);

test('everyday errands answer from a comfortable step away; the rescue controls keep their tight reach', () => {
  const s = scene(), radius = (id: string) => s.markers.find(m => m.id === id)!.radius!;
  for (const id of [P.room, P.workshop, P.cartStop, P.cartReturn, P.radio]) {
    const m = s.markers.find(m => m.id === id)!, lift = m.p[1] - 10;
    // Reach is measured from the feet: what is left on the ground once the panel's height is taken out.
    const onGround = Math.sqrt(Math.max(0, radius(id) ** 2 - Math.min(lift, 1.6) ** 2));
    assert.ok(radius(id) >= 2.2 && radius(id) <= 2.5, `${id} radius ${radius(id)}`);
    assert.ok(onGround > 1.5, `${id} answers from ${onGround.toFixed(2)} m away`);
  }
  for (const id of [P.survey, P.breaker, P.ratchet]) assert.equal(radius(id), 1.85, `${id} stays deliberate`);
  s.dispose();
});

test('the bay is dressed outside without adding anything to walk into or mistake for the shear pin', () => {
  const s = scene(), fixtures = s.colliders.find(c => c.name === 'VALLEY_PrologueFixtures')!;
  const bay = { x: -47, z: 244 };
  // The back wall is 0.22 thick at z = -3.9: a probe from behind meets the wall itself, at plinth height and on a
  // rib alike, so the dressing in front of it is not solid.
  for (const [x, y] of [[.6, .14], [-1.8, 1.38], [1.2, .86]] as const) {
    const hit = fixtures.bvh.raycastFirst(new THREE.Ray(new THREE.Vector3(bay.x + x, 10 + y, bay.z - 8), new THREE.Vector3(0, 0, 1)), THREE.DoubleSide);
    assert.ok(hit && Math.abs(hit.distance - (8 - 4.01)) < .005, `probe at ${x},${y} meets the wall (${hit?.distance.toFixed(3)})`);
  }
  const side = fixtures.bvh.raycastFirst(new THREE.Ray(new THREE.Vector3(bay.x - 8, 11.38, bay.z - 2.6), new THREE.Vector3(1, 0, 0)), THREE.DoubleSide);
  assert.ok(side && Math.abs(side.distance - (8 - 3.11)) < .005, `west rib is not solid (${side?.distance.toFixed(3)})`);
  let body: THREE.Mesh | undefined; s.root.traverse(o => { if (o instanceof THREE.Mesh && !body && (o.geometry.getAttribute('position')?.count ?? 0) > 1500) body = o; });
  assert.ok(body, 'merged art layer');
  // Count amber-coloured vertices on the outer faces of the east wall: only the pin housing's two bars.
  const pos = body!.geometry.getAttribute('position'), col = body!.geometry.getAttribute('color'), amber = new THREE.Color('#eca64d');
  let behind = 0, amberOutside = 0, pinBars = 0;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) - bay.x, z = pos.getZ(i) - bay.z;
    if (z < -4 && z > -4.3 && Math.abs(x) < 3.4) behind++;
    const isAmber = Math.abs(col.getX(i) - amber.r) < .02 && Math.abs(col.getY(i) - amber.g) < .02 && Math.abs(col.getZ(i) - amber.b) < .02;
    const atPin = x > 3.11 && z > -2.1 && z < -1.2;
    if (isAmber && atPin) pinBars++;
    else if (isAmber && ((z < -4 && z > -4.3 && Math.abs(x) < 3.4) || (Math.abs(x) > 3.11 && Math.abs(x) < 3.3 && z < 2 && z > -4.3))) amberOutside++;
  }
  assert.ok(behind >= 36 * 8, `the back wall carries panels, a hatch and a placard (${behind} vertices)`);
  assert.ok(pinBars > 0, 'the pin housing keeps its amber bars');
  assert.equal(amberOutside, 0, 'no amber dressing competes with the striped pin');
  s.dispose();
});

test('a place name announces an arrival once, not every time you cross its edge', () => {
  assert.equal(shouldAnnounceArea('armory', '', null, 1000), true, 'first arrival');
  assert.equal(shouldAnnounceArea('armory', 'armory', { id: 'armory', at: 1000 }, 1500), false, 'still inside');
  assert.equal(shouldAnnounceArea('armory', '', { id: 'armory', at: 1000 }, 9000), false, 'stepped out and back within seconds');
  assert.equal(shouldAnnounceArea('range', '', { id: 'armory', at: 1000 }, 1200), true, 'a different place speaks at once');
  assert.equal(shouldAnnounceArea('armory', '', { id: 'armory', at: 1000 }, 1000 + AREA_BANNER.repeatAfter * 1000), true, 'a real return announces again');
  assert.equal(shouldAnnounceArea('armory', '', { id: 'armory', at: 9e9 }, 1000), true, 'a clock that ran backwards never mutes a place for good');
  assert.equal(shouldAnnounceArea('', '', null, 0), false);
  const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  assert.ok(main.includes('if (area && shouldAnnounceArea(area.id, currentArea, areaAnnounced, now)) { showArea(area); areaAnnounced = { id: area.id, at: now }; }'));
  assert.ok(main.includes("if (typeof noteTalk === 'function') noteTalk(id === P.steward ? P.steward : P.apprentice);"), 'the cart thanks come from Azhou on screen');
});

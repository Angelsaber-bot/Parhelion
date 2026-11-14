import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { makeChaserShip } from '../src/environment/chaserShip';
import { BLACKSAIL_CHAPTERS } from '../src/story/blacksailChapters';

test('B07 chasers are modelled ships of the prop size, and they ride the swell', () => {
  const geo = new Set<THREE.BufferGeometry>(), mats: THREE.Material[] = [];
  const ship = makeChaserShip([3.2, 1.6, 10], geo, mats);
  const size = new THREE.Box3().setFromObject(ship).getSize(new THREE.Vector3());
  assert.ok(size.z > 9 && size.z < 11.5, `length ${size.z}`); assert.ok(size.y > 7, 'a mast and sail above the hull');
  const swell = ship.children[0]; (ship.userData.animate as (t: number) => void)(1.3); assert.notEqual(swell.rotation.z, 0, 'rolls on the swell');
  const chasers = BLACKSAIL_CHAPTERS.props.filter(p => p.model === 'chaser');
  assert.equal(chasers.length, 2, 'port and starboard chasers'); assert.ok(chasers.every(p => p.moved), 'both still move when the chapter beats them');
  geo.forEach(g => g.dispose()); mats.forEach(m => m.dispose());
});

test('Alix relay pennant rises and drops in rhythm; the forward standard waves', async () => {
  const { makeRelayPennant, makeWavingStandard } = await import('../src/environment/chaserShip');
  const { ORLEANS_ENTRIES } = await import('../src/story/orleansEntries');
  const geo = new Set<THREE.BufferGeometry>(), mats: THREE.Material[] = [];
  const pennant = makeRelayPennant([.7, .45, .03], geo, mats), cloth = pennant.children[0];
  const ys = [0, .4, .8, 1.2].map(t => { (pennant.userData.animate as (t: number) => void)(t); return cloth.position.y; });
  assert.ok(Math.max(...ys) - Math.min(...ys) > .4, `the pennant is raised and dropped (${ys.map(y => y.toFixed(2))})`);
  const standard = makeWavingStandard([1.2, .8, .03], geo, mats), flag = standard.children[0] as THREE.Mesh;
  (standard.userData.animate as (t: number) => void)(.3); const a = (flag.geometry.getAttribute('position') as THREE.BufferAttribute).getZ(8);
  (standard.userData.animate as (t: number) => void)(.6); const b = (flag.geometry.getAttribute('position') as THREE.BufferAttribute).getZ(8);
  assert.notEqual(a, b, 'the cloth ripples');
  assert.deepEqual(ORLEANS_ENTRIES.props.filter(p => p.model).map(p => p.model).sort(), ['pennant', 'standard']);
  geo.forEach(g => g.dispose()); mats.forEach(m => m.dispose());
});

test('E07 lunging shells are creatures with an invisible box that takes the shot', async () => {
  const { makeLungingShell } = await import('../src/environment/chaserShip');
  const { EGYPT_APPROACH } = await import('../src/story/egyptApproach');
  const geo = new Set<THREE.BufferGeometry>(), mats: THREE.Material[] = [];
  const { group, hit } = makeLungingShell([1, .8, .8], geo, mats);
  assert.equal((hit.material as THREE.MeshBasicMaterial).visible, false, 'the hit box draws nothing'); assert.equal(hit.visible, true, 'but stays raycastable');
  assert.ok(group.getObjectByName('Egypt_Stone_Armour'), 'a stone-armour creature');
  (group.userData.animate as (t: number) => void)(1);
  assert.equal(EGYPT_APPROACH.props.filter(p => p.model === 'shell' && p.target).length, 3, 'all three shell targets are modelled');
  geo.forEach(g => g.dispose()); mats.forEach(m => m.dispose());
});

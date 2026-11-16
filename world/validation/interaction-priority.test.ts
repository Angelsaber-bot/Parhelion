import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { clampUvChannels, MAX_UV_CHANNEL } from '../src/rendering/uvChannels';
import { egyptMirrorToTurn, EGYPT_MIRROR_MARKERS } from '../src/environment/egyptSunMirrors';

const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
const nearest = main.slice(main.indexOf('function nearestInteract('), main.indexOf('function canReachValleyPanel('));

test('the step the story needs wins the Interact key over side questions standing on the same spot', () => {
  const secondary = main.slice(main.indexOf('function secondaryMarker('), main.indexOf('function nearestInteract('));
  assert.ok(secondary.includes('(m.requires ?? []).some(r => !done.has(r))'), 'locked markers (Kyoto bellflower shard by the Akechi ledger)');
  assert.ok(secondary.includes('BOSSES.some(b => b.core === m.id)'), 'a beaten boss core (J09 latch beside the fire core)');
  assert.ok(secondary.includes('modelClaimPoints.some(point => point.marker.id === m.id)'), 'a servant already invited (Jeanne at the Orleans market)');
  assert.ok(nearest.includes("if (skipLocked && typeof secondaryMarker === 'function' && secondaryMarker(m)) continue;") && nearest.includes("if (!skipLocked && best && typeof secondaryMarker === 'function' && secondaryMarker(best)) return nearestInteract(true) ?? best;"), 'falls back to the side marker when it is the only one');
  assert.ok(nearest.includes("residentEventMarkerIds.has(best.id)) || (done.has(best.id) && BOSSES.some(b => b.core === best!.id)))) return fieldStep;"), 'a chapter step beats a resident errand (W05 stretcher)');
  assert.ok(nearest.includes("if(fieldChapters?.has(m.id)&&typeof canReachFieldMarker==='function'&&!canReachFieldMarker(m))continue;"), 'prompt and press share one reach test (B05 boat)');
  const reach = main.slice(main.indexOf('function canReachFieldMarker('), main.indexOf('function canReachValleyPanel('));
  assert.ok(reach.includes('canReachValleyPanel({ ...marker, p: [marker.p[0], marker.p[1] + .8, marker.p[2]] })'));
  assert.ok(main.includes("(typeof guidedToNpc === 'function' && guidedToNpc(npc.position))") && main.includes("(typeof guidedToNpc === 'function' && guidedToNpc(nearbyNpc.position))"), 'the person the beacon stands on is talked to, prompt and press alike');
});

test('a texture on a UV set three.js does not have falls back to the first set instead of breaking the shader', () => {
  const geometry = new THREE.BoxGeometry(), normal = new THREE.Texture(), map = new THREE.Texture();
  normal.channel = 4; map.channel = 1;
  const material = new THREE.MeshStandardMaterial({ normalMap: normal, map });
  const root = new THREE.Group(); root.add(new THREE.Mesh(geometry, material), new THREE.Mesh(geometry, material));
  assert.equal(clampUvChannels(root), 1, 'shared material handled once; only the out-of-range slot moves');
  assert.equal(material.normalMap!.channel, 0); assert.equal(material.map!.channel, 1, 'valid sets are kept');
  assert.equal(normal.channel, 4, 'the source texture is not mutated (it may be shared with another model)');
  assert.equal(MAX_UV_CHANNEL, 3);
  for (const file of ['../src/companions/servant.ts', '../src/characters/characterKit.ts'])
    assert.ok(readFileSync(new URL(file, import.meta.url), 'utf8').includes('clampUvChannels(gltf.scene);'), file);
});

test('Egypt mirrors: the guide points at the mirror where the light stops, not always the first', () => {
  const [court, hall, axis] = EGYPT_MIRROR_MARKERS;
  const set = (a: number, b: number, c: number) => new Set([`${court}_${a}`, `${hall}_${b}`, `${axis}_${c}`]);
  assert.equal(egyptMirrorToTurn(set(3, 0, 0)), axis, 'first two right: the third is the one to turn');
  assert.equal(egyptMirrorToTurn(set(0, 0, 0)), court, 'nothing right: start at the first');
  assert.equal(egyptMirrorToTurn(set(3, 0, 2)), axis, 'solved: stays put');
  const journey = readFileSync(new URL('../src/story/worldJourney.ts', import.meta.url), 'utf8');
  assert.ok(journey.includes("objective('egypt', egyptMirrorToTurn(done),"));
});

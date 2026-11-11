import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transformSync } from 'esbuild';
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { MODEL_CLAIM_POINTS } from '../src/companions/modelClaimPoints.ts';

const source = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
const interaction = source.slice(source.indexOf('function interact()'), source.indexOf('function checkDiscoveries()'));
const visibility = source.slice(source.indexOf('function canReachValleyPanel('), source.indexOf('function nearbySettlementNpc('));
const code = transformSync(visibility + interaction, { loader: 'ts', target: 'es2022' }).code;

function setup(index: number, blocked = false, failed = false) {
  const claim = MODEL_CLAIM_POINTS[index], messages: string[] = [];
  const floor = new MeshBVH(new THREE.PlaneGeometry(100, 100).rotateX(-Math.PI / 2).translate(claim.marker.p[0], claim.marker.p[1] + .15, claim.marker.p[2]));
  let calls = 0, retries = 0;
  const modelCompanion = {
    selected: null as string | null, state: 'off',
    async select(id: string) { calls++; this.selected = id; this.state = failed ? 'failed' : 'ready'; },
    async retry() { retries++; this.state = 'ready'; },
  };
  const context = vm.createContext({
    THREE, modelClaimPoints: MODEL_CLAIM_POINTS, modelCompanion,
    nearestInteract: () => claim.marker,
    player: { pos: new THREE.Vector3(...claim.marker.p).add(new THREE.Vector3(0, .15, 2)) },
    combat: { geometry: { cast(from: THREE.Vector3, direction: THREE.Vector3, distance: number) {
      return blocked || floor.raycastFirst(new THREE.Ray(from, direction.clone().normalize()), THREE.DoubleSide, 0, distance);
    } } },
    audio: { interaction() {} }, servantPanel: { render() {} },
    toast: (message: string) => messages.push(message), bilingual: (_zh: string, en: string) => en,
    localizeText: (text: string) => text,
  });
  vm.runInContext(code, context);
  return { context, messages, modelCompanion, calls: () => calls, retries: () => retries };
}

for (let index = 0; index < MODEL_CLAIM_POINTS.length; index++) test(`${MODEL_CLAIM_POINTS[index].id}: physical claim above pavement loads the model without generic activation`, async () => {
  const state = setup(index);
  vm.runInContext('interact()', state.context);
  await Promise.resolve();
  assert.equal(state.calls(), 1);
  assert.equal(state.modelCompanion.state, 'ready');
  assert.match(state.messages[0], /: claimed$/);
});

test('obstructed claim never falls through into generic quest activation', () => {
  const state = setup(0, true);
  vm.runInContext('interact()', state.context);
  assert.equal(state.calls(), 0);
  assert.match(state.messages[0], /clear path/);
});

test('failed model claim reports failure and a second physical interaction retries', async () => {
  const state = setup(2, false, true);
  vm.runInContext('interact()', state.context);
  await Promise.resolve();
  assert.match(state.messages[0], /failed to load/);
  vm.runInContext('interact()', state.context);
  await Promise.resolve();
  assert.equal(state.calls(), 1);
  assert.equal(state.retries(), 1);
  assert.match(state.messages[1], /: claimed$/);
});

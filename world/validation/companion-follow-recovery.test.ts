import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { CharacterKit, type CharacterKitDefinition } from '../src/characters/characterKit';
import { ContractServant } from '../src/companions/servant';
import { FirstContract } from '../src/companions/contracts';
import { KitCompanion } from '../src/companions/kitCompanion';
import { CompanionNavigation } from '../src/companions/companionNavigation';

async function fixture(kind: 'saber' | 'foot' | 'mounted') {
  const scene = new THREE.Group(), socket = new THREE.Object3D(); socket.name = 'Socket'; scene.add(socket);
  const definition: CharacterKitDefinition = {
    id: 'follow-recovery', assetUrl: 'fixture', defaultState: 'idle', rootMotion: 'in-place',
    sockets: { saddle: { node: 'Socket' } },
    ...(kind === 'mounted' ? { mount: { saddleSocket: 'saddle', riderSeatSocket: 'saddle' } } : {}),
    clips: {
      idle: { name: 'Idle', duration: 3, loop: true }, walk: { name: 'Walk', duration: 1, loop: true, nominalSpeed: .75 },
      run: { name: 'Run', duration: .8, loop: true, nominalSpeed: 2 },
      attack: { name: 'Attack', duration: 1.4, loop: false, events: [{ at: .6, kind: 'hit' }] },
    },
  };
  const gltf = { scene, animations: Object.values(definition.clips).map(c => new THREE.AnimationClip(c.name, c.duration, [])) } as GLTF;
  const geometry = new THREE.PlaneGeometry(200, 200).rotateX(-Math.PI / 2);
  const colliders = [{ name: 'floor', enabled: true, bvh: new MeshBVH(geometry) }];
  const player = new THREE.Vector3();
  let hits = 0, rejoins = 0, enemy: { id: string; position: THREE.Vector3 } | null = null;
  const engage = () => enemy && enemy.position.distanceTo(player) < 15 ? enemy : null;
  const strike = () => { hits++; return enemy; };
  let root: THREE.Group, update: () => void, dispose: () => void, attacking: () => boolean;
  if (kind === 'saber') {
    const actor = new ContractServant({ scene: new THREE.Scene(), marker: { id: 'saber_contract', type: 'interact', label: 'Saber', p: [0, 0, 0] },
      contract: new FirstContract(new Set(['saber_contract'])), colliders, load: async () => gltf,
      target: () => enemy, track: () => enemy, engage, strike, onRejoin: () => rejoins++ });
    await actor.ensureLoaded(); root = actor.root;
    update = () => actor.update(1 / 60, player, 0, true, false);
    attacking = () => actor.animation === 'Attack'; dispose = () => actor.dispose();
  } else {
    const follow = new KitCompanion({ colliders, range: kind === 'mounted' ? 4.5 : 3.5, damage: 9,
      target: () => enemy, track: () => enemy, engage, strike, onRejoin: () => rejoins++ });
    const actor = new CharacterKit(gltf, definition, { onEvent: event => follow.onEvent(actor, event) });
    root = actor.root; update = () => follow.update(actor, 1 / 60, player, 0, false);
    attacking = () => follow.attacking; dispose = () => { follow.release(actor); actor.dispose(); };
  }
  update();
  return { root, player, colliders, update, attacking, setEnemy: (value: typeof enemy) => { enemy = value; },
    get hits() { return hits; }, get rejoins() { return rejoins; }, dispose: () => { dispose(); geometry.dispose(); } };
}

for (const kind of ['saber', 'foot', 'mounted'] as const) test(`${kind}: leaving an enemy cancels ordinary combat and follows the sprinting player`, async () => {
  const f = await fixture(kind);
  try {
    f.setEnemy({ id: 'enemy', position: f.root.position.clone().add(new THREE.Vector3(0, 0, 1.5)) });
    for (let i = 0; i < 600 && !f.attacking(); i++) f.update();
    assert.equal(f.attacking(), true, 'exercise a committed ordinary attack before leaving');
    const hits = f.hits; let maximumGap = 0;
    for (let i = 0; i < 300; i++) {
      f.player.z += 9 / 60; f.update(); maximumGap = Math.max(maximumGap, f.root.position.distanceTo(f.player));
      assert.equal(f.attacking(), false, 'travel takes priority over another ordinary attack');
    }
    assert.equal(f.hits, hits, 'no pending ordinary damage after leaving');
    assert.equal(f.rejoins, 0, 'travel follows on foot rather than teleporting');
    assert.ok(maximumGap < 10, `gap ${maximumGap}`);
  } finally { f.dispose(); }
});

for (const kind of ['saber', 'foot'] as const) test(`${kind}: an enclosed follower less than 12m away safely regroups without waiting for the player to leave`, async () => {
  const f = await fixture(kind), walls: THREE.BufferGeometry[] = [];
  try {
    const { x, z } = f.root.position;
    for (const [dx, dz, width, depth] of [[-1, 0, .2, 2.2], [1, 0, .2, 2.2], [0, -1, 2.2, .2], [0, 1, 2.2, .2]]) {
      const geometry = new THREE.BoxGeometry(width, 3, depth).translate(x + dx, 1.5, z + dz); walls.push(geometry);
      f.colliders.push({ name: 'enclosure', enabled: true, bvh: new MeshBVH(geometry) });
    }
    f.player.x = 5;
    assert.ok(f.root.position.distanceTo(f.player) < 12);
    for (let i = 0; i < 300; i++) f.update();
    assert.equal(f.rejoins, 1);
    assert.ok(f.root.position.distanceTo(f.player) < 4);
    assert.equal(new CompanionNavigation(f.colliders).path(f.player, f.root.position), true, 'return is supported on the player side of the walls');
    assert.equal(f.hits, 0);
  } finally { f.dispose(); walls.forEach(g => g.dispose()); }
});

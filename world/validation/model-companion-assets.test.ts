import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { MeshBVH } from 'three-mesh-bvh';
import { CHARACTER_KITS, MODEL_COMPANIONS } from '../src/characters/catalog.ts';
import { CharacterKit, decodeCharacterAsset, type CharacterKitDefinition } from '../src/characters/characterKit.ts';
import { ModelCompanion } from '../src/companions/modelCompanion.ts';
import { Player } from '../src/player/player.ts';

const hashes = {
  jeanne: '691822500ea47356a3d950835a72e97404311810702dd904bac5aaa10304b035',
  ozymandias: 'cfd20e12ecaa03d79b38d7963e0b1c9e9df354cff30496d2f4cc34e9e0e406bb',
  qinShiHuang: '9f1049088932b5515fce985536f8f6d2464bce07a1c1281478fa6da2a38af922',
};
const transforms = (root: THREE.Object3D) => { const result: number[] = []; root.updateMatrixWorld(true); root.traverse(node => result.push(...node.matrixWorld.elements)); return result; };
const assertClose = (a: number[], b: number[]) => { assert.equal(a.length, b.length); for (let i = 0; i < a.length; i++) assert.ok(Math.abs(a[i] - b[i]) < 1e-6, `transform mismatch ${i}: ${a[i]} vs ${b[i]}`); };

for (const { id } of MODEL_COMPANIONS) test(`${id}: exact frozen runtime loads in the actual CharacterKit with native clips, transforms, sockets and pause`, async () => {
  const definition: CharacterKitDefinition = CHARACTER_KITS[id], transport = Buffer.concat([definition.assetUrl, ...(definition.additionalAssetUrls ?? [])].map(url => readFileSync(new URL(url)))), bytes = Buffer.from(await decodeCharacterAsset(transport.buffer.slice(transport.byteOffset, transport.byteOffset + transport.byteLength)));
  assert.ok(transport.byteLength <= 25 * 1024 * 1024, 'character transport fits Cloudflare Pages per-file limit');
  assert.equal(createHash('sha256').update(bytes).digest('hex'), hashes[id]);
  // CPU rig/animation validation only. Browser image decoding and GPU rendering are not simulated.
  const gltf = await new GLTFLoader().register(() => ({ name: 'OfflineRigOnly', loadTexture: async () => null as unknown as THREE.Texture })).parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const original = transforms(gltf.scene), reference = clone(gltf.scene), referenceMixer = new THREE.AnimationMixer(reference);
  let events = 0;
  const kit = new CharacterKit(gltf, definition, { transitionSeconds: 0, onEvent: () => events++ });
  assertClose(transforms(kit.model), original);
  assert.deepEqual(kit.root.scale.toArray(), [1, 1, 1]); assert.deepEqual(kit.root.position.toArray(), [0, 0, 0]);
  assert.equal(definition.visualOffset, undefined); assert.equal(definition.clips.attack, undefined);
  for (const [state, clip] of Object.entries(definition.clips)) {
    assert.equal(clip.nominalSpeed, undefined); assert.equal(clip.events, undefined);
    const native = gltf.animations.find(animation => animation.name === clip.name)!;
    assert.ok(native); assert.ok(Math.abs(native.duration - clip.duration) <= 1e-4);
    assert.ok(kit.presentationClips.includes(native), 'adapter must use the original clip without remastering');
    kit.play(state, { restart: true }); kit.update(.2);
    referenceMixer.stopAllAction(); referenceMixer.clipAction(native).reset().play(); referenceMixer.update(.2);
    assertClose(transforms(kit.model), transforms(reference));
    const before = transforms(kit.model), time = kit.clipTime; kit.update(.1, true);
    assert.equal(kit.clipTime, time); assertClose(transforms(kit.model), before);
    for (const socket of Object.keys(definition.sockets)) assert.ok(kit.socketTransform(socket)?.position.toArray().every(Number.isFinite));
  }
  if (id === 'jeanne') { assert.equal(definition.clips.walk.name, 'Walk_Draped'); assert.equal(definition.clips.run.name, 'Run_Draped'); assert.ok(gltf.animations.some(clip => clip.name === 'Walk')); assert.ok(gltf.animations.some(clip => clip.name === 'Run')); }
  if (id === 'qinShiHuang') {
    assert.deepEqual(Object.values(definition.clips).map(clip => clip.duration), [4, 2, 1.5, 6]);
    // Grounding the host root translates all native joints together, without forcing feet/mesh to zero.
    const local = kit.model.position.clone(), before = kit.socketTransform('head')!.position.y;
    kit.root.position.y = 3; assert.ok(Math.abs(kit.socketTransform('head')!.position.y - before - 3) < 1e-6); assert.deepEqual(kit.model.position, local);
  }
  assert.equal(events, 0); referenceMixer.stopAllAction(); referenceMixer.uncacheRoot(reference); kit.dispose();
});

for (const { id } of MODEL_COMPANIONS) test(`${id}: real model follows actual Player sprint/turn/stop on a CPU runway without damage or teleport`, async t => {
  const geometry = new THREE.PlaneGeometry(500, 500).rotateX(-Math.PI / 2);
  const colliders = [{ name: 'runway', enabled: true, bvh: new MeshBVH(geometry) }], player = new Player(colliders, -10);
  player.teleport(0, .02, 0); for (let i = 0; i < 30; i++) player.step(1 / 120, { x: 0, z: 0, jump: false, sprint: false });
  const scene = new THREE.Scene();
  const companion = new ModelCompanion({ scene, colliders, load: async (definition, options) => {
    const transport = Buffer.concat([definition.assetUrl, ...(definition.additionalAssetUrls ?? [])].map(url => readFileSync(new URL(url)))), bytes = Buffer.from(await decodeCharacterAsset(transport.buffer.slice(transport.byteOffset, transport.byteOffset + transport.byteLength)));
    const gltf = await new GLTFLoader().register(() => ({ name: 'OfflineRigOnly', loadTexture: async () => null as unknown as THREE.Texture })).parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
    return new CharacterKit(gltf, definition, options);
  } });
  try {
    await companion.select(id); companion.update(1 / 60, player.pos, player.yaw, true, false);
    const actor = companion.actor!; let maximumGap = 0, travel = 0; const states = new Set<string>();
    for (let frame = 0; frame < 1200; frame++) {
      player.yaw = frame < 600 ? 0 : Math.PI / 2;
      const start = player.pos.clone(); for (let sub = 0; sub < 2; sub++) player.step(1 / 120, { x: 0, z: 1, jump: false, sprint: true });
      travel += player.pos.distanceTo(start);
      const previous = actor.root.position.clone(); companion.update(1 / 60, player.pos, player.yaw, true, false);
      assert.ok(actor.root.position.distanceTo(previous) <= 11 / 60 + 1e-5, 'generic follow must not teleport during the sprint');
      assert.ok(actor.root.position.toArray().every(Number.isFinite)); assert.ok(Math.abs(actor.root.position.y) < 1e-6);
      maximumGap = Math.max(maximumGap, actor.root.position.distanceTo(player.pos)); states.add(actor.state);
    }
    assert.ok(Math.abs(travel - 180) < .05); assert.ok(maximumGap < 9); assert.ok(states.has('run'));
    for (let i = 0; i < 240; i++) { for (let sub = 0; sub < 2; sub++) player.step(1 / 120, { x: 0, z: 0, jump: false, sprint: false }); companion.update(1 / 60, player.pos, player.yaw, true, false); }
    assert.ok(actor.root.position.distanceTo(player.pos) < 4); assert.equal(actor.state, 'idle'); assert.equal(actor.definition.clips.attack, undefined);
    t.diagnostic(JSON.stringify({ id, playerMetres: travel, maximumGap, settledGap: actor.root.position.distanceTo(player.pos), nativePlaybackRate: actor.playbackRate, scope: 'CPU generic follow only; no calibrated foot-speed or GPU claim' }));
  } finally { companion.dispose(); assert.equal(scene.children.length, 0); geometry.dispose(); }
});

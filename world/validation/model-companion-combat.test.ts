import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshBVH } from 'three-mesh-bvh';
import { CHARACTER_KITS, MODEL_COMPANIONS } from '../src/characters/catalog.ts';
import { CharacterKit, decodeCharacterAsset } from '../src/characters/characterKit.ts';
import { ModelCompanion } from '../src/companions/modelCompanion.ts';
import { Player } from '../src/player/player.ts';

for (const { id } of MODEL_COMPANIONS) test(`${id}: real GLB reaches the generic combat damage fallback`, async () => {
  const geometry = new THREE.PlaneGeometry(100, 100).rotateX(-Math.PI / 2);
  const colliders = [{ name: 'floor', enabled: true, bvh: new MeshBVH(geometry) }];
  const player = new Player(colliders, -10); player.teleport(0, .02, 0);
  let strikes = 0;
  const scene = new THREE.Scene();
  const companion = new ModelCompanion({
    scene, colliders, combat: {
      range: 3.5, damage: 14,
      target: (position) => ({ id: 'dummy', position: position.clone().add(new THREE.Vector3(0, 0, 1)) }),
      track: (position) => ({ id: 'dummy', position: position.clone().add(new THREE.Vector3(0, 0, 1)) }),
      strike: () => { strikes++; return { id: 'dummy', position: new THREE.Vector3() }; },
      engage: () => null,
    },
    load: async (definition, options) => {
      const transport = Buffer.concat([definition.assetUrl, ...(definition.additionalAssetUrls ?? [])].map(url => readFileSync(new URL(url))));
      const bytes = await decodeCharacterAsset(transport.buffer.slice(transport.byteOffset, transport.byteOffset + transport.byteLength));
      const gltf = await new GLTFLoader().register(() => ({ name: 'OfflineRigOnly', loadTexture: async () => null as unknown as THREE.Texture })).parseAsync(bytes, '');
      return new CharacterKit(gltf, definition, options);
    },
  });
  try {
    await companion.select(id);
    for (let frame = 0; frame < 12; frame++) companion.update(1 / 60, player.pos, player.yaw, true, false);
    assert.equal(strikes, 0, `${id} generic contact must not damage during the windup`);
    for (let frame = 0; frame < 18; frame++) companion.update(1 / 60, player.pos, player.yaw, true, false);
    assert.ok(strikes >= 1, `${id} should use the bounded generic fallback when no attack event exists`);
  } finally { companion.dispose(); geometry.dispose(); }
});

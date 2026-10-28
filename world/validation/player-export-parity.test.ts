import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import asset from '../src/generated/player-mesh.json';

const publicGlb = path.resolve(import.meta.dirname, '../public/assets/character_explorer.glb');
test('authored Blender GLB and quantized runtime agree on every joint triangle count', () => {
  const bytes = fs.readFileSync(publicGlb);
  assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
  const json = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
  assert.equal(json.materials.length, 1);
  const expected = new Map(asset.parts.map(p => [`PlayerPart_${p.joint}`, p.triangles]));
  let meshes = 0;
  for (const node of json.nodes) {
    if (node.mesh === undefined) continue;
    const triangles = json.meshes[node.mesh].primitives.reduce((n: number, p: { indices: number }) => n + json.accessors[p.indices].count / 3, 0);
    assert.equal(triangles, expected.get(node.name), `${node.name} triangle parity`);
    meshes++;
  }
  assert.equal(meshes, asset.parts.length);
});

import * as THREE from 'three';
import { buildCharacter } from '../src/character';
import { deformUniformCloth } from '../src/playerMesh';

test('short uniform deformation is reversible, finite and never accumulates previous frame offsets', () => {
  const rig = buildCharacter(new THREE.MeshStandardMaterial({ vertexColors: true }));
  const mesh = rig.meshes.find(m => m.name === 'PlayerPart_CoatTails')!;
  const positions = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
  const original = Float32Array.from(positions.array);
  const initialRadius = mesh.geometry.boundingSphere!.radius;
  rig.joints.Thigh_L.rotation.x = -.8; rig.joints.Thigh_R.rotation.x = .8;
  deformUniformCloth(rig.joints, rig.meshes);
  const moved = Float32Array.from(positions.array);
  assert.ok(moved.some((n, i) => Math.abs(n - original[i]) > .01), 'hem must actually follow legs');
  for (let i = 0; i < 50; i++) deformUniformCloth(rig.joints, rig.meshes);
  assert.deepEqual(Float32Array.from(positions.array), moved, 'unchanged pose cannot drift');
  assert.ok(mesh.geometry.boundingSphere!.radius >= initialRadius + .19);
  rig.joints.Thigh_L.rotation.x = 0; rig.joints.Thigh_R.rotation.x = 0;
  deformUniformCloth(rig.joints, rig.meshes);
  for (let i = 0; i < original.length; i++) assert.ok(Math.abs(positions.array[i] - original[i]) < 1e-6);
  assert.ok(Array.from(positions.array).every(Number.isFinite));
  const normals = mesh.geometry.getAttribute('normal');
  for (let i = 0; i < normals.count; i++)
    assert.ok(Math.abs(Math.hypot(normals.getX(i), normals.getY(i), normals.getZ(i)) - 1) < 1e-5);
  rig.meshes.forEach(m => m.geometry.dispose());
});

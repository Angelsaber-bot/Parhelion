import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as THREE from 'three';

// Cheap shipped-asset regression: no full main boot or meshopt decode needed.
const bytes = readFileSync(new URL('../public/assets/world_blacksail.glb', import.meta.url));
const jsonLength = bytes.readUInt32LE(12);
const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
const binary = bytes.subarray(28 + jsonLength);
const name = 'Nassau_Tavern_Timber_Underside';

test('tavern repair preserves every original binary byte, including all collider data', () => {
  assert.equal(createHash('sha256').update(binary.subarray(0, 4605988)).digest('hex'),
    '2973f0a1ad46e5ff9e094139527f37d05598f76c4b9d09099fd8b838f51ce2af');
  assert.equal(binary.length, 4605988 + 648);
});

test('shipped tavern has one six-face inward FrontSide timber lining under ART only', () => {
  const nodes = gltf.nodes.map((n: any, i: number) => ({ ...n, i })).filter((n: any) => n.name === name);
  assert.equal(nodes.length, 1);
  const node = nodes[0], art = gltf.nodes.find((n: any) => n.name === 'ART');
  assert(art.children.includes(node.i));
  assert.equal(node.extras.outline, false);
  const mesh = gltf.meshes[node.mesh];
  assert.equal(mesh.primitives.length, 1);
  const primitive = mesh.primitives[0], material = gltf.materials[primitive.material];
  assert.equal(material.name, 'M_BlackSailTimber');
  assert.notEqual(material.doubleSided, true);
  assert.equal(primitive.mode, 4);
  assert.equal(primitive.indices, undefined);
  const read = (semantic: string) => {
    const a = gltf.accessors[primitive.attributes[semantic]], v = gltf.bufferViews[a.bufferView];
    assert.equal(a.componentType, 5126); assert.equal(a.count, 18); assert.equal(a.type, 'VEC3');
    assert.equal(v.buffer, 0); assert.equal(v.byteLength, 216);
    const offset = (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
    return Float32Array.from({ length: 54 }, (_, i) => binary.readFloatLE(offset + 4 * i));
  };
  const positions = read('POSITION'), normals = read('NORMAL');
  assert([...positions, ...normals, ...read('COLOR_0')].every(Number.isFinite));
  for (let i = 1; i < normals.length; i += 3) assert(normals[i] < -.1);
  const geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const surface = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.FrontSide }));
  for (const x of [-129.5, -126.5]) for (const z of [126, 130]) {
    const hits = new THREE.Raycaster(new THREE.Vector3(x, 5, z), new THREE.Vector3(0, 1, 0), 0, 15).intersectObject(surface);
    assert.equal(hits.length, 1); assert(hits[0].point.y > 8.4 && hits[0].point.y < 10.84);
  }
  geometry.dispose(); surface.material.dispose();
});

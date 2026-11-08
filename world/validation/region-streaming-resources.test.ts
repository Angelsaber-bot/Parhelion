import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RegionVisualStreaming } from '../src/map/regionVisualStreaming';

function regionGlb(triangles = 1, nodes = 1) {
  const positions = new Float32Array(triangles * 9);
  for (let i = 0; i < triangles; i++) {
    const x = Math.floor(i / 1000) * 64;
    positions.set([x, 0, 0, x + 1, 0, 0, x, 1, 0], i * 9);
  }
  const json = new TextEncoder().encode(JSON.stringify({
    asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: Array.from({ length: nodes }, (_, i) => i) }],
    nodes: Array.from({ length: nodes }, (_, i) => ({ mesh: 0, name: `Art_${i}`, extras: { outline: true } })),
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    buffers: [{ byteLength: positions.byteLength }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: positions.byteLength }],
    accessors: [{ bufferView: 0, componentType: 5126, count: positions.length / 3, type: 'VEC3', min: [0, 0, 0], max: [Math.floor((triangles - 1) / 1000) * 64 + 1, 1, 0] }],
  }));
  const padded = (json.length + 3) & ~3;
  const buffer = new ArrayBuffer(12 + 8 + padded + 8 + positions.byteLength), view = new DataView(buffer);
  view.setUint32(0, 0x46546c67, true); view.setUint32(4, 2, true); view.setUint32(8, buffer.byteLength, true);
  view.setUint32(12, padded, true); view.setUint32(16, 0x4e4f534a, true);
  new Uint8Array(buffer, 20, padded).fill(32); new Uint8Array(buffer, 20, json.length).set(json);
  view.setUint32(20 + padded, positions.byteLength, true); view.setUint32(24 + padded, 0x004e4942, true);
  new Uint8Array(buffer, 28 + padded).set(new Uint8Array(positions.buffer));
  return buffer;
}

function captureResources(t: TestContext) {
  const geometries = new Map<THREE.BufferGeometry, number>(), materials = new Map<THREE.Material, number>();
  const decoded: { meshes: THREE.Mesh[]; materials: Set<THREE.Material>; geometries: Set<THREE.BufferGeometry> }[] = [];
  const parse = GLTFLoader.prototype.parseAsync, disposeGeometry = THREE.BufferGeometry.prototype.dispose, disposeMaterial = THREE.Material.prototype.dispose;
  t.mock.method(GLTFLoader.prototype, 'parseAsync', async function(this: GLTFLoader, ...args: Parameters<typeof parse>) {
    const gltf = await parse.apply(this, args), meshes: THREE.Mesh[] = [];
    gltf.scene.traverse(object => { if ((object as THREE.Mesh).isMesh) meshes.push(object as THREE.Mesh); });
    decoded.push({ meshes, materials: new Set(meshes.flatMap(mesh => Array.isArray(mesh.material) ? mesh.material : [mesh.material])), geometries: new Set(meshes.map(mesh => mesh.geometry)) });
    return gltf;
  });
  t.mock.method(THREE.BufferGeometry.prototype, 'dispose', function(this: THREE.BufferGeometry) { geometries.set(this, (geometries.get(this) ?? 0) + 1); disposeGeometry.call(this); });
  t.mock.method(THREE.Material.prototype, 'dispose', function(this: THREE.Material) { materials.set(this, (materials.get(this) ?? 0) + 1); disposeMaterial.call(this); });
  return { decoded, geometries, materials };
}

test('cancelling shader warm-up releases detached source art and preserves resident shared outlines', async t => {
  const resources = captureResources(t);
  t.mock.method(globalThis, 'fetch', async () => new Response(regionGlb(5001)));
  const parent = new THREE.Group();
  const resident = new RegionVisualStreaming({ parent, outlines: true, lowQuality: true, eager: true });
  let finish!: () => void, entered!: () => void;
  const warming = new Promise<void>(resolve => { entered = resolve; });
  const cancelled = new RegionVisualStreaming({ parent, outlines: true, lowQuality: true, warm: () => { entered(); return new Promise<void>(resolve => { finish = resolve; }); } });
  try {
    assert.equal(await resident.ensure('alpha'), true);
    const shared = new Set<THREE.Material>();
    parent.traverse(object => { if (object.name.endsWith('__outline')) shared.add((object as THREE.Mesh).material as THREE.Material); });
    assert.ok(shared.size > 0);
    const pending = cancelled.ensure('britain'); await warming;
    const decoded = resources.decoded[1];
    // Chunking detached these original meshes; traversing the installed tree alone cannot release them.
    assert.equal(decoded.meshes[0].parent, null);
    cancelled.dispose(); finish();
    assert.equal(await pending, false);
    for (const geometry of decoded.geometries) assert.equal(resources.geometries.get(geometry), 1, 'detached source geometry is released once');
    for (const material of decoded.materials) assert.equal(resources.materials.get(material), 1, 'replaced source material is released once');
    for (const material of shared) assert.equal(resources.materials.get(material), undefined, 'another region still owns its outline use');
    assert.equal(parent.children.length, 1);
    assert.equal(cancelled.diagnostics.disposedGeometries, 7, 'one original plus six chunk geometries');
    assert.equal(cancelled.diagnostics.disposedMaterials, 2, 'source and converted material only');
  } finally { cancelled.dispose(); resident.dispose(); }
});

test('preparation failure releases unprocessed meshes and cloned geometry, then permits retry', async t => {
  const resources = captureResources(t);
  t.mock.method(globalThis, 'fetch', async () => new Response(regionGlb(1, 2)));
  let fail = true;
  const parent = new THREE.Group();
  const stream = new RegionVisualStreaming({ parent, outlines: true, lowQuality: true, carve: () => { if (fail) throw Error('carve failed'); return null; } });
  try {
    assert.equal(await stream.ensure('alpha'), false);
    const decoded = resources.decoded[0];
    for (const mesh of decoded.meshes) assert.equal(resources.geometries.get(mesh.geometry), 1, 'all baked mesh geometry is released even before processing begins');
    for (const material of decoded.materials) assert.equal(resources.materials.get(material), 1);
    assert.equal(parent.children.length, 0);
    assert.deepEqual(stream.diagnostics.pending, []);
    fail = false;
    assert.equal(await stream.retry('alpha'), true);
    assert.equal(parent.children.length, 1);
  } finally { stream.dispose(); }
});

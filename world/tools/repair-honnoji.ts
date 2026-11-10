// Update only Honnō-ji's visual batch in a shipped map. Preserve the authored
// terrain, markers, collision ordering and all unrelated architecture exactly.
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { readFileSync, writeFileSync } from 'node:fs';
import { buildKyoto } from './gen/kyoto/build';
import { heightFn } from './gen/kyoto/terrain';
import { compress } from './gen/export';

// Copy compressed buffer views verbatim. Decoding and encoding the entire map
// would round its octahedral normal filters a second time, changing other art.
function unpack(bytes: Buffer) {
  if (bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(4) !== 2) throw new Error('GLB v2 required');
  const length = bytes.readUInt32LE(12), binStart = 20 + length;
  return { json: JSON.parse(bytes.subarray(20, binStart).toString()), bin: bytes.subarray(binStart + 8, binStart + 8 + bytes.readUInt32LE(binStart)) };
}
const path = process.argv[2] ?? 'public/assets/world_kyoto.glb';
const output = process.argv[3] ?? path;
const target = unpack(readFileSync(path)), json = target.json;
const node = json.nodes.find((n: any) => n.name === 'Honnoji');
if (node?.mesh === undefined) throw new Error('Existing Honnoji visual batch required');
const material = json.meshes[node.mesh].primitives[0].material;
const { pieces } = buildKyoto(heightFn);
const batch = pieces.find(p => p.name === 'Honnoji')!.batch;
const geometry = batch.build().vis!;
const scene = new THREE.Scene();
const replacement = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true }));
replacement.name = 'Honnoji'; scene.add(replacement);
const raw = await new GLTFExporter().parseAsync(scene, { binary: true }) as ArrayBuffer;
const source = unpack(Buffer.from(await compress(new Uint8Array(raw), true))), added = source.json;
const sourceNode = added.nodes.find((n: any) => n.name === 'Honnoji');
const bufferMap = [0], binOffset = target.bin.length;
for (let i = 1; i < added.buffers.length; i++) bufferMap[i] = json.buffers.push(added.buffers[i]) - 1;
const viewOffset = json.bufferViews.length, accessorOffset = json.accessors.length;
for (const view of added.bufferViews) {
  if (view.buffer === 0) view.byteOffset = (view.byteOffset ?? 0) + binOffset;
  view.buffer = bufferMap[view.buffer];
  const compressed = view.extensions?.EXT_meshopt_compression;
  if (compressed) {
    if (compressed.buffer === 0) compressed.byteOffset = (compressed.byteOffset ?? 0) + binOffset;
    compressed.buffer = bufferMap[compressed.buffer];
  }
  json.bufferViews.push(view);
}
for (const accessor of added.accessors) {
  if (accessor.sparse) throw new Error('Sparse repair accessors are unsupported');
  accessor.bufferView += viewOffset; json.accessors.push(accessor);
}
const mesh = added.meshes[sourceNode.mesh];
for (const primitive of mesh.primitives) {
  for (const semantic of Object.keys(primitive.attributes)) primitive.attributes[semantic] += accessorOffset;
  if (primitive.indices !== undefined) primitive.indices += accessorOffset;
  primitive.material = material;
}
json.meshes[node.mesh].primitives = mesh.primitives;
for (const key of ['translation', 'rotation', 'scale']) {
  if (sourceNode[key]) node[key] = sourceNode[key]; else delete node[key];
}
const bin = Buffer.concat([target.bin, source.bin]); json.buffers[0].byteLength = bin.length;
const encoded = Buffer.from(JSON.stringify(json));
const jsonBytes = Buffer.concat([encoded, Buffer.alloc((4-encoded.length%4)%4, 32)]);
const header = Buffer.alloc(20), binHeader = Buffer.alloc(8);
header.writeUInt32LE(0x46546c67,0); header.writeUInt32LE(2,4); header.writeUInt32LE(28+jsonBytes.length+bin.length,8);
header.writeUInt32LE(jsonBytes.length,12); header.writeUInt32LE(0x4e4f534a,16);
binHeader.writeUInt32LE(bin.length,0); binHeader.writeUInt32LE(0x004e4942,4);
writeFileSync(output, Buffer.concat([header,jsonBytes,binHeader,bin]));
console.log(`Repaired Honnoji only: ${output}`);

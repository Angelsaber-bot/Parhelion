// Decode an actual production GLB for geometry QA, without changing the asset.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { dequantize } from '@gltf-transform/functions';
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder': MeshoptDecoder});
const doc = await io.read(process.argv[2]);
for (const e of doc.getRoot().listExtensionsUsed()) if(e.extensionName === 'EXT_meshopt_compression') e.dispose();
await doc.transform(dequantize());
await io.write(process.argv[3], doc);

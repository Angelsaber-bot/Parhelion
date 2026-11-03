import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
for (const f of process.argv.slice(2)) {
  const doc = await io.read(f);
  for (const n of doc.getRoot().listNodes()) { const m = n.getMesh(); if (!m) continue; let c = 0; for (const p of m.listPrimitives()) c += p.getAttribute('POSITION')?.getCount() ?? 0; console.log(f.split('/').pop(), n.getName(), c, JSON.stringify(n.getTranslation())); }
}

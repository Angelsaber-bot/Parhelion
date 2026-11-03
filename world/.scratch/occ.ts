import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { writeFileSync } from 'node:fs';
await MeshoptDecoder.ready;
const [file, ox, oz, out] = [process.argv[2], Number(process.argv[3]), Number(process.argv[4]), process.argv[5]];
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(file);
const half = 360, cell = 2, N = half * 2 / cell;
const occ: string[][] = Array.from({ length: N }, () => new Array(N).fill('.'));
for (const n of doc.getRoot().listNodes()) {
  const m = n.getMesh(); if (!m) continue; const name = n.getName();
  const tag = /Trunk/.test(name) ? 'T' : /Physical|Camelot|Camlann/.test(name) ? 'B' : /Rocks/.test(name) ? 'R' : null; if (!tag) continue;
  const W = n.getWorldMatrix();
  for (const p of m.listPrimitives()) {
    const a = p.getAttribute('POSITION')!; const v = [0, 0, 0];
    for (let i = 0; i < a.getCount(); i++) {
      a.getElement(i, v);
      const x = W[0]*v[0]+W[4]*v[1]+W[8]*v[2]+W[12], z = W[2]*v[0]+W[6]*v[1]+W[10]*v[2]+W[14];
      const gi = Math.floor((x + half) / cell), gj = Math.floor((z + half) / cell);
      if (gi >= 0 && gj >= 0 && gi < N && gj < N && occ[gj][gi] !== 'B') occ[gj][gi] = tag;
    }
  }
}
writeFileSync(out, JSON.stringify({ ox: ox - half, oz: oz - half, cell, rows: occ.map(r => r.join('')) }));
console.log('ok');

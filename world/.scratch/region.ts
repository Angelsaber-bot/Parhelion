import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { writeFileSync } from 'node:fs';
await MeshoptDecoder.ready;
const [name, ox, oz] = [process.argv[2], Number(process.argv[3]), Number(process.argv[4])];
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const half = 360, cell = 2, N = half * 2 / cell;
const occ: string[][] = Array.from({ length: N }, () => new Array(N).fill('.'));
const hgt: number[][] = Array.from({ length: N }, () => new Array(N).fill(-99));
function each(doc: any, fn: (name: string, x: number, y: number, z: number) => void) {
  for (const n of doc.getRoot().listNodes()) { const m = n.getMesh(); if (!m) continue; const W = n.getWorldMatrix(); const v = [0, 0, 0];
    for (const p of m.listPrimitives()) { const a = p.getAttribute('POSITION'); if (!a) continue; for (let i = 0; i < a.getCount(); i++) { a.getElement(i, v);
      fn(n.getName(), W[0]*v[0]+W[4]*v[1]+W[8]*v[2]+W[12], W[1]*v[0]+W[5]*v[1]+W[9]*v[2]+W[13], W[2]*v[0]+W[6]*v[1]+W[10]*v[2]+W[14]); } } }
}
const core = await io.read(`public/assets/${name}.core.glb`);
each(core, (n, x, y, z) => { if (n !== 'COL_Terrain') return; const i = Math.round((x + half) / cell), j = Math.round((z + half) / cell); if (i >= 0 && j >= 0 && i < N && j < N) hgt[j][i] = Math.max(hgt[j][i], y); });
// fill gaps
for (let pass = 0; pass < 6; pass++) for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) if (hgt[j][i] === -99) { const nb = [[1,0],[-1,0],[0,1],[0,-1]].map(([a,b]) => hgt[j+b]?.[i+a]).filter(v => v !== undefined && v !== -99) as number[]; if (nb.length) hgt[j][i] = nb.reduce((s, v) => s + v, 0) / nb.length; }
const vis = await io.read(`public/assets/${name}.visual.glb`);
const tags = new Set<string>();
each(vis, (n, x, y, z) => { tags.add(n); const tag = /Trunk|Tree|Palm|Pine|Bamboo|Sakura/i.test(n) && !/Leaves|Leaf|Canopy|Fronds/i.test(n) ? 'T' : /Bush|Flower|Grass|Glow|Leaves|Leaf|Canopy|Fronds|Water|Sky/i.test(n) ? null : 'B';
  if (!tag) return; const i = Math.floor((x + half) / cell), j = Math.floor((z + half) / cell); if (i < 0 || j < 0 || i >= N || j >= N) return;
  if (tag === 'B' && y < hgt[j][i] + .5) return; if (occ[j][i] !== 'B') occ[j][i] = tag; });
writeFileSync(`/tmp/claude-0/${name}_region.json`, JSON.stringify({ ox: ox - half, oz: oz - half, cell, rows: occ.map(r => r.join('')), h: hgt.map(r => r.map(v => Math.round(v * 10) / 10)) }));
console.log([...tags].join(' | '));

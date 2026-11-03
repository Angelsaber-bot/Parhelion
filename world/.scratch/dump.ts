import { CHESTS, FEATHERS, PUZZLES, TRIALS, CAMPS, STATUES } from '../src/exploration/catalog';
const out: [string, number, number, number][] = [];
for (const c of CHESTS) out.push([`chest:${c.id}`, c.p[0], c.p[1], 1.2]);
for (const f of FEATHERS) if (f.y === undefined) out.push([`feather:${f.id}`, f.p[0], f.p[1], .8]);
for (const s of STATUES) out.push([`statue:${s.id}`, s.p[0], s.p[1], 3.2]);
for (const p of PUZZLES) { out.push([`src:${p.id}`, ...p.source.p, 1.5]); out.push([`recv:${p.id}`, ...p.receiver, 1.5]); p.prisms.forEach((q, i) => out.push([`prism:${p.id}${i}`, ...q.p, q.raise ? 2.6 : 1.4])); for (const b of p.blockers) out.push([`block:${p.id}`, ...b.p, b.r]); }
for (const t of TRIALS) { out.push([`stele:${t.id}`, ...t.stele, 1.8]); t.orbs.forEach((o, i) => { if (o.y === undefined) out.push([`orb:${t.id}${i}`, ...o.p, .8]); }); }
for (const c of CAMPS) out.push([`camp:${c.id}`, ...c.anchor, 14]);
console.log(JSON.stringify(out));
import { solvePuzzle, traceBeam } from '../src/exploration/catalog';
const segs: Record<string, [number, number][]> = {};
for (const p of PUZZLES) segs[p.id] = traceBeam(p, solvePuzzle(p)[0]).nodes.map(n => [n.p[0], n.p[1]]);
console.error(JSON.stringify(segs));

import { readFileSync, writeFileSync } from 'node:fs';
import { solvePuzzle, traceBeam, type PrismPuzzleDef } from '../src/exploration/catalog';
type L = [string, string];
const TEMPL: Record<string, { S: [number, number]; P: [number, number][]; R: [number, number]; B: [number, number][]; dir: number; raise?: number }> = {
  L2: { S: [0, 0], P: [[20, 0], [20, 24]], R: [0, 24], B: [], dir: 0 },
  Z3: { S: [0, 0], P: [[-20, 0], [-40, 20], [-20, 40]], R: [0, 40], B: [], dir: 4 },
  C4: { S: [0, 0], P: [[-30, 0], [-30, 40], [-10, 60], [-10, 80]], R: [10, 60], B: [[0, 60]], dir: 4, raise: 1 },
};
const N = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const region: string = N.region, file = `world_${region === 'alpha' ? 'alpha' : region}`;
const plan = JSON.parse(readFileSync(`/tmp/claude-0/plan_${file}.json`, 'utf8'));
const trials = JSON.parse(readFileSync(`/tmp/claude-0/trials_${file}.json`, 'utf8'));
const q = (s: unknown) => JSON.stringify(s);
const lines: string[] = [];
lines.push(`/** ${N.title[0]} exploration content — positions generated against map occupancy (trees/buildings) and terrain. */`);
lines.push(`import type { ChestDef, FeatherDef, StatueDef, PrismPuzzleDef, TrialDef, CampDef, DomainDef } from '../catalog';`);
const R = q(region);
// puzzles
const puzzles: string[] = [];
const chests: string[] = [], feathers: string[] = [], camps: string[] = [], domains: string[] = [], statues: string[] = [], trialOut: string[] = [];
for (const [key, v] of Object.entries(plan) as [string, any][]) {
  const [kind, id] = key.split(':'); const x = v[1], z = v[2];
  if (kind === 'puzzle') {
    const t = TEMPL[v[3]], flip = v[4] as number, f = (p: [number, number]): [number, number] => [x + flip * p[0], z + p[1]];
    const mirror = (k: number) => flip === 1 ? k : ((4 - k) % 8 + 8) % 8;
    const def: PrismPuzzleDef = { id, region: region as any, title: N.puzzles[id].title, range: v[3] === 'C4' ? 45 : 30, source: { p: f(t.S), dir: mirror(t.dir) },
      prisms: t.P.map((p, i) => ({ p: f(p), start: 0, ...(t.raise === i ? { raise: 10 } : {}) })), receiver: f(t.R), blockers: t.B.map(b => ({ p: f(b), r: 1.3, h: 6 })), hint: N.puzzles[id].hint };
    const sol = solvePuzzle(def); if (sol.length !== 1) throw new Error(`${id} solutions ${sol.length}`);
    // starts: each prism points somewhere useless, never the solution
    const starts = sol[0].map((k, i) => (k + 3 + i * 2) % 8);
    const d2 = { ...def, prisms: def.prisms.map((p, i) => ({ ...p, start: starts[i] })) };
    if (traceBeam(d2, starts).solved) throw new Error('start solved ' + id);
    puzzles.push(`  ${q(d2)},`);
    const rp = f(t.R), off: [number, number] = [rp[0] + 6 * flip, rp[1] + 5];
    chests.push(`  { id: '${region}_puzzle_${id}', region: ${R}, p: ${q(off)}, tier: '${v[3] === 'C4' ? 'luxurious' : 'precious'}', requires: 'xp_puzzle_${id}' },`);
  } else if (kind === 'camp') {
    const c = N.camps[id];
    camps.push(`  { id: '${id}', region: ${R}, title: ${q(c.title)}, anchor: [${x}, ${z}], waves: ${q(c.waves)} },`);
    chests.push(`  { id: '${region}_camp_${id}', region: ${R}, p: [${x}, ${z}], tier: 'precious', requires: 'xp_camp_${id}' },`);
  } else if (kind === 'domain') {
    const d = N.domain; const t = TEMPL.L2;
    domains.push(`  { id: '${id}', region: ${R}, title: ${q(d.title)}, center: [${x}, ${z}], radius: 19, story: ${q(d.story)} },`);
    const ring = { id, region, title: d.sealTitle, range: 20, source: { p: [x - 14, z], dir: 2 }, prisms: [{ p: [x - 14, z + 14], start: 6 }, { p: [x, z - 14], start: 0 }, { p: [x, z + 14], start: 2 }, { p: [x + 14, z], start: 1 }], receiver: [x - 14, z - 14], blockers: [{ p: [x, z], r: 2.6, h: 6 }], hint: d.hint };
    puzzles.push(`  ${q(ring)},`); void t;
    camps.push(`  { id: '${id}', region: ${R}, title: ${q(d.campTitle)}, anchor: [${x}, ${z}], requires: 'xp_puzzle_${id}', style: 'domain', waves: ${q(d.waves)} },`);
    chests.push(`  { id: '${region}_domain_${id}', region: ${R}, p: [${x}, ${z + 9}], tier: 'luxurious', requires: 'xp_camp_${id}' },`);
  } else if (kind === 'statue') statues.push(`  { id: '${id}', region: ${R}, p: [${x}, ${z}], yaw: ${N.statueYaw ?? 0}, title: ${q(N.statueTitle)} },`);
  else if (kind === 'stele') {
    const t = N.trials[id], tr = trials[id];
    const orbs = tr.orbs.filter((o: any) => !('y' in o) || o.y > 2.5);
    trialOut.push(`  { id: '${id}', region: ${R}, title: ${q(t.title)}, stele: [${x}, ${z}], seconds: ${tr.seconds}, orbs: ${q(orbs)}, hint: ${q(t.hint)} },`);
    const last = orbs[orbs.length - 1].p;
    chests.push(`  { id: '${region}_trial_${id}', region: ${R}, p: [${x + 3}, ${z + 3}], tier: 'exquisite', requires: 'xp_trial_${id}' },`); void last;
  } else if (kind === 'chest') { const tier = (N.exquisite ?? []).includes(id) ? 'exquisite' : 'common'; chests.push(`  { id: '${region}_${id}', region: ${R}, p: [${x}, ${z}], tier: '${tier}' },`); }
  else if (kind === 'feather') feathers.push(`  { id: '${region}_${id}', region: ${R}, p: [${x}, ${z}] },`);
}
const U = region.toUpperCase();
lines.push(`export const ${U}_STATUES: readonly StatueDef[] = [\n${statues.join('\n')}\n];`);
lines.push(`export const ${U}_PUZZLES: readonly PrismPuzzleDef[] = [\n${puzzles.join('\n')}\n];`);
lines.push(`export const ${U}_TRIALS: readonly TrialDef[] = [\n${trialOut.join('\n')}\n];`);
lines.push(`export const ${U}_CAMPS: readonly CampDef[] = [\n${camps.join('\n')}\n];`);
lines.push(`export const ${U}_DOMAINS: readonly DomainDef[] = [\n${domains.join('\n')}\n];`);
lines.push(`export const ${U}_CHESTS: readonly ChestDef[] = [\n${chests.join('\n')}\n];`);
lines.push(`export const ${U}_FEATHERS: readonly FeatherDef[] = [\n${feathers.join('\n')}\n];`);
writeFileSync(`src/exploration/content/${region}.ts`, lines.join('\n') + '\n');
console.log('wrote', region, puzzles.length, chests.length, feathers.length);

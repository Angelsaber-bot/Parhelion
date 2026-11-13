// Refresh the frozen map baselines of the four rebuilt regions (britain, blacksail, winter, kyoto)
// from the current reviewed assets. Alpha keeps its historical baseline and exception chain.
//   node --import tsx validation/refresh-map-baselines.ts <commit>
// Each file is regenerated exactly the way its test reads it, so the tests then require
// exact equality with the refreshed state and still run their structural checks.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { snapshot } from './map-polish/snapshot.mjs';
import { countPreparedArt } from './map-polish/chunk-budget.ts';
import { unseatedGlbPath } from './join-band-seating.ts';
import { collisionSnapshot as britainCollision } from './kingdom-valley/collision-snapshot.ts';
import { collisionSnapshot as blacksailCollision } from './blacksail/collision-snapshot.ts';
import { collisionSnapshot as winterCollision } from './winter/collision-snapshot.ts';

const commit = process.argv[2];
if (!commit) throw new Error('usage: refresh-map-baselines.ts <commit>');
const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const read = (p: string) => JSON.parse(readFileSync(here(p), 'utf8'));
// Keep each file's existing indentation so the diff shows only real changes.
const write = (p: string, v: unknown) => { const indent = /\n( +)/.exec(readFileSync(here(p), 'utf8'))?.[1].length ?? 1; writeFileSync(here(p), JSON.stringify(v, null, indent) + '\n'); };
const regions = ['britain', 'blacksail', 'winter', 'kyoto'] as const;
const assets = here('../public/assets/');
const layout = (r: string) => read(`../public/assets/world_${r}.layout.json`);

// 1. Per-region contract files (blacksail/winter/kyoto): only the keys each file already holds.
for (const r of ['blacksail', 'winter', 'kyoto']) {
  const file = `./${r}/baseline-contract.json`, old = read(file), now = layout(r);
  write(file, Object.fromEntries(Object.keys(old).map(k => [k, now[k]])));
}
// 2. Five-world layout baseline: alpha untouched.
{
  const file = './kingdom-valley/five-world-baseline.json', old = read(file);
  for (const r of regions) old[r].layout = layout(r);
  old.refreshed = { commit, regions: [...regions], reason: 'continental rebuild and reviewed chapter redesigns superseded the 36936478 layouts' };
  write(file, old);
}
// 3. map-polish: a dated refreshed snapshot per rebuilt region; alpha stays historical.
{
  const file = './map-polish/baseline.json', old = read(file);
  old.refreshed = { commit, regions: {} as Record<string, unknown>, chunks: {} as Record<string, unknown> };
  for (const r of regions) { old.refreshed.regions[r] = await snapshot(assets, r, { unseat: true }); old.refreshed.chunks[r] = await countPreparedArt(assets, r); }
  write(file, old);
}
// 4. Ordered collision baselines read by the export tests.
const glb = (r: string) => here(`../public/assets/world_${r}.glb`);
write('./kingdom-valley/britain-baseline-collision.json', await britainCollision(await unseatedGlbPath(glb('britain'), 'britain')));
write('./blacksail/baseline-collision.json', await blacksailCollision(await unseatedGlbPath(glb('blacksail'), 'blacksail')));
write('./winter/baseline-collision.json', await winterCollision(await unseatedGlbPath(glb('winter'), 'winter')));
console.log(`refreshed map baselines at ${commit}`);

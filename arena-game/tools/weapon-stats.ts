// Summarise human-only Arena weapon telemetry.
//   npx tsx tools/weapon-stats.ts [--hours 6 | --since 2026-11-12T20:00] [--source offline|online|local]
//                                 [--host localhost] [--file arena-stats.jsonl] [--server wss://…/arena] [--json]
// Reads the public Worker's GET /stats unless --file points at a local-server JSONL file.
import { readFileSync } from 'node:fs';
import { CHARACTERS, TICK_HZ, WEAPONS } from '../shared/content.ts';
import { PUBLIC_SERVER } from '../shared/protocol.ts';
import { STAT_BUCKETS, STAT_DIST, type MatchRecord, type WeaponLine } from '../shared/weaponStats.ts';

const args = process.argv.slice(2);
const opt = (name: string) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const since = opt('since') ? Date.parse(opt('since')!) : Date.now() - Number(opt('hours') ?? 24) * 3600_000;

async function load(): Promise<MatchRecord[]> {
  const file = opt('file');
  if (file) return readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as MatchRecord);
  const url = (opt('server') ?? PUBLIC_SERVER).replace(/^ws/, 'http').replace(/\/arena$/, '/stats');
  const out: MatchRecord[] = [];
  for (let from = since; ;) {
    const res = await fetch(`${url}?since=${from}&limit=1000`);
    if (!res.ok) throw new Error(`GET /stats ${res.status}`);
    const { records } = await res.json() as { records: MatchRecord[] };
    out.push(...records);
    if (records.length < 1000) return out;
    from = records[records.length - 1].at + 1;
  }
}

const sum = (a: WeaponLine, b: WeaponLine) => {
  for (const k of ['held', 'shots', 'hits', 'heads', 'pellets', 'pelletHits', 'shieldHits', 'damage', 'kills', 'headKills', 'wild'] as const) a[k] += b[k];
  b.aimed.forEach(([s, h], i) => { a.aimed[i][0] += s; a.aimed[i][1] += h; });
  b.killDist.forEach((n, i) => { a.killDist[i] += n; });
  a.ttk.push(...b.ttk);
};
const blank = (): WeaponLine => ({ held: 0, shots: 0, hits: 0, heads: 0, pellets: 0, pelletHits: 0, shieldHits: 0, damage: 0, kills: 0, headKills: 0,
  aimed: Array.from({ length: STAT_BUCKETS }, () => [0, 0] as [number, number]), wild: 0, killDist: Array(STAT_BUCKETS).fill(0), ttk: [] });
const pct = (a: number, b: number) => b ? `${Math.round(100 * a / b)}%` : '-';
const median = (xs: number[]) => { if (!xs.length) return NaN; const s = [...xs].sort((a, b) => a - b); return s[s.length >> 1]; };

const records = (await load()).filter((r) => r.at >= since && (!opt('source') || r.source === opt('source')) && (!opt('host') || r.host === opt('host')));
const byWeapon = new Map<string, WeaponLine>();
const deathsBy: Record<string, number> = {};
let kills = 0, deaths = 0, frag = 0, ticks = 0, wins = 0, finished = 0;
for (const r of records) {
  ticks += r.ticks;
  if (r.result === 'finished') finished++;
  for (const h of r.humans) {
    kills += h.kills; deaths += h.deaths; frag += h.fragKills;
    if (r.result === 'finished' && r.winner === h.team) wins++;
    for (const [k, n] of Object.entries(h.deathsBy)) deathsBy[k] = (deathsBy[k] ?? 0) + n;
    for (const [id, w] of Object.entries(h.weapons)) { if (!byWeapon.has(id)) byWeapon.set(id, blank()); sum(byWeapon.get(id)!, w); }
  }
}
if (args.includes('--json')) { console.log(JSON.stringify({ records: records.length, byWeapon: Object.fromEntries(byWeapon), deathsBy }, null, 1)); process.exit(0); }

console.log(`${records.length} rounds (${finished} finished, ${wins} human wins), ${(ticks / TICK_HZ / 60).toFixed(1)} min live; human K/D ${kills}/${deaths}, frag kills ${frag}`);
const sources = new Map<string, number>(); for (const r of records) { const k = `${r.source}${r.host ? '@' + r.host : ''} bots:${r.botSkill} ${r.layout} ${r.map}`; sources.set(k, (sources.get(k) ?? 0) + 1); }
for (const [k, n] of sources) console.log(`  ${n} × ${k}`);
const chars = new Map<number, number>(); for (const r of records) for (const h of r.humans) chars.set(h.char, (chars.get(h.char) ?? 0) + 1);
console.log(`  characters: ${[...chars].map(([c, n]) => `${CHARACTERS[c]?.name ?? c} ${n}`).join(', ')}`);
console.log('\nweapon      held   shots  hit%  head%  pellet%  dmg/shot  dmg/min  kills  headK  median TTK  shieldHits  wild');
for (const def of WEAPONS) {
  const w = byWeapon.get(def.id);
  if (!w) continue;
  const minutes = w.held / TICK_HZ / 60;
  console.log([
    def.id.padEnd(10), `${minutes.toFixed(1)}m`.padStart(6), String(w.shots).padStart(7), pct(w.hits, w.shots).padStart(5), pct(w.heads, w.hits).padStart(6),
    (def.pellets > 1 ? pct(w.pelletHits, w.pellets) : '').padStart(8), (w.shots ? (w.damage / w.shots).toFixed(1) : '-').padStart(9),
    (minutes ? (w.damage / minutes).toFixed(0) : '-').padStart(8), String(w.kills).padStart(6), String(w.headKills).padStart(6),
    (w.ttk.length ? `${(median(w.ttk) / TICK_HZ).toFixed(2)}s (${w.ttk.length})` : '-').padStart(11), String(w.shieldHits).padStart(11), pct(w.wild, w.shots).padStart(5),
  ].join(' '));
}
const edges = STAT_DIST.map((d, i) => `${i ? STAT_DIST[i - 1] : 0}-${d}`).concat(`${STAT_DIST.at(-1)}+`);
console.log(`\naimed hit% by distance (m)   ${edges.map((e) => e.padStart(10)).join('')}`);
for (const def of WEAPONS) {
  const w = byWeapon.get(def.id);
  if (!w || def.kind !== 'gun') continue;
  console.log(`${def.id.padEnd(28)} ${w.aimed.map(([s, h]) => (s ? `${pct(h, s)} /${s}` : '-').padStart(10)).join('')}`);
}
console.log(`\nkills by distance (m)        ${edges.map((e) => e.padStart(10)).join('')}`);
for (const def of WEAPONS) {
  const w = byWeapon.get(def.id);
  if (!w || !w.kills) continue;
  console.log(`${def.id.padEnd(28)} ${w.killDist.map((n) => String(n || '-').padStart(10)).join('')}`);
}
console.log(`\nhuman deaths by killer weapon: ${Object.entries(deathsBy).map(([k, n]) => `${k} ${n}`).join(', ') || '-'}`);

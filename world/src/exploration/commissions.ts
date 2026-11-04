/**
 * 日晕委托：每天四件委托，分布在玩家已经踏足的地区。
 * Pure rules: the day's set is chosen from the regions the player has reached; every commission
 * pays crystals once, and clearing all four pays a daily bonus.
 */
import type { Localized, RegionId } from '../settlements/types';
import { CAMPS, COMMISSION, TRIALS, REGION_NAMES, regionExploration } from './catalog';

export { COMMISSION, commissionCrystals } from './catalog';
export type CommissionKind = 'camp' | 'trial' | 'hunt';
export interface Commission {
  /** slot 0–3 of the day */
  readonly n: number;
  readonly kind: CommissionKind;
  readonly region: RegionId;
  /** camp or trial id; the region for a hunt */
  readonly target: string;
  readonly title: Localized;
  readonly brief: Localized;
  /** where the map pin goes; hunts have none */
  readonly at?: readonly [number, number];
}

const REGIONS: readonly RegionId[] = ['alpha', 'britain', 'blacksail', 'winter', 'kyoto'];
export const flagCommission = (day: string, n: number) => `xp_comm_${day}_${n}`;
export const flagCommissionBonus = (day: string) => `xp_comm_${day}_bonus`;
export const flagHuntKill = (day: string, n: number, i: number) => `xp_commkill_${day}_${n}_${i}`;

/** Local calendar day, so the board turns over at the player's midnight. */
export function dayKey(date = new Date()) {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
}

/** The valley is always open; every other era counts once the player has found anything there. */
export function reachedRegions(done: ReadonlySet<string>): RegionId[] {
  return REGIONS.filter(r => r === 'alpha' || regionExploration(r, done).done > 0);
}

function rng(seed: string) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
}

const regionName = (r: RegionId): Localized => REGION_NAMES[r] ?? [r, r];

function campCommission(n: number, id: string): Commission {
  const c = CAMPS.find(x => x.id === id)!;
  return { n, kind: 'camp', region: c.region, target: id, at: c.anchor,
    title: [`再集结 · ${c.title[0]}`, `Regrouped · ${c.title[1]}`],
    brief: ['敌人重新占据了据点，再次肃清它。', 'The enemy has retaken the outpost. Clear it again.'] };
}
function trialCommission(n: number, id: string): Commission {
  const t = TRIALS.find(x => x.id === id)!;
  return { n, kind: 'trial', region: t.region, target: id, at: t.stele,
    title: [`时层回响 · ${t.title[0]}`, `Echo Run · ${t.title[1]}`],
    brief: ['在时限内完成这道时层挑战。', 'Finish this time echo before the clock runs out.'] };
}
function huntCommission(n: number, region: RegionId): Commission {
  const [zh, en] = regionName(region);
  return { n, kind: 'hunt', region, target: region,
    title: [`清剿游荡者 · ${zh}`, `Clear the Roamers · ${en}`],
    brief: [`在${zh}击败 ${COMMISSION.hunt} 名野外敌人。`, `Defeat ${COMMISSION.hunt} wild enemies in ${en}.`] };
}

/** The day's board: two outposts, one time echo and one hunt, spread over as many regions as the player has reached. */
export function dailyCommissions(day: string, regions: readonly RegionId[]): Commission[] {
  const pool = regions.length ? regions : ['alpha' as RegionId];
  const random = rng(`parhelion-commission-${day}-${pool.join('.')}`);
  const pick = <T>(list: readonly T[]) => list[Math.floor(random() * list.length)];
  const used = new Set<string>(), usedRegions = new Set<RegionId>();
  const choose = <T extends { id: string; region: RegionId }>(list: readonly T[]) => {
    const open = list.filter(x => pool.includes(x.region) && !used.has(x.id));
    if (!open.length) return null;
    const fresh = open.filter(x => !usedRegions.has(x.region));
    const chosen = pick(fresh.length ? fresh : open);
    used.add(chosen.id); usedRegions.add(chosen.region); return chosen;
  };
  const fieldCamps = CAMPS.filter(c => (c.style ?? 'camp') === 'camp' && !c.requires);
  const out: Commission[] = [];
  for (const kind of ['camp', 'trial', 'camp', 'hunt'] as const) {
    const n = out.length;
    const chosen = kind === 'camp' ? choose(fieldCamps) : kind === 'trial' ? choose(TRIALS) : null;
    if (chosen) { out.push(kind === 'camp' ? campCommission(n, chosen.id) : trialCommission(n, chosen.id)); continue; }
    // hunts: a region not yet on today's board if there is one, never two hunts in one region
    const noHunt = pool.filter(r => !out.some(c => c.kind === 'hunt' && c.region === r));
    const fresh = noHunt.filter(r => !usedRegions.has(r));
    const region = pick(fresh.length ? fresh : noHunt.length ? noHunt : pool);
    usedRegions.add(region); out.push(huntCommission(n, region));
  }
  return out;
}

/** Today's board from the regions reached so far. Nothing is written for merely looking: the board
 * is kept for the session and only recomputed at midnight; completions are stored by slot, so a
 * reload after reaching a new era can reshuffle unfinished slots but never pays a slot twice. */
export function todaysBoard(done: Set<string>, day = dayKey()): { day: string; list: Commission[] } {
  // half-finished hunts belong to their own day
  for (const flag of [...done]) if (flag.startsWith('xp_commkill_') && !flag.startsWith(`xp_commkill_${day}_`)) done.delete(flag);
  return { day, list: dailyCommissions(day, reachedRegions(done)) };
}

export function huntProgress(done: ReadonlySet<string>, day: string, n: number) {
  let k = 0; while (k < COMMISSION.hunt && done.has(flagHuntKill(day, n, k))) k++; return k;
}
export const commissionDone = (done: ReadonlySet<string>, day: string, n: number) => done.has(flagCommission(day, n));

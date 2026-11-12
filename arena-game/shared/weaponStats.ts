// Human-only weapon telemetry for balance work. The authoritative Match feeds this collector;
// nothing here changes rules, snapshots or the wire protocol. Bots are never measured as
// shooters (they only appear as context and as killers in a human's deathsBy). Records carry no
// names: team, character, loadout and per-weapon numbers only.

import { CHARACTERS, GUN_IDS, MELEE_IDS, WEAPONS, isLoadout, type Loadout, type Team, type TeamLayout, type UtilityId, UTILITY_IDS } from './content.ts';

export const STATS_VERSION = 1;
/** Upper edges (m) of the distance buckets; the last bucket is open-ended (60 m+). */
export const STAT_DIST = [5, 10, 15, 25, 40, 60] as const;
export const STAT_BUCKETS = STAT_DIST.length + 1;
export function distBucket(d: number): number {
  let i = 0;
  while (i < STAT_DIST.length && d >= STAT_DIST[i]) i++;
  return i;
}
/** Half-angle (rad) in which a visible enemy counts as the one a shot was aimed at (~8°). */
export const AIM_CONE = 0.14;
const TTK_KEEP = 60;

export interface WeaponLine {
  /** Live ticks spent alive holding this weapon. */
  held: number;
  /** Trigger pulls that fired, or melee swings that started. */
  shots: number;
  /** Shots (or swings) that struck at least one enemy player. */
  hits: number;
  /** Shots with at least one head hit. */
  heads: number;
  pellets: number;
  pelletHits: number;
  shieldHits: number;
  /** HP actually removed from enemies (after melee-holder reduction, never past 0). */
  damage: number;
  kills: number;
  headKills: number;
  /** Guns only, per distance bucket: [shots with a visible enemy inside the aim cone, of those that hit]. */
  aimed: [number, number][];
  /** Shots with no visible enemy inside the aim cone (pre-fire, spraying, far misses). */
  wild: number;
  /** Kills per distance bucket. */
  killDist: number[];
  /** Ticks from this player's first damage on a victim's life to the kill (latest 60). */
  ttk: number[];
}

export interface HumanLine {
  team: Team;
  char: number;
  loadout: Loadout;
  utility: UtilityId;
  kills: number;
  deaths: number;
  fragKills: number;
  damageTaken: number;
  /** Deaths by the killer's weapon id ('frag' for grenades), bot or human killers alike. */
  deathsBy: Record<string, number>;
  weapons: Record<string, WeaponLine>;
}

export type StatsSource = 'offline' | 'online' | 'local';
export interface StatsMeta {
  source: StatsSource;
  /** Bot skill filling the room ('none' without bots). */
  botSkill: string;
  /** Page host for offline games (localhost vs the public site); never a player identity. */
  host?: string;
}

export interface MatchRecord {
  v: number;
  at: number;
  source: StatsSource;
  host?: string;
  map: string;
  layout: TeamLayout;
  botSkill: string;
  ticks: number;
  result: 'finished' | 'abandoned';
  winner: Team | 'draw' | null;
  score: Record<Team, number>;
  humans: HumanLine[];
  bots: { team: Team; char: number; loadout: Loadout }[];
}

export interface StatsPlayer {
  id: string;
  team: Team;
  char: number;
  loadout: Loadout;
  utility: UtilityId;
  bot: boolean;
}

export interface ShotStat {
  pellets: number;
  pelletHits: number;
  head: boolean;
  shield: boolean;
  /** Nearest enemy-player hit distance, or null when nothing was struck. */
  hitDist: number | null;
  /** Distance to the visible enemy the shot was aimed at, or null for a wild shot. */
  aimDist: number | null;
}

const weaponId = (wi: number): string => WEAPONS[wi]?.id ?? 'frag';

function newWeaponLine(): WeaponLine {
  return {
    held: 0, shots: 0, hits: 0, heads: 0, pellets: 0, pelletHits: 0, shieldHits: 0, damage: 0, kills: 0, headKills: 0,
    aimed: Array.from({ length: STAT_BUCKETS }, () => [0, 0] as [number, number]), wild: 0,
    killDist: Array.from({ length: STAT_BUCKETS }, () => 0), ttk: [],
  };
}

export class StatsCollector {
  /** null disables collection (training range, tools, tests that don't opt in). */
  meta: StatsMeta | null = null;
  private active = false;
  private startTick = 0;
  private humans = new Map<string, HumanLine>();
  private bots = new Map<string, MatchRecord['bots'][number]>();
  private bot = new Map<string, boolean>();
  /** `${attacker}>${victim}` → tick of the attacker's first damage on the victim's current life. */
  private first = new Map<string, number>();
  private done: MatchRecord[] = [];

  get on(): boolean { return this.active && this.meta !== null; }

  begin(tick: number, players: Iterable<StatsPlayer>): void {
    this.humans.clear(); this.bots.clear(); this.bot.clear(); this.first.clear();
    this.active = this.meta !== null;
    this.startTick = tick;
    if (this.active) for (const p of players) this.join(p);
  }

  join(p: StatsPlayer): void {
    if (!this.on) return;
    this.bot.set(p.id, p.bot);
    if (p.bot) this.bots.set(p.id, { team: p.team, char: p.char, loadout: [...p.loadout] as Loadout });
    else if (!this.humans.has(p.id)) {
      this.humans.set(p.id, {
        team: p.team, char: p.char, loadout: [...p.loadout] as Loadout, utility: p.utility,
        kills: 0, deaths: 0, fragKills: 0, damageTaken: 0, deathsBy: {}, weapons: {},
      });
    }
  }

  private weapon(id: string, wi: number): WeaponLine | null {
    const h = this.on ? this.humans.get(id) : undefined;
    if (!h || !WEAPONS[wi]) return null;
    return h.weapons[WEAPONS[wi].id] ??= newWeaponLine();
  }

  held(id: string, wi: number): void {
    const w = this.weapon(id, wi);
    if (w) w.held++;
  }

  shot(id: string, wi: number, s: ShotStat): void {
    const w = this.weapon(id, wi);
    if (!w) return;
    w.shots++;
    w.pellets += s.pellets; w.pelletHits += s.pelletHits;
    if (s.hitDist !== null) w.hits++;
    if (s.head) w.heads++;
    if (s.shield) w.shieldHits++;
    // Bucket by the aimed enemy's centre so hits and misses share one ruler; hits fall back to contact.
    const d = s.aimDist ?? s.hitDist;
    if (d === null) w.wild++;
    else { const b = w.aimed[distBucket(d)]; b[0]++; if (s.hitDist !== null) b[1]++; }
  }

  /** A melee swing that left the hand. */
  swing(id: string, wi: number): void {
    const w = this.weapon(id, wi);
    if (w) w.shots++;
  }

  /** The swing's contact: an enemy player or a shield. */
  swingHit(id: string, wi: number, kind: 'player' | 'shield'): void {
    const w = this.weapon(id, wi);
    if (!w) return;
    if (kind === 'player') w.hits++;
    else w.shieldHits++;
  }

  damage(attacker: string, victim: string, wi: number, applied: number, head: boolean, killed: boolean, tick: number, dist: number | null): void {
    if (!this.on) return;
    const key = `${attacker}>${victim}`;
    if (!this.first.has(key)) this.first.set(key, tick);
    const a = this.humans.get(attacker), v = this.humans.get(victim);
    if (v) v.damageTaken += applied;
    const w = this.weapon(attacker, wi);
    if (w) w.damage += applied;
    if (!killed) return;
    if (a) { a.kills++; if (!WEAPONS[wi]) a.fragKills++; }
    if (w) {
      w.kills++;
      if (head) w.headKills++;
      if (dist !== null) w.killDist[distBucket(dist)]++;
      w.ttk.push(tick - this.first.get(key)!);
      if (w.ttk.length > TTK_KEEP) w.ttk.shift();
    }
    if (v) { v.deaths++; const k = weaponId(wi); v.deathsBy[k] = (v.deathsBy[k] ?? 0) + 1; }
    this.forgetVictim(victim);
  }

  /** A new life: earlier damage no longer starts its time-to-kill. */
  forgetVictim(victim: string): void {
    for (const key of this.first.keys()) if (key.endsWith(`>${victim}`)) this.first.delete(key);
  }

  end(tick: number, result: MatchRecord['result'], winner: MatchRecord['winner'], score: Record<Team, number>, map: string, layout: TeamLayout): void {
    if (!this.on) return;
    this.active = false;
    const humans = [...this.humans.values()];
    // A round nobody human fired in carries nothing to measure.
    if (!humans.some((h) => Object.values(h.weapons).some((w) => w.shots > 0 || w.held > 0))) return;
    const m = this.meta!;
    this.done.push({
      v: STATS_VERSION, at: Date.now(), source: m.source, ...(m.host ? { host: m.host } : {}), map, layout, botSkill: m.botSkill,
      ticks: tick - this.startTick, result, winner, score: { ...score }, humans, bots: [...this.bots.values()],
    });
  }

  /** Finished records, oldest first; each is returned once. */
  drain(): MatchRecord[] {
    const out = this.done;
    this.done = [];
    return out;
  }
}

// ---------- validation for records arriving over the network ----------

const int = (v: unknown, hi = 1e9): number => typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(hi, Math.round(v))) : 0;
const str = (v: unknown, max: number): string => typeof v === 'string' ? v.slice(0, max).replace(/[^\w.:-]/g, '') : '';
const team = (v: unknown): Team => v === 'B' ? 'B' : 'A';
const ints = (v: unknown, n: number): number[] => Array.from({ length: n }, (_, i) => int(Array.isArray(v) ? v[i] : 0));
const KNOWN_WEAPONS = new Set<string>([...GUN_IDS, ...MELEE_IDS]);
const KNOWN_DEATHS = new Set<string>([...KNOWN_WEAPONS, 'frag']);

function cleanWeapon(raw: unknown): WeaponLine {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const aimed = Array.isArray(r.aimed) ? r.aimed : [];
  return {
    held: int(r.held), shots: int(r.shots), hits: int(r.hits), heads: int(r.heads), pellets: int(r.pellets), pelletHits: int(r.pelletHits),
    shieldHits: int(r.shieldHits), damage: int(r.damage), kills: int(r.kills), headKills: int(r.headKills),
    aimed: Array.from({ length: STAT_BUCKETS }, (_, i) => ints(aimed[i], 2) as [number, number]), wild: int(r.wild),
    killDist: ints(r.killDist, STAT_BUCKETS), ttk: (Array.isArray(r.ttk) ? r.ttk : []).slice(-TTK_KEEP).map((t) => int(t, 1e6)),
  };
}

function cleanLoadout(v: unknown): Loadout {
  return isLoadout(v) ? [v[0], v[1], v[2]] : ['lumen', 'corona', 'blade'];
}

/** Rebuild a record from known fields only, clamping every number. Returns null for junk. */
export function sanitizeRecord(raw: unknown, source: StatsSource): MatchRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (r.v !== STATS_VERSION || !Array.isArray(r.humans) || r.humans.length === 0 || r.humans.length > 4) return null;
  const humans: HumanLine[] = r.humans.map((h0) => {
    const h = (h0 && typeof h0 === 'object' ? h0 : {}) as Record<string, unknown>;
    const weapons: Record<string, WeaponLine> = {};
    if (h.weapons && typeof h.weapons === 'object') for (const [k, w] of Object.entries(h.weapons)) if (KNOWN_WEAPONS.has(k)) weapons[k] = cleanWeapon(w);
    const deathsBy: Record<string, number> = {};
    if (h.deathsBy && typeof h.deathsBy === 'object') for (const [k, n] of Object.entries(h.deathsBy)) if (KNOWN_DEATHS.has(k)) deathsBy[k] = int(n);
    return {
      team: team(h.team), char: Math.min(CHARACTERS.length - 1, int(h.char)), loadout: cleanLoadout(h.loadout),
      utility: UTILITY_IDS.includes(h.utility as UtilityId) ? h.utility as UtilityId : 'frag',
      kills: int(h.kills), deaths: int(h.deaths), fragKills: int(h.fragKills), damageTaken: int(h.damageTaken), deathsBy, weapons,
    };
  });
  const bots = (Array.isArray(r.bots) ? r.bots : []).slice(0, 4).map((b0) => {
    const b = (b0 && typeof b0 === 'object' ? b0 : {}) as Record<string, unknown>;
    return { team: team(b.team), char: Math.min(CHARACTERS.length - 1, int(b.char)), loadout: cleanLoadout(b.loadout) };
  });
  const score = (r.score && typeof r.score === 'object' ? r.score : {}) as Record<string, unknown>;
  const host = str(r.host, 64);
  return {
    v: STATS_VERSION, at: int(r.at, 1e14) || Date.now(), source, ...(host ? { host } : {}), map: str(r.map, 40),
    layout: r.layout === '1v2' || r.layout === '2v2' ? r.layout : '1v1', botSkill: str(r.botSkill, 12) || 'none',
    ticks: int(r.ticks, 1e7), result: r.result === 'finished' ? 'finished' : 'abandoned',
    winner: r.winner === 'A' || r.winner === 'B' || r.winner === 'draw' ? r.winner : null,
    score: { A: int(score.A, 1000), B: int(score.B, 1000) }, humans, bots,
  };
}

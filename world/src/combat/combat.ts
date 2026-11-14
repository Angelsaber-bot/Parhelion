import { worldGun, DEFAULT_GUN, gunDistanceMultiplier, type WorldGun } from '../weapons/worldArsenal';
import { resonanceLevel, resonanceMaxHp } from '../story/resonance';
import {regionAt} from '../map/regions';
import {adventureActive,adventureChapterComplete} from '../story/openWorldCampaign';
import {WORLD_RIFLE,rifleDistanceMultiplier} from '../core/worldBalance';
import { ECHO_WARDEN, chooseEchoWardenAttack, echoWardenTiming, echoWardenRadius, echoWardenDamage } from './echoWarden';
import { ENEMY_TACTICS, enemyRangedSpacing, enemyWalkTurns, hasEnemyPressureSlot } from './enemyTactics';
import { KNIGHT_TRIAL_ID, KNIGHT_TRIAL_CLEAR } from '../story/authoredEncounters';
import { bossAttackTiming, chooseBossAttack, bossAttackDamage } from './bossPatterns';
import { BOSS_HAZARDS, hazardContains, planBossHazards, type Hazard } from './bossHazards';
import { ERA_BOSS_REQUIREMENTS } from '../story/eraStories';
import { minibossProfile, activeSignature, eliteName, signatureCadence, ELITE_RALLY } from './minibosses';
import { ENEMY_ROLES, SHINOBI_BLINK, selectEnemyRole, type EnemyRole } from './enemyRoles';
/** Small, local World encounter simulation. No networking/Arena rules are changed. */
export interface Point3 { x: number; y: number; z: number }
export type EnemyKind = 'shade' | 'crystal' | 'king';
export type EnemyMode = 'idle' | 'chase' | 'windup' | 'recover' | 'stagger' | 'pacified' | 'dead';
export type CreatureKind = 'tide-limb' | 'stone-armour';
export interface SpawnPoint { id: string; kind: EnemyKind; p: Point3; miniboss?: string; role?: EnemyRole; creature?: CreatureKind; encounter?: 'akechi'; storyEncounter?: string; storyPattern?: 'echo-warden'; displayName?: readonly [string,string]; appearance?: 'samurai'|'ashigaru'|'musketeer'|'officer'|'sunward_guard'|'deck_raider' }
export interface Enemy extends SpawnPoint {
  home: Point3; hp: number; maxHp: number; mode: EnemyMode; timer: number;
  active: boolean; phase: 1 | 2; attack: 'sweep' | 'burst' | 'shot' | 'thrust'; target: Point3;
  attackCount: number; contactSequence: number; hitTime: number; role: EnemyRole; staggerCooldown: number; pacified: boolean; blinkCooldown?: number;
  /** An elite is performing its rarer signature move (see minibosses.ts). */
  signatureActive?: boolean;
  /** W08 最后方阵: the square's shield wall turns slowly; only its front blocks rifle fire. */
  squareYaw?: number;
  /** 最后方阵: hits the front rank can still absorb (four soldiers), and the drum-step clock. */
  squareGuard?: number; squareDrum?: number;
  /** Toughness damage built up toward a daze break (elites and chapter bosses only). */
  daze?: number; dazeIdle?: number; dazedFor?: number;
  /** Tide-Eater limb: its shell has cracked off and no longer halves damage. */
  shellBroken?: boolean;
}
const MODES = new Set(['idle', 'chase', 'windup', 'recover', 'stagger', 'dead']);
const ATTACKS = new Set(['sweep', 'burst', 'shot', 'thrust']);
export type CombatEvent =
  | { type: 'attackContact'; id: string; attack: Enemy['attack']; sequence: number; origin: Point3; target: Point3; radius: number; storyPattern?: 'echo-warden'; length?: number }
  | { type: 'hit'; id: string; damage: number; source?: HitContext['source']; punish?: boolean; blocked?: boolean; counter?: boolean; remote?: boolean; precise?: boolean; plated?: boolean }
  | { type: 'shellBreak'; id: string }
  | { type: 'kill'; id: string }
  | { type: 'blink'; id: string; from: Point3; to: Point3 }
  | { type: 'signature'; id: string; name: readonly [string, string]; counter: readonly [string, string] }
  | { type: 'eliteRally'; id: string; name: readonly [string, string] }
  | { type: 'perfectEvade'; id: string }
  /** Co-op host: an enemy's attack landed on the partner (their game applies it). */
  | { type: 'partnerHurt'; id: string; damage: number }
  | { type: 'dazed'; id: string }
  | { type: 'explode'; id: string; at: Point3 }
  /** Era-boss arena mechanic: a telegraph appears, then bursts (see bossHazards.ts). */
  | { type: 'hazard'; hazard: Hazard }
  | { type: 'hazardBurst'; id: number; hit: boolean; at: Point3 }
  | { type: 'hazardClear' }
  | { type: 'stagger' | 'storyPhase'; id: string }
  | { type: 'hurt'; damage: number; from?: Point3 }
  | { type: 'victory'; id: string; firstClear: boolean }
  | { type: 'bossStart' | 'bossReset' | 'phase' | 'death' | 'revive' };
export interface CombatTerrain {
  /** Grounded position or null when water, steep, blocked or outside the arena. */
  walk(from: Point3, x: number, z: number): Point3 | null;
  lineOfSight(from: Point3, to: Point3): boolean;
}
/** Perfect evade: dodging *through* an attack that would have landed (the evade's invulnerable frames
 * overlap the contact) rewards the read. Time slows for a breath, the evade is ready again, the
 * attacker is left open a little longer, and every hit lands harder for a short counter window. */
export const PERFECT_EVADE = Object.freeze({ counter: 2.5, bonus: 1.3, opening: .6, slow: .5, slowScale: .3 });
/** Daze (break): elites and chapter bosses carry a toughness gauge. Every hit fills it — the blade and
 * skills far faster than the rifle, a punish even more — and a full gauge breaks their stance: a long
 * stagger during which they take extra damage. The gauge drains if the pressure stops. */
export const DAZE = Object.freeze({
  eliteShare: .5, kingShare: .3,
  source: Object.freeze({ melee: 1, skill: .9, ultimate: .5, servant: .6, ranged: .3 }) as Readonly<Record<HitContext['source'], number>>,
  punish: 1.5, stun: 3, kingStun: 3.5, taken: 1.25, drainAfter: 4, drainPerSecond: .12,
});
/** W08 最后方阵: a formation that turns at marching pace, holds its facing through a volley, and
 * blocks most rifle fire on its front. Flanking it is the counter, not waiting. */
export const LAST_SQUARE = { id: 'boss_winter_warden', turn: [.7, .95], front: 1.0, block: .5, flank: 1.35, frontRank: 4, soldierHits: 3, drum: 4.2 } as const;
/** Bosses whose facing lags and whose front is armoured: W08 最后方阵 and J08 鸦印 (front plate, open flanks). */
export const BOSS_FRONTS: Readonly<Record<string, { turn: readonly [number, number]; front: number; block: number; flank: number }>> = {
  [LAST_SQUARE.id]: LAST_SQUARE,
  boss_hellfire_lord: { turn: [1.7, 2.2], front: .8, block: .6, flank: 1.15 },
};
export function turnLastSquare(e: Enemy, toward: Point3, dt: number) {
  const want = Math.atan2(toward.x - e.p.x, toward.z - e.p.z);
  const spec = BOSS_FRONTS[e.id]; if (!spec) return;
  if (e.squareYaw === undefined || e.mode === 'idle') { e.squareYaw = want; if (e.id === LAST_SQUARE.id) { e.squareGuard = LAST_SQUARE.frontRank * LAST_SQUARE.soldierHits; e.squareDrum = 0; } return; }
  if (e.mode === 'windup' || e.mode === 'recover') return;
  let d = want - e.squareYaw; d = Math.atan2(Math.sin(d), Math.cos(d));
  const step = spec.turn[e.phase - 1] * dt;
  e.squareYaw += Math.max(-step, Math.min(step, d));
}
export function lastSquareFront(e: Pick<Enemy, 'id' | 'p' | 'squareYaw'>, from: Point3) {
  const spec = BOSS_FRONTS[e.id]; if (!spec || e.squareYaw === undefined) return false;
  const d = Math.atan2(from.x - e.p.x, from.z - e.p.z) - e.squareYaw;
  return Math.abs(Math.atan2(Math.sin(d), Math.cos(d))) < spec.front;
}
export function dazeCapable(e: Pick<Enemy, 'miniboss' | 'kind' | 'storyPattern'>) { return !e.storyPattern && (!!e.miniboss || e.kind === 'king'); }
export function dazeThreshold(e: Pick<Enemy, 'maxHp' | 'kind'>) { return e.maxHp * (e.kind === 'king' ? DAZE.kingShare : DAZE.eliteShare); }
/** 0–1 gauge fill for presentation; 1 while dazed. */
export function dazeRatio(e: Enemy) { return (e.dazedFor ?? 0) > 0 ? 1 : Math.min(1, (e.daze ?? 0) / dazeThreshold(e)); }
export const COMBAT = {
  playerHp: 100, shotDamage: WORLD_RIFLE.damage, shotInterval: WORLD_RIFLE.interval, shotRange: WORLD_RIFLE.enemyRange, shotBurst: WORLD_RIFLE.burst, shotVent: WORLD_RIFLE.vent, meleePunish: 2,
  wildernessCap: 160, activeRange: 82, hideRange: 120, aggroRange: 20,
  leash: 35, respawn: 35, bossLeash: 68, bossHp: 1800,
} as const;
/** J08 鸦印 烧幕: below 30 % health each new attack sets a curtain alight behind him, across his retreat. It burns
 * bright for two seconds (crossing it hurts), then smoulders for one (safe) and is gone. */
export const CROW_CURTAIN = Object.freeze({ id: 'boss_hellfire_lord', below: .3, life: 3, hot: 1, halfLength: 1.7, depth: .55, damage: 12, behind: 2.2 });
export interface CrowCurtain { x: number; z: number; yaw: number; burn: number; count: number }
/** Whether `p` stands in the burning band of a curtain (a 3.4 m line, ±0.55 m deep). */
export function inCrowCurtain(c: Pick<CrowCurtain, 'x' | 'z' | 'yaw'>, p: Point3) {
  const dx = p.x - c.x, dz = p.z - c.z, along = dx * Math.cos(c.yaw) - dz * Math.sin(c.yaw), across = dx * Math.sin(c.yaw) + dz * Math.cos(c.yaw);
  return Math.abs(along) <= CROW_CURTAIN.halfLength && Math.abs(across) <= CROW_CURTAIN.depth;
}
export const BOSS_REQUIREMENTS = ERA_BOSS_REQUIREMENTS.sun_core;
export const BOSS_REWARD = 'reward_sunset_oath';
/** One sun-core boss per era: the marker it stands on, the core that starts it, what it needs and grants. */
export interface BossDef { id: string; core: string; requires: readonly string[]; reward: string }
export const BOSSES: BossDef[] = [
  { id: 'boss_vacant_king', core: 'sun_core', requires: BOSS_REQUIREMENTS, reward: BOSS_REWARD },
  { id: 'boss_drowned_admiral', core: 'sea_core', requires: ERA_BOSS_REQUIREMENTS.sea_core, reward: 'reward_black_sail' },
  { id: 'boss_winter_warden', core: 'winter_core', requires: ERA_BOSS_REQUIREMENTS.winter_core, reward: 'reward_last_eagle' },
  { id: 'boss_hellfire_lord', core: 'fire_core', requires: ERA_BOSS_REQUIREMENTS.fire_core, reward: 'reward_two_heavens' },
];
export interface BossSpawn extends SpawnPoint { requires?: readonly string[]; cleared?: boolean }
export const distanceXZ = (a: Point3, b: Point3) => Math.hypot(a.x - b.x, a.z - b.z);
const clone = (p: Point3): Point3 => ({ x: p.x, y: p.y, z: p.z });

/** Fixed wilderness regions, seeded jitter: never populate towns, camps, the seam or the sword island. */
export const WILDERNESS_ZONES = [
  { x: 145, z: 74, r: 26, kind: 'shade' as const },
  { x: 202, z: -4, r: 25, kind: 'shade' as const },
  { x: -185, z: 102, r: 24, kind: 'shade' as const },
  { x: -500, z: 25, r: 28, kind: 'shade' as const },
  { x: -454, z: -100, r: 26, kind: 'shade' as const },
  { x: -724, z: -100, r: 28, kind: 'shade' as const },
  // 黑帆尽头 (region offset x + 720): the downs, the fort road, the vortex rim, the headland road
  { x: 660, z: -780, r: 24, kind: 'crystal' as const },
  { x: 780, z: -790, r: 22, kind: 'crystal' as const },
  { x: 640, z: -820, r: 20, kind: 'crystal' as const },
  { x: 850, z: -710, r: 20, kind: 'crystal' as const },
  { x: 760, z: -650, r: 22, kind: 'crystal' as const },
  { x: 145, z: 140, r: 20, kind: 'shade' as const },
  // 永冬之城 (region offset z - 720): the bank road, the snowfield, the Smolensk road, the gorge mouth
  { x: -90, z: -540, r: 24, kind: 'crystal' as const },
  { x: -120, z: -680, r: 26, kind: 'shade' as const },
  { x: 40, z: -680, r: 24, kind: 'shade' as const },
  { x: 130, z: -550, r: 22, kind: 'crystal' as const },
  { x: 90, z: -800, r: 20, kind: 'shade' as const },
  // 业火京都 (region offset z + 720): north-east streets, the Kinkaku road, below Higashiyama, the ninth street, the southern plain
  { x: 620, z: -1280, r: 20, kind: 'shade' as const },
  { x: 892, z: -1332, r: 20, kind: 'crystal' as const },
  { x: 498, z: -1372, r: 18, kind: 'shade' as const },
  { x: 820, z: -1575, r: 22, kind: 'shade' as const },
  { x: 660, z: -1670, r: 26, kind: 'crystal' as const },
  // Additional remote pockets: keep the 82 m active window and town-safe placement,
  // while raising the seeded wilderness roster by roughly 23%.
  { x: -260, z: -220, r: 20, kind: 'shade' as const },
  { x: 260, z: -210, r: 20, kind: 'shade' as const },
  { x: 300, z: 120, r: 18, kind: 'shade' as const },
  { x: 860, z: -619, r: 20, kind: 'crystal' as const } /* off the new southern shore */,
  { x: -220, z: -840, r: 20, kind: 'crystal' as const },
  { x: 460, z: -1580, r: 20, kind: 'shade' as const },
  // Gap fill (measured >130 m from any spawn on the real map); `pack` zones seed a group of 5.
  { x: -819, z: 191, r: 14, kind: 'shade' as const, pack: 5 } /* Britain's south is now coast */,
  { x: -492, z: 266, r: 14, kind: 'crystal' as const },
  { x: 930, z: -1000, r: 14, kind: 'shade' as const, pack: 5 },
  { x: 270, z: -1000, r: 14, kind: 'crystal' as const, pack: 5 },
  { x: 0, z: -220, r: 14, kind: 'shade' as const, pack: 5 },
  { x: 810, z: -1100, r: 14, kind: 'crystal' as const },
  { x: 540, z: -520, r: 14, kind: 'shade' as const },
  // The southern shoreline now curves inland; keep this existing pack on the
  // dry western field so its two reserved Akechi guards remain available.
  { x: 990, z: -1665, r: 14, kind: 'crystal' as const, pack: 5 },
  { x: -900, z: 50, r: 14, kind: 'shade' as const },
  { x: -630, z: 230, r: 14, kind: 'crystal' as const },
  { x: -510, z: -340, r: 14, kind: 'shade' as const },
  { x: 480, z: -1100, r: 14, kind: 'crystal' as const },
  { x: -60, z: -1000, r: 14, kind: 'shade' as const },
  { x: 510, z: -1000, r: 14, kind: 'crystal' as const },
  { x: 300, z: -700, r: 14, kind: 'shade' as const },
  { x: -300, z: -430, r: 14, kind: 'crystal' as const },
  { x: 420, z: -790, r: 14, kind: 'shade' as const },
  { x: -840, z: -280, r: 14, kind: 'crystal' as const },
  { x: 1020, z: -1520, r: 14, kind: 'shade' as const },
  { x: 720, z: -1000, r: 14, kind: 'crystal' as const },
  { x: -120, z: -70, r: 14, kind: 'shade' as const },
  { x: -360, z: 170, r: 14, kind: 'crystal' as const },
  // Route-side pairs fill measured 98–169 m visibility gaps, without entering protected hubs.
  { x: -270, z: -40, r: 12, kind: 'shade' as const },
  { x: -41, z: 192, r: 12, kind: 'shade' as const },
  { x: 45, z: -77, r: 12, kind: 'shade' as const },
  { x: -67, z: 62, r: 12, kind: 'shade' as const },
  { x: -764, z: 129, r: 12, kind: 'shade' as const },
  { x: -855, z: -92, r: 12, kind: 'shade' as const },
  { x: -634, z: 8, r: 12, kind: 'shade' as const },
  { x: 552, z: -678, r: 12, kind: 'shade' as const },
  { x: 673, z: -553, r: 12, kind: 'shade' as const },
  { x: 860, z: -852, r: 12, kind: 'shade' as const },
  { x: 221, z: -615, r: 12, kind: 'shade' as const },
  { x: -214, z: -628, r: 12, kind: 'shade' as const },
  { x: -4, z: -859, r: 12, kind: 'shade' as const },
  { x: 713, z: -1423, r: 12, kind: 'shade' as const },
  { x: 1019, z: -1336, r: 12, kind: 'shade' as const },
  { x: 713, z: -1543, r: 12, kind: 'shade' as const },
];
export function makeWildernessSpawns(seed: number, place: (x: number, z: number) => Point3 | null): SpawnPoint[] {
  let state = seed >>> 0;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  const points: SpawnPoint[] = [];
  // Each zone seeds a pair: the original spawn plus a packmate (>= 9 m apart, same safe placement rules).
  for (const [index, zone] of WILDERNESS_ZONES.entries()) for (const suffix of ['', 'b', 'c', 'd', 'e'].slice(0, (zone as { pack?: number }).pack ?? 2)) {
    for (let attempt = 0; attempt < 32; attempt++) {
      const a = random() * Math.PI * 2, r = Math.sqrt(random()) * zone.r;
      const p = place(zone.x + Math.cos(a) * r, zone.z + Math.sin(a) * r);
      const gap = suffix ? ((zone as { pack?: number }).pack ? 4 : 9) : 18;
      if (!p || points.some(s => distanceXZ(s.p, p) < gap)) continue;
      points.push({ id: `wild_${index}${suffix}`, kind: zone.kind, p });
      break;
    }
  }
  return points.slice(0, COMBAT.wildernessCap);
}

/** Egypt's anomalous-water creatures (E03/E04). The Tide-Eater limb is rooted in the riverbed and
 * swings far; its shell halves damage until it cracks off at 55% health. Stone armour sheds most of
 * a blow on its plates; weak-spot rounds (the seams, best from above), melee punishes, counters and
 * a broken stance go through. */
export const CREATURES = Object.freeze({
  'tide-limb': { hp: 150, reach: 5.2, radius: 4.8, shellUntil: .55, shellTaken: .5, shellStagger: 1.4 },
  'stone-armour': { hp: 96, plateTaken: .45 },
});
function makeEnemy(s: SpawnPoint): Enemy {
  const maxHp = s.creature ? CREATURES[s.creature].hp : s.storyPattern === 'echo-warden' ? ECHO_WARDEN.hp : s.kind === 'king' ? COMBAT.bossHp : minibossProfile(s)?.hp ?? (s.kind === 'crystal' ? 88 : 66);
  return { ...s, p: clone(s.p), home: clone(s.p), maxHp, hp: maxHp, mode: 'idle', timer: 0,
    active: false, phase: 1, attack: 'sweep', target: clone(s.p), attackCount: 0, contactSequence: 0, hitTime: 0, role: s.role ?? selectEnemyRole({ ...s, home: s.p }), staggerCooldown: 0, pacified: false };
}

/** Shared deterministic role selection keeps the rendered weapon and damage behavior aligned. */
export function isMusketeer(e: Pick<Enemy, 'kind' | 'miniboss' | 'home' | 'id'> & { role?: EnemyRole }): boolean {
  const role = e.role ?? selectEnemyRole(e); return e.kind !== 'king' && !e.miniboss && (role === 'musketeer' || role === 'jaeger');
}
/** Shared by simulation and renderer: telegraphs must show the actual damage footprint. */
export function enemyAttackRadius(e: Enemy): number {
  if (e.storyPattern === 'echo-warden') return echoWardenRadius(e);
  const signature = activeSignature(e); if (signature) return signature.radius;
  if (e.attack === 'shot') return 1.4;
  if (e.attack === 'thrust') return e.kind === 'king' ? 1.2 : ENEMY_ROLES[e.role].radius;
  if (e.kind === 'king') return e.attack === 'burst' ? (e.phase === 2 ? 6.2 : 4.8) : 5.5;
  if (e.creature === 'tide-limb') return CREATURES['tide-limb'].radius;
  return minibossProfile(e)?.radius ?? ENEMY_ROLES[e.role].radius;
}

const ELITE_PAIRED_TIMING = { windup: 1, recovery: .55 } as const;
const DUELIST_FIRST_TIMING = { windup: .85, recovery: .45 } as const;
const BOSS_TURNS = [0, .8, -.8, 1.3, -1.3] as const;
export interface HitContext { source: 'ranged' | 'melee' | 'servant' | 'skill' | 'ultimate'; origin?: Point3; precise?: boolean }
/** Gun rounds that strike the upper body count as weak-spot hits; shotgun pellets get a smaller bonus. */
export const PRECISION = Object.freeze({ multiplier: 1.5, pellet: 1.2, band: .35 });

/** Thrust tells and impact share a forward rectangle, never a tracking/homing hit. */
export function enemyThrustLength(e: Enemy): number { return e.storyPattern === 'echo-warden' ? ECHO_WARDEN.thrustLength : activeSignature(e)?.length ?? (e.kind === 'king' ? 8 : ENEMY_ROLES[e.role].range + 1); }
export function enemyAttackContains(e: Enemy, player: Point3): boolean {
  if (e.attack !== 'thrust') {
    const center = e.attack === 'sweep' ? e.p : e.target;
    return distanceXZ(center, player) < enemyAttackRadius(e) && Math.abs(player.y - center.y) < 2.6;
  }
  const dx = e.target.x - e.p.x, dz = e.target.z - e.p.z, length = Math.hypot(dx, dz);
  const ux = length > .001 ? dx / length : 0, uz = length > .001 ? dz / length : 1;
  const px = player.x - e.p.x, pz = player.z - e.p.z;
  const along = px * ux + pz * uz, across = px * uz - pz * ux;
  return along >= 0 && along < enemyThrustLength(e) && Math.abs(across) < enemyAttackRadius(e) && Math.abs(player.y - e.p.y) < 2.6;
}
/** Shared damage/readability rule. Forced interruption never masquerades as an earned punish. */
export function isMeleePunishWindow(e: Pick<Enemy, 'mode' | 'staggerCooldown'>): boolean {
  return e.mode === 'recover' && e.staggerCooldown <= 0;
}
/** Rifle still interacts with distant quest targets; only enemy damage falls off. */
export function rangedDamageMultiplier(distance: number): number {
  return rifleDistanceMultiplier(distance);
}

/** Timings are shared with animation playback; each slash in a pair has its own full tell. */
export function enemyAttackTiming(e: Enemy): { windup: number; recovery: number } {
  if (e.storyPattern === 'echo-warden') return echoWardenTiming(e);
  if (e.kind === 'king') return bossAttackTiming(e);
  const elite = minibossProfile(e), signature = activeSignature(e);
  if (signature) return signature;
  if (elite) return elite.paired && e.attackCount % 2 === 1 ? ELITE_PAIRED_TIMING : elite;
  const role = ENEMY_ROLES[e.role];
  return role.paired && e.attackCount % 2 === 1 ? DUELIST_FIRST_TIMING : role;
}

export class WorldCombatState {
  readonly enemies: Enemy[];
  /** Every era boss; `boss` is the one last challenged (only one fight runs at a time). */
  readonly bosses: Enemy[];
  private readonly requires: (readonly string[])[];
  private readonly cleared: boolean[];
  private current = 0;
  hp: number = COMBAT.playerHp;
  /** Maximum health: the base plus Halo Resonance levels (see resonance.ts). */
  maxHp: number = COMBAT.playerHp;
  defeatedFor = 0;
  bossStarted = false;
  /** J08: a broken decree press sends 鸦印 into his close-range phase at the first hit. */
  earlySecondPhase = new Set<string>();
  shotCooldown = 0;
  gunHeat = 0;
  gunVent = 0;
  /** Rifle rounds (field only: boss fights do not consume). */
  ammo: number = WORLD_RIFLE.ammoMax;
  /** Set when a trigger pull found the rifle empty; the view turns it into a hint. */
  dryPulls = 0;
  private ammoTrickle = 0;
  private gunIdleFor = 0;
  hurtCooldown = 0;
  quietFor = 0;
  private guardMultiplier = 1;
  private invulnerable = false;
  /** Pending phase-2 arena hazards of the running era boss. */
  hazards: Hazard[] = [];
  private hazardTimer = 0; private hazardVolley = 0; private hazardSeq = 0; private hazardArmed = false;
  private lastPlayer: Point3 | null = null;
  private readonly playerVelocity = { x: 0, z: 0 };
  /** Seconds left in the counter window earned by a perfect evade. */
  counterFor = 0;
  /** The equipped gun's handling (worldArsenal.ts); the Dawn AR by default. */
  gun: WorldGun = worldGun(DEFAULT_GUN)!;
  /** Equip another gun. A short draw delay; heat and an active vent carry over (no swap-to-cool). */
  setGun(profile: WorldGun) {
    if (profile === this.gun) return;
    this.gun = profile; this.shotCooldown = Math.max(this.shotCooldown, .3); this.gunHeat = Math.min(this.gunHeat, Math.max(0, profile.burst - 1));
  }
  private trialPending = false;
  private trialReplay = false;
  private readonly knight: Enemy | undefined;
  private relayPacified = false;
  private roadPacified = false;
  private peaceSignature='';
  private readonly roadEnemies: Enemy[];
  private readonly relayEnemies: Enemy[];
  quietKyotoRoute = false;
  private readonly events: CombatEvent[] = [];
  private readonly sightFrom: Point3 = { x: 0, y: 0, z: 0 };
  private readonly sightTo: Point3 = { x: 0, y: 0, z: 0 };
  constructor(spawns: SpawnPoint[], boss: BossSpawn | BossSpawn[], cleared = false) {
    const list = [boss].flat();
    this.enemies = spawns.slice(0, COMBAT.wildernessCap).map(makeEnemy);
    this.bosses = list.map(b => makeEnemy({ id: b.id, p: b.p, kind: 'king' }));
    this.requires = list.map(b => b.requires ?? BOSS_REQUIREMENTS);
    this.cleared = list.map(b => b.cleared ?? cleared);
    this.enemies.push(...this.bosses);
    this.knight = this.enemies.find(e => e.id === KNIGHT_TRIAL_ID);
    this.roadEnemies = this.enemies.filter(e => e.id === 'wild_56' || e.id === 'wild_56b');
    this.relayEnemies = this.enemies.filter(e => e.id === 'wild_48' || e.id === 'wild_48b');
    this.bosses.forEach((b, i) => { if (this.cleared[i]) { b.hp = 0; b.mode = 'dead'; } });
  }
  /** Story roster is transient, local and capped; normal wilderness IDs are untouched. */
  replaceStoryEnemies(spawns: readonly SpawnPoint[]): Enemy[] {
    if (spawns.length > 3 || spawns.some(spawn => !spawn.storyEncounter || spawn.kind === 'king' || !spawn.id.startsWith('story_'))) throw new Error('Invalid story enemy roster');
    this.clearStoryEnemies();
    const actors = spawns.map(spawn => { const actor = makeEnemy(spawn); actor.active = true; actor.mode = 'chase'; actor.timer = .35; return actor; });
    this.enemies.push(...actors); return actors;
  }
  clearStoryEnemies() { for (let i = this.enemies.length-1; i >= 0; i--) if (this.enemies[i].storyEncounter) this.enemies.splice(i,1); }
  get boss() { return this.bosses[this.current]; }
  get bossCleared() { return this.cleared[this.current]; }
  isCleared(id: string) { const i = this.bosses.findIndex(b => b.id === id); return i >= 0 && this.cleared[i]; }
  drainEvents() { return this.events.splice(0); }
  get defeated() { return this.defeatedFor > 0; }
  setBossRequirements(id: string, requirements: readonly string[]) {
    const index = this.bosses.findIndex(b => b.id === id);
    if (index < 0 || this.bossStarted) return false;
    this.requires[index] = requirements; return true;
  }
  /** Start a boss fight (the first boss when no id is given) once its requirements are done. */
  beginBoss(done: ReadonlySet<string>, id?: string) {
    if (this.remoteEnemies) return false; // a co-op guest joins the host's fight instead
    const i = id === undefined ? 0 : this.bosses.findIndex(b => b.id === id);
    if (i < 0 || i >= this.bosses.length || this.bossStarted || this.defeated) return false;
    if (!this.cleared[i] && !this.requires[i].every(r => done.has(r))) return false;
    this.current = i;
    this.resetEnemy(this.boss);
    this.boss.active = true; this.boss.mode = 'chase'; this.boss.timer = 1.4;
    this.bossStarted = true; this.hp = this.maxHp; this.quietFor = 0;
    this.shotCooldown = 0; this.gunHeat = 0; this.gunVent = 0; this.gunIdleFor = 0; this.hurtCooldown = 0;
    this.events.push({ type: 'bossStart' });
    return true;
  }
  /** `cleared` applies to every boss, or pass a per-boss list (same order as the constructor). */
  resetAll(cleared: boolean | boolean[] = false) {
    this.clearStoryEnemies();
    this.bossStarted = false; this.trialPending = false; this.trialReplay = false; this.quietKyotoRoute = false; this.relayPacified = false; this.roadPacified = false;
    this.peaceSignature='';this.current = 0; this.quietFor = 0; this.setDefense({ guard: 1, invulnerable: false });
    this.hp = this.maxHp; this.ammo = WORLD_RIFLE.ammoMax; this.defeatedFor = 0; this.shotCooldown = 0; this.gunHeat = 0; this.gunVent = 0; this.gunIdleFor = 0; this.hurtCooldown = 0; this.counterFor = 0;
    for (const e of this.enemies) { e.pacified = false; this.resetEnemy(e); }
    this.bosses.forEach((b, i) => {
      this.cleared[i] = Array.isArray(cleared) ? !!cleared[i] : cleared;
      if (this.cleared[i]) { b.hp = 0; b.mode = 'dead'; }
    });
    this.events.length = 0;
  }
  private resetEnemy(e: Enemy) {
    Object.assign(e.p, e.home); e.hp = e.maxHp; e.mode = e.pacified ? 'pacified' : 'idle'; e.timer = 0; e.active = false;
    Object.assign(e.target, e.home); e.attack = 'sweep';
    e.phase = 1; e.attackCount = 0; e.contactSequence = 0; e.hitTime = 0; e.staggerCooldown = 0; if (e.role === 'shinobi') e.blinkCooldown = SHINOBI_BLINK.first; e.signatureActive = false;
    e.daze = 0; e.dazeIdle = 0; e.dazedFor = 0; e.shellBroken = false;
  }
  /** The Crow Seal's current burning curtain, if any (read by the view to draw it). */
  crowCurtain: CrowCurtain | null = null;
  private stepCrowCurtain(dt: number, player: Point3) {
    const b = this.bossStarted ? this.boss : null;
    if (!b || b.id !== CROW_CURTAIN.id || b.mode === 'dead') { this.crowCurtain = null; return; }
    // A new windup below the threshold lights a fresh curtain across his line of retreat.
    if (b.hp / b.maxHp <= CROW_CURTAIN.below && b.mode === 'windup' && b.attackCount !== this.crowCurtain?.count)
    { const face = b.squareYaw ?? 0; // he faces the player; the curtain hangs behind him, blocking pursuit
      this.crowCurtain = { x: b.p.x - Math.sin(face) * CROW_CURTAIN.behind, z: b.p.z - Math.cos(face) * CROW_CURTAIN.behind, yaw: face, burn: CROW_CURTAIN.life, count: b.attackCount }; }
    const c = this.crowCurtain; if (!c) return;
    c.burn -= dt;
    if (c.burn <= 0) { this.crowCurtain = { ...c, burn: 0 }; return; }
    if (c.burn > CROW_CURTAIN.hot && !this.invulnerable && inCrowCurtain(c, player)) this.hurt(CROW_CURTAIN.damage, false, { x: c.x, y: player.y, z: c.z });
  }
  resetBoss() {
    this.crowCurtain = null;
    if (!this.bossStarted) return;
    this.bossStarted = false; this.resetEnemy(this.boss); this.events.push({ type: 'bossReset' });
  }
  /** Raise or restore maximum health; a raise also fills the new headroom. */
  setMaxHp(value: number) {
    if (!Number.isFinite(value) || value <= 0) return;
    const gain = value - this.maxHp; this.maxHp = value;
    this.hp = Math.min(this.maxHp, gain > 0 && !this.defeated ? this.hp + gain : this.hp);
  }
  syncWorldFlags(done: ReadonlySet<string>) {
    this.setMaxHp(resonanceMaxHp(resonanceLevel(done)));
    const peace=['britain','blacksail','winter','kyoto'].filter(r=>adventureActive(done)&&adventureChapterComplete(r as 'britain'|'blacksail'|'winter'|'kyoto',done));
    const signature=peace.join(',');if(signature!==this.peaceSignature){this.peaceSignature=signature;for(const e of this.enemies){if(e.kind==='king'||e.miniboss||e.storyEncounter)continue;const peaceful=peace.includes(regionAt(e.home.x,e.home.z).id)||(done.has(KNIGHT_TRIAL_CLEAR)&&this.roadEnemies.includes(e))||(done.has('relay_b')&&this.relayEnemies.includes(e));if(e.pacified!==peaceful){e.pacified=peaceful;this.resetEnemy(e);}}}
    this.quietKyotoRoute = done.has('kyoto_lantern_route');
    if (done.has(KNIGHT_TRIAL_CLEAR) && !this.trialReplay && this.knight?.mode !== 'dead') this.retireOptionalTrial();
    const safeRoad = done.has(KNIGHT_TRIAL_CLEAR);
    if (safeRoad !== this.roadPacified) {
      this.roadPacified = safeRoad;
      for (const enemy of this.roadEnemies) { enemy.pacified = safeRoad; enemy.hp = enemy.maxHp; enemy.mode = safeRoad ? 'pacified' : 'idle'; enemy.timer = 0; }
    }
    const pacified = done.has('relay_b');
    if (pacified === this.relayPacified) return;
    this.relayPacified = pacified;
    for (const enemy of this.relayEnemies) {
      enemy.pacified = pacified;
      // A repaired relay can restore a damaged shell peacefully; no kill/damage/reward event.
      enemy.hp = enemy.maxHp; enemy.mode = pacified ? 'pacified' : 'idle'; enemy.timer = 0;
    }
  }
  retireOptionalTrial() {
    const enemy = this.knight;
    if (!enemy) return false;
    enemy.hp = 0; enemy.mode = 'dead'; enemy.active = false; enemy.timer = Infinity; return true;
  }
  startOptionalTrial(id: string): boolean {
    const enemy = this.enemies.find(e => e.id === id && e.miniboss === KNIGHT_TRIAL_ID);
    if (id !== KNIGHT_TRIAL_ID || !enemy || this.bossStarted || this.defeated || this.trialPending || !['idle', 'dead'].includes(enemy.mode)) return false;
    this.trialPending = true; this.trialReplay = true; return true;
  }
  interruptEnemy(id:string,seconds=.8):boolean {
    const enemy=this.enemies.find(e=>e.id===id);
    if(!enemy||!enemy.active||enemy.hp<=0||enemy.pacified||enemy.mode!=='windup'||enemy.staggerCooldown>0||!Number.isFinite(seconds)||seconds<=0)return false;
    enemy.mode='stagger';enemy.timer=Math.min(1,seconds);enemy.staggerCooldown=enemy.kind==='king'?10:5;enemy.contactSequence=0;
    this.events.push({type:'stagger',id});return true;
  }
  /** A field herb: up to `amount` HP at once, usable mid-fight; returns what was restored. */
  fieldHeal(amount: number): number {
    if (this.defeated || !Number.isFinite(amount) || amount <= 0 || this.hp >= this.maxHp) return 0;
    const before = this.hp; this.hp = Math.min(this.maxHp, this.hp + amount); return this.hp - before;
  }
  recoverAtSettlement(amount: number): boolean {
    if (this.defeated || this.bossStarted || this.quietFor < 5 || !Number.isFinite(amount) || amount <= 0 || this.hp >= this.maxHp) return false;
    this.hp = Math.min(this.maxHp, this.hp + Math.min(25, amount)); return true;
  }
  /** Adds rounds up to the cap; returns how many were actually loaded. */
  refillAmmo(rounds: number = WORLD_RIFLE.ammoMax): number {
    if (!Number.isFinite(rounds) || rounds <= 0) return 0;
    const before = this.ammo; this.ammo = Math.min(WORLD_RIFLE.ammoMax, this.ammo + Math.floor(rounds)); return this.ammo - before;
  }
  canShoot() {
    if (this.defeated || this.shotCooldown > 1e-9 || this.gunVent > 1e-9) return false;
    if (!this.bossStarted) { if (this.ammo < this.gun.ammoCost) { this.dryPulls++; return false; } this.ammo -= this.gun.ammoCost; }
    // Carry a small render-frame overrun during held fire, never bank free shots after idle/vent.
    const interval = this.gun.interval;
    this.shotCooldown = this.gunHeat === 0 || this.gunIdleFor > interval * 2 ? interval : Math.max(1e-6, this.shotCooldown + interval);
    this.gunIdleFor = 0;
    this.gunHeat++;
    if (this.gunHeat >= this.gun.burst && this.gun.vent > 0) this.gunVent = this.gun.vent;
    return true;
  }
  /** Co-op guest: told of every hit this player lands (the host's game applies it for real). */
  onLocalHit: ((id: string, damage: number, source: HitContext['source']) => void) | null = null;
  private rawHit = false;
  /** Co-op host: a hit the partner landed, already scaled by their game (only daze applies here). */
  remoteHit(id: string, damage: number, source: HitContext['source']) {
    if (!Number.isFinite(damage) || damage <= 0 || damage > 400) return false;
    const counter = this.counterFor; this.rawHit = true; this.counterFor = 0;
    try { return this.hitEnemy(id, damage, { source }); } finally { this.rawHit = false; this.counterFor = counter; }
  }
  hitEnemy(id: string, damage: number = COMBAT.shotDamage, context?: HitContext) {
    const e = this.enemies.find(e => e.id === id);
    if (!e || !e.active || e.mode === 'dead' || e.pacified || this.defeated || !Number.isFinite(damage) || damage <= 0) return false;
    const raw = this.rawHit;
    if(!raw&&context?.source==='ranged'&&context.origin&&distanceXZ(context.origin,e.p)>this.gun.range)return false;
    // Melee earns a real punish window, not inflated enemy HP. Legacy raw damage stays exact.
    const melee = context?.source === 'melee';
    const punish = !raw && melee && isMeleePunishWindow(e);
    const ranged=!raw&&context?.source==='ranged';
    const opening=ranged&&e.mode==='recover'?WORLD_RIFLE.recoveryBonus:1;
    const armor=ranged&&e.role==='breaker'&&!e.creature&&e.mode!=='recover'&&e.mode!=='stagger'&&e.kind!=='king'&&!e.miniboss&&!e.storyPattern?WORLD_RIFLE.breakerArmor:1;
    const squareFront=ranged&&!!context?.origin&&lastSquareFront(e,context.origin);
    // A front-rank soldier takes the round instead of the officer; every third hit drops one.
    if (squareFront && e.id === LAST_SQUARE.id && (e.squareGuard ?? 0) > 0) {
      e.squareGuard! -= 1; e.hitTime = .11;
      this.events.push({ type: 'hit', id, damage: 0, source: context?.source, punish: false, blocked: true });
      return true;
    }
    const shielded=squareFront||ranged&&e.role==='shieldbearer'&&!e.creature&&e.mode!=='recover'&&e.mode!=='stagger'&&e.kind!=='king'&&!e.miniboss&&(!e.storyPattern||e.phase===2);
    const counter = this.counterFor > 0, dazed = (e.dazedFor ?? 0) > 0;
    const precise = ranged && !!context?.precise && !shielded, weakSpot = precise ? (this.gun.pellets > 1 ? PRECISION.pellet : PRECISION.multiplier) : 1;
    const plates = !raw && e.creature === 'stone-armour' && !precise && !punish && !counter && !dazed && context?.source !== 'ultimate';
    const shell = !raw && e.creature === 'tide-limb' && !e.shellBroken && !precise && !punish && !counter;
    const hide = plates ? CREATURES['stone-armour'].plateTaken : shell ? CREATURES['tide-limb'].shellTaken : 1;
    const dealt = Math.min(e.hp, Math.round(damage * weakSpot * hide * (counter ? PERFECT_EVADE.bonus : 1) * (dazed ? DAZE.taken : 1) * opening * armor * (squareFront ? BOSS_FRONTS[e.id].block : shielded ? WORLD_RIFLE.shieldBlock : ranged && BOSS_FRONTS[e.id] && e.squareYaw !== undefined && context?.origin ? BOSS_FRONTS[e.id].flank : 1) * (punish ? COMBAT.meleePunish : 1) * (context?.source === 'ranged' && context.origin ? gunDistanceMultiplier(this.gun, distanceXZ(context.origin, e.p)) : 1) * 100) / 100);
    e.hp -= dealt; e.hitTime = 0.11;
    this.events.push({ type: 'hit', id, damage: dealt, source: context?.source, punish, ...(shielded ? { blocked: true } : {}), ...(counter ? { counter: true } : {}), ...(precise ? { precise: true } : {}), ...(hide < 1 ? { plated: true } : {}), ...(raw ? { remote: true } : {}) });
    if (!raw && context?.source && dealt > 0) this.onLocalHit?.(id, dealt, context.source);
    // The limb's shell cracks off once: a long stagger, then full damage for the rest of the fight.
    if (e.creature === 'tide-limb' && !e.shellBroken && e.hp > 0 && e.hp <= e.maxHp * CREATURES['tide-limb'].shellUntil) {
      e.shellBroken = true; e.mode = 'stagger'; e.timer = CREATURES['tide-limb'].shellStagger; e.contactSequence = 0;
      this.events.push({ type: 'shellBreak', id });
    }
    if (e.hp <= 0) {
      e.mode = 'dead'; e.timer = e.storyEncounter || e.id === KNIGHT_TRIAL_ID ? Infinity : e.miniboss ? 120 : COMBAT.respawn; e.active = false;
      if (e.id === KNIGHT_TRIAL_ID) this.trialReplay = false;
      this.events.push({ type: 'kill', id });
      if (!e.pacified && !raw) this.refillAmmo(WORLD_RIFLE.ammoPerKill);
      if (e === this.boss) {
        const firstClear = !this.cleared[this.current];
        this.bossStarted = false; this.cleared[this.current] = true;
        this.events.push({ type: 'victory', id: e.id, firstClear });
      }
    } else {
      if (melee && !e.miniboss && e.kind !== 'king' && e.mode === 'windup' && e.staggerCooldown <= 0) {
        e.mode = 'stagger'; e.timer = .9; e.staggerCooldown = 4;
        this.events.push({ type: 'stagger', id });
      }
      if (e.mode === 'idle') e.mode = 'chase';
      if (e.storyPattern === 'echo-warden' && e.phase === 1 && e.hp <= e.maxHp / 2) {
        e.phase = 2; e.contactSequence = 0; e.staggerCooldown = 0; e.mode = 'recover'; e.timer = ECHO_WARDEN.stanceBreak;
        this.events.push({ type: 'storyPhase', id: e.id });
      }
      const rallyName = e.miniboss && !e.storyPattern && e.kind !== 'king' && e.phase === 1 && e.hp <= e.maxHp / 2 && minibossProfile(e)?.signature ? eliteName(e) : undefined;
      if (rallyName) {
        // Half health: one stance break to punish, then the elite presses harder for the rest of the fight.
        e.phase = 2; e.mode = 'recover'; e.timer = ELITE_RALLY.opening; e.signatureActive = false;
        this.events.push({ type: 'eliteRally', id: e.id, name: rallyName });
      }
      if (e === this.boss && e.phase === 1 && (e.hp <= e.maxHp / 2 || this.earlySecondPhase.has(e.id))) {
        e.phase = 2; e.contactSequence = 0; e.mode = 'recover'; e.timer = 1.2;
        this.events.push({ type: 'phase' });
      }
      if (dazeCapable(e) && !dazed && context?.source) {
        e.daze = (e.daze ?? 0) + dealt * DAZE.source[context.source] * (punish ? DAZE.punish : 1); e.dazeIdle = 0;
        if (e.daze >= dazeThreshold(e)) {
          // Stance broken: a long stagger, extra damage taken, and the gauge starts over.
          const stun = e.kind === 'king' ? DAZE.kingStun : DAZE.stun;
          e.daze = 0; e.dazedFor = stun; e.mode = 'stagger'; e.timer = stun; e.contactSequence = 0; e.signatureActive = false;
          this.events.push({ type: 'dazed', id: e.id });
        }
      }
    }
    return true;
  }
  /** Ray-sphere intersections use world metres. maxDistance must include every wall/quest-target occluder. */
  raycast(origin: Point3, direction: Point3, maxDistance: number = COMBAT.shotRange) {
    let best: { id: string; distance: number; point: Point3; precise: boolean } | null = null;
    const length = Math.hypot(direction.x, direction.y, direction.z);
    if (!length || !Number.isFinite(length)) return best;
    const d = { x: direction.x / length, y: direction.y / length, z: direction.z / length };
    for (const e of this.enemies) {
      if (!e.active || e.mode === 'dead' || e.pacified) continue;
      // Hit volumes follow the silhouette: the limb is tall, stone armour low and broad.
      const radius = e.kind === 'king' ? 1.45 : e.creature === 'tide-limb' ? 1.35 : e.creature === 'stone-armour' ? .85 : 0.8;
      const center = { x: e.p.x, y: e.p.y + (e.kind === 'king' ? 1.8 : e.creature === 'tide-limb' ? 2.4 : e.creature === 'stone-armour' ? .75 : 1.05), z: e.p.z };
      const x = origin.x - center.x, y = origin.y - center.y, z = origin.z - center.z;
      const b = x * d.x + y * d.y + z * d.z, c = x * x + y * y + z * z - radius * radius;
      const disc = b * b - c;
      if (disc < 0) continue;
      const distance = Math.max(0, -b - Math.sqrt(disc));
      if (-b + Math.sqrt(disc) < 0 || distance >= maxDistance || best && distance >= best.distance) continue;
      const hitY = origin.y + d.y * distance;
      best = { id: e.id, distance, point: { x: origin.x + d.x * distance, y: hitY, z: origin.z + d.z * distance }, precise: hitY > center.y + radius * PRECISION.band };
    }
    return best;
  }
  /** Supplied by the active player action each frame; pause/reset must clear defense. */
  setDefense(defense: { guard: number; invulnerable: boolean }) {
    this.guardMultiplier = Number.isFinite(defense.guard) ? Math.min(1, Math.max(.55, defense.guard)) : 1;
    this.invulnerable = defense.invulnerable === true && !this.defeated;
  }
  /** Co-op host: the partner's position (null when solo). */
  partner: Point3 | null = null;
  /** Co-op host: this player is in a menu or loading, so enemies fight only the partner. */
  localAbsent = false;
  /** Co-op guest: enemies are driven by the host's snapshots instead of local AI. */
  remoteEnemies = false;
  /** Co-op guest: take the host's enemy positions, health and modes. Unknown ids are ignored. */
  applyRemoteEnemies(list: readonly { id: string; p: readonly [number, number, number]; hp: number; mode: string; tm?: number; t?: readonly [number, number, number]; k?: string; ph?: number }[]) {
    for (const r of list) {
      const e = this.enemies.find(x => x.id === r.id); if (!e) continue;
      e.p = { x: r.p[0], y: r.p[1], z: r.p[2] };
      // Only a fight seen here ends in a kill burst; idle or unseen foes just take the host's state.
      const wasFighting = e.mode !== 'dead' && e.mode !== 'idle';
      e.hp = Math.min(e.maxHp, r.hp);
      if (MODES.has(r.mode)) e.mode = r.mode as Enemy['mode'];
      if (typeof r.tm === 'number' && Number.isFinite(r.tm)) e.timer = r.tm;
      if (r.t) e.target = { x: r.t[0], y: r.t[1], z: r.t[2] };
      if (r.k && ATTACKS.has(r.k)) e.attack = r.k as Enemy['attack'];
      if (r.ph === 1 || r.ph === 2) e.phase = r.ph;
      e.active = e.mode !== 'idle' && e.mode !== 'dead';
      if (wasFighting && e.mode === 'dead') {
        this.events.push({ type: 'kill', id: e.id });
        if (e === this.boss && this.bossStarted) {
          const firstClear = !this.cleared[this.current];
          this.cleared[this.current] = true; this.bossStarted = false;
          this.events.push({ type: 'victory', id: e.id, firstClear });
        }
      }
    }
  }
  /** Co-op guest: join the boss fight the host's game is running (no requirements: the host met them). */
  joinRemoteBoss(id: string) {
    const i = this.bosses.findIndex(b => b.id === id);
    if (i < 0 || !this.remoteEnemies || this.bossStarted || this.defeated) return false;
    this.current = i; this.bossStarted = true; this.hp = this.maxHp; this.quietFor = 0; this.hurtCooldown = 0;
    this.events.push({ type: 'bossStart' }); return true;
  }
  /** Co-op guest: the host's fight ended without a win (reset, defeat, or the room closed). */
  leaveRemoteBoss() { if (!this.bossStarted) return false; this.bossStarted = false; this.events.push({ type: 'bossReset' }); return true; }
  /** Co-op guest: a host-side enemy contact landed on this player. */
  remoteHurt(amount: number) { this.applyExternalDamage(amount); }
  applyExternalDamage(amount: number) { if (Number.isFinite(amount) && amount > 0 && amount <= 200) this.hurt(amount); }
  applyFallDamage(amount: number) { if (Number.isFinite(amount) && amount > 0) this.hurt(amount, true); }
  private hurt(amount: number, fromFall = false, from?: Point3) {
    if (this.defeated || (!fromFall && (this.hurtCooldown > 0 || this.invulnerable))) return;
    amount = Math.min(this.hp, Math.round(amount * (fromFall ? 1 : this.guardMultiplier) * 100) / 100);
    this.hp = Math.max(0, this.hp - amount); this.hurtCooldown = 0.45; this.quietFor = 0;
    this.events.push({ type: 'hurt', damage: amount, ...(from ? { from: clone(from) } : {}) });
    if (!this.hp) {
      this.defeatedFor = 2.5; this.counterFor = 0; this.setDefense({ guard: 1, invulnerable: false }); this.resetBoss();
      for (const e of this.enemies) if (!this.bosses.includes(e) && e.mode !== 'dead') this.resetEnemy(e);
      this.events.push({ type: 'death' });
    }
  }
  private stepHazards(dt: number, player: Point3) {
    if (this.lastPlayer) {
      const k = Math.min(1, dt * 6);
      this.playerVelocity.x += ((player.x - this.lastPlayer.x) / dt - this.playerVelocity.x) * k;
      this.playerVelocity.z += ((player.z - this.lastPlayer.z) / dt - this.playerVelocity.z) * k;
    }
    this.lastPlayer = clone(player);
    // the co-op guest mirrors the host's boss; its arena mechanic belongs to the host's game
    const boss = this.bossStarted && !this.remoteEnemies ? this.boss : null, def = boss ? BOSS_HAZARDS[boss.id] : undefined;
    if (!boss || !def || boss.mode === 'dead' || boss.phase !== 2) {
      if (this.hazards.length) { this.hazards = []; this.events.push({ type: 'hazardClear' }); }
      this.hazardArmed = false; return;
    }
    if (!this.hazardArmed) { this.hazardArmed = true; this.hazardTimer = def.first; this.hazardVolley = 0; }
    // one threat at a time: a volley waits out the boss's own swing, and the boss holds while it lands
    if ((this.hazardTimer -= dt) <= 0 && boss.mode !== 'windup') {
      this.hazardTimer = def.every;
      // the first volley names itself and its answer, like an elite's signature move
      if (!this.hazardVolley) this.events.push({ type: 'signature', id: boss.id, name: def.name, counter: def.counter });
      for (const plan of planBossHazards(boss.id, boss.p, player, this.playerVelocity, this.hazardVolley)) {
        const hazard: Hazard = { ...plan, id: ++this.hazardSeq, boss: boss.id, t: plan.delay };
        this.hazards.push(hazard); this.events.push({ type: 'hazard', hazard });
      }
      this.hazardVolley++;
    }
    for (const h of [...this.hazards]) {
      if ((h.t -= dt) > 0) continue;
      this.hazards.splice(this.hazards.indexOf(h), 1);
      const inside = hazardContains(h, player);
      this.events.push({ type: 'hazardBurst', id: h.id, hit: inside && !this.invulnerable, at: clone(h.at) });
      if (!inside) continue;
      // evading through a burst is read like any other attack: a perfect evade
      if (this.invulnerable) { this.counterFor = PERFECT_EVADE.counter; this.events.push({ type: 'perfectEvade', id: boss.id }); }
      else { this.hurt(h.damage, false, h.at); if (this.defeated) return; }
    }
  }
  step(dt: number, localPlayer: Point3, active: boolean, terrain: CombatTerrain) {
    const player = localPlayer;
    // Co-op host in a menu or loading: the world keeps fighting the partner, never the absent host.
    const away = !active && this.localAbsent && !!this.partner && !this.remoteEnemies;
    if (!active) { this.setDefense({ guard: 1, invulnerable: false }); if (!away) return; }
    if (!Number.isFinite(dt) || dt <= 0) return;
    dt = Math.min(dt, 0.1);
    this.shotCooldown = Math.max(-this.gun.interval, this.shotCooldown - dt);
    this.gunIdleFor += dt;
    this.gunVent = Math.max(0, this.gunVent - dt);
    if (this.gunVent <= 1e-9) this.gunVent = 0;
    if (!this.gunVent && this.gunIdleFor + 1e-9 >= Math.max(this.gun.vent, COMBAT.shotVent)) this.gunHeat = 0;
    this.hurtCooldown = Math.max(0, this.hurtCooldown - dt);
    this.counterFor = Math.max(0, this.counterFor - dt);
    if (this.defeated) {
      this.defeatedFor = Math.max(0, this.defeatedFor - dt);
      if (!this.defeated) { this.hp = this.maxHp; this.ammo = Math.max(this.ammo, WORLD_RIFLE.ammoRespawn); this.hurtCooldown = 2; this.events.push({ type: 'revive' }); }
      return;
    }
    if (this.bossStarted && (distanceXZ(player, this.boss.home) > COMBAT.bossLeash || Math.abs(player.y - this.boss.home.y) > 24)) this.resetBoss();
    if (this.trialPending) {
      const trial = this.knight;
      const distance = trial ? distanceXZ(trial.home, player) : Infinity;
      if (trial && distance >= 8 && distance <= 28 && !this.bossStarted) { this.resetEnemy(trial); this.trialPending = false; }
    }
    const knight = this.knight;
    const dueling = !!knight && knight.mode !== 'idle' && knight.mode !== 'dead' && distanceXZ(player, knight.home) < 25;
    let threatened = false;
    for (const e of this.enemies) {
      e.hitTime = Math.max(0, e.hitTime - dt);
      e.staggerCooldown = Math.max(0, e.staggerCooldown - dt);
      if (e.dazedFor) e.dazedFor = Math.max(0, e.dazedFor - dt);
      if (e.daze) { e.dazeIdle = (e.dazeIdle ?? 0) + dt; if (e.dazeIdle > DAZE.drainAfter) e.daze = Math.max(0, e.daze - dazeThreshold(e) * DAZE.drainPerSecond * dt); }
      if (e.blinkCooldown) e.blinkCooldown = Math.max(0, e.blinkCooldown - dt);
      // Co-op guest: the host's game moves and fights with every enemy (applyRemoteEnemies).
      // Story actors exist only in their own player's game and keep local AI on both sides.
      if (this.remoteEnemies && !e.storyEncounter) continue;
      // Co-op host: each enemy fights whichever player is nearer to it.
      if (away && e.storyEncounter) continue;
      const player = this.partner && !e.storyEncounter && (away || distanceXZ(e.p, this.partner) < distanceXZ(e.p, localPlayer)) ? this.partner : localPlayer;
      if (this.bosses.includes(e) && !(this.bossStarted && e === this.boss)) { e.active = false; continue; }
      if (BOSS_FRONTS[e.id] && e.active && e.mode !== 'dead') turnLastSquare(e, e.mode === 'chase' ? player : e.target, dt);
      const dist = distanceXZ(e.p, player);
      if (e.mode === 'dead') {
        e.timer -= dt;
        if (e !== this.boss && e.timer <= 0 && distanceXZ(e.home, player) > 30) this.resetEnemy(e);
        continue;
      }
      if (dist > COMBAT.hideRange) { this.resetEnemy(e); continue; }
      e.active = dist < COMBAT.activeRange;
      if (!e.active || e.pacified) continue;
      const heightOk = Math.abs(player.y - e.p.y) < (e === this.boss ? 8 : 3);
      const from = this.sightFrom, to = this.sightTo;
      from.x = e.p.x; from.y = e.p.y + 1.2; from.z = e.p.z;
      to.x = player.x; to.y = player.y + 1; to.z = player.z;
      const sees = heightOk && terrain.lineOfSight(from, to);
      // The nearby road pair yield the named duel; they do not pile onto its long tells.
      if (dueling && (e.id === 'wild_56' || e.id === 'wild_56b')) { e.mode = 'idle'; e.timer = 0; continue; }
      const quietLane = this.quietKyotoRoute && e.encounter === 'akechi' && player.x > 933 && player.z > -1590; // Kyoto turned half a circle (legacy x<-213, z<870)
      const aggroRange = e.encounter === 'akechi' ? quietLane ? 12 : 26 : COMBAT.aggroRange;
      if (e.mode === 'idle') { if (dist < aggroRange && sees) e.mode = 'chase'; else continue; }
      if (e !== this.boss && (distanceXZ(e.home, player) > COMBAT.leash || distanceXZ(e.home, e.p) > COMBAT.leash)) {
        // Returning to the patrol boundary is not a respawn. Previously every ranged
        // hit from 35–82 m was erased on the next AI tick, with a one-tick immunity
        // window as well. Keep damage/eligibility until real despawn or death.
        Object.assign(e.p, e.home); Object.assign(e.target, e.home);
        e.mode = 'idle'; e.timer = 0;
        e.active = distanceXZ(e.p, player) < COMBAT.activeRange;
        continue;
      }
      threatened = true;
      e.timer -= dt;
      if (e.mode === 'windup') {
        if (e.timer <= 0) {
          // Presentation consumes an actual contact, never guesses one from a mode transition.
          // Snapshots stay locked even if another simulation tick moves or resets the actor.
          e.contactSequence = e.attackCount;
          this.events.push({ type: 'attackContact', id: e.id, attack: e.attack, sequence: e.attackCount, origin: clone(e.p), target: clone(e.target), radius: enemyAttackRadius(e), ...(e.storyPattern ? { storyPattern: e.storyPattern, ...(e.attack === 'thrust' ? { length: enemyThrustLength(e) } : {}) } : {}) });
          const evaded = player === localPlayer && this.invulnerable && !this.defeated && enemyAttackContains(e, player) && sees;
          if (evaded) { this.counterFor = PERFECT_EVADE.counter; this.events.push({ type: 'perfectEvade', id: e.id }); }
          if (enemyAttackContains(e, player) && sees) {
            const damage = e.storyPattern === 'echo-warden' ? echoWardenDamage(e) : e === this.boss ? bossAttackDamage(e) : activeSignature(e)?.damage ?? minibossProfile(e)?.damage ?? ENEMY_ROLES[e.role].damage;
            if (player === localPlayer) this.hurt(damage, false, e.p); else this.events.push({ type: 'partnerHurt', id: e.id, damage });
          }
          // hurt() can reset every actor on defeat. Never overwrite that terminal reset
          // or let later actors acquire the defeated player within this same tick.
          if (this.defeated) return;
          // The keg blast also stuns its carrier: a long recovery is the punish window.
          if (e.role === 'powder' && !e.miniboss && e.kind !== 'king' && !e.storyPattern) this.events.push({ type: 'explode', id: e.id, at: clone(e.p) });
          // A powder warden's phase-2 barrage bursts where it landed.
          else if (e.role === 'powder' && e.storyPattern === 'echo-warden' && e.phase === 2 && e.attack === 'burst') this.events.push({ type: 'explode', id: e.id, at: clone(e.target) });
          e.mode = 'recover'; e.timer = enemyAttackTiming(e).recovery + (evaded ? PERFECT_EVADE.opening : 0);
        }
        continue;
      }
      if (e.mode === 'recover' || e.mode === 'stagger') { if (e.timer <= 0) { e.mode = 'chase'; e.timer = enemyRangedSpacing(e) ? ENEMY_TACTICS.rangedReset : .25; } continue; }
      const isBoss = e === this.boss, elite = minibossProfile(e);
      const role = ENEMY_ROLES[e.role];
      const meleeRange = e.creature === 'tide-limb' ? CREATURES['tide-limb'].reach : e.storyPattern === 'echo-warden' ? ECHO_WARDEN.range : isBoss ? 6 : elite?.range ?? role.range;
      if (e.role === 'shinobi' && !isBoss && !elite && (!e.storyPattern || e.phase === 2) && sees && e.timer <= 0 && !e.blinkCooldown && dist > SHINOBI_BLINK.min && dist < SHINOBI_BLINK.max && hasEnemyPressureSlot(e, this.enemies, player)) {
        // Vanish and reappear behind the player (far side of the approach), then a readable cut.
        const p = terrain.walk(player, player.x + (player.x - e.p.x) / dist * SHINOBI_BLINK.behind, player.z + (player.z - e.p.z) / dist * SHINOBI_BLINK.behind);
        e.blinkCooldown = SHINOBI_BLINK.cooldown;
        if (p && distanceXZ(p, e.home) <= COMBAT.leash) {
          const from = clone(e.p); e.p = p;
          this.events.push({ type: 'blink', id: e.id, from, to: clone(p) });
          e.attack = e.storyPattern ? 'sweep' : role.attack; Object.assign(e.target, player); e.attackCount++;
          e.mode = 'windup'; e.timer = enemyAttackTiming(e).windup;
          continue;
        }
      }
      const signature = !isBoss && !e.storyPattern ? elite?.signature : undefined;
      if (signature && sees && e.timer <= 0 && (e.attackCount + 1) % signatureCadence(signature, e.phase) === 0 && dist >= signature.min && dist <= signature.max && hasEnemyPressureSlot(e, this.enemies, player)) {
        // The elite's rarer move: a full tell of its own, then a longer recovery to punish.
        e.signatureActive = true; e.attack = signature.attack; Object.assign(e.target, player); e.attackCount++;
        e.mode = 'windup'; e.timer = enemyAttackTiming(e).windup;
        this.events.push({ type: 'signature', id: e.id, name: signature.name, counter: signature.counter });
        continue;
      }
      if (isBoss && this.hazards.length) e.timer = Math.max(e.timer, .4);
      if (sees && e.timer <= 0 && (dist < meleeRange || isBoss && dist < 40) && hasEnemyPressureSlot(e, this.enemies, player)) {
        e.signatureActive = false;
        e.attack = e.storyPattern === 'echo-warden' ? chooseEchoWardenAttack(e, dist) : elite?.attack ?? (isBoss ? chooseBossAttack(e, dist) : role.attack);
        Object.assign(e.target, player); e.attackCount++;
        e.mode = 'windup'; e.timer = enemyAttackTiming(e).windup;
        continue;
      }
      const spacing = enemyRangedSpacing(e);
      const retreat = spacing > 0 && dist < spacing && e.timer > 0;
      // The Tide-Eater limb is rooted in the riverbed: it turns and swings, never walks.
      if (e.creature !== 'tide-limb' && (dist > 1.7 || retreat) && (sees || isBoss && heightOk)) {
        // 最后方阵 advances on the drum: a step on each beat, a held line between beats.
        const drum = e.id === LAST_SQUARE.id ? .35 + 1.3 * Math.max(0, Math.sin((e.squareDrum = (e.squareDrum ?? 0) + dt) * LAST_SQUARE.drum)) : 1;
        const speed = (isBoss ? e.phase === 2 ? 5.0 : 3.8 : elite ? elite.speed * (e.phase === 2 ? ELITE_RALLY.speed : 1) : role.speed) * drum;
        const step = Math.min(speed * dt, retreat ? spacing - dist : Math.max(0, dist - 1.7));
        const angle = Math.atan2(player.z - e.p.z, player.x - e.p.x) + (retreat ? Math.PI : 0);
        // A few local alternatives let the king skirt ruined pillars; never phase through them.
        for (const turn of isBoss ? BOSS_TURNS : enemyWalkTurns(e)) {
          const p = terrain.walk(e.p, e.p.x + Math.cos(angle + turn) * step, e.p.z + Math.sin(angle + turn) * step);
          if (p && (isBoss || distanceXZ(p, e.home) <= COMBAT.leash)) { e.p = p; break; }
        }
      }
    }
    this.stepHazards(dt, localPlayer);
    if (!this.remoteEnemies) this.stepCrowCurtain(dt, localPlayer);
    if (this.defeated) return;
    this.quietFor = threatened ? 0 : this.quietFor + dt;
    if (this.quietFor > 5) this.hp = Math.min(this.maxHp, this.hp + dt * 10);
    if (this.quietFor > 5 && this.ammo < WORLD_RIFLE.ammoTrickleCap) { this.ammoTrickle += dt; if (this.ammoTrickle >= WORLD_RIFLE.ammoTrickleEvery) { this.ammoTrickle = 0; this.ammo++; } } else this.ammoTrickle = 0;
  }
}

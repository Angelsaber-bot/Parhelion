import { KNIGHT_TRIAL_ID, KNIGHT_TRIAL_CLEAR } from './authoredEncounters';
import { bossAttackTiming, chooseBossAttack, bossAttackDamage } from './bossPatterns';
import { ERA_BOSS_REQUIREMENTS } from './eraStories';
import { minibossProfile } from './minibosses';
import { ENEMY_ROLES, selectEnemyRole, type EnemyRole } from './enemyRoles';
/** Small, local World encounter simulation. No networking/Arena rules are changed. */
export interface Point3 { x: number; y: number; z: number }
export type EnemyKind = 'shade' | 'crystal' | 'king';
export type EnemyMode = 'idle' | 'chase' | 'windup' | 'recover' | 'stagger' | 'pacified' | 'dead';
export interface SpawnPoint { id: string; kind: EnemyKind; p: Point3; miniboss?: string; role?: EnemyRole; encounter?: 'akechi' }
export interface Enemy extends SpawnPoint {
  home: Point3; hp: number; maxHp: number; mode: EnemyMode; timer: number;
  active: boolean; phase: 1 | 2; attack: 'sweep' | 'burst' | 'shot' | 'thrust'; target: Point3;
  attackCount: number; hitTime: number; role: EnemyRole; staggerCooldown: number; pacified: boolean;
}
export type CombatEvent =
  | { type: 'hit'; id: string; damage: number; source?: HitContext['source']; punish?: boolean }
  | { type: 'kill'; id: string }
  | { type: 'stagger'; id: string }
  | { type: 'hurt'; damage: number }
  | { type: 'victory'; id: string; firstClear: boolean }
  | { type: 'bossStart' | 'bossReset' | 'phase' | 'death' | 'revive' };
export interface CombatTerrain {
  /** Grounded position or null when water, steep, blocked or outside the arena. */
  walk(from: Point3, x: number, z: number): Point3 | null;
  lineOfSight(from: Point3, to: Point3): boolean;
}
export const COMBAT = {
  playerHp: 100, shotDamage: 16, shotInterval: 0.14, shotRange: 150, shotBurst: 8, shotVent: 1.1, meleePunish: 2,
  wildernessCap: 160, activeRange: 82, hideRange: 120, aggroRange: 20,
  leash: 35, respawn: 35, bossLeash: 68, bossHp: 1800,
} as const;
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
  { x: 660, z: -60, r: 24, kind: 'crystal' as const },
  { x: 780, z: -70, r: 22, kind: 'crystal' as const },
  { x: 640, z: -100, r: 20, kind: 'crystal' as const },
  { x: 850, z: 10, r: 20, kind: 'crystal' as const },
  { x: 760, z: 70, r: 22, kind: 'crystal' as const },
  { x: 145, z: 140, r: 20, kind: 'shade' as const },
  // 永冬之城 (region offset z - 720): the bank road, the snowfield, the Smolensk road, the gorge mouth
  { x: -90, z: -540, r: 24, kind: 'crystal' as const },
  { x: -120, z: -680, r: 26, kind: 'shade' as const },
  { x: 40, z: -680, r: 24, kind: 'shade' as const },
  { x: 130, z: -550, r: 22, kind: 'crystal' as const },
  { x: 90, z: -800, r: 20, kind: 'shade' as const },
  // 业火京都 (region offset z + 720): north-east streets, the Kinkaku road, below Higashiyama, the ninth street, the southern plain
  { x: 100, z: 560, r: 20, kind: 'shade' as const },
  { x: -172, z: 612, r: 20, kind: 'crystal' as const },
  { x: 222, z: 652, r: 18, kind: 'shade' as const },
  { x: -100, z: 855, r: 22, kind: 'shade' as const },
  { x: 60, z: 950, r: 26, kind: 'crystal' as const },
  // Additional remote pockets: keep the 82 m active window and town-safe placement,
  // while raising the seeded wilderness roster by roughly 23%.
  { x: -260, z: -220, r: 20, kind: 'shade' as const },
  { x: 260, z: -210, r: 20, kind: 'shade' as const },
  { x: 300, z: 120, r: 18, kind: 'shade' as const },
  { x: 900, z: 130, r: 20, kind: 'crystal' as const },
  { x: -220, z: -840, r: 20, kind: 'crystal' as const },
  { x: 260, z: 860, r: 20, kind: 'shade' as const },
  // Gap fill (measured >130 m from any spawn on the real map); `pack` zones seed a group of 5.
  { x: -870, z: 290, r: 14, kind: 'shade' as const, pack: 5 },
  { x: -420, z: 350, r: 14, kind: 'crystal' as const },
  { x: 930, z: -280, r: 14, kind: 'shade' as const, pack: 5 },
  { x: 270, z: -1000, r: 14, kind: 'crystal' as const, pack: 5 },
  { x: 0, z: -220, r: 14, kind: 'shade' as const, pack: 5 },
  { x: -90, z: 380, r: 14, kind: 'crystal' as const },
  { x: 540, z: 200, r: 14, kind: 'shade' as const },
  { x: -300, z: 1010, r: 14, kind: 'crystal' as const, pack: 5 },
  { x: -900, z: 50, r: 14, kind: 'shade' as const },
  { x: -630, z: 230, r: 14, kind: 'crystal' as const },
  { x: -510, z: -340, r: 14, kind: 'shade' as const },
  { x: 240, z: 380, r: 14, kind: 'crystal' as const },
  { x: -60, z: -1000, r: 14, kind: 'shade' as const },
  { x: 510, z: -280, r: 14, kind: 'crystal' as const },
  { x: 300, z: -700, r: 14, kind: 'shade' as const },
  { x: -300, z: -430, r: 14, kind: 'crystal' as const },
  { x: 420, z: -70, r: 14, kind: 'shade' as const },
  { x: -840, z: -280, r: 14, kind: 'crystal' as const },
  { x: -300, z: 800, r: 14, kind: 'shade' as const },
  { x: 720, z: -280, r: 14, kind: 'crystal' as const },
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
  { x: 552, z: 42, r: 12, kind: 'shade' as const },
  { x: 673, z: 167, r: 12, kind: 'shade' as const },
  { x: 860, z: -132, r: 12, kind: 'shade' as const },
  { x: 221, z: -615, r: 12, kind: 'shade' as const },
  { x: -214, z: -628, r: 12, kind: 'shade' as const },
  { x: -4, z: -859, r: 12, kind: 'shade' as const },
  { x: 7, z: 703, r: 12, kind: 'shade' as const },
  { x: -299, z: 616, r: 12, kind: 'shade' as const },
  { x: 7, z: 823, r: 12, kind: 'shade' as const },
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

function makeEnemy(s: SpawnPoint): Enemy {
  const maxHp = s.kind === 'king' ? COMBAT.bossHp : minibossProfile(s)?.hp ?? (s.kind === 'crystal' ? 88 : 66);
  return { ...s, p: clone(s.p), home: clone(s.p), maxHp, hp: maxHp, mode: 'idle', timer: 0,
    active: false, phase: 1, attack: 'sweep', target: clone(s.p), attackCount: 0, hitTime: 0, role: s.role ?? selectEnemyRole({ ...s, home: s.p }), staggerCooldown: 0, pacified: false };
}

/** Shared deterministic role selection keeps the rendered weapon and damage behavior aligned. */
export function isMusketeer(e: Pick<Enemy, 'kind' | 'miniboss' | 'home' | 'id'> & { role?: EnemyRole }): boolean {
  return e.kind !== 'king' && !e.miniboss && (e.role ?? selectEnemyRole(e)) === 'musketeer';
}
/** Shared by simulation and renderer: telegraphs must show the actual damage footprint. */
export function enemyAttackRadius(e: Enemy): number {
  if (e.attack === 'shot') return 1.4;
  if (e.attack === 'thrust') return e.kind === 'king' ? 1.2 : ENEMY_ROLES[e.role].radius;
  if (e.kind === 'king') return e.attack === 'burst' ? (e.phase === 2 ? 6.2 : 4.8) : 5.5;
  return minibossProfile(e)?.radius ?? ENEMY_ROLES[e.role].radius;
}

const ELITE_PAIRED_TIMING = { windup: 1, recovery: .55 } as const;
const DUELIST_FIRST_TIMING = { windup: .85, recovery: .45 } as const;
const BOSS_TURNS = [0, .8, -.8, 1.3, -1.3] as const;
const ENEMY_TURNS = [0] as const;
export interface HitContext { source: 'ranged' | 'melee' | 'servant' | 'skill' | 'ultimate'; origin?: Point3 }

/** Thrust tells and impact share a forward rectangle, never a tracking/homing hit. */
export function enemyThrustLength(e: Enemy): number { return e.kind === 'king' ? 8 : ENEMY_ROLES[e.role].range + 1; }
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
  if (!Number.isFinite(distance)) return .45;
  return Math.max(.45, 1 - Math.min(1, Math.max(0, (distance - 18) / 47)) * .55);
}

/** Timings are shared with animation playback; each slash in a pair has its own full tell. */
export function enemyAttackTiming(e: Enemy): { windup: number; recovery: number } {
  if (e.kind === 'king') return bossAttackTiming(e);
  const elite = minibossProfile(e);
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
  defeatedFor = 0;
  bossStarted = false;
  shotCooldown = 0;
  gunHeat = 0;
  gunVent = 0;
  private gunIdleFor = 0;
  hurtCooldown = 0;
  quietFor = 0;
  private guardMultiplier = 1;
  private invulnerable = false;
  private trialPending = false;
  private trialReplay = false;
  private readonly knight: Enemy | undefined;
  private relayPacified = false;
  private roadPacified = false;
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
    const i = id === undefined ? 0 : this.bosses.findIndex(b => b.id === id);
    if (i < 0 || i >= this.bosses.length || this.bossStarted || this.defeated) return false;
    if (!this.cleared[i] && !this.requires[i].every(r => done.has(r))) return false;
    this.current = i;
    this.resetEnemy(this.boss);
    this.boss.active = true; this.boss.mode = 'chase'; this.boss.timer = 1.4;
    this.bossStarted = true; this.hp = COMBAT.playerHp; this.quietFor = 0;
    this.shotCooldown = 0; this.gunHeat = 0; this.gunVent = 0; this.gunIdleFor = 0; this.hurtCooldown = 0;
    this.events.push({ type: 'bossStart' });
    return true;
  }
  /** `cleared` applies to every boss, or pass a per-boss list (same order as the constructor). */
  resetAll(cleared: boolean | boolean[] = false) {
    this.bossStarted = false; this.trialPending = false; this.trialReplay = false; this.quietKyotoRoute = false; this.relayPacified = false; this.roadPacified = false;
    this.current = 0; this.quietFor = 0; this.setDefense({ guard: 1, invulnerable: false });
    this.hp = COMBAT.playerHp; this.defeatedFor = 0; this.shotCooldown = 0; this.gunHeat = 0; this.gunVent = 0; this.gunIdleFor = 0; this.hurtCooldown = 0;
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
    e.phase = 1; e.attackCount = 0; e.hitTime = 0; e.staggerCooldown = 0;
  }
  resetBoss() {
    if (!this.bossStarted) return;
    this.bossStarted = false; this.resetEnemy(this.boss); this.events.push({ type: 'bossReset' });
  }
  syncWorldFlags(done: ReadonlySet<string>) {
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
  recoverAtSettlement(amount: number): boolean {
    if (this.defeated || this.bossStarted || this.quietFor < 5 || !Number.isFinite(amount) || amount <= 0 || this.hp >= COMBAT.playerHp) return false;
    this.hp = Math.min(COMBAT.playerHp, this.hp + Math.min(25, amount)); return true;
  }
  canShoot() {
    if (this.defeated || this.shotCooldown > 1e-9 || this.gunVent > 1e-9) return false;
    // Carry a small render-frame overrun during held fire, never bank free shots after idle/vent.
    this.shotCooldown = this.gunHeat === 0 || this.gunIdleFor > COMBAT.shotInterval * 2 ? COMBAT.shotInterval : Math.max(1e-6, this.shotCooldown + COMBAT.shotInterval);
    this.gunIdleFor = 0;
    this.gunHeat++;
    if (this.gunHeat >= COMBAT.shotBurst) this.gunVent = COMBAT.shotVent;
    return true;
  }
  hitEnemy(id: string, damage: number = COMBAT.shotDamage, context?: HitContext) {
    const e = this.enemies.find(e => e.id === id);
    if (!e || !e.active || e.mode === 'dead' || e.pacified || this.defeated || !Number.isFinite(damage) || damage <= 0) return false;
    // Melee earns a real punish window, not inflated enemy HP. Legacy raw damage stays exact.
    const melee = context?.source === 'melee';
    const punish = melee && isMeleePunishWindow(e);
    const dealt = Math.min(e.hp, Math.round(damage * (punish ? COMBAT.meleePunish : 1) * (context?.source === 'ranged' && context.origin ? rangedDamageMultiplier(distanceXZ(context.origin, e.p)) : 1) * 100) / 100);
    e.hp -= dealt; e.hitTime = 0.11;
    this.events.push({ type: 'hit', id, damage: dealt, source: context?.source, punish });
    if (e.hp <= 0) {
      e.mode = 'dead'; e.timer = e.id === KNIGHT_TRIAL_ID ? Infinity : e.miniboss ? 120 : COMBAT.respawn; e.active = false;
      if (e.id === KNIGHT_TRIAL_ID) this.trialReplay = false;
      this.events.push({ type: 'kill', id });
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
      if (e === this.boss && e.phase === 1 && e.hp <= e.maxHp / 2) {
        e.phase = 2; e.mode = 'recover'; e.timer = 1.2;
        this.events.push({ type: 'phase' });
      }
    }
    return true;
  }
  /** Ray-sphere intersections use world metres. maxDistance must include every wall/quest-target occluder. */
  raycast(origin: Point3, direction: Point3, maxDistance: number = COMBAT.shotRange) {
    let best: { id: string; distance: number; point: Point3 } | null = null;
    const length = Math.hypot(direction.x, direction.y, direction.z);
    if (!length || !Number.isFinite(length)) return best;
    const d = { x: direction.x / length, y: direction.y / length, z: direction.z / length };
    for (const e of this.enemies) {
      if (!e.active || e.mode === 'dead' || e.pacified) continue;
      const radius = e.kind === 'king' ? 1.45 : 0.8;
      const center = { x: e.p.x, y: e.p.y + (e.kind === 'king' ? 1.8 : 1.05), z: e.p.z };
      const x = origin.x - center.x, y = origin.y - center.y, z = origin.z - center.z;
      const b = x * d.x + y * d.y + z * d.z, c = x * x + y * y + z * z - radius * radius;
      const disc = b * b - c;
      if (disc < 0) continue;
      const distance = Math.max(0, -b - Math.sqrt(disc));
      if (-b + Math.sqrt(disc) < 0 || distance >= maxDistance || best && distance >= best.distance) continue;
      best = { id: e.id, distance, point: { x: origin.x + d.x * distance, y: origin.y + d.y * distance, z: origin.z + d.z * distance } };
    }
    return best;
  }
  /** Supplied by the active player action each frame; pause/reset must clear defense. */
  setDefense(defense: { guard: number; invulnerable: boolean }) {
    this.guardMultiplier = Number.isFinite(defense.guard) ? Math.min(1, Math.max(.55, defense.guard)) : 1;
    this.invulnerable = defense.invulnerable === true && !this.defeated;
  }
  private hurt(amount: number) {
    if (this.hurtCooldown > 0 || this.defeated || this.invulnerable) return;
    amount = Math.min(this.hp, Math.round(amount * this.guardMultiplier * 100) / 100);
    this.hp = Math.max(0, this.hp - amount); this.hurtCooldown = 0.45; this.quietFor = 0;
    this.events.push({ type: 'hurt', damage: amount });
    if (!this.hp) {
      this.defeatedFor = 2.5; this.setDefense({ guard: 1, invulnerable: false }); this.resetBoss();
      for (const e of this.enemies) if (!this.bosses.includes(e) && e.mode !== 'dead') this.resetEnemy(e);
      this.events.push({ type: 'death' });
    }
  }
  step(dt: number, player: Point3, active: boolean, terrain: CombatTerrain) {
    if (!active) { this.setDefense({ guard: 1, invulnerable: false }); return; }
    if (!Number.isFinite(dt) || dt <= 0) return;
    dt = Math.min(dt, 0.1);
    this.shotCooldown = Math.max(-COMBAT.shotInterval, this.shotCooldown - dt);
    this.gunIdleFor += dt;
    this.gunVent = Math.max(0, this.gunVent - dt);
    if (this.gunVent <= 1e-9) this.gunVent = 0;
    if (!this.gunVent && this.gunIdleFor + 1e-9 >= COMBAT.shotVent) this.gunHeat = 0;
    this.hurtCooldown = Math.max(0, this.hurtCooldown - dt);
    if (this.defeated) {
      this.defeatedFor = Math.max(0, this.defeatedFor - dt);
      if (!this.defeated) { this.hp = COMBAT.playerHp; this.hurtCooldown = 2; this.events.push({ type: 'revive' }); }
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
      if (this.bosses.includes(e) && !(this.bossStarted && e === this.boss)) { e.active = false; continue; }
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
      const quietLane = this.quietKyotoRoute && e.encounter === 'akechi' && player.x < -213 && player.z < 870;
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
          if (enemyAttackContains(e, player) && sees) this.hurt(e === this.boss ? bossAttackDamage(e) : minibossProfile(e)?.damage ?? ENEMY_ROLES[e.role].damage);
          e.mode = 'recover'; e.timer = enemyAttackTiming(e).recovery;
        }
        continue;
      }
      if (e.mode === 'recover' || e.mode === 'stagger') { if (e.timer <= 0) { e.mode = 'chase'; e.timer = 0.25; } continue; }
      const isBoss = e === this.boss, elite = minibossProfile(e);
      const role = ENEMY_ROLES[e.role];
      const meleeRange = isBoss ? 6 : elite?.range ?? role.range;
      if (sees && e.timer <= 0 && (dist < meleeRange || isBoss && dist < 40)) {
        e.attack = elite?.attack ?? (isBoss ? chooseBossAttack(e, dist) : role.attack);
        Object.assign(e.target, player); e.attackCount++;
        e.mode = 'windup'; e.timer = enemyAttackTiming(e).windup;
        continue;
      }
      if (dist > 1.7 && (sees || isBoss && heightOk)) {
        const speed = isBoss ? e.phase === 2 ? 5.0 : 3.8 : elite?.speed ?? role.speed;
        const step = Math.min(speed * dt, dist - 1.7);
        const angle = Math.atan2(player.z - e.p.z, player.x - e.p.x);
        // A few local alternatives let the king skirt ruined pillars; never phase through them.
        for (const turn of isBoss ? BOSS_TURNS : ENEMY_TURNS) {
          const p = terrain.walk(e.p, e.p.x + Math.cos(angle + turn) * step, e.p.z + Math.sin(angle + turn) * step);
          if (p) { e.p = p; break; }
        }
      }
    }
    this.quietFor = threatened ? 0 : this.quietFor + dt;
    if (this.quietFor > 5) this.hp = Math.min(COMBAT.playerHp, this.hp + dt * 10);
  }
}

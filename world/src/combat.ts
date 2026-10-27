/** Small, local World encounter simulation. No networking/Arena rules are changed. */
export interface Point3 { x: number; y: number; z: number }
export type EnemyKind = 'shade' | 'crystal' | 'king';
export type EnemyMode = 'idle' | 'chase' | 'windup' | 'recover' | 'dead';
export interface SpawnPoint { id: string; kind: EnemyKind; p: Point3 }
export interface Enemy extends SpawnPoint {
  home: Point3; hp: number; maxHp: number; mode: EnemyMode; timer: number;
  active: boolean; phase: 1 | 2; attack: 'sweep' | 'burst'; target: Point3;
  attackCount: number; hitTime: number;
}
export type CombatEvent =
  | { type: 'hit'; id: string; damage: number }
  | { type: 'kill'; id: string }
  | { type: 'hurt'; damage: number }
  | { type: 'bossStart' | 'bossReset' | 'phase' | 'victory' | 'death' | 'revive' };
export interface CombatTerrain {
  /** Grounded position or null when water, steep, blocked or outside the arena. */
  walk(from: Point3, x: number, z: number): Point3 | null;
  lineOfSight(from: Point3, to: Point3): boolean;
}
export const COMBAT = {
  playerHp: 100, shotDamage: 22, shotInterval: 0.14, shotRange: 150,
  wildernessCap: 12, activeRange: 82, hideRange: 120, aggroRange: 20,
  leash: 35, respawn: 45, bossLeash: 68, bossHp: 1800,
} as const;
export const BOSS_REQUIREMENTS = ['saber_contract', 'shard_camp', 'shard_tower', 'shard_table'] as const;
export const BOSS_REWARD = 'reward_sunset_oath';
/** One sun-core boss per era: the marker it stands on, the core that starts it, what it needs and grants. */
export interface BossDef { id: string; core: string; requires: readonly string[]; reward: string }
export const BOSSES: BossDef[] = [
  { id: 'boss_vacant_king', core: 'sun_core', requires: BOSS_REQUIREMENTS, reward: BOSS_REWARD },
  { id: 'boss_drowned_admiral', core: 'sea_core', requires: ['shard_powder', 'shard_compass', 'shard_treasure'], reward: 'reward_black_sail' },
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
];
export function makeWildernessSpawns(seed: number, place: (x: number, z: number) => Point3 | null): SpawnPoint[] {
  let state = seed >>> 0;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  const points: SpawnPoint[] = [];
  for (const [index, zone] of WILDERNESS_ZONES.entries()) {
    for (let attempt = 0; attempt < 32; attempt++) {
      const a = random() * Math.PI * 2, r = Math.sqrt(random()) * zone.r;
      const p = place(zone.x + Math.cos(a) * r, zone.z + Math.sin(a) * r);
      if (!p || points.some(s => distanceXZ(s.p, p) < 18)) continue;
      points.push({ id: `wild_${index}`, kind: zone.kind, p });
      break;
    }
  }
  return points;
}

function makeEnemy(s: SpawnPoint): Enemy {
  const maxHp = s.kind === 'king' ? COMBAT.bossHp : s.kind === 'crystal' ? 88 : 66;
  return { ...s, p: clone(s.p), home: clone(s.p), maxHp, hp: maxHp, mode: 'idle', timer: 0,
    active: false, phase: 1, attack: 'sweep', target: clone(s.p), attackCount: 0, hitTime: 0 };
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
  hurtCooldown = 0;
  quietFor = 0;
  private readonly events: CombatEvent[] = [];
  constructor(spawns: SpawnPoint[], boss: BossSpawn | BossSpawn[], cleared = false) {
    const list = [boss].flat();
    this.enemies = spawns.slice(0, COMBAT.wildernessCap).map(makeEnemy);
    this.bosses = list.map(b => makeEnemy({ id: b.id, p: b.p, kind: 'king' }));
    this.requires = list.map(b => b.requires ?? BOSS_REQUIREMENTS);
    this.cleared = list.map(b => b.cleared ?? cleared);
    this.enemies.push(...this.bosses);
    this.bosses.forEach((b, i) => { if (this.cleared[i]) { b.hp = 0; b.mode = 'dead'; } });
  }
  get boss() { return this.bosses[this.current]; }
  get bossCleared() { return this.cleared[this.current]; }
  isCleared(id: string) { const i = this.bosses.findIndex(b => b.id === id); return i >= 0 && this.cleared[i]; }
  drainEvents() { return this.events.splice(0); }
  get defeated() { return this.defeatedFor > 0; }
  /** Start a boss fight (the first boss when no id is given) once its requirements are done. */
  beginBoss(done: ReadonlySet<string>, id?: string) {
    const i = id === undefined ? 0 : this.bosses.findIndex(b => b.id === id);
    if (i < 0 || this.bossStarted) return false;
    this.current = i;
    if (this.bossCleared || this.defeated || !this.requires[i].every(r => done.has(r))) return false;
    this.resetEnemy(this.boss);
    this.boss.active = true; this.boss.mode = 'chase'; this.boss.timer = 1.4;
    this.bossStarted = true; this.hp = COMBAT.playerHp; this.quietFor = 0;
    this.events.push({ type: 'bossStart' });
    return true;
  }
  /** `cleared` applies to every boss, or pass a per-boss list (same order as the constructor). */
  resetAll(cleared: boolean | boolean[] = false) {
    this.bossStarted = false;
    this.hp = COMBAT.playerHp; this.defeatedFor = 0; this.shotCooldown = 0; this.hurtCooldown = 0;
    for (const e of this.enemies) this.resetEnemy(e);
    this.bosses.forEach((b, i) => {
      this.cleared[i] = Array.isArray(cleared) ? !!cleared[i] : cleared;
      if (this.cleared[i]) { b.hp = 0; b.mode = 'dead'; }
    });
    this.events.length = 0;
  }
  private resetEnemy(e: Enemy) {
    e.p = clone(e.home); e.hp = e.maxHp; e.mode = 'idle'; e.timer = 0; e.active = false;
    e.phase = 1; e.attackCount = 0; e.hitTime = 0;
  }
  resetBoss() {
    if (!this.bossStarted) return;
    this.bossStarted = false; this.resetEnemy(this.boss); this.events.push({ type: 'bossReset' });
  }
  canShoot() {
    if (this.defeated || this.shotCooldown > 0) return false;
    this.shotCooldown = COMBAT.shotInterval;
    return true;
  }
  hitEnemy(id: string, damage: number = COMBAT.shotDamage) {
    const e = this.enemies.find(e => e.id === id);
    if (!e || !e.active || e.mode === 'dead' || this.defeated || !Number.isFinite(damage) || damage <= 0) return false;
    const dealt = Math.min(e.hp, damage);
    e.hp -= dealt; e.hitTime = 0.11;
    this.events.push({ type: 'hit', id, damage: dealt });
    if (e.hp <= 0) {
      e.mode = 'dead'; e.timer = COMBAT.respawn; e.active = false;
      this.events.push({ type: 'kill', id });
      if (e === this.boss) { this.bossStarted = false; this.cleared[this.current] = true; this.events.push({ type: 'victory' }); }
    } else {
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
      if (!e.active || e.mode === 'dead') continue;
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
  private hurt(amount: number) {
    if (this.hurtCooldown > 0 || this.defeated) return;
    this.hp = Math.max(0, this.hp - amount); this.hurtCooldown = 0.45; this.quietFor = 0;
    this.events.push({ type: 'hurt', damage: amount });
    if (!this.hp) {
      this.defeatedFor = 2.5; this.resetBoss();
      for (const e of this.enemies) if (!this.bosses.includes(e) && e.mode !== 'dead') this.resetEnemy(e);
      this.events.push({ type: 'death' });
    }
  }
  step(dt: number, player: Point3, active: boolean, terrain: CombatTerrain) {
    if (!active || !Number.isFinite(dt) || dt <= 0) return;
    dt = Math.min(dt, 0.1);
    this.shotCooldown = Math.max(0, this.shotCooldown - dt);
    this.hurtCooldown = Math.max(0, this.hurtCooldown - dt);
    if (this.defeated) {
      this.defeatedFor = Math.max(0, this.defeatedFor - dt);
      if (!this.defeated) { this.hp = COMBAT.playerHp; this.hurtCooldown = 2; this.events.push({ type: 'revive' }); }
      return;
    }
    if (this.bossStarted && (distanceXZ(player, this.boss.home) > COMBAT.bossLeash || Math.abs(player.y - this.boss.home.y) > 24)) this.resetBoss();
    let threatened = false;
    for (const e of this.enemies) {
      e.hitTime = Math.max(0, e.hitTime - dt);
      if (this.bosses.includes(e) && !(this.bossStarted && e === this.boss)) { e.active = false; continue; }
      const dist = distanceXZ(e.p, player);
      if (e.mode === 'dead') {
        e.timer -= dt;
        if (e !== this.boss && e.timer <= 0 && distanceXZ(e.home, player) > 30) this.resetEnemy(e);
        continue;
      }
      if (dist > COMBAT.hideRange) { this.resetEnemy(e); continue; }
      e.active = dist < COMBAT.activeRange;
      if (!e.active) continue;
      const heightOk = Math.abs(player.y - e.p.y) < (e === this.boss ? 8 : 3);
      const from = { x: e.p.x, y: e.p.y + 1.2, z: e.p.z };
      const to = { x: player.x, y: player.y + 1, z: player.z };
      const sees = heightOk && terrain.lineOfSight(from, to);
      if (e.mode === 'idle') { if (dist < COMBAT.aggroRange && sees) e.mode = 'chase'; else continue; }
      if (e !== this.boss && (distanceXZ(e.home, player) > COMBAT.leash || distanceXZ(e.home, e.p) > COMBAT.leash)) { this.resetEnemy(e); continue; }
      threatened = true;
      e.timer -= dt;
      if (e.mode === 'windup') {
        if (e.timer <= 0) {
          const radius = e === this.boss ? (e.attack === 'burst' ? (e.phase === 2 ? 6.2 : 4.8) : 5.5) : 2.4;
          const center = e.attack === 'burst' ? e.target : e.p;
          if (distanceXZ(center, player) < radius && Math.abs(player.y - center.y) < 2.6 && sees) this.hurt(e === this.boss ? e.phase === 2 ? 32 : 25 : 12);
          e.mode = 'recover'; e.timer = e === this.boss ? e.phase === 2 ? 0.65 : 1.0 : 1.0;
        }
        continue;
      }
      if (e.mode === 'recover') { if (e.timer <= 0) { e.mode = 'chase'; e.timer = 0.25; } continue; }
      const isBoss = e === this.boss;
      if (sees && e.timer <= 0 && (dist < (isBoss ? 6 : 2) || isBoss && dist < 40 && e.attackCount % 2 === 0)) {
        e.attack = isBoss && dist >= 6 ? 'burst' : 'sweep';
        e.target = clone(player); e.attackCount++;
        e.mode = 'windup'; e.timer = isBoss ? e.phase === 2 ? 1.0 : 1.4 : 0.65;
        continue;
      }
      if (dist > 1.7 && (sees || isBoss && heightOk)) {
        const speed = isBoss ? e.phase === 2 ? 5.0 : 3.8 : 3.2;
        const step = Math.min(speed * dt, dist - 1.7);
        const angle = Math.atan2(player.z - e.p.z, player.x - e.p.x);
        // A few local alternatives let the king skirt ruined pillars; never phase through them.
        for (const turn of isBoss ? [0, 0.8, -0.8, 1.3, -1.3] : [0]) {
          const p = terrain.walk(e.p, e.p.x + Math.cos(angle + turn) * step, e.p.z + Math.sin(angle + turn) * step);
          if (p) { e.p = p; break; }
        }
      }
    }
    this.quietFor = threatened ? 0 : this.quietFor + dt;
    if (this.quietFor > 5) this.hp = Math.min(COMBAT.playerHp, this.hp + dt * 10);
  }
}

// Game content tables: tick rate, characters, weapons, skins, match rules.
// Everything that affects simulation lives here so client and server agree by construction.

export const TICK_HZ = 60;
export const DT = 1 / TICK_HZ;
export const SNAPSHOT_EVERY = 3; // 20 Hz snapshots
export const INTERP_TICKS = 6; // remote players render ~100 ms behind the newest snapshot
export const MAX_REWIND_TICKS = 15; // lag compensation window (250 ms)

export type Team = 'A' | 'B';
export type TeamLayout = '1v1' | '1v2' | '2v2';

export const TEAM_CAPACITY: Record<TeamLayout, Record<Team, number>> = {
  '1v1': { A: 1, B: 1 },
  '1v2': { A: 1, B: 2 },
  '2v2': { A: 2, B: 2 },
};

export const SCORE_LIMIT: Record<TeamLayout, number> = { '1v1': 7, '1v2': 10, '2v2': 12 };
export const MATCH_TICKS = 5 * 60 * TICK_HZ;
export const COUNTDOWN_TICKS = 3 * TICK_HZ;
export const END_TICKS = 6 * TICK_HZ;
export const RESPAWN_TICKS = 3 * TICK_HZ;
/** Full protection after every spawn; firing never cancels it. Separate from death delay. */
export const SPAWN_PROTECTION_TICKS = 2.5 * TICK_HZ;

export const MOVE = {
  gravity: 18,
  jump: 6.2,
  airControl: 3, // 1/s, how fast air velocity bends toward the wish direction
  substep: 0.06, // metres per collision substep
};

export const DASH = { speed: 17, ticks: 9, charges: 3, cooldown: 5 * TICK_HZ }; // ~2.6 m burst

/** Holding a melee weapon (any kind) moves faster; applies to players and bots alike in the shared sim. */
export const MELEE_MOVE = {
  speedMultiplier: 1.2,
  /** Gunfire against someone holding a melee weapon deals this fraction (melee must survive the approach). */
  gunDamageTaken: 0.75,
  /** Ticks after impact during which the swing still connects with whatever the attacker turns onto. */
  activeTicks: 5,
};

export const SHIELD = {
  hp: 300,
  width: 2.4,
  height: 2.0,
  distance: 1.4, // placed this far in front of the caster
  life: 10 * TICK_HZ,
  cooldown: 14 * TICK_HZ,
};

/** Utility slot: one grenade per life, chosen before the match, recharging on a cooldown.
 * Server-authoritative projectiles; never part of the two-gun/one-melee loadout. */
export const UTILITY_IDS = ['frag', 'smoke'] as const;
export type UtilityId = typeof UTILITY_IDS[number];
export const DEFAULT_UTILITY: UtilityId = 'frag';
export const UTILITY_ERROR = '道具无效：请选择破片手雷或烟雾弹。';
export function validateUtility(raw: unknown): UtilityId {
  if (raw === undefined) return DEFAULT_UTILITY;
  if (!UTILITY_IDS.includes(raw as UtilityId)) throw new Error(UTILITY_ERROR);
  return raw as UtilityId;
}
export const botUtility = (seed: number): UtilityId => Math.abs(seed | 0) % 3 === 2 ? 'smoke' : 'frag';
export const GRENADE = {
  speed: 15, // m/s along the aim
  lift: 2.4, // extra upward m/s so a level throw still arcs
  inherit: 0.5, // share of the thrower's horizontal velocity
  radius: 0.09,
  gravity: 18,
  restitution: 0.42,
  friction: 0.62, // horizontal speed kept per ground contact
  charges: 2, // grenades carried per life
  cooldown: 14 * TICK_HZ, // to recharge one spent charge
  throwGap: 24, // ticks between two throws
  throwLock: 12, // ticks before the held weapon can fire again
};
/** Lethal to every enemy within `radius`: walls and shields do not stop it (shields in range break),
 * teammates are spared, and the thrower takes a fixed, never-fatal `selfDamage`. Throws people back. */
export const FRAG = { fuse: Math.round(1.6 * TICK_HZ), radius: 6, selfDamage: 50, knockback: 9, lift: 4.5 };
/** Blocks sight; anyone inside takes `cover` of the damage from shooters outside it. */
export const SMOKE = { radius: 5, life: 12 * TICK_HZ, cover: 0.75 };
/** Kill-feed weapon index for grenade kills, outside the WEAPONS catalog on purpose. */
export const FRAG_KILL = 100;

export interface CharacterDef {
  id: string;
  name: string;
  hp: number;
  speed: number; // m/s
  color: number; // accent used by the placeholder avatar
}

export const CHARACTERS: CharacterDef[] = [
  { id: 'aster', name: 'Aster', hp: 150, speed: 5.2, color: 0x63d9db },
  { id: 'vega', name: 'Vega', hp: 125, speed: 5.7, color: 0xefb76a },
];

export const GUN_IDS = ['lumen', 'corona', 'halo', 'firefly', 'longnight'] as const;
export const MELEE_IDS = ['blade', 'polearm', 'hammer'] as const;
export type GunId = typeof GUN_IDS[number];
export type MeleeId = typeof MELEE_IDS[number];
export type WeaponId = GunId | MeleeId;
/** Order is two distinct guns, then one melee. All eight prototype weapons are unlocked. */
export type Loadout = [GunId, GunId, MeleeId];
export const DEFAULT_LOADOUT: Readonly<Loadout> = ['lumen', 'corona', 'blade'];
export const LOADOUT_ERROR = '装备无效：请选择两把不同的枪械和一件近战武器。';
export function isLoadout(raw: unknown): raw is Loadout {
  return Array.isArray(raw) && raw.length === 3 &&
    GUN_IDS.includes(raw[0] as GunId) && GUN_IDS.includes(raw[1] as GunId) &&
    raw[0] !== raw[1] && MELEE_IDS.includes(raw[2] as MeleeId);
}
/** Missing choice uses the public default; malformed/forged choices are rejected, never unlocked. */
export function validateLoadout(raw: unknown): Loadout {
  if (raw === undefined) return [...DEFAULT_LOADOUT];
  if (!isLoadout(raw)) throw new Error(LOADOUT_ERROR);
  return [raw[0], raw[1], raw[2]];
}
export function weaponIndex(id: WeaponId): number { return WEAPONS.findIndex((w) => w.id === id); }
export function loadoutWeapon(loadout: Loadout | Readonly<Loadout>, slot: number): number {
  return weaponIndex(loadout[slot >= 0 && slot < 3 && Number.isInteger(slot) ? slot : 0]);
}
/** Any legal bot kit, uniformly: two distinct guns and one melee. `rand` returns [0, 1). */
export function randomBotLoadout(rand: () => number): Loadout {
  const pick = <T,>(xs: readonly T[]): T => xs[Math.min(xs.length - 1, Math.floor(rand() * xs.length))];
  const first = pick(GUN_IDS);
  return [first, pick(GUN_IDS.filter((g) => g !== first)), pick(MELEE_IDS)];
}
export const randomBotUtility = (rand: () => number): UtilityId => rand() < 1 / 3 ? 'smoke' : 'frag';
export function botLoadout(seed: number): Loadout {
  const n = Math.abs(seed | 0);
  return [GUN_IDS[n % GUN_IDS.length], GUN_IDS[(n + 2) % GUN_IDS.length], MELEE_IDS[n % MELEE_IDS.length]];
}

export interface WeaponDef {
  id: WeaponId;
  kind: 'gun' | 'melee';
  /** Melee start-to-impact ticks and 3D half-angle; heading is locked at attack start. */
  windup?: number;
  arc?: number;
  /** Melee forward lunge (m/s) along the current view during the windup; steerable by turning. */
  lunge?: number;
  name: string;
  auto: boolean;
  interval: number; // ticks between shots
  damage: number; // per pellet
  pellets: number;
  headMul: number;
  spread: number; // radians, base cone half-angle
  spreadMove: number; // extra while moving / airborne
  falloffStart: number;
  falloffEnd: number;
  falloffMin: number; // damage multiplier past falloffEnd
  mag: number;
  reload: number; // ticks
  range: number;
  skins: { id: string; name: string; body: number; accent: number }[];
}

export const WEAPONS: WeaponDef[] = [
  {
    id: 'lumen', kind: 'gun', name: 'Lumen AR', auto: true, interval: 6, damage: 20, pellets: 1, headMul: 1.5,
    spread: 0.006, spreadMove: 0.02, falloffStart: 22, falloffEnd: 45, falloffMin: 0.7,
    mag: 30, reload: Math.round(1.9 * TICK_HZ), range: 150,
    skins: [],
  },
  {
    id: 'corona', kind: 'gun', name: 'Corona SG', auto: false, interval: 39, damage: 20, pellets: 20, headMul: 1.25,
    spread: 0.06, spreadMove: 0.01, falloffStart: 5, falloffEnd: 16, falloffMin: 0.25,
    mag: 6, reload: Math.round(2.3 * TICK_HZ), range: 60,
    skins: [],
  },
  // Halo (2026-11-12 play data): slower cadence and a smaller head bonus so the AR wins close body
  // trades; a head plus a body no longer kills the 150 HP Aster (still kills 125 HP Vega).
  {
    id: 'halo', kind: 'gun', name: 'Halo DMR', auto: false, interval: 25, damage: 52, pellets: 1, headMul: 1.75,
    spread: 0, spreadMove: 0, falloffStart: 60, falloffEnd: 120, falloffMin: 0.85,
    mag: 8, reload: Math.round(2.1 * TICK_HZ), range: 200,
    skins: [],
  },
  // New weapons are distinct prototype tuning, not competitively validated balance.
  {
    id: 'firefly', kind: 'gun', name: 'Firefly SMG · 流萤', auto: true, interval: 4, damage: 14, pellets: 1, headMul: 1.4,
    spread: 0.014, spreadMove: 0.025, falloffStart: 12, falloffEnd: 32, falloffMin: 0.45,
    mag: 50, reload: Math.round(1.65 * TICK_HZ), range: 100,
    skins: [],
  },
  {
    id: 'longnight', kind: 'gun', name: 'Longnight Sniper · 长夜', auto: false, interval: 78, damage: 90, pellets: 1, headMul: 1.7,
    spread: 0, spreadMove: 0, falloffStart: 80, falloffEnd: 180, falloffMin: 0.9,
    mag: 5, reload: Math.round(2.7 * TICK_HZ), range: 240,
    skins: [],
  },
  {
    id: 'blade', kind: 'melee', name: 'Refraction Blade · 折光刃', auto: false, interval: 36, windup: 12, arc: 0.8, lunge: 10,
    damage: 55, pellets: 0, headMul: 1, spread: 0, spreadMove: 0, falloffStart: 3, falloffEnd: 3, falloffMin: 1,
    mag: 0, reload: 0, range: 3,
    skins: [],
  },
  {
    id: 'polearm', kind: 'melee', name: 'Meteor Polearm · 流星', auto: false, interval: 54, windup: 18, arc: 0.5, lunge: 8,
    damage: 70, pellets: 0, headMul: 1, spread: 0, spreadMove: 0, falloffStart: 4.5, falloffEnd: 4.5, falloffMin: 1,
    mag: 0, reload: 0, range: 4.5,
    skins: [],
  },
  {
    id: 'hammer', kind: 'melee', name: 'Fault Hammer · 断层', auto: false, interval: 72, windup: 30, arc: 0.85, lunge: 5,
    damage: 100, pellets: 0, headMul: 1, spread: 0, spreadMove: 0, falloffStart: 2.9, falloffEnd: 2.9, falloffMin: 1,
    mag: 0, reload: 0, range: 2.9,
    skins: [],
  },
];

/** Only curated weapon-exclusive skins are selectable. */
import {SIGNATURE_SKINS} from './signatureSkins.ts';
for(const skin of SIGNATURE_SKINS) WEAPONS.find(w=>w.id===skin.weapon)!.skins.push({id:skin.id,name:`${skin.zh} · ${skin.en}`,body:skin.body,accent:skin.accent});

export function falloff(w: WeaponDef, dist: number): number {
  if (dist <= w.falloffStart) return 1;
  if (dist >= w.falloffEnd) return w.falloffMin;
  const t = (dist - w.falloffStart) / (w.falloffEnd - w.falloffStart);
  return 1 + (w.falloffMin - 1) * t;
}

/** Hit volumes relative to the player's feet. */
export const HITBOX = {
  bodyRadius: 0.36,
  bodyBottom: 0.3,
  bodyTop: 1.35,
  headY: 1.6,
  headRadius: 0.21,
};

/** Authoritative crouch stance. No weapon accuracy/damage bonus; hold-to-crouch is client input. */
export const CROUCH = {
  height: 1.2,
  eye: 1.05,
  speedMultiplier: 0.55,
  hitbox: { bodyRadius: 0.3, bodyBottom: 0.18, bodyTop: 0.85, headY: 1.0, headRadius: 0.18 },
};

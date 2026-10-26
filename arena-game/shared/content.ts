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

export const MOVE = {
  gravity: 18,
  jump: 6.2,
  airControl: 3, // 1/s, how fast air velocity bends toward the wish direction
  substep: 0.06, // metres per collision substep
};

export const DASH = { speed: 17, ticks: 9, cooldown: Math.round(3.5 * TICK_HZ) }; // ~2.6 m burst

export const SHIELD = {
  hp: 300,
  width: 2.4,
  height: 2.0,
  distance: 1.4, // placed this far in front of the caster
  life: 10 * TICK_HZ,
  cooldown: 14 * TICK_HZ,
};

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

export interface WeaponDef {
  id: string;
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
    id: 'lumen', name: 'Lumen AR', auto: true, interval: 6, damage: 20, pellets: 1, headMul: 1.5,
    spread: 0.006, spreadMove: 0.02, falloffStart: 22, falloffEnd: 45, falloffMin: 0.7,
    mag: 30, reload: Math.round(1.9 * TICK_HZ), range: 150,
    skins: [
      { id: 'dawn', name: 'Dawn', body: 0xeaf0ee, accent: 0x63d9db },
      { id: 'ember', name: 'Ember', body: 0x27394b, accent: 0xefb76a },
    ],
  },
  {
    id: 'corona', name: 'Corona SG', auto: false, interval: 48, damage: 12, pellets: 9, headMul: 1.25,
    spread: 0.075, spreadMove: 0.015, falloffStart: 7, falloffEnd: 18, falloffMin: 0.35,
    mag: 6, reload: Math.round(2.3 * TICK_HZ), range: 60,
    skins: [
      { id: 'sakura', name: 'Sakura', body: 0xf3d6dc, accent: 0xd98282 },
      { id: 'graphite', name: 'Graphite', body: 0x3b4450, accent: 0xb8c6ca },
    ],
  },
  {
    id: 'halo', name: 'Halo DMR', auto: false, interval: 22, damage: 52, pellets: 1, headMul: 2,
    spread: 0, spreadMove: 0.03, falloffStart: 60, falloffEnd: 120, falloffMin: 0.85,
    mag: 8, reload: Math.round(2.1 * TICK_HZ), range: 200,
    skins: [
      { id: 'aurora', name: 'Aurora', body: 0xdbe7ff, accent: 0x8f8cff },
      { id: 'solar', name: 'Solar', body: 0xfff1c9, accent: 0xf2a33a },
    ],
  },
];

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

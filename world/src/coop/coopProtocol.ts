/**
 * World co-op wire format. The server (arena-game/worker/worldRelay.ts) only relays; both games
 * run the World locally. The host's game owns enemies; the guest mirrors them and sends its hits.
 * Messages are small JSON with rounded numbers so a 15 Hz state stays ~150 bytes.
 */
export const WORLD_COOP_VERSION = 1;
/** Same Cloudflare Worker as the Arena; `?coop=ws://127.0.0.1:8787/world` overrides it locally. */
export const WORLD_COOP_SERVER = 'wss://parhelion-arena.lejiazhang-us.workers.dev/world';
export const STATE_HZ = 15;
export const ENEMY_HZ = 10;
/** Enemies further than this from both players are not sent. */
export const ENEMY_SYNC_RADIUS = 120;

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function newRoomCode(random = Math.random) {
  let code = ''; for (let i = 0; i < 5; i++) code += CODE_CHARS[Math.floor(random() * CODE_CHARS.length) % CODE_CHARS.length];
  return code;
}
/** Accepts what a person types: lowercase, spaces and dashes. Codes never use O/0/I/1. */
export function normalizeRoomCode(text: string) {
  const code = text.toUpperCase().replace(/[\s-]/g, '');
  return /^[A-HJ-NP-Z2-9]{5}$/.test(code) ? code : null;
}

export type MeleeStyleId = 'blade' | 'polearm' | 'hammer';
/** One player's pose for the partner's screen. */
export interface PlayerWireState {
  p: [number, number, number];
  /** Body facing (animator heading). */
  f: number;
  v: number;
  g: 0 | 1;
  sw: 0 | 1;
  gl: 0 | 1;
  a: number;
  pi: number;
  fi: 0 | 1;
  ar: 0 | 1;
  /** Melee overlay: [phase, combo, style] when swinging. */
  m?: [number, number, MeleeStyleId];
  gun: string;
  mel: MeleeStyleId;
  hp: number;
  max: number;
  name?: string;
}
/** One enemy as the host's game sees it: mode/timer drive tells, target/attack aim the windup. */
export interface EnemyWireState { id: string; p: [number, number, number]; hp: number; mode: string; tm?: number; t?: [number, number, number]; k?: string; ph?: 1 | 2 }
export interface HitWire { id: string; damage: number; source: 'ranged' | 'melee' | 'skill' | 'ultimate' | 'servant' }

const r2 = (n: number) => Math.round(n * 100) / 100;
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const vec = (p: unknown): p is [number, number, number] => Array.isArray(p) && p.length === 3 && p.every(finite) && p.every(n => Math.abs(n) <= 5000);
/** Host side: one enemy for the wire, rounded. */
export function encodeEnemy(e: { id: string; p: { x: number; y: number; z: number }; hp: number; mode: string; timer: number; target: { x: number; y: number; z: number }; attack: string; phase: 1 | 2 }): EnemyWireState {
  return { id: e.id, p: [r2(e.p.x), r2(e.p.y), r2(e.p.z)], hp: r2(e.hp), mode: e.mode, ...(Number.isFinite(e.timer) ? { tm: r2(e.timer) } : {}),
    ...(e.mode === 'windup' || e.mode === 'recover' ? { t: [r2(e.target.x), r2(e.target.y), r2(e.target.z)] as [number, number, number], k: e.attack } : {}), ...(e.phase === 2 ? { ph: 2 as const } : {}) };
}
export function encodeState(s: PlayerWireState): PlayerWireState {
  return { ...s, p: [r2(s.p[0]), r2(s.p[1]), r2(s.p[2])], f: r2(s.f), v: r2(s.v), a: r2(s.a), pi: r2(s.pi), hp: Math.round(s.hp), max: Math.round(s.max),
    ...(s.m ? { m: [r2(s.m[0]), s.m[1], s.m[2]] as [number, number, MeleeStyleId] } : {}) };
}
/** Untrusted input from the other player: anything malformed is rejected, never half-applied. */
export function decodeState(d: unknown): PlayerWireState | null {
  if (!d || typeof d !== 'object') return null;
  const s = d as Partial<PlayerWireState>;
  if (!Array.isArray(s.p) || s.p.length !== 3 || !s.p.every(finite) || s.p.some(n => Math.abs(n) > 5000)) return null;
  if (![s.f, s.v, s.a, s.pi, s.hp, s.max].every(finite)) return null;
  const m = Array.isArray(s.m) && s.m.length === 3 && finite(s.m[0]) && finite(s.m[1]) && ['blade', 'polearm', 'hammer'].includes(s.m[2] as string)
    ? [Math.min(1, Math.max(0, s.m[0])), Math.min(2, Math.max(0, Math.round(s.m[1]))), s.m[2]] as [number, number, MeleeStyleId] : undefined;
  return {
    p: s.p as [number, number, number], f: s.f!, v: Math.min(40, Math.max(0, s.v!)), g: s.g ? 1 : 0, sw: s.sw ? 1 : 0, gl: s.gl ? 1 : 0,
    a: Math.min(1, Math.max(0, s.a!)), pi: Math.min(1.5, Math.max(-1.5, s.pi!)), fi: s.fi ? 1 : 0, ar: s.ar ? 1 : 0, ...(m ? { m } : {}),
    gun: typeof s.gun === 'string' ? s.gun.slice(0, 16) : 'lumen', mel: ['blade', 'polearm', 'hammer'].includes(s.mel as string) ? s.mel as MeleeStyleId : 'blade',
    hp: Math.max(0, s.hp!), max: Math.max(1, s.max!), ...(typeof s.name === 'string' ? { name: s.name.slice(0, 24) } : {}),
  };
}
export function decodeEnemies(d: unknown): EnemyWireState[] | null {
  if (!Array.isArray(d) || d.length > 80) return null;
  const out: EnemyWireState[] = [];
  for (const e of d) {
    if (!e || typeof e !== 'object') return null;
    const x = e as Partial<EnemyWireState>;
    if (typeof x.id !== 'string' || x.id.length > 48 || !vec(x.p) || !finite(x.hp) || typeof x.mode !== 'string') return null;
    out.push({ id: x.id, p: x.p, hp: Math.max(0, x.hp), mode: x.mode.slice(0, 16),
      ...(finite(x.tm) ? { tm: Math.min(600, Math.max(0, x.tm)) } : {}), ...(vec(x.t) ? { t: x.t } : {}),
      ...(typeof x.k === 'string' ? { k: x.k.slice(0, 8) } : {}), ...(x.ph === 1 || x.ph === 2 ? { ph: x.ph } : {}) });
  }
  return out;
}
export function decodeHit(d: unknown): HitWire | null {
  if (!d || typeof d !== 'object') return null;
  const h = d as Partial<HitWire>;
  if (typeof h.id !== 'string' || h.id.length > 48 || !finite(h.damage) || h.damage <= 0 || h.damage > 400) return null;
  if (!['ranged', 'melee', 'skill', 'ultimate', 'servant'].includes(h.source as string)) return null;
  return { id: h.id, damage: h.damage, source: h.source as HitWire['source'] };
}

/** A partner's skill or ultimate, for the visual only (their game resolves the damage). */
export interface SkillFxWire { type: 'strike' | 'cast'; identity: string | null; slot: 'skill' | 'ultimate'; o: [number, number, number]; d: [number, number, number]; pulse?: number; range?: number; hw?: number; dur?: number; feet?: number; los?: 0 | 1 }
export function encodeSkillFx(e: { type: string; identity: string | null; slot: string; origin: { x: number; y: number; z: number }; direction: { x: number; y: number; z: number }; pulse?: number; range?: number; halfWidth?: number; duration?: number; casterFeetY?: number; losOffset?: 0 | 1 }): SkillFxWire | null {
  if (e.type !== 'strike' && e.type !== 'cast') return null;
  return { type: e.type, identity: e.identity, slot: e.slot === 'ultimate' ? 'ultimate' : 'skill', o: [r2(e.origin.x), r2(e.origin.y), r2(e.origin.z)], d: [r2(e.direction.x), r2(e.direction.y), r2(e.direction.z)],
    ...(e.type === 'strike' ? { pulse: e.pulse ?? 0, range: r2(e.range ?? 0), hw: r2(e.halfWidth ?? 0) } : { dur: r2(e.duration ?? 0) }),
    ...(finite(e.casterFeetY) ? { feet: r2(e.casterFeetY) } : {}), ...(e.losOffset === 0 || e.losOffset === 1 ? { los: e.losOffset } : {}) };
}
export function decodeSkillFx(d: unknown, identities: readonly string[]): SkillFxWire | null {
  if (!d || typeof d !== 'object') return null;
  const x = d as Partial<SkillFxWire>;
  if (x.type !== 'strike' && x.type !== 'cast') return null;
  if (x.identity !== null && !identities.includes(x.identity as string)) return null;
  if (x.slot !== 'skill' && x.slot !== 'ultimate') return null;
  if (!vec(x.o) || !Array.isArray(x.d) || x.d.length !== 3 || !x.d.every(n => finite(n) && Math.abs(n) <= 2)) return null;
  if (x.type === 'strike' && !(finite(x.range) && x.range > 0 && x.range <= 40 && finite(x.hw) && x.hw > 0 && x.hw <= 15 && finite(x.pulse))) return null;
  if (x.type === 'cast' && !(finite(x.dur) && x.dur > 0 && x.dur <= 5)) return null;
  return { type: x.type, identity: x.identity ?? null, slot: x.slot, o: x.o, d: x.d as [number, number, number],
    ...(x.type === 'strike' ? { pulse: Math.max(0, Math.min(8, Math.round(x.pulse!))), range: x.range, hw: x.hw } : { dur: x.dur }),
    ...(finite(x.feet) && Math.abs(x.feet) <= 5000 ? { feet: x.feet } : {}), ...(x.los === 0 || x.los === 1 ? { los: x.los } : {}) };
}

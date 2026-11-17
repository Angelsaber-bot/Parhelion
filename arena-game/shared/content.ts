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
/** Protection after spawn; accepted attacks and hero abilities end it. Separate from death delay. */
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
  hp: 180,
  width: 2.4,
  height: 2.0,
  distance: 1.4, // placed this far in front of the caster
  life: 5 * TICK_HZ,
  cooldown: 16 * TICK_HZ,
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
/** Smoke blocks perception only; bullets retain their full damage. */
export const SMOKE = { radius: 5, life: 12 * TICK_HZ, cover: 1 };
/** Kill-feed weapon index for grenade kills, outside the WEAPONS catalog on purpose. */
export const FRAG_KILL = 100;

export interface CharacterDef {
  id: string;
  name: string;
  hp: number;
  speed: number; // m/s
  color: number; // identity accent
  ability: AbilityId;
}

export type AbilityId = 'barrier' | 'anchor' | 'guard' | 'curtain' | 'decoy' | 'barrage' | 'prayer' | 'lens' | 'edict';
export const HERO_RULESET = 'heroes-v5-instant';
/** Stable legacy indices 0/1 remain readable, but are retired from new lobbies. */
export const PLAYABLE_HERO_INDICES = [2,3,4,5,6,7,8] as const;
export const playableHero = (char:number):number => (PLAYABLE_HERO_INDICES as readonly number[]).includes(char) ? char : 2;
/** A Bot's hero, drawn at random from the playable roster: never a hero its own team already fields, and
 * preferably one nobody in the match is playing yet, so a 1v1 Bot is not the same fighter every time. */
export function randomBotHero(seated: Iterable<{ team: string; char: number }>, team: string, rand: () => number = Math.random): number {
  const list = [...seated], roster = PLAYABLE_HERO_INDICES as readonly number[];
  const free = roster.filter(i => !list.some(s => s.char === i));
  const open = roster.filter(i => !list.some(s => s.team === team && s.char === i));
  const pool = free.length ? free : open.length ? open : roster;
  const r = rand(), k = Number.isFinite(r) ? Math.min(pool.length - 1, Math.max(0, Math.floor(r * pool.length))) : 0;
  return pool[k];
}
export const ABILITIES: Record<AbilityId, { name: string; en: string; icon: string; cooldown: number; windup: number; recovery: number; range: number; description: string; english: string }> = {
  barrier: { name:'折光掩盾', en:'Refraction barrier', icon:'◇', cooldown:960, windup:15, recovery:12, range:1.4, description:'180 耐久 · 5 秒 · 阻挡双方枪弹，近战和爆炸可穿过。', english:'180 HP · 5s · Stops both teams’ bullets; melee and blasts pass.' },
  anchor: { name:'回位锚', en:'Return anchor', icon:'△', cooldown:1080, windup:9, recovery:9, range:5, description:'40 耐久 · 2.5 秒内再次按 Q 沿无遮挡直线回位，最多 5 米。', english:'40 HP · Press again within 2.5s to return up to 5m along a clear line.' },
  guard: { name:'风王铁槌', en:'Wind king’s hammer', icon:'♜', cooldown:480, windup:3, recovery:6, range:0, description:'轻点 Q：12 米、90° 风斩 80 伤害，并把敌人推开 3 米；按住最多 0.6 秒正面格挡 150 伤害，连正面飞来的炮弹和钩索也能挡下，吸收越多风斩越强（最高 110）。8 秒冷却。', english:'Tap Q: an 80 damage slash over 12m / 90° that throws enemies 3m back. Hold up to 0.6s to guard 150 damage from the front, cannonballs and hooks included; the more it absorbs, the stronger the slash (up to 110). 8s cooldown.' },
  curtain: { name:'接舷钩', en:'Boarding hook', icon:'⚓', cooldown:600, windup:3, recovery:6, range:24, description:'沿准星射出钩索，24 米内钩中敌人造成 30 伤害，并把对方拽到身前 2.5 米，随后减速 0.5 秒。墙和护盾会挡住钩索；空钩返还 40% 冷却。10 秒冷却。', english:'Fire a hook along your aim: within 24m it deals 30 damage, drags the enemy to 2.5m in front of you and slows them for 0.5s. Walls and shields stop it; a miss refunds 40% of the cooldown. 10s cooldown.' },
  decoy: { name:'燕返', en:'Swallow cut', icon:'♊', cooldown:480, windup:3, recovery:3, range:6, description:'沿准星方向 0.15 秒突进 6 米，双刀斩中沿途敌人各 70 伤害；斩杀立即刷新冷却。突进中可开枪，全程可受伤。8 秒冷却。', english:'Dash 6m along your aim in 0.15s; both blades deal 70 to every enemy on the way. A kill resets the cooldown at once. Keep firing during the dash; you remain vulnerable. 8s cooldown.' },
  barrage: { name:'战争之神', en:'God of war', icon:'◎', cooldown:660, windup:3, recovery:6, range:45, description:'沿准星轰出一发贯穿实心弹（70 m/s）：穿过路径上的每个敌人各造成 70 伤害并击退，直接击碎护盾，撞墙时炸开 2.5 米 35 伤害。开炮后坐力把自己向后推 3 米。11 秒冷却。', english:'Fire a piercing round shot along your aim (70 m/s): every enemy in its path takes 70 and is knocked back, shields shatter, and it bursts for 35 within 2.5m when it hits a wall. The recoil throws you 3m back. 11s cooldown.' },
  prayer: { name:'吾主在此', en:'Luminosité Eternelle', icon:'✦', cooldown:720, windup:6, recovery:6, range:6, description:'0.1 秒立旗，6 米内可见友军立即恢复 30 HP，随后 3 秒每 0.25 秒回 5 HP，枪伤降低 25%。圣旗 100 耐久；不能复活或超额治疗。', english:'Plant in 0.1s: visible allies within 6m instantly heal 30 HP, then 5 HP every 0.25s for 3s with 25% gun resistance. 100 HP banner; no revive or overheal.' },
  lens: { name:'日轮审判', en:'Solar judgement', icon:'☼', cooldown:720, windup:6, recovery:6, range:8, description:'日轮在 0.25 秒预警后快速发出四次审判，间隔 0.4 秒；16 米 / 100°，每次 30 伤害。Q 可转向，墙烟可挡；日轮 80 耐久。', english:'After a 0.25s warning, four judgements fire 0.4s apart over 16m / 100°, dealing 30 each. Q redirects; walls and smoke block it. 80 HP disc.' },
  edict: { name:'定身令', en:'Edict of stillness', icon:'⌁', cooldown:660, windup:6, recovery:6, range:18, description:'在准星处（18 米内，可自动对准敌人）落下御令，0.2 秒预警后 5 米内的敌人定身 0.7 秒，并在 2 秒内受到的伤害提高 25%。定身中仍可开枪。11 秒冷却。', english:'Drop an edict where you aim (within 18m, snaps to an enemy): after a 0.2s warning, enemies within 5m are rooted for 0.7s and take 25% more damage for 2s. Rooted players can still shoot. 11s cooldown.' },
};
/** Shared by authority, prediction and visual telegraphs (all time values are ticks). */
export const HERO_COMBAT = {
  /** Wind hammer: guard budget and hold, slash damage plus the bonus for a full guard, reach, cone, and the push (metres over ticks). */
  guard:{budget:150,hold:36,damage:80,bonus:30,range:12,halfAngle:Math.PI/4,push:3,pushTicks:9},
  /** Hook: projectile speed (m/s), reach, damage, where the catch lands in front of the caster, drag speed and after-slow. */
  curtain:{speed:80,range:24,radius:.7,damage:30,pullTo:2.5,pullSpeed:40,slow:30,refund:.4,maxPull:30},
  /** Swallow cut: dash length/speed (m/s) and duration, half-width of the blade sweep, damage per enemy. */
  decoy:{distance:6,speed:40,travel:9,width:1.15,damage:70},
  /** Cannon: projectile speed (m/s), reach, ball radius, damage to each enemy pierced, wall-burst splash and radius,
   *  knockback, and the recoil that throws the gunner back (metres over ticks). */
  barrage:{speed:70,range:45,ball:.3,damage:70,splash:35,radius:2.5,knockback:7,lift:3,recoil:3,recoilTicks:9},
  prayer:{hp:100,radius:6,instant:30,heal:5,interval:15,life:181,resist:.75},
  lens:{hp:80,range:16,halfAngle:50*Math.PI/180,warning:15,interval:24,pulses:4,damage:30,life:96,mark:30},
  /** Edict: snap cone half-width (m), radius, warning, root and exposure (ticks), damage taken while exposed, slow after a hook. */
  edict:{snap:2,radius:5,arm:12,life:30,root:42,exposed:120,vulnerable:1.25,speed:.65},
} as const;
export const CHARACTERS: CharacterDef[] = [
  { id:'aster', name:'Aster', hp:150, speed:5.2, color:0x63d9db, ability:'barrier' },
  { id:'vega', name:'Vega', hp:150, speed:5.2, color:0xefb76a, ability:'anchor' },
  { id:'saber', name:'阿尔托莉雅 · Artoria', hp:150, speed:5.2, color:0x6489ed, ability:'guard' },
  { id:'blackbeard', name:'黑胡子 · Blackbeard', hp:150, speed:5.2, color:0xb55f50, ability:'curtain' },
  { id:'musashi', name:'宫本武藏 · Musashi', hp:150, speed:5.2, color:0xe96b8e, ability:'decoy' },
  { id:'napoleon', name:'拿破仑 · Napoleon', hp:150, speed:5.2, color:0x547db2, ability:'barrage' },
  { id:'jeanne', name:'贞德 · Jeanne', hp:150, speed:5.2, color:0xab96e2, ability:'prayer' },
  { id:'ozymandias', name:'奥斯曼迪斯 · Ozymandias', hp:150, speed:5.2, color:0xe3b953, ability:'lens' },
  { id:'qin', name:'秦始皇 · Qin Shi Huang', hp:150, speed:5.2, color:0x72c7ae, ability:'edict' },
];
export function heroIndex(id: unknown, legacy: unknown = 0): number {
  const n = id === undefined ? legacy : CHARACTERS.findIndex(c => c.id === id);
  if (typeof n !== 'number' || !Number.isInteger(n) || !CHARACTERS[n]) throw new Error('无效角色 / Unknown hero');
  return n;
}
export const abilityFor = (char: number) => ABILITIES[CHARACTERS[char].ability];

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
  // Halo is full-auto (rules v26): holding the trigger repeats at its own cadence, 0.25 s since v28.
  {
    id: 'halo', kind: 'gun', name: 'Halo DMR', auto: true, interval: 15, damage: 52, pellets: 1, headMul: 2,
    spread: 0, spreadMove: 0, falloffStart: 60, falloffEnd: 120, falloffMin: 0.85,
    mag: 8, reload: Math.round(2.1 * TICK_HZ), range: 200,
    skins: [],
  },
  // New weapons are distinct prototype tuning, not competitively validated balance.
  {
    id: 'firefly', kind: 'gun', name: 'Firefly SMG · 流萤', auto: true, interval: 4, damage: 14, pellets: 1, headMul: 1.4,
    spread: 0.014, spreadMove: 0.025, falloffStart: 12, falloffEnd: 32, falloffMin: 0.45,
    mag: 50, reload: Math.round(2.2 * TICK_HZ), range: 100, // v29: longer than both rifles (AR 1.9 s, DMR 2.1 s)
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

/** Deployments are off-hand commands; defensive guard and travel still trade away shooting. */
export const abilityAllowsGunplay = (char:number):boolean => ['curtain','decoy','barrage','prayer','lens','edict'].includes(CHARACTERS[char].ability);

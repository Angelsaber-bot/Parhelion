/**
 * The World arsenal: the same five guns as the Arena (same names, same authored models from
 * assets/weapons), retuned for PvE and the World's field-ammo economy. The Dawn AR is the starting
 * rifle; every other gun is earned in the open world, mostly from the roaming elite whose era it
 * suits. Unlocks are save flags the player already earns, so no new save state is needed: only the
 * currently equipped gun is remembered locally.
 *
 * Tuning notes (World scale: enemies 66–264 HP, chapter bosses 1800):
 * - Dawn AR (lumen): the all-rounder, unchanged from the original World rifle.
 * - Firefly SMG: fastest, weakest per round, short reach; long bursts before venting.
 * - Afterglow SG (corona): nine pellets, devastating inside 6 m, useless past 20 m; 3 rounds a shell.
 * - Meridian DMR (halo): heavy precise shots that keep their damage to 60 m; 2 rounds a shot.
 * - Longnight Sniper: one huge shot, long reach, slow; 5 rounds a shot.
 */
import type { Localized } from './settlements/types';
import { WORLD_RIFLE } from './worldBalance';

export type WorldGunId = 'lumen' | 'firefly' | 'corona' | 'halo' | 'longnight';
export interface GunProfile {
  readonly damage: number; readonly pellets: number; readonly spread: number;
  readonly interval: number; readonly burst: number; readonly vent: number;
  readonly range: number; readonly fullDamageRange: number; readonly minimumDamageRange: number; readonly minimumMultiplier: number;
  readonly ammoCost: number;
}
export interface WorldGun extends GunProfile {
  readonly id: WorldGunId;
  readonly name: Localized;
  readonly role: Localized;
  /** Save flag that unlocks it; null = owned from the start. */
  readonly unlock: { readonly flag: string; readonly how: Localized } | null;
}
const g = (gun: WorldGun) => Object.freeze(gun);
export const WORLD_GUNS: readonly WorldGun[] = Object.freeze([
  g({ id: 'lumen', name: ['曙光 · 突击步枪', 'Dawn AR'], role: ['全能 · 中距离连射', 'All-rounder · mid-range bursts'],
    damage: WORLD_RIFLE.damage, pellets: 1, spread: 0, interval: WORLD_RIFLE.interval, burst: WORLD_RIFLE.burst, vent: WORLD_RIFLE.vent,
    range: WORLD_RIFLE.enemyRange, fullDamageRange: WORLD_RIFLE.fullDamageRange, minimumDamageRange: WORLD_RIFLE.minimumDamageRange, minimumMultiplier: WORLD_RIFLE.minimumMultiplier,
    ammoCost: 1, unlock: null }),
  g({ id: 'firefly', name: ['流萤 · 冲锋枪', 'Firefly SMG'], role: ['高射速 · 近距离压制', 'High rate of fire · close pressure'],
    damage: 7, pellets: 1, spread: .012, interval: .085, burst: 14, vent: 1.2,
    range: 45, fullDamageRange: 8, minimumDamageRange: 30, minimumMultiplier: .35, ammoCost: 1,
    unlock: { flag: 'xp_resonance_1', how: ['在任意日晕雕像觉醒「日晕共鸣 Lv.1」', 'Awaken Halo Resonance Lv.1 at any Halo statue'] } }),
  g({ id: 'corona', name: ['余辉 · 霰弹枪', 'Afterglow SG'], role: ['九发弹丸 · 贴身爆发', 'Nine pellets · point-blank burst'],
    damage: 7, pellets: 9, spread: .075, interval: .8, burst: 99, vent: 0,
    range: 22, fullDamageRange: 5, minimumDamageRange: 18, minimumMultiplier: .15, ammoCost: 3,
    unlock: { flag: 'xp_elite_elite_reef_captain', how: ['讨伐黑帆尽头的精英「暗礁船长」', "Defeat the Reef Captain, Black Sail's End elite"] } }),
  g({ id: 'halo', name: ['子午线 · 精确射手步枪', 'Meridian DMR'], role: ['高伤单发 · 远距离精准', 'Heavy single shots · long-range precision'],
    damage: 30, pellets: 1, spread: 0, interval: .42, burst: 99, vent: 0,
    range: 90, fullDamageRange: 40, minimumDamageRange: 90, minimumMultiplier: .8, ammoCost: 2,
    unlock: { flag: 'xp_elite_elite_valley_sentinel', how: ['讨伐幻日谷的精英「棱光哨卫」', 'Defeat the Prism Sentinel, the Parhelion Valley elite'] } }),
  g({ id: 'longnight', name: ['长夜 · 狙击步枪', 'Longnight Sniper'], role: ['一击重创 · 超远射程', 'One crushing shot · extreme range'],
    damage: 78, pellets: 1, spread: 0, interval: 1.3, burst: 99, vent: 0,
    range: 120, fullDamageRange: 70, minimumDamageRange: 120, minimumMultiplier: .9, ammoCost: 5,
    unlock: { flag: 'xp_elite_elite_frost_officer', how: ['讨伐永冬之城的精英「霜线督军」', 'Defeat the Frostline Officer, the Eternal Winter elite'] } }),
]);
export const DEFAULT_GUN: WorldGunId = 'lumen';
export const GUN_STORE_KEY = 'parhelion-world-gun-v1';
export function worldGun(id: unknown): WorldGun | undefined { return WORLD_GUNS.find(gun => gun.id === id); }
export function gunUnlocked(gun: WorldGun, done: ReadonlySet<string>) { return !gun.unlock || done.has(gun.unlock.flag); }
export function unlockedGuns(done: ReadonlySet<string>) { return WORLD_GUNS.filter(gun => gunUnlocked(gun, done)); }
/** The next owned gun in `dir` (+1/-1), wrapping; the current one if it is the only one owned. */
export function cycleGun(current: WorldGunId, dir: 1 | -1, done: ReadonlySet<string>): WorldGunId {
  const owned = unlockedGuns(done);
  if (!owned.length) return DEFAULT_GUN;
  const at = owned.findIndex(gun => gun.id === current);
  if (at < 0) return owned[0].id;
  return owned[(at + dir + owned.length) % owned.length].id;
}
/** The equipped gun, validated against what the save actually owns (a new game drops back to the AR). */
export function equippedGun(stored: unknown, done: ReadonlySet<string>): WorldGunId {
  const gun = worldGun(stored);
  return gun && gunUnlocked(gun, done) ? gun.id : DEFAULT_GUN;
}
/** Guns whose unlock flag is in `after` but not in `before` — for the unlock banner. */
export function newlyUnlocked(before: ReadonlySet<string>, after: ReadonlySet<string>) {
  return WORLD_GUNS.filter(gun => gun.unlock && !before.has(gun.unlock.flag) && after.has(gun.unlock.flag));
}
/** Damage scale with distance for this gun (1 at close range down to its minimum). */
export function gunDistanceMultiplier(gun: GunProfile, distance: number) {
  if (!Number.isFinite(distance)) return 0;
  const t = Math.max(0, Math.min(1, (distance - gun.fullDamageRange) / Math.max(1e-6, gun.minimumDamageRange - gun.fullDamageRange)));
  return 1 - t * (1 - gun.minimumMultiplier);
}

/** Melee: the Arena's three close-range weapons on the World's three-beat combo. Each scales the
 * combo's damage, reach, width and tempo; the hammer's heavy hits also fill an elite's daze gauge
 * fastest because daze follows damage dealt. */
export type WorldMeleeId = 'blade' | 'polearm' | 'hammer';
export interface MeleeStyle { readonly damage: number; readonly range: number; readonly width: number; readonly speed: number }
export interface WorldMelee extends MeleeStyle {
  readonly id: WorldMeleeId; readonly name: Localized; readonly role: Localized;
  readonly unlock: { readonly flag: string; readonly how: Localized } | null;
}
const m = (melee: WorldMelee) => Object.freeze(melee);
export const WORLD_MELEE: readonly WorldMelee[] = Object.freeze([
  m({ id: 'blade', name: ['折光 · 长刃', 'Refract Blade'], role: ['均衡 · 出手快', 'Balanced · quick'], damage: 1, range: 1, width: 1, speed: 1, unlock: null }),
  m({ id: 'polearm', name: ['流星 · 长柄', 'Meteor Polearm'], role: ['长距离突刺 · 攻击范围窄', 'Long reach · narrow thrusts'], damage: 1.08, range: 1.65, width: .8, speed: .86,
    unlock: { flag: 'xp_elite_elite_ember_samurai', how: ['讨伐业火京都的精英「余烬武士」', 'Defeat the Ember Samurai, the Hellfire Kyoto elite'] } }),
  m({ id: 'hammer', name: ['断层 · 战锤', 'Faultline Hammer'], role: ['重击破韧 · 出手慢', 'Heavy blows that break stances · slow'], damage: 1.55, range: 1.15, width: 1.3, speed: .72,
    unlock: { flag: 'xp_elite_elite_oath_knight', how: ['讨伐落日王国的精英「失誓骑士」', 'Defeat the Oathless Knight, the Sunset Kingdom elite'] } }),
]);
export const DEFAULT_MELEE: WorldMeleeId = 'blade';
export const MELEE_STORE_KEY = 'parhelion-world-melee-v1';
export function worldMelee(id: unknown): WorldMelee | undefined { return WORLD_MELEE.find(x => x.id === id); }
export function meleeUnlocked(x: WorldMelee, done: ReadonlySet<string>) { return !x.unlock || done.has(x.unlock.flag); }
export function unlockedMelee(done: ReadonlySet<string>) { return WORLD_MELEE.filter(x => meleeUnlocked(x, done)); }
export function cycleMelee(current: WorldMeleeId, done: ReadonlySet<string>): WorldMeleeId {
  const owned = unlockedMelee(done), at = owned.findIndex(x => x.id === current);
  return owned.length ? owned[(at + 1) % owned.length].id : DEFAULT_MELEE;
}
export function equippedMelee(stored: unknown, done: ReadonlySet<string>): WorldMeleeId {
  const x = worldMelee(stored); return x && meleeUnlocked(x, done) ? x.id : DEFAULT_MELEE;
}

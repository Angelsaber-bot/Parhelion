// Training range: an offline practice match on its own map. Dummies never shoot back, return
// to their posts a second after they fall, and each one teaches one thing: distance, tracking,
// peeking, shields, grenades over cover, or melee range. Never offered for online rooms.
import rangeData from '../../arena-maps/range/runtime/map.json';
import { BTN, type Input } from './sim.ts';
import { GRENADE, TICK_HZ, validateLoadout, validateUtility, WEAPONS, loadoutWeapon, type Loadout, type UtilityId } from './content.ts';
import { buildMap, type ArenaMap, type MapData, type Vec3 } from './map.ts';
import type { Controller, Match } from './match.ts';

export const RANGE_MAP_ID = 'range';
export const RANGE_DATA = rangeData as unknown as MapData & { range: { firingLine: number; lanes: Record<string, number>; distances: number[] } };
let built: ArenaMap | null = null;
export function getRangeMap(): ArenaMap { return built ??= buildMap(RANGE_DATA); }

export type DummyKind = 'static' | 'strafe' | 'peek' | 'shield' | 'pit' | 'melee';
export interface Post { id: string; kind: DummyKind; at: Vec3; char: number; label: [string, string] }
const L = RANGE_DATA.range.firingLine, lanes = RANGE_DATA.range.lanes;
export const POSTS: Post[] = [
  ...RANGE_DATA.range.distances.map((d, i): Post => ({ id: `static-${d}`, kind: 'static', at: [L + d, 0, lanes.static], char: i % 2, label: [`${d}m 固定靶`, `${d}m static`] })),
  { id: 'strafe-15', kind: 'strafe', at: [L + 15, 0, lanes.strafe], char: 1, label: ['15m 横移靶', '15m strafing'] },
  { id: 'strafe-30', kind: 'strafe', at: [L + 30, 0, lanes.strafe], char: 0, label: ['30m 横移靶', '30m strafing'] },
  { id: 'peek-20', kind: 'peek', at: [L + 20.4, 0, lanes.cover], char: 0, label: ['20m 掩体探头靶', '20m peeking'] },
  { id: 'shield-25', kind: 'shield', at: [L + 25, 0, lanes.cover - 3.5], char: 0, label: ['25m 护盾靶', '25m shield'] },
  { id: 'pit', kind: 'pit', at: [5.4, 0, 17.4], char: 0, label: ['手雷坑', 'Grenade pit'] },
  ...[-21, -17, -13].map((x, i): Post => ({ id: `melee-${i}`, kind: 'melee', at: [x, 0, -17], char: i % 2, label: ['近战靶', 'Melee dummy'] })),
];
/** Faces the firing line (west): forward (-sin yaw, -cos yaw) = (-1, 0). */
export const POST_YAW = Math.PI / 2;
export const DUMMY_RESPAWN_TICKS = Math.round(1 * TICK_HZ);

/** Never fires. Strafers pace their lane, the peeker ducks behind cover, the shield dummy raises
 * a shield whenever it can. Inputs go through the same rules as a player's. */
export class Dummy implements Controller {
  private seq = 0;
  constructor(private post: Post) {}
  think(match: Match, id: string): Input {
    const me = match.player(id)!, t = match.tick, inp: Input = { seq: ++this.seq, mx: 0, mz: 0, yaw: POST_YAW, pitch: 0, buttons: 0, weapon: this.post.kind === 'melee' ? 2 : 0, view: t };
    if (!me.alive) return inp;
    if (this.post.kind === 'strafe') {
      // Right of a west-facing dummy is -z; pace ±2.6 m around the post with a turn every ~1.2 s.
      const offset = me.z - this.post.at[2], phase = Math.floor(t / 70) % 2 ? 1 : -1;
      inp.mx = offset > 2.6 ? 1 : offset < -2.6 ? -1 : phase;
    }
    if (this.post.kind === 'peek' && Math.floor(t / 75) % 2 === 0) inp.buttons |= BTN.CROUCH;
    if (this.post.kind === 'shield' && me.shieldCd === 0 && t % 30 === 0) inp.buttons |= BTN.SHIELD;
    return inp;
  }
}

/** Seat the dummies and make the match a practice match. */
export function setupRange(match: Match) {
  match.practice = { homes: new Map(), respawnTicks: DUMMY_RESPAWN_TICKS };
  for (const post of POSTS) {
    const id = `dummy-${post.id}`;
    match.practice.homes.set(id, { x: post.at[0], y: post.at[1], z: post.at[2], yaw: POST_YAW });
    match.addPlayer(id, { name: post.label[1], team: 'B', char: post.char, skins: [], loadout: ['lumen', 'corona', 'blade'], bot: true }, new Dummy(post));
  }
}

/** Swap the player's weapons, finishes and grenade in place (offline only). */
export function applyPracticeLoadout(match: Match, id: string, choice: { loadout: Loadout; utility: UtilityId; skins: number[] }) {
  const slot = match.slots.get(id);
  if (!slot) return false;
  const loadout = validateLoadout(choice.loadout), utility = validateUtility(choice.utility);
  const skins = WEAPONS.map((w, i) => Math.max(0, Math.min(w.skins.length - 1, choice.skins[i] | 0)));
  slot.info = { ...slot.info, loadout, utility, skins };
  const p = slot.state;
  p.loadout = [...loadout]; p.utility = utility; p.utilityCd = 0; p.utilityCharges = GRENADE.charges; p.utilityLock = 0;
  p.weapon = loadoutWeapon(loadout, p.weaponSlot); p.reload = 0; p.meleeWindup = 0;
  p.ammo = WEAPONS.map((w) => w.mag);
  slot.melee = null;
  return true;
}

/** Put every dummy back on its post at full health. */
export function resetDummies(match: Match) {
  for (const [id, slot] of match.slots) if (match.practice?.homes.has(id)) { slot.respawn = 0; match.respawnNow(id); }
}

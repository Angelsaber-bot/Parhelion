// Client <-> server message contract.
import type { Loadout, TeamLayout, UtilityId } from './content.ts';
import type { Snapshot } from './match.ts';
import type { Input } from './sim.ts';

export const ROOM_NAME = 'arena';
/** v3 adds validated two-gun/one-melee loadouts, slot input, and authoritative melee windup; v4 adds the melee move-speed bonus; v5 widens melee contact and spear reach; v6 adds melee lunge, turn-swept hits and gun resistance; v7 added a U test key, removed again in v8; v9 compacts the curated cosmetic catalog, so old numeric skin indices cannot be mixed. v10 retunes shotgun damage/spread/cadence; old predictive clients must refresh. */
// v11 increases the shotgun to twenty 20-damage pellets; refresh predictive clients together with the server.
// v12 appends three historical finishes; old servers must not clamp their new indices to a different skin.
// v13 makes the DMR and sniper exactly on-axis while moving or airborne, and appends seven melee finishes.
// v14 adds the utility slot: thrown frag and smoke grenades simulated by the server.
// v15 makes grenades matter: lethal frag core with knockback, two charges, and smoke that is cover.
// v16 accepts an eighth input bit (reserved, carries no rule); kept so clients match the deployed server.
// v17: a frag kills every enemy within its radius; walls and shields do not stop it.
// v18: melee swings pass through shields (shields still stop bullets); thrown frags outlive a thrower who leaves.
// v19: smoke deploys at first ground contact; an expired frag waits for ground contact.
// v20: three rechargeable dash charges with buffered directions in predicted player state.
// v21: dash charges recover every five seconds.
// v22: LISHAN, SUNTEMPLE and ORLEANS revised layouts (shared collision) and spawn choice that avoids enemy sight.
// v23: attacking ends spawn protection (G02); solid walls and floors shelter from frags, shields still do not (G03).
// v24: era-map colliders fitted to their models (figures, chariot, rails, columns, statues): shots pass visible gaps.
// v25: Halo DMR fires every 25 ticks (was 22) with a 1.75 head multiplier (was 2).
// v26: v25's Halo change reverted (22 ticks, 2x head) and Halo made full-auto: hold to keep firing.
// v27: Halo fires every 20 ticks (0.33 s, was 22).
// v28: Halo fires every 15 ticks (0.25 s), a trial.
// v29: Firefly SMG reload 1.65 s -> 2.2 s, longer than both rifles.
// v30: nine equal-stat heroes, authoritative Q abilities, visual-only smoke and HOMEWARD.
// v31: seven active World heroes; counter-slash, sidestep, broadside, advancing artillery, banner and domain.
// v32: off-hand quick casts preserve gunplay; tuned role-specific ability budgets.
// v34: Arena spawn sightline screens, Homeward crossing cover, authored exit facing and routes.
// v35: instant hero abilities: Musashi's swallow cut, Napoleon's cannonball, Blackbeard's boarding hook, Qin's edict of stillness (root).
// v36: smoke settles as a 4.2 m x 4 m cloud that hugs walls, blooms and thins; a frag blows a hole in it.
// v37: smoke 5.2 m wide and 5.5 m tall, filling against air walls and the map edge; smoke carries 3 charges, frags 2.
// v38: every hero has 200 HP; the Longnight sniper deals 110 to the body and 200 to the head.
// v39: Qin's edict roots within 8 m (was 5); rooted enemies take +25% damage for 3 s (was 2) and are revealed through walls
//      to the caster's team for 3 s; the zone stays 5 s and slows enemies inside by 35%. Player state gains revealedUntil.
// v40: Qin's edict roots and slows through walls, buildings and smoke; damage boost and reveal last 5 s, as long as the zone.
// v41: the edict reaches every floor and roots enemies who walk into the zone later (once per life); private room codes.
export const RULES_VERSION = 41;
export const RULES_MISMATCH = '竞技场客户端与服务器版本不匹配；请使用同一版本。请刷新游戏后重试。';
export function assertRulesVersion(version: unknown): void {
  if (version !== RULES_VERSION) throw new Error(RULES_MISMATCH);
}
export const DEFAULT_PORT = 2567;
/** Public Arena server (Cloudflare Worker + Durable Objects, worker/index.ts) used by the public site. */
export const PUBLIC_SERVER = 'wss://parhelion-arena.lejiazhang-us.workers.dev/arena';
/** A server URL with an /arena path speaks the Worker's plain-JSON protocol; bare host:port is Colyseus. */
export const isWorkerUrl = (url: string) => /^wss?:\/\/[^/]+\/arena\/?(\?|$)/.test(url.trim());

export interface JoinOptions {
  /** Online handshake, injected by joinOnline; never silently mix pre-crouch servers/clients. */
  rulesVersion?: number;
  layout: TeamLayout;
  team: 'A' | 'B' | 'auto';
  name: string;
  char: number;
  heroId?: string;
  contentManifest?: string;
  skins: number[];
  loadout?: Loadout;
  /** Utility slot choice (v14); omitted means the default frag. */
  utility?: UtilityId;
  /** Arena map id (see shared/arenaMap.ts); players on different maps never share a room. */
  map?: string;
  /** Fill empty slots with bots (room creator decides). */
  bots?: boolean;
  /** Private room code (see normalizeRoomCode): everyone with the same code joins one room, whose first
   *  player chose its map, layout and bots. Absent means quick match. */
  room?: string;
}

export interface ClientMessages {
  input: Input[];
  rematch: true;
}

export interface ServerMessages {
  welcome: { id: string; tick: number; map: string; rulesVersion: number; contentManifest?: string };
  snap: Snapshot;
}

export const LAYOUTS: TeamLayout[] = ['1v1', '1v2', '2v2'];

/** Private rooms use the same 5-character codes as World co-op: no O/0/I/1 to misread. */
export const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const PRIVATE_ROOM_NAME = 'arena_private';
export function newRoomCode(random: () => number = Math.random) {
  let code = '';
  for (let i = 0; i < 5; i++) code += ROOM_CODE_CHARS[Math.floor(random() * ROOM_CODE_CHARS.length) % ROOM_CODE_CHARS.length];
  return code;
}
/** Accepts what a person types (lowercase, spaces, dashes); null when it is not a valid code. */
export function normalizeRoomCode(text: unknown): string | null {
  if (typeof text !== 'string') return null;
  const code = text.toUpperCase().replace(/[\s-]/g, '');
  return /^[A-HJ-NP-Z2-9]{5}$/.test(code) ? code : null;
}

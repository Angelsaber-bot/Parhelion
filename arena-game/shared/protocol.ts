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
export const RULES_VERSION = 21;
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
  skins: number[];
  loadout?: Loadout;
  /** Utility slot choice (v14); omitted means the default frag. */
  utility?: UtilityId;
  /** Arena map id (see shared/arenaMap.ts); players on different maps never share a room. */
  map?: string;
  /** Fill empty slots with bots (room creator decides). */
  bots?: boolean;
}

export interface ClientMessages {
  input: Input[];
  rematch: true;
}

export interface ServerMessages {
  welcome: { id: string; tick: number; map: string; rulesVersion: number };
  snap: Snapshot;
}

export const LAYOUTS: TeamLayout[] = ['1v1', '1v2', '2v2'];

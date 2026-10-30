// Client <-> server message contract.
import type { Loadout, TeamLayout } from './content.ts';
import type { Snapshot } from './match.ts';
import type { Input } from './sim.ts';

export const ROOM_NAME = 'arena';
/** v3 adds validated two-gun/one-melee loadouts, slot input, and authoritative melee windup; v4 adds the melee move-speed bonus; v5 widens melee contact and spear reach. */
export const RULES_VERSION = 5;
export const RULES_MISMATCH = '竞技场客户端与服务器版本不匹配；请使用同一版本。当前装备与近战规则需要版本 5 客户端和服务器。';
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

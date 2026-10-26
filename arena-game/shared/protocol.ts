// Client <-> server message contract.
import type { TeamLayout } from './content.ts';
import type { Snapshot } from './match.ts';
import type { Input } from './sim.ts';

export const ROOM_NAME = 'arena';
export const DEFAULT_PORT = 2567;
/** Public Arena server (Cloudflare Worker + Durable Objects, worker/index.ts) used by the public site. */
export const PUBLIC_SERVER = 'wss://parhelion-arena.lejiazhang-us.workers.dev/arena';
/** A server URL with an /arena path speaks the Worker's plain-JSON protocol; bare host:port is Colyseus. */
export const isWorkerUrl = (url: string) => /^wss?:\/\/[^/]+\/arena\/?(\?|$)/.test(url.trim());

export interface JoinOptions {
  layout: TeamLayout;
  team: 'A' | 'B' | 'auto';
  name: string;
  char: number;
  skins: number[];
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
  welcome: { id: string; tick: number; map: string };
  snap: Snapshot;
}

export const LAYOUTS: TeamLayout[] = ['1v1', '1v2', '2v2'];

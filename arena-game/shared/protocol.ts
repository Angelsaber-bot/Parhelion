// Client <-> server message contract.
import type { TeamLayout } from './content.ts';
import type { Snapshot } from './match.ts';
import type { Input } from './sim.ts';

export const ROOM_NAME = 'arena';
export const DEFAULT_PORT = 2567;

export interface JoinOptions {
  layout: TeamLayout;
  team: 'A' | 'B' | 'auto';
  name: string;
  char: number;
  skins: number[];
  /** Fill empty slots with bots (room creator decides). */
  bots?: boolean;
}

export interface ClientMessages {
  input: Input[];
}

export interface ServerMessages {
  welcome: { id: string; tick: number };
  snap: Snapshot;
}

export const LAYOUTS: TeamLayout[] = ['1v1', '1v2', '2v2'];

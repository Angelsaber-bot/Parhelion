// A Session is "the server" from the game's point of view. Online it is a Colyseus room; offline
// it is the same shared Match running in the browser with bots. The game code is identical.

import { Client } from '@colyseus/sdk';
import { getMap } from '../shared/arenaMap.ts';
import { Bot, BOT_SKILL, navFor } from '../shared/bot.ts';
import { DT, SNAPSHOT_EVERY, TEAM_CAPACITY, type Team } from '../shared/content.ts';
import type { ArenaMap } from '../shared/map.ts';
import { Match, type Snapshot } from '../shared/match.ts';
import { ROOM_NAME, type JoinOptions } from '../shared/protocol.ts';
import type { Input } from '../shared/sim.ts';

export interface Session {
  readonly id: string;
  readonly online: boolean;
  readonly map: ArenaMap;
  send(inputs: Input[]): void;
  onSnapshot: (s: Snapshot) => void;
  onClose: (reason: string) => void;
  close(): void;
  /** Ask for the next match after the results screen. */
  rematch(): void;
  /** Freeze the whole match (offline only; an online server keeps running). */
  setPaused(paused: boolean): void;
  /** Offline only: the in-browser authoritative match (debug/testing). */
  match?: Match;
}

export async function joinOnline(url: string, opts: JoinOptions): Promise<Session> {
  const client = new Client(url);
  const room = await client.joinOrCreate(ROOM_NAME, opts);
  const s: Session = {
    id: room.sessionId,
    online: true,
    map: getMap(opts.map),
    send: (inputs) => room.send('input', inputs),
    onSnapshot: () => {},
    onClose: () => {},
    close: () => { void room.leave(); },
    rematch: () => room.send('rematch', true),
    setPaused: () => {},
  };
  room.onMessage('snap', (snap: Snapshot) => s.onSnapshot(snap));
  room.onMessage('welcome', () => {});
  room.onLeave((code: number) => s.onClose(`disconnected (${code})`));
  return s;
}

export function startOffline(opts: JoinOptions, difficulty: keyof typeof BOT_SKILL): Session {
  const match = new Match(getMap(opts.map), opts.layout);
  navFor(match); // build the nav grid up front so the first bot tick doesn't hitch
  const team: Team = opts.team === 'B' ? 'B' : 'A';
  const id = 'you';
  match.addPlayer(id, { name: opts.name || 'You', team, char: opts.char, skins: opts.skins, bot: false });
  let seed = 7;
  for (const t of ['A', 'B'] as Team[]) {
    for (let i = match.teamCount(t); i < TEAM_CAPACITY[opts.layout][t]; i++) {
      const n = seed++;
      match.addPlayer(`bot-${n}`, { name: `Bot ${n - 6}`, team: t, char: n % 2, skins: [n % 2, n % 2, n % 2], bot: true }, new Bot(n, BOT_SKILL[difficulty]));
    }
  }
  let last = performance.now(), acc = 0, paused = false;
  const s: Session = {
    id,
    online: false,
    map: match.map,
    send: (inputs) => match.queueInputs(id, inputs),
    onSnapshot: () => {},
    onClose: () => {},
    close: () => clearInterval(timer),
    rematch: () => match.rematch(),
    setPaused: (p) => { paused = p; last = performance.now(); acc = 0; },
    match,
  };
  const timer = setInterval(() => {
    if (paused) return;
    const now = performance.now();
    acc = Math.min(acc + (now - last) / 1000, 0.25);
    last = now;
    while (acc >= DT) {
      acc -= DT;
      match.step();
      if (match.tick % SNAPSHOT_EVERY === 0) s.onSnapshot(match.snapshot());
    }
  }, 4);
  return s;
}

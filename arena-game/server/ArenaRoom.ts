// Colyseus room wrapping the shared RoomCore (local / self-hosted server). No schema state sync:
// the room broadcasts full Match snapshots at 20 Hz (they are tiny for <= 4 players), which keeps
// the client's prediction/reconciliation code identical for online and offline play.
// The public site uses the same RoomCore inside a Cloudflare Durable Object (worker/index.ts).

import { appendFile } from 'node:fs/promises';
import { Room, type Client, type Server } from '@colyseus/core';
import { TICK_HZ, validateLoadout } from '../shared/content.ts';
import type { Match } from '../shared/match.ts';
import { assertRulesVersion, normalizeRoomCode, PRIVATE_ROOM_NAME, ROOM_NAME, type JoinOptions } from '../shared/protocol.ts';
import { LOCAL_TRAINER, PUBLIC_TRAINER, releasedBotPolicies } from '../shared/releasedBotPolicy.ts';
import { RoomCore } from '../shared/room.ts';

/** Human-only weapon telemetry of local-server matches, one JSON record per line. */
const STATS_FILE = process.env.ARENA_STATS_FILE ?? 'arena-stats.jsonl';
const botPolicies = releasedBotPolicies(process.env.ARENA_TRAINER === 'local' ? LOCAL_TRAINER : PUBLIC_TRAINER);

export class ArenaRoom extends Room {
  core!: RoomCore;
  get match(): Match { return this.core.match; }
  maxMessagesPerSecond = 120;

  onCreate(options: Partial<JoinOptions>): void | Promise<void> {
    if (options.bots) return botPolicies.forMatch().then(({ neural }) => {
      this.prepare(new RoomCore(options, 'local', neural), options);
    });
    this.prepare(new RoomCore(options, 'local'), options);
  }

  private prepare(core: RoomCore, options: Partial<JoinOptions>) {
    this.core = core;
    this.maxClients = core.capacity;
    // Colyseus 0.18 replaces metadata; keep every declared matchmaking filter.
    this.setMetadata({ layout: core.layout, map: core.mapId, bots: core.fillBots, ...(typeof options.room === 'string' ? { room: options.room } : {}) });
    this.onMessage('rematch', () => core.rematch());
    this.onMessage('input', (client: Client, inputs: unknown) => core.input(client.sessionId, inputs));
    this.setSimulationInterval(() => {
      const snap = core.step();
      if (snap) this.broadcast('snap', snap);
      this.saveStats();
    }, 1000 / TICK_HZ);
  }

  private saveStats() {
    for (const r of this.core.match.stats.drain()) void appendFile(STATS_FILE, JSON.stringify(r) + '\n').catch(() => {});
  }

  onDispose() {
    this.core.match.flushStats();
    this.saveStats();
  }

  onAuth(_client: Client, options: Partial<JoinOptions>) {
    assertRulesVersion(options.rulesVersion);
    if (options.room !== undefined && !normalizeRoomCode(options.room)) throw new Error('bad room code');
    validateLoadout(options.loadout);
    return true;
  }

  onJoin(client: Client, options: Partial<JoinOptions>) {
    client.send('welcome', this.core.join(client.sessionId, options));
  }

  onLeave(client: Client) {
    this.core.leave(client.sessionId);
  }
}

/** The standalone server and the local launcher offer the same matchmaking routes. */
export function registerArenaRooms(server: Server) {
  server.define(ROOM_NAME, ArenaRoom).filterBy(['layout', 'map', 'bots']);
  server.define(PRIVATE_ROOM_NAME, ArenaRoom).filterBy(['room']);
}

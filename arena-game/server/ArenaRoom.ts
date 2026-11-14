// Colyseus room wrapping the shared RoomCore (local / self-hosted server). No schema state sync:
// the room broadcasts full Match snapshots at 20 Hz (they are tiny for <= 4 players), which keeps
// the client's prediction/reconciliation code identical for online and offline play.
// The public site uses the same RoomCore inside a Cloudflare Durable Object (worker/index.ts).

import { ANTI_CHEAT_CLOSE, ANTI_CHEAT_REASON } from '../shared/antiCheat.ts';
import { appendFile } from 'node:fs/promises';
import { Room, type Client } from '@colyseus/core';
import { TICK_HZ, validateLoadout } from '../shared/content.ts';
import type { Match } from '../shared/match.ts';
import { assertRulesVersion, type JoinOptions } from '../shared/protocol.ts';
import { RoomCore } from '../shared/room.ts';

/** Human-only weapon telemetry of local-server matches, one JSON record per line. */
const STATS_FILE = process.env.ARENA_STATS_FILE ?? 'arena-stats.jsonl';

export class ArenaRoom extends Room {
  core!: RoomCore;
  get match(): Match { return this.core.match; }
  maxMessagesPerSecond = 120;

  onCreate(options: Partial<JoinOptions>) {
    const core = this.core = new RoomCore(options, 'local');
    this.maxClients = core.capacity;
    // Colyseus 0.18 replaces metadata; keep every declared matchmaking filter.
    this.setMetadata({ layout: core.layout, map: core.mapId, bots: core.fillBots });
    const enforce = (client: Client, allowed: boolean) => {
      if (!allowed) { core.leave(client.sessionId); client.leave(ANTI_CHEAT_CLOSE, ANTI_CHEAT_REASON); }
    };
    this.onMessage('rematch', (client: Client) => enforce(client, core.requestRematch(client.sessionId)));
    this.onMessage('input', (client: Client, inputs: unknown) => enforce(client, core.input(client.sessionId, inputs)));
    this.setSimulationInterval(() => {
      const snap = core.step();
      if (snap) for (const client of this.clients) client.send('snap', core.snapshotFor(client.sessionId, snap));
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

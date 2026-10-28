// Colyseus room wrapping the shared RoomCore (local / self-hosted server). No schema state sync:
// the room broadcasts full Match snapshots at 20 Hz (they are tiny for <= 4 players), which keeps
// the client's prediction/reconciliation code identical for online and offline play.
// The public site uses the same RoomCore inside a Cloudflare Durable Object (worker/index.ts).

import { Room, type Client } from '@colyseus/core';
import { TICK_HZ, validateLoadout } from '../shared/content.ts';
import type { Match } from '../shared/match.ts';
import { assertRulesVersion, type JoinOptions } from '../shared/protocol.ts';
import { RoomCore } from '../shared/room.ts';

export class ArenaRoom extends Room {
  core!: RoomCore;
  get match(): Match { return this.core.match; }
  maxMessagesPerSecond = 120;

  onCreate(options: Partial<JoinOptions>) {
    const core = this.core = new RoomCore(options);
    this.maxClients = core.capacity;
    // Colyseus 0.18 replaces metadata; keep every declared matchmaking filter.
    this.setMetadata({ layout: core.layout, map: core.mapId, bots: core.fillBots });
    this.onMessage('rematch', () => core.rematch());
    this.onMessage('input', (client: Client, inputs: unknown) => core.input(client.sessionId, inputs));
    this.setSimulationInterval(() => {
      const snap = core.step();
      if (snap) this.broadcast('snap', snap);
    }, 1000 / TICK_HZ);
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

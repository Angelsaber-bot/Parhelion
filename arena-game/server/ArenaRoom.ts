// Colyseus room wrapping the shared authoritative Match. No schema state sync: the room
// broadcasts full Match snapshots at 20 Hz (they are tiny for <= 4 players), which keeps the
// client's prediction/reconciliation code identical for online and offline play.

import { Room, type Client } from '@colyseus/core';
import { getMap, mapIdOf } from '../shared/arenaMap.ts';
import { Bot, BOT_SKILL } from '../shared/bot.ts';
import { SNAPSHOT_EVERY, TEAM_CAPACITY, TICK_HZ, type Team, type TeamLayout } from '../shared/content.ts';
import { Match } from '../shared/match.ts';
import { LAYOUTS, type JoinOptions } from '../shared/protocol.ts';

let botSeed = 1;

export class ArenaRoom extends Room {
  match!: Match;
  fillBots = false;
  mapId = '';
  maxMessagesPerSecond = 120;

  onCreate(options: Partial<JoinOptions>) {
    const layout: TeamLayout = LAYOUTS.includes(options.layout as TeamLayout) ? options.layout as TeamLayout : '1v1';
    const map = this.mapId = mapIdOf(options.map);
    this.match = new Match(getMap(map), layout);
    this.fillBots = !!options.bots;
    const cap = TEAM_CAPACITY[layout];
    this.maxClients = cap.A + cap.B;
    this.setMetadata({ layout, map });
    this.onMessage('rematch', () => this.match.rematch());
    this.onMessage('input', (client: Client, inputs: unknown) => {
      if (Array.isArray(inputs)) this.match.queueInputs(client.sessionId, inputs.slice(0, 16));
    });
    if (this.fillBots) this.topUpBots();
    this.setSimulationInterval(() => {
      this.match.step();
      if (this.match.tick % SNAPSHOT_EVERY === 0) this.broadcast('snap', this.match.snapshot());
    }, 1000 / TICK_HZ);
  }

  onJoin(client: Client, options: Partial<JoinOptions>) {
    const m = this.match;
    let team: Team | null = options.team === 'A' || options.team === 'B' ? options.team : null;
    if (team && !m.hasRoom(team)) {
      const bot = m.botOn(team);
      if (bot) m.removePlayer(bot);
    }
    if (!team || !m.hasRoom(team)) {
      // requested team is full of humans: seat the player on the other side rather than refuse
      team = m.autoTeam();
      if (!team) {
        const bot = m.botOn('A') ?? m.botOn('B');
        if (bot) { m.removePlayer(bot); team = m.autoTeam(); }
      }
      if (!team) throw new Error('Room is full');
    }
    m.addPlayer(client.sessionId, {
      name: String(options.name ?? 'Player').slice(0, 16) || 'Player',
      team,
      char: Number(options.char) || 0,
      skins: Array.isArray(options.skins) ? options.skins.map(Number) : [],
      bot: false,
    });
    client.send('welcome', { id: client.sessionId, tick: m.tick, map: this.mapId });
  }

  onLeave(client: Client) {
    this.match.removePlayer(client.sessionId);
    if (this.fillBots) this.topUpBots();
  }

  private topUpBots() {
    const m = this.match;
    for (const team of ['A', 'B'] as Team[]) {
      while (m.hasRoom(team)) {
        const n = botSeed++;
        m.addPlayer(`bot-${n}`, { name: `Bot ${n}`, team, char: n % 2, skins: [n % 2, n % 2, n % 2], bot: true }, new Bot(n, BOT_SKILL.normal));
      }
    }
  }
}

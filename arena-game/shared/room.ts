// Transport-agnostic Arena room: seating, bots, inputs, stepping. The local Colyseus room
// (server/ArenaRoom.ts) and the public Cloudflare Durable Object (worker/index.ts) both wrap it,
// so online rules are identical wherever the server runs.

import { getMap, mapIdOf } from './arenaMap.ts';
import { Bot, BOT_SKILL } from './bot.ts';
import { SNAPSHOT_EVERY, TEAM_CAPACITY, type Team, type TeamLayout } from './content.ts';
import { Match, type Snapshot } from './match.ts';
import { LAYOUTS, RULES_VERSION, assertRulesVersion, type JoinOptions } from './protocol.ts';

let botSeed = 1;

export class RoomCore {
  readonly match: Match;
  readonly layout: TeamLayout;
  readonly mapId: string;
  readonly fillBots: boolean;
  readonly capacity: number;

  constructor(options: Partial<JoinOptions>) {
    this.layout = LAYOUTS.includes(options.layout as TeamLayout) ? options.layout as TeamLayout : '1v1';
    this.mapId = mapIdOf(options.map);
    this.match = new Match(getMap(this.mapId), this.layout);
    this.fillBots = !!options.bots;
    const cap = TEAM_CAPACITY[this.layout];
    this.capacity = cap.A + cap.B;
    if (this.fillBots) this.topUpBots();
  }

  /** Seat a human; throws 'Room is full' when every seat holds a human. */
  join(id: string, options: Partial<JoinOptions>): { id: string; tick: number; map: string; rulesVersion: number } {
    assertRulesVersion(options.rulesVersion);
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
    m.addPlayer(id, {
      name: String(options.name ?? 'Player').slice(0, 16) || 'Player',
      team,
      char: Number(options.char) || 0,
      skins: Array.isArray(options.skins) ? options.skins.map(Number) : [],
      bot: false,
    });
    return { id, tick: m.tick, map: this.mapId, rulesVersion: RULES_VERSION };
  }

  leave(id: string) {
    this.match.removePlayer(id);
    if (this.fillBots) this.topUpBots();
  }

  input(id: string, inputs: unknown) {
    if (Array.isArray(inputs)) this.match.queueInputs(id, inputs.slice(0, 16));
  }

  rematch() { this.match.rematch(); }

  /** Advance one tick; returns a snapshot on broadcast ticks. */
  step(): Snapshot | null {
    this.match.step();
    return this.match.tick % SNAPSHOT_EVERY === 0 ? this.match.snapshot() : null;
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

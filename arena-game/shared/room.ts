// Transport-agnostic Arena room: seating, bots, inputs, stepping. The local Colyseus room
// (server/ArenaRoom.ts) and the public Cloudflare Durable Object (worker/index.ts) both wrap it,
// so online rules are identical wherever the server runs.

import { snapshotForViewer } from './visibility.ts';
import { ArenaTrafficGuard } from './antiCheat.ts';
import { getMap, mapIdOf } from './arenaMap.ts';
import { Bot, BOT_SKILL } from './bot.ts';
import { SNAPSHOT_EVERY, TEAM_CAPACITY, TICK_HZ, botLoadout, botUtility, validateLoadout, validateUtility, type Team, type TeamLayout } from './content.ts';
import { Match, type Snapshot } from './match.ts';
import { LAYOUTS, RULES_VERSION, assertRulesVersion, type JoinOptions } from './protocol.ts';
import type { StatsSource } from './weaponStats.ts';

let botSeed = 1;

export class RoomCore {
  private readonly guards = new Map<string, ArenaTrafficGuard>();
  readonly match: Match;
  readonly layout: TeamLayout;
  readonly mapId: string;
  readonly fillBots: boolean;
  readonly capacity: number;

  /** `statsSource` turns on human-only weapon telemetry for the room's matches. */
  constructor(options: Partial<JoinOptions>, statsSource?: StatsSource) {
    this.layout = LAYOUTS.includes(options.layout as TeamLayout) ? options.layout as TeamLayout : '1v1';
    this.mapId = mapIdOf(options.map);
    this.match = new Match(getMap(this.mapId), this.layout);
    this.fillBots = !!options.bots;
    const cap = TEAM_CAPACITY[this.layout];
    this.capacity = cap.A + cap.B;
    if (statsSource) this.match.stats.meta = { source: statsSource, botSkill: this.fillBots ? 'normal' : 'none' };
    if (this.fillBots) this.topUpBots();
  }

  /** Seat a human; throws 'Room is full' when every seat holds a human. */
  join(id: string, options: Partial<JoinOptions>): { id: string; tick: number; map: string; rulesVersion: number } {
    assertRulesVersion(options.rulesVersion);
    const loadout = validateLoadout(options.loadout), utility = validateUtility(options.utility);
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
      bot: false, loadout, utility,
    });
    // Refill by authoritative simulation time, never client timestamps.
    this.guards.set(id, new ArenaTrafficGuard(() => this.match.tick * 1000 / TICK_HZ));
    return { id, tick: m.tick, map: this.mapId, rulesVersion: RULES_VERSION };
  }

  leave(id: string) {
    this.guards.delete(id);
    // The last human leaving closes the round's telemetry before a bot takes the seat.
    const m = this.match, slot = m.slots.get(id);
    if (slot && !slot.info.bot && ![...m.slots.values()].some((s) => s !== slot && !s.info.bot)) m.flushStats();
    m.removePlayer(id);
    if (this.fillBots) this.topUpBots();
  }

  /** False means the transport must disconnect this session, never other players. */
  input(id: string, inputs: unknown): boolean {
    const guard = this.guards.get(id);
    if (!guard || !guard.message()) return false;
    if (guard.batch(inputs)) this.match.queueInputs(id, inputs);
    return !guard.blocked;
  }

  requestRematch(id: string): boolean {
    const guard = this.guards.get(id);
    if (!guard || !guard.message()) return false;
    this.rematch();
    return true;
  }

  snapshotFor(id: string, snapshot: Snapshot): Snapshot {
    return snapshotForViewer(this.match.map, snapshot, id);
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
        m.addPlayer(`bot-${n}`, { name: `Bot ${n}`, team, char: n % 2, skins: [n % 2, n % 2, n % 2], loadout: botLoadout(n), utility: botUtility(n), bot: true }, new Bot(n, BOT_SKILL.normal));
      }
    }
  }
}

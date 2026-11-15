import {CONTENT_MANIFEST,assertContentManifest} from './manifest.ts';
// Transport-agnostic Arena room: seating, bots, inputs, stepping. The local Colyseus room
// (server/ArenaRoom.ts) and the public Cloudflare Durable Object (worker/index.ts) both wrap it,
// so online rules are identical wherever the server runs.

import { getMap, mapIdOf } from './arenaMap.ts';
import { Bot, BOT_SKILL } from './bot.ts';
import { CHARACTERS, PLAYABLE_HERO_INDICES, abilityFor, heroIndex, SNAPSHOT_EVERY, TEAM_CAPACITY, botLoadout, botUtility, validateLoadout, validateUtility, type Team, type TeamLayout } from './content.ts';
import { Match, type Snapshot } from './match.ts';
import { LAYOUTS, RULES_VERSION, assertRulesVersion, type JoinOptions } from './protocol.ts';
import type { StatsSource } from './weaponStats.ts';

let botSeed = 1;

export class RoomCore {
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
  join(id: string, options: Partial<JoinOptions>): { id: string; tick: number; map: string; rulesVersion: number; contentManifest:string } {
    assertRulesVersion(options.rulesVersion);assertContentManifest(options.contentManifest);
    const loadout = validateLoadout(options.loadout), utility = validateUtility(options.utility);
    const char = heroIndex(options.heroId, options.char ?? 2);
    const m = this.match;
    if(m.slots.has(id))throw new Error('Player already seated');
    let team:Team|null=options.team==='A'||options.team==='B'?options.team:null;
    // Decide and validate the complete seat change before touching a running match.
    if(!team||(!m.hasRoom(team)&&!m.botOn(team))) {
      team=m.autoTeam();
      if(!team){const bot=m.botOn('A')??m.botOn('B');team=bot?m.slots.get(bot)!.info.team:null;}
    }
    if(!team)throw new Error('Room is full');
    const duplicate=this.layout==='2v2'?[...m.slots.values()].find(s=>s.info.team===team&&s.state.char===char):undefined;
    if(duplicate&&!duplicate.info.bot)throw new Error('同队已有此角色，请选择另一名 / Hero already selected by teammate');
    const evict=m.hasRoom(team)?null:duplicate?.state.id??m.botOn(team);
    if(!m.hasRoom(team)&&!evict)throw new Error('Room is full');
    if(evict)m.removePlayer(evict);
    if(duplicate&&duplicate.state.id!==evict) {
      const free=PLAYABLE_HERO_INDICES.find(i=>i!==char&&![...m.slots.values()].some(s=>s.info.team===team&&s.state.char===i))!;
      m.heroes.clearLife(duplicate.state.id);duplicate.state.lifeId++;
      duplicate.state.char=duplicate.info.char=free;duplicate.info.heroId=CHARACTERS[free].id;
      duplicate.state.ability.readyAt=m.tick+abilityFor(free).cooldown;
    }
    m.addPlayer(id, {
      name: String(options.name ?? 'Player').slice(0, 16) || 'Player',
      team,
      char, heroId: CHARACTERS[char].id,
      skins: Array.isArray(options.skins) ? options.skins.map(Number) : [],
      bot: false, loadout, utility,
    });
    return { id, tick: m.tick, map: this.mapId, rulesVersion: RULES_VERSION,contentManifest:CONTENT_MANIFEST };
  }

  leave(id: string) {
    // The last human leaving closes the round's telemetry before a bot takes the seat.
    const m = this.match, slot = m.slots.get(id);
    if (slot && !slot.info.bot && ![...m.slots.values()].some((s) => s !== slot && !s.info.bot)) m.flushStats();
    m.removePlayer(id);
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
        m.addPlayer(`bot-${n}`, { name: `Bot ${n}`, team, char: PLAYABLE_HERO_INDICES.map((_,i)=>PLAYABLE_HERO_INDICES[(i+n)%PLAYABLE_HERO_INDICES.length]).find(i=>![...m.slots.values()].some(s=>s.info.team===team&&s.state.char===i))!, skins: [n % 2, n % 2, n % 2], loadout: botLoadout(n), utility: botUtility(n), bot: true }, new Bot(n, BOT_SKILL.normal));
      }
    }
  }
}

// Authoritative match simulation. Transport-agnostic: the Colyseus room and the offline
// in-browser host both drive this same class. Owns players, input queues, hit resolution with
// lag compensation, shields, scoring, respawns and match phases.

import {
  CHARACTERS, COUNTDOWN_TICKS, END_TICKS, MATCH_TICKS, MAX_REWIND_TICKS, RESPAWN_TICKS, SCORE_LIMIT,
  SHIELD, TEAM_CAPACITY, WEAPONS, falloff, type Team, type TeamLayout,
} from './content.ts';
import { rayPlayer, rayShield } from './hit.ts';
import { raycastMap, spawnAnchors, type ArenaMap, type Vec3 } from './map.ts';
import { applyInput, clonePlayer, newPlayer, quant, type Input, type PlayerState, type SimEvent } from './sim.ts';

export type Phase = 'waiting' | 'countdown' | 'live' | 'ended';

export interface Controller {
  /** Called once per tick before inputs are consumed; returns this tick's input. */
  think(match: Match, id: string): Input;
}

export interface Shield {
  id: number;
  team: Team;
  owner: string;
  x: number; y: number; z: number; yaw: number;
  hp: number;
  life: number;
}

export type NetEvent =
  | { t: 'shot'; id: string; w: number; from: Vec3; to: Vec3[] }
  | { t: 'hit'; shooter: string; victim: string; dmg: number; head: boolean }
  | { t: 'kill'; killer: string; victim: string; w: number; head: boolean }
  | { t: 'shieldUp'; sid: number; owner: string }
  | { t: 'shieldBreak'; sid: number }
  | { t: 'spawn'; id: string }
  | { t: 'phase'; phase: Phase; winner?: Team | 'draw' }
  | { t: 'fx'; id: string; kind: 'dash' | 'jump' | 'reload' };

export interface PlayerInfo {
  name: string;
  team: Team;
  char: number;
  skins: number[]; // skin index per weapon
  bot: boolean;
}

export interface PlayerSnap extends PlayerState {
  name: string;
  skins: number[];
  bot: boolean;
  kills: number;
  deaths: number;
  respawn: number;
}

export interface Snapshot {
  tick: number;
  layout: TeamLayout;
  phase: Phase;
  phaseT: number; // ticks left in the current phase (0 when untimed)
  score: Record<Team, number>;
  players: PlayerSnap[];
  shields: Shield[];
  events: NetEvent[];
}

interface Slot {
  state: PlayerState;
  info: PlayerInfo;
  queue: Input[];
  credits: number;
  controller?: Controller;
  kills: number;
  deaths: number;
  respawn: number;
}

const HISTORY = 64;
const MAX_QUEUE = 30;
const MAX_CREDITS = 8; // inputs a client may "catch up" in one tick after a stall

export class Match {
  tick = 0;
  phase: Phase = 'waiting';
  /** After a match ends: false (default) holds on the results until rematch(); true restarts by itself. */
  autoRestart = false;
  phaseT = 0;
  score: Record<Team, number> = { A: 0, B: 0 };
  shields: Shield[] = [];
  readonly slots = new Map<string, Slot>();
  private events: NetEvent[] = [];
  private history: Map<string, [number, number, number, boolean]>[] = [];
  private nextShield = 1;

  constructor(readonly map: ArenaMap, readonly layout: TeamLayout) {}

  // ---------- roster ----------

  teamCount(team: Team): number {
    let n = 0;
    for (const s of this.slots.values()) if (s.info.team === team) n++;
    return n;
  }

  hasRoom(team: Team): boolean {
    return this.teamCount(team) < TEAM_CAPACITY[this.layout][team];
  }

  /** Pick the team with the most free slots (A on ties). */
  autoTeam(): Team | null {
    const free = (t: Team) => TEAM_CAPACITY[this.layout][t] - this.teamCount(t);
    if (free('A') <= 0 && free('B') <= 0) return null;
    return free('A') >= free('B') ? 'A' : 'B';
  }

  addPlayer(id: string, info: PlayerInfo, controller?: Controller): void {
    if (this.slots.has(id)) throw new Error('duplicate player');
    if (!this.hasRoom(info.team)) throw new Error(`team ${info.team} is full`);
    const char = Math.max(0, Math.min(CHARACTERS.length - 1, info.char | 0));
    const skins = WEAPONS.map((w, i) => Math.max(0, Math.min(w.skins.length - 1, info.skins[i] | 0)));
    const slot: Slot = {
      state: newPlayer(id, info.team, char),
      info: { ...info, char, skins },
      queue: [], credits: 0, controller, kills: 0, deaths: 0, respawn: 0,
    };
    this.slots.set(id, slot);
    this.spawn(slot);
  }

  removePlayer(id: string): void {
    this.slots.delete(id);
    this.shields = this.shields.filter((s) => s.owner !== id);
  }

  /** Bots occupying slots, used to make room when a human joins a full team. */
  botOn(team: Team): string | null {
    for (const [id, s] of this.slots) if (s.info.bot && s.info.team === team) return id;
    return null;
  }

  queueInputs(id: string, inputs: Input[]): void {
    const slot = this.slots.get(id);
    if (!slot) return;
    for (const raw of inputs) {
      const inp = sanitize(raw);
      if (!inp || inp.seq <= slot.state.lastSeq) continue;
      const last = slot.queue[slot.queue.length - 1];
      if (last && inp.seq <= last.seq) continue;
      slot.queue.push(inp);
    }
    if (slot.queue.length > MAX_QUEUE) slot.queue.splice(0, slot.queue.length - MAX_QUEUE);
  }

  player(id: string): PlayerState | undefined {
    return this.slots.get(id)?.state;
  }

  // ---------- simulation ----------

  step(): void {
    this.tick++;
    for (const [id, slot] of this.slots) {
      if (slot.controller) slot.queue.push(slot.controller.think(this, id));
      slot.credits = Math.min(slot.credits + 1, MAX_CREDITS);
      while (slot.credits >= 1 && slot.queue.length) {
        const inp = slot.queue.shift()!;
        slot.credits--;
        for (const ev of applyInput(this.map, slot.state, inp)) this.handle(slot, ev);
      }
    }

    for (const slot of this.slots.values()) {
      if (!slot.state.alive && slot.respawn > 0 && --slot.respawn === 0) this.spawn(slot);
    }
    for (const sh of this.shields) sh.life--;
    this.shields = this.shields.filter((s) => s.life > 0 && s.hp > 0);

    this.stepPhase();
    this.record();
  }

  private stepPhase(): void {
    const bothTeams = this.teamCount('A') > 0 && this.teamCount('B') > 0;
    if (!bothTeams && this.phase !== 'waiting') { this.setPhase('waiting', 0); return; }
    switch (this.phase) {
      case 'waiting':
        if (bothTeams) this.setPhase('countdown', COUNTDOWN_TICKS);
        break;
      case 'countdown':
        if (--this.phaseT <= 0) this.startLive();
        break;
      case 'live': {
        const limit = SCORE_LIMIT[this.layout];
        if (--this.phaseT <= 0 || this.score.A >= limit || this.score.B >= limit) {
          const w = this.score.A === this.score.B ? 'draw' : this.score.A > this.score.B ? 'A' : 'B';
          this.setPhase('ended', this.autoRestart ? END_TICKS : 0, w);
        }
        break;
      }
      case 'ended':
        if (this.autoRestart && --this.phaseT <= 0) this.setPhase('countdown', COUNTDOWN_TICKS);
        break;
    }
  }

  /** Start the next match from the results screen (a player chose 再来一局). */
  rematch(): void {
    if (this.phase === 'ended') this.setPhase('countdown', COUNTDOWN_TICKS);
  }

  private setPhase(phase: Phase, ticks: number, winner?: Team | 'draw'): void {
    this.phase = phase;
    this.phaseT = ticks;
    this.events.push({ t: 'phase', phase, winner });
  }

  private startLive(): void {
    this.score = { A: 0, B: 0 };
    this.shields = [];
    for (const s of this.slots.values()) {
      s.kills = 0;
      s.deaths = 0;
      this.spawn(s);
    }
    this.setPhase('live', MATCH_TICKS);
  }

  private spawn(slot: Slot): void {
    const p = slot.state;
    const enemies = [...this.slots.values()].filter((s) => s.info.team !== p.team && s.state.alive);
    const mates = [...this.slots.values()].filter((s) => s !== slot && s.info.team === p.team && s.state.alive);
    let best = spawnAnchors(this.map, p.team)[0];
    let bestScore = -Infinity;
    for (const a of spawnAnchors(this.map, p.team)) {
      const [ax, , az] = a.position;
      let score = 0;
      for (const e of enemies) score += Math.min(40, Math.hypot(e.state.x - ax, e.state.z - az));
      for (const m of mates) if (Math.hypot(m.state.x - ax, m.state.z - az) < 1.2) score -= 1000;
      if (score > bestScore) { bestScore = score; best = a; }
    }
    const [x, y, z] = best.position;
    Object.assign(p, {
      x, y, z, vx: 0, vy: 0, vz: 0,
      yaw: Math.atan2(x, z), // face the map centre
      pitch: 0, hp: CHARACTERS[p.char].hp, alive: true, grounded: true,
      ammo: WEAPONS.map((w) => w.mag), reload: 0, fireCd: 0, dashCd: 0, dashT: 0, shieldCd: 0,
    });
    slot.respawn = 0;
    this.events.push({ t: 'spawn', id: p.id });
  }

  private handle(slot: Slot, ev: SimEvent): void {
    const id = slot.state.id;
    switch (ev.type) {
      case 'fire': this.resolveFire(slot, ev); break;
      case 'shield':
        this.shields.push({
          id: this.nextShield, team: slot.state.team, owner: id,
          x: ev.x, y: ev.y, z: ev.z, yaw: ev.yaw, hp: SHIELD.hp, life: SHIELD.life,
        });
        this.events.push({ t: 'shieldUp', sid: this.nextShield++, owner: id });
        break;
      case 'dash': case 'jump': case 'reload':
        this.events.push({ t: 'fx', id, kind: ev.type });
        break;
    }
  }

  /** Other players' positions as the shooter saw them (interpolated history, clamped). */
  private rewound(view: number): Map<string, [number, number, number, boolean]> {
    const now = new Map<string, [number, number, number, boolean]>();
    for (const [id, s] of this.slots) now.set(id, [s.state.x, s.state.y, s.state.z, s.state.alive]);
    const v = Math.max(this.tick - MAX_REWIND_TICKS, Math.min(this.tick - 1, view));
    if (!(v < this.tick - 1) || !Number.isFinite(v)) return now;
    const a = this.history[Math.floor(v) % HISTORY], b = this.history[Math.ceil(v) % HISTORY];
    if (!a || !b) return now;
    const f = v - Math.floor(v);
    const out = new Map<string, [number, number, number, boolean]>();
    for (const [id, cur] of now) {
      const pa = a.get(id), pb = b.get(id);
      if (!pa || !pb || !cur[3]) { out.set(id, cur); continue; }
      out.set(id, [pa[0] + (pb[0] - pa[0]) * f, pa[1] + (pb[1] - pa[1]) * f, pa[2] + (pb[2] - pa[2]) * f, cur[3]]);
    }
    return out;
  }

  private resolveFire(slot: Slot, ev: Extract<SimEvent, { type: 'fire' }>): void {
    const shooter = slot.state;
    const w = WEAPONS[ev.weapon];
    const pos = this.rewound(ev.view);
    const ends: Vec3[] = [];
    const damage = new Map<string, { dmg: number; head: boolean }>();
    for (const d of ev.dirs) {
      let best = raycastMap(this.map, ev.origin, d, w.range);
      if (best === Infinity) best = w.range;
      let target: { kind: 'player'; id: string; head: boolean } | { kind: 'shield'; sh: Shield } | null = null;
      for (const sh of this.shields) {
        if (sh.team === shooter.team) continue;
        const t = rayShield(ev.origin, d, sh.x, sh.y, sh.z, sh.yaw);
        if (t < best) { best = t; target = { kind: 'shield', sh }; }
      }
      for (const [id, s] of this.slots) {
        if (id === shooter.id || s.info.team === shooter.team) continue;
        const p = pos.get(id)!;
        if (!p[3]) continue;
        const h = rayPlayer(ev.origin, d, p[0], p[1], p[2]);
        if (h && h.t < best) { best = h.t; target = { kind: 'player', id, head: h.head }; }
      }
      ends.push([quant(ev.origin[0] + d[0] * best), quant(ev.origin[1] + d[1] * best), quant(ev.origin[2] + d[2] * best)]);
      if (!target) continue;
      const dmg = w.damage * falloff(w, best);
      if (target.kind === 'shield') {
        target.sh.hp -= dmg;
        if (target.sh.hp <= 0) this.events.push({ t: 'shieldBreak', sid: target.sh.id });
      } else {
        const acc = damage.get(target.id) ?? { dmg: 0, head: false };
        acc.dmg += dmg * (target.head ? w.headMul : 1);
        acc.head ||= target.head;
        damage.set(target.id, acc);
      }
    }
    this.events.push({ t: 'shot', id: shooter.id, w: ev.weapon, from: ev.origin.map(quant) as Vec3, to: ends });
    if (this.phase === 'ended') return;
    for (const [vid, { dmg, head }] of damage) this.damage(slot, vid, Math.round(dmg), head, ev.weapon);
  }

  private damage(from: Slot, victimId: string, dmg: number, head: boolean, weapon: number): void {
    const v = this.slots.get(victimId);
    if (!v || !v.state.alive || dmg <= 0) return;
    v.state.hp = Math.max(0, v.state.hp - dmg);
    this.events.push({ t: 'hit', shooter: from.state.id, victim: victimId, dmg, head });
    if (v.state.hp > 0) return;
    v.state.alive = false;
    v.state.dashT = 0;
    v.respawn = RESPAWN_TICKS;
    v.deaths++;
    from.kills++;
    if (this.phase === 'live') this.score[from.state.team]++;
    this.events.push({ t: 'kill', killer: from.state.id, victim: victimId, w: weapon, head });
  }

  private record(): void {
    const frame = new Map<string, [number, number, number, boolean]>();
    for (const [id, s] of this.slots) frame.set(id, [s.state.x, s.state.y, s.state.z, s.state.alive]);
    this.history[this.tick % HISTORY] = frame;
  }

  /** Full snapshot; drains pending events. */
  snapshot(): Snapshot {
    const players: PlayerSnap[] = [];
    for (const s of this.slots.values()) {
      players.push({
        ...clonePlayer(s.state), name: s.info.name, skins: s.info.skins, bot: s.info.bot,
        kills: s.kills, deaths: s.deaths, respawn: s.respawn,
      });
    }
    const events = this.events;
    this.events = [];
    return {
      tick: this.tick, layout: this.layout, phase: this.phase, phaseT: this.phaseT,
      score: { ...this.score }, players, shields: this.shields.map((s) => ({ ...s })), events,
    };
  }
}

const num = (v: unknown, lo: number, hi: number): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : null;

/** Never trust client inputs: clamp every field. */
export function sanitize(raw: unknown): Input | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const seq = num(r.seq, 0, 2 ** 31);
  const yaw = num(r.yaw, -1e4, 1e4), pitch = num(r.pitch, -1.5, 1.5);
  if (seq === null || yaw === null || pitch === null) return null;
  return {
    seq: Math.floor(seq),
    mx: Math.round(num(r.mx, -1, 1) ?? 0),
    mz: Math.round(num(r.mz, -1, 1) ?? 0),
    yaw, pitch,
    buttons: (num(r.buttons, 0, 31) ?? 0) | 0,
    weapon: (num(r.weapon, 0, WEAPONS.length - 1) ?? 0) | 0,
    view: num(r.view, 0, 2 ** 31) ?? 0,
  };
}

// Authoritative match simulation. Transport-agnostic: the Colyseus room and the offline
// in-browser host both drive this same class. Owns players, input queues, hit resolution with
// lag compensation, shields, scoring, respawns and match phases.

import {
  CHARACTERS, COUNTDOWN_TICKS, END_TICKS, MATCH_TICKS, MAX_REWIND_TICKS, RESPAWN_TICKS, SCORE_LIMIT,
  SHIELD, TEAM_CAPACITY, WEAPONS, falloff, validateLoadout, loadoutWeapon, type Loadout, type Team, type TeamLayout,
} from './content.ts';
import { RULES_VERSION } from './protocol.ts';
import { playerHitbox, rayPlayer, rayShield } from './hit.ts';
import { raycastMap, spawnAnchors, type ArenaMap, type Vec3 } from './map.ts';
import { aimDir, applyInput, clonePlayer, newPlayer, playerEye, quant, type Input, type PlayerState, type SimEvent } from './sim.ts';

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
  | { t: 'meleeStart'; id: string; w: number; windup: number; yaw: number; pitch: number }
  | { t: 'meleeStrike'; id: string; w: number; from: Vec3; to: Vec3 }
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
  skins: number[]; // skin index per catalog weapon
  loadout?: Loadout;
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
  rulesVersion: number;
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
  meleeReadyTick: number;
  melee: { weapon: number; impactTick: number; yaw: number; pitch: number } | null;
}

type HistoricalPose = [number, number, number, boolean, boolean]; // x, y, z, alive, crouched
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
  private history: Map<string, HistoricalPose>[] = [];
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
    const loadout = validateLoadout(info.loadout);
    const slot: Slot = {
      state: newPlayer(id, info.team, char, loadout),
      info: { ...info, char, skins, loadout },
      queue: [], credits: 0, controller, kills: 0, deaths: 0, respawn: 0, meleeReadyTick: 0, melee: null,
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
        const events = applyInput(this.map, slot.state, inp);
        // A swap cancels the armed hit immediately, even if a catch-up batch swaps back.
        if (slot.melee && slot.melee.weapon !== slot.state.weapon) slot.melee = null;
        for (const ev of events) this.handle(slot, ev);
      }
    }

    // Attack timing belongs to the authoritative world clock, not input packet counts.
    // Delayed/catch-up inputs cannot compress the visible telegraph or restart recovery.
    for (const slot of this.slots.values()) {
      const p = slot.state;
      if (!p.alive || (slot.melee && slot.melee.weapon !== p.weapon)) slot.melee = null;
      p.meleeWindup = slot.melee ? Math.max(0, slot.melee.impactTick - this.tick) : 0;
      p.fireCd = Math.max(p.fireCd, slot.meleeReadyTick - this.tick);
      if (slot.melee && slot.melee.impactTick <= this.tick) {
        const attack = slot.melee; slot.melee = null;
        this.resolveMelee(slot, attack);
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
      pitch: 0, hp: CHARACTERS[p.char].hp, alive: true, grounded: true, crouched: false, prevButtons: 0,
      weapon: loadoutWeapon(p.loadout, 0), weaponSlot: 0, meleeWindup: 0, meleeYaw: 0, meleePitch: 0,
      ammo: WEAPONS.map((w) => w.mag), reload: 0, fireCd: 0, dashCd: 0, dashT: 0, shieldCd: 0,
    });
    slot.respawn = 0; slot.melee = null; slot.meleeReadyTick = 0;
    this.events.push({ t: 'spawn', id: p.id });
  }

  private handle(slot: Slot, ev: SimEvent): void {
    const id = slot.state.id;
    switch (ev.type) {
      case 'fire': this.resolveFire(slot, ev); break;
      case 'meleeStart': {
        const w = WEAPONS[ev.weapon];
        if (slot.melee || this.tick < slot.meleeReadyTick || this.phase === 'ended') {
          slot.state.meleeWindup = slot.melee ? Math.max(0, slot.melee.impactTick - this.tick) : 0;
          break;
        }
        slot.meleeReadyTick = this.tick + w.interval;
        slot.melee = { weapon: ev.weapon, impactTick: this.tick + w.windup!, yaw: ev.yaw, pitch: ev.pitch };
        this.events.push({ t: 'meleeStart', id, w: ev.weapon, windup: w.windup!, yaw: ev.yaw, pitch: ev.pitch });
        break;
      }
      // Predicted timing is useful locally; authoritative impacts are fixed-step scheduled above.
      case 'meleeStrike': break;
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
  private rewound(view: number): Map<string, HistoricalPose> {
    const now = new Map<string, HistoricalPose>();
    for (const [id, s] of this.slots) now.set(id, [s.state.x, s.state.y, s.state.z, s.state.alive, s.state.crouched]);
    const v = Math.max(this.tick - MAX_REWIND_TICKS, Math.min(this.tick - 1, view));
    if (!(v < this.tick - 1) || !Number.isFinite(v)) return now;
    const a = this.history[Math.floor(v) % HISTORY], b = this.history[Math.ceil(v) % HISTORY];
    if (!a || !b) return now;
    const f = v - Math.floor(v);
    const out = new Map<string, HistoricalPose>();
    for (const [id, cur] of now) {
      const pa = a.get(id), pb = b.get(id);
      if (!pa || !pb || !cur[3]) { out.set(id, cur); continue; }
      out.set(id, [pa[0] + (pb[0] - pa[0]) * f, pa[1] + (pb[1] - pa[1]) * f, pa[2] + (pb[2] - pa[2]) * f, cur[3], f < 0.5 ? pa[4] : pb[4]]);
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
        const h = rayPlayer(ev.origin, d, p[0], p[1], p[2], p[4]);
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

  /** One current-time contact in a fixed 3D arc. Walls and hostile shields block every candidate. */
  private resolveMelee(slot: Slot, attack: NonNullable<Slot['melee']>): void {
    const p = slot.state, w = WEAPONS[attack.weapon];
    const origin: Vec3 = [p.x, p.y + playerEye(this.map, p), p.z];
    const aim = aimDir(attack.yaw, attack.pitch);
    let nearest = w.range, victim: string | null = null, shield: Shield | null = null;
    let end = origin.map((v, i) => v + aim[i] * w.range) as Vec3;
    // Only one victim per swing; distance to the contacted hit volume, not its centre.
    for (const [id, other] of this.slots) {
      const target = other.state;
      if (!target.alive || target.team === p.team || id === p.id) continue;
      const h = playerHitbox(target.crouched);
      const points: Vec3[] = [
        [target.x, target.y + h.headY, target.z],
        [target.x, target.y + (h.bodyBottom + h.bodyTop) * .5, target.z],
      ];
      for (const point of points) {
        const delta = point.map((v, i) => v - origin[i]) as Vec3;
        const length = Math.hypot(...delta);
        if (length < 1e-6) continue;
        const dir = delta.map((v) => v / length) as Vec3;
        if (dir.reduce((dot, v, i) => dot + v * aim[i], 0) < Math.cos(w.arc!)) continue;
        const hit = rayPlayer(origin, dir, target.x, target.y, target.z, target.crouched);
        if (!hit || hit.t > nearest || hit.t > w.range) continue;
        if (raycastMap(this.map, origin, dir, hit.t + .001) <= hit.t + .001) continue;
        let blocked: Shield | null = null, distance = hit.t;
        for (const sh of this.shields) {
          if (sh.team === p.team || sh.hp <= 0) continue;
          const t = rayShield(origin, dir, sh.x, sh.y, sh.z, sh.yaw);
          if (t < distance) { distance = t; blocked = sh; }
        }
        if (distance < nearest) {
          nearest = distance; victim = blocked ? null : id; shield = blocked;
          end = origin.map((v, i) => v + dir[i] * distance) as Vec3;
        }
      }
    }
    // A directly aimed shield can also be struck without a player behind it.
    for (const sh of this.shields) {
      if (sh.team === p.team || sh.hp <= 0) continue;
      const t = rayShield(origin, aim, sh.x, sh.y, sh.z, sh.yaw);
      if (t < nearest && raycastMap(this.map, origin, aim, t + .001) > t + .001) {
        nearest = t; victim = null; shield = sh;
        end = origin.map((v, i) => v + aim[i] * t) as Vec3;
      }
    }
    this.events.push({ t: 'meleeStrike', id: p.id, w: attack.weapon, from: origin.map(quant) as Vec3, to: end.map(quant) as Vec3 });
    if (this.phase === 'ended') return;
    if (shield) {
      shield.hp -= w.damage;
      if (shield.hp <= 0) this.events.push({ t: 'shieldBreak', sid: shield.id });
    } else if (victim) this.damage(slot, victim, w.damage, false, attack.weapon);
  }

  private damage(from: Slot, victimId: string, dmg: number, head: boolean, weapon: number): void {
    const v = this.slots.get(victimId);
    if (!v || !v.state.alive || dmg <= 0) return;
    v.state.hp = Math.max(0, v.state.hp - dmg);
    this.events.push({ t: 'hit', shooter: from.state.id, victim: victimId, dmg, head });
    if (v.state.hp > 0) return;
    v.state.alive = false;
    v.state.dashT = 0; v.state.meleeWindup = 0; v.melee = null;
    v.respawn = RESPAWN_TICKS;
    v.deaths++;
    from.kills++;
    if (this.phase === 'live') this.score[from.state.team]++;
    this.events.push({ t: 'kill', killer: from.state.id, victim: victimId, w: weapon, head });
  }

  private record(): void {
    const frame = new Map<string, HistoricalPose>();
    for (const [id, s] of this.slots) frame.set(id, [s.state.x, s.state.y, s.state.z, s.state.alive, s.state.crouched]);
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
      rulesVersion: RULES_VERSION, tick: this.tick, layout: this.layout, phase: this.phase, phaseT: this.phaseT,
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
    buttons: ((num(r.buttons, 0, 2 ** 31 - 1) ?? 0) | 0) & 63,
    weapon: typeof r.weapon === 'number' && Number.isInteger(r.weapon) && r.weapon >= 0 && r.weapon < 3 ? r.weapon : -1,
    view: num(r.view, 0, 2 ** 31) ?? 0,
  };
}

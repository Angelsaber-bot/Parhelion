// Frozen copy of the first baseline bot (before the 2026-10-26 'weaker, less rigid' rewrite), kept only
// so test/bench/duel.ts can measure the new bot against it.
// Rule-based baseline bot. Produces the same Input a human client sends, so it goes through the
// identical server rules. This is the scripted baseline the trained cover-choice AI will be
// evaluated against; a learned policy can replace it by implementing Controller.

import { CHARACTERS, HITBOX, WEAPONS } from '../../shared/content.ts';
import { lineOfSight, type Vec3 } from '../../shared/map.ts';
import type { Controller, Match } from '../../shared/match.ts';
import { NavGrid, type NavNode } from '../../shared/nav.ts';
import { BTN, forward, type Input, type PlayerState } from '../../shared/sim.ts';

export interface BotSkill {
  reaction: number; // ticks from first sight to first shot
  aimRate: number; // fraction of the angle error closed per tick
  aimError: number; // radians of residual wobble
  fireCone: number; // only fire when aim error below this
}

export const BOT_SKILL: Record<'easy' | 'normal' | 'hard', BotSkill> = {
  easy: { reaction: 30, aimRate: 0.08, aimError: 0.05, fireCone: 0.08 },
  normal: { reaction: 20, aimRate: 0.14, aimError: 0.03, fireCone: 0.05 },
  hard: { reaction: 12, aimRate: 0.22, aimError: 0.015, fireCone: 0.035 },
};

const navCache = new WeakMap<object, NavGrid>();
export function navFor(match: Match): NavGrid {
  let nav = navCache.get(match.map);
  if (!nav) { nav = new NavGrid(match.map); navCache.set(match.map, nav); }
  return nav;
}

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export class Bot implements Controller {
  private seq = 0;
  private yaw = 0;
  private pitch = 0;
  private rand: () => number;
  private targetId: string | null = null;
  private seenFor = 0;
  private lastSeen: Vec3 | null = null;
  private path: NavNode[] = [];
  private goal: Vec3 | null = null;
  private repath = 0;
  private strafe = 1;
  private strafeT = 0;
  private stuckT = 0;
  private lastPos: [number, number] = [0, 0];
  private lastHp = 0;
  private wobble = [0, 0];
  private wasAlive = false;

  constructor(seed: number, readonly skill: BotSkill = BOT_SKILL.normal) {
    this.rand = rng(seed);
  }

  think(match: Match, id: string): Input {
    const me = match.player(id)!;
    const inp: Input = { seq: ++this.seq, mx: 0, mz: 0, yaw: this.yaw, pitch: this.pitch, buttons: 0, weapon: me.weapon, view: match.tick };
    if (!me.alive) {
      this.targetId = null; this.path = []; this.goal = null; this.lastHp = CHARACTERS[me.char].hp;
      this.wasAlive = false;
      return inp;
    }
    if (!this.wasAlive) { this.yaw = me.yaw; this.pitch = 0; this.wasAlive = true; }

    const eye: Vec3 = [me.x, me.y + match.map.eye, me.z];
    const tookDamage = me.hp < this.lastHp;
    this.lastHp = me.hp;

    // --- perception: nearest visible enemy (chest or head) ---
    let target: PlayerState | null = null;
    let bestD = Infinity;
    for (const [oid, slot] of match.slots) {
      const o = slot.state;
      if (oid === id || o.team === me.team || !o.alive) continue;
      const d = Math.hypot(o.x - me.x, o.y - me.y, o.z - me.z);
      const facing = Math.abs(wrap(Math.atan2(-(o.x - me.x), -(o.z - me.z)) - this.yaw));
      if (facing > 1.6 && !tookDamage && d > 6 && oid !== this.targetId) continue; // field of view
      const chest: Vec3 = [o.x, o.y + 1.1, o.z], head: Vec3 = [o.x, o.y + HITBOX.headY, o.z];
      if ((lineOfSight(match.map, eye, chest) || lineOfSight(match.map, eye, head)) && d < bestD) {
        bestD = d; target = o;
      }
    }
    if (target) {
      if (target.id !== this.targetId) { this.targetId = target.id; this.seenFor = 0; }
      this.seenFor++;
      this.lastSeen = [target.x, target.y, target.z];
    } else {
      this.targetId = null;
      this.seenFor = 0;
    }

    // --- weapon choice by range ---
    const range = target ? bestD : 20;
    let want = range < 9 ? 1 : range > 28 ? 2 : 0;
    if (me.ammo[want] === 0 && me.reload === 0) want = (want + 1) % WEAPONS.length;
    inp.weapon = want;

    // --- movement goal ---
    const nav = navFor(match);
    let goal: Vec3 | null;
    const lowHp = me.hp < CHARACTERS[me.char].hp * 0.35;
    if (target && lowHp) goal = this.coverAway(match, me, target);
    else if (target) goal = null; // fight in place with strafing
    else if (this.lastSeen) goal = this.lastSeen;
    else goal = this.roamGoal(match, me);

    if (goal && (!this.goal || Math.hypot(goal[0] - this.goal[0], goal[2] - this.goal[2]) > 2 || --this.repath <= 0)) {
      const a = nav.nearest(me.x, me.y, me.z), b = nav.nearest(goal[0], goal[1], goal[2]);
      this.path = a && b ? nav.path(a, b) ?? [] : [];
      this.goal = goal;
      this.repath = 90;
    }
    if (!goal) { this.path = []; this.goal = null; }

    let moveX = 0, moveZ = 0;
    while (this.path.length && Math.hypot(this.path[0].x - me.x, this.path[0].z - me.z) < 0.45) this.path.shift();
    if (this.path.length) {
      const look = this.path[Math.min(2, this.path.length - 1)];
      moveX = look.x - me.x; moveZ = look.z - me.z;
    } else if (this.goal && this.lastSeen === this.goal) {
      this.lastSeen = null; // reached last known position, give up
      this.goal = null;
    } else if (!target) {
      this.goal = null;
    }

    if (target) {
      if (--this.strafeT <= 0) { this.strafe = this.rand() < 0.5 ? -1 : 1; this.strafeT = 40 + Math.floor(this.rand() * 60); }
      const [fx, fz] = forward(this.yaw);
      const prefer = WEAPONS[want].falloffStart * 0.8;
      const toward = bestD > prefer + 6 ? 0.7 : bestD < Math.min(prefer, 6) ? -0.6 : 0;
      moveX += (-fz * this.strafe + fx * toward) * 2;
      moveZ += (fx * this.strafe + fz * toward) * 2;
    }

    // stuck detection: try jumping and re-pathing
    if (Math.hypot(me.x - this.lastPos[0], me.z - this.lastPos[1]) < 0.02 && (moveX || moveZ)) {
      if (++this.stuckT > 20) { inp.buttons |= BTN.JUMP; this.strafe = -this.strafe; this.repath = 0; this.stuckT = 0; }
    } else this.stuckT = 0;
    this.lastPos = [me.x, me.z];

    // convert world move to local mx/mz relative to body yaw
    const l = Math.hypot(moveX, moveZ);
    if (l > 0.01) {
      const [fx, fz] = forward(this.yaw);
      const wx = moveX / l, wz = moveZ / l;
      const f = wx * fx + wz * fz, r = wx * -fz + wz * fx;
      inp.mz = Math.abs(f) > 0.38 ? Math.sign(f) : 0;
      inp.mx = Math.abs(r) > 0.38 ? Math.sign(r) : 0;
    }

    // --- aim ---
    let aimYaw = this.yaw, aimPitch = 0;
    if (target) {
      const dx = target.x - me.x, dz = target.z - me.z;
      const ty = target.y + (this.skill === BOT_SKILL.hard && bestD > 12 ? HITBOX.headY - 0.05 : 1.15);
      aimYaw = Math.atan2(-dx, -dz);
      aimPitch = Math.atan2(ty - eye[1], Math.hypot(dx, dz));
      if (this.rand() < 0.05) this.wobble = [(this.rand() - 0.5) * 2 * this.skill.aimError, (this.rand() - 0.5) * this.skill.aimError];
      aimYaw += this.wobble[0];
      aimPitch += this.wobble[1];
    } else if (l > 0.01) {
      aimYaw = Math.atan2(-moveX, -moveZ);
    }
    const errYaw = wrap(aimYaw - this.yaw);
    this.yaw = wrap(this.yaw + errYaw * (target ? this.skill.aimRate : 0.12));
    this.pitch += (aimPitch - this.pitch) * (target ? this.skill.aimRate : 0.1);
    inp.yaw = Math.round(this.yaw * 10000) / 10000;
    inp.pitch = Math.round(this.pitch * 10000) / 10000;

    if (target && this.seenFor > this.skill.reaction && Math.abs(errYaw) < this.skill.fireCone + 0.4 / Math.max(bestD, 1)) {
      // semi-auto weapons need a fresh press each shot
      if (WEAPONS[me.weapon].auto || (me.prevButtons & BTN.FIRE) === 0) inp.buttons |= BTN.FIRE;
    }
    if (!target && me.ammo[me.weapon] < WEAPONS[me.weapon].mag * 0.5 && (me.prevButtons & BTN.RELOAD) === 0) inp.buttons |= BTN.RELOAD;

    // --- abilities ---
    if (target && tookDamage && me.dashCd === 0 && this.rand() < 0.35) inp.buttons |= BTN.DASH;
    if (target && lowHp && me.shieldCd === 0 && bestD > 5) inp.buttons |= BTN.SHIELD;
    return inp;
  }

  private coverAway(match: Match, me: PlayerState, enemy: PlayerState): Vec3 | null {
    let best: Vec3 | null = null, bestScore = -Infinity;
    for (const a of match.map.data.anchors) {
      if (a.kind !== 'cover') continue;
      const p: Vec3 = [a.position[0], a.position[1], a.position[2]];
      const dMe = Math.hypot(p[0] - me.x, p[2] - me.z);
      if (dMe > 25) continue;
      const hidden = !lineOfSight(match.map, [enemy.x, enemy.y + match.map.eye, enemy.z], [p[0], p[1] + 1.1, p[2]]);
      const score = (hidden ? 30 : 0) - dMe + Math.hypot(p[0] - enemy.x, p[2] - enemy.z) * 0.3;
      if (score > bestScore) { bestScore = score; best = p; }
    }
    return best;
  }

  private roamGoal(match: Match, me: PlayerState): Vec3 {
    if (this.goal && Math.hypot(this.goal[0] - me.x, this.goal[2] - me.z) > 1.5 && this.path.length) return this.goal;
    const picks = match.map.data.anchors.filter((a) => a.kind === 'cover' || a.kind === 'objective');
    // head toward the enemy half most of the time
    const enemySide = me.team === 'A' ? 1 : -1;
    for (let i = 0; i < 6; i++) {
      const a = picks[Math.floor(this.rand() * picks.length)];
      if (a.position[0] * enemySide > -6 || i === 5) return [a.position[0], a.position[1], a.position[2]];
    }
    return [0, 0, 7];
  }
}

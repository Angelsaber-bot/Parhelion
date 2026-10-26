// Rule-based baseline bot. Produces the same Input a human client sends, so it goes through the
// identical server rules. This is the scripted baseline the trained cover-choice AI will be
// evaluated against; a learned policy can replace it by implementing Controller.
//
// It is deliberately human-shaped rather than optimal:
// - perception: a target must stay visible for a reaction time that grows with distance and with
//   how far off-centre it is; nothing behind it is noticed unless it is hit or the enemy is close.
// - aim: it aims at where the target was a few ticks ago (so strafing works against it), starts
//   each engagement with a settling error that shrinks as it tracks, and is worse while moving.
// - trigger: automatic weapons fire in bursts with pauses; semi-autos have uneven follow-up.
// - personality (from the seed): rusher, holder or flanker, which changes where it roams, how
//   long it holds an angle, how close it wants to fight and when it backs off.

import { CHARACTERS, HITBOX, WEAPONS } from './content.ts';
import { lineOfSight, type Vec3 } from './map.ts';
import type { Controller, Match } from './match.ts';
import { NavGrid, type NavNode } from './nav.ts';
import { BTN, forward, type Input, type PlayerState } from './sim.ts';

export interface BotSkill {
  reaction: number; // base ticks from first sight to first shot (grows with distance)
  aimRate: number; // fraction of the angle error closed per tick
  aimError: number; // radians of residual wobble
  fireCone: number; // only fire when aim error below this
  settle: number; // radians of extra error when a target is first acquired, decays while tracking
  lag: number; // ticks of delay in the target position it aims at
  burst: [number, number]; // auto-fire burst length range, ticks
  pause: [number, number]; // pause between bursts, ticks
  head: number; // chance to go for the head at range
  moveErr: number; // extra radians of wobble while it is moving
}

export const BOT_SKILL: Record<'easy' | 'normal' | 'hard', BotSkill> = {
  easy: { reaction: 40, aimRate: 0.065, aimError: 0.045, fireCone: 0.07, settle: 0.18, lag: 6, burst: [8, 18], pause: [28, 55], head: 0, moveErr: 0.03 },
  normal: { reaction: 24, aimRate: 0.12, aimError: 0.025, fireCone: 0.05, settle: 0.1, lag: 2, burst: [14, 30], pause: [16, 34], head: 0.1, moveErr: 0.018 },
  hard: { reaction: 15, aimRate: 0.18, aimError: 0.014, fireCone: 0.04, settle: 0.06, lag: 1, burst: [22, 44], pause: [8, 20], head: 0.35, moveErr: 0.01 },
};

type Style = 'rusher' | 'holder' | 'flanker';

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
const HISTORY = 24;

export class Bot implements Controller {
  readonly style: Style;
  private seq = 0;
  private yaw = 0;
  private pitch = 0;
  private rand: () => number;
  private targetId: string | null = null;
  private seenFor = 0;
  private trackT = 0;
  private settleDir = [0, 0];
  private lastSeen: Vec3 | null = null;
  private trail: Vec3[] = []; // recent positions of the current target, newest last
  private path: NavNode[] = [];
  private goal: Vec3 | null = null;
  private repath = 0;
  private strafe = 1;
  private strafeT = 0;
  private stand = false;
  private stuckT = 0;
  private lastPos: [number, number] = [0, 0];
  private lastHp = 0;
  private wobble = [0, 0];
  private wasAlive = false;
  private burstT = 0;
  private pauseT = 0;
  private shotGap = 0;
  private holdT = 0;
  private scan = 0;
  private aimHead = false;
  private chase: boolean | null = null; // decided once per lost contact: go look, or move on
  private readonly aggression: number;
  private readonly preferMul: number;

  constructor(seed: number, readonly skill: BotSkill = BOT_SKILL.normal) {
    this.rand = rng(seed);
    const r = this.rand();
    this.style = r < 0.36 ? 'rusher' : r < 0.7 ? 'holder' : 'flanker';
    this.aggression = this.style === 'rusher' ? 0.75 + this.rand() * 0.25 : this.style === 'holder' ? 0.2 + this.rand() * 0.3 : 0.45 + this.rand() * 0.3;
    this.preferMul = this.style === 'rusher' ? 0.6 : this.style === 'holder' ? 1.25 : 0.9;
    this.scan = this.rand() * 6;
  }

  private range(r: [number, number]) {
    return r[0] + Math.floor(this.rand() * (r[1] - r[0] + 1));
  }

  think(match: Match, id: string): Input {
    const me = match.player(id)!;
    const inp: Input = { seq: ++this.seq, mx: 0, mz: 0, yaw: this.yaw, pitch: this.pitch, buttons: 0, weapon: me.weapon, view: match.tick };
    if (!me.alive) {
      this.targetId = null; this.path = []; this.goal = null; this.lastSeen = null; this.trail = []; this.chase = null;
      this.lastHp = CHARACTERS[me.char].hp;
      this.wasAlive = false;
      return inp;
    }
    if (!this.wasAlive) { this.yaw = me.yaw; this.pitch = 0; this.wasAlive = true; this.holdT = 0; }

    const eye: Vec3 = [me.x, me.y + match.map.eye, me.z];
    const tookDamage = me.hp < this.lastHp;
    this.lastHp = me.hp;
    const maxHp = CHARACTERS[me.char].hp;

    // --- perception: nearest enemy it can see inside its view cone (or that just hit it / is very close) ---
    let target: PlayerState | null = null;
    let bestD = Infinity;
    for (const [oid, slot] of match.slots) {
      const o = slot.state;
      if (oid === id || o.team === me.team || !o.alive) continue;
      const d = Math.hypot(o.x - me.x, o.y - me.y, o.z - me.z);
      const off = Math.abs(wrap(Math.atan2(-(o.x - me.x), -(o.z - me.z)) - this.yaw));
      if (off > 1.3 && !tookDamage && d > 3 && oid !== this.targetId) continue;
      const chest: Vec3 = [o.x, o.y + 1.1, o.z], head: Vec3 = [o.x, o.y + HITBOX.headY, o.z];
      if ((lineOfSight(match.map, eye, chest) || lineOfSight(match.map, eye, head)) && d < bestD) {
        bestD = d; target = o;
      }
    }
    if (target) {
      if (target.id !== this.targetId) {
        this.targetId = target.id; this.seenFor = 0; this.trackT = 0; this.trail = [];
        const a = this.rand() * Math.PI * 2;
        this.settleDir = [Math.cos(a), Math.sin(a) * 0.5];
        this.aimHead = bestD > 12 && this.rand() < this.skill.head;
      }
      this.seenFor++;
      this.trackT++;
      this.trail.push([target.x, target.y, target.z]);
      if (this.trail.length > HISTORY) this.trail.shift();
      this.lastSeen = [target.x, target.y, target.z];
      this.holdT = 0;
      this.chase = null;
    } else {
      this.targetId = null;
      this.seenFor = 0;
      this.trackT = Math.max(0, this.trackT - 3);
    }
    // the reaction time grows with distance; being shot makes it react a bit faster
    const reaction = this.skill.reaction * (1 + Math.min(bestD, 40) / 35) * (tookDamage ? 0.75 : 1);
    const engaged = !!target && this.seenFor > reaction * 0.5;

    // --- weapon choice by range and personality ---
    const range = target ? bestD : 18;
    let want = range < 8 * (this.style === 'rusher' ? 1.3 : 1) ? 1 : range > 26 ? 2 : 0;
    if (me.ammo[want] === 0 && me.reload === 0) want = (want + 1) % WEAPONS.length;
    inp.weapon = want;

    // --- movement goal ---
    const nav = navFor(match);
    let goal: Vec3 | null;
    const hurt = me.hp < maxHp * (this.style === 'holder' ? 0.55 : this.style === 'flanker' ? 0.4 : 0.25);
    const reloading = me.reload > 0;
    if (target && (hurt || (reloading && this.aggression < 0.6))) goal = this.coverAway(match, me, target);
    else if (target && this.style === 'rusher' && bestD > 7 && engaged) goal = [target.x, target.y, target.z];
    else if (target) goal = null; // fight where it stands
    else {
      if (this.lastSeen && this.chase === null) this.chase = this.rand() < 0.35 + this.aggression * 0.6;
      goal = this.lastSeen && this.chase ? this.lastSeen : this.roamGoal(match, me);
      if (this.chase === false) { this.lastSeen = null; this.chase = null; }
    }

    if (goal && (!this.goal || Math.hypot(goal[0] - this.goal[0], goal[2] - this.goal[2]) > 2 || --this.repath <= 0)) {
      const a = nav.nearest(me.x, me.y, me.z), b = nav.nearest(goal[0], goal[1], goal[2]);
      this.path = a && b ? nav.path(a, b) ?? [] : [];
      this.goal = goal;
      this.repath = 90 + Math.floor(this.rand() * 60);
    }
    if (!goal) { this.path = []; this.goal = null; }

    let moveX = 0, moveZ = 0;
    while (this.path.length && Math.hypot(this.path[0].x - me.x, this.path[0].z - me.z) < 0.45) this.path.shift();
    if (this.holdT > 0) {
      this.holdT--; // holding an angle at a cover point
    } else if (this.path.length) {
      const look = this.path[Math.min(2, this.path.length - 1)];
      moveX = look.x - me.x; moveZ = look.z - me.z;
    } else if (this.goal && this.lastSeen === this.goal) {
      this.lastSeen = null; // reached the last known position: nothing here, look around a moment
      this.goal = null;
      this.chase = null;
      this.holdT = 30 + this.rand() * 60;
    } else if (!target && this.goal) {
      // arrived at a roam point: holders wait longest, rushers barely stop
      this.holdT = this.style === 'holder' ? 150 + this.rand() * 270 : this.style === 'flanker' ? 40 + this.rand() * 120 : this.rand() * 40;
      this.goal = null;
    }

    if (target) {
      if (--this.strafeT <= 0) {
        this.strafe = this.rand() < 0.5 ? -1 : 1;
        this.stand = this.rand() < 0.3 - this.aggression * 0.15;
        this.strafeT = 20 + Math.floor(this.rand() * 70);
        if (this.rand() < 0.08) inp.buttons |= BTN.JUMP;
      }
      const [fx, fz] = forward(this.yaw);
      const prefer = WEAPONS[want].falloffStart * 0.8 * this.preferMul;
      const toward = bestD > prefer + 6 ? 0.6 + this.aggression * 0.4 : bestD < Math.min(prefer, 5) ? -0.6 : 0;
      const side = this.stand ? 0 : this.strafe;
      moveX += (-fz * side + fx * toward) * 2;
      moveZ += (fx * side + fz * toward) * 2;
    }

    // stuck detection: try jumping and re-pathing
    if (Math.hypot(me.x - this.lastPos[0], me.z - this.lastPos[1]) < 0.02 && (moveX || moveZ)) {
      if (++this.stuckT > 20) { inp.buttons |= BTN.JUMP; this.strafe = -this.strafe; this.repath = 0; this.stuckT = 0; }
    } else this.stuckT = 0;
    const moving = Math.hypot(me.x - this.lastPos[0], me.z - this.lastPos[1]) > 0.02;
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
    const err = this.skill.aimError + (moving ? this.skill.moveErr : 0);
    if (target) {
      // aim where the target was `lag` ticks ago
      const p = this.trail[Math.max(0, this.trail.length - 1 - this.skill.lag)];
      const dx = p[0] - me.x, dz = p[2] - me.z;
      const ty = p[1] + (this.aimHead ? HITBOX.headY - 0.05 : 1.1);
      aimYaw = Math.atan2(-dx, -dz);
      aimPitch = Math.atan2(ty - eye[1], Math.hypot(dx, dz));
      if (this.rand() < 0.06) this.wobble = [(this.rand() - 0.5) * 2 * err, (this.rand() - 0.5) * err];
      const settle = this.skill.settle * Math.exp(-this.trackT / 28);
      aimYaw += this.wobble[0] + this.settleDir[0] * settle;
      aimPitch += this.wobble[1] + this.settleDir[1] * settle;
    } else if (this.holdT > 0 || (l < 0.01 && this.lastSeen)) {
      // holding: sweep across the enemy side of the map
      this.scan += 0.012;
      const enemyDir = me.team === 'A' ? -Math.PI / 2 : Math.PI / 2;
      const watch = this.lastSeen ? Math.atan2(-(this.lastSeen[0] - me.x), -(this.lastSeen[2] - me.z)) : enemyDir;
      aimYaw = watch + Math.sin(this.scan) * 0.7;
    } else if (l > 0.01) {
      // walking: mostly look where it goes, glancing around
      this.scan += 0.02;
      aimYaw = Math.atan2(-moveX, -moveZ) + Math.sin(this.scan) * 0.45;
    }
    const errYaw = wrap(aimYaw - this.yaw);
    const rate = target ? this.skill.aimRate : 0.07;
    // turning speed is limited, as with a mouse: big flicks take several ticks
    const step = Math.max(-0.16, Math.min(0.16, errYaw * rate));
    this.yaw = wrap(this.yaw + step);
    this.pitch += (aimPitch - this.pitch) * rate;
    inp.yaw = Math.round(this.yaw * 10000) / 10000;
    inp.pitch = Math.round(this.pitch * 10000) / 10000;

    // --- trigger: bursts for automatics, uneven follow-ups for semi-autos ---
    const w = WEAPONS[me.weapon];
    const onTarget = Math.abs(errYaw) < this.skill.fireCone + 0.4 / Math.max(bestD, 1);
    if (target && this.seenFor > reaction && onTarget) {
      if (w.auto) {
        if (this.pauseT > 0) this.pauseT--;
        else {
          if (this.burstT <= 0) this.burstT = this.range(this.skill.burst);
          inp.buttons |= BTN.FIRE;
          if (--this.burstT <= 0) this.pauseT = this.range(this.skill.pause);
        }
      } else if (this.shotGap > 0) this.shotGap--;
      else if ((me.prevButtons & BTN.FIRE) === 0) {
        inp.buttons |= BTN.FIRE;
        this.shotGap = w.interval + this.range([4, 22]);
      }
    } else if (!target) { this.burstT = 0; this.pauseT = Math.max(this.pauseT, 6); }
    if (!target && me.ammo[me.weapon] < w.mag * 0.5 && (me.prevButtons & BTN.RELOAD) === 0) inp.buttons |= BTN.RELOAD;

    // --- abilities, used sparingly ---
    if (target && tookDamage && me.dashCd === 0 && this.rand() < 0.12 + this.aggression * 0.1) inp.buttons |= BTN.DASH;
    if (target && hurt && me.shieldCd === 0 && bestD > 6 && this.rand() < 0.05) inp.buttons |= BTN.SHIELD;
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
      const score = (hidden ? 30 : 0) - dMe + Math.hypot(p[0] - enemy.x, p[2] - enemy.z) * 0.3 + this.rand() * 4;
      if (score > bestScore) { bestScore = score; best = p; }
    }
    return best;
  }

  private roamGoal(match: Match, me: PlayerState): Vec3 {
    if (this.goal && Math.hypot(this.goal[0] - me.x, this.goal[2] - me.z) > 1.5 && this.path.length) return this.goal;
    const picks = match.map.data.anchors.filter((a) => a.kind === 'cover' || a.kind === 'objective');
    const mates = [...match.slots.values()].filter((s) => s.state.team === me.team && s.state.id !== me.id && s.state.alive).map((s) => s.state);
    const enemySide = me.team === 'A' ? 1 : -1;
    const { min, max } = match.map.data.bounds;
    const halfDepth = (max[2] - min[2]) / 2;
    let best = picks[0], bestScore = -Infinity;
    for (const a of picks) {
      const [x, y, z] = a.position;
      let score = this.rand() * 10; // variety
      score += Math.max(-8, Math.min(8, x * enemySide)) * (0.25 + this.aggression * 0.6); // pressure toward the enemy
      if (this.style === 'holder') score += y * 2.5 - Math.abs(x) * 0.15; // likes height, near the middle
      if (this.style === 'flanker') score += (Math.abs(z) / halfDepth) * 8; // likes the edges of the map
      for (const m of mates) if (Math.hypot(m.x - x, m.z - z) < 6) score -= 8; // spread out from teammates
      if (Math.hypot(me.x - x, me.z - z) < 3) score -= 20; // not where it already is
      if (score > bestScore) { bestScore = score; best = a; }
    }
    return [best.position[0], best.position[1], best.position[2]];
  }
}

// Rule-based baseline bot. Produces the same Input a human client sends, so it goes through the
// identical server rules. A tactical policy can choose positioning while this controller
// executes movement, perception and gunplay.
//
// It is deliberately human-shaped rather than optimal:
// - perception: a target must stay visible for a reaction time that grows with distance and with
//   how far off-centre it is; nothing behind it is noticed unless it is hit or the enemy is close.
// - aim: it aims at where the target was a few ticks ago (so strafing works against it), starts
//   each engagement with a settling error that shrinks as it tracks, and is worse while moving.
// - trigger: automatic weapons fire in bursts with pauses; semi-autos have uneven follow-up.
// - personality (from the seed): rusher, holder or flanker, which changes where it roams, how
//   long it holds an angle, how close it wants to fight and when it backs off.

import { CHARACTERS, FRAG, GRENADE, HERO_COMBAT, INTERP_TICKS, TICK_HZ, WEAPONS, falloff, loadoutWeapon, type WeaponDef } from './content.ts';
import { tacticalCandidates, TACTIC_INTERVAL, TACTIC_MEMORY_TICKS, TACTIC_TICKS, type TacticalPolicy } from './botTactics.ts';
import { smokeBlocks } from './grenade.ts';
import { humanCombatPolicy, humanObservation, type CombatContact, type HumanCombatModel } from './humanCombat.ts';
/** Melee reach including most of the windup lunge. */
const meleeReach = (w: WeaponDef) => w.range + (w.lunge ?? 0) * (w.windup ?? 0) / TICK_HZ * .7;
import { playerHitbox } from './hit.ts';
import { insideMovementBounds, lineOfSight, type Vec3 } from './map.ts';
import type { Controller, Match } from './match.ts';
import { NavGrid, type NavNode } from './nav.ts';
import { BTN, canSlideTo, forward, playerEye, type Input, type PlayerState } from './sim.ts';

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

/** Launch pitch whose (unbounced) arc lands `distance` metres away from `drop` metres above the target. */
export function throwPitch(distance: number, drop: number): number {
  let best = 0, err = Infinity;
  for (let a = -.45; a <= 1.05; a += .01) {
    const vx = GRENADE.speed * Math.cos(a), vy = GRENADE.speed * Math.sin(a) + GRENADE.lift, g = GRENADE.gravity;
    const disc = vy * vy + 2 * g * drop;
    if (disc < 0) continue;
    const range = vx * (vy + Math.sqrt(disc)) / g, e = Math.abs(range - distance);
    if (e < err) { err = e; best = a; }
  }
  return Math.round(best * 1000) / 1000;
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
const CONTACT_MEMORY = 2 * TICK_HZ;

/** Predict briefly from observed positions only. A wall truncates the extrapolation. */
export function predictContact(match: Match, trail: readonly Vec3[], age: number): Vec3 | null {
  const last = trail.at(-1);
  if (!last || age > CONTACT_MEMORY) return null;
  const span = Math.min(6, trail.length - 1);
  if (span <= 0) return last;
  const from = trail[trail.length - 1 - span];
  const dx = last[0] - from[0], dz = last[2] - from[2];
  // A decoy, respawn or other discontinuity is not a track along the ground.
  if (Math.hypot(dx, dz) > span * .27) return last;
  const lead = Math.min(15, age) / span;
  const guess: Vec3 = [last[0] + dx * lead, last[1], last[2] + dz * lead];
  return lineOfSight(match.map, [last[0], last[1] + .9, last[2]], [guess[0], guess[1] + .9, guess[2]]) ? guess : last;
}

function safeDirection(match: Match, me: PlayerState, x: number, z: number, side: number): [number, number] {
  const length = Math.hypot(x, z);
  if (length < .01) return [0, 0];
  x /= length; z /= length;
  const reach = Math.min(.32, Math.max(.14, length));
  const usable = (dx: number, dz: number) => [reach / 2, reach].every(k => {
    const px = me.x + dx * k, pz = me.z + dz * k;
    return insideMovementBounds(match.map, px, pz) && canSlideTo(match.map, me, px, pz);
  });
  if (usable(x, z)) return [x, z];
  for (const angle of [Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2, Math.PI]) {
    const c = Math.cos(angle * side), s = Math.sin(angle * side);
    const dx = x * c - z * s, dz = x * s + z * c;
    if (usable(dx, dz)) return [dx, dz];
  }
  return [0, 0];
}

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
  /** A grenade it intends to throw: turn to this heading, then release. */
  private throwPlan: { yaw: number; pitch: number; t: number } | null = null;
  private readonly aggression: number;
  private readonly preferMul: number;
  private nextTactic = 0;
  private tacticLife = -1;
  private tacticPath: NavNode[] | null = null;
  private tacticExpires = 0;
  private lastObserved = -Infinity;
  private readonly humanCombat?: ReturnType<typeof humanCombatPolicy>;
  private humanLife = -1;
  private humanLastVisible = -Infinity;
  private humanPrior: [number, number] = [0, 0];
  private humanContacts: CombatContact[][] = [];

  constructor(seed: number, readonly skill: BotSkill = BOT_SKILL.normal, private readonly tactics?: TacticalPolicy, humanModel?: HumanCombatModel) {
    this.rand = rng(seed);
    if (humanModel) this.humanCombat = humanCombatPolicy(humanModel, rng(seed ^ 0x52e27a3d));
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
    const inp: Input = { seq: ++this.seq, mx: 0, mz: 0, yaw: this.yaw, pitch: this.pitch, buttons: 0, weapon: me.weaponSlot, view: match.tick };
    if (this.humanCombat && (this.humanLife !== me.lifeId || match.phase !== 'live' || !me.alive)) {
      this.humanLife = me.lifeId;
      this.humanContacts.length = 0;
      this.humanPrior = [0, 0];
      this.humanLastVisible = -Infinity;
      this.humanCombat.reset();
    }
    if (this.tactics && (this.tacticLife !== me.lifeId || match.phase !== 'live' || !me.alive)) {
      this.tacticLife = me.lifeId;
      this.tacticPath = null;
      this.nextTactic = 0;
      this.lastObserved = -Infinity;
    }
    if (!me.alive) {
      this.targetId = null; this.path = []; this.goal = null; this.lastSeen = null; this.trail = [];
      this.lastObserved = -Infinity;
      this.throwPlan = null;
      this.lastHp = CHARACTERS[me.char].hp;
      this.wasAlive = false;
      return inp;
    }
    if (!this.wasAlive) { this.yaw = me.yaw; this.pitch = 0; this.wasAlive = true; this.holdT = 0; }

    const eye: Vec3 = [me.x, me.y + playerEye(match.map, me), me.z];
    const tookDamage = me.hp < this.lastHp;
    this.lastHp = me.hp;
    const maxHp = CHARACTERS[me.char].hp;

    // --- perception: nearest enemy it can see inside its view cone (or that just hit it / is very close) ---
    let target: PlayerState | null = null;
    let bestD = Infinity;
    let bestThreat = Infinity;
    let glimpse = false;
    for (const o of [...match.slots.values()].map(s=>s.state).concat(match.heroes.decoys())) {
      const oid=o.id;
      if (oid === id || o.team === me.team || !o.alive) continue;
      const d = Math.hypot(o.x - me.x, o.y - me.y, o.z - me.z);
      const off = Math.abs(wrap(Math.atan2(-(o.x - me.x), -(o.z - me.z)) - this.yaw));
      if (off > 1.3 && !tookDamage && d > 3 && oid !== this.targetId) continue;
      const h = playerHitbox(o.crouched);
      const chest: Vec3 = [o.x, o.y + (o.crouched ? 0.65 : 1.1), o.z], head: Vec3 = [o.x, o.y + h.headY, o.z];
      const clear = match.heroes.visible(eye, chest) || match.heroes.visible(eye, head);
      if (!clear && (d > 8 || !match.heroes.visible(eye, chest, true))) continue;
      const score = d * (oid === this.targetId ? .76 : 1) + (clear ? 0 : 5);
      if (score >= bestThreat) continue;
      bestThreat = score; bestD = d; target = o; glimpse = !clear;
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
      if (match.tick - this.lastObserved > 1) this.trail = [];
      this.trail.push([target.x, target.y, target.z]);
      if (this.trail.length > HISTORY) this.trail.shift();
      this.lastSeen = [target.x, target.y, target.z];
      this.lastObserved = match.tick;
      if (this.throwPlan && me.utility === 'frag') this.throwPlan = null;
      this.holdT = 0;
    } else {
      if (match.tick - this.lastObserved > 15) this.seenFor = 0;
      if (match.tick - this.lastObserved > CONTACT_MEMORY) { this.targetId = null; this.lastSeen = null; this.trail = []; }
      this.trackT = Math.max(0, this.trackT - 3);
    }
    const contactAge = match.tick - this.lastObserved;
    const predicted = !target ? predictContact(match, this.trail, contactAge) : null;
    // Team scan marks are sampled positions, never a live target behind cover.
    const mark = !target && match.heroes.marks.find(m => m.team === me.team && m.expires > match.tick);
    const search: Vec3 | null = predicted ?? (mark ? [mark.x, mark.y, mark.z] : null);
    // the reaction time grows with distance; being shot makes it react a bit faster
    const reaction = this.skill.reaction * (1 + Math.min(bestD, 40) / 35) * (tookDamage ? 0.75 : 1) * (glimpse ? 1.6 : 1);
    const engaged = !!target && this.seenFor > reaction * 0.5;

    // --- choose only among the validated equipped slots; bots use all eight real rules ---
    const range = target ? bestD : 18;
    let wantSlot = me.weaponSlot, bestWeaponScore = -Infinity;
    if (me.meleeWindup <= 0) {
      for (let slot = 0; slot < 2; slot++) {
        const wi = loadoutWeapon(me.loadout, slot), weapon = WEAPONS[wi];
        const spreadPenalty = 1 / (1 + weapon.spread * range * 1.8);
        const score = weapon.damage * weapon.pellets / weapon.interval * falloff(weapon, range) * spreadPenalty *
          (me.ammo[wi] > 0 ? 1 : .15) * (slot === me.weaponSlot ? 1.12 : 1);
        if (score > bestWeaponScore) { bestWeaponScore = score; wantSlot = slot; }
      }
      const melee = WEAPONS[loadoutWeapon(me.loadout, 2)];
      if (target && range < meleeReach(melee) * .88 && (me.fireCd === 0 || me.weaponSlot === 2)) wantSlot = 2;
    }
    const want = loadoutWeapon(me.loadout, wantSlot);
    inp.weapon = wantSlot;

    // --- movement goal ---
    const nav = navFor(match);
    if (match.tick >= this.tacticExpires) this.tacticPath = null;
    if (this.tactics && match.phase === 'live' && match.tick >= this.nextTactic) {
      this.tacticPath = null;
      const age = match.tick - this.lastObserved;
      if ((engaged || (!target && age <= TACTIC_MEMORY_TICKS)) && this.lastSeen && me.grounded) {
        const [x, y, z] = this.lastSeen;
        const threat: Vec3 = [x, y + (target ? playerEye(match.map, target) : match.map.eye), z];
        const spare = loadoutWeapon(me.loadout, me.weaponSlot === 0 ? 1 : 0);
        const choices = tacticalCandidates(match.map, nav, me, spare, this.aggression, threat, !!target, age, match.tick - me.lastDamageTick);
        const choice = choices[this.tactics(choices)];
        if (choice?.path.length) {
          this.tacticPath = [...choice.path];
          this.tacticExpires = match.tick + TACTIC_TICKS;
          this.nextTactic = match.tick + TACTIC_INTERVAL;
          this.path = [];
          this.goal = null;
        } else {
          this.nextTactic = match.tick + 24;
        }
      }
    }
    let goal: Vec3 | null;
    const hurt = me.hp < maxHp * (this.style === 'holder' ? 0.55 : this.style === 'flanker' ? 0.4 : 0.25);
    const reloading = me.reload > 0;
    if (target && !hurt && !reloading) this.tacticPath = null;
    if (this.tacticPath) goal = null;
    else if (target && (hurt || (reloading && this.aggression < 0.6))) goal = this.coverAway(match, me, target);
    else if (target && (WEAPONS[want].kind === 'melee' || this.style === 'rusher') && bestD > (WEAPONS[want].kind === 'melee' ? WEAPONS[want].range * .7 : 7) && engaged) goal = [target.x, target.y, target.z];
    else if (target) goal = null; // fight where it stands
    else if (search) goal = contactAge < 14 || Math.hypot(search[0] - me.x, search[2] - me.z) < 1.1 ? null : search;
    else goal = this.roamGoal(match, me);

    if (goal && (!this.goal || Math.hypot(goal[0] - this.goal[0], goal[2] - this.goal[2]) > 2 || --this.repath <= 0)) {
      const a = nav.nearest(me.x, me.y, me.z), b = nav.nearest(goal[0], goal[1], goal[2]);
      this.path = a && b ? nav.path(a, b) ?? [] : [];
      this.goal = goal;
      this.repath = 90 + Math.floor(this.rand() * 60);
    }
    if (!goal) { this.path = []; this.goal = null; }

    let moveX = 0, moveZ = 0;
    const travel = this.tacticPath ?? this.path;
    while (travel.length && Math.hypot(travel[0].x - me.x, travel[0].z - me.z) < 0.24 && Math.abs(travel[0].y - me.y) < .6) travel.shift();
    if (this.tacticPath) {
      const next = travel[0];
      if (next) { moveX = next.x - me.x; moveZ = next.z - me.z; }
    } else if (this.holdT > 0) {
      this.holdT--; // holding an angle at a cover point
    } else if (this.path.length) {
      const look = this.path[0]; // Never cut a cabinet corner or skip a stair landing.
      moveX = look.x - me.x; moveZ = look.z - me.z;
    } else if (!target && !search && this.goal) {
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
      const prefer = WEAPONS[want].kind === 'melee' ? WEAPONS[want].range * .65 : WEAPONS[want].falloffStart * 0.8 * this.preferMul;
      const toward = bestD > prefer + 6 ? 0.6 + this.aggression * 0.4 : bestD < Math.min(prefer, 5) ? -0.6 : 0;
      const side = this.stand ? 0 : this.strafe;
      if (!this.tacticPath && !this.path.length) {
        moveX += (-fz * side + fx * toward) * 2;
        moveZ += (fx * side + fz * toward) * 2;
      }
    }

    // A frag about to go off nearby overrides the route: get out of its radius.
    for (const g of match.grenades) {
      if (g.kind !== 'frag' || g.fuse > 1.4 * TICK_HZ) continue;
      const gx = me.x - g.x, gz = me.z - g.z, gd = Math.hypot(gx, gz);
      if (gd < FRAG.radius + .8) { moveX = gd > .05 ? gx / gd : 1; moveZ = gd > .05 ? gz / gd : 0; break; }
    }

    // React only to a visible, public warning after the bot's normal reaction delay.
    for(const e of match.heroes.entities){
      if(e.kind!=='edict'||e.team===me.team||match.tick-e.created<Math.min(this.skill.reaction,HERO_COMBAT.edict.arm-4))continue;
      const dx=me.x-e.x,dz=me.z-e.z,d=Math.hypot(dx,dz);
      if(d<HERO_COMBAT.edict.radius+.6&&lineOfSight(match.map,eye,[e.x,e.y+.1,e.z])&&!smokeBlocks(match.smokes,eye,[e.x,e.y+.1,e.z])){moveX=d>.05?dx/d:1;moveZ=d>.05?dz/d:0;break;}
    }

    // Replan before giving an opponent a long window to shoot a stationary bot.
    if (Math.hypot(me.x - this.lastPos[0], me.z - this.lastPos[1]) < 0.02 && (moveX || moveZ)) {
      if (++this.stuckT > 8) {
        inp.buttons |= BTN.JUMP;
        this.strafe = -this.strafe;
        this.repath = 0;
        this.stuckT = 0;
        this.tacticPath = null;
      }
    } else this.stuckT = 0;
    const moving = Math.hypot(me.x - this.lastPos[0], me.z - this.lastPos[1]) > 0.02;
    this.lastPos = [me.x, me.z];

    [moveX, moveZ] = safeDirection(match, me, moveX, moveZ, this.strafe);
    const l = Math.hypot(moveX, moveZ);

    // --- aim ---
    let aimYaw = this.yaw, aimPitch = 0;
    const err = this.skill.aimError + (moving ? this.skill.moveErr : 0);
    if (target) {
      // aim where the target was `lag` ticks ago
      const p = this.trail[Math.max(0, this.trail.length - 1 - this.skill.lag)];
      const dx = p[0] - me.x, dz = p[2] - me.z;
      const ty = p[1] + (this.aimHead ? playerHitbox(target.crouched).headY - 0.05 : target.crouched ? 0.65 : 1.1);
      aimYaw = Math.atan2(-dx, -dz);
      aimPitch = Math.atan2(ty - eye[1], Math.hypot(dx, dz));
      if (this.rand() < 0.06) this.wobble = [(this.rand() - 0.5) * 2 * err, (this.rand() - 0.5) * err];
      const settle = this.skill.settle * Math.exp(-this.trackT / 28);
      aimYaw += this.wobble[0] * (glimpse ? 2.5 : 1) + this.settleDir[0] * settle;
      aimPitch += this.wobble[1] * (glimpse ? 2.5 : 1) + this.settleDir[1] * settle;
    } else if (search) {
      aimYaw = Math.atan2(me.x - search[0], me.z - search[2]);
      aimPitch = Math.atan2(search[1] + 1.1 - eye[1], Math.hypot(me.x - search[0], me.z - search[2]));
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
    // Utility: frags go where an enemy is hiding (or was last seen); smoke screens a hurt retreat.
    if (this.throwPlan && --this.throwPlan.t <= 0) this.throwPlan = null;
    if (!this.throwPlan && me.utilityCharges > 0 && me.utilityLock === 0 && me.meleeWindup === 0) {
      let spot: Vec3 | null = null;
      if (me.utility === 'frag') {
        // Only at someone who just broke line of sight: never abandon a live fight to wind up a throw.
        if (!target && this.lastSeen && this.rand() < .02) {
          const d = Math.hypot(this.lastSeen[0] - me.x, this.lastSeen[2] - me.z);
          if (d > 6 && d < 18) spot = this.lastSeen;
        }
      } else if (target && hurt && bestD > 6 && this.rand() < .03) {
        const k = 3 / Math.max(bestD, 1e-3);
        spot = [me.x + (target.x - me.x) * k, me.y, me.z + (target.z - me.z) * k];
      }
      if (spot) {
        const dx = spot[0] - me.x, dz = spot[2] - me.z;
        this.throwPlan = { yaw: Math.atan2(-dx, -dz), pitch: throwPitch(Math.hypot(dx, dz) * (me.utility === 'frag' ? .82 : 1), eye[1] - .12 - spot[1]), t: 45 };
      }
    }
    if (this.throwPlan) { aimYaw = this.throwPlan.yaw; aimPitch = this.throwPlan.pitch; }
    const errYaw = wrap(aimYaw - this.yaw);
    const rate = target ? this.skill.aimRate : 0.07;
    // turning speed is limited, as with a mouse: big flicks take several ticks
    const step = Math.max(-0.16, Math.min(0.16, errYaw * rate));
    this.yaw = wrap(this.yaw + step);
    this.pitch += (aimPitch - this.pitch) * rate;
    inp.yaw = Math.round(this.yaw * 10000) / 10000;
    inp.pitch = Math.round(this.pitch * 10000) / 10000;
    if (this.throwPlan) {
      this.pitch += (this.throwPlan.pitch - this.pitch) * .25; inp.pitch = Math.round(this.pitch * 10000) / 10000;
      if (Math.abs(wrap(this.throwPlan.yaw - this.yaw)) < .08 && Math.abs(this.throwPlan.pitch - this.pitch) < .08) { inp.buttons |= BTN.THROW; this.throwPlan = null; }
    }

    // --- trigger: bursts for automatics, uneven follow-ups for semi-autos ---
    const w = WEAPONS[me.weapon];
    const fireCone = this.skill.fireCone + 0.4 / Math.max(bestD, 1);
    const onTarget = Math.abs(errYaw) < fireCone && Math.abs(aimPitch - this.pitch) < fireCone;
    if (target && this.seenFor > reaction && onTarget && (w.kind === 'gun' || bestD <= meleeReach(w))) {
      // Slow full-autos (the Halo DMR) keep the deliberate semi-auto rhythm below.
      if (w.auto && w.interval < 15) {
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
    if (w.kind === 'gun' && !target && me.ammo[me.weapon] < w.mag * 0.5 && (me.prevButtons & BTN.RELOAD) === 0) inp.buttons |= BTN.RELOAD;
    if (this.humanCombat && match.phase === 'live') this.applyHumanCombat(match, me, inp);

    // Input physics rotates movement by the new aim yaw, including a learned turn.
    const [fx, fz] = forward(inp.yaw);
    inp.mz = moveX * fx + moveZ * fz;
    inp.mx = moveX * -fz + moveZ * fx;

    // --- abilities, used sparingly ---
    if (target && tookDamage && me.dashCharges > 0 && me.dashT === 0 && this.rand() < 0.12 + this.aggression * 0.1) inp.buttons |= BTN.DASH;
    const kind=CHARACTERS[me.char].ability;
    if(me.ability.phase==='guard') inp.buttons|=BTN.SHIELD;
    if(me.ability.phase==='channel') {inp.buttons&=~(BTN.FIRE|BTN.RELOAD|BTN.DASH|BTN.JUMP);inp.mx=inp.mz=0;}
    const anchor=match.heroes.entities.find(e=>e.owner===id&&e.kind==='anchor');
    if(anchor&&hurt&&target&&me.ability.phase==='idle'&&!(me.prevButtons&BTN.SHIELD))inp.buttons|=BTN.SHIELD;
    if(me.shieldCd===0&&me.ability.phase==='idle'&&me.dashT===0&&!(me.prevButtons&BTN.SHIELD)&&this.rand()<.055) {
      const wants=kind==='prayer'?(hurt):kind==='guard'?(engaged&&bestD<16):kind==='barrier'?(engaged&&hurt&&bestD>5):kind==='anchor'?(engaged&&bestD>6):kind==='curtain'?(engaged&&bestD>4&&bestD<22):kind==='decoy'?(engaged&&bestD<5.5):kind==='barrage'?(engaged&&bestD<30):kind==='edict'?(engaged&&bestD<17):(engaged&&bestD<18||!target&&!!this.lastSeen);
      if(wants)inp.buttons|=BTN.SHIELD;
    }
    return inp;
  }

  private applyHumanCombat(match: Match, me: PlayerState, input: Input) {
    const combat = this.humanCombat!;
    const contacts: CombatContact[] = [];
    for (const { state } of match.slots.values()) {
      if (state.alive && state.team !== me.team) contacts.push({ team: state.team, crouched: state.crouched, feet: [state.x, state.y, state.z] });
    }
    this.humanContacts.push(contacts);
    if (this.humanContacts.length > INTERP_TICKS + 1) this.humanContacts.shift();
    if (WEAPONS[me.weapon].kind !== 'gun' || WEAPONS[loadoutWeapon(me.loadout, input.weapon)].kind !== 'gun') {
      combat.reset();
      this.humanLastVisible = -Infinity;
      this.humanPrior = [0, 0];
      return;
    }
    input.buttons &= ~BTN.FIRE;
    const decoys = match.heroes.decoys().map<CombatContact>(s => ({ team: s.team, crouched: s.crouched, feet: [s.x, s.y, s.z] }));
    const features = humanObservation(match.map, me, [...this.humanContacts[0], ...decoys], (a, b) => match.heroes.visible(a, b), this.humanPrior);
    // Sample invisible frames too so the history includes the transition at contact loss or acquisition.
    const turn = combat.think(features);
    if (features[0]) this.humanLastVisible = match.tick;
    if (match.tick - this.humanLastVisible <= 12 && !this.throwPlan && !(input.buttons & BTN.THROW)) {
      this.yaw = wrap(me.yaw + turn.yaw);
      this.pitch = Math.max(-1.45, Math.min(1.45, me.pitch + turn.pitch));
      input.yaw = Math.round(this.yaw * 10000) / 10000;
      input.pitch = Math.round(this.pitch * 10000) / 10000;
      if (turn.fire) input.buttons |= BTN.FIRE;
    }
    this.humanPrior = [wrap(input.yaw - me.yaw), input.pitch - me.pitch];
  }

  private coverAway(match: Match, me: PlayerState, enemy: PlayerState): Vec3 | null {
    let best: Vec3 | null = null, bestScore = -Infinity;
    for (const a of match.map.data.anchors) {
      if (a.kind !== 'cover') continue;
      const p: Vec3 = [a.position[0], a.position[1], a.position[2]];
      const dMe = Math.hypot(p[0] - me.x, p[2] - me.z);
      if (dMe > 25) continue;
      const hidden = !lineOfSight(match.map, [enemy.x, enemy.y + playerEye(match.map, enemy), enemy.z], [p[0], p[1] + 1.1, p[2]]);
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

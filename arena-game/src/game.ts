import { bilingual } from '../../shared-client/i18n.ts';
// Client game loop: fixed 60 Hz input ticks with local prediction of the own player, server
// reconciliation (replay unacknowledged inputs), and ~100 ms interpolation of everyone else.

import { DT, INTERP_TICKS, TICK_HZ, WEAPONS } from '../shared/content.ts';
import { rayPlayer } from '../shared/hit.ts';
import { raycastMap, type ArenaMap, type Vec3 } from '../shared/map.ts';
import type { NetEvent, PlayerSnap, Snapshot } from '../shared/match.ts';
import { applyInput, clonePlayer, playerEye, quantAngle, type Input, type PlayerState, type SimEvent } from '../shared/sim.ts';
import { sfx } from './audio.ts';
import type { Controls } from './controls.ts';
import type { Hud } from './hud.ts';
import { Feel } from './feel.ts';
import { AimState, aimSensitivity, canAimWeapon, isScopedWeapon } from './aim.ts';
import { TEAM_COLOR, type ArenaScene } from './scene.ts';
import type { Session } from './session.ts';

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export class Game {
  private me: PlayerState | null = null;
  private pending: Input[] = [];
  private outbox: Input[] = [];
  private seq = 0;
  private snaps: Snapshot[] = [];
  private latest: Snapshot | null = null;
  private meleeContact: Vec3 | null = null; // server contact point of my latest swing
  private latestAt = 0;
  private renderTick = 0;
  private acc = 0;
  private last = performance.now();
  private smooth: Vec3 = [0, 0, 0];
  private raf = 0;
  private running = true;
  private snapGap = 50; // ms between snapshots, smoothed (shown as a rough link-quality hint)
  private names = new Map<string, PlayerSnap>();
  private readonly map: ArenaMap;
  private feel = new Feel();
  private aim = new AimState();
  private aimWeapon = -1;
  /** Frozen: no input, no simulation (offline), no animation, effects or render clock. */
  paused = false;
  /** Results screen is up (match ended, waiting for 再来一局 / 返回大厅). */
  ended = false;
  onEnded: (title: string) => void = () => {};
  onRestart: () => void = () => {};
  private streak = 0;
  private lastLook = [0, 0];
  private rematchPending = false;

  constructor(
    private session: Session,
    private scene: ArenaScene,
    private controls: Controls,
    private hud: Hud,
    private onExit: (reason: string) => void,
  ) {
    this.map = session.map;
    // Hud and ArenaScene are reused after returning to the lobby: clear them before
    // the first snapshot of a new session, not three seconds later at live phase.
    this.controls.clearAll(); this.controls.resultsScoreboard = false; this.controls.weapon = 0;
    this.resetAim(); this.hud.resetRound(); this.scene.clearCombatEffects();
    session.onSnapshot = (s) => this.onSnapshot(s);
    session.onClose = (r) => this.stop(r);
    this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  stop(reason = '') {
    if (!this.running) return;
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.resetAim();
    this.scene.viewmodel.clear();
    this.scene.clearCombatEffects();
    this.scene.pruneAvatars(new Set());
    this.session.close();
    this.onExit(reason);
  }

  // ---------- network ----------

  private onSnapshot(s: Snapshot) {
    if (!this.running || (this.latest && s.tick <= this.latest.tick)) return;
    const previousPhase = this.latest?.phase;
    if ((previousPhase === 'ended' && s.phase !== 'ended') || (s.phase === 'live' && previousPhase !== 'live')) {
      const wasEnded = this.ended;
      this.pending = []; this.outbox = []; this.snaps = []; this.remotes = [];
      this.smooth = [0, 0, 0]; this.renderTick = 0; this.acc = 0; this.streak = 0;
      this.feel = new Feel(); this.controls.clearAll(); this.controls.resultsScoreboard = false;
      this.controls.weapon = 0; this.aimWeapon = -1; this.resetAim(); this.hud.resetRound(); this.scene.clearCombatEffects();
      this.rematchPending = false; this.ended = false; this.paused = false; this.session.setPaused(false);
      if (wasEnded) this.onRestart();
    }
    const now = performance.now();
    if (this.latest) this.snapGap += ((now - this.latestAt) - this.snapGap) * 0.1;
    this.latest = s;
    this.latestAt = now;
    this.snaps.push(s);
    while (this.snaps.length > 40) this.snaps.shift();
    for (const p of s.players) this.names.set(p.id, p);
    if (this.renderTick === 0) this.renderTick = s.tick - INTERP_TICKS;

    const mine = s.players.find((p) => p.id === this.session.id);
    if (mine) {
      const before = this.me;
      const next = clonePlayer(mine);
      this.pending = this.pending.filter((i) => i.seq > mine.lastSeq);
      const foes = this.foes(next);
      for (const i of this.pending) applyInput(this.map, next, i, foes);
      if (before && before.alive && next.alive) {
        const dx = before.x - next.x, dy = before.y - next.y, dz = before.z - next.z;
        if (Math.hypot(dx, dy, dz) < 2) {
          this.smooth[0] += dx; this.smooth[1] += dy; this.smooth[2] += dz;
        } else this.smooth = [0, 0, 0];
      }
      if (!this.me) { this.controls.yaw = mine.yaw; this.controls.pitch = 0; }
      this.me = next;
    }
    for (const e of s.events) this.onEvent(e);
    // A late join or missed event batch still shows the current authoritative result state.
    if (s.phase === 'ended' && !this.ended) this.onEvent({ t: 'phase', phase: 'ended',
      winner: s.score.A === s.score.B ? 'draw' : s.score.A > s.score.B ? 'A' : 'B' });
  }

  private onEvent(e: NetEvent) {
    const myId = this.session.id;
    const name = (id: string) => this.names.get(id)?.name ?? id;
    switch (e.t) {
      case 'shot': {
        if (e.id === myId) break; // already shown by prediction
        const from = this.scene.muzzleOf(e.id) ?? e.from;
        const col = TEAM_COLOR[this.names.get(e.id)?.team ?? 'A'];
        for (const to of e.to) this.scene.tracer(from, to, col, 0.7);
        const d = this.me ? Math.hypot(e.from[0] - this.me.x, e.from[2] - this.me.z) : 99;
        if (d < 30) this.scene.muzzleFlash(from, 0.6);
        sfx.shot(e.w, d < 25, d);
        break;
      }
      case 'meleeStart': {
        if (e.id !== myId) {
          const p = this.names.get(e.id), d = p && this.me ? Math.hypot(p.x - this.me.x, p.z - this.me.z) : 99;
          if (d < 28) sfx.melee(e.w, true, d);
        }
        break;
      }
      case 'meleeStrike': {
        if (e.id === myId) this.meleeContact = e.to;
        else {
          this.scene.meleeStrike(e.id);
          const d = this.me ? Math.hypot(e.from[0] - this.me.x, e.from[2] - this.me.z) : 99;
          if (d < 28) sfx.melee(e.w, false, d);
        }
        break;
      }
      case 'hit': {
        if (e.shooter === myId) {
          this.hud.hit(e.head, false);
          const v = this.remotes.find((r) => r.snap.id === e.victim);
          const weapon = this.names.get(myId)?.weapon ?? 0;
          if (WEAPONS[weapon]?.kind === 'melee') {
            // Contact weight: hit-stop on the blade, camera jolt, impact sparks and a body-blow sound.
            sfx.meleeHit(weapon); this.feel.melee(weapon, true);
            this.scene.viewmodel.contact(weapon === 7 ? .13 : weapon === 6 ? .09 : .075);
            const at = this.meleeContact ?? (v ? [v.pos[0], v.pos[1] + 1.1, v.pos[2]] as Vec3 : null);
            if (at) this.scene.meleeImpact(at, weapon);
          } else sfx.hit(e.head);
          if (v) this.scene.damageNumber([v.pos[0], v.pos[1] + (e.head ? 2.0 : 1.6), v.pos[2]], e.dmg, e.head, false);
        }
        if (e.victim === myId) {
          const melee = WEAPONS[this.names.get(e.shooter)?.weapon ?? 0]?.kind === 'melee';
          this.hud.hurt(); sfx.hurt(); this.feel.hurt(e.dmg, melee);
          if (melee) sfx.meleeHit(this.names.get(e.shooter)!.weapon);
        }
        break;
      }
      case 'kill': {
        const k = this.names.get(e.killer), v = this.names.get(e.victim);
        this.hud.kill(name(e.killer), name(e.victim), e.w, e.head, k?.team ?? 'A', v?.team ?? 'B');
        if (e.killer === myId && e.victim !== myId) { this.hud.hit(e.head, true); sfx.kill(e.head); this.hud.killPop(e.head, ++this.streak); }
        if (e.victim === myId) { this.hud.deathBy(name(e.killer)); this.streak = 0; }
        break;
      }
      case 'spawn':
        if (e.id === myId) {
          const mine = this.latest?.players.find((p) => p.id === myId);
          if (mine) { this.controls.yaw = mine.yaw; this.controls.pitch = 0; }
          this.smooth = [0, 0, 0];
        }
        break;
      case 'shieldUp': sfx.shield(); break;
      case 'shieldBreak': sfx.shieldBreak(); break;
      case 'phase':
        if (e.phase === 'countdown') {
          this.hud.announce('准备', 2);
          if (this.ended) { this.ended = false; this.onRestart(); }
        }
        if (e.phase === 'live') this.hud.announce('开战！', 1.5);
        if (e.phase === 'waiting') this.hud.announce('等待对手加入', 2);
        if (e.phase === 'ended') {
          const mine = this.names.get(myId);
          const title = e.winner === 'draw' ? '平局' : e.winner === mine?.team ? '胜利' : '失败';
          this.hud.announce(title, 3);
          this.ended = true; this.rematchPending = false;
          this.controls.clearAll(); this.resetAim();
          this.onEnded(title);
        }
        break;
      case 'fx':
        if (e.id !== myId && e.kind === 'dash') sfx.dash();
        break;
    }
  }

  // ---------- loop ----------

  get online() { return this.session.online; }

  setPaused(p: boolean) {
    if (this.paused === p) return;
    this.paused = p;
    if (p) this.resetAim();
    this.session.setPaused(p);
    this.acc = 0;
  }

  private resetAim() {
    this.aim.reset(); this.controls.clearAim(); this.scene.viewmodel.aim = 0; this.hud.aim(0, false);
    this.scene.camera.fov = 78; this.scene.camera.updateProjectionMatrix();
  }

  /** From the results screen: start the next match. */
  rematch() {
    if (!this.ended || this.rematchPending) return false;
    this.rematchPending = true;
    this.session.rematch();
    return true;
  }

  private frame(t: number) {
    if (!this.running) return;
    this.raf = requestAnimationFrame((tt) => this.frame(tt));
    const real = Math.max(0, (t - this.last) / 1000);
    const dt = Math.min(0.1, real);
    this.last = t;
    if (this.paused) {
      // keep the last frame on screen; nothing moves, nothing ticks
      this.scene.render(!!this.me?.alive);
      return;
    }

    this.acc = Math.min(this.acc + dt, DT * 6);
    while (this.acc >= DT) {
      this.acc -= DT;
      this.tickInput();
    }
    if (this.outbox.length) { this.session.send(this.outbox); this.outbox = []; }

    // advance the remote render clock, steering toward (newest snapshot - interpolation delay)
    if (this.latest) {
      const target = this.latest.tick + ((performance.now() - this.latestAt) / 1000) * TICK_HZ - INTERP_TICKS;
      this.renderTick += real * TICK_HZ;
      const err = target - this.renderTick;
      this.renderTick = Math.abs(err) > 30 ? target : this.renderTick + err * 0.08;
    }

    const k = Math.exp(-dt * 12);
    this.smooth = [this.smooth[0] * k, this.smooth[1] * k, this.smooth[2] * k];
    this.draw(dt);
  }

  private tickInput() {
    const c = this.controls;
    const s = c.sample();
    const active = c.locked && !this.ended;
    const inp: Input = {
      seq: ++this.seq,
      mx: active ? s.mx : 0,
      mz: active ? s.mz : 0,
      yaw: quantAngle(c.yaw),
      pitch: quantAngle(c.pitch),
      buttons: active ? s.buttons : 0,
      weapon: c.weapon,
      view: Math.round(this.renderTick * 100) / 100,
    };
    if (this.me) for (const e of applyInput(this.map, this.me, inp, this.foes(this.me))) this.onLocal(e);
    this.pending.push(inp);
    if (this.pending.length > 240) this.pending.shift();
    this.outbox.push(inp);
  }

  /** Latest authoritative enemy positions, so a predicted melee lunge stops where the server's does. */
  private foes(me: PlayerState) {
    return this.latest?.players.filter((p) => p.alive && p.team !== me.team) ?? [];
  }

  private onLocal(e: SimEvent) {
    switch (e.type) {
      case 'fire': {
        this.scene.viewmodel.fire();
        sfx.shot(e.weapon, true, 0);
        this.feel.fire(e.weapon);
        this.feel.kickAim(this.controls, e.weapon);
        // Cosmetic tracer begins at the actual loaded-model muzzle, transformed from view space.
        const start = this.scene.localMuzzle();
        this.scene.muzzleFlash(start, e.weapon === 1 ? 1.4 : 1);
        const w = WEAPONS[e.weapon];
        for (const d of e.dirs) {
          let t = raycastMap(this.map, e.origin, d, w.range);
          if (t === Infinity) t = w.range;
          let onPlayer = false;
          for (const p of this.remotes) {
            if (p.snap.team === this.me?.team || !p.snap.alive) continue;
            const h = rayPlayer(e.origin, d, p.pos[0], p.pos[1], p.pos[2], p.snap.crouched);
            if (h && h.t < t) { t = h.t; onPlayer = true; }
          }
          const end: Vec3 = [e.origin[0] + d[0] * t, e.origin[1] + d[1] * t, e.origin[2] + d[2] * t];
          this.scene.tracer(start, end, 0xfff4c0, w.pellets > 1 ? 0.5 : 1);
          if (t < w.range) this.scene.impact(end, onPlayer);
          if (!onPlayer && t < w.range && Math.random() < (w.pellets > 1 ? 0.15 : 0.6)) sfx.impact(t);
        }
        break;
      }
      case 'meleeStart': sfx.melee(e.weapon, true); break;
      case 'meleeStrike': this.scene.viewmodel.strike(); sfx.melee(e.weapon, false); this.feel.melee(e.weapon, false); this.meleeContact = null; break;
      case 'dash': sfx.dash(); break;
      case 'reload': sfx.reload(); break;
    }
  }

  private remotes: { snap: PlayerSnap; pos: Vec3; yaw: number; pitch: number }[] = [];

  /** Interpolated remote players at renderTick. */
  private interpolate() {
    const out: typeof this.remotes = [];
    const snaps = this.snaps;
    if (!snaps.length) return out;
    const rt = this.renderTick;
    let a = snaps[0], b = snaps[0];
    for (let i = snaps.length - 1; i >= 0; i--) {
      if (snaps[i].tick <= rt) { a = snaps[i]; b = snaps[Math.min(i + 1, snaps.length - 1)]; break; }
    }
    const f = b.tick > a.tick ? Math.max(0, Math.min(1, (rt - a.tick) / (b.tick - a.tick))) : 0;
    const latest = this.latest!;
    for (const p of latest.players) {
      if (p.id === this.session.id) continue;
      const pa = a.players.find((q) => q.id === p.id) ?? p, pb = b.players.find((q) => q.id === p.id) ?? p;
      // don't interpolate across a respawn teleport
      const jump = Math.hypot(pb.x - pa.x, pb.z - pa.z) > 4;
      const g = jump ? 1 : f;
      out.push({
        snap: { ...p, alive: g < 0.5 ? pa.alive : pb.alive, hp: pb.hp, weapon: pb.weapon },
        pos: [pa.x + (pb.x - pa.x) * g, pa.y + (pb.y - pa.y) * g, pa.z + (pb.z - pa.z) * g],
        yaw: pa.yaw + wrap(pb.yaw - pa.yaw) * g,
        pitch: pa.pitch + (pb.pitch - pa.pitch) * g,
      });
    }
    return out;
  }

  private draw(dt: number) {
    this.remotes = this.interpolate();
    const ids = new Set<string>();
    for (const r of this.remotes) {
      ids.add(r.snap.id);
      this.scene.syncAvatar(r.snap, r.pos, r.yaw, r.pitch, r.snap.team === this.me?.team);
    }
    this.scene.endAvatars();
    this.scene.pruneAvatars(ids);
    if (this.latest) this.scene.syncShields(this.latest.shields);

    const me = this.me;
    if (me) {
      if (this.aimWeapon !== me.weapon) { this.controls.clearAim(); this.aimWeapon = me.weapon; }
      const activeAim = canAimWeapon(me.weapon) && me.alive && this.controls.locked && document.visibilityState === 'visible' && document.hasFocus() && !this.ended && me.reload <= 0;
      if (!activeAim) this.controls.clearAim();
      const aim = this.aim.update(dt, this.controls.aimHeld, activeAim, me.weapon);
      this.controls.lookScale = 1 + (aimSensitivity(this.aim.fov(me.weapon), this.controls.adsSensitivity) - 1) * aim;
      this.hud.aim(aim, isScopedWeapon(me.weapon));
      const eye = me.alive ? playerEye(this.map, me) : 0.5; // drop the camera when dead
      const speed = me.grounded ? Math.min(1, Math.hypot(me.vx, me.vz) / 5) : 1;
      this.feel.update(dt, this.controls, speed);
      const [op, oy, roll] = this.feel.offsets();
      this.scene.setView(me.x + this.smooth[0], me.y + this.smooth[1] + eye, me.z + this.smooth[2], this.controls.yaw + oy * (1 - aim), this.controls.pitch + op * (1 - aim), roll * (1 - aim), this.aim.fov(me.weapon) - 78 + this.feel.fov * (1 - aim));
      this.scene.viewmodel.look(this.controls.yaw - this.lastLook[0], this.controls.pitch - this.lastLook[1]);
      this.lastLook = [this.controls.yaw, this.controls.pitch];
      this.hud.bloom(this.feel.bloom);
      const snapMe = this.latest?.players.find((p) => p.id === this.session.id);
      const vm = this.scene.viewmodel;
      vm.set(me.weapon, snapMe?.skins[me.weapon] ?? 0);
      const w = WEAPONS[me.weapon];
      vm.aim = aim;
      vm.meleeWindup = me.meleeWindup;
      vm.reloading = me.reload > 0 ? 1 - me.reload / w.reload : 0;
      vm.moving = me.grounded ? Math.min(1, Math.hypot(me.vx, me.vz) / 5) : 0;
    }
    this.scene.update(dt);
    this.scene.render(!!me?.alive);
    const ping = this.session.online ? bilingual(`快照间隔 ${Math.round(this.snapGap)} ms`, `Snapshot interval ${Math.round(this.snapGap)} ms`) : bilingual('单机', 'Offline');
    this.hud.update(dt, me, this.latest, this.session.id, this.ended ? this.controls.resultsScoreboard : this.controls.scoreboard, ping);
  }
}

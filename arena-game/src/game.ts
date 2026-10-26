// Client game loop: fixed 60 Hz input ticks with local prediction of the own player, server
// reconciliation (replay unacknowledged inputs), and ~100 ms interpolation of everyone else.

import { DT, INTERP_TICKS, TICK_HZ, WEAPONS } from '../shared/content.ts';
import { rayPlayer } from '../shared/hit.ts';
import { raycastMap, type ArenaMap, type Vec3 } from '../shared/map.ts';
import type { NetEvent, PlayerSnap, Snapshot } from '../shared/match.ts';
import { applyInput, clonePlayer, quantAngle, type Input, type PlayerState, type SimEvent } from '../shared/sim.ts';
import { sfx } from './audio.ts';
import type { Controls } from './controls.ts';
import type { Hud } from './hud.ts';
import { Feel } from './feel.ts';
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
  private streak = 0;
  private lastLook = [0, 0];

  constructor(
    private session: Session,
    private scene: ArenaScene,
    private controls: Controls,
    private hud: Hud,
    private onExit: (reason: string) => void,
  ) {
    this.map = session.map;
    session.onSnapshot = (s) => this.onSnapshot(s);
    session.onClose = (r) => this.stop(r);
    this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  stop(reason = '') {
    if (!this.running) return;
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.session.close();
    this.onExit(reason);
  }

  // ---------- network ----------

  private onSnapshot(s: Snapshot) {
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
      for (const i of this.pending) applyInput(this.map, next, i);
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
      case 'hit': {
        if (e.shooter === myId) {
          this.hud.hit(e.head, false);
          sfx.hit(e.head);
          const v = this.remotes.find((r) => r.snap.id === e.victim);
          if (v) this.scene.damageNumber([v.pos[0], v.pos[1] + (e.head ? 2.0 : 1.6), v.pos[2]], e.dmg, e.head, false);
        }
        if (e.victim === myId) { this.hud.hurt(); sfx.hurt(); this.feel.hurt(e.dmg); }
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
        if (e.phase === 'countdown') this.hud.announce('准备', 2);
        if (e.phase === 'live') this.hud.announce('开战！', 1.5);
        if (e.phase === 'waiting') this.hud.announce('等待对手加入', 2);
        if (e.phase === 'ended') {
          const mine = this.names.get(myId);
          this.hud.announce(e.winner === 'draw' ? '平局' : e.winner === mine?.team ? '胜利' : '失败', 5);
        }
        break;
      case 'fx':
        if (e.id !== myId && e.kind === 'dash') sfx.dash();
        break;
    }
  }

  // ---------- loop ----------

  private frame(t: number) {
    if (!this.running) return;
    this.raf = requestAnimationFrame((tt) => this.frame(tt));
    const real = Math.max(0, (t - this.last) / 1000);
    const dt = Math.min(0.1, real);
    this.last = t;

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
    const active = c.locked;
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
    if (this.me) for (const e of applyInput(this.map, this.me, inp)) this.onLocal(e);
    this.pending.push(inp);
    if (this.pending.length > 240) this.pending.shift();
    this.outbox.push(inp);
  }

  private onLocal(e: SimEvent) {
    switch (e.type) {
      case 'fire': {
        this.scene.viewmodel.fire();
        sfx.shot(e.weapon, true, 0);
        this.feel.fire(e.weapon);
        this.feel.kickAim(this.controls, e.weapon);
        const cam = this.scene.camera;
        // tracer starts a little right/below the eye, where the viewmodel muzzle appears
        const yaw = this.controls.yaw;
        const start: Vec3 = [
          cam.position.x + Math.cos(yaw) * 0.18 - Math.sin(yaw) * 0.4,
          cam.position.y - 0.16,
          cam.position.z - Math.sin(yaw) * 0.18 - Math.cos(yaw) * 0.4,
        ];
        this.scene.muzzleFlash(start, e.weapon === 1 ? 1.4 : 1);
        const w = WEAPONS[e.weapon];
        for (const d of e.dirs) {
          let t = raycastMap(this.map, e.origin, d, w.range);
          if (t === Infinity) t = w.range;
          let onPlayer = false;
          for (const p of this.remotes) {
            if (p.snap.team === this.me?.team || !p.snap.alive) continue;
            const h = rayPlayer(e.origin, d, p.pos[0], p.pos[1], p.pos[2]);
            if (h && h.t < t) { t = h.t; onPlayer = true; }
          }
          const end: Vec3 = [e.origin[0] + d[0] * t, e.origin[1] + d[1] * t, e.origin[2] + d[2] * t];
          this.scene.tracer(start, end, 0xfff4c0, w.pellets > 1 ? 0.5 : 1);
          if (t < w.range) this.scene.impact(end, onPlayer);
          if (!onPlayer && t < w.range && Math.random() < (w.pellets > 1 ? 0.15 : 0.6)) sfx.impact(t);
        }
        break;
      }
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
      const eye = me.alive ? this.map.eye : 0.5; // drop the camera when dead
      const speed = me.grounded ? Math.min(1, Math.hypot(me.vx, me.vz) / 5) : 1;
      this.feel.update(dt, this.controls, speed);
      const [op, oy, roll] = this.feel.offsets();
      this.scene.setView(me.x + this.smooth[0], me.y + this.smooth[1] + eye, me.z + this.smooth[2], this.controls.yaw + oy, this.controls.pitch + op, roll, this.feel.fov);
      this.scene.viewmodel.look(this.controls.yaw - this.lastLook[0], this.controls.pitch - this.lastLook[1]);
      this.lastLook = [this.controls.yaw, this.controls.pitch];
      this.hud.bloom(this.feel.bloom);
      const snapMe = this.latest?.players.find((p) => p.id === this.session.id);
      const vm = this.scene.viewmodel;
      vm.set(me.weapon, snapMe?.skins[me.weapon] ?? 0);
      const w = WEAPONS[me.weapon];
      vm.reloading = me.reload > 0 ? 1 - me.reload / w.reload : 0;
      vm.moving = me.grounded ? Math.min(1, Math.hypot(me.vx, me.vz) / 5) : 0;
    }
    this.scene.update(dt);
    this.scene.render(!!me?.alive);
    const ping = this.session.online ? `快照间隔 ${Math.round(this.snapGap)} ms` : '单机';
    this.hud.update(dt, me, this.latest, this.session.id, this.controls.scoreboard, ping);
  }
}

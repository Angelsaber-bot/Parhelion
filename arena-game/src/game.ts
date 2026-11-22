import {rayTactical} from '../shared/heroes.ts';
import {predictAbility} from './player/abilityPrediction.ts';
import type { HeroLesson } from './ui/heroLesson.ts';
import { smokeAllowsGlimpse, smokeBlocks } from '../shared/grenade.ts';
import { bilingual } from '../../shared-client/i18n.ts';
// Client game loop: fixed 60 Hz input ticks with local prediction of the own player, server
// reconciliation (replay unacknowledged inputs), and ~100 ms interpolation of everyone else.

import { DT, WEAPONS } from '../shared/content.ts';
import { hiddenFromView } from './rendering/edictReveal.ts';
import { humanObservation, type CombatContact } from '../shared/humanCombat.ts';
import { explorationScene, visibleSmokeDepths } from '../shared/exploration.ts';
import { rayPlayer, rayShield } from '../shared/hit.ts';
import { tacticalArea, raycastMap, lineOfSight, type ArenaMap, type Vec3 } from '../shared/map.ts';
import { type NetEvent, type PlayerSnap, type Snapshot } from '../shared/match.ts';
import { SnapshotInterpolation, type RemotePose } from './network/snapshotInterpolation.ts';
import { BackgroundTicker } from './network/backgroundTicker.ts';
import { aimDir, applyInput, clonePlayer, playerEye, quantAngle, type Input, type PlayerState, type SimEvent } from '../shared/sim.ts';
import { sfx } from './rendering/audio.ts';
import type { Controls } from './player/controls.ts';
import type { Hud } from './ui/hud.ts';
import { Feel } from './player/feel.ts';
import { AimState, aimSensitivity, canAimWeapon, isScopedWeapon } from './player/aim.ts';
import { type ArenaScene } from './rendering/scene.ts';
import { surfaceNormal } from './rendering/weaponFx.ts';
import type { Session } from './network/session.ts';
import {FrameGate} from './rendering/renderScheduling.ts';
import { RangeStats } from './ui/rangeStats.ts';
import { AIM_FOV } from './player/aim.ts';
import type { HumanDemo } from './player/humanDemo.ts';

export class Game {
  lesson:HeroLesson|null=null;
  private me: PlayerState | null = null;
  private pending: Input[] = [];
  private outbox: Input[] = [];
  private seq = 0;
  private readonly interpolation = new SnapshotInterpolation();
  private remotes: RemotePose[] = [];
  private latest: Snapshot | null = null;
  private meleeContact: Vec3 | null = null; // server contact point of my latest swing
  private acc = 0;
  private last = performance.now();
  private background = new BackgroundTicker((seconds) => { if (this.running && !this.paused) this.advance(Math.min(.25, seconds)); });
  private smooth: Vec3 = [0, 0, 0];
  private raf = 0;
  private running = true;
  private pausedFrames=new FrameGate(10);
  /** Round trip from pressing a key to the server's snapshot confirming it (smoothed), and when each input left. */
  private rtt = 0;
  private sentAt = new Map<number, number>();
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
  private stepDistance=0;
  private rematchPending = false;

  constructor(
    private session: Session,
    private scene: ArenaScene,
    private controls: Controls,
    private hud: Hud,
    private onExit: (reason: string) => void,
    readonly humanDemo?: HumanDemo,
  ) {
    this.map = session.map;
    this.rangeStats = session.practice ? new RangeStats() : null;
    // Hud and ArenaScene are reused after returning to the lobby: clear them before
    // the first snapshot of a new session, not three seconds later at live phase.
    this.controls.clearAll(); this.controls.resultsScoreboard = false; this.controls.weapon = 0;
    this.resetAim(); this.hud.resetRound(); this.scene.clearCombatEffects();
    session.onSnapshot = (s) => this.onSnapshot(s);
    session.onClose = (r) => this.stop(r);
    this.raf = requestAnimationFrame((t) => this.frame(t));
    // Online only: a background window keeps sending its moves instead of freezing its player.
    if (session.online) this.background.start();
  }

  stop(reason = '') {
    this.lesson?.dispose();this.lesson=null;
    if (!this.running) return;
    this.running = false;
    this.humanDemo?.flush();
    cancelAnimationFrame(this.raf);
    this.background.stop();
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
    if (s.phase === 'live' && previousPhase !== 'live') this.humanDemo?.beginRound();
    if (s.phase === 'ended' && previousPhase !== 'ended') this.humanDemo?.pause();
    if ((previousPhase === 'ended' && s.phase !== 'ended') || (s.phase === 'live' && previousPhase !== 'live')) {
      const wasEnded = this.ended;
      this.pending = []; this.outbox = []; this.interpolation.resetRound(); this.remotes = []; this.sentAt.clear(); this.rtt = 0;
      this.smooth = [0, 0, 0]; this.acc = 0; this.streak = 0;
      this.feel = new Feel(); this.controls.clearAll(); this.controls.resultsScoreboard = false;
      this.controls.weapon = 0; this.aimWeapon = -1; this.resetAim(); this.hud.resetRound(); this.scene.clearCombatEffects();
      this.rematchPending = false; this.ended = false; this.paused = false; this.session.setPaused(false);
      if (wasEnded) this.onRestart();
    }
    const now = performance.now();
    this.latest = s;
    this.interpolation.push(s, now);
    for (const p of s.players) this.names.set(p.id, p);

    const mine = s.players.find((p) => p.id === this.session.id);
    if (mine) {
      const before = this.me;
      const next = clonePlayer(mine);
      const sent = this.sentAt.get(mine.lastSeq);
      if (sent !== undefined) { const sample = now - sent; this.rtt = this.rtt ? this.rtt + (sample - this.rtt) * .15 : sample; }
      for (const seq of this.sentAt.keys()) if (seq <= mine.lastSeq) this.sentAt.delete(seq);
      this.pending = this.pending.filter((i) => i.seq > mine.lastSeq);
      const foes = this.foes(next);
      for (const i of this.pending) {predictAbility(this.map,next,i,s);applyInput(this.map, next, i, foes);}
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

  private distance(at: readonly number[]) { const me = this.me; return me ? Math.hypot(at[0] - me.x, at[1] - me.y, at[2] - me.z) : 30; }
  /** Training range readout (null in real matches). */
  rangeStats: RangeStats | null = null;
  private rangeStatsAt = 0;

  private onEvent(e: NetEvent) {
    const myId = this.session.id;
    this.rangeStats?.event(e, myId, performance.now() / 1000);
    this.lesson?.event(e);
    const name = (id: string) => this.names.get(id)?.name ?? id;
    switch (e.t) {
      case 'ability':
        this.scene.heroEvent(e,this.latest?.tick??0,this.latest?.players.find(p=>p.id===e.id)?.yaw??0);
        sfx.ability(e.kind,e.action,e.action==='blocked'&&(e.by===myId||e.id===myId)?0.5:this.distance(e.at));
        // Whoever hit the guard sees how much it swallowed, in blue.
        if(e.action==='blocked'&&e.by===myId&&e.amount)this.scene.damageNumber([e.at[0],e.at[1]+.5,e.at[2]],e.amount,false,false,true);
        break;
      case 'shot': {
        if (e.id === myId) break; // already shown by prediction
        const from = this.scene.muzzleOf(e.id) ?? e.from;
        const shooter=this.names.get(e.id),skinId=WEAPONS[e.w]?.skins[shooter?.skins[e.w]??0]?.id;
        const d = this.me ? Math.hypot(e.from[0]-this.me.x,e.from[1]-this.me.y,e.from[2]-this.me.z) : 99;
        // Distant shots keep audio; nearby shotguns show two representative rays for the full pellet burst.
        if(d<32){
          this.scene.remoteMuzzle(from,e.w,skinId);
          e.to.slice(0,WEAPONS[e.w].pellets>1?2:1).forEach((to,i)=>{
            this.scene.skinTracer(from,to,skinId,.45,true,e.w);
            // A shot that ended on the map (not in the air or on a player) leaves its mark there.
            const dir:Vec3=[to[0]-e.from[0],to[1]-e.from[1],to[2]-e.from[2]],len=Math.hypot(...dir);
            if(i===0&&len>.5){const unit:Vec3=[dir[0]/len,dir[1]/len,dir[2]/len];if(Math.abs(raycastMap(this.map,e.from,unit,len+.05)-len)<.08)this.scene.skinImpact(to,false,skinId,surfaceNormal(this.map,to,unit));}
          });
        }
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
        const wielder=this.names.get(e.id),skinId=WEAPONS[e.w]?.skins[wielder?.skins[e.w]??0]?.id;
        if (e.id === myId) this.meleeContact = e.to;
        else {
          this.scene.skinSwing(e.from,e.to,skinId,e.w);
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
            if (at) this.scene.meleeImpact(at, weapon,WEAPONS[weapon]?.skins[this.names.get(myId)?.skins[weapon]??0]?.id);
          } else sfx.hit(e.head);
          if (v) this.scene.damageNumber([v.pos[0], v.pos[1] + (e.head ? 2.0 : 1.6), v.pos[2]], e.dmg, e.head, false);
        }
        else if (e.victim !== myId && e.victim !== e.shooter) {
          // Someone else's hit on someone else: you see it in their weapon's own style too —
          // the finish's contact emblem for melee, its hit flash and particles for guns.
          const shooter = this.names.get(e.shooter), v = this.remotes.find((r) => r.snap.id === e.victim), w = shooter?.weapon ?? 0;
          const skinId = WEAPONS[w]?.skins[shooter?.skins[w] ?? 0]?.id;
          if (v && this.distance(v.pos) < 40) {
            const at: Vec3 = [v.pos[0], v.pos[1] + (e.head ? 1.65 : 1.15), v.pos[2]];
            if (WEAPONS[w]?.kind === 'melee') this.scene.meleeImpact(at, w, skinId); else this.scene.skinImpact(at, true, skinId);
          }
        }
        if (e.victim === myId) {
          const melee = WEAPONS[this.names.get(e.shooter)?.weapon ?? 0]?.kind === 'melee';
          this.hud.hurt(); sfx.hurt(); this.feel.hurt(e.dmg, melee);
          if (melee) sfx.meleeHit(this.names.get(e.shooter)!.weapon);
        }
        break;
      }
      case 'throw':
        if (e.id === myId) this.scene.viewmodel.throwGesture();
        sfx.throw();
        break;
      case 'bounce': sfx.bounce(this.distance(e.at)); break;
      case 'blast': this.scene.grenadeBlast(e.at); sfx.blast(this.distance(e.at)); break;
      case 'smoke': this.scene.smokePop(e.at); sfx.smoke(this.distance(e.at)); break;
      case 'kill': {
        const k = this.names.get(e.killer), v = this.names.get(e.victim);
        this.hud.kill(name(e.killer), name(e.victim), e.w, e.head, k?.team ?? 'A', v?.team ?? 'B');
        if (e.killer === myId && e.victim !== myId) { this.hud.hit(e.head, true); sfx.kill(e.head); this.hud.killPop(e.head, ++this.streak); }
        if (e.victim === myId) { this.hud.deathBy(name(e.killer)); this.streak = 0; }
        // The killer's finish signs the kill with its own emblem where the victim fell.
        const victim = this.latest?.players.find((p) => p.id === e.victim), finish = WEAPONS[e.w]?.skins[k?.skins[e.w] ?? 0]?.id;
        if (victim && e.victim !== myId) this.scene.killFinisher([victim.x, victim.y, victim.z], finish);
        break;
      }
      case 'spawn':
        if (e.id === myId) {
          const mine = this.latest?.players.find((p) => p.id === myId);
          if (mine) {
            // The spawn event keeps the authored exit/practice heading if a later input has
            // already replaced mine.yaw in this snapshot. Older events use the snapshot yaw.
            this.controls.yaw = typeof e.yaw === 'number' && Number.isFinite(e.yaw) ? e.yaw : mine.yaw;
            this.controls.pitch = 0;
          }
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
    if (p) {
      this.resetAim();
      this.humanDemo?.pause();
    }
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
      if(this.pausedFrames.allow(t))this.scene.render(!!this.me?.alive);
      return;
    }

    this.background.frame(t);
    this.advance(dt);

    this.interpolation.advance(real, performance.now());

    const k = Math.exp(-dt * 12);
    this.smooth = [this.smooth[0] * k, this.smooth[1] * k, this.smooth[2] * k];
    this.draw(dt);
  }

  /** Fixed-step input clock, from animation frames or (in a background window) the worker heartbeat. */
  private advance(seconds: number) {
    this.acc = Math.min(this.acc + seconds, DT * 6);
    while (this.acc >= DT) {
      this.acc -= DT;
      this.tickInput();
    }
    if (this.outbox.length) { this.session.send(this.outbox); this.outbox = []; }
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
      view: Math.round(this.interpolation.renderTick * 100) / 100,
    };
    if (this.humanDemo && active && this.me?.alive && (this.humanDemo.automatic || WEAPONS[this.me.weapon].kind === 'gun') && this.latest?.phase === 'live' && document.visibilityState === 'visible' && document.hasFocus()) {
      this.recordHumanDemo(this.humanDemo, this.me, inp, this.latest);
    }
    if (this.me) {predictAbility(this.map,this.me,inp,this.latest);for (const e of applyInput(this.map, this.me, inp, this.foes(this.me))) this.onLocal(e);}
    this.pending.push(inp);
    if (this.pending.length > 240) this.pending.shift();
    this.outbox.push(inp);
    this.sentAt.set(inp.seq, performance.now());
    if (this.sentAt.size > 600) this.sentAt.delete(this.sentAt.keys().next().value!);
  }

  private recordHumanDemo(demo: HumanDemo, me: PlayerState, input: Input, frame: Snapshot) {
    const contacts: CombatContact[] = this.remotes.filter(r => r.snap.alive).map(r => ({ team: r.snap.team, crouched: r.snap.crouched, feet: r.pos }));
    for (const effect of frame.entities ?? []) {
      if (effect.kind === 'decoy') contacts.push({ team: effect.team, crouched: false, feet: [effect.x, effect.y, effect.z] });
    }
    const canSee = (from: Vec3, to: Vec3, thinGlimpse = false) => {
      if (!lineOfSight(this.map, from, to)) return false;
      const smokes = frame.smokes ?? [];
      if (smokeBlocks(smokes, from, to) && !(thinGlimpse && smokeAllowsGlimpse(smokes, from, to))) return false;
      const dx = to[0] - from[0], dy = to[1] - from[1], dz = to[2] - from[2];
      const distance = Math.hypot(dx, dy, dz);
      if (distance < .001) return true;
      const ray: Vec3 = [dx / distance, dy / distance, dz / distance];
      return !frame.shields.some(s => s.hp > 0 && s.life > 0 && rayShield(from, ray, s.x, s.y, s.z, s.yaw) < distance);
    };
    const { fov, aspect } = this.scene.camera;
    demo.record(me, input, previous => humanObservation(this.map, me, contacts, canSee, previous, fov * Math.PI / 180, aspect,
      (a, b) => canSee(a, b, true)),
      lastContact => explorationScene(this.map, me, lastContact),
      () => visibleSmokeDepths(this.map, me, frame.smokes ?? [], frame.shields, Math.atan(Math.tan(fov * Math.PI / 360) * aspect)));
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
        const w = WEAPONS[e.weapon],skinId=w.skins[this.names.get(this.session.id)?.skins[e.weapon]??0]?.id;
        this.scene.muzzleFlash(start, e.weapon === 1 ? 1.4 : 1,skinId);
        let visualRays=0;
        for (const d of e.dirs) {
          let t = raycastMap(this.map, e.origin, d, w.range);
          if (t === Infinity) t = w.range;
          for(const shield of this.latest?.shields??[])t=Math.min(t,rayShield(e.origin,d,shield.x,shield.y,shield.z,shield.yaw));
          for(const entity of this.latest?.entities??[]){const hit=rayTactical(e.origin,d,entity);if(hit)t=Math.min(t,hit.t);}
          let onPlayer = false;
          for (const p of this.remotes) {
            if (p.snap.team === this.me?.team || !p.snap.alive) continue;
            const h = rayPlayer(e.origin, d, p.pos[0], p.pos[1], p.pos[2], p.snap.crouched);
            if (h && h.t < t) { t = h.t; onPlayer = true; }
          }
          const end: Vec3 = [e.origin[0] + d[0] * t, e.origin[1] + d[1] * t, e.origin[2] + d[2] * t];
          if(visualRays<(w.pellets>1?2:1)){
            const aiming=this.scene.viewmodel.aim>=.3;
            this.scene.skinTracer(start,end,skinId,w.pellets>1?.38:.65,!aiming,e.weapon,aiming);
            if(t<w.range)this.scene.skinImpact(end,onPlayer,skinId,onPlayer?undefined:surfaceNormal(this.map,end,d));
          }
          visualRays++;
          if (!onPlayer && t < w.range && Math.random() < (w.pellets > 1 ? 0.15 : 0.6)) sfx.impact(t);
        }
        break;
      }
      case 'meleeStart': sfx.melee(e.weapon, true); break;
      case 'meleeStrike':
        this.scene.viewmodel.strike(); sfx.melee(e.weapon, false); this.feel.melee(e.weapon, false); this.meleeContact = null;
        this.scene.ownSwing(e.weapon, WEAPONS[e.weapon]?.skins[this.names.get(this.session.id)?.skins[e.weapon] ?? 0]?.id);
        break;
      case 'dash': sfx.dash(); break;
      case 'reload': sfx.reload(); break;
    }
  }

  private draw(dt: number) {
    if(this.latest)this.lesson?.update(this.latest,this.me);
    this.remotes = this.interpolation.sample(this.session.id);
    if (this.latest) { this.scene.syncHeroes(this.latest,this.session.id,this.map,this.me?{...this.me,yaw:this.controls.yaw,pitch:this.controls.pitch}:null); this.scene.syncShields(this.latest.shields); this.scene.syncGrenades(this.latest.grenades ?? [], this.latest.smokes ?? [], this.interpolation.ageSeconds(performance.now())); }

    const me = this.me;
    if (me) {
      if (this.aimWeapon !== me.weapon) { this.controls.clearAim(); this.aimWeapon = me.weapon; }
      const activeAim = canAimWeapon(me.weapon) && me.alive && this.controls.locked && document.visibilityState === 'visible' && document.hasFocus() && !this.ended && me.reload <= 0;
      if (!activeAim) this.controls.clearAim();
      const aim = this.aim.update(dt, this.controls.aimHeld, activeAim, me.weapon);
      if (this.controls.inspect) { this.controls.inspect = false; if (me.alive && !this.ended) this.scene.viewmodel.inspect(); }
      this.controls.lookScale = 1 + (aimSensitivity(this.aim.fov(me.weapon), this.controls.adsSensitivity) - 1) * aim;
      this.hud.aim(aim, isScopedWeapon(me.weapon));
      // Scope picture only: lens, reticle and readouts. It never moves the aim.
      if (isScopedWeapon(me.weapon) && aim > .7 && me.alive) {
        const eyeAt: Vec3 = [me.x, me.y + playerEye(this.map, me), me.z], dir = aimDir(this.controls.yaw, this.controls.pitch);
        let range = raycastMap(this.map, eyeAt, dir, 400);
        for (const p of this.latest?.players ?? []) { if (p.id === this.session.id || !p.alive || smokeBlocks(this.latest?.smokes??[],eyeAt,[p.x,p.y+1,p.z])) continue; const h = rayPlayer(eyeAt, dir, p.x, p.y, p.z, p.crouched); if (h && h.t < range) range = h.t; }
        const skin = WEAPONS[me.weapon]?.skins[this.names.get(this.session.id)?.skins[me.weapon] ?? 0];
        this.hud.scope({ open: (aim - .7) / .3, kind: me.weapon === 4 ? 'sniper' : 'dmr', accent: skin?.accent ?? 0xff4a3a, range: Number.isFinite(range) ? range : null,
          zoom: Math.tan(78 * Math.PI / 360) / Math.tan((AIM_FOV[me.weapon] ?? 78) * Math.PI / 360), label: me.weapon === 4 ? 'LONGNIGHT · MIL-DOT' : 'HALO · BDC', theme: skin?.id, time: performance.now() / 1000 });
      } else this.hud.scope(null);
      const eye = me.alive ? playerEye(this.map, me) : 0.5; // drop the camera when dead
      const speed = me.grounded ? Math.min(1, Math.hypot(me.vx, me.vz) / 5) : 1;
      if(me.alive&&me.grounded&&this.controls.locked){this.stepDistance+=Math.hypot(me.vx,me.vz)*dt;if(this.stepDistance>1.6){this.stepDistance=0;sfx.footstep(tacticalArea(this.map,me.x,me.z)?.surface??'stone',me.crouched);}}else this.stepDistance=0;
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
      vm.hands.update(me,aim);
      vm.aim = aim;
      vm.meleeWindup = me.meleeWindup;
      vm.reloading = me.reload > 0 ? 1 - me.reload / w.reload : 0;
      vm.moving = me.grounded ? Math.min(1, Math.hypot(me.vx, me.vz) / 5) : 0;
    }
    // Resolve avatar labels against this frame's camera and smoke snapshot.
    const ids = new Set<string>();
    for (const r of this.remotes) {
      ids.add(r.snap.id);
      const ally = r.snap.team === this.me?.team, revealed = !ally && r.snap.alive && (r.snap.revealedUntil ?? 0) > (this.latest?.tick ?? 0);
      const eye = this.scene.camera.position;
      this.scene.syncAvatar(r.snap, r.pos, r.yaw, r.pitch, ally, revealed && hiddenFromView(this.map, [eye.x, eye.y, eye.z], r.pos, r.snap.crouched, this.latest?.smokes ?? []) ? 1 : 0);
    }
    for(const e of this.latest?.entities??[])if(e.kind==='decoy') {
      const owner=this.latest!.players.find(p=>p.id===e.owner);if(!owner)continue;
      const fake={...owner,id:`echo-${e.id}`,x:e.x,y:e.y,z:e.z,hp:e.shownHp,alive:true,weapon:e.weapon,char:e.char,ability:{...owner.ability,phase:'idle' as const},name:e.team===this.me?.team?`${e.name} ◇`:e.name};
      ids.add(fake.id);this.scene.syncAvatar(fake,[e.x,e.y,e.z],e.yaw,0,fake.team===this.me?.team);
    }
    this.scene.endAvatars();
    this.scene.pruneAvatars(ids);
    this.scene.update(dt);
    this.scene.render(!!me?.alive);
    if (this.humanDemo && me?.alive && this.controls.locked && this.latest?.phase === 'live' && document.visibilityState === 'visible' && document.hasFocus()) {
      this.humanDemo.captureView(this.scene.renderer.domElement);
    }
    const room = this.session.roomCode ? bilingual(`房间 ${this.session.roomCode} · `, `Room ${this.session.roomCode} · `) : '';
    const ping = room + (this.session.online ? bilingual(`延迟 ${this.rtt ? Math.round(this.rtt) : '—'} ms · 快照 ${Math.round(this.interpolation.arrivalGapMs)} ms`, `Latency ${this.rtt ? Math.round(this.rtt) : '—'} ms · Snapshots ${Math.round(this.interpolation.arrivalGapMs)} ms`) : bilingual('单机', 'Offline'));
    if (this.rangeStats && performance.now() - this.rangeStatsAt > 200) { this.rangeStatsAt = performance.now(); const panel = document.getElementById('range-stats'); if (panel) panel.innerHTML = this.rangeStats.render(performance.now() / 1000); }
    this.hud.update(dt, me, this.latest, this.session.id, this.ended ? this.controls.resultsScoreboard : this.controls.scoreboard, ping, this.map);
  }
}

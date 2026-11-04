import * as THREE from 'three';
import { bilingual } from '../../../shared-client/i18n';
import type { Enemy, HitContext, Point3, WorldCombatState } from '../combat';
import { CoopSession, type CoopSocket, type CoopStatus } from './coopSession';
import { ENEMY_HZ, ENEMY_SYNC_RADIUS, STATE_HZ, WORLD_COOP_SERVER, decodeSkillFx, encodeEnemy, encodeSkillFx, encodeState, type EnemyWireState, type PlayerWireState, type SkillFxWire } from './coopProtocol';
import { PartnerAvatar } from './partnerAvatar';
import { PingMarkers } from './pingMarkers';
import { worldGun } from '../worldArsenal';

/** Most enemies one snapshot carries (nearest first); keeps a message far under the relay cap. */
export const ENEMY_SNAPSHOT_MAX = 60;

export interface CoopCombat {
  readonly state: WorldCombatState;
  remoteHit(id: string, amount: number, source: HitContext['source']): unknown;
  applyRemoteEnemies(list: EnemyWireState[]): void;
  remoteHurt(amount: number): void;
  joinRemoteBoss(id: string): boolean;
  leaveRemoteBoss(): boolean;
}
/** A guest joins the host's boss fight from this close to the boss's arena. */
export const BOSS_JOIN_RADIUS = 70;
export interface WorldCoopOptions {
  combat: CoopCombat;
  toast(text: string): void;
  onStatus?(status: CoopStatus, detail?: string): void;
  /** The partner pinged something (a cue sound). */
  onPing?(): void;
  /** Draw one of the partner's shots (a tracer only: their game resolves the damage). */
  partnerShot?(muzzle: THREE.Vector3, end: THREE.Vector3): void;
  /** Show a partner's skill or ultimate (visual only). */
  partnerSkill?(fx: SkillFxWire): void;
  /** Valid skill identities (servant ids); null means the player's own. */
  identities?: readonly string[];
  server?: string;
  open?: (url: string) => CoopSocket;
  outlines?: boolean;
}

const near = (a: Point3, b: Point3 | null) => b ? Math.hypot(a.x - b.x, a.z - b.z) : Infinity;

/** Host side: enemies near either player, nearest first, dead ones included so respawns sync. */
export function enemySnapshot(enemies: readonly Enemy[], local: Point3, partner: Point3 | null, radius = ENEMY_SYNC_RADIUS, max = ENEMY_SNAPSHOT_MAX): EnemyWireState[] {
  const ranked: { e: Enemy; d: number }[] = [];
  for (const e of enemies) {
    if (e.storyEncounter) continue; // story actors exist only in the host's game
    const d = Math.min(near(e.p, local), near(e.p, partner));
    if (d <= radius) ranked.push({ e, d });
  }
  return ranked.sort((a, b) => a.d - b.d).slice(0, max).map(({ e }) => {
    const wire = encodeEnemy(e);
    // A chasing enemy faces the player it is after, on the guest's screen too.
    if (e.mode === 'chase' && !wire.t) { const to = near(e.p, partner) < near(e.p, local) ? partner! : local; wire.t = [Math.round(to.x * 100) / 100, Math.round(to.y * 100) / 100, Math.round(to.z * 100) / 100]; }
    return wire;
  });
}

/**
 * Two-player World co-op. Each game runs its own World; the first player in a room is the host,
 * whose game moves and fights every enemy (against whichever player is nearer). The guest mirrors
 * the host's enemies, reports its own hits, and takes the hits the host's enemies land on it.
 */
export class WorldCoop {
  readonly session: CoopSession;
  readonly avatar: PartnerAvatar;
  readonly pings = new PingMarkers();
  private readonly enemyPoint = new THREE.Vector3();
  private stateAcc = 0;
  private enemyAcc = 0;
  private shown = false;
  private partnerDown = false;
  private partnerFire = 0;
  private bossAnnounced = '';
  private bossBeat = 0;
  private readonly localPos = { x: 0, y: 0, z: 0 };
  private readonly muzzle = new THREE.Vector3();
  private readonly shotEnd = new THREE.Vector3();
  constructor(scene: THREE.Scene, renderer: THREE.WebGLRenderer, private readonly options: WorldCoopOptions) {
    this.avatar = new PartnerAvatar(scene, renderer, options.outlines ?? true);
    this.session = new CoopSession({
      status: (status, detail) => this.onStatus(status, detail),
      role: () => this.applyRole(),
      partnerState: state => this.avatar.receive(state),
      enemies: list => { if (this.guest) options.combat.applyRemoteEnemies(list); },
      hit: hit => { if (this.host) options.combat.remoteHit(hit.id, hit.damage, hit.source); },
      event: event => this.onEvent(event),
    }, options.open, options.server ?? WORLD_COOP_SERVER);
    options.combat.state.onLocalHit = (id, damage, source) => { if (this.guest) this.session.send('hit', { id, damage: Math.round(damage * 100) / 100, source }); };
  }
  get host() { return this.session.paired && this.session.host; }
  get guest() { return this.session.paired && !this.session.host; }
  get partnerName() { return this.avatar.track.latest?.name || bilingual('队友', 'Partner'); }
  join(code: string) { this.session.connect(code); }
  leave() { this.session.leave(); }
  /** Host: an enemy's attack landed on the partner; their game applies it. */
  partnerHurt(damage: number) { if (this.host) this.session.send('event', { kind: 'hurt', data: { damage: Math.round(damage * 100) / 100 } }); }
  /** Share this player's skill visual with the partner. */
  skillFx(event: Parameters<typeof encodeSkillFx>[0]) {
    if (!this.session.paired) return;
    const fx = encodeSkillFx(event); if (fx) this.session.send('event', { kind: 'skill', data: fx });
  }
  /** Mark a spot (or an enemy) for both players. Returns false when not paired. */
  ping(p: Point3, enemyId?: string) {
    if (!this.session.paired) return false;
    this.pings.add(true, p, enemyId);
    this.session.send('event', { kind: 'ping', data: { p: [p.x, p.y, p.z].map(n => Math.round(n * 100) / 100), ...(enemyId ? { id: enemyId } : {}) } });
    return true;
  }
  private onEvent(event: { kind: string; data?: unknown }) {
    if (event.kind === 'ping') {
      const d = event.data as { p?: unknown; id?: unknown } | undefined;
      const p = d?.p;
      if (!Array.isArray(p) || p.length !== 3 || !p.every(n => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 5000)) return;
      const id = typeof d?.id === 'string' && d.id.length <= 48 ? d.id : undefined;
      this.pings.add(false, { x: p[0], y: p[1], z: p[2] }, id);
      this.options.onPing?.();
      return;
    }
    if (event.kind === 'skill') { const fx = decodeSkillFx(event.data, this.options.identities ?? []); if (fx) this.options.partnerSkill?.(fx); return; }
    if (event.kind === 'boss' && this.guest) {
      const d = event.data as { id?: unknown } | undefined, id = typeof d?.id === 'string' ? d.id : '';
      const state = this.options.combat.state;
      if (!id) { if (state.bossStarted && this.options.combat.leaveRemoteBoss()) this.options.toast(bilingual('房主的首领战已结束', "The host's boss fight ended")); return; }
      if (state.bossStarted && state.boss.id === id) { this.bossBeat = 3; return; }
      const boss = state.bosses.find(b => b.id === id);
      if (boss && !state.bossStarted && Math.hypot(boss.home.x - this.localPos.x, boss.home.z - this.localPos.z) <= BOSS_JOIN_RADIUS && this.options.combat.joinRemoteBoss(id))
        { this.bossBeat = 3; this.options.toast(bilingual('已加入房主的首领战 · 两人一起打', "Joined the host's boss fight")); }
      return;
    }
    if (event.kind === 'hurt' && this.guest) {
      const damage = (event.data as { damage?: unknown } | undefined)?.damage;
      if (typeof damage === 'number') this.options.combat.remoteHurt(damage);
    }
  }
  private applyRole() {
    const state = this.options.combat.state;
    state.remoteEnemies = this.guest;
    if (!this.host) state.partner = null;
  }
  private onStatus(status: CoopStatus, detail?: string) {
    this.applyRole();
    const code = this.session.code ?? '';
    if (status === 'paired') this.options.toast(bilingual(`联机：${this.partnerName}已加入 · 房间 ${code}`, `Co-op: ${this.partnerName} joined · Room ${code}`));
    else if (status === 'waiting') this.options.toast(bilingual(`联机房间 ${code} · 等待队友加入`, `Co-op room ${code} · Waiting for a partner`));
    else if (status === 'error') this.options.toast(bilingual(`联机失败：${detail ?? '连接错误'}`, `Co-op failed: ${detail ?? 'connection error'}`));
    else if (status === 'closed') this.options.toast(bilingual('联机已断开', 'Co-op disconnected'));
    if (status !== 'paired') { this.avatar.hide(); this.pings.clear(); this.shown = false; this.partnerDown = false; }
    this.options.onStatus?.(status, detail);
  }
  /** Once per rendered frame, after the local character has animated. */
  update(dt: number, camera: THREE.Camera, local: PlayerWireState | null, localPos: Point3, now = performance.now(), localActive = true) {
    this.options.combat.state.localAbsent = this.host && !localActive;
    if (!this.session.paired) return;
    this.stateAcc += dt;
    if (local && this.stateAcc >= 1 / STATE_HZ) { this.stateAcc = Math.min(this.stateAcc - 1 / STATE_HZ, 1 / STATE_HZ); this.session.send('state', encodeState(local)); }
    this.localPos.x = localPos.x; this.localPos.y = localPos.y; this.localPos.z = localPos.z;
    if (this.host) this.announceBoss(dt);
    if (this.guest && this.options.combat.state.bossStarted && this.bossBeat > 0 && (this.bossBeat -= dt) <= 0) this.options.combat.leaveRemoteBoss();
    const latest = this.avatar.track.latest;
    if (this.host) {
      const state = this.options.combat.state;
      state.partner = latest ? { x: latest.p[0], y: latest.p[1], z: latest.p[2] } : null;
      this.enemyAcc += dt;
      if (this.enemyAcc >= 1 / ENEMY_HZ) {
        this.enemyAcc = Math.min(this.enemyAcc - 1 / ENEMY_HZ, 1 / ENEMY_HZ);
        this.session.send('enemies', enemySnapshot(state.enemies, localPos, state.partner));
      }
    }
    // Tell this player when the partner goes down or is back on their feet.
    const down = !!latest && latest.hp <= 0;
    if (latest && down !== this.partnerDown) {
      this.partnerDown = down;
      this.options.toast(down ? bilingual(`${this.partnerName}倒下了 · 正在返回安全地点`, `${this.partnerName} is down · returning to safety`) : bilingual(`${this.partnerName}已重新站起`, `${this.partnerName} is back up`));
    }
    this.avatar.update(dt, camera, now, this.partnerName);
    this.drawPartnerFire(dt, latest);
    const enemies = this.options.combat.state.enemies;
    this.pings.update(dt, camera, camera.position, id => {
      const e = enemies.find(x => x.id === id);
      return e && e.mode !== 'dead' ? this.enemyPoint.set(e.p.x, e.p.y, e.p.z) : null;
    }, this.partnerName);
    this.shown = !!latest;
  }
  /** Host: say which boss fight is running (on change, and every second for a late joiner). */
  private announceBoss(dt: number) {
    const state = this.options.combat.state, id = state.bossStarted ? state.boss.id : '';
    this.bossBeat -= dt;
    if (id === this.bossAnnounced && (this.bossBeat > 0 || !id)) return;
    this.bossAnnounced = id; this.bossBeat = 1;
    this.session.send('event', { kind: 'boss', data: id ? { id } : {} });
  }
  private drawPartnerFire(dt: number, s: PlayerWireState | null) {
    if (!s?.fi || !s.ar || s.m) { this.partnerFire = 0; return; }
    this.partnerFire -= dt; if (this.partnerFire > 0) return;
    this.partnerFire = worldGun(s.gun)?.interval ?? .12;
    if (!this.options.partnerShot || !this.avatar.muzzle(this.muzzle)) return;
    const c = Math.cos(s.pi);
    this.shotEnd.set(Math.sin(s.f) * c, Math.sin(s.pi), Math.cos(s.f) * c).multiplyScalar(60).add(this.muzzle);
    this.options.partnerShot(this.muzzle, this.shotEnd);
  }
  get partnerVisible() { return this.shown; }
  /** Where the partner is, for the maps (null when not paired). */
  get partnerPoint() { const s = this.session.paired ? this.avatar.track.latest : null; return s ? { x: s.p[0], z: s.p[2] } : null; }
  dispose() { this.session.leave(); this.avatar.dispose(); this.pings.clear(); this.options.combat.state.onLocalHit = null; }
}

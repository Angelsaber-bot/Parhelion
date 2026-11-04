import type * as THREE from 'three';
import { bilingual } from '../../../shared-client/i18n';
import type { Enemy, HitContext, Point3, WorldCombatState } from '../combat';
import { CoopSession, type CoopSocket, type CoopStatus } from './coopSession';
import { ENEMY_HZ, ENEMY_SYNC_RADIUS, STATE_HZ, WORLD_COOP_SERVER, encodeEnemy, encodeState, type EnemyWireState, type PlayerWireState } from './coopProtocol';
import { PartnerAvatar } from './partnerAvatar';

/** Most enemies one snapshot carries (nearest first); keeps a message far under the relay cap. */
export const ENEMY_SNAPSHOT_MAX = 60;

export interface CoopCombat {
  readonly state: WorldCombatState;
  remoteHit(id: string, amount: number, source: HitContext['source']): unknown;
  applyRemoteEnemies(list: EnemyWireState[]): void;
  remoteHurt(amount: number): void;
}
export interface WorldCoopOptions {
  combat: CoopCombat;
  toast(text: string): void;
  onStatus?(status: CoopStatus, detail?: string): void;
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
  return ranked.sort((a, b) => a.d - b.d).slice(0, max).map(({ e }) => encodeEnemy(e));
}

/**
 * Two-player World co-op. Each game runs its own World; the first player in a room is the host,
 * whose game moves and fights every enemy (against whichever player is nearer). The guest mirrors
 * the host's enemies, reports its own hits, and takes the hits the host's enemies land on it.
 */
export class WorldCoop {
  readonly session: CoopSession;
  readonly avatar: PartnerAvatar;
  private stateAcc = 0;
  private enemyAcc = 0;
  private shown = false;
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
  private onEvent(event: { kind: string; data?: unknown }) {
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
    if (status !== 'paired') { this.avatar.hide(); this.shown = false; }
    this.options.onStatus?.(status, detail);
  }
  /** Once per rendered frame, after the local character has animated. */
  update(dt: number, camera: THREE.Camera, local: PlayerWireState | null, localPos: Point3, now = performance.now()) {
    if (!this.session.paired) return;
    this.stateAcc += dt;
    if (local && this.stateAcc >= 1 / STATE_HZ) { this.stateAcc = Math.min(this.stateAcc - 1 / STATE_HZ, 1 / STATE_HZ); this.session.send('state', encodeState(local)); }
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
    this.avatar.update(dt, camera, now, this.partnerName);
    this.shown = !!latest;
  }
  get partnerVisible() { return this.shown; }
  dispose() { this.session.leave(); this.avatar.dispose(); this.options.combat.state.onLocalHit = null; }
}

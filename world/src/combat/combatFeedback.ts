/**
 * Moment-to-moment combat feedback layered over the core HUD:
 * - kill chains: kills within a short window chain into 连斩 ×N, and from the third link each kill
 *   restores a little health and ammo, so pressing the fight pays off;
 * - a distinct crosshair for weak-spot hits and for kills;
 * - hit-direction arcs at the screen edge pointing at whoever hit the player;
 * - a pulsing low-health vignette and heartbeat.
 * One small DOM tree, no per-event allocation beyond a fixed pool of four arcs.
 */
import * as THREE from 'three';
import { bilingual } from '../../../shared-client/i18n';
import type { Point3 } from './combat';

export const KILL_CHAIN = Object.freeze({ window: 4.5, rewardFrom: 3, heal: 5, rounds: 3, lowHp: .3 });

/** Pure chain clock: kills inside the window extend the chain; the window restarts on each kill. */
export class KillChain {
  count = 0;
  private left = 0;
  kill() { this.count = this.left > 0 ? this.count + 1 : 1; this.left = KILL_CHAIN.window; return this.count; }
  step(dt: number) { if (this.left > 0 && (this.left -= dt) <= 0) { this.left = 0; this.count = 0; } }
  reset() { this.left = 0; this.count = 0; }
  get remaining() { return this.left; }
  /** Reward for the kill that made this chain length (none for the first two links). */
  static reward(count: number) { return count >= KILL_CHAIN.rewardFrom ? { heal: KILL_CHAIN.heal, rounds: KILL_CHAIN.rounds } : null; }
}

/** Screen rotation (radians, clockwise from straight up) of an arc pointing at `from`. */
export function hurtArcAngle(from: Point3, player: Point3, forward: { x: number; z: number }) {
  const toward = Math.atan2(from.x - player.x, from.z - player.z), ahead = Math.atan2(forward.x, forward.z);
  let a = ahead - toward; while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a;
}

/** Finishing beat: a short slow-motion on a boss kill, or an elite's when no one else is still fighting.
 * Ordinary troops never trigger it, so routine fights keep their pace. */
export const FINISHER = Object.freeze({ scale: .3, boss: .9, elite: .55 });
export function finisherSeconds(fallen: { kind: string; miniboss?: string }, othersEngaged: number) {
  if (fallen.kind === 'king') return FINISHER.boss;
  return fallen.miniboss && othersEngaged === 0 ? FINISHER.elite : 0;
}

const CHAIN_NAMES: readonly (readonly [string, string])[] = [['', ''], ['', ''], ['双杀', 'DOUBLE'], ['三连斩', 'TRIPLE'], ['四连斩', 'QUAD'], ['横扫', 'RAMPAGE'], ['无双', 'UNSTOPPABLE']];

export class CombatFeedback {
  private root: HTMLElement | null = null;
  private chainEl: HTMLElement | null = null;
  private lowEl: HTMLElement | null = null;
  private failed = false;
  private readonly arcs: { el: HTMLElement | null; left: number; from: Point3 }[] = Array.from({ length: 4 }, () => ({ el: null, left: 0, from: { x: 0, y: 0, z: 0 } }));
  private readonly chain = new KillChain();
  private chainShown = 0;
  private crossFor = 0;
  private crossKind = '';
  private beat = 0;
  private lowOn = false;
  private readonly forward = new THREE.Vector3();
  constructor(private readonly cues: { chain?: (count: number) => void; heartbeat?: () => void } = {}) {}
  /** Built on first use; a minimal or missing DOM simply shows nothing (the chain logic still runs). */
  private ensure() {
    if (this.root || this.failed) return this.root;
    try {
      const root = document.createElement('div'); root.id = 'world-combat-feedback'; root.setAttribute('aria-hidden', 'true');
      const chain = document.createElement('div'); chain.className = 'cf-chain'; chain.hidden = true;
      const low = document.createElement('div'); low.className = 'cf-low';
      root.append(low, chain);
      for (const arc of this.arcs) { const el = document.createElement('i'); el.className = 'cf-arc'; el.hidden = true; root.append(el); arc.el = el; }
      document.body.append(root);
      this.chainEl = chain; this.lowEl = low; return this.root = root;
    } catch { this.failed = true; this.chainEl = this.lowEl = null; for (const a of this.arcs) a.el = null; return null; }
  }
  private safe(fn: () => void) { try { fn(); } catch { /* presentation only */ } }
  /** A kill lands: extend the chain and return the reward it earns (applied by the caller). */
  kill() {
    const count = this.chain.kill();
    this.mark('kill', .32);
    if (count >= 2) {
      const name = CHAIN_NAMES[Math.min(count, CHAIN_NAMES.length - 1)], reward = KillChain.reward(count), el = this.ensure() && this.chainEl;
      if (el) this.safe(() => {
        el.textContent = `${bilingual(...name)} ×${count}${reward ? ` · ${bilingual(`+${reward.heal} 生命 +${reward.rounds} 弹`, `+${reward.heal} HP +${reward.rounds} AMMO`)}` : ''}`;
        el.hidden = false; el.dataset.tier = String(Math.min(count, 6));
        el.classList.remove('cf-pop'); void el.offsetWidth; el.classList.add('cf-pop');
      });
      this.chainShown = 1.6; this.cues.chain?.(count);
    }
    return KillChain.reward(count);
  }
  precise() { if (this.crossKind !== 'kill' || this.crossFor <= 0) this.mark('precise', .16); }
  hurtFrom(from: Point3) {
    this.ensure();
    const slot = this.arcs.reduce((a, b) => (b.left < a.left ? b : a));
    slot.from = { x: from.x, y: from.y, z: from.z }; slot.left = .9; if (slot.el) slot.el.hidden = false;
  }
  private crosshair() { try { return document.getElementById('crosshair'); } catch { return null; } }
  private mark(kind: string, seconds: number) {
    const cross = this.crosshair();
    this.safe(() => { if (this.crossKind && this.crossKind !== kind) cross?.classList.remove(this.crossKind); cross?.classList.add(kind); });
    this.crossKind = kind; this.crossFor = seconds;
  }
  get chainCount() { return this.chain.count; }
  update(dt: number, player: Point3, hpRatio: number, active: boolean, camera?: THREE.Camera, reduced = false) {
    if (!(dt >= 0)) dt = 0;
    this.chain.step(active ? dt : 0);
    if (this.chainShown > 0 && (this.chainShown -= dt) <= 0 && this.chainEl) this.chainEl.hidden = true;
    if (this.crossFor > 0 && (this.crossFor -= dt) <= 0) { const kind = this.crossKind, cross = this.crosshair(); this.safe(() => cross?.classList.remove(kind)); this.crossKind = ''; }
    if (camera) camera.getWorldDirection(this.forward);
    for (const arc of this.arcs) {
      if (arc.left <= 0) continue;
      arc.left -= dt;
      if (arc.left <= 0 || !active) { arc.left = 0; if (arc.el) arc.el.hidden = true; continue; }
      const el = arc.el; if (!el) continue;
      const angle = hurtArcAngle(arc.from, player, this.forward);
      this.safe(() => { el.style.transform = `rotate(${angle.toFixed(3)}rad)`; el.style.opacity = String(Math.min(1, arc.left * 1.8)); });
    }
    const low = active && hpRatio > 0 && hpRatio < KILL_CHAIN.lowHp;
    if (low !== this.lowOn) { this.lowOn = low; const el = low ? this.ensure() && this.lowEl : this.lowEl; if (el) this.safe(() => { el.classList.toggle('on', low); el.classList.toggle('calm', reduced); }); }
    if (low && (this.beat -= dt) <= 0) { this.beat = .5 + hpRatio * 2.6; this.cues.heartbeat?.(); }
    if (!low) this.beat = 0;
  }
  reset() {
    this.chain.reset(); this.chainShown = 0; this.lowOn = false; this.beat = 0;
    if (this.chainEl) this.chainEl.hidden = true;
    for (const a of this.arcs) { a.left = 0; if (a.el) a.el.hidden = true; }
    const low = this.lowEl; if (low) this.safe(() => low.classList.remove('on'));
  }
  dispose() { this.safe(() => this.root?.remove()); this.root = null; }
}

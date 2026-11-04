import * as THREE from 'three';
import { bilingual } from '../../../shared-client/i18n';

/** How long a co-op ping stays on screen, in seconds. */
export const PING_SECONDS = 8;
export interface Ping { own: boolean; p: THREE.Vector3; enemyId?: string; age: number; el: HTMLElement }

/** Pinned when off screen: a point clamped to the screen edge, in normalized device coordinates. */
export function edgeClamp(x: number, y: number, behind: boolean, margin = 0.9) {
  if (behind) { x = -x; y = -y; if (Math.abs(x) < 1e-3 && Math.abs(y) < 1e-3) y = -1; }
  const k = Math.max(Math.abs(x), Math.abs(y));
  const inside = !behind && k <= margin;
  return inside ? { x, y, edge: false } : { x: x / k * margin, y: y / k * margin, edge: true };
}

/**
 * Co-op pings: a diamond and distance over a spot or an enemy, for a few seconds. Each player
 * keeps at most one ping; a new one replaces it. Pure DOM so it costs no draw calls.
 */
export class PingMarkers {
  readonly pings: Ping[] = [];
  private readonly v = new THREE.Vector3();
  add(own: boolean, p: THREE.Vector3Like, enemyId?: string) {
    const old = this.pings.findIndex(ping => ping.own === own);
    if (old >= 0) { this.pings[old].el.remove(); this.pings.splice(old, 1); }
    const el = document.createElement('div'); el.className = `hud coop-ping ${own ? 'own' : 'partner'}${enemyId ? ' enemy' : ''}`;
    document.body.append(el);
    const ping: Ping = { own, p: new THREE.Vector3(p.x, p.y, p.z), enemyId, age: 0, el };
    this.pings.push(ping); return ping;
  }
  update(dt: number, camera: THREE.Camera, from: THREE.Vector3, enemyAt: (id: string) => THREE.Vector3Like | null, partnerName: string) {
    for (let i = this.pings.length - 1; i >= 0; i--) {
      const ping = this.pings[i]; ping.age += dt;
      const follow = ping.enemyId ? enemyAt(ping.enemyId) : null;
      if (ping.enemyId && !follow) ping.age = Math.max(ping.age, PING_SECONDS - .6); // the enemy fell: fade out
      else if (follow) ping.p.set(follow.x, follow.y + 2.2, follow.z);
      if (ping.age >= PING_SECONDS) { ping.el.remove(); this.pings.splice(i, 1); continue; }
      this.v.copy(ping.p).project(camera);
      const at = edgeClamp(this.v.x, this.v.y, this.v.z > 1);
      const who = ping.own ? bilingual('我的标记', 'My ping') : bilingual(`${partnerName}的标记`, `${partnerName}'s ping`);
      const what = ping.enemyId ? bilingual(' · 敌人', ' · Enemy') : '';
      const text = `◆ ${who}${what} · ${Math.round(ping.p.distanceTo(from))} m`;
      if (ping.el.textContent !== text) ping.el.textContent = text;
      ping.el.classList.toggle('edge', at.edge);
      ping.el.style.opacity = String(Math.min(1, (PING_SECONDS - ping.age) / .6));
      ping.el.style.transform = `translate(${((at.x + 1) / 2 * innerWidth).toFixed(0)}px, ${((1 - at.y) / 2 * innerHeight).toFixed(0)}px) translate(-50%, -100%)`;
    }
  }
  clear() { for (const ping of this.pings) ping.el.remove(); this.pings.length = 0; }
}

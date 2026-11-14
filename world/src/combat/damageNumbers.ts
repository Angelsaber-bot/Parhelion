/**
 * World-space damage numbers: each landed hit pops a number over the enemy it struck, coloured by
 * how it landed (blade, rifle, skill, counter, punish, shield block), rising and fading in under a
 * second. One small pool of DOM labels positioned by projection; nothing is created per hit.
 */
import * as THREE from 'three';

export type DamageKind = 'melee' | 'ranged' | 'skill' | 'servant' | 'ultimate' | 'counter' | 'punish' | 'blocked' | 'precise';
interface Label { el: HTMLElement; p: THREE.Vector3; age: number; life: number; drift: number; stack: number; on: boolean }

const POOL = 24, LIFE = .85;
const scratch = new THREE.Vector3();

/** How a hit reads, most important first: a punish beats a counter, a block beats both. */
export function damageKind(hit: { source?: string; punish?: boolean; counter?: boolean; blocked?: boolean; precise?: boolean }): DamageKind {
  if (hit.blocked) return 'blocked';
  if (hit.punish) return 'punish';
  if (hit.counter) return 'counter';
  if (hit.precise) return 'precise';
  const s = hit.source;
  return s === 'melee' || s === 'ranged' || s === 'skill' || s === 'servant' || s === 'ultimate' ? s : 'melee';
}

export class DamageNumbers {
  private root: HTMLElement | null = null;
  private readonly labels: Label[] = [];
  private next = 0;
  private failed = false;

  private ensure() {
    if (this.root || this.failed) return this.root;
    try {
      const root = document.createElement('div'); root.id = 'world-damage-numbers'; root.setAttribute('aria-hidden', 'true');
      for (let i = 0; i < POOL; i++) {
        const el = document.createElement('b'); el.hidden = true; root.append(el);
        this.labels.push({ el, p: new THREE.Vector3(), age: 0, life: LIFE, drift: 0, stack: 0, on: false });
      }
      document.body.append(root);
      return this.root = root;
    } catch { this.failed = true; this.labels.length = 0; return null; } // a minimal DOM simply shows none
  }

  add(at: THREE.Vector3, damage: number, kind: DamageKind) {
    if (!this.ensure() || !(damage > 0)) return;
    // quick follow-ups on the same target stack upwards instead of printing over each other
    const stack = this.labels.filter(l => l.on && l.age < .35 && l.p.distanceToSquared(at) < 1).length;
    const label = this.labels[this.next]; this.next = (this.next + 1) % this.labels.length;
    label.stack = Math.min(4, stack);
    label.p.copy(at); label.age = 0; label.on = true; label.drift = (Math.random() - .5) * 46;
    label.life = kind === 'punish' || kind === 'counter' || kind === 'precise' ? LIFE * 1.2 : LIFE;
    label.el.className = `dn-${kind}${damage >= 30 ? ' dn-heavy' : ''}`;
    label.el.textContent = kind === 'blocked' ? `${Math.round(damage)}` : String(Math.round(damage));
    label.el.hidden = false;
  }

  update(dt: number, camera: THREE.Camera | undefined, width: number, height: number) {
    if (!this.root) return;
    for (const l of this.labels) {
      if (!l.on) continue;
      l.age += dt;
      const t = l.age / l.life;
      if (t >= 1 || !camera) { l.on = false; l.el.hidden = true; continue; }
      scratch.copy(l.p).project(camera);
      if (scratch.z > 1 || scratch.z < -1) { l.el.style.opacity = '0'; continue; }
      const x = (scratch.x * .5 + .5) * width + l.drift * Math.min(1, t * 3), y = (-scratch.y * .5 + .5) * height - 46 * Math.sqrt(t) - l.stack * 24;
      // pop in (overshoot), hold, then fade
      const scale = t < .12 ? .6 + t / .12 * .65 : t < .22 ? 1.25 - (t - .12) / .1 * .25 : 1;
      l.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%) scale(${scale.toFixed(3)})`;
      l.el.style.opacity = String(t < .7 ? 1 : 1 - (t - .7) / .3);
    }
  }

  clear() { for (const l of this.labels) { l.on = false; l.el.hidden = true; } }
  dispose() { this.root?.remove(); this.root = null; this.labels.length = 0; }
}

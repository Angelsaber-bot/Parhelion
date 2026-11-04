import * as THREE from 'three';
import { loadSkinnedCharacter, SkinnedCharacterAnimator, type SkinnedCharacterRig } from '../skinnedCharacter';
import { attachExplorerRifle } from '../weaponArt';
import { attachExplorerBlade } from '../playerBladeArt';
import type { PlayerWireState } from './coopProtocol';

/** How far behind the newest state the partner is drawn, so two samples always bracket it. */
export const PARTNER_DELAY_MS = 110;
interface Sample { at: number; s: PlayerWireState }

const angleLerp = (a: number, b: number, t: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;

/** Buffered interpolation of the partner's pose; pure so it is testable without WebGL. */
export class PartnerTrack {
  private samples: Sample[] = [];
  push(s: PlayerWireState, at: number) {
    // A large jump (travel, respawn) snaps instead of sliding across the map.
    const last = this.samples.at(-1);
    if (last && Math.hypot(s.p[0] - last.s.p[0], s.p[2] - last.s.p[2]) > 25) this.samples = [];
    this.samples.push({ at, s }); if (this.samples.length > 8) this.samples.shift();
  }
  get latest() { return this.samples.at(-1)?.s ?? null; }
  sample(now: number): PlayerWireState | null {
    const n = this.samples.length; if (!n) return null;
    const t = now - PARTNER_DELAY_MS;
    if (n === 1 || t <= this.samples[0].at) return this.samples[0].s;
    for (let i = n - 1; i > 0; i--) {
      const a = this.samples[i - 1], b = this.samples[i];
      if (t >= a.at) {
        if (t >= b.at) return b.s; // starved: hold the newest instead of extrapolating
        const k = (t - a.at) / Math.max(1, b.at - a.at);
        return { ...b.s, p: [a.s.p[0] + (b.s.p[0] - a.s.p[0]) * k, a.s.p[1] + (b.s.p[1] - a.s.p[1]) * k, a.s.p[2] + (b.s.p[2] - a.s.p[2]) * k],
          f: angleLerp(a.s.f, b.s.f, k), v: a.s.v + (b.s.v - a.s.v) * k, a: a.s.a + (b.s.a - a.s.a) * k, pi: a.s.pi + (b.s.pi - a.s.pi) * k,
          m: b.s.m && a.s.m && a.s.m[1] === b.s.m[1] ? [a.s.m[0] + (b.s.m[0] - a.s.m[0]) * k, b.s.m[1], b.s.m[2]] : b.s.m };
      }
    }
    return this.samples[n - 1].s;
  }
  clear() { this.samples = []; }
}

/** The partner's character: the same authored player model, its equipped gun and melee weapon. */
export class PartnerAvatar {
  readonly track = new PartnerTrack();
  rig: SkinnedCharacterRig | null = null;
  private anim: SkinnedCharacterAnimator | null = null;
  private rifle: ReturnType<typeof attachExplorerRifle> | null = null;
  private blade: ReturnType<typeof attachExplorerBlade> | null = null;
  private gunId = ''; private meleeId = '';
  private disposed = false; private loading: Promise<void> | null = null;
  private readonly label: HTMLElement;
  private readonly projected = new THREE.Vector3();
  constructor(private readonly scene: THREE.Scene, private readonly renderer: THREE.WebGLRenderer, private readonly outlines = true) {
    this.label = document.createElement('div'); this.label.id = 'coop-partner-tag'; this.label.className = 'hud'; this.label.hidden = true;
    document.body.append(this.label);
  }
  private ensure() {
    this.loading ??= loadSkinnedCharacter({ outlines: this.outlines }).then(rig => {
      if (this.disposed) { rig.dispose(); return; }
      this.rig = rig; rig.root.name = 'CoopPartner'; rig.root.visible = false;
      this.anim = new SkinnedCharacterAnimator(rig); this.scene.add(rig.root);
    }).catch(error => { console.warn('Co-op partner model failed to load.', error); });
    return this.loading;
  }
  private equip(s: PlayerWireState) {
    const rig = this.rig; if (!rig) return;
    if (s.gun !== this.gunId) { this.gunId = s.gun; this.rifle?.dispose(); this.rifle = attachExplorerRifle(rig, this.renderer, undefined, s.gun); this.rifle.ready.catch(() => {}); }
    if (s.mel !== this.meleeId) { this.meleeId = s.mel; this.blade?.dispose(); this.blade = attachExplorerBlade(rig, undefined, s.mel); this.blade.ready.catch(() => {}); }
  }
  receive(s: PlayerWireState, now = performance.now()) { this.track.push(s, now); void this.ensure(); }
  update(dt: number, camera: THREE.Camera, now = performance.now(), label = '') {
    const rig = this.rig, anim = this.anim, s = this.track.sample(now);
    if (!rig || !anim || !s) { this.label.hidden = true; return; }
    this.equip(s);
    rig.root.visible = true; rig.root.position.set(s.p[0], s.p[1], s.p[2]);
    rig.joints.Gun.visible = !!s.ar;
    anim.update(dt, { speed: s.v, onGround: !!s.g, swimming: !!s.sw, gliding: !!s.gl, vy: 0, moveYaw: s.f, armed: !!s.ar, aim: s.a, pitch: s.pi,
      firing: !!s.fi && !s.m, lookYaw: s.f, melee: s.m ? { phase: s.m[0], combo: s.m[1], yaw: s.f, style: s.m[2] } : undefined });
    this.blade?.update(!!s.m);
    // Name and health above the head, hidden behind the camera.
    this.projected.set(s.p[0], s.p[1] + 2.05, s.p[2]).project(camera);
    const onScreen = this.projected.z < 1 && Math.abs(this.projected.x) < 1.1 && Math.abs(this.projected.y) < 1.1;
    this.label.hidden = !onScreen;
    if (onScreen) {
      const text = `${label} · ${Math.round(s.hp)}/${Math.round(s.max)}`;
      if (this.label.textContent !== text) this.label.textContent = text;
      this.label.style.transform = `translate(${((this.projected.x + 1) / 2 * innerWidth).toFixed(0)}px, ${((1 - this.projected.y) / 2 * innerHeight).toFixed(0)}px) translate(-50%, -100%)`;
    }
  }
  /** The partner's rifle muzzle in world space, once their gun art is up. */
  muzzle(out: THREE.Vector3) { return this.rig?.root.visible && this.rifle ? this.rifle.muzzleWorld(out) : null; }
  hide() { if (this.rig) this.rig.root.visible = false; this.label.hidden = true; this.track.clear(); }
  dispose() {
    this.disposed = true; this.rifle?.dispose(); this.blade?.dispose(); this.label.remove();
    if (this.rig) { this.rig.root.removeFromParent(); this.rig.dispose(); this.rig = null; }
  }
}

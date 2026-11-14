import * as THREE from 'three';

/**
 * A short in-engine story shot for chapter completions: letterbox bars close in, the camera eases out
 * of third person into a slow orbit around the place the chapter closed, the chapter's last line runs
 * as a subtitle, then the camera eases back. It never takes control away (any key skips it) and only
 * blends the camera after the normal third-person camera has been placed each frame.
 */
export const STORY_SHOT = Object.freeze({ blendIn: .6, hold: 2.6, blendOut: .5, radius: 9, height: 4, sweep: .7 });
const smooth = (t: number) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };

/** Camera weight for a shot `t` seconds in: eases to 1, holds, eases back to 0. */
export function storyShotWeight(t: number) {
  const { blendIn, hold, blendOut } = STORY_SHOT;
  if (!(t >= 0) || t >= blendIn + hold + blendOut) return 0;
  return t < blendIn ? smooth(t / blendIn) : t < blendIn + hold ? 1 : 1 - smooth((t - blendIn - hold) / blendOut);
}

export class StoryBeatShot {
  private t = Infinity;
  private readonly focus = new THREE.Vector3();
  private startYaw = 0;
  private radius: number = STORY_SHOT.radius;
  private readonly pos = new THREE.Vector3();
  private readonly look = new THREE.Quaternion();
  private readonly helper = new THREE.Object3D();
  private dom: { top: HTMLElement; bottom: HTMLElement; line: HTMLElement } | null = null;
  private failed = false;
  private readonly skipKey = () => { if (this.active) this.t = Math.max(this.t, STORY_SHOT.blendIn + STORY_SHOT.hold); };
  constructor() { try { addEventListener('keydown', this.skipKey); } catch { /* no window in tests */ } }
  get active() { return this.t < STORY_SHOT.blendIn + STORY_SHOT.hold + STORY_SHOT.blendOut; }
  private ensure() {
    if (this.dom || this.failed) return this.dom;
    try {
      const bar = (edge: 'top' | 'bottom') => { const el = document.createElement('div'); el.className = `story-shot-bar story-shot-${edge}`; document.body.append(el); return el; };
      const line = document.createElement('div'); line.className = 'story-shot-line'; document.body.append(line);
      return this.dom = { top: bar('top'), bottom: bar('bottom'), line };
    } catch { this.failed = true; return null; }
  }
  /** Begin a shot around `focus`, starting near the camera's current heading. `blocked(from, to)` reports
   * geometry between two points: the orbit takes the first angle and distance whose whole sweep can see
   * the focus, so the camera never ends up inside a wall. */
  start(focus: THREE.Vector3, line: string, camera: THREE.Camera, blocked?: (from: THREE.Vector3, to: THREE.Vector3) => boolean) {
    this.focus.copy(focus); this.t = 0;
    const dir = new THREE.Vector3().subVectors(camera.position, focus), base = Math.atan2(dir.x, dir.z), eye = new THREE.Vector3(), target = new THREE.Vector3(focus.x, focus.y + 1.2, focus.z);
    const at = (yaw: number, r: number) => eye.set(focus.x + Math.sin(yaw) * r, focus.y + STORY_SHOT.height * r / STORY_SHOT.radius, focus.z + Math.cos(yaw) * r);
    this.startYaw = base; this.radius = STORY_SHOT.radius;
    if (blocked) search: for (const r of [STORY_SHOT.radius, 6.5, 4.5]) for (const off of [0, .6, -.6, 1.2, -1.2, 1.8, -1.8, Math.PI]) {
      const yaw = base + off;
      if ([0, .5, 1].every(k => !blocked(at(yaw + STORY_SHOT.sweep * k, r).clone(), target))) { this.startYaw = yaw; this.radius = r; break search; }
    }
    const dom = this.ensure(); if (dom) dom.line.textContent = line;
  }
  skip() { this.skipKey(); }
  /** Blend the already-placed gameplay camera toward the shot. Returns whether a shot is running. */
  update(dt: number, camera: THREE.Camera) {
    if (!this.active) { this.paint(0); return false; }
    this.t += Math.max(0, dt);
    const w = storyShotWeight(this.t), yaw = this.startYaw + STORY_SHOT.sweep * Math.min(1, this.t / (STORY_SHOT.blendIn + STORY_SHOT.hold));
    this.pos.set(this.focus.x + Math.sin(yaw) * this.radius, this.focus.y + STORY_SHOT.height * this.radius / STORY_SHOT.radius, this.focus.z + Math.cos(yaw) * this.radius);
    this.helper.position.copy(this.pos); this.helper.lookAt(this.focus.x, this.focus.y + 1.2, this.focus.z);
    // Object3D.lookAt points +Z at the target; a camera looks down −Z, so turn half a revolution.
    this.look.copy(this.helper.quaternion).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI));
    camera.position.lerp(this.pos, w); camera.quaternion.slerp(this.look, w); camera.updateMatrixWorld();
    this.paint(w);
    return this.active;
  }
  private paint(w: number) {
    const dom = this.dom; if (!dom) return;
    try { document.body.classList.toggle('story-shot-on', w > .05); dom.top.style.transform = `translateY(${(w - 1) * 100}%)`; dom.bottom.style.transform = `translateY(${(1 - w) * 100}%)`; dom.line.style.opacity = String(Math.max(0, w * 1.4 - .4)); } catch { /* minimal DOM */ }
  }
  dispose() { try { removeEventListener('keydown', this.skipKey); } catch { /* none */ } if (this.dom) { this.dom.top.remove(); this.dom.bottom.remove(); this.dom.line.remove(); } }
}

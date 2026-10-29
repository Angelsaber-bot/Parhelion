// Presentation-only motion filters. No authoritative movement, aim or combat values are changed.
import type { Vec3 } from '../shared/map.ts';

export const motionDt = (dt: number) => Number.isFinite(dt) ? Math.max(0, Math.min(.1, dt)) : 0;
export const motionBlend = (dt: number, rate: number) => 1 - Math.exp(-motionDt(dt) * rate);

/** Samples interpolated displacement, rejecting spawn/teleport and suspended-tab discontinuities. */
export class AvatarMotion {
  private last: Vec3 | null = null;
  private vx = 0;
  private vz = 0;
  readonly state = { speed: 0, vy: 0, forward: 0, strafe: 0, discontinuity: false };

  reset() {
    this.last = null;
    this.vx = this.vz = 0;
    Object.assign(this.state, { speed: 0, vy: 0, forward: 0, strafe: 0, discontinuity: false });
  }

  sample(pos: Vec3, yaw: number, dt: number) {
    const previous = this.last;
    const elapsed = motionDt(dt);
    const dx = previous ? pos[0] - previous[0] : 0;
    const dy = previous ? pos[1] - previous[1] : 0;
    const dz = previous ? pos[2] - previous[2] : 0;
    // The dash can cover ~2.6 m; a large per-frame relocation is not a sprint animation.
    const discontinuity = !!previous && (dt > .25 || Math.hypot(dx, dy, dz) > Math.max(1.2, elapsed * 32));
    if (discontinuity) this.reset();
    if (previous && !discontinuity && elapsed > 0) {
      const blend = motionBlend(elapsed, 12);
      const speed = Math.hypot(dx, dz) / dt;
      const scale = speed > 12 ? 12 / speed : 1;
      this.vx += (dx / dt * scale - this.vx) * blend;
      this.vz += (dz / dt * scale - this.vz) * blend;
      this.state.vy += (Math.max(-20, Math.min(20, dy / dt)) - this.state.vy) * blend;
    }
    if (!this.last) this.last = [pos[0], pos[1], pos[2]];
    else { this.last[0] = pos[0]; this.last[1] = pos[1]; this.last[2] = pos[2]; }
    const c = Math.cos(yaw), s = Math.sin(yaw);
    this.state.speed = Math.hypot(this.vx, this.vz);
    this.state.forward = -s * this.vx - c * this.vz;
    this.state.strafe = c * this.vx - s * this.vz;
    this.state.discontinuity = discontinuity;
    return this.state;
  }
}

/** Fade the weapon's walking envelope rather than snapping the bob to zero on stop/jump. */
export class ViewmodelStride {
  phase = 0;
  weight = 0;

  reset() { this.phase = this.weight = 0; }

  update(dt: number, moving: number) {
    const target = Number.isFinite(moving) ? Math.max(0, Math.min(1, moving)) : 0;
    const elapsed = motionDt(dt), rate = target > this.weight ? 10 : 14;
    const blend = motionBlend(elapsed, rate), previous = this.weight;
    this.weight += (target - previous) * blend;
    // Integrate the exponential envelope exactly, so 30/60/144 Hz have the same phase.
    const travel = target * elapsed + (previous - target) * blend / rate;
    this.phase = (this.phase + travel * 9) % (Math.PI * 2);
  }
}

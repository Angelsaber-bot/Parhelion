/** Deterministic three-beat close-range combo. Input queues one next cut, never damage. */
export const MELEE_BEATS = [
  { duration: .50, contact: .19, queueAt: .24, damage: 30, range: 1.45, halfWidth: .75 },
  { duration: .54, contact: .22, queueAt: .25, damage: 34, range: 1.50, halfWidth: .85 },
  { duration: .72, contact: .31, queueAt: .40, damage: 48, range: 1.55, halfWidth: .95 },
] as const;
export interface MeleeContact { combo: number; damage: number; range: number; halfWidth: number; yaw: number }
export class PlayerMelee {
  private beat = -1;
  private elapsed = 0;
  private queued = false;
  private delivered = false;
  private heading = 0;
  private recovery = 0;
  get active() { return this.beat >= 0; }
  get combo() { return Math.max(0, this.beat); }
  get yaw() { return this.heading; }
  get phase() { return this.active ? Math.min(1, this.elapsed / MELEE_BEATS[this.beat].duration) : 0; }
  get cooldown() { return this.recovery; }
  press(yaw: number) {
    if (!Number.isFinite(yaw)) return false;
    if (this.active) {
      if (this.beat >= 2 || this.elapsed < MELEE_BEATS[this.beat].queueAt) return false;
      this.queued = true; return true;
    }
    if (this.recovery > 0) return false;
    this.beat = 0; this.elapsed = 0; this.queued = this.delivered = false; this.heading = yaw;
    return true;
  }
  update(dt: number, enabled: boolean): MeleeContact | null {
    if (!enabled) { this.cancel(); return null; }
    if (!Number.isFinite(dt) || dt <= 0) return null;
    dt = Math.min(.1, dt);
    this.recovery = Math.max(0, this.recovery - dt);
    if (!this.active) return null;
    this.elapsed += dt;
    const spec = MELEE_BEATS[this.beat];
    let hit: MeleeContact | null = null;
    if (!this.delivered && this.elapsed >= spec.contact) {
      this.delivered = true;
      hit = { combo: this.beat, damage: spec.damage, range: spec.range, halfWidth: spec.halfWidth, yaw: this.heading };
    }
    if (this.elapsed >= spec.duration) {
      if (this.queued && this.beat < 2) { this.beat++; this.elapsed = 0; this.queued = this.delivered = false; }
      else { this.beat = -1; this.elapsed = 0; this.queued = false; this.recovery = .14; }
    }
    return hit;
  }
  cancel() { if (this.active) this.recovery = Math.max(this.recovery, .14); this.beat = -1; this.elapsed = 0; this.queued = this.delivered = false; }
  reset() { this.cancel(); this.recovery = 0; this.heading = 0; }
}

/** Short collision-resolved evade, not a teleport. Root feeds velocity through Player.step. */
export class PlayerEvade {
  remaining = 0; cooldown = 0;
  x = 0; z = 0;
  get active() { return this.remaining > 0; }
  start(x: number, z: number) {
    const length = Math.hypot(x, z);
    if (this.active || this.cooldown > 0 || !Number.isFinite(length) || length < .001) return false;
    this.x = x / length; this.z = z / length; this.remaining = .24; this.cooldown = 1.25; return true;
  }
  update(dt: number, enabled: boolean) {
    if (!enabled) { this.remaining = 0; return; }
    if (!Number.isFinite(dt) || dt <= 0) return;
    dt = Math.min(.1, dt);
    this.remaining = Math.max(0, this.remaining - dt); this.cooldown = Math.max(0, this.cooldown - dt);
  }
  reset() { this.remaining = this.cooldown = this.x = this.z = 0; }
}

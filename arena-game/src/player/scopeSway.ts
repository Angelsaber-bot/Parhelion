/** Scoped-rifle sway with a held breath, in the style of modern shooters. The drift is applied
 * to the real view (and therefore the shot), so what the reticle shows is what you hit.
 * Holding breath steadies it for a few seconds; running out costs a short, heavier sway. */
export const SWAY = {
  sniper: .0065, dmr: .0032, // radians of drift at rest
  hz: .32, // figure-eight rate
  breath: 4, // seconds a full breath can be held
  gasp: 1.6, // seconds of heavy sway after running out
  regen: .55, // breath regained per second when not holding
  held: .08, moving: 2.2, airborne: 3, crouched: .6, gasping: 2.2,
};
export interface SwayInput { scoped: boolean; sniper: boolean; wantHold: boolean; moving: boolean; airborne: boolean; crouched: boolean }

export class ScopeSway {
  stamina = 1;
  gasp = 0;
  holding = false;
  amp = 0;
  private t = 0;
  private last: [number, number] = [0, 0];
  reset() { this.stamina = 1; this.gasp = 0; this.holding = false; this.amp = 0; this.t = 0; this.last = [0, 0]; }
  /** Returns the change in [yaw, pitch] to add this frame. */
  update(dt: number, o: SwayInput): [number, number] {
    if (!(dt > 0) || !Number.isFinite(dt)) return [0, 0];
    dt = Math.min(dt, .1);
    this.holding = o.scoped && o.wantHold && this.stamina > 0 && this.gasp <= 0;
    if (this.holding) {
      this.stamina = Math.max(0, this.stamina - dt / SWAY.breath);
      if (this.stamina === 0) { this.gasp = SWAY.gasp; this.holding = false; }
    } else {
      this.gasp = Math.max(0, this.gasp - dt);
      if (!o.wantHold || !o.scoped) this.stamina = Math.min(1, this.stamina + dt * SWAY.regen);
    }
    let target = 0;
    if (o.scoped) {
      target = (o.sniper ? SWAY.sniper : SWAY.dmr) * (o.moving ? SWAY.moving : 1) * (o.airborne ? SWAY.airborne : 1) * (o.crouched ? SWAY.crouched : 1);
      if (this.holding) target *= SWAY.held; else if (this.gasp > 0) target *= SWAY.gasping;
    }
    this.amp += (target - this.amp) * Math.min(1, dt * 4);
    this.t += dt;
    const w = this.t * SWAY.hz * Math.PI * 2, x = Math.sin(w) * this.amp, y = Math.sin(w * 2 + .6) * this.amp * .55;
    const delta: [number, number] = [x - this.last[0], y - this.last[1]];
    this.last = [x, y];
    return delta;
  }
}

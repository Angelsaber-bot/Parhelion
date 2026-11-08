/** Small, visual-only weight transfers. Never moves the controller/root, changes a hit
 * clock, or asks the camera to shake. Explicit reset prevents a respawn landing kick. */
export interface PlayerInertiaInput {
  onGround: boolean; swimming: boolean; gliding?: boolean; flying?: boolean;
  vy: number; speed: number; turnRate: number; lockedUpperBody: boolean;
  /** Exponential heading-response rate, if turnRate is the frame average. */
  turnDecay?: number;
}
export interface PlayerInertiaFrame { compression: number; turn: number; ascent: number; descent: number; gather: number }
const finite = (n: number) => Number.isFinite(n) ? n : 0;
export class PlayerInertia {
  private airborne = false;
  private fallSpeed = 0;
  private jumpAge = 0;
  private jumped = false;
  private gather = 0;
  private compression = 0;
  private compressionVelocity = 0;
  private turn = 0;
  private vertical = 0;
  private readonly frame: PlayerInertiaFrame = { compression: 0, turn: 0, ascent: 0, descent: 0, gather: 0 };
  reset() { this.airborne = false; this.jumped=false;this.jumpAge=this.gather=0; this.fallSpeed = this.compression = this.compressionVelocity = this.turn = this.vertical = 0; }
  update(dt: number, state: PlayerInertiaInput): PlayerInertiaFrame {
    dt = Number.isFinite(dt) ? Math.max(0, Math.min(.1, dt)) : 0;
    const controlled = state.swimming || state.gliding || state.flying;
    const airborne = !state.onGround && !controlled;
    if (dt > 0) {
      // Only a real unsupported->supported edge lands. Querying muzzle pose at dt=0
      // cannot trigger an impact or consume a pending airborne sample.
      if (this.airborne && state.onGround && !controlled) {
        const impulse=Math.min(2.4,Math.max(0,this.fallSpeed-1)*.24);
        // Bound even pathological repeated support edges to a 6 cm load budget.
        this.compressionVelocity=Math.min(this.compressionVelocity+impulse,Math.max(0,.06-this.compression)*16*Math.E);
      }
      if(airborne&&!this.airborne){this.jumped=finite(state.vy)>1;this.jumpAge=0;}
      this.jumpAge=airborne?this.jumpAge+dt:0;if(!airborne)this.jumped=false;
      if (airborne) this.fallSpeed = Math.max(0, -finite(state.vy));
      else this.fallSpeed = 0;
      this.airborne = airborne;
      // Closed-form critically damped spring: identical contact ages at 30/60/120 Hz.
      // No overshoot/rebound: the hips absorb weight, then settle rather than pogo.
      const omega = 16, c = this.compressionVelocity + omega * this.compression;
      const decay = Math.exp(-omega * dt);
      this.compression = (this.compression + c * dt) * decay;
      this.compressionVelocity = (this.compressionVelocity - omega * c * dt) * decay;
      if (controlled) this.compression *= Math.exp(-20 * dt);
      const allowed=state.onGround&&!controlled&&!state.lockedUpperBody;
      const decayRate=Math.max(0,finite(state.turnDecay??0));
      // The player heading itself decays exponentially. Filtering a frame-average
      // yaw rate as a constant introduces frame-rate drift; integrate that signal,
      // splitting exactly where the bounded lean exits its saturated interval.
      const scale=Math.min(9,Math.max(0,finite(state.speed)))*.0025;
      const average=allowed?finite(state.turnRate)*scale:0;
      const initial=decayRate>0?average*decayRate*dt/(1-Math.exp(-decayRate*dt)):average;
      if(Math.abs(initial)>.07){
        const saturated=decayRate>0?Math.min(dt,Math.log(Math.abs(initial)/.07)/decayRate):dt;
        this.integrateTurn(Math.sign(initial)*.07,saturated,0);
        if(saturated<dt)this.integrateTurn(Math.sign(initial)*.07,dt-saturated,decayRate);
      }else this.integrateTurn(initial,dt,decayRate);
      const vertical = airborne ? Math.max(-12, Math.min(12, finite(state.vy))) : 0;
      this.vertical += (vertical - this.vertical) * (1 - Math.exp(-12 * dt));
      this.gather=airborne?(this.jumped?(1-Math.exp(-12*this.jumpAge))*(1-Math.max(0,Math.min(1,-this.vertical/7))):0):this.gather*Math.exp(-12*dt);
    }
    this.frame.compression=Math.max(0,this.compression);this.frame.turn=this.turn;
    this.frame.ascent=Math.max(0,Math.min(1,this.vertical/6));this.frame.descent=Math.max(0,Math.min(1,-this.vertical/7));
    // A jump gathers toward apex, rather than extending too soon merely because
    // upward speed is falling. Walking off an edge never fabricates a jump tuck.
    this.frame.gather=this.gather;
    return this.frame;
  }
  private integrateTurn(input:number,duration:number,rate:number) {
    const e=Math.exp(-10*duration);
    if(rate===0)this.turn=this.turn*e+input*(1-e);
    else if(Math.abs(rate-10)<1e-8)this.turn=(this.turn+10*input*duration)*e;
    else this.turn=this.turn*e+10*input*(Math.exp(-rate*duration)-e)/(10-rate);
  }

}

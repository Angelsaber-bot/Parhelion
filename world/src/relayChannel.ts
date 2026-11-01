/** One local encounter interaction; this does not retime combat, input or animation. */
export const RELAY_CHANNEL_SECONDS = 3;
export type RelayChannelInterrupt = 'released' | 'movement' | 'hurt' | 'attack' | 'unavailable' | 'out-of-range';
export interface RelayChannelFrame {
  dt: number;
  held: boolean;
  active: boolean;
  playable: boolean;
  inRange: boolean;
  grounded: boolean;
  moving: boolean;
  attacking: boolean;
  damageRevision: number;
}
export class RelayChannel {
  private elapsed = 0;
  private releaseRequired = true;
  private finished = false;
  private damageRevision = 0;
  get progress() { return this.elapsed / RELAY_CHANNEL_SECONDS; }
  get requiresRelease() { return this.releaseRequired; }
  reset(damageRevision = 0) {
    this.elapsed = 0; this.releaseRequired = true; this.finished = false;
    this.damageRevision = damageRevision;
  }
  update(frame: RelayChannelFrame): { completedNow: boolean; interrupted: RelayChannelInterrupt | null; progress: number } {
    const result = (interrupted: RelayChannelInterrupt | null = null, completedNow = false) => ({ completedNow, interrupted, progress: this.progress });
    if (this.finished) return result();
    const hurt = !Number.isFinite(frame.damageRevision) || frame.damageRevision !== this.damageRevision;
    if (Number.isFinite(frame.damageRevision)) this.damageRevision = frame.damageRevision;
    const reason: RelayChannelInterrupt | null = hurt ? 'hurt'
      : !frame.active || !frame.playable || !frame.grounded ? 'unavailable'
      : frame.attacking ? 'attack' : frame.moving ? 'movement'
      : !frame.inRange ? 'out-of-range' : !frame.held ? 'released' : null;
    // Invalid conditions win even on the would-be completion frame. Holding a key
    // through damage, a menu or a wall-blocked movement cannot restart a channel.
    if (reason) {
      const hadProgress = this.elapsed > 0;
      this.elapsed = 0;
      this.releaseRequired = frame.held;
      return result(hadProgress ? reason : null);
    }
    if (this.releaseRequired || !Number.isFinite(frame.dt) || frame.dt <= 0) return result();
    // Never turn a resumed/background frame into three seconds of free capture.
    this.elapsed = Math.min(RELAY_CHANNEL_SECONDS, this.elapsed + Math.min(frame.dt, .05));
    if (this.elapsed + 1e-9 >= RELAY_CHANNEL_SECONDS) {
      this.elapsed = RELAY_CHANNEL_SECONDS; this.finished = true;
      return result(null, true);
    }
    return result();
  }
}

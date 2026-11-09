import { COMPANION_MOTION } from '../characters/companionMotion';

/** Travel catch-up is separate from combat pursuit and authored attack timing. */
export class CompanionFollow {
  private returning = false;
  private lastPlayer?: { x: number; z: number };
  private travellingFor = 0;
  get prioritizePlayer() { return this.returning || this.travellingFor > 0; }
  reset() { this.returning = false; this.lastPlayer = undefined; this.travellingFor = 0; }
  update(separation: number, player: { x: number; z: number }, dt: number) {
    if (dt > 0) {
      this.travellingFor = Math.max(0, this.travellingFor - dt);
      if (this.lastPlayer && Math.hypot(player.x - this.lastPlayer.x, player.z - this.lastPlayer.z) / dt > 4) this.travellingFor = .25;
      this.lastPlayer = { x: player.x, z: player.z };
    }
    // Hysteresis keeps a nearby enemy from immediately pulling a returning ally away again.
    this.returning = separation > (this.returning ? 4 : 8);
  }
  speed(separation: number, normalSpeed: number) {
    const catchUp = Math.max(0, Math.min(1, (separation - 4) / 4));
    return normalSpeed + (COMPANION_MOTION.catchUpSpeed - normalSpeed) * catchUp;
  }
}

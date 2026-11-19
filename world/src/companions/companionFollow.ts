import { COMPANION_MOTION } from '../characters/companionMotion';

/** How far a companion may fight from the player before it breaks off, and where it re-engages after. */
export const COMBAT_LEASH = Object.freeze({ out: 18, back: 10, travel: 12, travelSeconds: 1.2, sprint: 7.2 });

/** Travel catch-up is separate from combat pursuit and authored attack timing.
 *
 * Out of combat the companion stays close (8 m out, 4 m back). In a fight it used to obey the same leash and a
 * "player is moving" flag that any run or strafe faster than 4 m/s raised for a quarter second, so a servant
 * fighting 10 m away from a rifle-armed player dropped every attack and ran back. While an enemy is engaged it
 * now holds a wider leash. Walking, strafing and kiting (5.5 m/s) keep it fighting; a sprint, or walking steadily
 * away until the gap passes 12 m, still means the player has left and it follows. */
export class CompanionFollow {
  private returning = false;
  private lastPlayer?: { x: number; z: number };
  private travellingFor = 0;
  private movingFor = 0;
  private sprintingFor = 0;
  private engaged = false;
  private separation = 0;
  get prioritizePlayer() {
    if (this.returning) return true;
    if (!this.engaged) return this.travellingFor > 0;
    return this.sprintingFor > 0 || (this.movingFor > COMBAT_LEASH.travelSeconds && this.separation > COMBAT_LEASH.travel);
  }
  reset() { this.returning = false; this.lastPlayer = undefined; this.travellingFor = 0; this.movingFor = 0; this.sprintingFor = 0; this.engaged = false; this.separation = 0; }
  /** `engaged`: an enemy within reach of the player is (or could be) this companion's target. */
  update(separation: number, player: { x: number; z: number }, dt: number, engaged = false) {
    if (dt > 0) {
      this.travellingFor = Math.max(0, this.travellingFor - dt);
      this.sprintingFor = Math.max(0, this.sprintingFor - dt);
      const speed = this.lastPlayer ? Math.hypot(player.x - this.lastPlayer.x, player.z - this.lastPlayer.z) / dt : 0, moving = speed > 4;
      if (moving) this.travellingFor = .25;
      if (speed > COMBAT_LEASH.sprint) this.sprintingFor = .25;
      this.movingFor = moving ? this.movingFor + dt : Math.max(0, this.movingFor - dt * 2);
      this.lastPlayer = { x: player.x, z: player.z };
    }
    this.engaged = engaged; this.separation = separation;
    // Hysteresis keeps a nearby enemy from immediately pulling a returning ally away again.
    const out = engaged ? COMBAT_LEASH.out : 8, back = engaged ? COMBAT_LEASH.back : 4;
    this.returning = separation > (this.returning ? back : out);
  }
  speed(separation: number, normalSpeed: number) {
    const catchUp = Math.max(0, Math.min(1, (separation - 4) / 4));
    return normalSpeed + (COMPANION_MOTION.catchUpSpeed - normalSpeed) * catchUp;
  }
}

/** Remembers enemies a melee companion could not get to (on a wall, across a gap) so it stops running into the
 * same obstacle and picks another foe or rejoins the player. Entries expire after a few seconds. */
export class PursuitMemory {
  private readonly blocked = new Map<string, number>();
  private clock = 0;
  private id: string | null = null;
  private best = Infinity;
  private stalled = 0;
  readonly skip = (id: string) => (this.blocked.get(id) ?? -1) > this.clock;
  reset() { this.id = null; this.best = Infinity; this.stalled = 0; }
  update(dt: number, preyId: string | null, distance: number, stuckSeconds: number) {
    if (!(dt > 0)) return;
    this.clock += dt;
    if (preyId !== this.id) { this.id = preyId; this.best = distance; this.stalled = 0; return; }
    if (!preyId || !Number.isFinite(distance)) return;
    if (distance < this.best - .3) { this.best = distance; this.stalled = 0; } else this.stalled += dt;
    if (distance > 2.4 && (stuckSeconds > 1.2 || this.stalled > 2.5)) { this.blocked.set(preyId, this.clock + 6); this.reset(); }
    if (this.blocked.size > 24) for (const [key, until] of this.blocked) if (until <= this.clock) this.blocked.delete(key);
  }
}

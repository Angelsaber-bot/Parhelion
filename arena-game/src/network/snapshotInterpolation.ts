import { INTERP_TICKS, TICK_HZ } from '../../shared/content.ts';
import type { Vec3 } from '../../shared/map.ts';
import type { PlayerSnap, Snapshot } from '../../shared/match.ts';

export interface RemotePose {
  snap: PlayerSnap;
  pos: Vec3;
  yaw: number;
  pitch: number;
}

/** Delayed presentation timeline for the remote players in an Arena session. */
export class SnapshotInterpolation {
  private readonly history: Snapshot[] = [];
  private receivedAt: number | null = null;
  renderTick = 0;
  arrivalGapMs = 50;

  resetRound() {
    this.history.length = 0;
    this.renderTick = 0;
  }

  push(snapshot: Snapshot, now: number) {
    if (this.receivedAt !== null) {
      this.arrivalGapMs += (now - this.receivedAt - this.arrivalGapMs) * .1;
    }
    this.receivedAt = now;
    this.history.push(snapshot);
    if (this.history.length > 40) this.history.shift();
    if (this.renderTick === 0) this.renderTick = snapshot.tick - INTERP_TICKS;
  }

  ageSeconds(now: number) {
    return this.receivedAt === null ? 0 : (now - this.receivedAt) / 1000;
  }

  advance(elapsedSeconds: number, now: number) {
    const latest = this.history.at(-1);
    if (!latest) return;
    const target = latest.tick + this.ageSeconds(now) * TICK_HZ - INTERP_TICKS;
    this.renderTick += elapsedSeconds * TICK_HZ;
    const error = target - this.renderTick;
    this.renderTick = Math.abs(error) > 30 ? target : this.renderTick + error * .08;
  }

  sample(localPlayerId: string): RemotePose[] {
    const latest = this.history.at(-1);
    if (!latest) return [];

    let before = this.history[0], after = before;
    for (let i = this.history.length - 1; i >= 0; i--) {
      if (this.history[i].tick <= this.renderTick) {
        before = this.history[i];
        after = this.history[i + 1] ?? before;
        break;
      }
    }
    const interval = after.tick - before.tick;
    const fraction = interval > 0 ? Math.max(0, Math.min(1, (this.renderTick - before.tick) / interval)) : 0;
    const poses: RemotePose[] = [];
    for (const player of latest.players) {
      if (player.id === localPlayerId) continue;
      const a = before.players.find(p => p.id === player.id) ?? player;
      const b = after.players.find(p => p.id === player.id) ?? player;
      // Respawns teleport immediately. Ordinary yaw changes follow the shorter arc.
      const t = Math.hypot(b.x - a.x, b.z - a.z) > 4 ? 1 : fraction;
      const yawDelta = b.yaw - a.yaw;
      poses.push({
        snap: { ...player, alive: t < .5 ? a.alive : b.alive, hp: b.hp, weapon: b.weapon },
        pos: [a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t],
        yaw: a.yaw + Math.atan2(Math.sin(yawDelta), Math.cos(yawDelta)) * t,
        pitch: a.pitch + (b.pitch - a.pitch) * t,
      });
    }
    return poses;
  }
}

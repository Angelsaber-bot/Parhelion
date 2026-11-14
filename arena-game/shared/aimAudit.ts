// Conservative evidence collection, NOT a cheating verdict or automatic ban.
import { aimDir, type Input, type PlayerState, type SimEvent } from './sim.ts';
import { playerHitbox } from './hit.ts';
import { lineOfSight, type Vec3 } from './map.ts';
import { smokeBlocks } from './grenade.ts';
import type { Match } from './match.ts';

interface Sample { tick: number; seq: number; yaw: number; pitch: number; alive: boolean }
export interface AimEvidence { tick: number; seq: number; target: string; turnDegrees: number; errorDegrees: number }
export interface AimReport { kind: 'aim-review'; player: string; evidence: AimEvidence[]; automaticBan: false }
const angle = (a: Vec3, b: Vec3) => Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))) * 180 / Math.PI;
export class AimAudit {
  private previous = new Map<string, Sample>();
  private evidence = new Map<string, AimEvidence[]>();
  private reportedAt = new Map<string, number>();
  private reports: AimReport[] = [];
  leave(id: string) { this.previous.delete(id); this.evidence.delete(id); this.reportedAt.delete(id); }
  drain(): AimReport[] { return this.reports.splice(0); }
  observe(match: Match, player: PlayerState, input: Input, events: SimEvent[]) {
    const old = this.previous.get(player.id);
    this.previous.set(player.id, { tick: match.tick, seq: input.seq, yaw: input.yaw, pitch: input.pitch, alive: player.alive });
    const shot = events.find((e): e is Extract<SimEvent, { type: 'fire' }> => e.type === 'fire');
    if (!old || !shot || !old.alive || !player.alive || match.phase !== 'live'
      || input.seq !== old.seq + 1 || match.tick - old.tick > 2) return;
    const direction = aimDir(input.yaw, input.pitch);
    const turnDegrees = angle(aimDir(old.yaw, old.pitch), direction);
    if (turnDegrees < 25) return;
    for (const slot of match.slots.values()) {
      const target = slot.state;
      if (!target.alive || target.team === player.team) continue;
      const head: Vec3 = [target.x, target.y + playerHitbox(target.crouched).headY, target.z];
      const delta: Vec3 = [head[0] - shot.origin[0], head[1] - shot.origin[1], head[2] - shot.origin[2]];
      const distance = Math.hypot(...delta);
      if (distance < 5 || !lineOfSight(match.map, shot.origin, head) || smokeBlocks(match.smokes, shot.origin, head)) continue;
      const errorDegrees = angle(direction, delta.map(n => n / distance) as Vec3);
      if (errorDegrees > .15) continue;
      const evidence = (this.evidence.get(player.id) ?? []).filter(e => match.tick - e.tick <= 7200);
      evidence.push({ tick: match.tick, seq: input.seq, target: target.id, turnDegrees, errorDegrees });
      this.evidence.set(player.id, evidence.slice(-16));
      if (evidence.length >= 6 && match.tick - (this.reportedAt.get(player.id) ?? -Infinity) >= 3600) {
        this.reports.push({ kind: 'aim-review', player: player.id, evidence: evidence.slice(-16), automaticBan: false });
        if (this.reports.length > 16) this.reports.shift();
        this.reportedAt.set(player.id, match.tick);
      }
      break;
    }
  }
}

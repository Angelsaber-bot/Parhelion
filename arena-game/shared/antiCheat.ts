// Online ingress only. Simulation remains authoritative; aim skill is never a ban signal.
import type { Input } from './sim.ts';

export const ANTI_CHEAT_CLOSE = 4008;
export const ANTI_CHEAT_REASON = 'Invalid or excessive Arena traffic';
export const MAX_ARENA_MESSAGE = 32 * 1024;
const fields = new Set(['seq', 'mx', 'mz', 'yaw', 'pitch', 'buttons', 'weapon', 'view']);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
export function validOnlineInput(value: unknown): value is Input {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  if (Object.keys(v).some(key => !fields.has(key))) return false;
  return finite(v.seq) && Number.isSafeInteger(v.seq) && v.seq >= 0 && v.seq <= 2 ** 31
    && finite(v.mx) && Math.abs(v.mx) <= 1 && finite(v.mz) && Math.abs(v.mz) <= 1
    && finite(v.yaw) && Math.abs(v.yaw) <= 1e4 && finite(v.pitch) && Math.abs(v.pitch) <= 1.5
    && finite(v.buttons) && Number.isInteger(v.buttons) && v.buttons >= 0 && v.buttons <= 255
    && finite(v.weapon) && Number.isInteger(v.weapon) && v.weapon >= -1 && v.weapon <= 2
    && finite(v.view) && v.view >= -120 && v.view <= 2 ** 31;
}

/** Token buckets tolerate network bursts, but cannot bank unlimited idle time. */
export class ArenaTrafficGuard {
  private at: number;
  private messages = 180;
  private inputs = 120;
  private strikes = 0;
  private stopped = false;
  constructor(private readonly now: () => number = Date.now) { this.at = now(); }
  private refill() {
    const now = this.now(), seconds = Math.max(0, now - this.at) / 1000;
    this.at = now;
    this.messages = Math.min(180, this.messages + seconds * 120);
    this.inputs = Math.min(120, this.inputs + seconds * 90);
    this.strikes = Math.max(0, this.strikes - seconds * 0.5);
  }
  get blocked() { return this.stopped; }
  invalid(): false {
    this.strikes++;
    if (this.strikes >= 8) this.stopped = true;
    return false;
  }
  message(): boolean {
    this.refill();
    if (this.stopped) return false;
    if (this.messages < 1) { this.stopped = true; return false; }
    this.messages--;
    return true;
  }
  batch(value: unknown): value is Input[] {
    this.refill();
    if (this.stopped) return false;
    if (!Array.isArray(value) || value.length > 64 || !value.every(validOnlineInput)) return this.invalid();
    if (value.length > this.inputs) return this.invalid();
    this.inputs -= value.length;
    return true;
  }
}

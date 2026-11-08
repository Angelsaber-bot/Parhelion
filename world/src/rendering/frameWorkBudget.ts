/** Schedule optional presentation work only; never use for physics, combat or input.
 * Discrete revisions (locale, progress, opening a map, resize) paint immediately.
 * Continuous movement/pulsing uses `active`, not a changing revision string.
 */
export class FrameWorkBudget {
  private last = -Infinity;
  private revision: unknown;
  private active = false;
  private initialized = false;
  readonly intervalMs: number;
  constructor(hz: number) {
    if (!Number.isFinite(hz) || hz <= 0) throw new RangeError('Presentation frequency must be positive and finite');
    this.intervalMs = 1000 / hz;
  }
  invalidate() { this.initialized = false; }
  due(nowMs: number, state: { active: boolean; revision?: unknown }): boolean {
    // Invalid samples must not poison the next valid deadline or spin an idle task.
    if (!Number.isFinite(nowMs)) return false;
    const changed = !this.initialized || !Object.is(this.revision, state.revision);
    const stopped = this.active && !state.active;
    const clockReset = nowMs < this.last;
    this.active = state.active;
    this.revision = state.revision;
    this.initialized = true;
    if (!changed && !stopped && !clockReset && !(state.active && nowMs - this.last + 1e-7 >= this.intervalMs)) return false;
    // No accumulated debt/catch-up bursts after hidden tabs, pauses or long stalls.
    this.last = nowMs;
    return true;
  }
}

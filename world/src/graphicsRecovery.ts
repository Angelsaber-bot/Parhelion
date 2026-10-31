export type GraphicsRecoveryState = 'available' | 'lost' | 'awaiting-resume' | 'disposed';
/** Browser-event state only. It does not recreate a renderer, promise device
 * recovery, refund actions, alter saves, or abort background asset downloads. */
export class WorldGraphicsRecovery {
  private current: GraphicsRecoveryState = 'available';
  private waiters = new Set<(available: boolean) => void>();
  constructor(private canvas: EventTarget, private suspend: () => void, private changed: () => void) {
    canvas.addEventListener('webglcontextlost', this.lost);
    canvas.addEventListener('webglcontextrestored', this.restored);
  }
  get state() { return this.current; }
  get blocked() { return this.current !== 'available'; }
  private lost = (event: Event) => {
    if (this.current === 'disposed') return;
    event.preventDefault(); // Permit the browser's normal restoration attempt.
    if (this.current === 'lost') return;
    this.current = 'lost'; this.suspend(); this.changed();
  };
  private restored = () => {
    if (this.current !== 'lost') return;
    this.current = 'awaiting-resume';
    for (const resolve of this.waiters) resolve(true); this.waiters.clear();
    this.changed();
  };
  whenContextAvailable(): Promise<boolean> {
    if (this.current === 'disposed') return Promise.resolve(false);
    if (this.current !== 'lost') return Promise.resolve(true);
    return new Promise(resolve => this.waiters.add(resolve));
  }
  resume() {
    if (this.current !== 'awaiting-resume') return false;
    this.current = 'available'; this.changed(); return true;
  }
  dispose() {
    if (this.current === 'disposed') return;
    this.current = 'disposed';
    for (const resolve of this.waiters) resolve(false); this.waiters.clear();
    this.canvas.removeEventListener('webglcontextlost', this.lost);
    this.canvas.removeEventListener('webglcontextrestored', this.restored);
  }
}

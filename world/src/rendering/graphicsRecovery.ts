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
  async whenContextAvailable(): Promise<boolean> {
    // Restoration and a second loss can precede this continuation's microtask.
    // Recheck ownership rather than handing boot a stale availability snapshot.
    while (this.current === 'lost') {
      const available = await new Promise<boolean>(resolve => this.waiters.add(resolve));
      if (!available) return false;
    }
    return this.current !== 'disposed';
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

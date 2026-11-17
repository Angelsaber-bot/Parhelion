/**
 * Keeps an online match ticking while its window is in the background.
 *
 * Browsers stop requestAnimationFrame in a hidden or fully covered window and clamp its timers to about one per
 * second. Two game windows on one computer therefore freeze each other in turn: the background player stops sending
 * moves and its view stops updating, which looks like a one- to two-second delay. Timers inside a dedicated Web
 * Worker are not throttled that way, so a worker heartbeat drives the fixed-step input loop whenever animation
 * frames have stopped arriving. Nothing is drawn; the next real frame takes over again.
 */
export class BackgroundTicker {
  private lastFrame: number;
  private lastBeat: number;
  private worker: Worker | null = null;
  private url = '';

  /** `step(seconds)` advances the game's fixed-step input clock by that much real time. */
  constructor(private step: (seconds: number) => void, private now: () => number = () => performance.now(), readonly beatMs = 50) {
    this.lastFrame = this.lastBeat = now();
  }

  /** Start the worker heartbeat; silently does nothing where workers are unavailable. */
  start(): void {
    if (this.worker || typeof Worker === 'undefined' || typeof Blob === 'undefined' || typeof URL?.createObjectURL !== 'function') return;
    try {
      this.url = URL.createObjectURL(new Blob([`setInterval(()=>postMessage(0),${this.beatMs});`], { type: 'text/javascript' }));
      this.worker = new Worker(this.url);
      this.worker.onmessage = () => this.beat();
    } catch { this.stop(); }
  }

  stop(): void {
    this.worker?.terminate(); this.worker = null;
    if (this.url) { URL.revokeObjectURL(this.url); this.url = ''; }
  }

  /** Call from every real animation frame. */
  frame(t = this.now()): void { this.lastFrame = this.lastBeat = t; }

  /** A heartbeat: if frames have stalled, advance the game by the time since the last frame or beat. */
  beat(t = this.now()): boolean {
    if (t - this.lastFrame < this.beatMs * 2.5) return false;
    const seconds = Math.max(0, (t - this.lastBeat) / 1000);
    this.lastBeat = t;
    if (seconds > 0) this.step(seconds);
    return true;
  }
}

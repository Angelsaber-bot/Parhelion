import { describe, expect, it } from 'vitest';
import { BackgroundTicker } from '../src/network/backgroundTicker.ts';

describe('background ticker', () => {
  it('stays idle while animation frames arrive, then drives the game by real elapsed time once they stop', () => {
    let now = 0; const steps: number[] = [];
    const ticker = new BackgroundTicker(s => steps.push(s), () => now, 50);
    for (let t = 16; t <= 1000; t += 16) { now = t; ticker.frame(t); if (t % 48 === 0) expect(ticker.beat(t)).toBe(false); }
    expect(steps).toHaveLength(0);
    // The window goes to the background: no more frames, the worker keeps beating every 50 ms.
    for (let t = 1050; t <= 3000; t += 50) { now = t; ticker.beat(t); }
    const total = steps.reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThan(1.8); expect(total).toBeLessThanOrEqual(2.01);
    // Frames come back: the heartbeat steps aside again.
    now = 3016; ticker.frame(3016); expect(ticker.beat(3050)).toBe(false);
  });
  it('does nothing where workers are unavailable', () => {
    const ticker = new BackgroundTicker(() => {});
    expect(() => { ticker.start(); ticker.stop(); }).not.toThrow();
  });
});

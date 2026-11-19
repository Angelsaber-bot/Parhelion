import { TICK_HZ } from '../../shared/content.ts';
import { HUMAN_FEATURES, wrapAngle } from '../../shared/humanCombat.ts';
import { RULES_VERSION } from '../../shared/protocol.ts';
import { BTN, type Input, type PlayerState } from '../../shared/sim.ts';

const MAX_FRAMES = 12 * 60 * TICK_HZ;
const round = (n: number) => Math.round(n * 10000) / 10000;

/** Feature vectors and game inputs only. Temporary memory until the player requests a download. */
export class HumanDemo {
  private readonly capture = Array.from(crypto.getRandomValues(new Uint8Array(16)), n => n.toString(16).padStart(2, '0')).join('');
  private frames: number[][] = [];
  private lastSeq = -2;
  private life = -1;
  private segment = 0;
  private previous: [number, number] = [0, 0];

  constructor(private readonly map: string) {}

  get size() { return this.frames.length; }

  pause() { this.lastSeq = -2; }

  record(me: PlayerState, input: Input, observe: (previous: readonly [number, number]) => number[]) {
    if (this.size >= MAX_FRAMES) return;
    if (this.life !== me.lifeId || input.seq !== this.lastSeq + 1) {
      this.segment++;
      this.life = me.lifeId;
      this.previous = [0, 0];
    }
    this.lastSeq = input.seq;
    const features = observe(this.previous);
    const yaw = wrapAngle(input.yaw - me.yaw), pitch = input.pitch - me.pitch;
    this.frames.push([this.segment, ...features.map(round), round(yaw), round(pitch), Number(!!(input.buttons & BTN.FIRE))]);
    this.previous = [yaw, pitch];
  }

  serialize(): string {
    return JSON.stringify({ version: 1, rulesVersion: RULES_VERSION, tickHz: TICK_HZ, capture: this.capture, map: this.map, features: HUMAN_FEATURES, frames: this.frames });
  }

  download() {
    if (!this.size) return;
    const url = URL.createObjectURL(new Blob([this.serialize()], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `parhelion-demo-${this.map}-${Date.now()}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

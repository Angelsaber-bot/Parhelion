import { TICK_HZ } from '../../shared/content.ts';
import { HUMAN_FEATURES, wrapAngle } from '../../shared/humanCombat.ts';
import { RULES_VERSION } from '../../shared/protocol.ts';
import { BTN, type Input, type PlayerState } from '../../shared/sim.ts';
import { TRAINING_BATCH_TICKS, type TrainingBatch, type TrainingView } from '../../shared/trainingData.ts';

const MAX_FRAMES = 12 * 60 * TICK_HZ;
const VIEW_WIDTH = 192, VIEW_HEIGHT = 108;
const PIXEL_COLS = 16, PIXEL_ROWS = 9;
const VIEW_INTERVAL = TICK_HZ / 6;
const round = (n: number) => Math.round(n * 10000) / 10000;

/** Feature vectors and game inputs only. Temporary memory until the player requests a download. */
export class HumanDemo {
  private readonly capture = Array.from(crypto.getRandomValues(new Uint8Array(16)), n => n.toString(16).padStart(2, '0')).join('');
  private frames: number[][] = [];
  private lastSeq = -2;
  private life = -1;
  private segment = 0;
  private previous: [number, number] = [0, 0];
  private view: CanvasRenderingContext2D | null | undefined;
  private views: [number, number, string, string][] = [];
  private nextView = 1;
  private trainingViews: TrainingView[] = [];
  private recorded = 0;
  private sequence = 0;

  constructor(private readonly map: string, private readonly transmit?: (batch: TrainingBatch) => void) {}

  get size() { return this.recorded; }
  get automatic() { return !!this.transmit; }

  pause() { this.lastSeq = -2; this.flush(); }

  flush() {
    if (!this.transmit || !this.frames.length) return;
    const start = this.size - this.frames.length;
    const views = this.trainingViews.filter(view => view[0] >= start - 18);
    this.transmit({ version: 1, rulesVersion: RULES_VERSION, capture: this.capture, map: this.map, sequence: this.sequence++, start, rows: this.frames, views });
    this.frames = [];
    this.trainingViews = views.slice(-1);
  }

  record(me: PlayerState, input: Input, observe: (previous: readonly [number, number]) => number[]) {
    if (!this.automatic && this.size >= MAX_FRAMES) return;
    if (this.life !== me.lifeId || input.seq !== this.lastSeq + 1) {
      this.segment++;
      this.life = me.lifeId;
      this.previous = [0, 0];
    }
    this.lastSeq = input.seq;
    const features = observe(this.previous);
    const yaw = wrapAngle(input.yaw - me.yaw), pitch = input.pitch - me.pitch;
    const actions = this.automatic ? [round(input.mx), round(input.mz), input.buttons, input.weapon ?? me.weaponSlot] : [Number(!!(input.buttons & BTN.FIRE))];
    this.frames.push([this.segment, ...features.map(round), round(yaw), round(pitch), ...actions]);
    this.recorded++;
    this.previous = [yaw, pitch];
    if (this.frames.length >= TRAINING_BATCH_TICKS) this.flush();
  }

  /** Capture the frame the player has just seen. Its index is the next input that can use it. */
  captureView(canvas: HTMLCanvasElement) {
    if (this.size < this.nextView || (!this.automatic && this.size >= MAX_FRAMES) || !canvas.width || !canvas.height) return;
    this.nextView = this.size + VIEW_INTERVAL;
    if (this.view === undefined) {
      const buffer = document.createElement('canvas');
      buffer.width = VIEW_WIDTH;
      buffer.height = VIEW_HEIGHT;
      this.view = buffer.getContext('2d', { willReadFrequently: true });
    }
    if (!this.view) return;
    const scale = Math.min(VIEW_WIDTH / canvas.width, VIEW_HEIGHT / canvas.height);
    const width = canvas.width * scale, height = canvas.height * scale;
    try {
      this.view.fillStyle = '#000';
      this.view.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
      this.view.drawImage(canvas, (VIEW_WIDTH - width) / 2, (VIEW_HEIGHT - height) / 2, width, height);
      const rgba = this.view.getImageData(0, 0, VIEW_WIDTH, VIEW_HEIGHT).data;
      const light = new Uint8Array(PIXEL_COLS * PIXEL_ROWS);
      const cell = VIEW_WIDTH / PIXEL_COLS;
      for (let row = 0; row < PIXEL_ROWS; row++) {
        for (let col = 0; col < PIXEL_COLS; col++) {
          let sum = 0;
          for (let dy = 0; dy < cell; dy += 3) for (let dx = 0; dx < cell; dx += 3) {
            const i = ((row * cell + dy) * VIEW_WIDTH + col * cell + dx) * 4;
            sum += rgba[i] * .213 + rgba[i + 1] * .715 + rgba[i + 2] * .072;
          }
          light[row * PIXEL_COLS + col] = Math.round(sum / (cell / 3) ** 2);
        }
      }
      const grid = btoa(String.fromCharCode(...light));
      if (this.automatic) this.trainingViews.push([this.size, this.segment, grid]);
      else this.views.push([this.size, this.segment, this.view.canvas.toDataURL('image/jpeg', .58).split(',')[1], grid]);
    } catch {
      this.view = null;
    }
  }

  serialize(): string {
    return JSON.stringify({ version: 1, rulesVersion: RULES_VERSION, tickHz: TICK_HZ, capture: this.capture, map: this.map,
      features: HUMAN_FEATURES, frames: this.frames, viewFormat: { width: VIEW_WIDTH, height: VIEW_HEIGHT, encoding: 'jpeg', featureGrid: [PIXEL_COLS, PIXEL_ROWS] }, views: this.views });
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

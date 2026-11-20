import { TICK_HZ } from '../../shared/content.ts';
import { HUMAN_FEATURES, wrapAngle } from '../../shared/humanCombat.ts';
import { EXPLORATION_TICKS, type ExplorationSample, type LastObservedBearing } from '../../shared/exploration.ts';
import { RULES_VERSION } from '../../shared/protocol.ts';
import { BTN, type Input, type PlayerState } from '../../shared/sim.ts';
import { MAX_TRAINING_BODY, TRAINING_BATCH_TICKS, type TrainingBatch, type TrainingView } from '../../shared/trainingData.ts';
import { coarseFrame, COARSE_FRAME_CHARS, encodeDetailFrame } from '../../shared/trainingView.ts';

const MAX_FRAMES = 12 * 60 * TICK_HZ;
const VIEW_WIDTH = 192, VIEW_HEIGHT = 108;
const PIXEL_COLS = 16, PIXEL_ROWS = 9;
const VIEW_INTERVAL = TICK_HZ / 6;
const round = (n: number) => Math.round(n * 10000) / 10000;
const newCapture = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), n => n.toString(16).padStart(2, '0')).join('');

/** Letterbox both human and visual-bot cameras identically before extracting model pixels. */
export function readArenaCamera(view: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
  const scale = Math.min(VIEW_WIDTH / canvas.width, VIEW_HEIGHT / canvas.height);
  const width = canvas.width * scale, height = canvas.height * scale;
  view.fillStyle = '#000';
  view.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  view.drawImage(canvas, (VIEW_WIDTH - width) / 2, (VIEW_HEIGHT - height) / 2, width, height);
  return view.getImageData(0, 0, VIEW_WIDTH, VIEW_HEIGHT).data;
}

/** Samples the player's observations and inputs, with optional automatic transmission. */
export class HumanDemo {
  private capture = newCapture();
  private frames: number[][] = [];
  private lastSeq = -2;
  private life = -1;
  private segment = 0;
  private previous: [number, number] = [0, 0];
  private view: CanvasRenderingContext2D | null | undefined;
  private views: [number, number, string, string][] = [];
  private nextView = 1;
  private trainingViews: TrainingView[] = [];
  private exploration: ExplorationSample[] = [];
  private recorded = 0;
  private sequence = 0;
  private seenBearing = 0;
  private seenAt = -Infinity;

  constructor(private readonly map: string, private readonly transmit?: (batch: TrainingBatch) => void) {}

  get size() { return this.recorded; }
  get automatic() { return !!this.transmit; }

  pause() { this.lastSeq = -2; this.flush(); }

  beginRound() {
    if (!this.automatic || !this.recorded) return;
    this.pause();
    this.capture = newCapture();
    this.recorded = this.sequence = this.segment = 0;
    this.nextView = 1;
    this.trainingViews = [];
  }

  flush() {
    if (!this.transmit || !this.frames.length) return;
    const start = this.size - this.frames.length;
    const views = this.trainingViews.filter(view => view[0] >= start - 18);
    const batch: TrainingBatch = { version: 1, rulesVersion: RULES_VERSION, capture: this.capture, map: this.map,
      sequence: this.sequence++, start, rows: this.frames, views, ...(this.exploration.length ? { exploration: this.exploration } : {}) };
    let bytes = JSON.stringify(batch).length;
    for (let i = 0; bytes > MAX_TRAINING_BODY && i < views.length; i++) {
      const [tick, segment, frame] = views[i];
      if (frame.length === COARSE_FRAME_CHARS) continue;
      views[i] = [tick, segment, coarseFrame(frame)];
      bytes -= frame.length - COARSE_FRAME_CHARS;
    }
    this.transmit(batch);
    this.frames = [];
    this.trainingViews = views.slice(-1);
    this.exploration = [];
  }

  record(me: PlayerState, input: Input, observe: (previous: readonly [number, number]) => number[], scene?: (lastContact: LastObservedBearing) => number[]) {
    if (!this.automatic && this.size >= MAX_FRAMES) return;
    if (this.life !== me.lifeId || input.seq !== this.lastSeq + 1) {
      this.segment++;
      this.life = me.lifeId;
      this.previous = [0, 0];
      this.seenAt = -Infinity;
    }
    this.lastSeq = input.seq;
    const features = observe(this.previous);
    const yaw = wrapAngle(input.yaw - me.yaw), pitch = input.pitch - me.pitch;
    const actions = this.automatic ? [round(input.mx), round(input.mz), input.buttons, input.weapon ?? me.weaponSlot] : [Number(!!(input.buttons & BTN.FIRE))];
    if (this.automatic && scene) {
      if (features[0]) { this.seenBearing = me.yaw + features[1]; this.seenAt = this.size; }
      if (this.size % EXPLORATION_TICKS === 0) this.exploration.push([this.size, ...scene([this.seenBearing, this.size - this.seenAt]).map(round)]);
    }
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
    try {
      const rgba = readArenaCamera(this.view, canvas);
      if (this.automatic) {
        this.trainingViews.push([this.size, this.segment, encodeDetailFrame(rgba)]);
        return;
      }
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
      this.views.push([this.size, this.segment, this.view.canvas.toDataURL('image/jpeg', .58).split(',')[1], grid]);
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

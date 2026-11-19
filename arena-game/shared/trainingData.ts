import { HUMAN_FEATURES } from './humanCombat.ts';
import { RULES_VERSION } from './protocol.ts';

export const TRAINING_BATCH_TICKS = 240;
export const MAX_TRAINING_BODY = 56 * 1024;
export const TRAINING_GRID_SIZE = 144;
const OBS = HUMAN_FEATURES.length;

// One row per applied client input: segment, observations, turn, move, buttons, weapon slot.
export type TrainingView = [nextInput: number, segment: number, luminance: string];
export interface TrainingBatch {
  version: 1;
  rulesVersion: number;
  capture: string;
  sequence: number;
  start: number;
  map: string;
  rows: number[][];
  views: TrainingView[];
}

const integer = (x: unknown, lo: number, hi: number): x is number => Number.isInteger(x) && (x as number) >= lo && (x as number) <= hi;
export function parseTrainingBatch(raw: unknown): TrainingBatch | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const b = raw as Partial<TrainingBatch>;
  if (b.version !== 1 || b.rulesVersion !== RULES_VERSION || typeof b.capture !== 'string' || !/^[0-9a-f]{32}$/.test(b.capture) ||
      typeof b.map !== 'string' || !/^[a-z0-9-]{1,32}$/.test(b.map) || !integer(b.sequence, 0, 1e8) || !integer(b.start, 0, 1e9) ||
      !Array.isArray(b.rows) || b.rows.length < 1 || b.rows.length > TRAINING_BATCH_TICKS || !Array.isArray(b.views) || b.views.length > 26) return null;
  let segment = 0;
  for (const row of b.rows) {
    if (!Array.isArray(row) || row.length !== OBS + 7 || !integer(row[0], segment, 1e9)) return null;
    for (let i = 1; i <= OBS + 4; i++) if (!Number.isFinite(row[i]) || Math.abs(row[i]) > (i <= OBS || i > OBS + 2 ? 2 : 4)) return null;
    if (!integer(row[OBS + 5], 0, 127) || !integer(row[OBS + 6], 0, 2)) return null;
    segment = row[0];
  }
  let last = b.start - 19;
  for (const view of b.views) {
    if (!Array.isArray(view) || view.length !== 3 || !integer(view[0], Math.max(0, last + 1), b.start + b.rows.length) ||
        !integer(view[1], 0, 1e9) || typeof view[2] !== 'string' || !/^[A-Za-z0-9+/]{192}$/.test(view[2])) return null;
    last = view[0];
  }
  // Strip unknown fields before retaining any payload. New transports cannot smuggle chat or names.
  return { version: b.version, rulesVersion: b.rulesVersion, capture: b.capture, sequence: b.sequence, start: b.start, map: b.map, rows: b.rows, views: b.views };
}

const outputs = 14;
const inputs = 1 + OBS * 2 + 10;
export interface TrainingCheckpoint {
  weights: number[][];
  trained: number;
  heldOut: number;
  recentLoss: number | null;
  recentHoldoutLoss: number | null;
}

export const newTrainingCheckpoint = (): TrainingCheckpoint => ({
  weights: Array.from({ length: outputs }, () => Array(inputs).fill(0)),
  trained: 0, heldOut: 0, recentLoss: null, recentHoldoutLoss: null,
});

// Entire recordings stay in one split, even when their batches arrive in different alarms.
export const trainingHoldout = (capture: string) => parseInt(capture.slice(-4), 16) % 5 === 0;

function viewFeatures(view: TrainingView | undefined): number[] {
  const out = Array<number>(10).fill(0);
  if (!view) return out;
  const data = atob(view[2]);
  out[0] = 1;
  for (let i = 0; i < TRAINING_GRID_SIZE; i++) {
    const block = Math.floor(i / 48) * 3 + Math.min(2, Math.floor((i % 16) / 5.34));
    out[block + 1] += data.charCodeAt(i) / (16 * 255);
  }
  return out;
}

/** A small streaming imitation learner. Held-out recordings score it without updating weights. */
export function trainArenaBatch(state: TrainingCheckpoint, batch: TrainingBatch): void {
  const heldOut = trainingHoldout(batch.capture);
  let loss = 0;
  let latestView: TrainingView | undefined, cursor = 0;
  let visual = viewFeatures(undefined);
  const unit = (n: number) => Math.max(-1, Math.min(1, n));
  for (let i = 0; i < batch.rows.length; i++) {
    const row = batch.rows[i], index = batch.start + i;
    while (cursor < batch.views.length && batch.views[cursor][0] <= index) {
      latestView = batch.views[cursor++];
      visual = viewFeatures(latestView);
    }
    const prior = batch.rows[Math.max(0, i - 6)];
    const x = [1, ...row.slice(1, OBS + 1), ...(prior[0] === row[0] ? prior : row).slice(1, OBS + 1),
      ...(latestView && latestView[1] === row[0] && index - latestView[0] < 18 ? visual : viewFeatures(undefined))];
    const y = [unit(row[OBS + 1] / .18), unit(row[OBS + 2] / .18), unit(row[OBS + 3]), unit(row[OBS + 4])];
    for (let flag = 0; flag < 7; flag++) y.push(Number((row[OBS + 5] & (1 << flag)) !== 0));
    for (let slot = 0; slot < 3; slot++) y.push(Number(row[OBS + 6] === slot));
    for (let o = 0; o < outputs; o++) {
      const weights = state.weights[o];
      let score = 0;
      for (let c = 0; c < inputs; c++) score += weights[c] * x[c];
      const p = o < 4 ? Math.tanh(score) : 1 / (1 + Math.exp(-score));
      const error = p - y[o];
      loss += error * error;
      if (!heldOut) for (let c = 0; c < inputs; c++) weights[c] -= .009 * (error * x[c] + .0003 * weights[c]);
    }
  }
  const mse = loss / outputs / batch.rows.length;
  if (heldOut) {
    state.heldOut += batch.rows.length;
    state.recentHoldoutLoss = state.recentHoldoutLoss === null ? mse : .94 * state.recentHoldoutLoss + .06 * mse;
  } else {
    state.trained += batch.rows.length;
    state.recentLoss = state.recentLoss === null ? mse : .94 * state.recentLoss + .06 * mse;
  }
}

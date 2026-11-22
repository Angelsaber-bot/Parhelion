import { smokeBlocks, type Smoke } from './grenade.ts';
import { rayShield } from './hit.ts';
import type { Shield } from './match.ts';
import { HUMAN_FEATURES } from './humanCombat.ts';
import { raycastMap, type ArenaMap, type Vec3 } from './map.ts';
import { aimDir, forward, playerEye, type PlayerState } from './sim.ts';

export const EXPLORATION_TICKS = 12;
export const EXPLORATION_SCENE_SIZE = 12;
export type ExplorationSample = [nextInput: number, ...scene: number[]];
export type LastObservedBearing = readonly [yaw: number, age: number];

const OBS = HUMAN_FEATURES.length;
const FEATURE_COUNT = 7 + EXPLORATION_SCENE_SIZE;
const YAW_CUTS = [-.55, -.18, -.045, .045, .18, .55];
const CLASSES = YAW_CUTS.length + 1;
const EMPTY = CLASSES >> 1;
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

// These geometry cues describe the player's own view. No enemy location is an input.
export function explorationScene(map: ArenaMap, me: PlayerState, lastContact?: LastObservedBearing): number[] {
  const { min, max } = map.data.bounds;
  const relative = (value: number, axis: number) => clamp(2 * (value - min[axis]) / Math.max(1, max[axis] - min[axis]) - 1, -1, 1);
  const eye: Vec3 = [me.x, me.y + playerEye(map, me), me.z];
  const depths = [-.52, 0, .52].map(offset => {
    const [x, z] = forward(me.yaw + offset);
    return Math.min(16, raycastMap(map, eye, [x, 0, z], 16)) / 16;
  });
  const recency = lastContact ? Math.max(0, 1 - lastContact[1] / 120) : 0;
  const bearing = (lastContact?.[0] ?? me.yaw) - me.yaw;
  return [relative(me.x, 0), relative(me.y, 1), relative(me.z, 2), Math.sin(me.yaw), Math.cos(me.yaw), clamp(me.pitch / 1.5, -1, 1), ...depths,
    recency, recency * Math.sin(bearing), recency * Math.cos(bearing)];
}

export type SmokeDepths = [number, number, number];
export const SCENE_DEPTH_OFFSET = 6;

/** Three camera rays. Zero means no visible smoke, negative values encode the first
 * visible smoke in 2 m bins out to 16 m. Neither targets nor cloud owners are inputs. */
export function visibleSmokeDepths(map: ArenaMap, me: PlayerState, smokes: readonly Smoke[], shields: readonly Shield[],
  horizontalHalfFov = Math.PI / 3): SmokeDepths | undefined {
  if (!smokes.length) return;
  const eye: Vec3 = [me.x, me.y + playerEye(map, me), me.z];
  const depths: SmokeDepths = [0, 0, 0];
  const sideAngle = Math.min(.52, horizontalHalfFov * .9);
  for (let i = 0; i < depths.length; i++) {
    const ray = aimDir(me.yaw + (i - 1) * sideAngle, me.pitch);
    let limit = Math.min(16, raycastMap(map, eye, ray, 16));
    for (const shield of shields) {
      if (shield.hp > 0 && shield.life > 0) limit = Math.min(limit, rayShield(eye, ray, shield.x, shield.y, shield.z, shield.yaw));
    }
    let start = eye;
    for (let distance = 0; distance < limit; distance += 2) {
      const endDistance = Math.min(distance + 2, limit);
      const end: Vec3 = [eye[0] + endDistance * ray[0], eye[1] + endDistance * ray[1], eye[2] + endDistance * ray[2]];
      if (smokeBlocks(smokes, start, end)) { depths[i] = -(distance + 2) / 16; break; }
      start = end;
    }
  }
  return depths.some(value => value < 0) ? depths : undefined;
}

export function addSmokeDepths(scene: number[], depths: SmokeDepths | undefined) {
  if (depths) for (let i = 0; i < depths.length; i++) {
    if (depths[i] < 0) scene[SCENE_DEPTH_OFFSET + i] = depths[i];
  }
}

function features(obs: readonly number[], scene: readonly number[]): number[] {
  return [1, obs[6], obs[7], obs[12], obs[13], obs[16], obs[17], ...scene];
}

export interface ExplorationModel {
  version: 1;
  weights: number[][];
  counts: number[];
  actions: number[][];
}

export interface ExplorationCheckpoint extends ExplorationModel {
  trained: number;
  heldOut: number;
  yawError: number;
  stillYawError: number;
}

export const newExplorationCheckpoint = (): ExplorationCheckpoint => ({
  version: 1,
  weights: Array.from({ length: CLASSES }, () => Array<number>(FEATURE_COUNT).fill(0)),
  counts: Array<number>(CLASSES).fill(0),
  actions: Array.from({ length: CLASSES }, () => Array<number>(4).fill(0)),
  trained: 0, heldOut: 0, yawError: 0, stillYawError: 0,
});

export function parseExplorationModel(value: unknown): ExplorationModel | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const { version, weights, counts, actions } = value as Partial<ExplorationModel>;
  const vector = (v: unknown, n: number) => Array.isArray(v) && v.length === n && v.every(Number.isFinite);
  if (version !== 1 || !vector(counts, CLASSES) || !counts!.every(n => Number.isSafeInteger(n) && n >= 0) || !counts!.some(Boolean) ||
      !Array.isArray(weights) || weights.length !== CLASSES || !weights.every(row => vector(row, FEATURE_COUNT)) ||
      !Array.isArray(actions) || actions.length !== CLASSES || !actions.every(row => vector(row, 4))) return undefined;
  return { version, weights, counts: counts!, actions };
}

function probabilities(model: ExplorationModel, x: number[], observedOnly: boolean): number[] {
  const logits = model.weights.map((row, id) => observedOnly && !model.counts[id] ? -Infinity : row.reduce((sum, w, i) => sum + w * x[i], 0));
  const peak = Math.max(...logits);
  const exp = logits.map(logit => Math.exp(logit - peak));
  const sum = exp.reduce((a, b) => a + b, 0);
  return exp.map(value => value / sum);
}

/** Learns a multimodal camera action and keeps movement paired with the same observed turn. */
export function trainExploration(model: ExplorationCheckpoint, rows: readonly number[][], samples: readonly ExplorationSample[], start: number, heldOut: boolean): void {
  for (const [tick, ...scene] of samples) {
    const index = tick - start, first = rows[index];
    if (!first || first[1]) continue;
    const action = [0, 0, 0, 0];
    let length = 0;
    for (; length < EXPLORATION_TICKS && index + length < rows.length; length++) {
      const row = rows[index + length];
      if (row[0] !== first[0] || row[1]) break;
      for (let j = 0; j < action.length; j++) action[j] += row[OBS + 1 + j];
    }
    if (length < EXPLORATION_TICKS / 2) continue;
    action[0] = clamp(action[0] * EXPLORATION_TICKS / length, -Math.PI, Math.PI);
    action[1] = clamp(action[1] * EXPLORATION_TICKS / length, -1.5, 1.5);
    action[2] = clamp(action[2] / length, -1, 1);
    action[3] = clamp(action[3] / length, -1, 1);
    const bin = YAW_CUTS.filter(cut => action[0] >= cut).length;
    const x = features(first.slice(1, OBS + 1), scene);
    if (heldOut) {
      if (!model.trained) continue;
      const p = probabilities(model, x, true);
      model.heldOut++;
      model.yawError += p.reduce((error, prob, id) => error + prob * Math.abs(model.actions[id][0] - action[0]), 0);
      model.stillYawError += Math.abs(action[0]);
      continue;
    }
    const p = probabilities(model, x, false);
    for (let id = 0; id < CLASSES; id++) {
      const weight = model.weights[id];
      const error = p[id] - Number(id === bin);
      for (let j = 0; j < weight.length; j++) weight[j] -= .035 * (error * x[j] + .002 * weight[j]);
    }
    model.trained++;
    const count = ++model.counts[bin];
    for (let j = 0; j < action.length; j++) model.actions[bin][j] += (action[j] - model.actions[bin][j]) / count;
  }
}

export function explorationAction(model: ExplorationModel, obs: readonly number[], scene: readonly number[], random: () => number): { yaw: number; pitch: number; mx: number; mz: number } {
  const p = probabilities(model, features(obs, scene), true);
  let ticket = random(), bin = EMPTY;
  for (let id = 0; id < p.length; id++) {
    if (!p[id]) continue;
    bin = id;
    ticket -= p[id];
    if (ticket < 0) break;
  }
  const [yaw, pitch, mx, mz] = model.actions[bin];
  return { yaw: clamp(yaw / EXPLORATION_TICKS, -.26, .26), pitch: clamp(pitch / EXPLORATION_TICKS, -.125, .125), mx: clamp(mx, -1, 1), mz: clamp(mz, -1, 1) };
}

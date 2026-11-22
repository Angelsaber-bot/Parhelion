import { EXPLORATION_SCENE_SIZE } from './exploration.ts';
import { HUMAN_FEATURES } from './humanCombat.ts';
import { RULES_VERSION } from './protocol.ts';

export const NEURAL_FEATURE_COUNT = HUMAN_FEATURES.length + EXPLORATION_SCENE_SIZE;
export const NEURAL_OUTPUT_COUNT = 14;
export const NEURAL_POLICY_VERSION = 4;
const NORM_EPSILON = 1e-5;
const MAX_MULTIPLIES = 4_000_000;

interface Linear {
  weight: number[][];
  bias: number[];
}

interface Norm {
  weight: number[];
  bias: number[];
}

interface Layer {
  norm1: Norm;
  qkv: Linear;
  attn: Linear;
  norm2: Norm;
  up: Linear;
  down: Linear;
}

export interface NeuralPolicyModel {
  version: 1 | 2 | 3 | 4;
  rulesVersion: number;
  synthetic?: true;
  controller?: 'perceptual-options-v1' | 'perceptual-options-v2' | 'learned-input-v1';
  context: number;
  width: number;
  heads: number;
  embed: Linear;
  position: number[][];
  layers: Layer[];
  norm: Norm;
  out: Linear;
}

const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const integer = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;

function vector(v: unknown, count: number): v is number[] {
  if (!Array.isArray(v) || v.length !== count) return false;
  for (const n of v) if (typeof n !== 'number' || !Number.isFinite(n) || Math.abs(n) > 64) return false;
  return true;
}

function matrix(v: unknown, rows: number, cols: number): v is number[][] {
  if (!Array.isArray(v) || v.length !== rows) return false;
  for (const row of v) if (!vector(row, cols)) return false;
  return true;
}

function linear(v: unknown, rows: number, cols: number): v is Linear {
  return object(v) && vector(v.bias, rows) && matrix(v.weight, rows, cols);
}

function norm(v: unknown, size: number): v is Norm {
  return object(v) && vector(v.bias, size) && vector(v.weight, size);
}

/** Checks dimensions, rules compatibility, numeric parameters and the per-decision compute budget. */
export function parseNeuralPolicy(raw: unknown): NeuralPolicyModel | undefined {
  if (!object(raw)) return undefined;
  const { version, rulesVersion, synthetic, controller, context, width, heads, embed, position, layers, norm: finalNorm, out } = raw;
  if (version !== 1 && version !== 2 && version !== 3 && version !== NEURAL_POLICY_VERSION) return undefined;
  const controllers = [undefined, undefined, 'perceptual-options-v1', 'perceptual-options-v2', 'learned-input-v1'] as const;
  const expectedController = controllers[version];
  if (controller !== expectedController) return undefined;
  if (rulesVersion !== RULES_VERSION || (synthetic !== undefined && synthetic !== true) || !integer(context, 1, 16) || !integer(width, 2, 128) ||
      !integer(heads, 1, 8) || width % heads || !Array.isArray(layers) || layers.length < 1 || layers.length > 6) return undefined;

  let multiplies = context * width * (NEURAL_FEATURE_COUNT + (context + 1) * layers.length);
  for (const layer of layers) {
    if (!object(layer) || !object(layer.up) || !Array.isArray(layer.up.bias) || !integer(layer.up.bias.length, 1, width * 4)) return undefined;
    multiplies += context * width * (4 * width + 2 * layer.up.bias.length);
  }
  if (multiplies > MAX_MULTIPLIES || !linear(embed, width, NEURAL_FEATURE_COUNT) ||
      !matrix(position, context, width) || !norm(finalNorm, width) || !linear(out, NEURAL_OUTPUT_COUNT, width)) return undefined;

  const validatedLayers: Layer[] = [];
  for (const layer of layers) {
    const { norm1, qkv, attn, norm2, up, down } = layer;
    const ff = up.bias.length;
    if (!norm(norm1, width) || !linear(qkv, width * 3, width) || !linear(attn, width, width) ||
        !norm(norm2, width) || !linear(up, ff, width) || !linear(down, width, ff)) return undefined;
    validatedLayers.push({ norm1, qkv, attn, norm2, up, down });
  }
  return { version, rulesVersion, context, width, heads, embed, position, layers: validatedLayers, norm: finalNorm, out,
    ...(synthetic ? { synthetic } : {}), ...(expectedController ? { controller: expectedController } : {}) };
}

type Vector = Float64Array;

interface PackedLinear {
  weight: Vector;
  bias: number[];
  columns: number;
}

function pack(source: Linear): PackedLinear {
  const columns = source.weight[0].length;
  const weight = new Float64Array(source.weight.length * columns);
  for (let row = 0; row < source.weight.length; row++) weight.set(source.weight[row], row * columns);
  return { weight, bias: source.bias, columns };
}

function compile(model: NeuralPolicyModel) {
  return {
    embed: pack(model.embed),
    layers: model.layers.map(layer => ({
      ...layer, qkv: pack(layer.qkv), attn: pack(layer.attn), up: pack(layer.up), down: pack(layer.down),
    })),
    out: pack(model.out),
  };
}

const compiledPolicies = new WeakMap<NeuralPolicyModel, ReturnType<typeof compile>>();

function multiply(matrix: PackedLinear, input: Vector, output: Vector) {
  const { weight, bias, columns } = matrix;
  for (let row = 0, offset = 0; row < bias.length; row++, offset += columns) {
    let sum = bias[row];
    for (let col = 0; col < columns; col++) sum += weight[offset + col] * input[col];
    output[row] = sum;
  }
}

function normalize(parameters: Norm, input: Vector, output: Vector) {
  let mean = 0;
  for (let i = 0; i < input.length; i++) mean += input[i];
  mean /= input.length;
  let variance = 0;
  for (let i = 0; i < input.length; i++) variance += (input[i] - mean) ** 2;
  const den = Math.sqrt(variance / input.length + NORM_EPSILON);
  for (let i = 0; i < input.length; i++) output[i] = (input[i] - mean) / den * parameters.weight[i] + parameters.bias[i];
}

function attend(qkv: Vector[], at: number, width: number, headWidth: number, scores: Vector, output: Vector) {
  const query = qkv[at], scale = 1 / Math.sqrt(headWidth);
  for (let start = 0; start < width; start += headWidth) {
    const end = start + headWidth;
    let peak = -Infinity;
    for (let token = 0; token <= at; token++) {
      const key = qkv[token];
      let score = 0;
      for (let i = start; i < end; i++) score += query[i] * key[width + i];
      scores[token] = score * scale;
      peak = Math.max(peak, scores[token]);
    }
    let total = 0;
    for (let token = 0; token <= at; token++) {
      scores[token] = Math.exp(scores[token] - peak);
      total += scores[token];
    }
    for (let i = start; i < end; i++) {
      let weighted = 0;
      for (let token = 0; token <= at; token++) weighted += scores[token] * qkv[token][2 * width + i];
      output[i] = weighted / total;
    }
  }
}

/** Executes the exported PyTorch block on a fixed, right-aligned causal history. */
export function createNeuralPolicy(model: NeuralPolicyModel) {
  let packed = compiledPolicies.get(model);
  if (!packed) {
    packed = compile(model);
    compiledPolicies.set(model, packed);
  }
  const { embed, layers, out } = packed;
  const { context, width, heads, position } = model;
  const headWidth = width / heads;
  const observations = Array.from({ length: context }, () => new Float64Array(NEURAL_FEATURE_COUNT));
  const padding = new Float64Array(NEURAL_FEATURE_COUNT);
  const tokens = Array.from({ length: context }, () => new Float64Array(width));
  const qkv = Array.from({ length: context }, () => new Float64Array(width * 3));
  const normal = new Float64Array(width), mixed = new Float64Array(width), result = new Float64Array(width);
  const ff = new Float64Array(Math.max(...layers.map(layer => layer.up.bias.length)));
  const scores = new Float64Array(context), logits = new Float64Array(NEURAL_OUTPUT_COUNT);
  let cursor = 0, count = 0;

  return {
    reset() { cursor = count = 0; },
    think(observation: readonly number[]): number[] {
      if (!vector(observation, NEURAL_FEATURE_COUNT)) throw new TypeError(`Expected ${NEURAL_FEATURE_COUNT} finite Arena observations`);
      observations[cursor].set(observation);
      cursor = (cursor + 1) % context;
      count = Math.min(count + 1, context);

      for (let at = 0; at < context; at++) {
        const fromOldest = at - context + count;
        const input = fromOldest < 0 ? padding : observations[(cursor - count + fromOldest + context) % context];
        const token = tokens[at];
        multiply(embed, input, token);
        for (let i = 0; i < width; i++) token[i] += position[at][i];
      }
      for (let depth = 0; depth < layers.length; depth++) {
        const layer = layers[depth];
        for (let at = 0; at < context; at++) {
          normalize(layer.norm1, tokens[at], normal);
          multiply(layer.qkv, normal, qkv[at]);
        }
        const lastOnly = depth === layers.length - 1;
        for (let at = lastOnly ? context - 1 : 0; at < context; at++) {
          const token = tokens[at];
          attend(qkv, at, width, headWidth, scores, mixed);
          multiply(layer.attn, mixed, result);
          for (let i = 0; i < width; i++) token[i] += result[i];

          normalize(layer.norm2, token, normal);
          multiply(layer.up, normal, ff);
          for (let i = 0; i < layer.up.bias.length; i++) ff[i] = Math.max(0, ff[i]);
          multiply(layer.down, ff, result);
          for (let i = 0; i < width; i++) token[i] += result[i];
        }
      }
      normalize(model.norm, tokens[context - 1], normal);
      multiply(out, normal, logits);
      return Array.from(logits);
    },
  };
}

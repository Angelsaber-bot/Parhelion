import { expect, it } from 'vitest';
import { createNeuralPolicy, NEURAL_FEATURE_COUNT, NEURAL_OUTPUT_COUNT, parseNeuralPolicy, type NeuralPolicyModel } from '../shared/neuralPolicy.ts';
import { RULES_VERSION } from '../shared/protocol.ts';

function fixture(): NeuralPolicyModel {
  const width = 4, context = 3;
  const linear = (rows: number, cols: number, seed: number) => ({
    weight: Array.from({ length: rows }, (_, row) => Array.from({ length: cols }, (_, col) => Math.sin(2 + seed + (row + 1) * .71 + (col + 1) * .43) * .31)),
    bias: Array.from({ length: rows }, (_, i) => Math.cos(seed + i * 1.3) * .11),
  });
  const norm = (seed: number) => ({
    weight: Array.from({ length: width }, (_, i) => 1 + Math.sin(seed + i * 1.1) * .28),
    bias: Array.from({ length: width }, (_, i) => Math.cos(seed + i * .97) * .16),
  });
  return {
    version: 1, rulesVersion: RULES_VERSION, context, width, heads: 2,
    embed: linear(width, NEURAL_FEATURE_COUNT, 0),
    position: Array.from({ length: context }, (_, t) => Array.from({ length: width }, (_, i) => Math.sin(t * .88 + i * .61) * .35)),
    layers: Array.from({ length: 2 }, (_, i) => ({
      norm1: norm(i * 7 + .4), qkv: linear(width * 3, width, i * 7 + 1), attn: linear(width, width, i * 7 + 2),
      norm2: norm(i * 7 + 3), up: linear(5, width, i * 7 + 4), down: linear(width, 5, i * 7 + 5),
    })),
    norm: norm(16),
    out: linear(NEURAL_OUTPUT_COUNT, width, 17),
  };
}

it('rejects models that cannot run on this version of the game', () => {
  const model = fixture();
  expect(parseNeuralPolicy(model)).toEqual(model);
  expect(parseNeuralPolicy({ ...model, rulesVersion: RULES_VERSION - 1 })).toBeUndefined();
  expect(parseNeuralPolicy({ ...model, synthetic: true })?.synthetic).toBe(true);
  expect(parseNeuralPolicy({ ...model, synthetic: 'true' })).toBeUndefined();
  expect(parseNeuralPolicy({ ...model, heads: 3 })).toBeUndefined();
  expect(parseNeuralPolicy({ ...model, context: 17 })).toBeUndefined();
  const gigantic = { ...model, width: 128, context: 16, layers: Array.from({ length: 6 }, () => ({ up: { bias: Array(512).fill(0) } })) };
  expect(parseNeuralPolicy(gigantic)).toBeUndefined();
  const nonFinite = fixture();
  nonFinite.layers[0].qkv.weight[0][0] = Infinity;
  expect(parseNeuralPolicy(nonFinite)).toBeUndefined();
  const malformed = fixture();
  malformed.layers[0].down.weight[0].pop();
  expect(parseNeuralPolicy(malformed)).toBeUndefined();
});

it('executes causal attention with fixed positions, left padding and rolling history', () => {
  const policy = createNeuralPolicy(fixture());
  const observations = Array.from({ length: 5 }, (_, t) => Array.from({ length: NEURAL_FEATURE_COUNT }, (_, i) => Math.cos(t * .82 + i * .37) * .9));
  // Independent matrix reference for both trained-style blocks, showing the first four outputs.
  const expected = [
    [-0.11392451001021626,-0.29719116856880773,-0.4289214638019359,-0.43234649301016886],
    [0.07591442448080114,0.42587790232376654,0.477935635852659,0.2200361387959973],
    [0.08278818861416727,0.4843127753942888,0.5596914316493499,0.28560222307242583],
    [0.07995441463196275,0.4892288366031242,0.5699815124331874,0.2962933717982404],
    [0.06594583717672402,0.46468696452850405,0.5467668495947702,0.285625013351602]
  ];
  const output = observations.map(features => policy.think(features));
  for (let step = 0; step < expected.length; step++) {
    expect(output[step]).toHaveLength(NEURAL_OUTPUT_COUNT);
    for (let i = 0; i < expected[step].length; i++) expect(output[step][i]).toBeCloseTo(expected[step][i], 9);
  }
  expect(() => policy.think([1])).toThrow(/Arena observations/);
  policy.reset();
  expect(policy.think(observations[0])).toEqual(output[0]);
});


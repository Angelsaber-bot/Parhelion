import { describe, expect, it } from 'vitest';
import { SMOKE } from '../shared/content.ts';
import { smokeAllowsGlimpse, smokeBlocks, type Smoke } from '../shared/grenade.ts';
import { HUMAN_FEATURES } from '../shared/humanCombat.ts';
import { explorationAction, explorationScene, EXPLORATION_TICKS, parseExplorationModel } from '../shared/exploration.ts';
import { getMap } from '../shared/arenaMap.ts';
import { BTN, newPlayer } from '../shared/sim.ts';
import { newTrainingCheckpoint, parseTrainingBatch, trainArenaBatch, TRAINING_BATCH_TICKS, type TrainingBatch } from '../shared/trainingData.ts';
import { HumanDemo } from '../src/player/humanDemo.ts';
import { makeSelfPlayBatch } from '../worker/trainingSelfPlay.ts';

const input = { seq: 0, yaw: .03, pitch: 0, mx: .5, mz: -.75, buttons: BTN.FIRE | BTN.CROUCH, weapon: 1, view: 0 };
const observe = () => HUMAN_FEATURES.map((_, i) => i === 0 ? 1 : 0);

describe('automatic Arena data', () => {
  it('flushes the finished match and labels a rematch as a new capture', () => {
    const batches: TrainingBatch[] = [];
    const demo = new HumanDemo('aster', batch => batches.push(batch));
    const player = newPlayer('p', 'A', 0);
    demo.beginRound();
    demo.record(player, input, observe);
    demo.beginRound();
    demo.record(player, { ...input, seq: 5 }, observe);
    demo.pause();
    expect(batches).toHaveLength(2);
    expect(batches[0].capture).not.toBe(batches[1].capture);
    expect(batches.map(batch => [batch.sequence, batch.start, batch.rows.length])).toEqual([[0, 0, 1], [0, 0, 1]]);
  });
  it('sends consecutive batches and the tail, without an external account identifier', () => {
    const batches: TrainingBatch[] = [];
    const demo = new HumanDemo('aster', batch => batches.push(batch));
    const player = newPlayer('test-account-name', 'A', 0);
    for (let i = 0; i < TRAINING_BATCH_TICKS + 7; i++) demo.record(player, { ...input, seq: i }, observe);
    demo.pause();
    expect(batches.map(b => [b.sequence, b.start, b.rows.length])).toEqual([[0, 0, TRAINING_BATCH_TICKS], [1, TRAINING_BATCH_TICKS, 7]]);
    expect(batches[0].rows[0].slice(-6)).toEqual([.03, 0, .5, -.75, BTN.FIRE | BTN.CROUCH, 1]);
    expect(batches.every(b => parseTrainingBatch(b))).toBe(true);
    expect(JSON.stringify(batches)).not.toContain('test-account-name');
  });

  it('filters extra metadata and rejects malformed, premature or unbounded samples', () => {
    const batches: TrainingBatch[] = [];
    const demo = new HumanDemo('aster', b => batches.push(b));
    demo.record(newPlayer('a', 'A', 0), input, observe);
    demo.flush();
    const [batch] = batches;
    expect(parseTrainingBatch({ ...batch, name: 'ignored' })).toEqual(batch);
    expect(parseTrainingBatch({ ...batch, rows: [batch.rows[0].slice(1)] })).toBeNull();
    expect(parseTrainingBatch({ ...batch, views: [[2, 1, 'A'.repeat(192)]] })).toBeNull();
  });

  it('keeps neural scene anchors during both visible combat and exploration', () => {
    const batches: TrainingBatch[] = [];
    const demo = new HumanDemo('aster', batch => batches.push(batch));
    const player = newPlayer('player', 'A', 0);
    const blank = HUMAN_FEATURES.map(() => 0);
    for (let i = 0; i < 2 * EXPLORATION_TICKS; i++) {
      demo.record(player, { ...input, seq: i }, i < EXPLORATION_TICKS ? observe : () => blank,
        lastContact => explorationScene(getMap('aster'), player, lastContact));
    }
    demo.flush();
    const [batch] = batches;
    expect(parseTrainingBatch(batch)).toEqual(batch);
    expect(batch.exploration?.map(([i]) => [i, batch.rows[i][1]])).toEqual([[0, 1], [EXPLORATION_TICKS, 0]]);
    const state = newTrainingCheckpoint();
    trainArenaBatch(state, { ...batch, capture: '0'.repeat(31) + '1' });
    expect(state.exploration?.trained).toBe(1);
  });

  it('updates actual weights from training input without fitting the held-out match', () => {
    const batches: TrainingBatch[] = [];
    const demo = new HumanDemo('aster', b => batches.push(b));
    for (let i = 0; i < 90; i++) demo.record(newPlayer('a', 'A', 0), { ...input, seq: i }, observe);
    demo.flush();
    const state = newTrainingCheckpoint();
    trainArenaBatch(state, { ...batches[0], capture: '0'.repeat(31) + '1' });
    expect(state.trained).toBe(90);
    expect(state.weights[4][0]).toBeGreaterThan(0);
    expect(state.weights[10][0]).toBeLessThan(0);
    const weights = state.weights.map(row => row.slice());
    trainArenaBatch(state, { ...batches[0], capture: '0'.repeat(32) });
    expect(state.heldOut).toBe(90);
    expect(state.weights).toEqual(weights);
    expect(state.recentHoldoutLoss).toBeLessThan(.3);
  });

  it('can generate and learn from a real simulated duel while no client is connected', () => {
    const batch = makeSelfPlayBatch(300);
    expect(parseTrainingBatch(batch)).not.toBeNull();
    const state = newTrainingCheckpoint();
    trainArenaBatch(state, batch);
    expect(state.trained).toBeGreaterThan(0);
  });

  it('learns distinct camera movements with no visible target and scores held-out captures separately', () => {
    function capture(yaw: number) {
      const batches: TrainingBatch[] = [];
      const demo = new HumanDemo('aster', batch => batches.push(batch));
      const me = newPlayer('p', 'A', 0);
      const observation = HUMAN_FEATURES.map(() => 0);
      const scene = explorationScene(getMap('aster'), me);
      for (let i = 0; i < EXPLORATION_TICKS; i++) {
        demo.record(me, { ...input, seq: i, yaw, pitch: .02 }, () => observation, () => scene);
      }
      demo.flush();
      const [batch] = batches;
      expect(parseTrainingBatch(batch)).toEqual(batch);
      expect(parseTrainingBatch({ ...batch, exploration: [[EXPLORATION_TICKS, ...scene]] })).toBeNull();
      return { batch, observation, scene };
    }
    const positive = capture(.05), negative = capture(-.08);
    const state = newTrainingCheckpoint();
    for (const { batch } of [positive, negative]) trainArenaBatch(state, { ...batch, capture: '0'.repeat(31) + '1' });
    const model = parseExplorationModel(state.exploration)!;
    const before = JSON.stringify(model);
    trainArenaBatch(state, { ...negative.batch, capture: '0'.repeat(32) });
    expect(state.exploration?.trained).toBe(2);
    expect(state.exploration?.heldOut).toBe(1);
    expect(JSON.stringify(model)).toBe(before);
    const left = explorationAction(model, negative.observation, negative.scene, () => .01);
    expect(left).toMatchObject({ mx: .5, mz: -.75 });
    expect(left.yaw).toBeCloseTo(-.08);
    expect(left.pitch).toBeCloseTo(.02);
    expect(explorationAction(model, positive.observation, positive.scene, () => .99).yaw).toBeCloseTo(.05);
  });
});

it('permits thin-edge silhouettes without revealing enemies across the smoke core', () => {
  const s: Smoke = { id: 1, owner: 'p', x: 0, y: 0, z: 0, life: SMOKE.life - SMOKE.bloom };
  const edge: [number, number, number] = [0, .2, SMOKE.radius - .05];
  const outside: [number, number, number] = [0, .2, SMOKE.radius + 1];
  expect(smokeBlocks([s], outside, edge)).toBe(true);
  expect(smokeAllowsGlimpse([s], outside, edge)).toBe(true);
  expect(smokeAllowsGlimpse([s], [0, .2, -3], [0, .2, 3])).toBe(false);
});

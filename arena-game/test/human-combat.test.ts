import { expect, it, vi } from 'vitest';
import { ARENA_MAP } from '../shared/arenaMap.ts';
import { HUMAN_FEATURES, humanCombatPolicy, humanObservation, type HumanCombatModel } from '../shared/humanCombat.ts';
import { RULES_VERSION } from '../shared/protocol.ts';
import { BTN, newPlayer } from '../shared/sim.ts';
import { HumanDemo } from '../src/player/humanDemo.ts';

it('records only derived game inputs, separating respawns and gaps in a capture', () => {
  const demo = new HumanDemo('aster');
  const me = newPlayer('secret-name', 'A', 0);
  me.yaw = Math.PI - .015;
  const input = { seq: 9, yaw: -Math.PI + .015, pitch: 0, mx: 0, mz: 0, buttons: BTN.FIRE, weapon: 0, view: 0 };
  const observe = (last: readonly [number, number]) => HUMAN_FEATURES.map((f) => f === 'previousYaw' ? last[0] : 0);
  demo.record(me, input, observe);
  demo.record(me, { ...input, seq: 10 }, observe);
  demo.record(me, { ...input, seq: 12 }, observe);
  me.lifeId++;
  demo.record(me, { ...input, seq: 13 }, observe);
  const raw = demo.serialize(), data = JSON.parse(raw);
  expect(raw).not.toContain('secret-name');
  expect(data.frames.map((row: number[]) => row[0])).toEqual([1, 1, 2, 3]);
  expect(data.frames.map((row: number[]) => row.slice(-3))).toEqual(Array(4).fill([.03, 0, 1]));
  expect(data.frames.map((row: number[]) => row[1 + HUMAN_FEATURES.indexOf('previousYaw')])).toEqual([0, .03, 0, 0]);
});

it('tags a captured game frame with the next input index, not already consumed training labels', () => {
  const buffer = {
    getContext: () => ({ canvas: buffer, fillRect() {}, drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray(192 * 108 * 4).fill(40) }) }),
    toDataURL: () => 'data:image/jpeg;base64,ZmFrZQ==',
  };
  vi.stubGlobal('document', { createElement: () => buffer });
  try {
    const demo = new HumanDemo('aster'), me = newPlayer('a', 'A', 0);
    const observe = () => HUMAN_FEATURES.map(() => 0);
    const input = { seq: 1, yaw: 0, pitch: 0, mx: 0, mz: 0, buttons: 0, weapon: 0, view: 0 };
    const source = { width: 100, height: 100 } as HTMLCanvasElement;
    demo.record(me, input, observe);
    demo.captureView(source);
    demo.captureView(source);
    demo.record(me, { ...input, seq: 2 }, observe);
    const { views } = JSON.parse(demo.serialize());
    expect(views).toHaveLength(1);
    expect(views[0].slice(0, 3)).toEqual([1, 1, 'ZmFrZQ==']);
    expect(Array.from(atob(views[0][3]), c => c.charCodeAt(0))).toEqual(Array(16 * 9).fill(40));
  } finally { vi.unstubAllGlobals(); }
});

it('does not expose a wall- or smoke-blocked target to the learned scorer', () => {
  const me = newPlayer('self', 'A', 0);
  me.yaw = 0;
  const targets = [{ team: 'B' as const, crouched: false, feet: [0, 0, -10] as [number, number, number] }];
  expect(humanObservation(ARENA_MAP, me, targets, () => true, [0, 0])[0]).toBe(1);
  expect(humanObservation(ARENA_MAP, me, targets, () => false, [0, 0])).toEqual(humanObservation(ARENA_MAP, me, [], () => true, [0, 0]));
  expect(humanObservation(ARENA_MAP, me, [{ ...targets[0], feet: [0, 0, 10] }], () => true, [0, 0])[0]).toBe(0);
});

it('uses older observations when scoring a turn and resets history at a new life', () => {
  const zeros = () => HUMAN_FEATURES.map(() => 0);
  const previousContact = zeros(); previousContact[0] = 10;
  const model: HumanCombatModel = {
    version: 1, rulesVersion: RULES_VERSION, features: HUMAN_FEATURES, offsets: [0, 1],
    weights: [[...zeros(), ...previousContact]], bias: [0], output: [[-10], [10], [0], [10]],
    outputBias: [0, -2, 0, -2], centers: [[0, .02], [0]],
  };
  const policy = humanCombatPolicy(model, () => .5);
  expect(policy.think([1, ...zeros().slice(1)]).yaw).toBe(.02);
  expect(policy.think(zeros())).toEqual({ yaw: .02, pitch: 0, fire: true });
  policy.reset();
  expect(policy.think(zeros())).toEqual({ yaw: 0, pitch: 0, fire: false });
});

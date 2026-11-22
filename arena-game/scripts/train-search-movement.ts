// Outcome-based fine tuning of the released actor. Only this offline exercise sees the
// scoreboard and the path traveled. The actor uses its regular player-visible sensors.
import fs from 'node:fs';
import { MAPS } from '../shared/arenaMap.ts';
import { parseNeuralPolicy, type NeuralPolicyModel } from '../shared/neuralPolicy.ts';
import { evaluateSmokeEdge } from './evaluation/evaluate-smoke-edge.ts';
import { assess, fixtures, rng } from './evaluation/evaluate-spawn-search.ts';

// Search only the yaw and movement readouts. Other action heads and the shared perception network stay frozen.
function mutate(parent: NeuralPolicyModel, random: () => number, scale: number, axes = [0, 2, 3]) {
  const model = structuredClone(parent);
  for (const axis of axes) {
    const weight = model.out.weight[axis];
    for (let i = 0; i < weight.length; i++)weight[i] += scale * (random() + random() + random() - 1.5);
    model.out.bias[axis] += scale * (random() - .5);
  }
  return model;
}
function read(path: string) {
  const parsed = parseNeuralPolicy(JSON.parse(fs.readFileSync(path, 'utf8')));
  if (!parsed || parsed.version !== 4 || parsed.synthetic) throw Error('Expected a released direct actor');
  return parsed;
}
const [mode, incumbentPath, output, argument, startPath] = process.argv.slice(2);
if (!['train', 'evaluate', 'refine-routes'].includes(mode) || !output) throw Error('Use train|evaluate incumbent.json candidate.json [rounds or seed], or refine-routes incumbent.json output.json rounds starting.json');
const count = Number(argument ?? (mode === 'evaluate' ? 872043 : 16));
if (!Number.isSafeInteger(count) || count < 1) throw Error('Expected a positive round count or evaluation seed');
const incumbent = read(incumbentPath);
if (mode === 'evaluate') {
  const held = fixtures(MAPS.map(m => m.id), count, 3);
  for (const [name, actor] of [['incumbent', incumbent], ['candidate', read(output)]] as const)
    console.log(name, JSON.stringify(assess(actor, incumbent, held, 30)));
} else if (mode === 'refine-routes') {
  if (!startPath) throw Error('Supply the human-fitted actor as the final argument');
  let parent = read(startPath);
  const random = rng(5348297);
  const maps = ['camlann', 'frostcourt', 'blackflag', 'orleans', 'homeward', 'sakura'];
  for (let round = 0; round < count; round++) {
    const boards = [maps[round % maps.length], maps[(round + 3) % maps.length]];
    const trials = fixtures(boards, 290813 + round, 3);
    const score = (actor: NeuralPolicyModel) => {
      const stats = assess(actor, incumbent, trials, 16);
      const smoke = evaluateSmokeEdge(actor, 81417 + round, boards, 3);
      return stats.score - 36 * (stats.openingOverlap ?? 1) + 16 * stats.acquired + smoke.hit * 2;
    };
    let winner = parent, best = score(parent);
    for (let i = 0; i < 8; i++) {
      const next = mutate(parent, random, i % 2 ? .024 : .044, [0]);
      const result = score(next);
      if (result > best) { best = result; winner = next; }
    }
    parent = winner;
    fs.writeFileSync(output, JSON.stringify(parent) + '\n');
    console.log(round, best);
  }
} else {
  const random = rng(61231), training = ['aster', 'sakura', 'blackflag', 'frostcourt', 'camlann', 'homeward'];
  let current = incumbent;
  const selection = fixtures(training, 943287, 3);
  const selectionBaseline = assess(incumbent, incumbent, selection, 30);
  let selected = incumbent, selectedScore = selectionBaseline.score;
  for (let round = 0; round < count; round++) {
    const maps = [training[round % 6], training[(round + 2) % 6], training[(round + 4) % 6]];
    const trials = fixtures(maps, 15431 + Math.floor(round / 2), 1);
    let winner = current, best = assess(current, incumbent, trials, 30);
    for (let sample = 0; sample < 12; sample++) {
      const candidate = mutate(current, random, (sample % 2 ? .035 : .09), [2, 3]);
      const result = assess(candidate, incumbent, trials, 30);
      if (result.score > best.score) { winner = candidate; best = result; }
    }
    current = winner;
    const validation = assess(current, incumbent, selection, 30);
    if (validation.score > selectedScore && validation.stalled <= selectionBaseline.stalled &&
        validation.waitingAcquired >= selectionBaseline.waitingAcquired &&
        validation.acquired >= selectionBaseline.acquired && validation.reach >= selectionBaseline.reach &&
        validation.forwardMetersPerSecond > selectionBaseline.forwardMetersPerSecond) {
      selectedScore = validation.score;
      selected = current;
    }
    if ((round + 1) % 4 === 0) current = selected;
    fs.writeFileSync(output, JSON.stringify(selected) + '\n');
    console.log(round, JSON.stringify(best));
  }
}

// Optimize a small residual on the human-fitted combat head. Movement and the perception encoder are frozen.
import fs from 'node:fs';
import { directPolicy } from '../shared/learnedOpponent.ts';
import { parseNeuralPolicy, type NeuralPolicyModel } from '../shared/neuralPolicy.ts';
import { sightlines } from './evaluation/evaluate-sightlines.ts';

const [source, output] = process.argv.slice(2);
const base = parseNeuralPolicy(JSON.parse(fs.readFileSync(source, 'utf8')));
if (!directPolicy(base)) throw Error('Expected a player-fitted Arena model');
let actor: NeuralPolicyModel = base;
let state = 4917303;
const draw = () => ((state = (Math.imul(1664525, state) + 1013904223) >>> 0) + .5) / 4294967296;
for (let round = 0; round < 18; round++) {
  const seed = Math.floor(draw() * 0x7fffffff);
  const assess = (m: NeuralPolicyModel) => sightlines(m, seed, ['sakura', 'homeward', 'blackflag'], 2).reduce(
    (total, r) => total + (5 * r.hit + .25 * r.fired - .04 * r.missedShots - .2 * r.blindShots) / Math.max(1, r.trials), 0);
  let chosen = actor, best = assess(actor);
  for (let n = 0; n < 8; n++) {
    const m = structuredClone(actor);
    for (const axis of [0, 1, 4]) {
      const scale = axis === 4 ? .20 : .014;
      m.out.bias[axis] += scale * (draw() - .5);
      m.out.weight[axis] = m.out.weight[axis].map(w => w + scale * (draw() + draw() + draw() - 1.5));
    }
    const score = assess(m);
    if (score > best) { best = score; chosen = m; }
  }
  actor = chosen;
}
fs.writeFileSync(output, JSON.stringify(actor) + '\n');

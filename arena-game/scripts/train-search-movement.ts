// Outcome-based fine tuning of the released actor. Only this offline exercise sees the
// scoreboard and the path traveled. The actor uses its regular player-visible sensors.
import fs from 'node:fs';
import { getMap, MAPS } from '../shared/arenaMap.ts';
import { greedyAction, neuralBotControl } from '../shared/botNeuralControl.ts';
import { TICK_HZ } from '../shared/content.ts';
import { wrapAngle } from '../shared/humanCombat.ts';
import { learnedOpponent } from '../shared/learnedOpponent.ts';
import { Match } from '../shared/match.ts';
import { parseNeuralPolicy, type NeuralPolicyModel } from '../shared/neuralPolicy.ts';
import { evaluateSmokeEdge } from './evaluation/evaluate-smoke-edge.ts';
import { trialSeed } from './self-play-seeds.ts';

function rng(seed: number) {
  let value = seed >>> 0;
  return () => ((value = (Math.imul(value, 1664525) + 1013904223) >>> 0) + .5) / 4294967296;
}

interface Trial { map: string; side: 'A' | 'B'; seed: number }
function fixtures(maps: string[], seed: number, repeats: number): Trial[] {
  return maps.flatMap(map => Array.from({ length: repeats }, (_, i) => (['A', 'B'] as const).map(side => ({
    map, side, seed: trialSeed(seed, 'search-' + side, map, i),
  }))).flat());
}

function play(model: NeuralPolicyModel, opponent: NeuralPolicyModel, trial: Trial, seconds: number) {
  const game = new Match(getMap(trial.map), '1v1'), random = rng(trial.seed);
  let visible = false, acquired = false, damage = 0, received = 0, spins = 0, windows = 0, stalled = 0, contacts = 0;
  let travel = 0, heading = 0, reach = 0, bestReach = 0, life = -1, originX = 0, originZ = 0;
  let startX = 0, startZ = 0, previousYaw = 0, windowRange = 0, unseen = true, frames = 0, seq = 0;
  const cells = new Set<string>();
  const openingRoute = new Set<string>();
  const actor = neuralBotControl(model, (obs, logits) => {
    visible = !!obs[0]; acquired ||= visible;
    if (visible) contacts++;
    return greedyAction(obs, logits);
  });
  const common = { skins: [], bot: true };
  game.addPlayer('pilot', { ...common, name: 'pilot', team: trial.side, char: Math.floor(random() * 7) }, {
    think(match, id) {
      const me = match.player(id)!;
      const input = { seq: ++seq, view: match.tick, yaw: me.yaw, pitch: me.pitch, mx: 0, mz: 0, buttons: 0, weapon: me.weaponSlot };
      if (me.alive && match.phase === 'live') return actor.apply(match, me, input);
      actor.reset(); return input;
    },
  });
  game.addPlayer('rival', { ...common, name: 'rival', team: trial.side === 'A' ? 'B' : 'A', char: Math.floor(random() * 7) }, learnedOpponent(opponent));
  game.phase = 'countdown'; game.phaseT = 1; game.step(); game.snapshot();
  for (const slot of game.slots.values()) slot.state.yaw = wrapAngle(slot.state.yaw + (random() - .5) * Math.PI * 1.8);
  for (let tick = 0; tick < seconds * TICK_HZ; tick++) {
    const me = game.player('pilot')!, x = me.x, z = me.z;
    game.step();
    for (const ev of game.snapshot().events) if (ev.t === 'hit') {
      if (ev.shooter === 'pilot') damage += ev.dmg;
      if (ev.victim === 'pilot') received += ev.dmg;
    }
    if (!me.alive) continue;
    if (life !== me.lifeId) {
      life = me.lifeId; frames = 0; originX = me.x; originZ = me.z; previousYaw = me.yaw;
      reach = 0;
    }
    if (frames === 0) { startX = me.x; startZ = me.z; windowRange = 0; unseen = true; heading = 0; }
    reach = Math.max(reach, Math.hypot(me.x - originX, me.z - originZ)); bestReach = Math.max(bestReach, reach);
    const cell = Math.floor(me.x / 3) + ',' + Math.floor(me.z / 3);
    cells.add(cell);
    if (tick < 8 * TICK_HZ && Math.hypot(me.x - originX, me.z - originZ) >= 3) openingRoute.add(cell);
    travel += Math.min(1, Math.hypot(me.x - x, me.z - z));
    heading += wrapAngle(me.yaw - previousYaw); previousYaw = me.yaw;
    windowRange = Math.max(windowRange, Math.hypot(me.x - startX, me.z - startZ)); unseen &&= !visible;
    if (++frames === 3 * TICK_HZ) {
      if (unseen) {
        windows++; if (windowRange < 1.5) stalled++;
        if (windowRange < 2.5 && Math.abs(heading) > Math.PI * .65) spins++;
      }
      frames = 0;
    }
  }
  return { openingRoute, cells: cells.size, reach: bestReach, spins, stalled, windows, acquired: Number(acquired), contacts, damage, received, travel };
}

function assess(model: NeuralPolicyModel, opponent: NeuralPolicyModel, trials: Trial[], seconds: number) {
  const rows = trials.map(t => play(model, opponent, t, seconds));
  const mean = (key: Exclude<keyof typeof rows[number], 'openingRoute'>) => rows.reduce((total, r) => total + r[key], 0) / rows.length;
  const stats = {
    cells: mean('cells'), reach: mean('reach'), spins: mean('spins'), stalled: mean('stalled'), windows: mean('windows'),
    acquired: mean('acquired'), contacts: mean('contacts'), damage: mean('damage'), received: mean('received'), travel: mean('travel')
  };
  const score = stats.cells * .25 + stats.reach * .12 + stats.acquired * 6 + Math.min(40, stats.contacts) * .35 +
    stats.damage * .085 - stats.received * .035 - stats.spins * 5 - stats.stalled * 2.5;
  // Pair distinct starts on the same map and side. Two empty routes are equally repetitive.
  let shared = 0, pairs = 0;
  for (let i = 0; i < trials.length; i++) {
    for (let j = i + 1; j < trials.length; j++) {
      if (trials[i].map !== trials[j].map || trials[i].side !== trials[j].side) continue;
      const a = rows[i].openingRoute, b = rows[j].openingRoute;
      const union = new Set([...a, ...b]);
      shared += union.size ? [...a].filter(cell => b.has(cell)).length / union.size : 1;
      pairs++;
    }
  }
  return { score, ...stats, openingPairs: pairs, openingOverlap: pairs ? shared / pairs : null };
}

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
  const benchmark = (candidate: NeuralPolicyModel, trials: Trial[], round: number) => {
    const field = assess(candidate, incumbent, trials, 24);
    const smoke = evaluateSmokeEdge(candidate, 247081 + (round % 5), ['camlann', 'sakura'], 5);
    return { ...field, score: field.score + smoke.hit * 2 + smoke.hitUnder2s, smoke: smoke.hit };
  };
  for (let round = 0; round < count; round++) {
    const maps = [training[round % 6], training[(round + 2) % 6], training[(round + 4) % 6]];
    const trials = fixtures(maps, 15431 + Math.floor(round / 2), 1);
    let winner = current, best = benchmark(current, trials, round);
    for (let sample = 0; sample < 12; sample++) {
      const candidate = mutate(current, random, (sample % 2 ? .018 : .045) / (1 + round * .04));
      const result = benchmark(candidate, trials, round);
      if (result.score > best.score) { winner = candidate; best = result; }
    }
    current = winner;
    fs.writeFileSync(output, JSON.stringify(current) + '\n');
    console.log(round, JSON.stringify(best));
  }
}

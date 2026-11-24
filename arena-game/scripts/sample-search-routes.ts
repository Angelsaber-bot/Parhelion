// Offline stationary-target demonstrations. The saved inputs contain only the actor's observations.
import { closeSync, openSync, readFileSync, writeSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { getMap } from '../shared/arenaMap.ts';
import { navFor } from '../shared/botLocomotion.ts';
import { greedyAction, neuralBotControl } from '../shared/botNeuralControl.ts';
import { randomBotLoadout, randomBotUtility, TICK_HZ } from '../shared/content.ts';
import { wrapAngle } from '../shared/humanCombat.ts';
import { Match } from '../shared/match.ts';
import { parseNeuralPolicy, type NeuralPolicyModel } from '../shared/neuralPolicy.ts';
import type { PlayerState } from '../shared/sim.ts';
import { fixtures, rng } from './evaluation/evaluate-spawn-search.ts';

type Point = Pick<PlayerState, 'x' | 'y' | 'z'>;
type Goal = Pick<Point, 'x' | 'z'>;

function routeGuide(game: Match, original: boolean) {
  const nav = navFor(game);
  const goals = new Map<number, Goal | undefined>();
  return (pilot: PlayerState, rival: PlayerState, logits: number[]) => {
    const here = nav.nearest(pilot.x, pilot.y, pilot.z);
    if (!here) return;
    const clear = (p: Point) => game.heroes.visible([p.x, p.y + game.map.eye, p.z], [rival.x, rival.y + 1.1, rival.z]);
    if (!goals.has(here.id)) {
      if (clear(pilot)) goals.set(here.id, { x: rival.x, z: rival.z });
      else {
        const end = nav.nearest(rival.x, rival.y, rival.z);
        const path = end && nav.path(here, end);
        const prefix = path?.slice(0, 3);
        goals.set(here.id, prefix?.find(clear) ?? prefix?.at(-1));
      }
    }
    const goal = goals.get(here.id);
    if (!goal || Math.hypot(goal.x - pilot.x, goal.z - pilot.z) <= (original ? 1 : 1.2)) return;
    const turn = wrapAngle(Math.atan2(pilot.x - goal.x, pilot.z - goal.z) - pilot.yaw);
    const pitchGoal = clear(pilot) ? Math.atan2(rival.y + 1.1 - pilot.y - game.map.eye,
      Math.hypot(rival.x - pilot.x, rival.z - pilot.z)) : 0;
    return [Math.max(-1.5, Math.min(1.5, turn / .9)),
      original ? logits[1] : Math.max(-1.2, Math.min(1.2, (pitchGoal - pilot.pitch) / .55)),
      -1.4 * Math.sin(turn), 1.4 * Math.cos(turn)];
  };
}

function sample(policy: NeuralPolicyModel, seed: number, side: 'A' | 'B', original: boolean, save: boolean) {
  const game = new Match(getMap('frostcourt'), '1v1'), random = rng(seed);
  const guide = routeGuide(game, original), history: number[][] = [];
  const rows: { history: number[][]; axes: number[] }[] = [];
  let pilotLife: number | undefined, rivalLife: number | undefined, clearTick = -1, ended = false, seq = 0;
  const actor = neuralBotControl(policy, (obs, logits) => {
    const pilot = game.player('pilot')!, rival = game.player('rival')!;
    pilotLife ??= pilot.lifeId;
    rivalLife ??= rival.lifeId;
    if (!rival.alive || pilot.lifeId !== pilotLife || rival.lifeId !== rivalLife) ended = true;
    if (!ended && obs[0] === 1) clearTick = game.tick;
    if (ended || obs[0]) return greedyAction(obs, logits);
    history.push(obs);
    if (history.length > policy.context) history.shift();
    const axes = guide(pilot, rival, logits);
    const action = greedyAction(obs, logits);
    if (!axes) return action;
    if (save) {
      const padding = Array<number[]>(policy.context - history.length).fill(Array(obs.length).fill(0));
      rows.push({ history: [...padding, ...history], axes });
    }
    return { ...action, axes };
  });
  const kit = () => ({ skins: [], bot: true, char: Math.floor(random() * 7),
    loadout: randomBotLoadout(random), utility: randomBotUtility(random) });
  game.addPlayer('pilot', { ...kit(), name: 'pilot', team: side }, {
    think(match, id) {
      const me = match.player(id)!;
      const input = { seq: ++seq, view: match.tick, yaw: me.yaw, pitch: me.pitch, mx: 0, mz: 0, buttons: 0, weapon: me.weaponSlot };
      if (me.alive && match.phase === 'live') return actor.apply(match, me, input);
      actor.reset();
      return input;
    },
  });
  game.addPlayer('rival', { ...kit(), name: 'rival', team: side === 'A' ? 'B' : 'A' });
  game.phase = 'countdown'; game.phaseT = 1; game.step(); game.snapshot();
  if (seed % 2) for (const slot of game.slots.values()) slot.state.yaw = wrapAngle(slot.state.yaw + (random() - .5) * Math.PI * 1.8);
  for (let t = 0; t < 30 * TICK_HZ && clearTick < 0 && !ended; t++) {
    game.step();
    game.snapshot();
  }
  return { seed, side, clearTick, rows };
}

// Without an output path, print only paired trial outcomes. A new NDJSON file stores successful hidden routes.
const [modelPath, campaignArg, guideName, output] = process.argv.slice(2);
const campaign = Number(campaignArg);
if (!modelPath || !Number.isSafeInteger(campaign) || !['control', 'skip12'].includes(guideName))
  throw Error('Usage: sample-search-routes.ts policy.json campaign control|skip12 [new-examples.ndjson]');
const checkpoint = readFileSync(modelPath);
const json = modelPath.endsWith('.gz') ? gunzipSync(checkpoint) : checkpoint;
const policy = parseNeuralPolicy(JSON.parse(json.toString('utf8')));
if (!policy || policy.version !== 4 || policy.synthetic) throw Error('Expected a trained direct policy.');
const file = output ? openSync(output, 'wx') : undefined;
try {
  for (const fixture of fixtures(['frostcourt'], campaign, 32)) {
    const { seed, side, clearTick, rows } = sample(policy, fixture.seed % 2147483648, fixture.side, guideName === 'control', file !== undefined);
    console.log(JSON.stringify({ seed, side, clearTick }));
    if (file !== undefined && clearTick >= 0 && rows.length) writeSync(file, JSON.stringify({ seed, side, clearTick, rows }) + '\n');
  }
} finally {
  if (file !== undefined) closeSync(file);
}

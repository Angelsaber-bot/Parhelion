import { scoreSearchProgress } from '../search-progress.ts';
import { EXPLORATION_TICKS } from '../../shared/exploration.ts';
import { getMap } from '../../shared/arenaMap.ts';
import { greedyAction, neuralBotControl } from '../../shared/botNeuralControl.ts';
import { randomBotLoadout, randomBotUtility, TICK_HZ } from '../../shared/content.ts';
import { wrapAngle } from '../../shared/humanCombat.ts';
import { learnedOpponent } from '../../shared/learnedOpponent.ts';
import { Match } from '../../shared/match.ts';
import { type NeuralPolicyModel } from '../../shared/neuralPolicy.ts';
import { trialSeed } from '../self-play-seeds.ts';

export function rng(seed: number) {
  let value = seed >>> 0;
  return () => ((value = (Math.imul(value, 1664525) + 1013904223) >>> 0) + .5) / 4294967296;
}

interface Trial { map: string; side: 'A' | 'B'; seed: number; waiting: boolean }
export function fixtures(maps: string[], seed: number, repeats: number): Trial[] {
  return maps.flatMap(map => Array.from({ length: repeats }, (_, i) => (['A', 'B'] as const).map(side => ({
    map, side, seed: trialSeed(seed, 'search-spawn', map, i), waiting: (trialSeed(seed, 'search-wait', map) + i) % 2 === 0,
  }))).flat());
}

function play(model: NeuralPolicyModel, opponent: NeuralPolicyModel, trial: Trial, seconds: number) {
  const game = new Match(getMap(trial.map), '1v1'), random = rng(trial.seed);
  let visible = false, acquired = false, damage = 0, received = 0, spins = 0, windows = 0, stalled = 0, contacts = 0;
  let firstSight: boolean | undefined;
  let travel = 0, heading = 0, reach = 0, bestReach = 0, life = -1, originX = 0, originZ = 0;
  let startX = 0, startZ = 0, previousYaw = 0, windowRange = 0, unseen = true, frames = 0, seq = 0;
  let forwardTravel = 0, backwardTravel = 0, lateralTravel = 0, forwardRequests = 0, unseenTicks = 0, forwardInput = 0;
  const cells = new Set<string>();
  const openingRoute = new Set<string>();
  const decisions: Parameters<typeof scoreSearchProgress>[0] = [];
  const actor = neuralBotControl(model, (obs, logits, reset) => {
    visible = !!obs[0]; acquired ||= visible;
    firstSight ??= visible;
    if (visible) contacts++;
    const action = greedyAction(obs, logits);
    decisions.push({ obs, reset, axes: logits.slice(0, 4), reward: 0 });
    return action;
  });
  const kit = () => ({ skins: [], bot: true, char: Math.floor(random() * 7), loadout: randomBotLoadout(random), utility: randomBotUtility(random) });
  game.addPlayer('pilot', { ...kit(), name: 'pilot', team: trial.side }, {
    think(match, id) {
      const me = match.player(id)!;
      const input = { seq: ++seq, view: match.tick, yaw: me.yaw, pitch: me.pitch, mx: 0, mz: 0, buttons: 0, weapon: me.weaponSlot };
      if (me.alive && match.phase === 'live') {
        actor.apply(match, me, input);
        forwardInput = input.mz;
        return input;
      }
      actor.reset(); return input;
    },
  });
  game.addPlayer('rival', { ...kit(), name: 'rival', team: trial.side === 'A' ? 'B' : 'A' },
    trial.waiting ? undefined : learnedOpponent(opponent));
  game.phase = 'countdown'; game.phaseT = 1; game.step(); game.snapshot();
  const isLive = () => game.phase === 'live';
  // Include the actual lobby spawn heading alongside randomized starts.
  if (trial.seed % 2) for (const slot of game.slots.values()) slot.state.yaw = wrapAngle(slot.state.yaw + (random() - .5) * Math.PI * 1.8);
  for (let tick = 0; tick < seconds * TICK_HZ; tick++) {
    const me = game.player('pilot')!, x = me.x, z = me.z, previousLife = me.lifeId;
    game.step();
    for (const ev of game.snapshot().events) if (ev.t === 'hit') {
      if (ev.shooter === 'pilot') damage += ev.dmg;
      if (ev.victim === 'pilot') received += ev.dmg;
    }
    if (!me.alive) continue;
    if (!visible && previousLife === me.lifeId && isLive()) {
      unseenTicks++;
      if (forwardInput > .3) forwardRequests++;
      const dx = me.x - x, dz = me.z - z, sin = Math.sin(me.yaw), cos = Math.cos(me.yaw);
      const forward = -dx * sin - dz * cos;
      forwardTravel += forward;
      backwardTravel += Math.max(0, -forward);
      lateralTravel += Math.abs(dx * cos - dz * sin);
    }
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
  const { recovered, stayedBlocked } = scoreSearchProgress(decisions, game.map.data.bounds, EXPLORATION_TICKS, TICK_HZ);
  return { recovered, stayedBlocked, openingRoute, cells: cells.size, reach: bestReach, spins, stalled, windows, acquired: Number(acquired),
    contacts, damage, received, travel, forwardTravel, backwardTravel, lateralTravel, forwardRequests, unseenTicks, initiallyVisible: Number(firstSight) };
}

export function assess(model: NeuralPolicyModel, opponent: NeuralPolicyModel, trials: Trial[], seconds: number) {
  const rows = trials.map(t => play(model, opponent, t, seconds));
  const mean = (key: Exclude<keyof typeof rows[number], 'openingRoute'>) => rows.reduce((total, r) => total + r[key], 0) / rows.length;
  const waiting = rows.filter((row, i) => trials[i].waiting && row.initiallyVisible === 0);
  const stats = {
    cells: mean('cells'), reach: mean('reach'), spins: mean('spins'), stalled: mean('stalled'), windows: mean('windows'),
    acquired: mean('acquired'), contacts: mean('contacts'), damage: mean('damage'), received: mean('received'), travel: mean('travel'),
    recoveryTrials: rows.reduce((n, r) => n + r.recovered + r.stayedBlocked, 0),
    recoveries: rows.reduce((n, r) => n + r.recovered, 0),
    waitingTrials: waiting.length,
    waitingAcquired: waiting.reduce((n, r) => n + r.acquired, 0) / Math.max(1, waiting.length),
    forwardMetersPerSecond: TICK_HZ * mean('forwardTravel') / Math.max(1, mean('unseenTicks')),
    backwardMetersPerSecond: TICK_HZ * mean('backwardTravel') / Math.max(1, mean('unseenTicks')),
    lateralMetersPerSecond: TICK_HZ * mean('lateralTravel') / Math.max(1, mean('unseenTicks')),
    forwardRequestFraction: mean('forwardRequests') / Math.max(1, mean('unseenTicks')),
  };
  const score = stats.cells * .25 + stats.reach * .12 + stats.acquired * 6 + Math.min(40, stats.contacts) * .35 +
    stats.damage * .085 - stats.received * .035 - stats.spins * 5 - stats.stalled * 2.5 +
    4 * stats.forwardMetersPerSecond + 8 * stats.waitingAcquired;
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

export function passesSpawnSearch(pilot: ReturnType<typeof assess>, rival: ReturnType<typeof assess>) {
  return pilot.windows > 0 && rival.windows > 0 && pilot.waitingTrials > 0 && pilot.waitingTrials === rival.waitingTrials &&
    pilot.forwardMetersPerSecond >= Math.max(0, rival.forwardMetersPerSecond - .1 * Math.abs(rival.forwardMetersPerSecond)) &&
    pilot.reach >= .9 * rival.reach &&
    pilot.stalled / pilot.windows <= rival.stalled / rival.windows + .05 &&
    pilot.waitingAcquired > 0 && pilot.waitingAcquired >= rival.waitingAcquired - 1 / pilot.waitingTrials;
}

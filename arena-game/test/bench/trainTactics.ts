import { writeFileSync } from 'node:fs';
import { getMap } from '../../shared/arenaMap.ts';
import { Bot, BOT_SKILL, navFor } from '../../shared/bot.ts';
import { learnedTactics, TACTIC_FEATURES, TACTIC_TICKS, type TacticalCandidate, type TacticalPolicy, type TacticalWeights } from '../../shared/botTactics.ts';
import { CHARACTERS, PLAYABLE_HERO_INDICES, randomBotLoadout, randomBotUtility, TICK_HZ, WEAPONS } from '../../shared/content.ts';
import { lineOfSight } from '../../shared/map.ts';
import { Match, type PlayerInfo } from '../../shared/match.ts';
import type { NavNode } from '../../shared/nav.ts';
import { playerEye } from '../../shared/sim.ts';

const TRAIN_MAPS = ['homeward', 'aster', 'camlann', 'frostcourt'];
const HELD_OUT_MAPS = ['sakura', 'blackflag'];
const HORIZON = 144;
const SEED = 48517;
const HIDDEN = 16;
const EPISODES_PER_MAP = Number(process.argv[2] ?? 600);
if (!Number.isInteger(EPISODES_PER_MAP) || EPISODES_PER_MAP < 20) throw Error('Supply at least 20 training situations per map');

function random(seed: number) {
  let state = seed >>> 0;
  return () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
}

type Sample = { candidates: readonly TacticalCandidate[]; returns: number[] };

function scenario(mapId: string, seed: number) {
  const rand = random(seed);
  const map = getMap(mapId);
  const nav = navFor(new Match(map, '1v1'));
  let poses: [NavNode, NavNode] | undefined;
  for (let attempt = 0; attempt < 110; attempt++) {
    const self = nav.nodes[Math.floor(rand() * nav.nodes.length)];
    const angle = rand() * Math.PI * 2, dist = 4 + rand() * 26;
    const enemy = nav.nearest(self.x + Math.cos(angle) * dist, self.y, self.z + Math.sin(angle) * dist);
    if (!enemy || !self.links.length || Math.hypot(enemy.x - self.x, enemy.z - self.z) < 3) continue;
    if (!lineOfSight(map, [self.x, self.y + map.eye, self.z], [enemy.x, enemy.y + map.eye, enemy.z])) continue;
    poses = [self, enemy];
    break;
  }
  if (!poses) return;
  const team = seed % 2 === 0 ? 'A' : 'B';
  const kit = (name: string, side: 'A' | 'B'): PlayerInfo => ({
    team: side, name, char: PLAYABLE_HERO_INDICES[Math.floor(rand() * PLAYABLE_HERO_INDICES.length)],
    bot: true, skins: [], loadout: randomBotLoadout(rand), utility: randomBotUtility(rand),
  });
  const pilot = kit('pilot', team), rival = kit('rival', team === 'A' ? 'B' : 'A');
  const hp = [.24, .42, .7, 1, 1][Math.floor(rand() * 5)];
  const enemyHp = [.45, .75, 1, 1][Math.floor(rand() * 4)];
  const ammo = [.08, .3, .65, 1, 1][Math.floor(rand() * 5)];
  const alternateAmmo = [.28, .7, 1, 1][Math.floor(rand() * 4)];
  const reload = ammo <= .3 && rand() < .38 ? 50 + Math.floor(rand() * 48) : 0;
  const recentDamage = rand() < .45;
  const ownSkill = rand() < .67 ? BOT_SKILL.normal : BOT_SKILL.hard;
  const rivalSkill = [BOT_SKILL.normal, BOT_SKILL.hard, BOT_SKILL.easy][Math.floor(rand() * 3)];

  return (choice: number) => {
    const match = new Match(map, '1v1');
    let seen: readonly TacticalCandidate[] = [], decided = 0;
    const choose: TacticalPolicy = options => {
      if (decided || options.length < 2) return 0;
      seen = options;
      decided = match.tick;
      return choice;
    };
    const seat = (id: string, info: PlayerInfo, pose: NavNode, other: NavNode, bot: Bot) => {
      match.addPlayer(id, info, bot);
      const p = match.player(id)!;
      Object.assign(p, { x: pose.x, y: pose.y, z: pose.z, yaw: Math.atan2(pose.x - other.x, pose.z - other.z) });
      match.slots.get(id)!.spawnProtectedUntilTick = 0;
      return p;
    };
    const me = seat('pilot', pilot, poses[0], poses[1], new Bot(seed + 11, ownSkill, choose));
    const enemy = seat('rival', rival, poses[1], poses[0], new Bot(seed + 983, rivalSkill));
    const selfMax = CHARACTERS[me.char].hp, enemyMax = CHARACTERS[enemy.char].hp;
    me.hp = Math.round(hp * selfMax);
    enemy.hp = Math.round(enemyHp * enemyMax);
    me.ammo[me.weapon] = Math.ceil(WEAPONS[me.weapon].mag * ammo);
    const alternate = WEAPONS.findIndex(w => w.id === me.loadout[1]);
    me.ammo[alternate] = Math.ceil(WEAPONS[alternate].mag * alternateAmmo);
    me.reload = reload;
    if (recentDamage) me.lastDamageTick = -12;
    match.phase = 'live';
    match.phaseT = 20 * TICK_HZ;

    let selfHp = me.hp, targetHp = enemy.hp, vulnerable = 0, sheltered = 0, reloads = 0;
    for (let i = 0; i < HORIZON + 65 && me.alive && enemy.alive; i++) {
      match.step();
      if (!decided) { selfHp = me.hp; targetHp = enemy.hp; }
      if (decided && match.tick - decided < TACTIC_TICKS && match.tick % 6 === 0 && me.alive && enemy.alive) {
        const weapon = WEAPONS[me.weapon];
        const vulnerableNow = me.reload > 0 || (weapon.kind === 'gun' && me.ammo[me.weapon] <= weapon.mag * .25) || me.hp <= selfMax * .5;
        if (vulnerableNow) {
          const enemyEye = [enemy.x, enemy.y + playerEye(map, enemy), enemy.z] as const;
          const sees = lineOfSight(map, [...enemyEye], [me.x, me.y + playerEye(map, me), me.z]) ||
            lineOfSight(map, [...enemyEye], [me.x, me.y + .8, me.z]);
          vulnerable += Number(sees);
          sheltered += Number(!sees);
        }
      }
      if (match.tick % 6 === 0 || !me.alive || !enemy.alive) {
        const { events } = match.snapshot();
        if (decided) reloads += events.filter(e => e.t === 'fx' && e.id === 'pilot' && e.kind === 'reload').length;
      }
      if (decided && match.tick - decided >= HORIZON) break;
    }
    const dealt = (targetHp - enemy.hp) / enemyMax;
    const taken = (selfHp - me.hp) / selfMax;
    // Score the simulated outcome: damage and kills, plus exposure while vulnerable during this
    // movement decision. Reload starts only contribute if the pilot survives the rollout.
    const result = .65 * dealt - .85 * taken + (!enemy.alive ? .45 : 0) - (!me.alive ? .55 : 0) +
      (.45 * sheltered - .3 * vulnerable) / (TACTIC_TICKS / 6) + (me.alive ? .07 * Math.min(1, reloads) : 0);
    return { seen, result };
  };
}

function collect(mapId: string, wanted: number, firstSeed: number): Sample[] {
  const samples: Sample[] = [];
  for (let i = 0; samples.length < wanted && i < wanted * 3; i++) {
    const run = scenario(mapId, firstSeed + i * 11);
    if (!run) continue;
    const baseline = run(0);
    if (baseline.seen.length < 2) continue;
    const returns = [baseline.result];
    for (let c = 1; c < baseline.seen.length; c++) returns.push(run(c).result);
    samples.push({ candidates: baseline.seen, returns });
  }
  if (samples.length !== wanted) throw Error(`${mapId}: found only ${samples.length}/${wanted} situations`);
  console.log(`${mapId} seed=${firstSeed}: ${samples.length} situations, ${samples.reduce((n, s) => n + s.returns.length, 0)} simulated branches`);
  return samples;
}

/** Fit a shared candidate scorer to counterfactual returns relative to the baseline action. */
function fit(samples: readonly Sample[], seed: number): TacticalWeights {
  const rand = random(seed);
  const width = TACTIC_FEATURES.length;
  const examples = samples.flatMap(s => s.candidates.map((c, i) => ({ x: c.features, y: s.returns[i] - s.returns[0] })));
  const parameters = Float64Array.from({ length: HIDDEN * (width + 2) }, () => (rand() - .5) * .4);
  const mean = new Float64Array(parameters.length), variance = new Float64Array(parameters.length);
  const gradient = new Float64Array(parameters.length), hidden = new Float64Array(HIDDEN);
  const stride = width + 2;
  let updates = 0, initialLoss = 0, finalLoss = 0;

  for (let epoch = 0; epoch < 28; epoch++) {
    for (let i = examples.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [examples[i], examples[j]] = [examples[j], examples[i]];
    }
    let loss = 0;
    const batchSize = 64;
    for (let start = 0; start < examples.length; start += batchSize) {
      gradient.fill(0);
      const end = Math.min(start + batchSize, examples.length);
      for (let i = start; i < end; i++) {
        const { x, y } = examples[i];
        let prediction = 0;
        for (let h = 0; h < HIDDEN; h++) {
          const row = h * stride;
          let a = parameters[row + width];
          for (let f = 0; f < width; f++) a += parameters[row + f] * x[f];
          hidden[h] = Math.tanh(a);
          prediction += hidden[h] * parameters[row + width + 1];
        }
        const error = prediction - y;
        loss += error * error;
        for (let h = 0; h < HIDDEN; h++) {
          const row = h * stride;
          const g = error * parameters[row + width + 1] * (1 - hidden[h] ** 2);
          for (let f = 0; f < width; f++) gradient[row + f] += g * x[f];
          gradient[row + width] += g;
          gradient[row + width + 1] += error * hidden[h];
        }
      }
      updates++;
      const biasMean = 1 - .9 ** updates, biasVariance = 1 - .999 ** updates;
      for (let p = 0; p < parameters.length; p++) {
        const g = gradient[p] / (end - start) + .0003 * parameters[p];
        mean[p] = .9 * mean[p] + .1 * g;
        variance[p] = .999 * variance[p] + .001 * g * g;
        parameters[p] -= (.003 / biasMean) * mean[p] / (Math.sqrt(variance[p] / biasVariance) + 1e-8);
      }
    }
    if (epoch === 0) initialLoss = loss / examples.length;
    finalLoss = loss / examples.length;
  }

  const hiddenRows = [], bias = [], output = [];
  for (let h = 0; h < HIDDEN; h++) {
    const row = h * stride;
    hiddenRows.push(Array.from(parameters.subarray(row, row + width), n => Number(n.toFixed(7))));
    bias.push(Number(parameters[row + width].toFixed(7)));
    output.push(Number(parameters[row + width + 1].toFixed(7)));
  }
  console.log(`fit: ${examples.length} candidates, ${updates} Adam updates, MSE ${initialLoss.toFixed(4)} → ${finalLoss.toFixed(4)}`);
  return { hidden: hiddenRows, bias, output };
}

function assess(samples: Sample[], policy: TacticalPolicy) {
  let gain = 0, improved = 0, worsened = 0, cover = 0, angle = 0;
  for (const s of samples) {
    const c = policy(s.candidates);
    const delta = s.returns[c] - s.returns[0];
    gain += delta;
    if (delta > 0) improved++;
    if (delta < 0) worsened++;
    if (s.candidates[c].kind === 'cover') cover++;
    if (s.candidates[c].kind === 'angle') angle++;
  }
  return { situations: samples.length, meanReturnGain: Number((gain / samples.length).toFixed(5)), improved, worsened, cover, angle };
}

function fullDuels(mapId: string, policy: TacticalPolicy, games: number) {
  let modelKills = 0, baselineKills = 0, wins = 0, losses = 0, draws = 0;
  let controlKills = 0, controlRivalKills = 0;
  let decisions = 0, moves = 0;
  const count: TacticalPolicy = c => {
    decisions++;
    const result = policy(c);
    if (result !== 0) moves++;
    return result;
  };
  const run = (i: number, tactics?: TacticalPolicy) => {
    const match = new Match(getMap(mapId), '1v1');
    // Paired games preserve each policy's equipment, character, and controller seed when sides swap.
    const seed = Math.floor(i / 2) + 80011, rand = random(seed);
    const equip = () => ({ char: PLAYABLE_HERO_INDICES[Math.floor(rand() * PLAYABLE_HERO_INDICES.length)], bot: true, skins: [],
      loadout: randomBotLoadout(rand), utility: randomBotUtility(rand) });
    const modelTeam = i % 2 ? 'B' : 'A';
    const model = { ...equip(), name: 'Model', team: modelTeam } as const;
    const base = { ...equip(), name: 'Baseline', team: modelTeam === 'A' ? 'B' : 'A' } as const;
    const skill = i < games / 2 ? BOT_SKILL.normal : BOT_SKILL.hard;
    const seatModel = () => match.addPlayer('model', model, new Bot(seed, skill, tactics));
    const seatBase = () => match.addPlayer('base', base, new Bot(seed + 47, skill));
    if (modelTeam === 'A') { seatModel(); seatBase(); } else { seatBase(); seatModel(); }
    for (let t = 0; t < 90 * TICK_HZ && match.phase !== 'ended'; t++) match.step();
    return [match.score[modelTeam], match.score[base.team]];
  };
  for (let i = 0; i < games; i++) {
    const [a, b] = run(i, count);
    const [control, controlRival] = run(i);
    modelKills += a;
    baselineKills += b;
    controlKills += control;
    controlRivalKills += controlRival;
    if (a > b) wins++; else if (b > a) losses++; else draws++;
  }
  return { games, modelKills, baselineKills, controlKills, controlRivalKills, wins, losses, draws, decisions, moves };
}

const training = TRAIN_MAPS.flatMap((map, i) => collect(map, EPISODES_PER_MAP, SEED + i * 100000));
const validation = TRAIN_MAPS.flatMap((map, i) => collect(map, Math.max(30, Math.floor(EPISODES_PER_MAP / 4)), SEED + 500000 + i * 100000));
const weights = fit(training, SEED);
const calibration = [0, .02, .04, .06, .09, .13].map(margin => ({ margin, ...assess(validation, learnedTactics(weights, margin)) }));
console.table(calibration);
const { margin } = calibration.reduce((a, b) => b.meanReturnGain > a.meanReturnGain ? b : a);
const policy = learnedTactics(weights, margin);
const heldOut = Object.fromEntries(HELD_OUT_MAPS.map((map, i) => {
  const metrics = assess(collect(map, Math.max(40, Math.floor(EPISODES_PER_MAP / 2)), SEED + 1000000 + i * 100000), policy);
  console.log(map, 'held-out situations', metrics);
  return [map, metrics];
}));
const duels = Object.fromEntries(HELD_OUT_MAPS.map(map => {
  const metrics = fullDuels(map, policy, EPISODES_PER_MAP >= 100 ? 16 : 4);
  console.log(map, '90-second duels', metrics);
  return [map, metrics];
}));

const model = {
  version: 1, features: TACTIC_FEATURES, margin, weights,
  training: { seed: SEED, maps: TRAIN_MAPS, situations: training.length, rollouts: training.reduce((n, s) => n + s.returns.length, 0),
    validation: assess(validation, policy), heldOut, duels },
};
writeFileSync(new URL('../../shared/botTacticsModel.json', import.meta.url), `${JSON.stringify(model)}\n`);

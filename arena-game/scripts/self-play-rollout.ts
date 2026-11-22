import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { getMap, MAPS } from '../shared/arenaMap.ts';
import { Bot, BOT_SKILL, navFor } from '../shared/bot.ts';
import { neuralBotControl, type NeuralAction } from '../shared/botNeuralControl.ts';
import { learnedTactics } from '../shared/botTactics.ts';
import tactics from '../shared/botTacticsModel.json';
import { randomBotHero, randomBotLoadout, randomBotUtility, SMOKE, TICK_HZ, type Team, type TeamLayout } from '../shared/content.ts';
import { settleSmoke, type Smoke } from '../shared/grenade.ts';
import { blockedAt, groundAt, insideMovementBounds, lineOfSight, type ArenaMap } from '../shared/map.ts';
import { Match, type Controller } from '../shared/match.ts';
import type { NavNode } from '../shared/nav.ts';
import { parseNeuralPolicy, type NeuralPolicyModel } from '../shared/neuralPolicy.ts';
import { EXPLORATION_TICKS } from '../shared/exploration.ts';
import { courseRival, escapeFor, rivalCourse, scoreContactDrill, type RivalCourse } from './self-play-contact.ts';
import { RULES_VERSION } from '../shared/protocol.ts';
import { opponentLeague } from './self-play-league.ts';
import { loadFallback, type PublicFallback } from './self-play-opponents.ts';
import { decisionCoach, type CoachTargets } from './self-play-coach.ts';
import { seedVersion, trainingSeed } from './self-play-seeds.ts';

const AXIS_STD = .35;
const TACTICS = learnedTactics(tactics.weights, tactics.margin);
const scenarios = ['spawn', 'encounter', 'rear', 'smoke', 'wall', 'retreat', 'corner'] as const;
type Scenario = typeof scenarios[number];
type Focus = 'wall' | 'rear' | 'smoke';
interface Step {
  obs: number[]; reset: boolean;
  axes: number[]; buttons: number[]; weapon: number;
  logp: number; reward: number;
  coach?: CoachTargets;
}
interface FrozenActor { hash: string; model: NeuralPolicyModel }
type Opponent = { mode: 'self-play' | 'scripted' } | { mode: 'frozen'; actor: FrozenActor } |
  { mode: 'deployed'; fallback: PublicFallback };

function rng(seed: number) {
  // Adjacent generation numbers should start on different regions of the map/roster sequence.
  let state = Math.imul(seed ^ seed >>> 16, 0x45d9f3b);
  state = Math.imul(state ^ state >>> 16, 0x45d9f3b);
  state = (state ^ state >>> 16) >>> 0;
  return () => ((state = (Math.imul(1664525, state) + 1013904223) >>> 0) + .5) / 4294967296;
}

function readActor(file: string): FrozenActor {
  const bytes = readFileSync(file);
  const model = parseNeuralPolicy(JSON.parse(bytes.toString('utf8')));
  if (!model) throw Error('Incompatible Arena actor');
  return { model, hash: createHash('sha256').update(bytes).digest('hex') };
}

function sample(obs: number[], logits: number[], reset: boolean, rand: () => number): Step {
  let logp = 0;
  const axes = logits.slice(0, 4).map(mean => {
    const z = Math.sqrt(-2 * Math.log(rand())) * Math.cos(2 * Math.PI * rand());
    logp -= .5 * z * z + Math.log(AXIS_STD) + .5 * Math.log(2 * Math.PI);
    return mean + AXIS_STD * z;
  });
  const buttons = logits.slice(4, 11).map(logit => {
    const flag = Number(rand() < 1 / (1 + Math.exp(-logit)));
    const x = flag ? -logit : logit;
    logp -= Math.max(x, 0) + Math.log1p(Math.exp(-Math.abs(x)));
    return flag;
  });
  const slots = logits.slice(11);
  const peak = Math.max(...slots);
  const weights = slots.map(logit => Math.exp(logit - peak));
  const total = weights.reduce((a, b) => a + b, 0);
  let ticket = rand() * total, weapon = 0;
  while (weapon < weights.length - 1 && ticket >= weights[weapon]) {
    ticket -= weights[weapon];
    weapon++;
  }
  logp += slots[weapon] - peak - Math.log(total);
  return { obs, axes, buttons, weapon, logp, reset, reward: 0 };
}

function learnedController(actor: FrozenActor, rand: () => number, record?: Step[]): Controller {
  const coach = record && actor.model.version < 4 ? decisionCoach() : undefined;
  const policy = neuralBotControl(actor.model, (obs, logits, reset): NeuralAction => {
    const step = sample(obs, logits, reset, rand);
    record?.push(step);
    const mask = step.buttons.reduce((bits, flag, index) => bits | flag << index, 0);
    return { axes: step.axes, buttons: mask, weapon: step.weapon };
  });
  let sequence = 0;
  return { think(match, id) {
    const me = match.player(id)!;
    const input = { seq: ++sequence, view: match.tick, mx: 0, mz: 0, yaw: me.yaw, pitch: me.pitch, buttons: 0, weapon: me.weaponSlot };
    if (me.alive && match.phase === 'live') {
      const count = record?.length;
      const chosen = policy.apply(match, me, input);
      if (coach && record && record.length !== count) {
        const step = record[record.length - 1];
        step.coach = coach(step.obs, step.reset, match.map, me);
      }
      return chosen;
    }
    policy.reset();
    return input;
  } };
}

// Stand at the end of an actual collider. One step forward is obstructed, but at least one
// side leads to supported, walkable ground and can clear the end of the wall.
function cornerStart(map: ArenaMap, node: NavNode, rand: () => number) {
  const start = Math.floor(rand() * 4);
  const directions = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  const standable = (x: number, z: number) => insideMovementBounds(map, x, z) &&
    Math.abs(groundAt(map, x, z, node.y) - node.y) < .12 && !blockedAt(map, x, z, node.y);
  if (!standable(node.x, node.z)) return;
  for (let i = 0; i < directions.length; i++) {
    const [dx, dz] = directions[(start + i) % directions.length];
    let x = node.x, z = node.z;
    for (let step = 0; step < 10; step++) {
      const nx = x + dx * .12, nz = z + dz * .12;
      if (blockedAt(map, nx, nz, node.y)) {
        for (const side of [-1, 1]) {
          for (let stride = 1; stride <= 6; stride++) {
            const sx = x + side * dz * stride * .25, sz = z - side * dx * stride * .25;
            if (!standable(sx, sz)) break;
            if (standable(sx + dx * .25, sz + dz * .25) && standable(sx + dx * .5, sz + dz * .5)) {
              return { x, y: node.y, z, yaw: Math.atan2(-dx, -dz) };
            }
          }
        }
        break;
      }
      if (!standable(nx, nz)) break;
      x = nx; z = nz;
    }
  }
}

// Start some episodes mid-round on walkable cells. Only the environment sees both positions.
function placeEncounter(game: Match, scenario: Scenario, rand: () => number): { scenario: Scenario; smoke?: Smoke; course?: RivalCourse } {
  if (scenario === 'spawn') return { scenario };
  const nav = navFor(game);
  const drill = scenario === 'retreat' || scenario === 'corner' || scenario === 'smoke' ? scenario : undefined;
  const escape = drill && escapeFor(drill, rand);
  for (let attempt = 0; attempt < 1500; attempt++) {
    const a = nav.nodes[Math.floor(rand() * nav.nodes.length)];
    if (!a?.links.length) continue;
    const direction = rand() * 2 * Math.PI, distance = 5 + rand() * 7;
    const b = nav.nearest(a.x + Math.cos(direction) * distance, a.y, a.z + Math.sin(direction) * distance);
    if (!b || Math.abs(a.y - b.y) > .6 || Math.hypot(a.x - b.x, a.z - b.z) < 4 ||
        !lineOfSight(game.map, [a.x, a.y + 1.3, a.z], [b.x, b.y + 1.3, b.z])) continue;
    const yaw = Math.atan2(a.x - b.x, a.z - b.z);
    const pose = scenario === 'wall' ? cornerStart(game.map, a, rand) :
      { x: a.x, y: a.y, z: a.z, yaw: yaw + (scenario === 'rear' ? Math.PI : 0) + (rand() - .5) * .7 };
    if (!pose) continue;
    const occupied = [...game.slots.values()].some(({ state: p }) => p.id !== 'pilot' && p.id !== 'rival' &&
      [pose, b].some(at => Math.abs(at.y - p.y) < game.map.height && Math.hypot(at.x - p.x, at.z - p.z) < 2 * game.map.radius));
    if (occupied) continue;
    const course = drill && escape ? rivalCourse(game.map, nav, a, b, drill, escape, rand) : undefined;
    if (drill && !course) continue;
    Object.assign(game.player('pilot')!, pose);
    Object.assign(game.player('rival')!, { x: b.x, y: b.y, z: b.z, yaw: yaw + Math.PI + (rand() - .5) * 1.5 });
    for (const id of ['pilot', 'rival']) game.slots.get(id)!.spawnProtectedUntilTick = 0;
    if (scenario === 'smoke') {
      const depth = .35 + .35 * rand();
      const smoke = settleSmoke(game.map, { id: -1, owner: 'rival', x: a.x + (b.x - a.x) * depth,
        y: a.y + (b.y - a.y) * depth, z: a.z + (b.z - a.z) * depth, life: SMOKE.life });
      return { scenario, smoke, course };
    }
    return { scenario, course };
  }
  throw Error(`Could not construct a playable ${scenario} scenario on ${game.map.data.mapId}`);
}

function play(actor: FrozenActor, opponent: Opponent, map: string, layout: TeamLayout, team: Team,
              scenario: Scenario, seed: number, seconds: number) {
  const rand = rng(seed), seed32 = () => Math.floor(rand() * 4294967296);
  const enemy = team === 'A' ? 'B' : 'A';
  const game = new Match(getMap(map), layout);
  const seats = (layout === '2v2' ? ['pilot', 'partner'] : ['pilot']).map(id => ({
    id, steps: [] as Step[], wasAlive: false,
  }));
  const bots = layout === '2v2' ? ['pilot', 'rival', 'partner', 'other'] : ['pilot', 'rival'];
  for (const id of bots) {
    const friendly = id === 'pilot' || id === 'partner';
    const side = friendly ? team : enemy;
    const char = randomBotHero([...game.slots.values()].map(slot => slot.info), side, rand);
    // Only self-play explores on both sides. Archived rivals use the same action selection as a live released bot.
    const driver = friendly || opponent.mode === 'self-play'
      ? learnedController(actor, rng(seed32()), seats.find(seat => seat.id === id)?.steps)
      : new Bot(seed32(), BOT_SKILL.normal, opponent.mode === 'deployed' ? undefined : TACTICS, undefined,
        opponent.mode === 'deployed' ? opponent.fallback.exploration : undefined, opponent.mode === 'frozen' ? opponent.actor.model : undefined);
    game.addPlayer(id, { name: id, team: side, char, skins: [], bot: true, loadout: randomBotLoadout(rand), utility: randomBotUtility(rand) }, driver);
  }
  game.phase = 'countdown';
  game.phaseT = 1;
  game.step();
  game.snapshot();
  game.phaseT = seconds * TICK_HZ;
  const start = placeEncounter(game, scenario, rand);
  const firstTick = game.tick;
  if (start.course) {
    const rival = game.slots.get('rival')!;
    rival.controller = courseRival(rival.controller!, start.course, firstTick, rival.state.lifeId);
  }
  // Timeout is the actual end of each shortened match in Match.stepPhase; there is no bootstrap tick.
  while (game.phaseT > 0) {
    if (start.smoke && game.tick === firstTick + start.course!.wait) game.smokes.push(start.smoke);
    for (const seat of seats) seat.wasAlive = game.player(seat.id)!.alive;
    const scoreDiff = game.score[team] - game.score[enemy];
    game.step();
    const events = game.snapshot().events;
    const teamReward = .25 * (game.score[team] - game.score[enemy] - scoreDiff);
    for (const { id, steps, wasAlive } of seats) {
      const last = steps.at(-1);
      if (!last) continue;
      last.reward += teamReward;
      for (const event of events) {
        if (event.t !== 'hit') continue;
        if (event.shooter === id && game.player(event.victim)?.team === enemy) last.reward += .001 * event.dmg;
        if (event.victim === id && wasAlive && game.player(event.shooter)?.team === enemy) last.reward -= .001 * event.dmg;
      }
    }
  }
  const outcome = Math.sign(game.score[team] - game.score[enemy]);
  for (const seat of seats) {
    if (!seat.steps.length) throw Error(`No live decisions for ${seat.id} in the simulated match`);
    seat.steps[seat.steps.length - 1].reward += outcome;
  }
  // In teams a different enemy could satisfy the contact test. Use team score and damage only there.
  const rearSearchBonus = layout === '1v1' && scenario === 'rear' &&
    scoreContactDrill(seats[0].steps, 'rear', 12 * TICK_HZ, EXPLORATION_TICKS);
  const contactBonus = layout === '1v1' && start.course &&
    (scenario === 'retreat' || scenario === 'corner' || scenario === 'smoke') &&
    scoreContactDrill(seats[0].steps, scenario,
      scenario === 'smoke' ? start.course.wait + SMOKE.life - SMOKE.clear : start.course.duration, EXPLORATION_TICKS);
  const trajectories = Object.fromEntries(seats.map(({ id, steps }) => [id, steps]));
  const opponentHash = opponent.mode === 'frozen' ? opponent.actor.hash : opponent.mode === 'self-play' ? actor.hash :
    opponent.mode === 'deployed' ? opponent.fallback.digest ?? 'public-scripted' : 'scripted';
  return { map, layout, seed, team, scenario: start.scenario, opponent: opponentHash, opponentMode: opponent.mode,
    ...(scenario === 'rear' && layout === '1v1' && { contactBonus: rearSearchBonus }),
    ...(start.course && { exercise: start.course.escape, contactBonus: Boolean(contactBonus) }),
    score: game.score, outcome, ticks: game.tick - firstTick, trajectories };
}

function boundedInteger(s: string, name: string, min: number, max: number) {
  const n = Number(s);
  if (!/^\d+$/.test(s) || !Number.isSafeInteger(n) || n < min || n > max) throw Error(`Invalid --${name}`);
  return n;
}

function curriculum(count: number, focus: Focus[], rand: () => number) {
  const schedule: { scenario: Scenario; focused: boolean }[] = [];
  const budget = Math.min(Math.floor(count / 2), Math.max(0, count - scenarios.length));
  const ordinary = focus.length && count >= scenarios.length ? count - budget : count;
  const rotation = Math.floor(rand() * (scenarios.length - 1));
  const filler: Scenario[] = Array.from({ length: scenarios.length - 1 }, (_, i) => scenarios[1 + (rotation + i) % (scenarios.length - 1)]);
  // Small smoke-test batches still include a normal spawn and prioritize requested exercises.
  const choices = count < scenarios.length ? [...new Set<Scenario>(['spawn', ...focus, ...filler])] : ['spawn' as const, ...filler];
  for (let i = 0; i < ordinary; i++) schedule.push({ scenario: choices[i % choices.length], focused: false });
  const offset = Math.floor(rand() * focus.length);
  for (let i = ordinary; i < count; i++) schedule.push({ scenario: focus[(offset + i - ordinary) % focus.length], focused: true });
  for (let i = schedule.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [schedule[i], schedule[j]] = [schedule[j], schedule[i]];
  }
  return schedule;
}

function main() {
  const { values } = parseArgs({ options: {
    model: { type: 'string' }, output: { type: 'string' }, opponent: { type: 'string', multiple: true, default: [] },
    'deployed-fallback': { type: 'string' },
    focus: { type: 'string', multiple: true, default: [] }, league: { type: 'string' },
    seed: { type: 'string', default: '777' }, episodes: { type: 'string', default: '8' }, seconds: { type: 'string', default: '30' },
    'seed-version': { type: 'string' },
  } });
  if (!values.model || !values.output) throw Error('Specify --model actor.json --output trajectories.json');
  const seed = boundedInteger(values.seed, 'seed', 0, 4294967295);
  const version = seedVersion(values['seed-version']);
  const count = boundedInteger(values.episodes, 'episodes', 1, 256), seconds = boundedInteger(values.seconds, 'seconds', 1, 300);
  const focus = [...new Set(values.focus)].map(value => {
    if (value === 'wall' || value === 'rear' || value === 'smoke') return value;
    throw Error('Each --focus must be wall, rear or smoke');
  });
  const actor = readActor(values.model);
  const pool = new Map<string, Opponent>([['self-play', { mode: 'self-play' }], ['scripted', { mode: 'scripted' }]]);
  if (values['deployed-fallback']) {
    const fallback = loadFallback(values['deployed-fallback']);
    pool.set(fallback.digest ?? 'public-scripted', { mode: 'deployed', fallback });
  }
  for (const file of values.opponent) {
    const rival = readActor(file);
    pool.set(rival.hash, { mode: 'frozen', actor: rival });
  }
  const random = rng(seed);
  const mapOffset = Math.floor(random() * MAPS.length);
  const order = [...MAPS.slice(mapOffset), ...MAPS.slice(0, mapOffset)];
  const episodes = [];
  const appearances: Record<'1v1' | '2v2', Record<string, number>> = { '1v1': {}, '2v2': {} };
  const schedule = curriculum(count, focus, random);
  const previous = values.league ? JSON.parse(readFileSync(values.league, 'utf8')) : {};
  const league = opponentLeague([...pool.keys()], count, previous, random);
  for (let i = 0; i < count; i++) {
    const layout = i % 4 === 1 || i % 4 === 2 ? '2v2' : '1v1';
    const team = i % 2 ? 'B' : 'A';
    const { scenario, focused } = schedule[i];
    const rival = league.select(i, layout);
    appearances[layout][rival] = (appearances[layout][rival] ?? 0) + 1;
    const episode = play(actor, pool.get(rival)!, order[i % order.length].id, layout, team, scenario, trainingSeed(random(), version), seconds);
    // A rival following a sampled exercise is not its unmodified league policy.
    if (!episode.exercise) league.observe(rival, episode.outcome, layout);
    episodes.push({ ...episode, focused });
  }
  const payload = { version: 2, seedVersion: version, seed, rulesVersion: RULES_VERSION, actorHash: actor.hash, axisStd: AXIS_STD, focus, episodes };
  writeFileSync(values.output, JSON.stringify(payload), { mode: 0o600 });
  if (values.league) writeFileSync(values.league, JSON.stringify(league.payoffs), { mode: 0o600 });
  console.log('Training opponent appearances:', JSON.stringify(appearances));
  const decisions = episodes.flatMap(e => Object.values(e.trajectories)).reduce((n, steps) => n + steps.length, 0);
  console.log(`Simulated ${count} matches, collected ${decisions} policy decisions.`);
}

try { main(); } catch (e) {
  console.error(e instanceof Error ? e.message : String(e));
  process.exitCode = 1;
}

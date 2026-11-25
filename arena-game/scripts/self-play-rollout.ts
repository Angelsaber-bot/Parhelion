import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { getMap, MAPS } from '../shared/arenaMap.ts';
import { navFor } from '../shared/botLocomotion.ts';
import { directPolicy, learnedOpponent } from '../shared/learnedOpponent.ts';
import { neuralBotControl, type NeuralAction } from '../shared/botNeuralControl.ts';
import { randomBotHero, randomBotLoadout, randomBotUtility, SMOKE, TICK_HZ, type Team, type TeamLayout } from '../shared/content.ts';
import { settleSmoke, smokeBlocks, type Smoke } from '../shared/grenade.ts';
import { blockedAt, groundAt, insideMovementBounds, lineOfSight, type ArenaMap } from '../shared/map.ts';
import { Match, type Controller } from '../shared/match.ts';
import type { NavNode } from '../shared/nav.ts';
import { parseNeuralPolicy, type NeuralPolicyModel } from '../shared/neuralPolicy.ts';
import { RULES_VERSION } from '../shared/protocol.ts';
import { EXPLORATION_TICKS } from '../shared/exploration.ts';
import { scoreSearchProgress } from './search-progress.ts';
import { creditWaitingSearch } from './waiting-search-credit.ts';
import { courseRival, openingDamageCredit, rivalCourse, scoreContactDrill, sightlineDamageCredit, sightlineStart, waitingApproach } from './self-play-contact.ts';
import { opponentLeague } from './self-play-league.ts';
import { seedVersion, trainingSeed } from './self-play-seeds.ts';

const AXIS_STD = .35;
const scenarios = ['spawn', 'encounter', 'rear', 'smoke', 'wall', 'retreat', 'corner', 'waiting', 'sightline'] as const;
type Scenario = typeof scenarios[number];
type Focus = 'wall' | 'rear' | 'smoke' | 'waiting' | 'encounter' | 'sightline';
interface Step {
  obs: number[]; reset: boolean;
  axes: number[]; buttons: number[]; weapon: number;
  logp: number; reward: number;
}
interface FrozenActor { hash: string; model: NeuralPolicyModel }
type Opponent = { mode: 'self-play' } | { mode: 'frozen'; actor: FrozenActor };

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
      return policy.apply(match, me, input);
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

function encounterYaw(yaw: number, scenario: Scenario, focused: boolean, draw: number) {
  if (scenario !== 'rear' || !focused) return yaw + (scenario === 'rear' ? Math.PI : 0) + (draw - .5) * .7;
  // Additional practice spans both sides, from outside the field of view
  // to directly behind. The learner receives only its usual observations.
  return yaw + Math.PI + (2 * draw - 1) * (105 * Math.PI / 180);
}

// Start some episodes mid-round on walkable cells. Only the environment sees both positions.
export function placeEncounter(game: Match, scenario: Scenario, focused: boolean, rand: () => number): {
  scenario: Scenario; shortenedApproach?: boolean; smoke?: Smoke; smokeTick?: number; openingRange?: { distance: number; minimum: number };
} {
  if (scenario === 'spawn') return { scenario };
  if (scenario === 'sightline') {
    const pilot = game.player('pilot')!, rival = game.player('rival')!;
    const occupied = (node: NavNode) => [...game.slots.values()].some(({ state }) =>
      state !== pilot && state !== rival && Math.abs(node.y - state.y) < game.map.height &&
      Math.hypot(node.x - state.x, node.z - state.z) < 2 * game.map.radius);
    const lane = sightlineStart(game.map, navFor(game), rand, occupied);
    if (!lane) return placeEncounter(game, 'encounter', focused, rand);
    const { a, b, distance, minimum } = lane;
    const yaw = Math.atan2(a.x - b.x, a.z - b.z);
    const offCentre = () => (.15 + rand() * .4) * (rand() < .5 ? -1 : 1);
    Object.assign(pilot, { x: a.x, y: a.y, z: a.z, yaw: yaw + offCentre(), pitch: 0 });
    Object.assign(rival, { x: b.x, y: b.y, z: b.z, yaw: yaw + Math.PI + offCentre(), pitch: 0 });
    for (const id of ['pilot', 'rival']) game.slots.get(id)!.spawnProtectedUntilTick = 0;
    return { scenario, openingRange: { distance, minimum } };
  }
  if (scenario === 'waiting') {
    // Mix full-spawn failures with nearer opportunities to discover the same
    // stationary rival. Shortened approaches keep the original map heading.
    if (focused && game.layout === '1v1' && rand() < .5) {
      const pilot = game.player('pilot')!;
      const node = waitingApproach(game.map, navFor(game), pilot, game.player('rival')!, rand, rand() < .5);
      if (node) {
        Object.assign(pilot, { x: node.x, y: node.y, z: node.z });
        return { scenario, shortenedApproach: true };
      }
    }
    // Full-spawn remedial trials also cover looking away from the opening lane.
    // Keep half at the map heading and never use the hidden rival's bearing.
    if (focused && game.layout === '1v1' && rand() < .5) {
      game.player('pilot')!.yaw += (rand() - .5) * Math.PI * 1.8;
    }
    if (!focused && game.layout === '1v1' && rand() < .65) {
      const nav = navFor(game), pilot = game.player('pilot')!, rival = game.player('rival')!;
      const origin = nav.nearest(pilot.x, pilot.y, pilot.z);
      for (let attempt = 0; origin && attempt < 40; attempt++) {
        const angle = rand() * Math.PI * 2, distance = 8 + rand() * 14;
        const node = nav.nearest(origin.x + distance * Math.cos(angle), origin.y, origin.z + distance * Math.sin(angle));
        if (!node || Math.hypot(node.x - pilot.x, node.z - pilot.z) < 7 ||
            lineOfSight(game.map, [pilot.x, pilot.y + game.map.eye, pilot.z], [node.x, node.y + 1.5, node.z])) continue;
        const path = nav.path(origin, node, 2400);
        if (!path || path.length > 64) continue;
        Object.assign(rival, { x: node.x, y: node.y, z: node.z });
        break;
      }
    }
    return { scenario };
  }
  const nav = navFor(game);
  for (let attempt = 0; attempt < 1500; attempt++) {
    const a = nav.nodes[Math.floor(rand() * nav.nodes.length)];
    if (!a?.links.length) continue;
    const direction = rand() * 2 * Math.PI, distance = 5 + rand() * 7;
    const b = nav.nearest(a.x + Math.cos(direction) * distance, a.y, a.z + Math.sin(direction) * distance);
    if (!b || Math.abs(a.y - b.y) > .6 || Math.hypot(a.x - b.x, a.z - b.z) < 4 ||
        !lineOfSight(game.map, [a.x, a.y + 1.3, a.z], [b.x, b.y + 1.3, b.z])) continue;
    const yaw = Math.atan2(a.x - b.x, a.z - b.z);
    const pose = (scenario === 'wall' || scenario === 'corner') ? cornerStart(game.map, a, rand) :
      { x: a.x, y: a.y, z: a.z, yaw: encounterYaw(yaw, scenario, focused, rand()) };
    if (!pose) continue;
    const occupied = [...game.slots.values()].some(({ state: p }) => p.id !== 'pilot' && p.id !== 'rival' &&
      [pose, b].some(at => Math.abs(at.y - p.y) < game.map.height && Math.hypot(at.x - p.x, at.z - p.z) < 2 * game.map.radius));
    if (occupied) continue;
    if (scenario === 'encounter' && focused) {
      const course = rivalCourse(game.map, nav, a, b, scenario, rand() < .5 ? 'left' : 'right', rand);
      if (!course) continue;
      const slot = game.slots.get('rival')!;
      slot.controller = courseRival(slot.controller!, { ...course, wait: 0, duration: 2 * TICK_HZ },
        game.tick, slot.state.lifeId);
    }
    Object.assign(game.player('pilot')!, pose);
    Object.assign(game.player('rival')!, { x: b.x, y: b.y, z: b.z, yaw: yaw + (scenario === 'retreat' ? 0 : Math.PI) + (rand() - .5) * 1.5 });
    for (const id of ['pilot', 'rival']) game.slots.get(id)!.spawnProtectedUntilTick = 0;
    if (scenario === 'smoke') {
      const depth = .35 + .35 * rand();
      // Sample smoke across the lane and on either rim. Use real supported ground so walls and
      // elevated walkways clip the cloud in the same way as an ordinary grenade.
      const offset = rand() < .5 ? (rand() < .5 ? -1 : 1) * SMOKE.radius * (.78 + .24 * rand()) : 0;
      const distance = Math.hypot(b.x - a.x, b.z - a.z);
      const x = a.x + (b.x - a.x) * depth + (b.z - a.z) / distance * offset;
      const z = a.z + (b.z - a.z) * depth - (b.x - a.x) / distance * offset;
      const node = nav.nearest(x, a.y + (b.y - a.y) * depth, z);
      if (!node || Math.hypot(node.x - x, node.z - z) > 1 || Math.abs(node.y - a.y) > 1) continue;
      const smoke = settleSmoke(game.map, { id: -1, owner: 'rival', x: node.x, y: node.y, z: node.z, life: SMOKE.life });
      // Some independent trials begin inside a blocked lane, before the pilot has seen the rival.
      if (focused && game.layout === '1v1' && rand() < .5) {
        const cloud = { ...smoke, life: SMOKE.clear + 3 * TICK_HZ };
        if (smokeBlocks([cloud], [a.x, a.y + game.map.eye, a.z], [b.x, b.y + game.map.eye, b.z]))
          return { scenario, smoke: cloud, smokeTick: 0 };
      }
      return { scenario, smoke, smokeTick: Math.round((.5 + .7 * rand()) * TICK_HZ) };
    }
    return { scenario };
  }
  throw Error(`Could not construct a playable ${scenario} scenario on ${game.map.data.mapId}`);
}

function play(actor: FrozenActor, opponent: Opponent, map: string, layout: TeamLayout, team: Team,
              scenario: Scenario, focused: boolean, seed: number, seconds: number) {
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
      : learnedOpponent(opponent.actor.model);
    game.addPlayer(id, { name: id, team: side, char, skins: [], bot: true, loadout: randomBotLoadout(rand), utility: randomBotUtility(rand) }, driver);
  }
  game.phase = 'countdown';
  game.phaseT = 1;
  game.step();
  game.snapshot();
  game.phaseT = seconds * TICK_HZ;
  const start = placeEncounter(game, scenario, focused, rand);
  const firstTick = game.tick;
  const initialSmokeLife = start.smoke?.life ?? 0;
  let openingDuel = layout === '1v1' && (start.scenario === 'encounter' || !!start.openingRange);
  // Some players hold their spawn. In this exercise the learner has to initiate contact.
  // The rival resumes its ordinary policy on first damage or when the sampled wait expires.
  const waitingTicks = scenario === 'waiting' ? Math.round((focused ? 30 : 12 + 18 * rand()) * TICK_HZ) : 0;
  const waiting = [...game.slots.values()].filter(slot => waitingTicks && slot.info.team === enemy)
    .map(slot => ({ slot, driver: slot.controller }));
  for (const { slot } of waiting) slot.controller = undefined;
  let waitingDecisionCount: number | undefined;
  const smokeWindow = { start: Infinity, end: Infinity };
  let rivalLifeEnd: number | undefined;
  // Timeout is the actual end of each shortened match in Match.stepPhase; there is no bootstrap tick.
  while (game.phaseT > 0) {
    if (start.smoke && game.tick === firstTick + start.smokeTick!) {
      smokeWindow.start = seats[0].steps.length;
      game.smokes.push(start.smoke);
    }
    if (start.smoke && smokeWindow.start !== Infinity && smokeWindow.end === Infinity && start.smoke.life <= SMOKE.clear)
      smokeWindow.end = seats[0].steps.length;
    for (const seat of seats) seat.wasAlive = game.player(seat.id)!.alive;
    const scoreDiff = game.score[team] - game.score[enemy];
    game.step();
    if ((start.smoke || scenario === 'rear') && rivalLifeEnd === undefined && !game.player('rival')!.alive) rivalLifeEnd = seats[0].steps.length;
    const events = game.snapshot().events;
    if (openingDuel) {
      const steps = seats[0].steps, elapsed = game.tick - firstTick;
      const pilot = game.player('pilot')!, rival = game.player('rival')!, last = steps.at(-1);
      if (last && events.some(e => e.t === 'hit' && e.shooter === 'pilot' && e.victim === 'rival' && e.dmg > 0)) {
        last.reward += start.openingRange
          ? sightlineDamageCredit(last.obs, elapsed, Math.hypot(pilot.x - rival.x, pilot.z - rival.z), start.openingRange.minimum)
          : openingDamageCredit(steps[0].obs, elapsed);
        openingDuel = false;
      }
      if (!pilot.alive || !rival.alive || elapsed >= (start.openingRange ? 3 : 2) * TICK_HZ) openingDuel = false;
    }
    if (waiting.length && (game.tick - firstTick >= waitingTicks || events.some(event => event.t === 'hit'))) {
      waitingDecisionCount = seats[0].steps.length;
      for (const { slot, driver } of waiting) slot.controller = driver;
      waiting.length = 0;
    }
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
  if (scenario === 'waiting' && layout === '1v1') {
    creditWaitingSearch(seats[0].steps.slice(0, waitingDecisionCount), game.map.data.bounds);
  }
  const outcome = Math.sign(game.score[team] - game.score[enemy]);
  let clearRetreatWindows = 0;
  for (const seat of seats) {
    if (!seat.steps.length) throw Error(`No live decisions for ${seat.id} in the simulated match`);
    clearRetreatWindows += scoreSearchProgress(seat.steps, game.map.data.bounds, EXPLORATION_TICKS, TICK_HZ).clearRetreatWindows;
    seat.steps[seat.steps.length - 1].reward += outcome;
  }
  // Reward observed reacquisition in the actual smoke window. Both actors
  // independently chose every control leading up to it.
  if (layout === '1v1' && scenario === 'rear')
    scoreContactDrill(seats[0].steps.slice(0, rivalLifeEnd), 'rear', 6 * TICK_HZ, EXPLORATION_TICKS);
  if (layout === '1v1' && start.smoke)
    scoreContactDrill(seats[0].steps.slice(0, rivalLifeEnd), 'smoke',
      start.smokeTick! + initialSmokeLife - SMOKE.clear + 3 * TICK_HZ, EXPLORATION_TICKS, smokeWindow);
  const trajectories = Object.fromEntries(seats.map(({ id, steps }) => [id, steps]));
  const opponentHash = opponent.mode === 'frozen' ? opponent.actor.hash : actor.hash;
  return { map, layout, seed, team, scenario: start.scenario, shortenedApproach: start.shortenedApproach,
    openingRange: start.openingRange, opponent: opponentHash, opponentMode: opponent.mode,
    score: game.score, outcome, clearRetreatWindows, ticks: game.tick - firstTick, trajectories };
}

function boundedInteger(s: string, name: string, min: number, max: number) {
  const n = Number(s);
  if (!/^\d+$/.test(s) || !Number.isSafeInteger(n) || n < min || n > max) throw Error(`Invalid --${name}`);
  return n;
}

function layoutAt(index: number): '1v1' | '2v2' {
  return index % 4 === 1 || index % 4 === 2 ? '2v2' : '1v1';
}

export function curriculum(count: number, focus: Focus[], rand: () => number) {
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
  // These drills award their opening/contact credit only in a duel. Reserve one
  // existing duel per scheduled focus; repeated drills can still train team play.
  const reserved = new Set<number>();
  const covered = new Set<Scenario>();
  for (const scenario of focus) {
    if (scenario === 'wall') continue;
    const duel = schedule.findIndex((entry, i) => entry.focused && entry.scenario === scenario && layoutAt(i) === '1v1');
    if (duel >= 0) { reserved.add(duel); covered.add(scenario); }
  }
  for (const scenario of focus) {
    if (scenario === 'wall' || covered.has(scenario)) continue;
    const source = schedule.findIndex(entry => entry.focused && entry.scenario === scenario);
    if (source < 0) continue;
    const available = schedule.map((_, i) => i).filter(i => layoutAt(i) === '1v1' && !reserved.has(i));
    if (!available.length) break;
    const dest = available[Math.floor(rand() * available.length)];
    [schedule[source], schedule[dest]] = [schedule[dest], schedule[source]];
    reserved.add(dest);
    covered.add(scenario);
  }
  return schedule;
}

function main() {
  const { values } = parseArgs({ options: {
    model: { type: 'string' }, output: { type: 'string' }, opponent: { type: 'string', multiple: true, default: [] },
    focus: { type: 'string', multiple: true, default: [] }, league: { type: 'string' },
    seed: { type: 'string', default: '777' }, episodes: { type: 'string', default: '8' }, seconds: { type: 'string', default: '30' },
    'seed-version': { type: 'string' },
  } });
  if (!values.model || !values.output) throw Error('Specify --model actor.json --output trajectories.json');
  const seed = boundedInteger(values.seed, 'seed', 0, 4294967295);
  const version = seedVersion(values['seed-version']);
  const count = boundedInteger(values.episodes, 'episodes', 1, 256), seconds = boundedInteger(values.seconds, 'seconds', 1, 300);
  const focus = [...new Set(values.focus)].map(value => {
    if (value === 'wall' || value === 'rear' || value === 'smoke' || value === 'waiting' || value === 'encounter' || value === 'sightline') return value;
    throw Error('Each --focus must be wall, rear, smoke, waiting, encounter or sightline');
  });
  const actor = readActor(values.model);
  if (actor.model.version !== 4 && actor.model.version !== 1) throw Error('Motor-assisted training is retired');
  const pool = new Map<string, Opponent>([['self-play', { mode: 'self-play' }]]);
  for (const file of values.opponent) {
    const rival = readActor(file);
    if (directPolicy(rival.model)) pool.set(rival.hash, { mode: 'frozen', actor: rival });
  }
  const random = rng(seed);
  const order = MAPS.slice();
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const episodes = [];
  const appearances: Record<'1v1' | '2v2', Record<string, number>> = { '1v1': {}, '2v2': {} };
  const schedule = curriculum(count, focus, random);
  const previous = values.league ? JSON.parse(readFileSync(values.league, 'utf8')) : {};
  const league = opponentLeague([...pool.keys()], count, previous, random);
  for (let i = 0; i < count; i++) {
    const layout = layoutAt(i);
    const team = i % 2 ? 'B' : 'A';
    const { scenario, focused } = schedule[i];
    const rival = league.select(i, layout);
    appearances[layout][rival] = (appearances[layout][rival] ?? 0) + 1;
    const episode = play(actor, pool.get(rival)!, order[i % order.length].id, layout, team, scenario, focused, trainingSeed(random(), version), seconds);
    if (scenario !== 'waiting' && scenario !== 'sightline' && !(scenario === 'encounter' && focused)) league.observe(rival, episode.outcome, layout);
    episodes.push({ ...episode, focused });
  }
  const remedial = episodes.filter(e => e.layout === '1v1' && e.focused && e.scenario === 'waiting');
  if (remedial.length) console.log('Shortened stationary approaches:', remedial.filter(e => e.shortenedApproach).length, '/', remedial.length);
  const sightlines = episodes.flatMap(e => e.openingRange ? [e.openingRange.distance] : []);
  if (sightlines.length) console.log('Live sightline starts (m):', sightlines.map(distance => distance.toFixed(1)).join(', '));
  console.log('Clear retreat windows excluded from novelty credit:', episodes.reduce((n, e) => n + e.clearRetreatWindows, 0));
  const payload = { version: 2, seedVersion: version, seed, rulesVersion: RULES_VERSION, actorHash: actor.hash, axisStd: AXIS_STD, focus, episodes };
  writeFileSync(values.output, JSON.stringify(payload), { mode: 0o600 });
  if (values.league) writeFileSync(values.league, JSON.stringify(league.payoffs), { mode: 0o600 });
  console.log('Training opponent appearances:', JSON.stringify(appearances));
  const decisions = episodes.flatMap(e => Object.values(e.trajectories)).reduce((n, steps) => n + steps.length, 0);
  console.log(`Simulated ${count} matches, collected ${decisions} policy decisions.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(); } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exitCode = 1;
  }
}

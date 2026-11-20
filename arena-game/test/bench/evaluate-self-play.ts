import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { getMap, MAPS } from '../../shared/arenaMap.ts';
import { Bot, BOT_SKILL, navFor } from '../../shared/bot.ts';
import { learnedTactics } from '../../shared/botTactics.ts';
import tacticsModel from '../../shared/botTacticsModel.json';
import { MATCH_TICKS, SMOKE, TEAM_CAPACITY, TICK_HZ, randomBotHero, randomBotLoadout, randomBotUtility, type Team } from '../../shared/content.ts';
import { settleSmoke, smokeBlocks } from '../../shared/grenade.ts';
import { humanObservation, wrapAngle } from '../../shared/humanCombat.ts';
import { lineOfSight, type ArenaMap, type Vec3 } from '../../shared/map.ts';
import { Match, type Controller } from '../../shared/match.ts';
import { parseNeuralPolicy, type NeuralPolicyModel } from '../../shared/neuralPolicy.ts';
import { BTN, canSlideTo, forward, playerEye } from '../../shared/sim.ts';

type Mode = '1v1' | '2v2';
type Scenario = 'round' | 'rear-search' | 'smoke' | 'wall';
const TACTICS = learnedTactics(tacticsModel.weights, tacticsModel.margin);
const TEAMS: Team[] = ['A', 'B'];
const MODES: Mode[] = ['1v1', '2v2'];
const CHALLENGES: Scenario[] = ['rear-search', 'smoke', 'wall'];

function random(seed: number) {
  let state = seed >>> 0;
  return () => (state = (Math.imul(1664525, state) + 1013904223) >>> 0) / 2 ** 32;
}

function load(path: string) {
  const bytes = readFileSync(path);
  const model = parseNeuralPolicy(JSON.parse(bytes.toString('utf8')));
  if (!model || model.synthetic) throw Error('Expected a compatible, nonsynthetic Arena policy at ' + path);
  return { model, sha256: createHash('sha256').update(bytes).digest('hex') };
}

function counters() {
  return { live: 0, unseen: 0, glimpseTicks: 0, offscreenFire: 0, searchRadians: 0, moving: 0, stuck: 0, firstContact: 0, pilots: 0 };
}
type Counters = ReturnType<typeof counters>;

function monitor(bot: Bot, counters: Counters, duration: number): Controller {
  let prev: { life: number; x: number; z: number; obstructed: boolean } | undefined;
  let contact = false, stalls = 0;
  counters.pilots++;
  counters.firstContact += duration; // Right-censor a player who never acquires contact.
  return { think(m, id) {
    const me = m.player(id)!;
    const input = bot.think(m, id);
    if (m.phase !== 'live' || !me.alive) { prev = undefined; stalls = 0; return input; }
    counters.live++;
    const contacts = [...m.slots.values()].filter(s => s.state.alive && s.state.team !== me.team)
      .map(({ state: p }) => ({ team: p.team, crouched: p.crouched, feet: [p.x, p.y, p.z] as Vec3 }));
    const confidence = humanObservation(m.map, me, contacts, (a, b) => m.heroes.visible(a, b), [0, 0],
      undefined, undefined, (a, b) => m.heroes.visible(a, b, true))[0];
    const visible = confidence > 0;
    if (confidence > 0 && confidence < 1) counters.glimpseTicks++;
    if (visible && !contact) { counters.firstContact += m.tick - duration; contact = true; }
    if (!visible) {
      counters.unseen++;
      counters.searchRadians += Math.abs(wrapAngle(input.yaw - me.yaw));
      if (input.buttons & BTN.FIRE) counters.offscreenFire++;
    }
    const blocked = prev && prev.life === me.lifeId && prev.obstructed && Math.hypot(me.x - prev.x, me.z - prev.z) < .015;
    stalls = blocked ? stalls + 1 : 0;
    if (stalls >= TICK_HZ / 3) counters.stuck++;
    const trying = me.grounded && Math.hypot(input.mx, input.mz) > .3 && me.rootUntil <= me.abilityTick && me.pullT <= 0;
    if (trying) counters.moving++;
    const [fx, fz] = forward(input.yaw);
    const x = me.x + .16 * (fx * input.mz - fz * input.mx);
    const z = me.z + .16 * (fz * input.mz + fx * input.mx);
    prev = { life: me.lifeId, x: me.x, z: me.z, obstructed: trying && !canSlideTo(m.map, me, x, z) };
    return input;
  } };
}

function place(m: Match, scenario: Scenario, rand: () => number) {
  if (scenario === 'round') return;
  const nav = navFor(m), a = m.player('A0')!, b = m.player('B0')!;
  // A and B keep identical starting positions across the side swap.
  for (let attempt = 0; attempt < 1200; attempt++) {
    const u = nav.nodes[Math.floor(rand() * nav.nodes.length)];
    if (!u.links.length) continue;
    const angle = rand() * 2 * Math.PI;
    const v = nav.nearest(u.x + 8 * Math.cos(angle), u.y, u.z + 8 * Math.sin(angle));
    if (!v || Math.abs(u.y - v.y) > .6 || Math.hypot(u.x-v.x, u.z-v.z) < 5) continue;
    const eyes: [Vec3, Vec3] = [[u.x, u.y + m.map.eye, u.z], [v.x, v.y + m.map.eye, v.z]];
    if (!lineOfSight(m.map, ...eyes)) continue;
    const facing = Math.atan2(u.x - v.x, u.z - v.z);
    Object.assign(a, { x: u.x, y: u.y, z: u.z, yaw: facing });
    Object.assign(b, { x: v.x, y: v.y, z: v.z, yaw: wrapAngle(facing + Math.PI) });
    if (scenario === 'rear-search') {
      a.yaw = wrapAngle(a.yaw + Math.PI);
      b.yaw = wrapAngle(b.yaw + Math.PI);
    } else if (scenario === 'wall') {
      // Put ONE fixed seat beside a real obstruction. Both policies take that seat.
      let wall = false;
      for (let i = 0; i < 8; i++) {
        const yaw = i * Math.PI / 4, [x, z] = forward(yaw);
        if (canSlideTo(m.map, a, a.x + x * 1.1, a.z + z * 1.1)) continue;
        for (let d = .05; d <= 1.1; d += .05) {
          if (!canSlideTo(m.map, a, u.x + x * d, u.z + z * d)) break;
          a.x = u.x + x * d; a.z = u.z + z * d;
        }
        a.yaw = yaw; wall = true; break;
      }
      if (!wall) continue;
    } else {
      const cloud = settleSmoke(m.map, { id: -1, owner: 'evaluation', x: (u.x + v.x)/2, y: (u.y + v.y)/2,
        z: (u.z + v.z)/2, life: SMOKE.clear + 3 * TICK_HZ });
      if (!smokeBlocks([cloud], ...eyes)) continue;
      m.smokes.push(cloud);
    }
    for (const slot of m.slots.values()) slot.spawnProtectedUntilTick = 0;
    return;
  }
  throw Error('Could not construct ' + scenario + ' on ' + m.map.data.mapId);
}

/** Same visible warm-up and world; displace only an occluded opponent after the smoke appears.
 * Invoke production controllers with the same own-state history and compare their decisions.
 */
function hiddenTargetInvariant(map: ArenaMap, seed: number, model: NeuralPolicyModel) {
  const match = new Match(map, '1v1');
  for (const team of TEAMS) match.addPlayer(team + '0', { name: team, team, char: 2, skins: [], bot: true });
  place(match, 'smoke', random(seed));
  match.phase = 'live';
  const pilot = match.player('A0')!, target = match.player('B0')!;
  const eye: Vec3 = [pilot.x, pilot.y + playerEye(map, pilot), pilot.z];
  const hidden = (x: number, z: number) => [1.1, 1.75].every(h => !match.heroes.visible(eye, [x, target.y+h, z], true));
  const origin = [target.x, target.z] as const;
  if (!hidden(...origin)) return false;
  const alternate = [0, 1, 2, 3, 4, 5, 6, 7].map(n =>
    [origin[0] + .7 * Math.cos(n * Math.PI / 4), origin[1] + .7 * Math.sin(n * Math.PI / 4)] as const)
    .find(([x, z]) => canSlideTo(map, target, x, z) && hidden(x, z));
  if (!alternate) return false;
  const smoke = match.smokes.slice();
  function actions(position: readonly [number, number]) {
    const bot = new Bot(seed, BOT_SKILL.normal, TACTICS, undefined, undefined, model);
    match.tick = 0;
    match.smokes = [];
    [target.x, target.z] = origin;
    bot.think(match, 'A0');
    match.smokes = smoke;
    [target.x, target.z] = position;
    const result = [];
    for (let t = 1; t <= 2 * TICK_HZ; t++) {
      match.tick = t;
      result.push(bot.think(match, 'A0'));
    }
    return result;
  }
  return JSON.stringify(actions(origin)) === JSON.stringify(actions(alternate));
}

/** Paired legs share seat seeds, roster, positions and skills. Only the policy assignment swaps. */
export function play(map: ArenaMap, mode: Mode, scenario: Scenario, seed: number, side: Team, duration: number,
  candidate?: NeuralPolicyModel, opponent?: NeuralPolicyModel) {
  const m = new Match(map, mode), rand = random(seed);
  const counts = { A: counters(), B: counters() };
  for (const team of TEAMS) for (let i = 0; i < TEAM_CAPACITY[mode][team]; i++) {
    const id = team + i;
    const bot = new Bot(Math.floor(rand() * 2**31), BOT_SKILL.normal, TACTICS, undefined, undefined, team === side ? candidate : opponent);
    const char = randomBotHero([...m.slots.values()].map(s => s.info), team, rand);
    m.addPlayer(id, { name: id, team, bot: true, char, skins: [], loadout: randomBotLoadout(rand), utility: randomBotUtility(rand) },
      scenario === 'round' ? bot : monitor(bot, counts[team], duration));
  }
  m.phase = 'live'; m.phaseT = duration;
  place(m, scenario, rand);
  while (m.phase === 'live') {
    m.step();
    if (m.tick % TICK_HZ === 0) m.snapshot(); // Drain transient simulation events during long rounds.
  }
  const other = side === 'A' ? 'B' : 'A';
  return { seed, side, map: map.data.mapId, mode, scenario, seconds: m.tick / TICK_HZ,
    margin: m.score[side] - m.score[other], candidate: counts[side], opponent: counts[other] };
}

type Leg = ReturnType<typeof play>;

function behavior(legs: Leg[], role: 'candidate' | 'opponent') {
  const total = counters();
  for (const leg of legs) for (const key of Object.keys(total) as (keyof Counters)[]) total[key] += leg[role][key];
  return { ...total, stallFraction: total.stuck / Math.max(1, total.moving),
    offscreenFireFraction: total.offscreenFire / Math.max(1, total.unseen),
    meanContactSeconds: total.firstContact / Math.max(1, total.pilots) / TICK_HZ,
    unseenTurnDegreesPerSecond: total.searchRadians * (180 / Math.PI) * TICK_HZ / Math.max(1, total.unseen) };
}

function scenarioStats(legs: Leg[]) {
  return { candidate: behavior(legs, 'candidate'), opponent: behavior(legs, 'opponent'), legs: legs.length };
}

// Each block is one independent map/seed; its mirrored legs and game modes stay together.
export function score(legs: { seed: number; map: string; margin: number }[]) {
  const blocks = new Map<string, number>();
  for (const { seed, map, margin } of legs) {
    const key = map + '/' + seed;
    blocks.set(key, (blocks.get(key) ?? 0) + Math.sign(margin));
  }
  const values = [...blocks.values()];
  const wins = values.filter(v => v > 0).length, losses = values.filter(v => v < 0).length, n = wins + losses;
  // Exact one-sided sign test, computed in log space for large campaigns.
  let p = 0, logTerm = -n * Math.LN2;
  for (let k = 0; k <= n; k++) {
    if (k >= wins) p += Math.exp(logTerm);
    logTerm += Math.log(n - k) - Math.log(k + 1);
  }
  const fraction = legs.reduce((sum, leg) => sum + (Math.sign(leg.margin) + 1) / 2, 0) / Math.max(1, legs.length);
  return { blocks: blocks.size, wins, losses, tied: blocks.size - n, winFractionWithDraws: fraction, oneSidedP: Math.min(1, p) };
}

function numberArg(v: string, min: number, max: number) {
  const n = Number(v);
  if (!v.trim() || !Number.isInteger(n) || n < min || n > max) throw Error('Invalid numeric evaluation argument: ' + v);
  return n;
}

function main() {
  const { positionals, values } = parseArgs({ allowPositionals: true, options: {
    incumbent: { type: 'string' }, seeds: { type: 'string', default: '3' }, seed: { type: 'string', default: '13093847' },
    maps: { type: 'string', default: 'aster,sakura,blackflag' }, seconds: { type: 'string', default: '12' },
    'screen-only': { type: 'boolean', default: false },
  } });
  if (positionals.length !== 1) throw Error('Usage: evaluate-self-play.ts <candidate.json> [--incumbent file] [--screen-only]');
  const candidate = load(positionals[0]), incumbent = values.incumbent ? load(values.incumbent) : undefined;
  const seeds = numberArg(values.seeds, 1, 100), firstSeed = numberArg(values.seed, 0, 2**31 - seeds - 1);
  const seconds = numberArg(values.seconds, 1, 60);
  const maps = [...new Set(values.maps.split(','))];
  if (!maps.length || maps.some(id => !MAPS.some(m => m.id === id))) throw Error('Unknown evaluation map');
  const challenges: Leg[] = [];
  const rounds = new Map<string, Leg[]>();
  for (const id of maps) for (let i = 0; i < seeds; i++) {
    const mixedSeed = (firstSeed + i) ^ createHash('sha256').update(id).digest().readInt32LE();
    for (const side of TEAMS) for (const scenario of CHALLENGES) {
      challenges.push(play(getMap(id), '1v1', scenario, mixedSeed, side, seconds * TICK_HZ, candidate.model, incumbent?.model));
    }
  }
  const byScenario = Object.fromEntries(CHALLENGES.map(s => [s, scenarioStats(challenges.filter(l => l.scenario === s))]));
  const smoke = byScenario.smoke, wall = byScenario.wall, search = byScenario['rear-search'];
  const hiddenTargetChecks = maps.map(map => hiddenTargetInvariant(getMap(map), firstSeed, candidate.model));
  const gates: Record<string, boolean> = {
    hiddenTargetInvariant: hiddenTargetChecks.every(Boolean),
    sufficientCoverage: maps.length >= 3 && seeds >= 2 && seconds >= 8,
    candidateHasSearch: search.candidate.unseenTurnDegreesPerSecond > .3 && search.candidate.meanContactSeconds < seconds,
    rearSearch: search.candidate.meanContactSeconds <= search.opponent.meanContactSeconds + 2,
    smokeContact: smoke.candidate.meanContactSeconds < seconds && smoke.candidate.meanContactSeconds <= smoke.opponent.meanContactSeconds + 2,
    smokeOffscreenTrigger: smoke.candidate.offscreenFireFraction <= Math.max(.04, smoke.opponent.offscreenFireFraction + .02),
    wallStalls: wall.candidate.stallFraction <= wall.opponent.stallFraction + .04,
  };
  // A failing development screen never consumes a full tournament or approves a release.
  const tournament = !values['screen-only'] && Object.values(gates).every(Boolean);
  if (tournament) {
    const opponents = [{ name: 'baseline', model: undefined as NeuralPolicyModel | undefined }];
    if (incumbent) opponents.push({ name: 'incumbent', model: incumbent.model });
    for (const opponent of opponents) {
      const legs: Leg[] = [];
      for (const id of maps) for (let i = 0; i < seeds; i++) for (const mode of MODES) {
        // Tournament seeds are disjoint from the preceding development-screen starts.
        const mixedSeed = (firstSeed + i) ^ createHash('sha256').update('round/' + id).digest().readInt32LE();
        for (const side of TEAMS) legs.push(play(getMap(id), mode, 'round', mixedSeed, side, MATCH_TICKS, candidate.model, opponent.model));
      }
      rounds.set(opponent.name, legs);
    }
  }
  const comparisons = Object.fromEntries([...rounds].map(([name, legs]) => [name, score(legs)]));
  const byMode = Object.fromEntries([...rounds].map(([name, legs]) => [name, Object.fromEntries(MODES.map(mode =>
    [mode, score(legs.filter(leg => leg.mode === mode))]))]));
  gates.fullRounds = tournament;
  if (tournament) {
    gates.improved = Object.values(comparisons).every(s => s.blocks >= 6 && s.oneSidedP <= .05 && s.winFractionWithDraws > .5);
    gates.bothModes = Object.values(byMode).every(modes => MODES.every(mode => modes[mode].winFractionWithDraws >= .5));
  }
  console.log(JSON.stringify({ passed: Object.values(gates).every(Boolean), gates, byMode, byScenario, comparisons,
    candidate: candidate.sha256, incumbent: incumbent?.sha256 ?? 'baseline', config: { maps, seeds, firstSeed, seconds },
    fullRounds: [...rounds.values()].reduce((sum, legs) => sum + legs.length, 0) }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(); } catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }
}

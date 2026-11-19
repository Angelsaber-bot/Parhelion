import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { getMap, MAPS } from '../../shared/arenaMap.ts';
import { Bot, BOT_SKILL, navFor } from '../../shared/bot.ts';
import { learnedTactics } from '../../shared/botTactics.ts';
import tacticsModel from '../../shared/botTacticsModel.json';
import { PLAYABLE_HERO_INDICES, randomBotLoadout, randomBotUtility, TICK_HZ, type Team } from '../../shared/content.ts';
import { humanObservation, wrapAngle } from '../../shared/humanCombat.ts';
import { lineOfSight, type ArenaMap } from '../../shared/map.ts';
import { Match, type Controller, type PlayerInfo } from '../../shared/match.ts';
import type { NavNode } from '../../shared/nav.ts';
import { parseNeuralPolicy, type NeuralPolicyModel } from '../../shared/neuralPolicy.ts';
import { BTN, type Input } from '../../shared/sim.ts';

const BASELINE_TACTICS = learnedTactics(tacticsModel.weights, tacticsModel.margin);
const STARTS = ['map-spawn', 'rear-contact'] as const;
type Start = typeof STARTS[number];
type Skill = keyof typeof BOT_SKILL;
const TEAMS = ['A', 'B'] as const;
const ACTIONS = Object.entries(BTN) as [keyof typeof BTN, number][];
const UNBLOCKED_STEP = .015;
const STALL_TICKS = Math.round(TICK_HZ * .3);
const DEG = 180 / Math.PI;

function random(seed: number) {
  let state = seed >>> 0;
  return () => (state = (Math.imul(1664525, state) + 1013904223) >>> 0) / 2 ** 32;
}

function kit(name: string, team: Team, rand: () => number): PlayerInfo {
  const char = PLAYABLE_HERO_INDICES[Math.floor(rand() * PLAYABLE_HERO_INDICES.length)];
  return { name, team, char, bot: true, skins: [], loadout: randomBotLoadout(rand), utility: randomBotUtility(rand) };
}

/** Choose legal nav nodes with an unobstructed opponent initially well outside the camera. */
function rearStart(map: ArenaMap, seed: number): [NavNode, NavNode] {
  const nav = navFor(new Match(map, '1v1'));
  const rand = random(seed ^ 0x194d10a);
  for (let attempt = 0; attempt < 240; attempt++) {
    const a = nav.nodes[Math.floor(rand() * nav.nodes.length)];
    if (!a?.links.length) continue;
    const angle = rand() * Math.PI * 2, distance = 6 + rand() * 8;
    const b = nav.nearest(a.x + Math.cos(angle) * distance, a.y, a.z + Math.sin(angle) * distance);
    if (!b || Math.abs(a.y - b.y) > .8 || Math.hypot(a.x - b.x, a.z - b.z) < 5) continue;
    if (lineOfSight(map, [a.x, a.y + map.eye, a.z], [b.x, b.y + 1.1, b.z])) return [a, b];
  }
  throw Error(`Could not find aligned rear-contact positions on map ${map.data.mapId} for seed ${seed}`);
}

interface Trial {
  map: ArenaMap;
  seed: number;
  seconds: number;
  team: Team;
  start: Start;
  skill: Skill;
  rear?: [NavNode, NavNode];
}

function rollOut(trial: Trial, model?: NeuralPolicyModel) {
  const { map, seed, seconds, team, skill, rear } = trial;
  const rand = random(seed ^ 0x4db8b9);
  const rivalTeam = team === 'A' ? 'B' : 'A';
  const match = new Match(map, '1v1');
  const tactics = skill === 'easy' ? undefined : BASELINE_TACTICS;
  const pilot = new Bot(seed, BOT_SKILL[skill], tactics, undefined, undefined, model);
  const rival = new Bot(seed ^ 0x49aba17, BOT_SKILL[skill], tactics);
  const pilotInfo = kit('Pilot', team, rand), rivalInfo = kit('Rival', rivalTeam, rand);

  let input: Input | undefined, visible = false, firstContactTick: number | null = null;
  const controller: Controller = { think(arena, id) {
    const me = arena.player(id)!, enemy = arena.player('rival')!;
    visible = me.alive && enemy.alive && humanObservation(map, me, [
      { team: enemy.team, crouched: enemy.crouched, feet: [enemy.x, enemy.y, enemy.z] },
    ], (a, b) => arena.heroes.visible(a, b), [0, 0])[0] === 1;
    if (visible && firstContactTick === null) firstContactTick = arena.tick;
    input = pilot.think(arena, id);
    return input;
  } };
  if (team === 'A') {
    match.addPlayer('pilot', pilotInfo, controller);
    match.addPlayer('rival', rivalInfo, rival);
  } else {
    match.addPlayer('rival', rivalInfo, rival);
    match.addPlayer('pilot', pilotInfo, controller);
  }

  const me = match.player('pilot')!, enemy = match.player('rival')!;
  if (rear) {
    const [a, b] = team === 'A' ? rear : [rear[1], rear[0]];
    const away = Math.atan2(b.x - a.x, b.z - a.z);
    Object.assign(me, { x: a.x, y: a.y, z: a.z, yaw: away });
    Object.assign(enemy, { x: b.x, y: b.y, z: b.z, yaw: wrapAngle(away + (rand() - .5) * 2) });
    // The scenario starts mid-life. Regular map spawns keep their ordinary protection time.
    for (const slot of match.slots.values()) slot.spawnProtectedUntilTick = 0;
  }
  match.phase = 'live';
  match.phaseT = Math.round(seconds * TICK_HZ);

  const initial = { pilot: [me.x, me.y, me.z, me.yaw], rival: [enemy.x, enemy.y, enemy.z, enemy.yaw] };
  const visited = new Set<string>(), actions = Object.fromEntries(ACTIONS.map(([name]) => [name, 0])) as Record<keyof typeof BTN, number>;
  let liveTicks = 0, visibleTicks = 0, searchDegrees = 0, moved = 0;
  let stalls = 0, lowMotionRun = 0, moveInputTicks = 0, lowMotionMoveTicks = 0, offscreenFireTicks = 0;
  let damageDealt = 0, damageTaken = 0, shots = 0, hitsOnRival = 0;
  while (match.phaseT > 0 && match.phase === 'live') {
    const { x, y, z, yaw, alive, grounded, lifeId } = me;
    match.step();
    for (const event of match.snapshot().events) {
      if (event.t === 'shot' && event.id === 'pilot') shots++;
      if (event.t !== 'hit') continue;
      if (event.shooter === 'pilot' && event.victim === 'rival') { damageDealt += event.dmg; hitsOnRival++; }
      if (event.victim === 'pilot' && event.shooter === 'rival') damageTaken += event.dmg;
    }
    if (!input || !alive) { lowMotionRun = 0; continue; }
    liveTicks++;
    visibleTicks += Number(visible);
    if (!visible && input.buttons & BTN.FIRE) offscreenFireTicks++;
    for (const [name, mask] of ACTIONS) if (input.buttons & mask) actions[name]++;
    visited.add(`${Math.floor(x / 2)},${Math.floor(y / 2)},${Math.floor(z / 2)}`);
    if (!me.alive || me.lifeId !== lifeId) { lowMotionRun = 0; continue; }
    if (!visible) searchDegrees += Math.abs(wrapAngle(me.yaw - yaw)) * DEG;
    const displacement = Math.hypot(me.x - x, me.z - z);
    moved += displacement;
    if (grounded && Math.hypot(input.mx, input.mz) > .3) {
      moveInputTicks++;
      if (displacement < UNBLOCKED_STEP) {
        lowMotionMoveTicks++;
        if (++lowMotionRun === STALL_TICKS) stalls++;
        continue;
      }
    }
    lowMotionRun = 0;
  }
  const kills = match.score[team], deaths = match.score[rivalTeam];
  return {
    initial, ticks: match.tick, kills, deaths, win: kills > deaths, loss: kills < deaths, damageDealt, damageTaken, shots, hitsOnRival,
    liveTicks, visibleTicks, firstContactSeconds: firstContactTick === null ? null : firstContactTick / TICK_HZ,
    searchDegrees, movedMeters: moved, visitedCells: visited.size, moveInputTicks, stalls, lowMotionMoveTicks, offscreenFireTicks, actions,
  };
}

type Rollout = ReturnType<typeof rollOut>;
interface Pair { map: string; seed: number; team: Team; start: Start; baseline: Rollout; candidate: Rollout }

function summarize(rollouts: Rollout[]) {
  const total = (metric: (r: Rollout) => number) => rollouts.reduce((sum, r) => sum + metric(r), 0);
  const count = rollouts.length;
  const acquired = total(r => Number(r.firstContactSeconds !== null));
  const live = total(r => r.liveTicks), visible = total(r => r.visibleTicks), unseen = live - visible;
  const moving = total(r => r.moveInputTicks);
  return {
    rollouts: count, wins: total(r => Number(r.win)), losses: total(r => Number(r.loss)), ties: total(r => Number(!r.win && !r.loss)),
    kills: total(r => r.kills), deaths: total(r => r.deaths), damageDealt: total(r => r.damageDealt), damageTaken: total(r => r.damageTaken),
    shots: total(r => r.shots), hitsOnRival: total(r => r.hitsOnRival),
    firstContactRate: acquired / count,
    meanFirstContactSeconds: acquired ? total(r => r.firstContactSeconds ?? 0) / acquired : null,
    meanTimeToContactOrEndSeconds: total(r => r.firstContactSeconds ?? r.ticks / TICK_HZ) / count,
    visibleFraction: live ? visible / live : null,
    searchDegreesPerSecond: unseen ? total(r => r.searchDegrees) / (unseen / TICK_HZ) : null,
    offscreenFireFraction: unseen ? total(r => r.offscreenFireTicks) / unseen : null,
    meanDistanceMeters: total(r => r.movedMeters) / count, meanCellsVisited: total(r => r.visitedCells) / count,
    stalls: total(r => r.stalls), lowMotionFractionWhenSteering: moving ? total(r => r.lowMotionMoveTicks) / moving : null,
    actionInputFractions: Object.fromEntries(ACTIONS.map(([name]) => [name, live ? total(r => r.actions[name]) / live : null])),
  };
}

function compare(pairs: Pair[]) {
  const baseline = summarize(pairs.map(p => p.baseline)), candidate = summarize(pairs.map(p => p.candidate));
  const score = (r: Rollout) => r.kills - r.deaths;
  const better = pairs.filter(p => score(p.candidate) > score(p.baseline)).length;
  const worse = pairs.filter(p => score(p.candidate) < score(p.baseline)).length;
  return { baseline, candidate, pairedScoreMargin: { better, worse, tied: pairs.length - better - worse } };
}

function integer(value: string, label: string, minimum: number, maximum: number) {
  const n = Number(value);
  if (value.trim() === '' || !Number.isInteger(n) || n < minimum || n > maximum) throw Error(`${label} must be an integer from ${minimum} through ${maximum}`);
  return n;
}

function choices<T extends string>(value: string, allowed: readonly T[], label: string): T[] {
  const selected = [...new Set(value.split(',').map(s => s.trim()))];
  if (selected.some(s => !allowed.some(option => option === s))) throw Error(`${label} must use ${allowed.join(', ')}`);
  return selected as T[];
}

function main() {
  const { positionals, values } = parseArgs({ allowPositionals: true, options: {
    maps: { type: 'string', default: 'aster,sakura,blackflag' },
    starts: { type: 'string', default: STARTS.join(',') },
    seeds: { type: 'string', default: '2' },
    seed: { type: 'string', default: '48271' },
    seconds: { type: 'string', default: '12' },
    skill: { type: 'string', default: 'normal' },
    help: { type: 'boolean', short: 'h' },
  } });
  const usage = 'Usage: node --import tsx test/bench/evaluate-neural.ts <model.json> [--maps aster,sakura,blackflag] [--starts map-spawn,rear-contact] [--seed 48271] [--seeds 2] [--seconds 12] [--skill normal]';
  if (values.help) { console.log(usage); return; }
  if (positionals.length !== 1) throw Error(usage);
  const [file] = positionals;
  const checkpoint = readFileSync(file, 'utf8');
  const model = parseNeuralPolicy(JSON.parse(checkpoint));
  if (!model) throw Error(`Invalid or incompatible neural checkpoint: ${file}`);
  const maps = choices(values.maps, MAPS.map(m => m.id), '--maps');
  const starts = choices(values.starts, STARTS, '--starts');
  const seeds = integer(values.seeds, '--seeds', 1, 100);
  const firstSeed = integer(values.seed, '--seed', 0, 0x7fffffff - seeds);
  const seconds = integer(values.seconds, '--seconds', 1, 120);
  if (!Object.hasOwn(BOT_SKILL, values.skill)) throw Error('--skill must be easy, normal or hard');
  const skill = values.skill as Skill;
  const pairs: Pair[] = [];
  for (const id of maps) {
    const map = getMap(id);
    for (let seed = firstSeed; seed < firstSeed + seeds; seed++) for (const start of starts) {
      const rear = start === 'rear-contact' ? rearStart(map, seed) : undefined;
      for (const team of TEAMS) {
        const trial = { map, seed, seconds, team, start, skill, rear };
        const baseline = rollOut(trial), candidate = rollOut(trial, model);
        if (JSON.stringify(baseline.initial) !== JSON.stringify(candidate.initial)) {
          throw Error(`Mismatched starting positions for map ${id}, seed ${seed}, team ${team}, ${start}`);
        }
        pairs.push({ map: id, start, seed, team, baseline, candidate });
      }
    }
  }
  console.log(JSON.stringify({
    model: { file, sha256: createHash('sha256').update(checkpoint).digest('hex'), rulesVersion: model.rulesVersion,
      context: model.context, width: model.width, heads: model.heads, layers: model.layers.length },
    config: { maps, starts, firstSeed, seeds, seconds, skill, tickHz: TICK_HZ },
    results: compare(pairs),
    byMap: Object.fromEntries(maps.map(id => [id, compare(pairs.filter(p => p.map === id))])),
    byStart: Object.fromEntries(starts.map(start => [start, compare(pairs.filter(p => p.start === start))])),
    pairs,
  }, null, 2));
}

try { main(); } catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

// node --import tsx scripts/audit-contact-duels.ts candidate.json incumbent.json seed [seed...]
import { readFileSync } from 'node:fs';
import { getMap } from '../shared/arenaMap.ts';
import { Bot, BOT_SKILL, navFor } from '../shared/bot.ts';
import { learnedTactics } from '../shared/botTactics.ts';
import tacticsModel from '../shared/botTacticsModel.json';
import { randomBotHero, randomBotLoadout, randomBotUtility, TICK_HZ, WEAPONS, type Team } from '../shared/content.ts';
import { humanObservation, wrapAngle } from '../shared/humanCombat.ts';
import { Match } from '../shared/match.ts';
import { parseNeuralPolicy, type NeuralPolicyModel } from '../shared/neuralPolicy.ts';
import { trialSeed } from './self-play-seeds.ts';

const tactics = learnedTactics(tacticsModel.weights, tacticsModel.margin);
const teams: Team[] = ['A', 'B'];

function load(path: string) {
  const model = parseNeuralPolicy(JSON.parse(readFileSync(path, 'utf8')));
  if (model?.version !== 4 || model.synthetic) throw Error('Expected a v4 Arena player policy');
  return model;
}

function positionPlayers(match: Match, draw: () => number) {
  const nav = navFor(match), a = match.player('A0')!, b = match.player('B0')!;
  function sees(me: typeof a, target: typeof b) {
    return humanObservation(match.map, me, [{team: target.team, crouched: target.crouched,
      feet: [target.x, target.y, target.z]}], (from, to) => match.heroes.visible(from, to), [0, 0])[0] === 1;
  }
  for (let attempt = 0; attempt < 4000; attempt++) {
    const u = nav.nodes[Math.floor(draw() * nav.nodes.length)], angle = draw() * 2 * Math.PI, radius = 1.5 + 5 * draw();
    const v = nav.nearest(u.x + radius * Math.cos(angle), u.y, u.z + radius * Math.sin(angle));
    if (!v || Math.abs(u.y - v.y) > .6) continue;
    const distance = Math.hypot(u.x - v.x, u.z - v.z);
    if (distance < 1.2 || distance > 6.5) continue;
    const facing = Math.atan2(u.x - v.x, u.z - v.z);
    Object.assign(a, {x: u.x, y: u.y, z: u.z, yaw: facing + (draw() - .5) * .5});
    Object.assign(b, {x: v.x, y: v.y, z: v.z, yaw: wrapAngle(facing + Math.PI + (draw() - .5) * .5)});
    if (sees(a, b) && sees(b, a)) return distance;
  }
  throw Error('No mutually visible close start on ' + match.map.data.mapId);
}

function duel(map: string, seed: number, side: Team, model: NeuralPolicyModel, opponent?: NeuralPolicyModel) {
  const match = new Match(getMap(map), '1v1');
  let state = seed >>> 0;
  const draw = () => (state = (Math.imul(1664525, state) + 1013904223) >>> 0) / 2 ** 32;
  const pilots = teams.map(team => {
    const bot = new Bot(Math.floor(draw() * 2**31), BOT_SKILL.normal, tactics, undefined, undefined,
      team === side ? model : opponent);
    const char = randomBotHero([...match.slots.values()].map(s => s.info), team, draw);
    match.addPlayer(team + '0', {name: team, team, bot: true, char, skins: [],
      loadout: randomBotLoadout(draw), utility: randomBotUtility(draw)});
    return bot;
  });
  match.phase = 'countdown';
  match.phaseT = 1;
  match.step();
  match.snapshot();
  match.phaseT = 5 * TICK_HZ;
  const distance = positionPlayers(match, draw);
  const tally = () => ({kills: 0, meleeKills: 0, damage: 0, firstDamageSeconds: null as number | null});
  const scores = {A: tally(), B: tally()};
  for (const [index, team] of teams.entries()) {
    const slot = match.slots.get(team + '0')!;
    slot.spawnProtectedUntilTick = 0;
    slot.controller = pilots[index];
  }
  const start = match.tick;
  while (match.phaseT > 0) {
    match.step();
    for (const ev of match.snapshot().events) {
      if (ev.t === 'hit' && ev.shooter !== ev.victim && ev.dmg > 0) {
        const score = scores[match.player(ev.shooter)!.team];
        score.damage += ev.dmg;
        score.firstDamageSeconds ??= (match.tick - start) / TICK_HZ;
      }
      if (ev.t === 'kill' && ev.killer !== ev.victim) {
        const score = scores[match.player(ev.killer)!.team];
        score.kills++;
        if (WEAPONS[ev.w]?.kind === 'melee') score.meleeKills++;
      }
    }
  }
  const other = side === 'A' ? 'B' : 'A';
  return {distance, margin: match.score[side] - match.score[other], pilot: scores[side], rival: scores[other]};
}

const [candidatePath, incumbentPath, ...args] = process.argv.slice(2);
const seeds = args.map(Number);
if (!args.length || args.some((arg, i) => !/^\d+$/.test(arg) || seeds[i] >= 2**31) || new Set(seeds).size !== seeds.length)
  throw Error('Supply distinct integer campaign seeds from 0 through 2^31 - 1');
const candidate = load(candidatePath), incumbent = load(incumbentPath);
const rows = [];
for (const campaign of seeds) for (const map of ['frostcourt', 'homeward', 'blackflag']) {
  for (let i = 0; i < 12; i++) for (const side of teams) {
    const seed = trialSeed(campaign, 'clash', map, i), rival = i % 2 ? incumbent : undefined;
    rows.push({campaign, map, seed, side, opponent: rival ? 'incumbent' : 'scripted',
      candidate: duel(map, seed, side, candidate, rival), incumbent: duel(map, seed, side, incumbent, rival)});
  }
}
console.log(JSON.stringify({seconds: 5, rows}));

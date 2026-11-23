import { closeContact } from './evaluate-close-contact.ts';
import { assess as assessSearch, passesSpawnSearch, fixtures as searchFixtures } from './evaluate-spawn-search.ts';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { getMap, MAPS } from '../../shared/arenaMap.ts';
import { Bot, BOT_SKILL, navFor } from '../../shared/bot.ts';
import { learnedTactics } from '../../shared/botTactics.ts';
import tacticsModel from '../../shared/botTacticsModel.json';
import { MATCH_TICKS, SMOKE, TEAM_CAPACITY, TICK_HZ, WEAPONS, loadoutWeapon, randomBotHero, randomBotLoadout, randomBotUtility, type Team } from '../../shared/content.ts';
import { settleSmoke, smokeBlocks } from '../../shared/grenade.ts';
import { loadFallback, type PublicFallback } from '../self-play-opponents.ts';
import { humanObservation, wrapAngle } from '../../shared/humanCombat.ts';
import { playerHitbox, rayShield } from '../../shared/hit.ts';
import { lineOfSight, type ArenaMap, type Vec3 } from '../../shared/map.ts';
import { Match, type Controller } from '../../shared/match.ts';
import { parseNeuralPolicy, type NeuralPolicyModel } from '../../shared/neuralPolicy.ts';
import { BTN, canSlideTo, forward, playerEye } from '../../shared/sim.ts';
import { seedVersion, tournamentSeeds, trialSeed } from '../self-play-seeds.ts';

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

/** Hold back a different set of Arena maps for the tournament, with the same match budget.
 * An explicit map list reproduces a targeted comparison on exactly those maps. */
export function evaluationMaps(seed: number, requested?: string) {
  const available = MAPS.map(map => map.id);
  if (requested !== undefined) {
    const maps = [...new Set(requested.split(',').map(value => value.trim()))];
    if (maps.some(id => !available.includes(id))) throw Error('Unknown evaluation map');
    return { screen: maps, tournament: maps };
  }
  const ordered = available.sort((a, b) => trialSeed(seed, 'maps', a) - trialSeed(seed, 'maps', b));
  const count = Math.min(3, ordered.length);
  return { screen: ordered.slice(0, count), tournament: ordered.slice(-count) };
}

export function tournamentLegs(campaign: number, maps: string[], count: number, version: 1 | 2) {
  const legs: { map: string; seed: number; mode: Mode; side: Team }[] = [];
  for (const map of maps) for (const seed of tournamentSeeds(campaign, map, count, version)) {
    for (const mode of MODES) for (const side of TEAMS) legs.push({ map, seed, mode, side });
  }
  return legs;
}

function load(path: string) {
  const bytes = readFileSync(path);
  const model = parseNeuralPolicy(JSON.parse(bytes.toString('utf8')));
  if (!model || model.synthetic) throw Error('Expected a compatible, nonsynthetic Arena policy at ' + path);
  return { model, sha256: createHash('sha256').update(bytes).digest('hex') };
}

function counters() {
  return { live: 0, unseen: 0, glimpseTicks: 0, offscreenFire: 0, searchRadians: 0, moving: 0, stuck: 0,
    smokeHidden: 0, smokeHiddenFire: 0, firstContact: 0, acquired: 0, pilots: 0, wallTrials: 0, wallCleared: 0, wallClearTicks: 0 };
}
type Counters = ReturnType<typeof counters>;

function cameraContact(m: Match, id: string) {
  const me = m.player(id)!;
  const targets = [...m.slots.values()].map(s => s.state).concat(m.heroes.decoys())
    .filter(p => p.alive && p.team !== me.team)
    .map(p => ({ team: p.team, crouched: p.crouched, feet: [p.x, p.y, p.z] as Vec3 }));
  return humanObservation(m.map, me, targets, (a, b) => m.heroes.visible(a, b), [0, 0],
    undefined, undefined, (a, b) => m.heroes.visible(a, b, true));
}

/** Use the ordinary scripted controller with exactly one camera observation in acquisition trials.
 * Its normal close-range/damage detection, live roster positions and marks still operate in full games.
 * A thin silhouette is reconstructed from its quantized bearing and distance, including its uncertainty. */
export function cameraLimitedScript(script: Controller): Controller {
  return { think(m, id) {
    const own = m.slots.get(id)!, me = own.state;
    const [confidence, yaw, pitch, range, crouch] = cameraContact(m, id);
    const slots = new Map([[id, own]]);
    if (confidence) {
      const distance = range * 45, bearing = me.yaw + yaw, crouched = !!crouch;
      const center = ((crouched ? .65 : 1.1) + playerHitbox(crouched).headY) / 2;
      const team: Team = me.team === 'A' ? 'B' : 'A';
      // Build the contact from the camera alone. Identity, velocity and hidden position never enter the view.
      const contact = { ...me, id: 'camera-contact', team, crouched, x: me.x - Math.sin(bearing) * distance,
        z: me.z - Math.cos(bearing) * distance, y: me.y + playerEye(m.map, me) + Math.tan(me.pitch + pitch) * distance - center };
      slots.set(contact.id, { ...own, state: contact, info: { ...own.info, team } });
    }
    const heroes = Object.assign(Object.create(m.heroes), { marks: [], entities: [], decoys: () => [],
      visible: (_a: Vec3, _b: Vec3, allowGlimpse = false) => confidence === 1 || allowGlimpse && confidence > 0 });
    // A read-only view of this tick is passed to think(). Match.step() acts on the untouched authoritative roster.
    const view: Match = Object.assign(Object.create(m), { slots, heroes, grenades: [] });
    return script.think(view, id);
  } };
}

function monitor(bot: Controller, counters: Counters, duration: number, wallSeat: boolean): Controller {
  let prev: { life: number; x: number; z: number; moving: boolean; obstructed: boolean } | undefined;
  let contact = false, stalls = 0;
  let firstLiveTick: number | undefined;
  let start: { life: number; x: number; z: number } | undefined;
  let escaped = false;
  let travel = 0;
  counters.pilots++;
  counters.firstContact += duration; // Right-censor a player who never acquires contact.
  if (wallSeat) { counters.wallTrials++; counters.wallClearTicks += duration; }
  return { think(m, id) {
    const me = m.player(id)!;
    const input = bot.think(m, id);
    if (m.phase !== 'live' || !me.alive) { prev = undefined; stalls = 0; return input; }
    firstLiveTick ??= m.tick;
    start ??= { life: me.lifeId, x: me.x, z: me.z };
    if (prev?.moving && prev.life === start.life && me.lifeId === start.life) travel += Math.hypot(me.x - prev.x, me.z - prev.z);
    if (wallSeat && !escaped && me.lifeId === start.life && travel >= 1 && Math.hypot(me.x - start.x, me.z - start.z) >= 1.5) {
      escaped = true;
      counters.wallCleared++;
      counters.wallClearTicks += m.tick - firstLiveTick - duration;
    }
    counters.live++;
    const contacts = [...m.slots.values()].filter(s => s.state.alive && s.state.team !== me.team)
      .map(({ state: p }) => ({ team: p.team, crouched: p.crouched, feet: [p.x, p.y, p.z] as Vec3 }));
    const observe = () => humanObservation(m.map, me, contacts, (a, b) => m.heroes.visible(a, b), [0, 0],
      undefined, undefined, (a, b) => m.heroes.visible(a, b, true))[0];
    const realContact = observe();
    const decoys = m.heroes.decoys();
    for (const p of decoys) contacts.push({ team: p.team, crouched: p.crouched, feet: [p.x, p.y, p.z] });
    const confidence = decoys.length && realContact < 1 ? observe() : realContact;
    const visible = confidence > 0;
    if (confidence > 0 && confidence < 1) counters.glimpseTicks++;
    if (realContact === 1 && !contact && me.lifeId === start.life) {
      counters.firstContact += m.tick - firstLiveTick - duration;
      counters.acquired++;
      contact = true;
    }
    if (!visible) {
      counters.unseen++;
      counters.searchRadians += Math.abs(wrapAngle(input.yaw - me.yaw));
      const firingGun = !!(input.buttons & BTN.FIRE) && WEAPONS[loadoutWeapon(me.loadout, input.weapon ?? me.weaponSlot)].kind === 'gun';
      if (firingGun) counters.offscreenFire++;
      // An otherwise visible target behind smoke is a different case from a target behind a wall or the camera.
      if (m.smokes.length && humanObservation(m.map, me, contacts, (a, b) => {
        if (!lineOfSight(m.map, a, b) || !smokeBlocks(m.smokes, a, b)) return false;
        const length = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
        if (length < .001) return false;
        const dir: Vec3 = [(b[0] - a[0]) / length, (b[1] - a[1]) / length, (b[2] - a[2]) / length];
        return !m.shields.some(s => s.hp > 0 && s.life > 0 && rayShield(a, dir, s.x, s.y, s.z, s.yaw) < length);
      }, [0, 0])[0]) {
        counters.smokeHidden++;
        if (firingGun) counters.smokeHiddenFire++;
      }
    }
    const blocked = prev && prev.life === me.lifeId && prev.obstructed && Math.hypot(me.x - prev.x, me.z - prev.z) < .015;
    stalls = blocked ? stalls + 1 : 0;
    if (stalls >= TICK_HZ / 3) counters.stuck++;
    const trying = me.grounded && Math.hypot(input.mx, input.mz) > .3 && me.rootUntil <= me.abilityTick && me.pullT <= 0;
    if (trying) counters.moving++;
    const [fx, fz] = forward(input.yaw);
    const x = me.x + .16 * (fx * input.mz - fz * input.mx);
    const z = me.z + .16 * (fz * input.mz + fx * input.mx);
    prev = { life: me.lifeId, x: me.x, z: me.z, moving: trying || me.dashT > 0 || !!(input.buttons & BTN.DASH),
      obstructed: trying && !canSlideTo(m.map, me, x, z) };
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
      // Each policy must begin with a clear target at the same geometry when the cloud is removed.
      if (cameraContact(m, 'A0')[0] !== 1 || cameraContact(m, 'B0')[0] !== 1) continue;
      const cloud = settleSmoke(m.map, { id: -1, owner: 'evaluation', x: (u.x + v.x)/2, y: (u.y + v.y)/2,
        z: (u.z + v.z)/2, life: SMOKE.clear + 3 * TICK_HZ });
      if (!smokeBlocks([cloud], ...eyes)) continue;
      m.smokes.push(cloud);
      if (cameraContact(m, 'A0')[0] || cameraContact(m, 'B0')[0]) { m.smokes.pop(); continue; }
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
  match.phase = 'live';
  const pilot = match.player('A0')!, target = match.player('B0')!;
  const rand = random(seed);
  const visibility = (x: number, z: number) => humanObservation(map, pilot,
    [{ team: target.team, crouched: target.crouched, feet: [x, target.y, z] }],
    (from, to) => match.heroes.visible(from, to), [0, 0], undefined, undefined,
    (from, to) => match.heroes.visible(from, to, true))[0];
  let alternate: readonly [number, number] | undefined;
  for (let attempt = 0; attempt < 32 && !alternate; attempt++) {
    match.smokes = [];
    place(match, 'smoke', rand);
    const clouds = match.smokes;
    match.smokes = [];
    const clearBeforeSmoke = visibility(target.x, target.z) === 1;
    match.smokes = clouds;
    if (!clearBeforeSmoke || visibility(target.x, target.z) !== 0) continue;
    for (let i = 0; i < 8; i++) {
      const x = target.x + .7 * Math.cos(i * Math.PI / 4), z = target.z + .7 * Math.sin(i * Math.PI / 4);
      if (canSlideTo(map, target, x, z) && visibility(x, z) === 0) { alternate = [x, z]; break; }
    }
  }
  if (!alternate) throw Error('Could not construct a fully occluded counterfactual on ' + map.data.mapId);
  const origin = [target.x, target.z] as const;
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

/**
 * Counterfactual camera replay: hide a previously visible player behind real smoke,
 * move them to another visible lane while hidden, then reveal them. The warm-up pose
 * is shared by both policies. On reveal, feed each controller its own camera turns.
 * Stationary feet deliberately isolate the acquisition response from navigation.
 */
export function contactTransition(map: ArenaMap, seed: number, controller: Controller) {
  const m = new Match(map, '1v1'), rand = random(seed);
  for (const team of TEAMS) m.addPlayer(team + '0', { name: team, team, char: 2, skins: [], bot: true });
  m.phase = 'live';
  const me = m.player('A0')!, target = m.player('B0')!;
  for (let attempt = 0; attempt < 48; attempt++) {
    m.smokes = [];
    place(m, 'smoke', rand);
    const clouds = m.smokes.slice(), origin = { x: target.x, z: target.z };
    const [dx, dz] = forward(me.yaw);
    const offset = (.85 + rand() * 1.25) * (rand() < .5 ? -1 : 1);
    const x = origin.x - dz * offset, z = origin.z + dx * offset;
    if (!canSlideTo(map, target, x, z)) continue;
    Object.assign(target, { x, z });
    if (cameraContact(m, 'A0')[0] !== 0) continue;
    m.smokes = [];
    const [clear, yaw, pitch] = cameraContact(m, 'A0');
    const initialError = Math.hypot(yaw, pitch);
    if (clear !== 1 || Math.abs(yaw) < .08) continue;
    Object.assign(target, origin);
    // Randomize both transition phases against the model's decision cadence.
    const warmTicks = 25 + Math.floor(rand() * 25);
    const hiddenTicks = 24 + Math.floor(rand() * 35);
    for (m.tick = 1; m.tick <= warmTicks; m.tick++) controller.think(m, 'A0');
    m.smokes = clouds;
    Object.assign(target, { x, z });
    let hiddenGunTicks = 0;
    for (let i = 0; i < hiddenTicks; i++, m.tick++) {
      const input = controller.think(m, 'A0');
      if ((input.buttons & BTN.FIRE) && WEAPONS[loadoutWeapon(me.loadout, input.weapon ?? me.weaponSlot)].kind === 'gun') hiddenGunTicks++;
    }
    m.smokes = [];
    const targetYaw = me.yaw + yaw, targetPitch = me.pitch + pitch;
    let firstError = initialError, bestError = initialError;
    for (let i = 0; i < TICK_HZ; i++, m.tick++) {
      const input = controller.think(m, 'A0');
      me.yaw = input.yaw;
      me.pitch = input.pitch;
      const error = Math.hypot(wrapAngle(targetYaw - me.yaw), targetPitch - me.pitch);
      if (!i) firstError = error;
      bestError = Math.min(bestError, error);
    }
    return { hiddenGunTicks, hiddenTicks, initialError, firstError, bestError };
  }
  throw Error('Could not construct a smoke reappearance trial on ' + map.data.mapId);
}

type ContactTransition = ReturnType<typeof contactTransition>;

function summarizeTransitions(trials: ContactTransition[]) {
  const count = trials.length;
  return {
    count,
    hiddenTriggerFraction: trials.reduce((n, t) => n + t.hiddenGunTicks, 0) / trials.reduce((n, t) => n + t.hiddenTicks, 0),
    instantLockFraction: trials.filter(t => t.firstError < .015 && t.firstError < t.initialError * .1).length / count,
    meanReacquisitionGain: trials.reduce((n, t) => n + 1 - t.bestError / t.initialError, 0) / count,
  };
}

export function compareTransitions(candidate: ContactTransition[], reference: ContactTransition[]) {
  const a = summarizeTransitions(candidate), b = summarizeTransitions(reference);
  return { candidate: a, reference: b, gates: {
    transitionCoverage: a.count >= 6 && a.count === b.count,
    reappearanceInstantLock: a.instantLockFraction <= Math.min(.25, b.instantLockFraction + .1),
    reappearanceTracking: a.meanReacquisitionGain >= Math.max(.2, b.meanReacquisitionGain - .35),
  } };
}

/** Paired legs share seat seeds, roster, positions and skills. Only the policy assignment swaps. */
export function play(map: ArenaMap, mode: Mode, scenario: Scenario, seed: number, side: Team, duration: number,
  candidate?: NeuralPolicyModel, opponent?: NeuralPolicyModel, publicFallback?: PublicFallback) {
  const m = new Match(map, mode), rand = random(seed);
  const counts = { A: counters(), B: counters() };
  const pilots = new Map<string, Controller>();
  for (const team of TEAMS) for (let i = 0; i < TEAM_CAPACITY[mode][team]; i++) {
    const id = team + i;
    const fallback = team === side ? undefined : publicFallback;
    // RoomCore's online scripted bot receives the deployed exploration policy and no tactical selector.
    const bot = new Bot(Math.floor(rand() * 2**31), BOT_SKILL.normal, fallback ? undefined : TACTICS,
      undefined, fallback?.exploration, team === side ? candidate : opponent);
    const char = randomBotHero([...m.slots.values()].map(s => s.info), team, rand);
    m.addPlayer(id, { name: id, team, bot: true, char, skins: [], loadout: randomBotLoadout(rand), utility: randomBotUtility(rand) });
    const learningPolicy = team === side ? candidate : opponent;
    const perceptionTrial = scenario === 'rear-search' || scenario === 'smoke';
    const pilot = perceptionTrial && !learningPolicy ? cameraLimitedScript(bot) : bot;
    pilots.set(id, scenario === 'round' ? bot : monitor(pilot, counts[team], duration, scenario === 'wall' && id === 'A0'));
  }
  // Enter the live round through Match so spawn selection, protection and ability cooldowns
  // are initialized exactly as they are when players start a real match.
  m.phase = 'countdown'; m.phaseT = 1;
  m.step();
  m.snapshot();
  const start = m.tick;
  m.phaseT = duration;
  place(m, scenario, rand);
  // Both policies first see the assigned starting state, including challenge-specific poses.
  for (const [id, pilot] of pilots) m.slots.get(id)!.controller = pilot;
  while (m.phaseT > 0) {
    m.step();
    if (m.tick % TICK_HZ === 0) m.snapshot(); // Drain transient simulation events during long rounds.
  }
  const other = side === 'A' ? 'B' : 'A';
  return { seed, side, map: map.data.mapId, mode, scenario, seconds: (m.tick - start) / TICK_HZ,
    margin: m.score[side] - m.score[other], candidate: counts[side], opponent: counts[other] };
}

type Leg = ReturnType<typeof play>;

function behavior(legs: Leg[], role: 'candidate' | 'opponent') {
  const total = counters();
  for (const leg of legs) for (const key of Object.keys(total) as (keyof Counters)[]) total[key] += leg[role][key];
  return { ...total, stallFraction: total.stuck / Math.max(1, total.moving),
    offscreenFireFraction: total.offscreenFire / Math.max(1, total.unseen),
    smokeHiddenFireFraction: total.smokeHiddenFire / Math.max(1, total.smokeHidden),
    meanContactSeconds: total.firstContact / Math.max(1, total.pilots) / TICK_HZ,
    acquisitionFraction: total.acquired / Math.max(1, total.pilots),
    wallClearFraction: total.wallCleared / Math.max(1, total.wallTrials),
    meanWallClearSeconds: total.wallClearTicks / Math.max(1, total.wallTrials) / TICK_HZ,
    unseenTurnDegreesPerSecond: total.searchRadians * (180 / Math.PI) * TICK_HZ / Math.max(1, total.unseen) };
}

function scenarioStats(legs: Leg[]) {
  // Only A0 starts against the obstruction. Each policy takes that seat in one leg of a pair.
  const relevant = (leg: Leg, side: Team) => leg.scenario !== 'wall' || leg.side === side;
  return { candidate: behavior(legs.filter(l => relevant(l, 'A')), 'candidate'),
    opponent: behavior(legs.filter(l => relevant(l, 'B')), 'opponent'), legs: legs.length };
}

type WallPerformance = Pick<ReturnType<typeof behavior>, 'wallTrials' | 'wallClearFraction' | 'meanWallClearSeconds' | 'stallFraction'>;
export function clearsWall(candidate: WallPerformance, opponent: WallPerformance) {
  return candidate.wallTrials >= 6 && candidate.wallClearFraction >= .5 &&
    candidate.meanWallClearSeconds <= opponent.meanWallClearSeconds + 2 &&
    candidate.stallFraction <= opponent.stallFraction + .04;
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
  const legWins = legs.filter(l => l.margin > 0).length, legLosses = legs.filter(l => l.margin < 0).length;
  return { blocks: blocks.size, wins, losses, tied: blocks.size - n, winFractionWithDraws: fraction, oneSidedP: Math.min(1, p),
    legs: legs.length, legWins, legLosses, legDraws: legs.length - legWins - legLosses,
    meanScoreMargin: legs.reduce((sum, l) => sum + l.margin, 0) / Math.max(1, legs.length) };
}

type ContactComparison = Pick<ReturnType<typeof closeContact>[number], 'map' | 'moving' | 'incumbentMargins' | 'directions'>;

export function passesCloseMovingDamage(rows: ContactComparison[]) {
  const moving = rows.filter(row => row.moving);
  const blocks = (map: string, margins: number[]) => margins.map((margin, seed) => ({ map, seed, margin }));
  // Keep both seats together per start. Also test each direction so opposite regressions
  // cannot cancel. Split the directional significance budget across those two comparisons.
  const aggregate = moving.flatMap(row => blocks(row.map, row.incumbentMargins));
  return score(aggregate).oneSidedP > .05 && [-1, 1].every(mx => {
    const paired = moving.flatMap(row => row.directions.filter(d => d.mx === mx)
      .flatMap(d => blocks(row.map, d.incumbentMargins)));
    return paired.length === aggregate.length && score(paired).oneSidedP > .025;
  });
}

function numberArg(v: string, min: number, max: number) {
  const n = Number(v);
  if (!v.trim() || !Number.isInteger(n) || n < min || n > max) throw Error('Invalid numeric evaluation argument: ' + v);
  return n;
}

function main() {
  const { positionals, values } = parseArgs({ allowPositionals: true, options: {
    incumbent: { type: 'string' }, seeds: { type: 'string', default: '3' }, seed: { type: 'string', default: '13093847' },
    'deployed-fallback': { type: 'string' }, 'incumbent-seeds': { type: 'string' },
    'seed-version': { type: 'string' },
    maps: { type: 'string' }, seconds: { type: 'string', default: '12' },
    'screen-only': { type: 'boolean', default: false },
  } });
  if (positionals.length !== 1) throw Error('Usage: evaluate-self-play.ts <candidate.json> [--incumbent file] [--screen-only]');
  const candidate = load(positionals[0]), incumbent = values.incumbent ? load(values.incumbent) : undefined;
  const publicFallback = values['deployed-fallback'] ? loadFallback(values['deployed-fallback']) : undefined;
  if (incumbent && publicFallback) throw Error('Specify one deployed opponent');
  const comparedOpponent = incumbent ? 'incumbent' : publicFallback?.exploration ? 'public-exploration' : publicFallback ? 'public-scripted' : 'baseline';
  const seeds = numberArg(values.seeds, 1, 100), firstSeed = numberArg(values.seed, 0, 2**31 - seeds - 1);
  const incumbentSeeds = values['incumbent-seeds'] === undefined ? seeds : numberArg(values['incumbent-seeds'], seeds, 100);
  const version = seedVersion(values['seed-version']);
  const seconds = numberArg(values.seconds, 1, 60);
  const { screen: maps, tournament: tournamentMaps } = evaluationMaps(firstSeed, values.maps);
  const challenges: Leg[] = [];
  const rounds = new Map<string, Leg[]>();
  for (const id of maps) for (let i = 0; i < seeds; i++) {
    for (const side of TEAMS) for (const scenario of CHALLENGES) {
      const mixedSeed = trialSeed(firstSeed, scenario, id, i, version);
      challenges.push(play(getMap(id), '1v1', scenario, mixedSeed, side, seconds * TICK_HZ, candidate.model, incumbent?.model, publicFallback));
    }
  }
  const byScenario = Object.fromEntries(CHALLENGES.map(s => [s, scenarioStats(challenges.filter(l => l.scenario === s))]));
  const smoke = byScenario.smoke, wall = byScenario.wall, search = byScenario['rear-search'];
  const hiddenTargetChecks = maps.map(map => hiddenTargetInvariant(getMap(map), trialSeed(firstSeed, 'occlusion', map, 0, version), candidate.model));
  const gates: Record<string, boolean> = {
    hiddenTargetInvariant: hiddenTargetChecks.every(Boolean),
    sufficientCoverage: maps.length >= 3 && seeds >= 2 && seconds >= 8,
    candidateHasSearch: search.candidate.unseenTurnDegreesPerSecond > .3 && search.candidate.acquisitionFraction >= .5,
    // Leave at least half of the trial (after the scheduled smoke clear for smoke trials) for combat.
    rearSearch: search.candidate.meanContactSeconds <= Math.min(seconds / 2, search.opponent.meanContactSeconds + 2),
    smokeContact: smoke.candidate.acquisitionFraction >= .5 && smoke.candidate.meanContactSeconds <=
      Math.min(3 + (seconds - 3) / 2, smoke.opponent.meanContactSeconds + 2),
    wallStalls: clearsWall(wall.candidate, wall.opponent),
  };
  // V4 trigger behavior is graded against held-out human decisions. The simulator
  // measures smoke exposure and tests that hidden coordinates cannot affect inputs.
  const smokeCoverage = smoke.candidate.smokeHidden >= smoke.candidate.pilots;
  if (candidate.model.version < 4) {
    gates.smokeOffscreenTrigger = smokeCoverage &&
      smoke.candidate.offscreenFireFraction <= Math.max(.04, smoke.opponent.offscreenFireFraction + .02) &&
      smoke.candidate.smokeHiddenFireFraction <= Math.max(.04, smoke.opponent.smokeHiddenFireFraction + .02);
  } else {
    gates.smokeCoverage = smokeCoverage;
  }
  let contactTransitions;
  if (candidate.model.version >= 4) {
    const trial = (isCandidate: boolean) => maps.flatMap(id => Array.from({ length: seeds }, (_, i) => {
      const seed = trialSeed(firstSeed, 'reappearance', id, i, version);
      const model = isCandidate ? candidate.model : incumbent?.model;
      const fallback = !isCandidate && publicFallback;
      const controller = new Bot(seed, BOT_SKILL.normal, fallback ? undefined : TACTICS,
        undefined, fallback ? fallback.exploration : undefined, model);
      return contactTransition(getMap(id), seed, model ? controller : cameraLimitedScript(controller));
    }));
    contactTransitions = compareTransitions(trial(true), trial(false));
    Object.assign(gates, contactTransitions.gates);
  }
  const searchTrials = incumbent && candidate.model.version === 4 && incumbent.model.version === 4
    ? searchFixtures(maps, trialSeed(firstSeed, 'spawn-search', '', 0, version), 4) : [];
  const spawnSearch = incumbent && searchTrials.length ? {
    trials: searchTrials.length,
    candidate: assessSearch(candidate.model, incumbent.model, searchTrials, 30),
    opponent: assessSearch(incumbent.model, incumbent.model, searchTrials, 30),
  } : undefined;
  const near = spawnSearch && incumbent ? closeContact(candidate.model, incumbent.model, firstSeed) : undefined;
  if (near) gates.closeMovingDamage = passesCloseMovingDamage(near);
  if (spawnSearch) {
    const { candidate: pilot, opponent: rival } = spawnSearch;
    gates.spawnSearchProgress = passesSpawnSearch(pilot, rival);
  }
  // Failed screens can produce a small diagnostic result; only the held-out tournament can approve release.
  const tournament = !values['screen-only'] && Object.values(gates).every(Boolean);
  let diagnostic = null;
  if (!tournament && !values['screen-only']) {
    // One paired map/seed per mode gives a real match score when the screen fails.
    // Keep these four probes out of the promotion dataset and off tournament maps when possible.
    const reserved = MAPS.filter(m => !maps.includes(m.id) && !tournamentMaps.includes(m.id));
    const id = reserved.length ? reserved[trialSeed(firstSeed, 'diagnostic-map', '') % reserved.length].id : maps[0];
    const seed = trialSeed(firstSeed, 'diagnostic', id, 0, version);
    const modes = Object.fromEntries(MODES.map(mode => [mode, score(TEAMS.map(side =>
      play(getMap(id), mode, 'round', seed, side, MATCH_TICKS, candidate.model, incumbent?.model, publicFallback)))]));
    diagnostic = { map: id, seed, opponent: comparedOpponent, modes };
  }
  if (tournament) {
    const opponents: { name: string; model?: NeuralPolicyModel; fallback?: PublicFallback }[] = [{ name: 'baseline' }];
    if (incumbent || publicFallback) opponents.push({ name: comparedOpponent, model: incumbent?.model, fallback: publicFallback });
    for (const opponent of opponents) {
      const roundSeeds = opponent.name === 'incumbent' ? incumbentSeeds : seeds;
      const legs = tournamentLegs(firstSeed, tournamentMaps, roundSeeds, version).map(({ map, seed, mode, side }) =>
        play(getMap(map), mode, 'round', seed, side, MATCH_TICKS, candidate.model, opponent.model, opponent.fallback));
      rounds.set(opponent.name, legs);
    }
  }
  const comparisons = Object.fromEntries([...rounds].map(([name, legs]) => [name, score(legs)]));
  const byMap = Object.fromEntries([...rounds].map(([name, legs]) => [name, Object.fromEntries(tournamentMaps.map(id =>
    [id, score(legs.filter(leg => leg.map === getMap(id).data.mapId))]))]));
  const byMode = Object.fromEntries([...rounds].map(([name, legs]) => [name, Object.fromEntries(MODES.map(mode =>
    [mode, score(legs.filter(leg => leg.mode === mode))]))]));
  if (tournament) {
    gates.fullRounds = true;
    gates.heldoutMaps = tournamentMaps.every(id => !maps.includes(id));
    gates.improved = Object.values(comparisons).every(s => s.blocks >= 6 && s.oneSidedP <= .05 && s.winFractionWithDraws > .5);
    gates.bothModes = Object.values(byMode).every(modes => MODES.every(mode => modes[mode].winFractionWithDraws >= .5));
  }
  console.log(JSON.stringify({ passed: tournament && Object.values(gates).every(Boolean), gates, byMode, byMap, byScenario: { ...byScenario, ...(spawnSearch ? { spawnSearch, closeContact: near } : {}) }, comparisons, contactTransitions,
    perceptionMatchedReference: !incumbent,
    candidate: candidate.sha256, incumbent: incumbent?.sha256 ?? 'baseline', comparedOpponent,
    config: { maps, tournamentMaps, seeds, incumbentSeeds, firstSeed, seedVersion: version, seconds, explorationDigest: publicFallback?.digest },
    fullRounds: [...rounds.values()].reduce((sum, legs) => sum + legs.length, 0), diagnostic }));
}

export function runSelfPlayEvaluation() {
  try { main(); } catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runSelfPlayEvaluation();
}

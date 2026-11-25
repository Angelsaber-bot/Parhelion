// Paired sightlines in the actual match simulation. A shot only counts when its target is still visible and in band.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { getMap } from '../../shared/arenaMap.ts';
import { navFor } from '../../shared/botLocomotion.ts';
import { TICK_HZ } from '../../shared/content.ts';
import { humanObservation } from '../../shared/humanCombat.ts';
import { directPolicy, learnedOpponent } from '../../shared/learnedOpponent.ts';
import { Match } from '../../shared/match.ts';
import { parseNeuralPolicy, type NeuralPolicyModel } from '../../shared/neuralPolicy.ts';
import { trialSeed } from '../self-play-seeds.ts';

type SightlineRow = { low: number; high: number; trials: number; fired: number; hit: number; blindShots: number; missedShots: number };

export function sightlines(model: NeuralPolicyModel, seed: number, maps: string[], repeats: number) {
  const rows: SightlineRow[] = [];
  let state = Number(seed);
  const draw = () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) + .5) / 2 ** 32;
  for (const [low, high] of [[8, 15], [30, 45], [45, 85]]) {
    let trials = 0, fired = 0, hit = 0, blindShots = 0, missedShots = 0;
    for (const id of maps) {
      const map = getMap(id), mesh = navFor({ map });
      for (let repeat = 0; repeat < repeats; repeat++) {
        const game = new Match(map, '1v1');
        game.addPlayer('pilot', { name: 'Pilot', team: 'A', char: 2, bot: true, skins: [] }, learnedOpponent(model));
        game.addPlayer('target', { name: 'Target', team: 'B', char: 2, bot: false, skins: [] });
        const pilot = game.player('pilot')!, target = game.player('target')!;
        const seen = () => humanObservation(map, pilot, [{ team: 'B', crouched: target.crouched, feet: [target.x, target.y, target.z] }],
          (a, b) => game.heroes.visible(a, b), [0, 0])[0] === 1;
        const distance = () => Math.hypot(pilot.x - target.x, pilot.z - target.z);
        let placed = false;
        for (let attempt = 0; attempt < 1200 && !placed; attempt++) {
          const a = mesh.nodes[Math.floor(draw() * mesh.nodes.length)], b = mesh.nodes[Math.floor(draw() * mesh.nodes.length)];
          const d = Math.hypot(a.x - b.x, a.z - b.z);
          if (d < low || d >= high) continue;
          Object.assign(pilot, { x: a.x, y: a.y, z: a.z, yaw: Math.atan2(a.x - b.x, a.z - b.z) + (draw() - .5) * .16, pitch: Math.atan2(b.y - a.y, d), grounded: true });
          Object.assign(target, { x: b.x, y: b.y, z: b.z, grounded: true });
          placed = seen();
        }
        if (!placed) continue;
        trials++;
        game.phase = 'live'; game.phaseT = 5 * TICK_HZ;
        for (const s of game.slots.values()) s.spawnProtectedUntilTick = 0;
        let shot = false, landed = false;
        for (let t = 0; t < 3 * TICK_HZ && target.alive; t++) {
          const visible = seen();
          const valid = visible && distance() >= low && distance() < high;
          game.step();
          const events = game.snapshot().events;
          if (events.some(e => e.t === 'shot' && e.id === 'pilot')) {
            const damage = events.some(e => e.t === 'hit' && e.shooter === 'pilot' && e.victim === 'target');
            if (!visible) blindShots++;
            if (!damage) missedShots++;
            if (!valid) continue;
            shot = true;
            landed ||= damage;
          }
        }
        fired += Number(shot); hit += Number(landed);
      }
    }
    rows.push({ low, high, trials, fired, hit, blindShots, missedShots });
  }
  return rows;
}

export function sightlineGates(current: readonly SightlineRow[], candidate: readonly SightlineRow[]) {
  const paired = candidate.length === current.length && current.length === 3 && candidate.every((row, i) =>
    row.low === current[i].low && row.high === current[i].high &&
    row.trials >= 30 && row.trials === current[i].trials);
  const hits = paired && candidate.every((row, i) => {
    const baseline = current[i].hit;
    // A low baseline is exactly where a trial-count tolerance could allow
    // the candidate to lose all hits. Allow variance relative to actual hits.
    return row.hit >= Math.max(Number(baseline > 0), baseline - Math.max(1, Math.floor(baseline * .12)));
  });
  const farHit = paired && candidate[2].hit >= current[2].hit;
  const distantTrigger = paired && candidate.slice(1).every((row, i) =>
    row.fired >= current[i + 1].fired - Math.max(2, Math.floor(current[i + 1].fired * .12)));
  const blindFire = paired && candidate.every((row, i) =>
    row.blindShots <= current[i].blindShots + Math.max(2, Math.floor(row.trials * .05)));
  return { paired, hits, farHit, distantTrigger, blindFire };
}

function pairedSightlines(model: NeuralPolicyModel, seeds: readonly number[], maps: string[]) {
  const [first, ...rest] = seeds.map(seed => sightlines(model, seed, maps, 12));
  return first.map((row, i) => rest.reduce((total, cohort) => {
    const additional = cohort[i];
    return { low: total.low, high: total.high, trials: total.trials + additional.trials,
      fired: total.fired + additional.fired, hit: total.hit + additional.hit,
      blindShots: total.blindShots + additional.blindShots, missedShots: total.missedShots + additional.missedShots };
  }, row));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [path, seed = '859243', opponent] = process.argv.slice(2);
  const load = (file: string) => {
    const policy = parseNeuralPolicy(JSON.parse(readFileSync(file, 'utf8')));
    if (!directPolicy(policy)) throw Error('Expected direct Arena controls');
    return policy;
  };
  const maps = ['frostcourt','camlann','orleans','suntemple','lishan'];
  if (!opponent) {
    for (const row of sightlines(load(path), Number(seed), [...maps, 'aster'], 5)) console.log(JSON.stringify(row));
  } else {
    const seeds = [0, 1].map(i => trialSeed(Number(seed), 'range-release', 'arena', i));
    const current = pairedSightlines(load(opponent), seeds, maps);
    const candidate = pairedSightlines(load(path), seeds, maps);
    const gates = sightlineGates(current, candidate);
    console.log(JSON.stringify({ passed: Object.values(gates).every(Boolean), gates, current, candidate, seeds }));
  }
}

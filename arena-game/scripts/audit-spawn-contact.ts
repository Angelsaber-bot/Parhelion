// Run with node --import tsx scripts/audit-spawn-contact.ts candidate.json incumbent.json seed [seed...]
// Both models may also be gzip-compressed checkpoints. Each campaign reuses identical fixtures for both actors.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { MAPS } from '../shared/arenaMap.ts';
import { parseNeuralPolicy } from '../shared/neuralPolicy.ts';
import { closeContact } from './evaluation/evaluate-close-contact.ts';
import { assess, fixtures } from './evaluation/evaluate-spawn-search.ts';

function loadActor(path: string) {
  const raw = readFileSync(path);
  const bytes = raw[0] === 0x1f && raw[1] === 0x8b ? gunzipSync(raw) : raw;
  const model = parseNeuralPolicy(JSON.parse(bytes.toString('utf8')));
  if (!model || model.synthetic || model.version !== 4) throw new Error(`Expected a compatible direct-input policy in ${path}`);
  return { model, sha256: createHash('sha256').update(bytes).digest('hex') };
}

function summarizeSpawn(result: ReturnType<typeof assess>, trials: number) {
  // assess reports mean window counts per trial. Recover counts so campaigns can be pooled.
  const windows = Math.round(result.windows * trials);
  const lowDisplacementWindows = Math.round(result.stalled * trials);
  const stationaryTrials = result.waitingTrials;
  const stationaryFound = Math.round(result.waitingAcquired * stationaryTrials);
  return {
    netForwardMetersPerSecond: result.forwardMetersPerSecond,
    lowDisplacementWindows, windows, lowDisplacementFraction: windows ? lowDisplacementWindows / windows : null,
    stationaryFound, stationaryTrials, stationaryDiscoveryFraction: stationaryTrials ? stationaryFound / stationaryTrials : null,
  };
}

function summarizeContact(hits: { byHalfSecond: number; byTwoSeconds: number }, trials: number) {
  return { ...hits, fractionByHalfSecond: hits.byHalfSecond / trials, fractionByTwoSeconds: hits.byTwoSeconds / trials };
}

function summarizeMatch(reference: ReturnType<typeof closeContact>[number]['reference']) {
  return {
    map: reference.map, at: reference.at, humanScore: reference.humanScore, botScore: reference.botScore,
    pilotLoadout: reference.kit, targetLoadout: reference.targetKit, targetUtility: reference.targetUtility,
  };
}

const [candidatePath, incumbentPath, ...seedArgs] = process.argv.slice(2);
if (!seedArgs.length) throw new Error('Usage: audit-spawn-contact.ts candidate.json incumbent.json seed [seed...]');
const seeds = seedArgs.map(arg => {
  const seed = Number(arg);
  if (!/^\d+$/.test(arg) || !Number.isSafeInteger(seed) || seed >= 2 ** 31) throw new Error(`Invalid campaign seed: ${arg}`);
  return seed;
});
if (new Set(seeds).size !== seeds.length) throw new Error('Campaign seeds must be distinct');

const candidate = loadActor(candidatePath), incumbent = loadActor(incumbentPath);
const seconds = 30, repeats = 10;
const matchReferences = new Map<string, ReturnType<typeof summarizeMatch>>();
const campaigns = seeds.map(seed => {
  const spawn = MAPS.flatMap(({ id: map }) => {
    const paired = fixtures([map], seed, repeats);
    return (['A', 'B'] as const).map(side => {
      const trials = paired.filter(t => t.side === side);
      return { map, side, trials: trials.length,
        candidate: summarizeSpawn(assess(candidate.model, incumbent.model, trials, seconds), trials.length),
        incumbent: summarizeSpawn(assess(incumbent.model, incumbent.model, trials, seconds), trials.length) };
    });
  });
  const close = closeContact(candidate.model, incumbent.model, seed).map(row => {
    const reference = summarizeMatch(row.reference);
    matchReferences.set(reference.map, reference);
    return {
      map: row.map, moving: row.moving, trials: row.trials,
      candidate: summarizeContact(row.candidate, row.trials), incumbent: summarizeContact(row.incumbent, row.trials),
      directions: row.directions.map(direction => ({
        mx: direction.mx, trials: direction.trials,
        candidate: summarizeContact(direction.candidate, direction.trials),
        incumbent: summarizeContact(direction.incumbent, direction.trials),
      })),
    };
  });
  return { seed, spawn, close };
});
console.log(JSON.stringify({ candidate: candidate.sha256, incumbent: incumbent.sha256, seconds, repeats, campaigns, matchReferences: [...matchReferences.values()] }));

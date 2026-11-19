import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { parseArgs, promisify } from 'node:util';
import { parseNeuralPolicy } from '../shared/neuralPolicy.ts';
import { PUBLIC_SERVER, RULES_VERSION } from '../shared/protocol.ts';
import { parseTrainingBatch } from '../shared/trainingData.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const { values } = parseArgs({ options: {
  watch: { type: 'boolean' }, corpus: { type: 'string' }, public: { type: 'boolean' },
  interval: { type: 'string', default: '30' }, epochs: { type: 'string', default: '20' }, device: { type: 'string', default: 'auto' },
} });
const number = (value: string, min: number, max: number) => /^\d+$/.test(value) && +value >= min && +value <= max;
if (!number(values.epochs, 1, 1000) || !number(values.interval, 5, 7200) || !['auto', 'cpu', 'mps', 'cuda'].includes(values.device)) {
  throw new Error('Use --epochs 1..1000, --interval 5..7200 seconds, and --device auto|cpu|mps|cuda.');
}
const output = path.join(root, '.scratch/neural');
const corpus = values.corpus ? path.resolve(values.corpus) : path.join(root, '.scratch/training/corpus');
const venv = path.join(output, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
const python = process.env.ARENA_NEURAL_PYTHON ?? (existsSync(venv) ? venv : 'python3');
const runner = promisify(execFile);
const stop = new AbortController();
process.once('SIGINT', () => stop.abort());
process.once('SIGTERM', () => stop.abort());

const execute = (binary: string, args: string[]) => runner(binary, args, { cwd: root, signal: stop.signal, maxBuffer: 8 * 1024 ** 2 });
const publicUrl = PUBLIC_SERVER.replace(/^wss:/, 'https:').replace(/\/arena$/, '/training');
const token = values.public ? (await readFile(path.join(output, 'public.token'), 'utf8')).trim() : '';
const remote = (route: string, options: RequestInit = {}) => fetch(publicUrl + route, {
  ...options, redirect: 'error', headers: { ...options.headers, authorization: `Bearer ${token}` },
  signal: AbortSignal.any([stop.signal, AbortSignal.timeout(12000)]),
});

async function pullPublicCorpus() {
  await mkdir(corpus, { recursive: true, mode: 0o700 });
  for (let page = 0; page < 16; page++) {
    const response = await remote('/corpus');
    if (!response.ok) throw new Error(`Public corpus returned HTTP ${response.status}`);
    const { records } = await response.json();
    if (!Array.isArray(records) || records.length > 8) throw new Error('Invalid public corpus response');
    if (!records.length) return;
    let through = 0;
    for (const { id, batch: raw } of records) {
      const batch = parseTrainingBatch(raw);
      if (!Number.isSafeInteger(id) || id <= through || !batch?.exploration?.length) throw new Error('Invalid public training batch');
      const file = path.join(corpus, `${batch.rulesVersion}-${batch.capture}-${batch.sequence}.json`);
      if (!existsSync(file)) {
        const staged = `${file}.${process.pid}.tmp`;
        await writeFile(staged, JSON.stringify(batch), { mode: 0o600 });
        await rename(staged, file);
      }
      through = id;
    }
    const ack = await remote(`/corpus?through=${through}`, { method: 'DELETE' });
    if (!ack.ok) throw new Error(`Public corpus acknowledgement returned HTTP ${ack.status}`);
  }
}

async function corpusInfo() {
  let files: string[];
  try { files = await readdir(corpus); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') files = []; else throw error; }
  const captures = new Set<string>();
  const hash = createHash('sha256');
  let batches = 0;
  for (const name of files.sort()) {
    const parts = /^(\d+)-([0-9a-f]{32})-([0-9]+)\.json$/.exec(name);
    if (!parts || Number(parts[1]) !== RULES_VERSION) continue;
    const info = await stat(path.join(corpus, name)).catch(error => {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    });
    if (!info?.isFile()) continue;
    captures.add(parts[2]);
    hash.update(`${name}:${info.size}:${info.mtimeMs}\n`);
    batches++;
  }
  return { signature: hash.digest('hex'), captures: captures.size, batches };
}

const json = async (file: string) => JSON.parse(await readFile(file, 'utf8'));
let lastGood: { metrics: unknown; simulation: unknown; published?: unknown } | null = null;
async function status(state: 'waiting' | 'training' | 'evaluating' | 'ready' | 'error', data: Awaited<ReturnType<typeof corpusInfo>>, detail?: string) {
  const tmp = path.join(output, `.status-${process.pid}.tmp`);
  const payload = { state, rulesVersion: RULES_VERSION, ...data, updatedAt: new Date().toISOString(), candidate: lastGood, detail };
  await writeFile(tmp, JSON.stringify(payload, null, 2) + '\n', { mode: 0o600 });
  await rename(tmp, path.join(output, 'status.json'));
  console.log(`[Arena neural] ${state} ${data.captures} captures / ${data.batches} batches${detail ? ` — ${detail}` : ''}`);
}

async function train(data: Awaited<ReturnType<typeof corpusInfo>>) {
  const stage = await mkdtemp(path.join(output, 'run-'));
  const candidate = path.join(stage, 'candidate.json');
  const metricsFile = path.join(stage, 'metrics.json');
  const checkpoint = path.join(stage, 'checkpoint.pt');
  try {
    await status('training', data);
    const fit = await execute(python, ['tools/train-arena-policy.py', corpus, '--rules-version', String(RULES_VERSION),
      '--output', candidate, '--metrics', metricsFile, '--checkpoint', checkpoint, '--epochs', values.epochs, '--device', values.device]);
    process.stdout.write(fit.stdout);
    const model = parseNeuralPolicy(await json(candidate));
    const metrics = await json(metricsFile);
    if (!model || model.synthetic || metrics.data !== 'human-demonstrations' || !(metrics.trainWindows > 0 && metrics.holdoutWindows > 0)) {
      throw new Error('Candidate needs compatible weights and a held-out set of human demonstrations.');
    }
    await status('evaluating', data);
    const run = await execute(process.execPath, ['--import', 'tsx', 'test/bench/evaluate-neural.ts', candidate, '--seeds', '1']);
    const simulation = JSON.parse(run.stdout);
    await writeFile(path.join(stage, 'simulation.json'), run.stdout, { mode: 0o600 });
    for (const file of ['metrics.json', 'simulation.json', 'checkpoint.pt', 'candidate.json']) {
      await rename(path.join(stage, file), path.join(output, file));
    }
    lastGood = { metrics, simulation: simulation.results };
    const search = metrics.holdout.cameraAndMovement.noContact;
    const { baseline, candidate: evaluated } = simulation.results;
    const passed = metrics.trainWindows >= 120 && metrics.holdoutWindows >= 60 && search.windows >= 30 &&
      search.yawMaeRad < search.stillYawMaeRad && evaluated.firstContactRate >= baseline.firstContactRate - .17 &&
      evaluated.meanTimeToContactOrEndSeconds <= baseline.meanTimeToContactOrEndSeconds + 2 &&
      evaluated.stalls <= baseline.stalls + evaluated.rollouts && evaluated.offscreenFireFraction <= .04 &&
      evaluated.damageDealt >= baseline.damageDealt * .5;
    if (values.public && passed) {
      const publication = await remote('/neural', { method: 'PUT', body: await readFile(path.join(output, 'candidate.json'), 'utf8') });
      if (!publication.ok) throw new Error(`Model publication returned HTTP ${publication.status}`);
      lastGood.published = await publication.json();
    }
    await status('ready', data, values.public && passed ? 'Passed validation and published to Arena.' :
      values.public ? 'Candidate evaluated. Public Arena loads models that pass the quality checks.' : 'Held-out replay and closed-loop comparison completed.');
  } finally { await rm(stage, { recursive: true, force: true }); }
}

await mkdir(output, { recursive: true, mode: 0o700 });
const previous = await json(path.join(output, 'status.json')).catch(() => null);
if (previous?.rulesVersion === RULES_VERSION && previous.candidate && existsSync(path.join(output, 'candidate.json'))) lastGood = previous.candidate;
let seen: string | undefined;
do {
  if (values.public) {
    try { await pullPublicCorpus(); }
    catch (error) {
      if (stop.signal.aborted) break;
      await status('error', await corpusInfo(), (error as Error).message);
      if (!values.watch) { process.exitCode = 1; break; }
      await setTimeout(Number(values.interval) * 1000, undefined, { signal: stop.signal }).catch(() => {});
      continue;
    }
  }
  const data = await corpusInfo();
  if (seen !== data.signature) {
    seen = data.signature;
    if (data.captures < 2) await status('waiting', data, 'Record at least two separate opted-in match sessions.');
    else {
      try { await train(data); }
      catch (error) {
        if (stop.signal.aborted) break;
        const failure = error as Error & { stderr?: string };
        await status('error', data, (failure.stderr?.trim().split('\n').at(-1) || failure.message).slice(0, 600));
        if (!values.watch) process.exitCode = 1;
      }
    }
  }
  if (values.watch && !stop.signal.aborted) await setTimeout(Number(values.interval) * 1000, undefined, { signal: stop.signal }).catch(() => {});
} while (values.watch && !stop.signal.aborted);

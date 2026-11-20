import { execFile, spawn } from 'node:child_process';
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
  watch: { type: 'boolean' }, corpus: { type: 'string' }, public: { type: 'boolean' }, cloud: { type: 'boolean' },
  'reference-only': { type: 'boolean' }, 'refresh-reference': { type: 'boolean' },
  interval: { type: 'string', default: '30' }, epochs: { type: 'string', default: '20' }, device: { type: 'string', default: 'auto' },
} });
const number = (value: string, min: number, max: number) => /^\d+$/.test(value) && +value >= min && +value <= max;
if (!number(values.epochs, 1, 1000) || !number(values.interval, 5, 7200) || !['auto', 'cpu', 'mps', 'cuda'].includes(values.device)) {
  throw new Error('Use --epochs 1..1000, --interval 5..7200 seconds, and --device auto|cpu|mps|cuda.');
}
if (values.cloud && (!values.public || values.watch || !process.env.ARENA_NEURAL_RUN_DIR)) throw new Error('--cloud requires --public and ARENA_NEURAL_RUN_DIR, and runs one snapshot.');
const output = process.env.ARENA_NEURAL_RUN_DIR ? path.resolve(process.env.ARENA_NEURAL_RUN_DIR) : path.join(root, '.scratch/neural');
const corpus = values.corpus ? path.resolve(values.corpus) : values.cloud ? path.join(output, 'corpus') : path.join(root, '.scratch/training/corpus');
const venv = path.join(output, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
const python = process.env.ARENA_NEURAL_PYTHON ?? (existsSync(venv) ? venv : 'python3');
const runner = promisify(execFile);
const stop = new AbortController();
process.once('SIGINT', () => stop.abort());
process.once('SIGTERM', () => stop.abort());

const execute = (binary: string, args: string[]) => runner(binary, args, { cwd: root, signal: stop.signal, maxBuffer: 8 * 1024 ** 2 });
const publicUrl = PUBLIC_SERVER.replace(/^wss:/, 'https:').replace(/\/arena$/, '/training');
const token = values.public ? (process.env.ARENA_NEURAL_CORPUS_TOKEN ?? await readFile(path.join(output, 'public.token'), 'utf8')).trim() : '';
if (values.public && !/^[a-f0-9]{64}$/.test(token)) throw new Error('Invalid Arena training credential configuration');
const publicHeaders = {
  authorization: `Bearer ${token}`,
  'user-agent': 'Parhelion-Arena-Training/1.0',
  accept: 'application/json',
};
type RemoteOptions = { method?: 'PUT'; body?: string; file?: string };
const responseLimit = 16 * 1024 ** 2;

function curlRequest(url: string, options: RemoteOptions): Promise<Response> {
  return new Promise((resolve, reject) => {
    const child = spawn('curl', ['--disable', '--config', '-', '--silent', '--show-error', '--proto', '=https',
      '--max-time', '24', '--write-out', '\n%{http_code}', url], { signal: stop.signal });
    let body = '', size = 0;
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      size += chunk.length;
      if (size > responseLimit) { child.kill(); reject(new Error('Arena response too large')); return; }
      body += chunk;
    });
    child.stderr.resume();
    child.once('error', reject);
    child.stdin.on('error', reject);
    child.once('close', code => {
      const split = body.lastIndexOf('\n'), status = Number(body.slice(split + 1));
      if (code !== 0 || !Number.isInteger(status) || status < 200 || status > 599) { reject(new Error(`Arena HTTPS request failed (curl ${code})`)); return; }
      resolve(new Response(status === 204 || status === 304 ? null : body.slice(0, split), { status }));
    });
    const config = Object.entries(publicHeaders).map(([name, value]) => `header = ${JSON.stringify(`${name}: ${value}`)}`);
    if (options.method) config.push(`request = ${options.method}`);
    if (options.file || options.body) config.push(`data-binary = ${JSON.stringify(options.file ? '@' + options.file : options.body)}`);
    child.stdin.end(config.join('\n') + '\n');
  });
}

async function remote(route: string, options: RemoteOptions = {}) {
  const url = publicUrl + route;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { method: options.method, body: options.file ? await readFile(options.file, 'utf8') : options.body,
        redirect: 'error', headers: publicHeaders,
        signal: AbortSignal.any([stop.signal, AbortSignal.timeout(14000)]) });
      if ((response.status < 500 && response.status !== 429) || attempt === 2) return response;
      await response.body?.cancel();
    } catch (error) {
      if (stop.signal.aborted) throw error;
      if (attempt >= 1) return curlRequest(url, options);
    }
    await setTimeout(750 * (attempt + 1), undefined, { signal: stop.signal });
  }
  throw new Error('Arena HTTPS request failed');
}

let revision = 0;
let downloadedRevision = 0;

async function pullPublicCorpus() {
  const response = await remote('/status');
  if (!response.ok) throw new Error(`Public training status returned HTTP ${response.status}`);
  const { rulesVersion, dataset, transformer } = await response.json();
  if (rulesVersion !== RULES_VERSION || !dataset || !Number.isSafeInteger(dataset.revision) || !Number.isSafeInteger(dataset.matches)) {
    throw new Error('Public training corpus API is not ready for this rules version.');
  }
  revision = dataset.revision;
  if (!revision || (values.cloud && (dataset.matches < 2 || (!values['refresh-reference'] && (transformer?.completedRevision ?? 0) >= revision)))) {
    return false;
  }
  await mkdir(corpus, { recursive: true, mode: 0o700 });
  let after = downloadedRevision;
  for (let page = 0; page <= 512 && after < revision; page++) {
    const response = await remote(`/corpus?after=${after}&through=${revision}`);
    if (!response.ok) throw new Error(`Public corpus returned HTTP ${response.status}`);
    const { records } = await response.json();
    if (!Array.isArray(records) || records.length > 8) throw new Error('Invalid public corpus response');
    if (!records.length) break;
    for (const { id, batch: raw } of records) {
      const batch = parseTrainingBatch(raw);
      if (!Number.isSafeInteger(id) || id <= after || id > revision || !batch?.exploration?.length) throw new Error('Invalid public training batch');
      const file = path.join(corpus, `${batch.rulesVersion}-${batch.capture}-${batch.sequence}.json`);
      if (!existsSync(file)) {
        const staged = `${file}.${process.pid}.tmp`;
        await writeFile(staged, JSON.stringify(batch), { mode: 0o600 });
        await rename(staged, file);
      }
      after = id;
    }
  }
  if (after < revision) throw new Error('The public dataset snapshot changed during download.');
  downloadedRevision = after;
  return true;
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

async function reportCloud(state: 'training' | 'evaluating' | 'ready' | 'error', metrics?: { trainWindows: number; holdoutWindows: number }, published?: boolean) {
  if (!values.cloud || revision < 1) return;
  const body = JSON.stringify({ revision, state, trainWindows: metrics?.trainWindows, holdoutWindows: metrics?.holdoutWindows, published });
  const result = await remote('/job', { method: 'PUT', body });
  if (!result.ok) throw new Error(`Training progress returned HTTP ${result.status}`);
}

async function train(data: Awaited<ReturnType<typeof corpusInfo>>) {
  const stage = await mkdtemp(path.join(output, 'run-'));
  const candidate = path.join(stage, 'candidate.json');
  const metricsFile = path.join(stage, 'metrics.json');
  const checkpoint = path.join(stage, 'checkpoint.pt');
  try {
    await status('training', data);
    await reportCloud('training');
    const trainArgs = ['tools/train-arena-policy.py', corpus, '--rules-version', String(RULES_VERSION),
      '--output', candidate, '--metrics', metricsFile, '--checkpoint', checkpoint, '--epochs', values.epochs, '--device', values.device];
    const resume = path.join(stage, 'resume.pt');
    if (values.cloud) {
      const saved = await remote('/checkpoint');
      if (saved.ok) {
        const result = await saved.json();
        if (!Number.isSafeInteger(result.revision) || result.revision > revision || typeof result.data !== 'string' || result.data.length > 8 * 1024 ** 2) {
          throw new Error('Invalid optimizer checkpoint');
        }
        await writeFile(resume, Buffer.from(result.data, 'base64'), { mode: 0o600 });
      } else if (saved.status !== 404) throw new Error(`Optimizer checkpoint returned HTTP ${saved.status}`);
    }
    const fit = await execute(python, existsSync(resume) ? [...trainArgs, '--resume', resume] : trainArgs).catch(error => {
      if (existsSync(resume) && /Checkpoint incompatible|retained corpus has no/.test(error.stderr ?? '')) return execute(python, trainArgs);
      throw error;
    });
    process.stdout.write(fit.stdout);
    const model = parseNeuralPolicy(await json(candidate));
    const metrics = await json(metricsFile);
    if (!model || model.synthetic || metrics.data !== 'human-demonstrations' || !(metrics.trainWindows > 0 && metrics.holdoutWindows > 0)) {
      throw new Error('Candidate needs compatible weights and a held-out set of human demonstrations.');
    }
    if (metrics.visualTeacher) {
      const { trainWindows, holdoutWindows, detailTrainWindows } = metrics.visualTeacher;
      console.log('[Arena vision]', JSON.stringify({ trainWindows, holdoutWindows, detailTrainWindows }));
    }
    await status('evaluating', data);
    await reportCloud('evaluating', metrics);
    const run = await execute(process.execPath, ['--import', 'tsx', 'test/bench/evaluate-neural.ts', candidate, '--seeds', '1']);
    const simulation = JSON.parse(run.stdout);
    await writeFile(path.join(stage, 'simulation.json'), run.stdout, { mode: 0o600 });
    if (values.cloud) {
      const encoded = path.join(stage, 'optimizer.base64');
      await writeFile(encoded, (await readFile(checkpoint)).toString('base64'), { mode: 0o600 });
      const saved = await remote(`/checkpoint?revision=${revision}`, { method: 'PUT', file: encoded });
      if (!saved.ok) throw new Error(`Saving optimizer checkpoint returned HTTP ${saved.status}`);
    }
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
    if (values.public && passed && !values['reference-only']) {
      const publication = await remote('/neural', { method: 'PUT', file: path.join(output, 'candidate.json') });
      if (!publication.ok) throw new Error(`Model publication returned HTTP ${publication.status}`);
      lastGood.published = await publication.json();
    }
    await status('ready', data, values['reference-only'] ? 'Human reference checkpoint saved.' : values.public && passed ? 'Passed validation and published to Arena.' :
      values.public ? 'Candidate evaluated. Public Arena loads models that pass the quality checks.' : 'Held-out replay and closed-loop comparison completed.');
    await reportCloud('ready', metrics, !!lastGood.published);
  } finally { await rm(stage, { recursive: true, force: true }); }
}

await mkdir(output, { recursive: true, mode: 0o700 });
const previous = await json(path.join(output, 'status.json')).catch(() => null);
if (previous?.rulesVersion === RULES_VERSION && previous.candidate && existsSync(path.join(output, 'candidate.json'))) lastGood = previous.candidate;
let seen: string | undefined;
do {
  if (values.public) {
    try { if (!await pullPublicCorpus() && values.cloud) { console.log('[Arena neural] No new eligible dataset snapshot.'); break; } }
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
        const detail = values.cloud && failure.stderr ? 'The training or simulation subprocess failed.' : failure.message;
        await status('error', data, detail.slice(0, 600));
        await reportCloud('error').catch(() => {});
        if (!values.watch) process.exitCode = 1;
      }
    }
  }
  if (values.watch && !stop.signal.aborted) await setTimeout(Number(values.interval) * 1000, undefined, { signal: stop.signal }).catch(() => {});
} while (values.watch && !stop.signal.aborted);

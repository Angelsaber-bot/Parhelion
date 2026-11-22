import { DurableObject } from 'cloudflare:workers';
import { MAX_TRAINING_BODY, newTrainingCheckpoint, parseTrainingBatch, trainArenaBatch, type TrainingBatch, type TrainingCheckpoint } from '../shared/trainingData.ts';
import { RULES_VERSION } from '../shared/protocol.ts';
import { parseExplorationModel } from '../shared/exploration.ts';
import { NEURAL_POLICY_VERSION, parseNeuralPolicy, type NeuralPolicyModel } from '../shared/neuralPolicy.ts';
import type { Env } from './index.ts';
import { bundledOpponent, directPolicy } from '../shared/learnedOpponent.ts';
import playerDemos from '../tools/player-demos.json';
import { makeSelfPlayBatch } from './trainingSelfPlay.ts';
import { parseEvaluationReport, type EvaluationReport } from '../shared/evaluationReport.ts';

const QUEUE_LIMIT = 96;
const BATCHES_PER_ALARM = 8;
const DEDUP_WINDOW = 24 * 60 * 60 * 1000;
const SELF_PLAY_INTERVAL = 5 * 60 * 1000;
const CORPUS_LIMIT = 4096;
const CORPUS_RETENTION = 30 * DEDUP_WINDOW;
const CORPUS_READ_LIMIT = 8;
// Withdraw the original bootstrap trained with a future turn in some search histories.
// Other direct-control releases, including later promoted champions, stay pinned.
const WITHDRAWN_BOOTSTRAP = '5070318ab15e277f6b342b0c5d2769b3c694f03141493f3824cb9ef5c22a45bd';
// Upgrade only the previously served public actor. Later champions keep their own release.
const PREVIOUS_PLAYER_RELEASE = '82ffe52b0035b0046f2f9483b1ec9acfd6ccd5d1ebcf4e8718f4a72fe8f8f54c';
const keepRelease = (digest?: string) => !!digest && digest !== WITHDRAWN_BOOTSTRAP && digest !== PREVIOUS_PLAYER_RELEASE;
const MAX_MODEL_BODY = 12 * 1024 ** 2;
const MODEL_CHUNK = 240 * 1024;
const MAX_CHECKPOINT_BODY = 8 * 1024 ** 2;
const MAX_RL_BODY = 16 * 1024 ** 2;
const RL_REASONS = ['shadow', 'evaluating', 'evaluation_failed', 'insufficient_evidence', 'passed'] as const;
const RL_JOB_STATES = ['collecting', 'updating', 'evaluating', 'error'] as const;
interface ReinforcementJob { parent: number; state: typeof RL_JOB_STATES[number]; at: number }
interface ReinforcementEvaluation {
  generation: number; at: number; reason: typeof RL_REASONS[number]; failedGates: string[]; published: boolean;
  report?: EvaluationReport;
}
interface ReinforcementCommit {
  rulesVersion: number; parent: number; generation: number; humanRevision: number;
  episodes: number; environmentSteps: number; optimizerSteps: number;
  digest: string; reason: typeof RL_REASONS[number]; failedGates: string[];
  published: boolean; at: number; totalEpisodes: number; totalEnvironmentSteps: number; totalOptimizerSteps: number;
  lastEvaluation: ReinforcementEvaluation | null;
}

function completedEvaluation({ generation, at, reason, failedGates, published, report }: ReinforcementEvaluation): ReinforcementEvaluation | null {
  return reason === 'shadow' || reason === 'evaluating' ? null : { generation, at, reason, failedGates, published, ...(report && { report }) };
}

const counter = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const base64Artifact = (value: unknown, max: number): value is string => typeof value === 'string' && value.length > 0 &&
  value.length <= max && value.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(value);
async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, '0')).join('');
}
const PUBLIC_ORIGIN = 'https://parhelion-game.pages.dev';
const PUBLIC_TRAINER = 'parhelion-arena.lejiazhang-us.workers.dev';
const RUN_STATES = ['training', 'evaluating', 'ready', 'error'] as const;
type RunState = typeof RUN_STATES[number];
interface TrainingRun { revision: number; state: RunState; at: number; completedRevision: number; trainWindows?: number; holdoutWindows?: number; published?: boolean }

const loopback = (hostname: string) => hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
function localOrigin(origin: string | null): boolean {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    return loopback(url.hostname) && (url.protocol === 'http:' || url.protocol === 'https:');
  } catch { return false; }
}

/** The trainer owns its storage and CPU budget, separate from live rooms. */
export class ArenaTraining extends DurableObject<Env> {
  private currentModel: NeuralPolicyModel | null | undefined;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS batches (id TEXT PRIMARY KEY, at INTEGER NOT NULL, payload TEXT)');
    ctx.storage.sql.exec('CREATE INDEX IF NOT EXISTS pending_batches ON batches(at) WHERE payload IS NOT NULL');
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS checkpoint (id INTEGER PRIMARY KEY, model TEXT NOT NULL, interval INTEGER NOT NULL DEFAULT 0)');
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS neural_model (part INTEGER PRIMARY KEY, body TEXT NOT NULL)');
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS neural_release (id INTEGER PRIMARY KEY, digest TEXT NOT NULL, at INTEGER NOT NULL)');
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS corpus (id INTEGER PRIMARY KEY AUTOINCREMENT, batch TEXT NOT NULL UNIQUE, at INTEGER NOT NULL, payload TEXT NOT NULL)');
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS training_run (id INTEGER PRIMARY KEY, run TEXT NOT NULL)');
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS optimizer_checkpoint (part INTEGER PRIMARY KEY, body TEXT NOT NULL)');
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS optimizer_revision (id INTEGER PRIMARY KEY, revision INTEGER NOT NULL)');
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS rl_commit (id INTEGER PRIMARY KEY, metadata TEXT NOT NULL, request_hash TEXT NOT NULL)');
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS rl_artifacts (kind TEXT NOT NULL, part INTEGER NOT NULL, body TEXT NOT NULL, PRIMARY KEY(kind,part))');
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS rl_job (id INTEGER PRIMARY KEY, job TEXT NOT NULL)');
  }

  async enqueue(batch: TrainingBatch, retain = false): Promise<boolean> {
    const sql = this.ctx.storage.sql;
    const id = `${batch.capture}:${batch.sequence}`;
    if (!sql.exec('SELECT 1 FROM batches WHERE id = ?', id).toArray().length) {
      if (this.pending() >= QUEUE_LIMIT) return false;
      const now = Date.now(), payload = JSON.stringify(batch);
      this.ctx.storage.transactionSync(() => {
        sql.exec('INSERT INTO batches (id, at, payload) VALUES (?, ?, ?)', id, now, payload);
        if (retain && batch.exploration?.length) {
          sql.exec('INSERT OR IGNORE INTO corpus (batch, at, payload) VALUES (?, ?, ?)', id, now, payload);
          this.pruneCorpus(now);
        }
      });
    }
    if (this.pending() && await this.ctx.storage.getAlarm() === null) await this.ctx.storage.setAlarm(Date.now() + 3000);
    return true;
  }

  private pruneCorpus(now: number) {
    const sql = this.ctx.storage.sql;
    sql.exec('DELETE FROM corpus WHERE at < ?', now - CORPUS_RETENTION);
    sql.exec('DELETE FROM corpus WHERE id IN (SELECT id FROM corpus ORDER BY id DESC LIMIT -1 OFFSET ?)', CORPUS_LIMIT);
  }

  async corpusRows(after = 0, through = Number.MAX_SAFE_INTEGER) {
    if (!this.env.ARENA_NEURAL_CORPUS_TOKEN) return [];
    this.pruneCorpus(Date.now());
    return this.ctx.storage.sql.exec<{ id: number; at: number; payload: string }>('SELECT id,at,payload FROM corpus WHERE id > ? AND id <= ? ORDER BY id LIMIT ?', after, through, CORPUS_READ_LIMIT).toArray()
      .map(({ id, at, payload }) => ({ id, receivedAt: at, batch: JSON.parse(payload) as TrainingBatch }));
  }

  async acknowledgeCorpus(through: number) {
    if (this.env.ARENA_NEURAL_CORPUS_TOKEN) this.ctx.storage.sql.exec('DELETE FROM corpus WHERE id <= ?', through);
  }

  async alarm(): Promise<void> {
    const sql = this.ctx.storage.sql;
    const pairs = sql.exec<{ id: string; payload: string }>(
      'SELECT id,payload FROM batches WHERE payload IS NOT NULL ORDER BY at,id LIMIT ?', BATCHES_PER_ALARM,
    ).toArray();
    if (pairs.length) {
      const model = this.checkpoint();
      for (const { payload } of pairs) {
        const batch = JSON.parse(payload) as TrainingBatch;
        const digest = await sha256(batch.capture);
        if (playerDemos[digest as keyof typeof playerDemos] === 'train') trainArenaBatch(model, batch);
      }
      this.ctx.storage.transactionSync(() => {
        sql.exec('INSERT OR REPLACE INTO checkpoint (id, model) VALUES (1, ?)', JSON.stringify(model));
        for (const { id } of pairs) sql.exec('UPDATE batches SET payload=NULL WHERE id=?', id);
        sql.exec('DELETE FROM batches WHERE payload IS NULL AND at < ?', Date.now() - DEDUP_WINDOW);
      });
    }
    if (this.pending()) await this.ctx.storage.setAlarm(Date.now() + 1000);
  }

  private pending(): number {
    return this.ctx.storage.sql.exec<{ n: number }>('SELECT COUNT(*) AS n FROM batches WHERE payload IS NOT NULL').one().n;
  }

  private checkpoint(id = 1): TrainingCheckpoint {
    const saved = this.ctx.storage.sql.exec<{ model: string }>('SELECT model FROM checkpoint WHERE id=?', id).toArray()[0];
    return saved ? JSON.parse(saved.model) as TrainingCheckpoint : newTrainingCheckpoint();
  }

  async selfPlay(scheduledTime: number): Promise<void> {
    const interval = Math.floor(scheduledTime / SELF_PLAY_INTERVAL);
    const sql = this.ctx.storage.sql;
    const last = sql.exec<{ interval: number }>('SELECT interval FROM checkpoint WHERE id=2').toArray()[0]?.interval ?? -1;
    if (last >= interval) return;
    this.pruneCorpus(Date.now());
    const model = this.checkpoint(2), batch = makeSelfPlayBatch(interval, await this.botNeuralModel());
    if (batch.rows.length) trainArenaBatch(model, batch);
    sql.exec('INSERT OR REPLACE INTO checkpoint (id, model, interval) VALUES (2, ?, ?)', JSON.stringify(model), interval);
  }

  async status(rulesVersion = RULES_VERSION, collecting = false) {
    const { trained, heldOut, recentLoss, recentHoldoutLoss, exploration } = this.checkpoint();
    if (rulesVersion === RULES_VERSION) await this.botNeuralModel();
    const neural = this.release();
    const dataset = this.ctx.storage.sql.exec<{ batches: number; matches: number; revision: number }>(
      'SELECT COUNT(*) AS batches, COUNT(DISTINCT substr(batch,1,32)) AS matches, COALESCE(MAX(id),0) AS revision FROM corpus',
    ).one();
    const playableRuntime = await this.ctx.storage.get('playableRuntime') ?? null;
    return { rulesVersion, neuralPolicyVersion: NEURAL_POLICY_VERSION, playableRuntime, queuedBatches: this.pending(), trainedTicks: trained, holdoutTicks: heldOut, recentLoss, recentHoldoutLoss,
      selfPlayTicks: this.checkpoint(2).trained, shadow: !neural, neural, pendingNeuralBatches: dataset.batches, dataset,
      transformer: this.trainingRun(), reinforcement: this.reinforcementCommit()?.metadata ?? null,
      reinforcementJob: this.reinforcementJob(), neuralCollection: collecting,
      neuralExportConfigured: !!this.env.ARENA_NEURAL_CORPUS_TOKEN, exploration: {
        trainedWindows: exploration?.trained ?? 0, holdoutWindows: exploration?.heldOut ?? 0,
        yawError: exploration?.heldOut ? exploration.yawError / exploration.heldOut : null,
        stillYawError: exploration?.heldOut ? exploration.stillYawError / exploration.heldOut : null,
      } };
  }

  private trainingRun(): TrainingRun | null {
    const saved = this.ctx.storage.sql.exec<{ run: string }>('SELECT run FROM training_run WHERE id=1').toArray()[0];
    return saved ? JSON.parse(saved.run) as TrainingRun : null;
  }

  async reportTrainingRun(input: unknown): Promise<boolean> {
    if (!input || typeof input !== 'object') return false;
    const { revision, state, trainWindows, holdoutWindows, published } = input as Partial<TrainingRun>;
    const numeric = (x: unknown) => typeof x === 'number' && Number.isSafeInteger(x) && x >= 0;
    if (!numeric(revision) || !revision || !state || !RUN_STATES.includes(state) ||
        (trainWindows !== undefined && !numeric(trainWindows)) || (holdoutWindows !== undefined && !numeric(holdoutWindows)) ||
        (published !== undefined && typeof published !== 'boolean')) return false;
    const previous = this.trainingRun();
    if (previous && revision < previous.revision) return false;
    const completedRevision = state === 'ready' ? revision : previous?.completedRevision ?? 0;
    this.ctx.storage.sql.exec('INSERT OR REPLACE INTO training_run VALUES (1, ?)', JSON.stringify({
      revision, state, at: Date.now(), completedRevision, trainWindows, holdoutWindows, published,
    }));
    return true;
  }

  async explorationModel() {
    return parseExplorationModel(this.checkpoint().exploration) ?? null;
  }

  async botExplorationModel() {
    const state = this.checkpoint().exploration;
    return state && state.heldOut >= 240 && state.yawError < state.stillYawError ? parseExplorationModel(state) ?? null : null;
  }

  private release() {
    return this.ctx.storage.sql.exec<{ digest: string; at: number }>('SELECT digest, at FROM neural_release WHERE id=1').toArray()[0] ?? null;
  }

  private reinforcementCommit() {
    const row = this.ctx.storage.sql.exec<{ metadata: string; request_hash: string }>(
      'SELECT metadata, request_hash FROM rl_commit WHERE id=1',
    ).toArray()[0];
    if (!row) return null;
    const metadata = JSON.parse(row.metadata) as ReinforcementCommit;
    metadata.lastEvaluation ??= completedEvaluation(metadata);
    return { metadata, requestHash: row.request_hash };
  }

  private reinforcementJob(): ReinforcementJob | null {
    const row = this.ctx.storage.sql.exec<{ job: string }>('SELECT job FROM rl_job WHERE id=1').toArray()[0];
    return row ? JSON.parse(row.job) as ReinforcementJob : null;
  }

  private async reportReinforcementJob(req: Request): Promise<Response> {
    const text = await readText(req, 1024);
    if (typeof text !== 'string') return new Response(null, { status: text === false ? 413 : 400 });
    let job;
    try { job = JSON.parse(text); } catch { return new Response(null, { status: 400 }); }
    if (job?.rulesVersion !== RULES_VERSION || !counter(job.parent) || !RL_JOB_STATES.includes(job.state))
      return new Response(null, { status: 400 });
    if ((this.reinforcementCommit()?.metadata.generation ?? 0) !== job.parent) return new Response(null, { status: 409 });
    this.ctx.storage.sql.exec('INSERT OR REPLACE INTO rl_job VALUES (1,?)', JSON.stringify({ parent: job.parent, state: job.state, at: Date.now() }));
    return new Response(null, { status: 204 });
  }

  private async reinforcementCheckpoint(req: Request): Promise<Response> {
    const sql = this.ctx.storage.sql;
    if (req.method === 'GET') {
      const saved = this.reinforcementCommit();
      if (!saved) return new Response(null, { status: 404 });
      const artifact = (kind: string) => sql.exec<{ body: string }>('SELECT body FROM rl_artifacts WHERE kind=? ORDER BY part', kind)
        .toArray().map(row => row.body).join('');
      return Response.json({ ...saved.metadata, checkpoint: artifact('checkpoint'), history: artifact('history') || undefined },
        { headers: { 'cache-control': 'no-store' } });
    }
    const text = await readText(req, MAX_RL_BODY);
    if (typeof text !== 'string') return new Response(null, { status: text === false ? 413 : 400 });
    let input;
    try { input = JSON.parse(text); } catch { return new Response(null, { status: 400 }); }
    if (!input || typeof input !== 'object' || Array.isArray(input)) return new Response(null, { status: 400 });
    const { rulesVersion, parent, generation, humanRevision, episodes, environmentSteps, optimizerSteps,
      digest, checkpoint, history, promote, expectedReleaseDigest } = input;
    const reason = input.reason ?? (promote === undefined ? 'shadow' : 'passed');
    const failedGates = input.failedGates ?? [];
    const report = parseEvaluationReport(input.evaluationReport);
    if (input.evaluationReport !== undefined && (!report || reason === 'shadow' || reason === 'evaluating')) return new Response(null, { status: 400 });
    if (rulesVersion !== RULES_VERSION || !counter(parent) || !counter(generation) || generation !== parent + 1 ||
        !counter(humanRevision) || !counter(episodes) || !episodes || !counter(environmentSteps) || environmentSteps < episodes ||
        !counter(optimizerSteps) || !optimizerSteps || typeof digest !== 'string' || !/^[a-f0-9]{64}$/.test(digest) ||
        !base64Artifact(checkpoint, 12 * 1024 ** 2) || (history !== undefined && !base64Artifact(history, 8 * 1024 ** 2)) ||
        !RL_REASONS.includes(reason) || !Array.isArray(failedGates) || failedGates.length > 24 ||
        !failedGates.every((s: unknown) => typeof s === 'string' && /^[a-zA-Z0-9_.-]{1,64}$/.test(s)) ||
        (promote !== undefined && (typeof promote !== 'string' || promote.length > MAX_MODEL_BODY || reason !== 'passed' ||
          failedGates.length || !(expectedReleaseDigest === null || (typeof expectedReleaseDigest === 'string' && /^[a-f0-9]{64}$/.test(expectedReleaseDigest))))))
      return new Response(null, { status: 400 });
    let model: NeuralPolicyModel | undefined;
    if (promote !== undefined) {
      try { model = parseNeuralPolicy(JSON.parse(promote)); } catch { /* rejected below */ }
      if (!directPolicy(model) || digest === WITHDRAWN_BOOTSTRAP || await sha256(promote) !== digest) return new Response(null, { status: 400 });
    }
    const requestHash = await sha256(text);
    // All reads affecting CAS occur after the final await, with no yield through the commit.
    const saved = this.reinforcementCommit();
    if (saved?.requestHash === requestHash) return Response.json(saved.metadata);
    const previous = saved?.metadata;
    if (parent !== (previous?.generation ?? 0) || (previous && (digest === previous.digest || humanRevision < previous.humanRevision)) ||
        (model && (this.release()?.digest ?? null) !== expectedReleaseDigest)) return new Response(null, { status: 409 });
    const at = Date.now();
    const metadata: ReinforcementCommit = { rulesVersion, parent, generation, humanRevision, episodes, environmentSteps, optimizerSteps,
      digest, reason, failedGates, published: !!model, at, totalEpisodes: (previous?.totalEpisodes ?? 0) + episodes,
      totalEnvironmentSteps: (previous?.totalEnvironmentSteps ?? 0) + environmentSteps,
      totalOptimizerSteps: (previous?.totalOptimizerSteps ?? 0) + optimizerSteps,
      lastEvaluation: completedEvaluation({ generation, at, reason, failedGates, published: !!model, report }) ?? previous?.lastEvaluation ?? null };
    if (![metadata.totalEpisodes, metadata.totalEnvironmentSteps, metadata.totalOptimizerSteps].every(counter)) return new Response(null, { status: 400 });
    this.ctx.storage.transactionSync(() => {
      sql.exec('DELETE FROM rl_artifacts');
      for (const [kind, data] of [['checkpoint', checkpoint], ['history', history]] as const) {
        if (data) for (let i = 0; i < data.length; i += MODEL_CHUNK)
          sql.exec('INSERT INTO rl_artifacts VALUES (?,?,?)', kind, i, data.slice(i, i + MODEL_CHUNK));
      }
      if (model) this.storeLiveModel(promote, digest, at);
      sql.exec('INSERT OR REPLACE INTO rl_commit VALUES (1,?,?)', JSON.stringify(metadata), requestHash);
      sql.exec('DELETE FROM rl_job');
    });
    if (model) this.currentModel = model;
    return Response.json(metadata);
  }

  private storeLiveModel(weights: string, digest: string, at: number) {
    const sql = this.ctx.storage.sql;
    sql.exec('DELETE FROM neural_model');
    for (let start = 0; start < weights.length; start += MODEL_CHUNK) sql.exec('INSERT INTO neural_model VALUES (?, ?)', start, weights.slice(start, start + MODEL_CHUNK));
    sql.exec('INSERT OR REPLACE INTO neural_release VALUES (1, ?, ?)', digest, at);
  }

  private modelText() {
    return this.ctx.storage.sql.exec<{ body: string }>('SELECT body FROM neural_model ORDER BY part').toArray().map(row => row.body).join('');
  }

  async botNeuralModel(): Promise<NeuralPolicyModel | null> {
    if (this.currentModel) return this.currentModel;
    const read = () => {
      const bytes = this.modelText();
      return bytes ? parseNeuralPolicy(JSON.parse(bytes)) : undefined;
    };
    const saved = read();
    if (directPolicy(saved) && keepRelease(this.release()?.digest)) return this.currentModel = saved;

    // Initialize an empty registry or replace an old motor-assisted release. Recheck
    // after hashing: a concurrent promotion always wins over the bundled checkpoint.
    const bytes = JSON.stringify(bundledOpponent);
    const digest = await sha256(bytes);
    return this.ctx.storage.transactionSync(() => {
      const latest = this.currentModel ?? read();
      if (directPolicy(latest) && keepRelease(this.release()?.digest)) return this.currentModel = latest;
      this.storeLiveModel(bytes, digest, Date.now());
      return this.currentModel = bundledOpponent;
    });
  }

  private async optimizerCheckpoint(req: Request): Promise<Response> {
    const sql = this.ctx.storage.sql;
    const saved = sql.exec<{ revision: number }>('SELECT revision FROM optimizer_revision WHERE id=1').toArray()[0];
    if (req.method === 'GET') {
      if (!saved) return new Response(null, { status: 404 });
      const data = sql.exec<{ body: string }>('SELECT body FROM optimizer_checkpoint ORDER BY part').toArray().map(row => row.body).join('');
      return Response.json({ revision: saved.revision, data }, { headers: { 'cache-control': 'no-store' } });
    }
    const version = Number(new URL(req.url).searchParams.get('revision'));
    const body = await readText(req, MAX_CHECKPOINT_BODY);
    if (!Number.isSafeInteger(version) || version <= 0 || typeof body !== 'string' || !body.length ||
        body.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(body)) return new Response(null, { status: 400 });
    const current = sql.exec<{ revision: number }>('SELECT revision FROM optimizer_revision WHERE id=1').toArray()[0];
    if ((current?.revision ?? 0) > version || this.trainingRun()?.revision !== version) return new Response(null, { status: 409 });
    this.ctx.storage.transactionSync(() => {
      sql.exec('DELETE FROM optimizer_checkpoint');
      for (let start = 0; start < body.length; start += MODEL_CHUNK) sql.exec('INSERT INTO optimizer_checkpoint VALUES (?, ?)', start, body.slice(start, start + MODEL_CHUNK));
      sql.exec('INSERT OR REPLACE INTO optimizer_revision VALUES (1, ?)', version);
    });
    return new Response(null, { status: 204 });
  }

  async fetch(req: Request): Promise<Response> {
    const pathname = new URL(req.url).pathname;
    if (pathname === '/training/runtime') {
      const body = await readText(req, 512);
      if (typeof body !== 'string') return new Response(null, { status: 400 });
      try {
        const { rulesVersion, neuralPolicyVersion, commit } = JSON.parse(body);
        if (rulesVersion !== RULES_VERSION || !Number.isInteger(neuralPolicyVersion) || neuralPolicyVersion < 1 ||
            neuralPolicyVersion > NEURAL_POLICY_VERSION || typeof commit !== 'string' || !/^[a-f0-9]{40}$/.test(commit))
          return new Response(null, { status: 400 });
        await this.ctx.storage.put('playableRuntime', { rulesVersion, neuralPolicyVersion, commit });
        return new Response(null, { status: 204 });
      } catch { return new Response(null, { status: 400 }); }
    }
    if (pathname === '/training/checkpoint') return this.optimizerCheckpoint(req);
    if (pathname === '/training/selfplay') return this.reinforcementCheckpoint(req);
    if (pathname === '/training/selfplay/job') return this.reportReinforcementJob(req);
    await this.botNeuralModel();
    const release = this.release();
    if (req.method === 'GET') {
      if (!release) return new Response(null, { status: 404 });
      const etag = `"${release.digest}"`;
      const headers = { 'content-type': 'application/json', 'cache-control': 'public, max-age=120', etag };
      return req.headers.get('if-none-match') === etag ? new Response(null, { status: 304, headers }) : new Response(this.modelText(), { headers });
    }
    if (req.method !== 'PUT') return new Response(null, { status: 405 });
    const body = await readText(req, MAX_MODEL_BODY);
    if (typeof body !== 'string') return new Response(null, { status: body === false ? 413 : 400 });
    let model: NeuralPolicyModel | undefined;
    try { model = parseNeuralPolicy(JSON.parse(body)); } catch { /* rejected below */ }
    if (!directPolicy(model)) return new Response(null, { status: 400 });
    const weights = JSON.stringify(model);
    const digest = await sha256(weights);
    if (digest === WITHDRAWN_BOOTSTRAP) return new Response(null, { status: 400 });
    if (release?.digest === digest) return Response.json(release);
    const at = Date.now();
    this.ctx.storage.transactionSync(() => this.storeLiveModel(weights, digest, at));
    this.currentModel = model;
    return Response.json({ digest, at });
  }
}

export function trainingStore(storage: DurableObjectNamespace<ArenaTraining>, rulesVersion = RULES_VERSION) {
  return storage.get(storage.idFromName(`arena-v1-rules-${rulesVersion}`));
}

function allowedOrigin(origin: string): boolean {
  if (origin === PUBLIC_ORIGIN) return true;
  try {
    const url = new URL(origin);
    return /^https?:$/.test(url.protocol) && /^(localhost|127\.0\.0\.1|\[::1\]|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/.test(url.hostname);
  } catch { return false; }
}

async function readText(req: Request, limit: number): Promise<string | false | null> {
  if (Number(req.headers.get('content-length')) > limit) return false;
  if (!req.body) return null;
  const reader = req.body.getReader(), decoder = new TextDecoder();
  let n = 0, body = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    n += value.length;
    if (n > limit) { void reader.cancel().catch(() => {}); return false; }
    body += decoder.decode(value, { stream: true });
  }
  return body + decoder.decode();
}

export async function trainingRequest(req: Request, storage: DurableObjectNamespace<ArenaTraining>, corpusToken?: string): Promise<Response> {
  const url = new URL(req.url);
  const origin = req.headers.get('origin');
  const local = loopback(url.hostname);
  const publicService = url.hostname === PUBLIC_TRAINER && url.protocol === 'https:';
  const administrator = !origin && (local || publicService) && !!corpusToken && req.headers.get('authorization') === `Bearer ${corpusToken}`;
  if (url.pathname === '/training/corpus') {
    if (!administrator) return new Response(null, { status: 404 });
    const object = trainingStore(storage);
    if (req.method === 'GET') {
      const after = Number(url.searchParams.get('after') ?? 0);
      const through = Number(url.searchParams.get('through') ?? Number.MAX_SAFE_INTEGER);
      if (!Number.isSafeInteger(after) || after < 0 || !Number.isSafeInteger(through) || through < after) return new Response(null, { status: 400 });
      return Response.json({ records: await object.corpusRows(after, through) }, { headers: { 'cache-control': 'no-store' } });
    }
    const through = Number(url.searchParams.get('through'));
    if (req.method !== 'DELETE') return new Response(null, { status: 405 });
    if (!Number.isSafeInteger(through) || through < 1) return new Response(null, { status: 400 });
    if (local) await object.acknowledgeCorpus(through);
    return new Response(null, { status: 204 });
  }
  if (url.pathname === '/training/job') {
    if (!administrator || req.method !== 'PUT') return new Response(null, { status: 404 });
    const body = await readText(req, 4096);
    try {
      if (typeof body === 'string' && await trainingStore(storage).reportTrainingRun(JSON.parse(body))) return new Response(null, { status: 204 });
    } catch { /* invalid JSON */ }
    return new Response(null, { status: 400 });
  }
  if (url.pathname === '/training/runtime') {
    if (!administrator || req.method !== 'PUT') return new Response(null, { status: 404 });
    return trainingStore(storage).fetch(req);
  }
  if (url.pathname === '/training/checkpoint' || url.pathname === '/training/selfplay' || url.pathname === '/training/selfplay/job') {
    if (!administrator || !['GET', 'PUT'].includes(req.method)) return new Response(null, { status: 404 });
    if (url.pathname.endsWith('/job') && req.method !== 'PUT') return new Response(null, { status: 405 });
    return trainingStore(storage).fetch(req);
  }
  const headers: HeadersInit = origin && allowedOrigin(origin) ? { 'access-control-allow-origin': origin, vary: 'origin' } : {};
  if ((origin && !allowedOrigin(origin)) || (req.method === 'POST' && !origin)) return new Response(null, { status: 403 });
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...headers, 'access-control-allow-methods': 'GET, POST', 'access-control-allow-headers': 'content-type' } });
  const object = trainingStore(storage);
  const pathname = url.pathname;
  if (pathname === '/training/neural') {
    if (req.method !== 'GET' && !(req.method === 'PUT' && administrator)) return new Response(null, { status: 404 });
    const response = await object.fetch(req);
    const output = new Headers(response.headers);
    for (const [name, value] of Object.entries(headers)) output.set(name, value);
    return new Response(response.body, { status: response.status, headers: output });
  }
  if (pathname === '/training/status' && req.method === 'GET') {
    const version = url.searchParams.has('rules') ? Number(url.searchParams.get('rules')) : RULES_VERSION;
    if (!Number.isInteger(version) || version < 41 || version > RULES_VERSION) return new Response(null, { status: 404, headers });
    const selected = version === RULES_VERSION ? object : trainingStore(storage, version);
    return Response.json(await selected.status(version, version === RULES_VERSION && (publicService || (local && !!corpusToken))), { headers: { ...headers, 'cache-control': 'no-store' } });
  }
  if (pathname === '/training/exploration' && req.method === 'GET') return Response.json(await (url.searchParams.has('active') ? object.botExplorationModel() : object.explorationModel()), { headers: { ...headers, 'cache-control': 'no-store' } });
  if (pathname !== '/training' || req.method !== 'POST') return new Response(null, { status: 405, headers });
  const body = await readText(req, MAX_TRAINING_BODY);
  if (body === false) return new Response(null, { status: 413, headers });
  let result: TrainingBatch | null = null;
  try { if (body) result = parseTrainingBatch(JSON.parse(body)); } catch { /* invalid JSON */ }
  if (!result) return new Response(null, { status: 400, headers });
  const retain = (publicService && origin === PUBLIC_ORIGIN) || (!!corpusToken && local && localOrigin(origin));
  return new Response(null, { status: await object.enqueue(result, retain) ? 202 : 429, headers });
}

import { DurableObject } from 'cloudflare:workers';
import { MAX_TRAINING_BODY, newTrainingCheckpoint, parseTrainingBatch, trainArenaBatch, type TrainingBatch, type TrainingCheckpoint } from '../shared/trainingData.ts';
import { RULES_VERSION } from '../shared/protocol.ts';
import type { Env } from './index.ts';
import { makeSelfPlayBatch } from './trainingSelfPlay.ts';

const QUEUE_LIMIT = 96;
const BATCHES_PER_ALARM = 8;
const DEDUP_WINDOW = 24 * 60 * 60 * 1000;
const SELF_PLAY_INTERVAL = 5 * 60 * 1000;

/** The trainer owns its storage and CPU budget, separate from live rooms. */
export class ArenaTraining extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS batches (id TEXT PRIMARY KEY, at INTEGER NOT NULL, payload TEXT)');
    ctx.storage.sql.exec('CREATE INDEX IF NOT EXISTS pending_batches ON batches(at) WHERE payload IS NOT NULL');
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS checkpoint (id INTEGER PRIMARY KEY, model TEXT NOT NULL, interval INTEGER NOT NULL DEFAULT 0)');
  }

  async enqueue(batch: TrainingBatch): Promise<boolean> {
    const sql = this.ctx.storage.sql;
    const id = `${batch.capture}:${batch.sequence}`;
    if (!sql.exec('SELECT 1 FROM batches WHERE id = ?', id).toArray().length) {
      if (this.pending() >= QUEUE_LIMIT) return false;
      sql.exec('INSERT INTO batches (id, at, payload) VALUES (?, ?, ?)', id, Date.now(), JSON.stringify(batch));
    }
    if (this.pending() && await this.ctx.storage.getAlarm() === null) await this.ctx.storage.setAlarm(Date.now() + 3000);
    return true;
  }

  async alarm(): Promise<void> {
    const sql = this.ctx.storage.sql;
    const pairs = sql.exec<{ id: string; payload: string }>(
      'SELECT id,payload FROM batches WHERE payload IS NOT NULL ORDER BY at,id LIMIT ?', BATCHES_PER_ALARM,
    ).toArray();
    if (pairs.length) {
      const model = this.checkpoint();
      for (const { payload } of pairs) trainArenaBatch(model, JSON.parse(payload) as TrainingBatch);
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
    const model = this.checkpoint(2), batch = makeSelfPlayBatch(interval);
    if (batch.rows.length) trainArenaBatch(model, batch);
    sql.exec('INSERT OR REPLACE INTO checkpoint (id, model, interval) VALUES (2, ?, ?)', JSON.stringify(model), interval);
  }

  async status() {
    const { trained, heldOut, recentLoss, recentHoldoutLoss } = this.checkpoint();
    return { queuedBatches: this.pending(), trainedTicks: trained, holdoutTicks: heldOut, recentLoss, recentHoldoutLoss,
      selfPlayTicks: this.checkpoint(2).trained, shadow: true };
  }
}

export function trainingStore(storage: DurableObjectNamespace<ArenaTraining>) {
  return storage.get(storage.idFromName(`arena-v1-rules-${RULES_VERSION}`));
}

function allowedOrigin(origin: string): boolean {
  if (origin === 'https://parhelion-game.pages.dev') return true;
  try {
    const url = new URL(origin);
    return /^https?:$/.test(url.protocol) && /^(localhost|127\.0\.0\.1|\[::1\]|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/.test(url.hostname);
  } catch { return false; }
}

async function readBatch(req: Request): Promise<TrainingBatch | null | 'oversize'> {
  if (Number(req.headers.get('content-length')) > MAX_TRAINING_BODY) return 'oversize';
  if (!req.body) return null;
  const reader = req.body.getReader(), decoder = new TextDecoder();
  let n = 0, body = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    n += value.length;
    if (n > MAX_TRAINING_BODY) { void reader.cancel().catch(() => {}); return 'oversize'; }
    body += decoder.decode(value, { stream: true });
  }
  try { return parseTrainingBatch(JSON.parse(body + decoder.decode())); } catch { return null; }
}

export async function trainingRequest(req: Request, storage: DurableObjectNamespace<ArenaTraining>): Promise<Response> {
  const origin = req.headers.get('origin');
  const headers: HeadersInit = origin && allowedOrigin(origin) ? { 'access-control-allow-origin': origin, vary: 'origin' } : {};
  if ((origin && !allowedOrigin(origin)) || (req.method === 'POST' && !origin)) return new Response(null, { status: 403 });
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...headers, 'access-control-allow-methods': 'GET, POST', 'access-control-allow-headers': 'content-type' } });
  const object = trainingStore(storage);
  const pathname = new URL(req.url).pathname;
  if (pathname === '/training/status' && req.method === 'GET') return Response.json(await object.status(), { headers: { ...headers, 'cache-control': 'no-store' } });
  if (pathname !== '/training' || req.method !== 'POST') return new Response(null, { status: 405, headers });
  const result = await readBatch(req);
  if (result === 'oversize') return new Response(null, { status: 413, headers });
  if (!result) return new Response(null, { status: 400, headers });
  return new Response(null, { status: await object.enqueue(result) ? 202 : 429, headers });
}

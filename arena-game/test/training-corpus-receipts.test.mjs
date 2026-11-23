import { DatabaseSync } from 'node:sqlite';
import { expect, it, vi } from 'vitest';
import { ArenaTraining, trainingRequest } from '../worker/training.ts';

vi.mock('cloudflare:workers', () => ({ DurableObject: class {
  constructor(ctx, env) { this.ctx = ctx; this.env = env; }
} }));

it('returns the original server receipt time only through the authenticated corpus route', async () => {
  const db = new DatabaseSync(':memory:');
  try {
    const sql = { exec(query, ...values) {
      const stmt = db.prepare(query);
      if (stmt.columns().length) return { toArray: () => stmt.all(...values) };
      stmt.run(...values);
    } };
    const secret = 'unit-test-credential';
    const object = new ArenaTraining({ storage: { sql } }, { ARENA_NEURAL_CORPUS_TOKEN: secret });
    const at = Date.now() - 86400000;
    db.prepare('INSERT INTO corpus (batch, at, payload) VALUES (?, ?, ?)').run('game:0', at, '{"capture":"game"}');
    db.prepare('INSERT INTO corpus (batch, at, payload) VALUES (?, ?, ?)').run('expired:0', at - 31 * 86400000, '{}');
    const ns = { idFromName: n => n, get: () => object };
    const url = 'https://parhelion-arena.lejiazhang-us.workers.dev/training/corpus';
    expect((await trainingRequest(new Request(url), ns, secret)).status).toBe(404);
    const response = await trainingRequest(new Request(url, { headers: { authorization: 'Bearer ' + secret } }), ns, secret);
    expect(await response.json()).toEqual({ records: [{ id: 1, receivedAt: at, batch: { capture: 'game' } }] });
    db.exec('PRAGMA query_only = ON');
    expect(await object.corpusRows(1)).toEqual([]);
    expect(response.headers.get('cache-control')).toBe('no-store');
  } finally {
    db.close();
  }
});

it('distinguishes a storage limit from other status failures and exposes no raw diagnostics', async () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    for (const [message, code] of [['Daily limit exceeded', 'storage_limit'], ['internal detail', 'status_unavailable']]) {
      const ns = { idFromName: n => n, get: () => ({ status: async () => { throw new Error(message); } }) };
      const response = await trainingRequest(new Request('https://parhelion-arena.lejiazhang-us.workers.dev/training/status'), ns);
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ error: code });
      expect(response.headers.get('cache-control')).toBe('no-store');
    }
  } finally {
    log.mockRestore();
  }
});

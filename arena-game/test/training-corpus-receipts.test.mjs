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
    const ns = { idFromName: n => n, get: () => object };
    const url = 'https://parhelion-arena.lejiazhang-us.workers.dev/training/corpus';
    expect((await trainingRequest(new Request(url), ns, secret)).status).toBe(404);
    const response = await trainingRequest(new Request(url, { headers: { authorization: 'Bearer ' + secret } }), ns, secret);
    expect(await response.json()).toEqual({ records: [{ id: 1, receivedAt: at, batch: { capture: 'game' } }] });
    expect(response.headers.get('cache-control')).toBe('no-store');
  } finally {
    db.close();
  }
});

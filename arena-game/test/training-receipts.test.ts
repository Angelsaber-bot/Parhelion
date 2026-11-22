import { afterEach, expect, it, vi } from 'vitest';
import { HumanDemo } from '../src/player/humanDemo.ts';
import { recentTrainingReceipts, trackTrainingUpload } from '../src/network/trainingReceipts.ts';
import { newPlayer } from '../shared/sim.ts';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function storage() {
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    get length() { return data.size; }, key: (i: number) => [...data.keys()][i],
    getItem: (k: string) => data.get(k), setItem: (k: string, v: string) => data.set(k, v),
    removeItem: (k: string) => data.delete(k),
  });
}

it('dates a round from the first recorded input and keeps each rematch separate', () => {
  storage();
  const clock = vi.spyOn(Date, 'now').mockReturnValue(100);
  const demo = new HumanDemo('aster', (batch, began) => {
    expect(batch).not.toHaveProperty('startedAt');
    trackTrainingUpload(batch.capture, batch.map, began, batch.sequence)(202);
  });
  const me = newPlayer('a', 'A', 0);
  const input = { seq: 1, yaw: 0, pitch: 0, buttons: 0, mx: 0, mz: 0, weapon: 0, view: 0 };
  demo.record(me, input, () => Array(18).fill(0));
  clock.mockReturnValue(200);
  demo.beginRound();
  clock.mockReturnValue(300);
  demo.record(me, input, () => Array(18).fill(0));
  clock.mockReturnValue(400);
  demo.pause();
  expect(recentTrainingReceipts().map(r => [r.startedAt, r.acceptedAt])).toEqual([[300, 400], [100, 200]]);
});

it('keeps the latest batch status when responses arrive out of order, and evicts old captures', () => {
  storage();
  const late = trackTrainingUpload('first', 'aster', 100, 0);
  trackTrainingUpload('first', 'aster', 100, 1)(503);
  vi.spyOn(Date, 'now').mockReturnValue(220);
  late(202);
  expect(recentTrainingReceipts()[0]).toMatchObject({ completed: 1, status: 503, acceptedAt: 220 });
  for (let i = 1; i <= 21; i++) trackTrainingUpload(String(i), 'aster', 100 + i, 0);
  late(202);
  const receipts = recentTrainingReceipts();
  expect(receipts).toHaveLength(20);
  expect(receipts[0]).toMatchObject({ capture: '21', acceptedAt: null });
  expect(receipts.some(r => r.capture === 'first')).toBe(false);
});

it('lets gameplay and training proceed when local storage is unavailable', () => {
  vi.stubGlobal('localStorage', undefined);
  expect(() => trackTrainingUpload('a', 'aster', 1, 0)(202)).not.toThrow();
  expect(recentTrainingReceipts()).toEqual([]);
});

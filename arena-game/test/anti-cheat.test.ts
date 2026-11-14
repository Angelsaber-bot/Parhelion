import { afterEach, describe, expect, it, vi } from 'vitest';
import { ArenaTrafficGuard, validOnlineInput } from '../shared/antiCheat.ts';
import { RoomCore } from '../shared/room.ts';
import { RULES_VERSION } from '../shared/protocol.ts';
import { BTN, type Input } from '../shared/sim.ts';
afterEach(() => vi.restoreAllMocks());
const input = (seq = 1): Input => ({ seq, mx: 0, mz: 1, yaw: 0, pitch: 0, buttons: 0, weapon: 0, view: 0 });
function room() {
  const core = new RoomCore({ layout: '1v1' });
  core.join('a', { rulesVersion: RULES_VERSION });
  core.join('b', { rulesVersion: RULES_VERSION });
  return core;
}
describe('online anti-cheat', () => {
  it('rejects forged authority, nonfinite fields and illegal controls', () => {
    for (const change of [{ x: 500 }, { hp: 999 }, { damage: 999 }, { ammo: [999] }, { mx: 100 }, { seq: 1.5 }, { yaw: NaN }, { pitch: Infinity }, { buttons: 256 }, { weapon: 7 }, { view: '0' }]) {
      expect(validOnlineInput({ ...input(), ...change })).toBe(false);
    }
    for (const value of [null, [], 'input', 1]) expect(validOnlineInput(value)).toBe(false);
    expect(validOnlineInput({ ...input(), view: -3.5 })).toBe(true);
  });
  it('allows sustained normal play, jitter bursts, and long idle recovery', () => {
    let now = 0; const guard = new ArenaTrafficGuard(() => now);
    for (let i = 0; i < 1800; i++) {
      now += 1000 / 30;
      expect(guard.message()).toBe(true);
      expect(guard.batch([input(i * 2), input(i * 2 + 1)])).toBe(true);
    }
    now += 1000;
    expect(guard.batch(Array.from({ length: 60 }, (_, i) => input(i)))).toBe(true);
    now += 60000;
    expect(guard.batch([input(4000)])).toBe(true);
    expect(guard.blocked).toBe(false);
  });
  it('bounds message and input floods independently per connection', () => {
    const guard = new ArenaTrafficGuard(() => 0);
    for (let i = 0; i < 180; i++) expect(guard.message()).toBe(true);
    expect(guard.message()).toBe(false);
    expect(guard.blocked).toBe(true);
    const batches = new ArenaTrafficGuard(() => 0);
    const batch = Array.from({ length: 60 }, (_, i) => input(i));
    expect(batches.batch(batch)).toBe(true); expect(batches.batch(batch)).toBe(true);
    for (let i = 0; i < 8; i++) expect(batches.batch(batch)).toBe(false);
    expect(batches.blocked).toBe(true);
    expect(new ArenaTrafficGuard(() => 0).batch([input()])).toBe(true);
  });
  it('rejects the entire malformed batch without applying its valid prefix', () => {
    vi.spyOn(Date, 'now').mockReturnValue(0);
    const core = room();
    for (let i = 0; i < 7; i++) expect(core.input('a', [input(), { ...input(2), hp: 999 }])).toBe(true);
    expect(core.match.slots.get('a')!.queue).toHaveLength(0);
    expect(core.input('a', null)).toBe(false);
    expect(core.input('b', [input()])).toBe(true);
    core.step(); expect(core.match.player('b')!.lastSeq).toBe(1);
  });
  it('replayed inputs cannot move twice or refill ammunition', () => {
    const core = room();
    core.input('a', [{ ...input(), buttons: BTN.FIRE }]); core.step();
    const before = { ...core.match.player('a')!, ammo: [...core.match.player('a')!.ammo] };
    core.input('a', Array.from({ length: 16 }, () => input())); core.step();
    const after = core.match.player('a')!;
    expect(after.x).toBe(before.x); expect(after.z).toBe(before.z);
    expect(after.ammo).toEqual(before.ammo); expect(after.lastSeq).toBe(1);
  });
  it('flooding cannot advance simulation beyond the server tick budget', () => {
    const normal = room(), attacker = room();
    const start = { ...normal.match.player('a')! };
    for (let tick = 0; tick < 60; tick++) {
      normal.input('a', [input(tick + 1)]);
      attacker.input('a', Array.from({ length: 16 }, (_, i) => input(tick * 16 + i + 1)));
      normal.step(); attacker.step();
    }
    const a = normal.match.player('a')!, b = attacker.match.player('a')!;
    expect(Math.hypot(b.x - start.x, b.z - start.z)).toBeLessThanOrEqual(Math.hypot(a.x - start.x, a.z - start.z) + 0.001);
  });
  it('unknown and departed sessions cannot enqueue inputs or request rematches', () => {
    const core = room(); core.leave('a');
    expect(core.input('a', [input()])).toBe(false);
    expect(core.requestRematch('a')).toBe(false);
    expect(core.input('unknown', [input()])).toBe(false);
  });
});

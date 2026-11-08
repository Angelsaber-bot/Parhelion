/** Independent channel authority checks. These do not substitute for actual-input/arena playability. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { RelayChannel, type RelayChannelFrame } from '../src/story/relayChannel';

const valid = (dt = 1 / 120): RelayChannelFrame => ({
  dt, held: true, active: true, playable: true, inRange: true,
  grounded: true, moving: false, attacking: false, damageRevision: 0,
});
const release = (channel: RelayChannel, patch: Partial<RelayChannelFrame> = {}) =>
  channel.update({ ...valid(), ...patch, held: false });

for (const hz of [30, 60, 120]) test(`independent relay: three real active seconds, one completion at ${hz}Hz`, () => {
  const channel = new RelayChannel(), frame = valid(1 / hz);
  for (let i = 0; i < hz * 4; i++) assert.equal(channel.update(frame).completedNow, false, 'entry held key cannot start');
  assert.equal(channel.progress, 0);
  release(channel);
  for (let i = 1; i <= hz * 3; i++) {
    const row = channel.update(frame);
    assert.equal(row.completedNow, i === hz * 3);
    assert.ok(Math.abs(row.progress - i / (hz * 3)) < 1e-8);
  }
  for (let i = 0; i < hz; i++) assert.equal(channel.update(frame).completedNow, false, 'no repeated reward event');
  release(channel); assert.equal(channel.update(frame).completedNow, false);
  channel.reset(); assert.equal(channel.progress, 0); assert.equal(channel.requiresRelease, true);
});

test('independent relay: every cancellation defeats a simultaneous finish and requires release before retry', () => {
  const cases: [Partial<RelayChannelFrame>, string][] = [
    [{ damageRevision: 1 }, 'hurt'], [{ damageRevision: NaN }, 'hurt'],
    [{ active: false }, 'unavailable'], [{ playable: false }, 'unavailable'],
    [{ grounded: false }, 'unavailable'], [{ attacking: true }, 'attack'],
    [{ moving: true }, 'movement'], [{ inRange: false }, 'out-of-range'],
  ];
  for (const [patch, reason] of cases) {
    const channel = new RelayChannel(), frame = valid(.05);
    release(channel);
    for (let i = 0; i < 59; i++) channel.update(frame);
    const interrupted = channel.update({ ...frame, ...patch });
    assert.equal(interrupted.completedNow, false, reason);
    assert.equal(interrupted.interrupted, reason);
    assert.equal(channel.progress, 0);
    const restored = { ...frame, damageRevision: Number.isFinite(patch.damageRevision) ? patch.damageRevision! : 0 };
    for (let i = 0; i < 80; i++) assert.equal(channel.update(restored).completedNow, false, 'held cannot auto-retry');
    release(channel, { damageRevision: restored.damageRevision });
    for (let i = 0; i < 60; i++) assert.equal(channel.update(restored).completedNow, i === 59);
  }
});

test('independent relay: release and attack/movement precedence prevent threshold exploits', () => {
  const channel = new RelayChannel(); release(channel);
  for (let i = 0; i < 59; i++) channel.update(valid(.05));
  assert.equal(release(channel).interrupted, 'released');
  assert.equal(channel.progress, 0);
  channel.update(valid(.05));
  assert.equal(channel.update({ ...valid(.05), moving: true, attacking: true, damageRevision: 1 }).interrupted, 'hurt');
  assert.equal(channel.progress, 0);
});

test('independent relay: invalid and background delta cannot grant completion or poison a later attempt', () => {
  const channel = new RelayChannel(); release(channel);
  for (const dt of [0, -1, NaN, Infinity, -Infinity]) {
    assert.equal(channel.update(valid(dt)).completedNow, false);
    assert.equal(channel.progress, 0);
  }
  assert.equal(channel.update(valid(60)).completedNow, false);
  assert.ok(Math.abs(channel.progress - .05 / 3) < 1e-12);
  channel.reset(12);
  release(channel, { damageRevision: 12 });
  for (let i = 0; i < 60; i++) {
    const result = channel.update({ ...valid(.05), damageRevision: 12 });
    assert.equal(result.completedNow, i === 59, 'reset captures current damage revision, not stale damage');
  }
});

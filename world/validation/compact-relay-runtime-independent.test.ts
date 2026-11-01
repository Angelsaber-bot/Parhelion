/** Hook-level transaction proof, not a synthetic substitute for live enemy/route QA. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createCompactRelayRuntime } from '../src/compactRelayRuntime';
import { COMPACT_RELAY_ENCOUNTER } from '../src/compactRelayEncounter';
import { COMPACT_RELAY as C, getCompactRelayGuide, getCompactRelayState } from '../src/compactRelayCampaign';

function fixture(flags = ['armory_rack']) {
  const done = new Set(flags);
  let encounter: string | null = null, valid = true, reachable = true, damage = 0, saveOk = true;
  let saves = 0, starts = 0, cancels = 0, deployments = 0, choose: ((id: string) => void) | undefined;
  const messages: string[] = [];
  const runtime = createCompactRelayRuntime({ done, reachable: () => reachable, sessionValid: () => valid,
    activeEncounter: () => encounter, startEncounter: () => { starts++; encounter = COMPACT_RELAY_ENCOUNTER; return { ok: true }; },
    cancelEncounter: () => { cancels++; encounter = null; }, save: () => { saves++; return saveOk; }, applyState: () => {},
    toast: line => { messages.push(line[1]); }, choices: (_line, _speaker, _choices, cb) => { choose = cb; }, damageRevision: () => damage, deploy: () => { deployments++; return true; },
  });
  const frame = (held: boolean) => runtime.update({dt: .05, held, playable: true, inRange: true, grounded: true, moving: false, attacking: false});
  return { done, runtime, frame, messages,
    start() { assert.equal(runtime.interact(C.entry), true); assert.ok(choose); choose('start'); assert.equal(runtime.active, true); },
    connect() { frame(false); for (let i = 0; i < 60; i++) frame(true); },
    get choose() { assert.ok(choose); return choose; },
    get counts() { return { saves, starts, cancels }; }, get deployments() { return deployments; },
    set encounter(v: string | null) { encounter = v; }, set valid(v: boolean) { valid = v; },
    set reachable(v: boolean) { reachable = v; }, set damage(v: number) { damage = v; }, set saveOk(v: boolean) { saveOk = v; },
  };
}

test('independent compact runtime: living patrol may withdraw without victory; old progression and replay reward stay exact', () => {
  const f = fixture(['armory_rack', 'relay_b', 'sea_core', 'unrelated_future_flag']);
  const before = [...f.done]; f.start(); f.connect();
  assert.equal(f.runtime.active, false); assert.equal(f.runtime.cleared, false);
  assert.deepEqual([...f.done], [...before, C.complete]);
  assert.deepEqual(f.counts, { saves: 1, starts: 1, cancels: 1 });
  f.start();
  assert.equal(getCompactRelayState(f.done, {active: true}).stage, 'active', 'earned reward cannot hide active replay');
  f.connect(); assert.deepEqual([...f.done], [...before, C.complete]);
  assert.deepEqual(f.counts, { saves: 1, starts: 2, cancels: 2 });
  f.runtime.dispose(); f.runtime.dispose(); assert.equal(f.counts.cancels, 2);
});

test('independent compact runtime: all kills are not completion and cleared session still obeys leash', () => {
  const f = fixture(); f.start(); f.encounter = null;
  assert.equal(f.runtime.victory('wrong_encounter'), false);
  assert.equal(f.runtime.victory(COMPACT_RELAY_ENCOUNTER), true);
  f.frame(false); assert.equal(f.runtime.active, true); assert.equal(f.runtime.cleared, true);
  assert.equal(f.done.has(C.complete), false); assert.equal(f.counts.saves, 0);
  f.valid = false; f.frame(true); assert.equal(f.runtime.active, false); assert.equal(f.done.has(C.complete), false);
  f.valid = true; f.start(); f.encounter = null; f.runtime.victory(COMPACT_RELAY_ENCOUNTER); f.connect();
  assert.equal(f.done.has(C.complete), true); assert.equal(f.counts.saves, 1);
});

test('independent compact runtime: stale choices and reload cannot resurrect a session', () => {
  for (const reason of ['invalidate', 'dispose', 'changed-progress', 'lost-range'] as const) {
    const f = fixture(); f.runtime.interact(C.entry); const callback = f.choose;
    if (reason === 'invalidate') f.runtime.invalidate();
    if (reason === 'dispose') f.runtime.dispose();
    if (reason === 'changed-progress') f.done.add('another_saved_objective');
    if (reason === 'lost-range') f.reachable = false;
    callback('start'); callback('start'); assert.equal(f.counts.starts, 0, reason);
  }
  const f = fixture(); f.start(); f.frame(false); for (let i = 0; i < 50; i++) f.frame(true);
  const restored = fixture([...f.done]); assert.equal(restored.runtime.active, false); assert.equal(restored.runtime.progress, 0);
  assert.equal(restored.done.has(C.complete), false);
  f.runtime.invalidate(); assert.equal(f.counts.cancels, 1);
  assert.equal(f.runtime.victory(COMPACT_RELAY_ENCOUNTER), false);
});

test('independent compact runtime: final physical recheck, failed save, and unarmed old saves are honest', () => {
  const unarmed = fixture(['relay_b', 'sun_core']);
  assert.equal(getCompactRelayGuide(unarmed.done).targetId, 'armory_rack');
  unarmed.runtime.interact(C.entry); assert.equal(unarmed.counts.starts, 0);
  const f = fixture(); f.start(); f.frame(false); for (let i = 0; i < 59; i++) f.frame(true);
  f.reachable = false; f.frame(true); assert.equal(f.done.has(C.complete), false); assert.equal(f.runtime.progress, 0);
  f.reachable = true; f.saveOk = false; f.connect();
  assert.equal(f.done.has(C.complete), true, 'failed storage keeps live progress rather than fabricate a rollback');
  assert.ok(f.messages.some(line => /Not saved/.test(line))); assert.equal(f.counts.saves, 1);
  assert.equal(f.done.has('relay_b'), false); assert.equal(f.done.has('summon_circle'), false);
});


test('independent compact runtime: earned deployment is deliberate and active replay or stale confirmation cannot travel', () => {
  const f = fixture(['armory_rack', 'relay_b']);
  f.runtime.interact(C.deployment); assert.equal(f.deployments, 0);
  f.start(); f.connect(); f.runtime.interact(C.deployment);
  const oldDeploy = f.choose;
  f.start(); oldDeploy('deploy'); assert.equal(f.deployments, 0);
  f.runtime.interact(C.deployment); assert.equal(f.deployments, 0, 'completed replay remains combat');
  f.runtime.invalidate(); f.runtime.interact(C.deployment);
  f.reachable = false; f.choose('deploy'); assert.equal(f.deployments, 0);
  f.reachable = true; f.runtime.interact(C.deployment); f.choose('deploy'); f.choose('deploy');
  assert.equal(f.deployments, 1, 'one physical confirmation, not repeat callback');
  assert.equal(f.done.has('relay_b'), true); assert.equal(f.done.has('summon_circle'), false);
});

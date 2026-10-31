import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createFalseDawnRuntime } from '../src/falseDawnRuntime';
import { FALSE_DAWN, falseDawnEncounterFlags } from '../src/falseDawnCampaign';
import type { Localized } from '../src/settlements/types';

function fixture() {
  const done = new Set<string>([FALSE_DAWN.receiver, 'armory_rack']);
  const messages: Localized[] = [], starts: string[] = [];
  let reachable = true, accepted = true, active: string | null = null, saves = 0, applied = 0, dialogs = 0, canceled = 0, saved = true;
  let selected: ((id: string) => void) | null = null, onStart = () => {};
  const runtime = createFalseDawnRuntime({ done, reachable: () => reachable, activeEncounter: () => active,
    startEncounter(id) { starts.push(id); if (accepted) active = id; onStart(); return { ok: accepted }; },
    cancelEncounter() { active = null; canceled++; }, save() { saves++; return saved; }, applyState() { applied++; },
    dialogue(line) { dialogs++; messages.push(line); }, choices(line, _speaker, _choices, select) { dialogs++; messages.push(line); selected = select; }, toast(line) { messages.push(line); },
  });
  return { runtime, done, messages, starts, get saves() { return saves; }, get applied() { return applied; }, get dialogs() { return dialogs; }, get canceled() { return canceled; },
    get choice() { assert.ok(selected); return selected; }, setReachable(value: boolean) { reachable = value; }, reject() { accepted = false; }, failSave() { saved = false; }, setActive(value: string | null) { active = value; }, onStart(value: () => void) { onStart = value; },
  };
}
test('director rejection cannot write encounter start flags and deliberate acceptance commits before real victory', () => {
  const rejected = fixture(); rejected.reject(); rejected.runtime.interact(FALSE_DAWN.recorder); rejected.choice('start:false_dawn_courier');
  assert.deepEqual([...rejected.done], [FALSE_DAWN.receiver, 'armory_rack']); assert.equal(rejected.saves, 0); assert.equal(rejected.applied, 0);
  const f = fixture(); f.runtime.interact(FALSE_DAWN.recorder); const choice = f.choice; assert.equal(f.saves, 0);
  choice('start:false_dawn_courier'); choice('start:false_dawn_courier');
  assert.deepEqual(f.starts, ['false_dawn_courier']); assert.equal(f.saves, 1); assert.equal(f.applied, 1); assert.equal(f.dialogs, 1, 'starting combat cannot open another pausing dialogue');
  assert.ok(f.done.has(FALSE_DAWN.started)); assert.ok(f.done.has(falseDawnEncounterFlags('false_dawn_courier').started));
  assert.equal(f.runtime.victory('false_dawn_winter_1'), false); assert.equal(f.runtime.victory('unknown'), false);
  assert.equal(f.runtime.victory('false_dawn_courier'), true); assert.ok(f.done.has(falseDawnEncounterFlags('false_dawn_courier').cleared));
  assert.equal(f.runtime.victory('false_dawn_courier'), false); assert.equal(f.saves, 2);
});
test('out-of-range, superseded, reset-invalidated and disposed choices cannot start an encounter', () => {
  for (const mode of ['range', 'new-dialogue', 'reset', 'dispose']) {
    const f = fixture(); f.runtime.interact(FALSE_DAWN.recorder); const old = f.choice;
    if (mode === 'range') f.setReachable(false);
    if (mode === 'new-dialogue') f.runtime.interact(FALSE_DAWN.recorder);
    if (mode === 'reset') { f.done.clear(); f.runtime.invalidate(); }
    if (mode === 'dispose') f.runtime.dispose();
    old('start:false_dawn_courier'); assert.equal(f.starts.length, 0, mode); assert.equal(f.saves, 0, mode);
  }
});
test('synchronous progress changes during admission cancel only the newly accepted stale encounter', () => {
  const f = fixture(); f.runtime.interact(FALSE_DAWN.recorder); f.onStart(() => f.done.clear());
  f.choice('start:false_dawn_courier'); assert.equal(f.canceled, 1); assert.equal(f.saves, 0); assert.equal(f.done.size, 0);
  const newer = fixture(); newer.runtime.interact(FALSE_DAWN.recorder); newer.onStart(() => { newer.done.clear(); newer.setActive('a_newer_encounter'); });
  newer.choice('start:false_dawn_courier'); assert.equal(newer.canceled, 0);
});
test('active physical emitter interactions commit in order using toast only; a save failure is visible', () => {
  const f = fixture();
  for (const flag of [FALSE_DAWN.started, falseDawnEncounterFlags('false_dawn_courier').cleared, FALSE_DAWN.routeHarbor, falseDawnEncounterFlags('false_dawn_harbor').cleared, FALSE_DAWN.harborKey, FALSE_DAWN.arrayStarted]) f.done.add(flag);
  f.setActive('false_dawn_array'); f.failSave();
  assert.equal(f.runtime.interact(FALSE_DAWN.emitters[1]), true); assert.equal(f.done.has(FALSE_DAWN.anchors[1]), false); assert.equal(f.saves, 0);
  assert.equal(f.runtime.interact(FALSE_DAWN.emitters[0]), true); assert.equal(f.done.has(FALSE_DAWN.anchors[0]), true);
  assert.equal(f.saves, 1); assert.equal(f.applied, 1); assert.equal(f.dialogs, 0); assert.match(f.messages.at(-1)![1], /not saved/);
  f.runtime.interact(FALSE_DAWN.emitters[0]); assert.equal(f.saves, 1, 'repeat switch has no repeat completion');
});
test('unreachable or disposed interactions are inert, and unrelated markers remain available to the old campaign', () => {
  const f = fixture(); assert.equal(f.runtime.interact('hq_terminal'), false); assert.equal(f.saves, 0);
  f.setReachable(false); assert.equal(f.runtime.interact(FALSE_DAWN.recorder), false);
  f.runtime.dispose(); f.runtime.dispose(); f.setReachable(true); assert.equal(f.runtime.interact(FALSE_DAWN.recorder), false); assert.equal(f.runtime.victory('false_dawn_courier'), false);
});

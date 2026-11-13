import test from 'node:test';
import assert from 'node:assert/strict';
import { commitFieldAction, fieldActionReady, fieldChapterGuide, createFieldChapters, type FieldChapterSet } from '../src/story/fieldChapters';
import { K04, KINGDOM_K04 } from '../src/story/kingdomBackPassage';
import { WC, WINTER_CHAPTERS } from '../src/story/winterChapters';
import { BC, BLACKSAIL_CHAPTERS } from '../src/story/blacksailChapters';
import { getEraBossRequirements } from '../src/story/eraStories';
import { KINGDOM_GATE } from '../src/story/kingdomGate';
import { WINTER_WITHDRAWAL } from '../src/story/winterWithdrawal';
import { HARBOR_RELIEF } from '../src/story/harborRelief';
import { VALLEY_PROLOGUE } from '../src/story/valleyPrologue';

/** Follow the guide like a player: commit whatever it points at, granting outside milestones when it stalls. */
function walk(set: FieldChapterSet, d: Set<string>, milestones: readonly (readonly [string, readonly string[]])[]) {
  const seen: string[] = [];
  for (let i = 0; i < 300; i++) {
    const next = fieldChapterGuide(set, d);
    if (!next) {
      const grant = milestones.find(([, flags]) => flags.some(f => !d.has(f)));
      if (!grant) break;
      grant[1].forEach(f => d.add(f)); continue;
    }
    assert.ok(commitFieldAction(next, d, set.actions), `${next.id} commits`);
    seen.push(next.id);
  }
  return seen;
}

test('K04 is a full chapter with two real entrances and gates the Vacant King for new runs', () => {
  for (const route of [K04.street, K04.ladder]) {
    const d = new Set(['adventure_v2', KINGDOM_GATE.rescued]);
    if (route === K04.ladder) { commitFieldAction(KINGDOM_K04.set.actions[0], d, KINGDOM_K04.set.actions); commitFieldAction(KINGDOM_K04.set.actions.find(a => a.id === K04.ladder)!, d, KINGDOM_K04.set.actions); }
    const seen = walk(KINGDOM_K04.set, d, []);
    assert.ok(d.has(K04.complete), `${route} route completes (${seen.join(' > ')})`);
    assert.equal(d.has(K04.street) && d.has(K04.ladder), false, 'the two entrances are alternatives, Artoria takes the other');
  }
  const fresh = new Set(['adventure_v2', KINGDOM_GATE.rescued]);
  assert.ok(getEraBossRequirements('sun_core', fresh)!.includes(K04.complete));
  // A save already past the hall before K04 existed keeps its old route unless it starts K04.
  const legacy = new Set(['adventure_v2', KINGDOM_GATE.rescued, 'hall_brazier_1']);
  assert.ok(!getEraBossRequirements('sun_core', legacy)!.includes(K04.complete));
  legacy.add(K04.overlook);
  assert.ok(getEraBossRequirements('sun_core', legacy)!.includes(K04.complete));
});

test('Winter W01–W05 run in order, W08 hands over the key, and the last square needs both', () => {
  const d = new Set(['adventure_v2', VALLEY_PROLOGUE.room]);
  const seen = walk(WINTER_CHAPTERS.set, d, [['napoleon_meet', ['napoleon_meet']], ['withdrawal', [WINTER_WITHDRAWAL.redoubt, WINTER_WITHDRAWAL.retreat]]]);
  for (const flag of [WC.w01, WC.w02, WC.sent, WC.w03, WC.w04, WC.w05, WC.key]) assert.ok(d.has(flag), `${flag} (${seen.join(' > ')})`);
  assert.ok(seen.indexOf(WC.w01.replace('_complete', '_camp')) < seen.indexOf(WC.scope), 'W01 before W02');
  assert.ok(seen.indexOf(WC.yard) < seen.indexOf(WC.seal), 'W04 before W05');
  assert.ok(!d.has(WC.broke), 'the guide keeps the field gun sealed');
  const fresh = new Set(['adventure_v2']);
  assert.deepEqual(getEraBossRequirements('winter_core', fresh)!.filter(f => f === WC.w05 || f === WC.key), [WC.w05, WC.key]);
  const legacy = new Set(['adventure_v2', WINTER_WITHDRAWAL.retreat]);
  assert.ok(!getEraBossRequirements('winter_core', legacy)!.includes(WC.w05));
  // After the square: the optional pole is offered, nothing is required.
  const after = new Set([...d, 'winter_core']);
  assert.ok(fieldActionReady(WINTER_CHAPTERS.set.actions.find(a => a.id === WC.pole)!, after, WINTER_CHAPTERS.set.actions));
});

test('Breaking the W05 seal is a real alternative that closes the front gate', () => {
  const acts = WINTER_CHAPTERS.set.actions, d = new Set(['adventure_v2', WC.w04, WC.seal, WC.crate, WC.stretcher]);
  assert.ok(commitFieldAction(acts.find(a => a.id === WC.unseal)!, d, acts));
  assert.ok(d.has(WC.broke));
  assert.equal(fieldActionReady(acts.find(a => a.id === WC.shadows)!, d, acts), false);
  assert.ok(fieldActionReady(acts.find(a => a.id === WC.order)!, d, acts));
});

test('Black Sail B01–B03 precede the relief run; B05–B08 precede Meyrick; B09 follows him', () => {
  const d = new Set(['adventure_v2', VALLEY_PROLOGUE.room]);
  const seen = walk(BLACKSAIL_CHAPTERS.set, d, [
    ['relief', [HARBOR_RELIEF.reserve, HARBOR_RELIEF.delivered]],
    ['meyrick', ['sea_core']],
    ['plan', ['map_flagship_shared_pilot']],
  ]);
  for (const flag of [BC.b01, BC.b02, BC.b03, BC.b05, BC.b06, BC.b07, BC.boarded, BC.b08, BC.b09]) assert.ok(d.has(flag), `${flag} (${seen.join(' > ')})`);
  assert.ok(seen.indexOf(BC.plan) < seen.indexOf(BC.start), 'B03 plan before the heist');
  assert.ok(d.has(BC.cast) && !d.has(BC.sign), 'the shared-pilot ending casts off the last line');
  const fresh = new Set(['adventure_v2', VALLEY_PROLOGUE.room]);
  const req = getEraBossRequirements('sea_core', fresh)!;
  assert.ok(req.includes(BC.b07) && req.includes(BC.boarded));
  const legacy = new Set(['adventure_v2', 'adventure_harbor_records']);
  assert.ok(!getEraBossRequirements('sea_core', legacy)!.includes(BC.b07));
});

test('B03 routes stay switchable until the heist starts', () => {
  const acts = BLACKSAIL_CHAPTERS.set.actions, d = new Set(['adventure_v2', BC.b02, BC.watch, BC.chest]);
  const pick = (id: string) => assert.ok(commitFieldAction(acts.find(a => a.id === id)!, d, acts), id);
  pick(BC.inspect); pick(BC.storm);
  assert.ok(d.has(BC.storm) && !d.has(BC.inspect));
  pick(BC.plan); d.add(HARBOR_RELIEF.reserve); d.add(HARBOR_RELIEF.delivered); pick(BC.start);
  assert.equal(fieldActionReady(acts.find(a => a.id === BC.inspect)!, d, acts), false, 'locked once the heist starts');
});

test('runtime: fights only count their own victory, failed saves roll back, work needs presence', () => {
  const done = new Set(['adventure_v2', KINGDOM_GATE.rescued, K04.overlook]);
  let ok = true, started = '';
  const at: Record<string, [number, number, number]> = { [K04.street]: [0, 1, 0], [K04.winch]: [20, 1, 0] };
  const rt = createFieldChapters({ done, sets: [KINGDOM_K04.set], save: () => ok, changed() {}, toast() {}, reachable: () => true,
    position: id => at[id], start: spec => { started = spec.id; return true; } });
  rt.interact(K04.street);
  assert.equal(started, 'chapter_k04_street_fight');
  assert.equal(rt.victory('chapter_k04_abbey_fight'), true); assert.ok(!done.has(K04.street));
  ok = false; rt.victory(started); assert.ok(!done.has(K04.street), 'rolled back on a failed save');
  ok = true; rt.interact(K04.street); rt.victory(started); assert.ok(done.has(K04.street));
  rt.interact(K04.winch);
  for (let i = 0; i < 200; i++) rt.update(.1, true, [60, 1, 0]);
  assert.ok(!done.has(K04.winch), 'no progress from 40 m away');
  for (let i = 0; i < 80; i++) rt.update(.1, true, [20, 1, 1]);
  assert.ok(done.has(K04.winch), 'six seconds on site finish the winch');
});

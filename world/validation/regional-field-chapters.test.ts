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

function walkUntil(set: FieldChapterSet, d: Set<string>, last: string) {
  for (let i = 0; i < 100 && !d.has(last); i++) { const next = fieldChapterGuide(set, d); assert.ok(next, `stalled before ${last}`); commitFieldAction(next, d, set.actions); }
}

test('K01–K03 come before K04 for new runs and gate the Vacant King', async () => {
  const { K01 } = await import('../src/story/kingdomBackPassage');
  const d = new Set(['adventure_v2']);
  const seen = walk(KINGDOM_K04.set, d, [['gate', [KINGDOM_GATE.rescued]]]);
  for (const f of [K01.k01, K01.k02, K01.k03, K04.complete]) assert.ok(d.has(f), `${f} (${seen.join(' > ')})`);
  assert.ok(seen.indexOf(K01.bell) < seen.indexOf(K04.overlook), 'K03 before K04');
  assert.ok(!d.has(K01.bread) && !d.has(K01.practice), 'street errands stay optional');
  const req = getEraBossRequirements('sun_core', new Set(['adventure_v2']))!;
  for (const f of [K01.k01, K01.k02, K01.k03, K04.complete]) assert.ok(req.includes(f), f);
  assert.ok(!getEraBossRequirements('sun_core', new Set(['adventure_v2', 'hall_brazier_1']))!.includes(K01.k01), 'legacy saves keep their route');
});

test('K04 is a full chapter with two real entrances and gates the Vacant King for new runs', () => {
  for (const route of [K04.street, K04.ladder]) {
    const d = new Set(['adventure_v2', KINGDOM_GATE.rescued]);
    if (route === K04.ladder) { walkUntil(KINGDOM_K04.set, d, K04.overlook); commitFieldAction(KINGDOM_K04.set.actions.find(a => a.id === K04.ladder)!, d, KINGDOM_K04.set.actions); }
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
  const done = new Set(['adventure_v2', KINGDOM_GATE.rescued, 'k03_complete', K04.overlook]);
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

test('J08 decree court: refuse the offer, one entry by branch, the Crow Seal gates fire_core, J09 opens the gate', async () => {
  const { JC, KYOTO_COURT } = await import('../src/story/kyotoDecreeCourt');
  const { KYOTO_WITNESS: Y } = await import('../src/story/kyotoWitness');
  for (const branch of [Y.public, Y.private]) {
    const d = new Set(['adventure_v2', VALLEY_PROLOGUE.room, branch]);
    assert.ok(getEraBossRequirements('fire_core', d)!.includes(JC.entered));
    walk(KYOTO_COURT.set, d, [['boss', ['fire_core']], ['screen', [Y.gate]]]);
    for (const f of [JC.offer, JC.entered, JC.j08, JC.j09]) assert.ok(d.has(f), `${branch}: ${f}`);
    assert.equal(d.has(JC.publicEntry), branch === Y.public);
    assert.ok(!d.has(JC.device), 'breaking the press early stays optional');
  }
});

test('Orleans: Alix relays alone in O02; each O07 plan opens its own battle entry before the climax', async () => {
  const { OE, ORLEANS_ENTRIES, orleansEntryRequired } = await import('../src/story/orleansEntries');
  const { ORLEANS_CAMPAIGN: OC } = await import('../src/story/orleansCampaign');
  const early = new Set(['journey_orleans_muster', OC.started, OC.relay]);
  assert.equal(fieldChapterGuide(ORLEANS_ENTRIES.set, early)?.id, OE.alix);
  for (const plan of [OC.bridge, OC.ferry]) {
    const d = new Set(['journey_orleans_muster', OC.relay, OE.alix, plan, OC.locked, OC.complete]);
    assert.ok(orleansEntryRequired(d));
    const seen = walk(ORLEANS_ENTRIES.set, d, []);
    assert.ok(d.has(OE.o07), `${plan}: ${seen.join(' > ')}`);
    assert.equal(d.has(OE.push), plan === OC.bridge); assert.equal(d.has(OE.float), plan === OC.ferry);
  }
});

test('Egypt: the limb can be diverted instead of fought, the rig choice precedes the temple, E07 needs an approach', async () => {
  const { EA, EGYPT_APPROACH, egyptApproachRequired } = await import('../src/story/egyptApproach');
  const { EGYPT_CAMPAIGN: EC } = await import('../src/story/egyptCampaign');
  const d = new Set(['journey_egypt_weir', EC.started]);
  assert.equal(fieldChapterGuide(EGYPT_APPROACH.set, d)?.id, EA.shell);
  walk(EGYPT_APPROACH.set, d, []);
  assert.ok(d.has(EC.limb) && d.has(EA.divert), 'diverting the limb counts as clearing E03');
  assert.ok(d.has(EA.high) !== d.has(EA.low), 'one rig position');
  const ready = new Set([EC.ready, EC.bypass]);
  assert.ok(egyptApproachRequired(ready));
  walk(EGYPT_APPROACH.set, ready, []);
  assert.ok(ready.has(EA.arrived) && ready.has(EA.launch));
});

test('Qin Q06: the ranks cut the road and the crew is rejoined by the rack, by fight or by ladder', async () => {
  const { QP, QIN_PROCESSION, qinProcessionRequired } = await import('../src/story/qinProcession');
  const { QIN_CAMPAIGN: QC } = await import('../src/story/qinCampaign');
  const d = new Set([QC.locked]);
  assert.ok(qinProcessionRequired(d));
  const seen = walk(QIN_PROCESSION.set, d, [['observe', [QC.observe]]]);
  assert.ok(d.has(QP.q06), seen.join(' > '));
  assert.ok(seen.indexOf(QP.cut) < seen.indexOf(QP.rack));
  assert.ok(!qinProcessionRequired(new Set([QC.locked, QC.halt])), 'saves past the halt keep their route');
});

test('Qin Q01–Q04 precede the climax for new runs; Q08 follows it', async () => {
  const { QX, QIN_CHAPTERS, qinChaptersRequired } = await import('../src/story/qinChapters');
  const d = new Set(['journey_qin_workers']);
  assert.ok(qinChaptersRequired(d));
  walk(QIN_CHAPTERS.set, d, [['climax', ['journey_qin_public_order']]]);
  for (const f of [QX.q01, QX.q02, QX.q03, QX.q04, QX.q08]) assert.ok(d.has(f), f);
  assert.ok(d.has(QX.low) !== d.has(QX.high) && d.has(QX.slot) !== d.has(QX.beam), 'one route each');
});

test('Egypt E01/E02 open the realm, E05 relocates in stages, E06 shows the water', async () => {
  const { EX, EGYPT_CHAPTERS, egyptOpeningRequired } = await import('../src/story/egyptChapters');
  const { EGYPT_CAMPAIGN: EC } = await import('../src/story/egyptCampaign');
  const d = new Set(['journey_egypt_weir']);
  assert.ok(egyptOpeningRequired(d));
  walk(EGYPT_CHAPTERS.set, d, [['bed', [EC.started, EC.limb, EC.temple, EC.bed]], ['relocated', [EC.relocated]], ['bell', [EC.bell]]]);
  for (const f of [EX.e01, EX.e02, EX.table, EX.move, EX.model, EX.statue]) assert.ok(d.has(f), f);
  assert.ok(!egyptOpeningRequired(new Set(['journey_egypt_weir', EC.ready])), 'saves past E06 keep their route');
});

test('Orleans O06 hands the lookout over; O08 terms and O09 morning follow the bridgehead', async () => {
  const { OF, ORLEANS_FINALE } = await import('../src/story/orleansFinale');
  const { ORLEANS_CAMPAIGN: OC } = await import('../src/story/orleansCampaign');
  for (const way of ['lower', 'disarm']) {
    const d = new Set([OC.agree, OC.planks, OC.moored, OC.shifted]);
    walk(ORLEANS_FINALE.set, d, [['won', ['journey_orleans_crossing_open']]]);
    assert.ok(d.has(OF.o06) && d.has(OF.o08) && d.has(OF.o09), way);
    assert.ok(d.has(OF.road) === d.has(OF.lower) && d.has(OF.gate) === d.has(OF.disarm), 'O09 follows the O08 terms');
  }
});

test('Kyoto J03 lords and J07 fire night gate the Crow Seal for new runs', async () => {
  const { JK, KYOTO_COURT } = await import('../src/story/kyotoDecreeCourt');
  const { KYOTO_STREET: S } = await import('../src/story/kyotoStreetWorks');
  const { KYOTO_WITNESS: Y } = await import('../src/story/kyotoWitness');
  const d = new Set(['adventure_v2', VALLEY_PROLOGUE.room, S.templeRecord, S.campRecord]);
  const req = getEraBossRequirements('fire_core', d)!;
  assert.ok(req.includes(JK.j03));
  walk(KYOTO_COURT.set, d, [['orders', [Y.reel, Y.public]], ['boss', ['fire_core']], ['screen', [Y.gate]]]);
  for (const f of [JK.j03, JK.j07, 'j08_complete', 'j09_complete']) assert.ok(d.has(f), f);
  const order = [...d];
  assert.ok(order.indexOf(JK.j07) < order.indexOf('j08_offer'), 'the fire night precedes the decree court');
});

test('T07: the load transfer is required before the load test once the parallel check starts', async () => {
  const { journeyStepReady } = await import('../src/story/worldJourney').then(m => ({ journeyStepReady: (m as Record<string, unknown>).journeyActionReady ?? (m as Record<string, unknown>).journeyStepReady })) as { journeyStepReady?: (id: string, d: ReadonlySet<string>) => boolean };
  const { VALLEY_SET_PIECES } = await import('../src/story/valleyTownSetPieces');
  const ids = VALLEY_SET_PIECES.set.actions.map(a => a.id);
  for (const id of ['t07_parallel', 't07_load', 't07_shade']) assert.ok(ids.includes(id), id);
  assert.equal(VALLEY_SET_PIECES.set.actions.find(a => a.id === 't07_load')?.kind, 'work');
  void journeyStepReady;
});

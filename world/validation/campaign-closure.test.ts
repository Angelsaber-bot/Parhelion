import test from 'node:test';
import assert from 'node:assert/strict';
import { CAMPAIGN_CLOSURE as C, getCampaignClosureState as state, getCampaignClosureGuide as guide, interactCampaignClosure as act, getCampaignResidentReaction } from '../src/campaignClosure';
import { ERA_IDS, ERA_STORIES } from '../src/eraStories';

const cores = ERA_IDS.map(region => ERA_STORIES[region].core);
test('four world resolutions unlock only an optional Alpha-local closing record', () => {
  const done = new Set([C.terminal]);
  for (const [i, core] of cores.entries()) {
    assert.equal(state(done).resolved, i);
    assert.equal(guide('alpha', done), null);
    done.add(core);
  }
  assert.equal(state(done).stage, 'ready');
  assert.equal(guide('alpha', done)?.targetId, C.terminal);
  for (const region of ERA_IDS) assert.equal(guide(region, done), null, 'never force a long cross-region return');
  assert.equal(done.has(C.recorded), false);
  assert.ok(getCampaignResidentReaction(C.archivist, done)?.every(line => line.length > 10));
});

test('closing record changes one bounded flag, preserves contracts/companions and supports repetition', () => {
  const done = new Set([C.terminal, ...cores, 'saber_contract', 'blackbeard_contract', 'unrelated_user_flag']);
  const before = [...done];
  const result = act(C.terminal, done);
  assert.equal(result.changed, true); assert.equal(result.state.stage, 'recorded');
  assert.ok(result.dialogue?.every(line => line.length > 50));
  assert.deepEqual([...done], [...before, C.recorded]);
  assert.equal(guide('alpha', done), null);
  assert.equal(act(C.terminal, done).changed, false);
  assert.equal(state(done).outstandingContracts.includes('napoleon_contract'), true);
  assert.equal(state(done).outstandingContracts.includes('musashi_contract'), true);
  assert.match(getCampaignResidentReaction(C.steward, done)![1], /unfinished promises/);
});

test('legacy post-core contracts are valid evidence but opening Saber pact is not', () => {
  const done = new Set(['hq_terminal', 'saber_contract', 'blackbeard_contract', 'napoleon_contract', 'musashi_contract']);
  assert.equal(state(done).resolved, 3); assert.equal(state(done).stage, 'journey');
  assert.equal(act(C.terminal, done).handled, false);
  done.add('sun_core');
  assert.equal(state(done).stage, 'ready');
  assert.equal(act(C.terminal, done).changed, true);
  assert.equal(done.has('sea_core'), false, 'no fabricated progress migration');
});

test('original terminal first activation and Valley introduction retain ownership', () => {
  const done = new Set(cores);
  assert.equal(guide('alpha', done), null);
  assert.equal(act(C.terminal, done).handled, false);
  assert.equal(done.has(C.terminal), false);
  for (const id of ['', C.archivist, 'valley_route_note', 'sun_core']) assert.equal(act(id, done).handled, false);
  done.add(C.terminal);
  assert.equal(act(C.terminal, done).handled, true);
  done.clear();
  assert.equal(state(done).stage, 'journey'); assert.equal(getCampaignResidentReaction(C.archivist, done), null);
  assert.equal(getCampaignResidentReaction('unknown', done), null);
});

test('saved closing record remains authoritative without granting missing cores', () => {
  const done = new Set([C.recorded, C.terminal]);
  assert.equal(state(done).stage, 'recorded'); assert.equal(state(done).resolved, 0);
  assert.equal(act(C.terminal, done).changed, false);
  assert.equal(done.size, 2);
});

test('closing record never claims unperformed optional restorations; each earned echo is conditional', async () => {
  const { getCampaignClosingText } = await import('../src/campaignClosure');
  const { ERA_OPTIONALS, ERA_KNIGHT_DEFEATED } = await import('../src/eraStories');
  const done = new Set(cores);
  const bare = getCampaignClosingText(done)[1];
  assert.doesNotMatch(bare, /memorial is readable|signal still guides|stove you lit|lanterns you restored|trial is recorded/);
  assert.match(bare, /unfinished restorations/);
  const phrases = { britain: 'memorial is readable', blacksail: 'signal still guides', winter: 'stove you lit', kyoto: 'lanterns you restored' };
  for (const region of ERA_IDS) {
    const one = new Set([...done, ERA_OPTIONALS[region].id]);
    const line = getCampaignClosingText(one)[1];
    for (const other of ERA_IDS) assert.equal(line.includes(phrases[other]), other === region);
  }
  assert.match(getCampaignClosingText(new Set([...done, ERA_KNIGHT_DEFEATED]))[1], /trial is recorded/);
});

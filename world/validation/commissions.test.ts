import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CAMPS, TRIALS, flagChest, totalCrystals, CHESTS } from '../src/exploration/catalog.ts';
import {
  COMMISSION, dailyCommissions, dayKey, flagCommission, flagCommissionBonus, flagHuntKill, huntProgress, reachedRegions, todaysBoard,
} from '../src/exploration/commissions.ts';

const ALL = ['alpha', 'britain', 'blacksail', 'winter', 'kyoto'] as const;

test('a day of commissions: four, deterministic, spread over four regions once the player has travelled', () => {
  const a = dailyCommissions('20261104', ALL), b = dailyCommissions('20261104', ALL);
  assert.deepEqual(a, b);
  assert.equal(a.length, COMMISSION.perDay);
  assert.deepEqual(a.map(c => c.kind).sort(), ['camp', 'camp', 'hunt', 'trial']);
  assert.equal(new Set(a.map(c => c.region)).size, 4, 'no region gets two commissions while others sit empty');
  for (const c of a) {
    if (c.kind === 'camp') { const camp = CAMPS.find(x => x.id === c.target)!; assert.equal(camp.style ?? 'camp', 'camp'); assert.ok(!camp.requires); assert.deepEqual(c.at, camp.anchor); }
    if (c.kind === 'trial') assert.ok(TRIALS.some(t => t.id === c.target));
    if (c.kind === 'hunt') assert.equal(c.at, undefined);
  }
  // across a month the board actually turns over
  const boards = new Set(Array.from({ length: 30 }, (_, i) => dailyCommissions(`202611${String(i + 1).padStart(2, '0')}`, ALL).map(c => c.target).join()));
  assert.ok(boards.size > 20);
});

test('a fresh save only gets commissions in the valley', () => {
  assert.deepEqual(reachedRegions(new Set()), ['alpha']);
  const list = dailyCommissions('20261104', ['alpha']);
  assert.equal(list.length, COMMISSION.perDay);
  assert.ok(list.every(c => c.region === 'alpha'));
  const sites = list.filter(c => c.kind !== 'hunt').map(c => c.target);
  assert.equal(new Set(sites).size, sites.length, 'never the same outpost or echo twice');
});

test('looking at the board writes nothing; yesterday\'s half-finished hunts are dropped', () => {
  const done = new Set<string>();
  const first = todaysBoard(done, '20261104');
  assert.equal(done.size, 0, 'a new game stays empty until the player completes something');
  assert.ok(first.list.every(c => c.region === 'alpha'));
  const hunt = first.list.find(c => c.kind === 'hunt')!;
  done.add(flagHuntKill('20261104', hunt.n, 0)); done.add(flagHuntKill('20261104', hunt.n, 1));
  assert.equal(huntProgress(done, '20261104', hunt.n), 2);
  assert.deepEqual(todaysBoard(done, '20261104').list, first.list);
  assert.equal(huntProgress(done, '20261104', hunt.n), 2, 'the same day keeps hunt progress');
  // reaching Britain brings it onto the next board; completed commissions keep paying
  done.add(flagChest(CHESTS.find(c => c.region === 'britain')!.id));
  done.add(flagCommission('20261104', 0));
  const next = todaysBoard(done, '20261105');
  assert.ok(next.list.some(c => c.region === 'britain'));
  assert.ok(![...done].some(f => f.startsWith('xp_commkill_')));
  assert.ok(done.has(flagCommission('20261104', 0)));
});

test('commissions pay crystals toward resonance, with a bonus for the full board', () => {
  const done = new Set<string>();
  const base = totalCrystals(done);
  for (let n = 0; n < COMMISSION.perDay; n++) done.add(flagCommission('20261104', n));
  done.add(flagCommissionBonus('20261104'));
  done.add(flagHuntKill('20261105', 3, 0));
  assert.equal(totalCrystals(done) - base, COMMISSION.perDay * COMMISSION.crystals + COMMISSION.bonus);
});

test('dayKey is the local calendar day', () => {
  assert.equal(dayKey(new Date(2026, 0, 9, 23, 59)), '20260109');
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CAMPS, CHESTS, flagCamp } from '../src/exploration/catalog.ts';
import { dailyCommissions } from '../src/exploration/commissions.ts';
import { explorationMapIcons } from '../src/exploration/mapIcons.ts';

const road = CAMPS.filter(c => c.style === 'vanguard');

test('the road to Camlann: three story fights in order, from the hearth towards the Sun Core', () => {
  assert.deepEqual(road.map(c => c.id), ['vanguard_first_line', 'vanguard_broken_banner', 'vanguard_throne_guard']);
  assert.equal(road[0].requires, 'hall_brazier_1');
  road.slice(1).forEach((c, i) => assert.equal(c.requires, flagCamp(road[i].id)));
  // each stop is further south, the last on the approach to the Sun Core (world -926, 212)
  road.slice(1).forEach((c, i) => assert.ok(c.anchor[1] > road[i].anchor[1]));
  assert.ok(Math.hypot(road[2].anchor[0] + 926, road[2].anchor[1] - 212) < 120, 'the last stand is the approach to the Sun Core');
  for (const c of road) {
    assert.ok(c.lines && c.lines.start[0].startsWith('Saber') && c.lines.end[1].startsWith('Saber'), c.id);
    for (const a of c.waves.flat()) assert.ok(Math.hypot(...a.offset) <= 7.6, `${c.id} socket stays on the cleared footing`);
  }
  const last = road[2].waves.at(-1)!;
  assert.equal(last.filter(a => a.pattern === 'echo-warden').length, 1);
  assert.equal(last.find(a => a.pattern)!.role, 'shieldbearer', 'the last stand turns the Britain signature on');
  assert.ok(CHESTS.some(c => c.requires === flagCamp(road[2].id) && c.tier === 'precious'));
});

test('the road stays off the map and off the commission board until it opens', () => {
  const ids = (done: Set<string>) => explorationMapIcons(done).filter(i => i.id.startsWith('camp:vanguard')).map(i => i.id);
  assert.deepEqual(ids(new Set()), []);
  assert.deepEqual(ids(new Set(['hall_brazier_1'])), ['camp:vanguard_first_line']);
  assert.equal(ids(new Set(['hall_brazier_1', flagCamp('vanguard_first_line'), flagCamp('vanguard_broken_banner')])).length, 3);
  for (let d = 1; d <= 28; d++) assert.ok(!dailyCommissions(`202611${String(d).padStart(2, '0')}`, ['alpha', 'britain']).some(c => c.target.startsWith('vanguard')));
});

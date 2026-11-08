import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BOSSES } from '../src/combat/combat.ts';
import { BOSS_TITLES, titleLines } from '../src/combat/bossTitleCard.ts';
import { BOSS_HAZARDS } from '../src/combat/bossHazards.ts';

test('every era boss has a rise, act and fall card; the act card names its arena mechanic', () => {
  assert.deepEqual(Object.keys(BOSS_TITLES).sort(), BOSSES.map(b => b.id).sort());
  for (const b of BOSSES) {
    for (const moment of ['rise', 'act', 'fall'] as const) {
      const lines = titleLines(b.id, moment)!;
      for (const line of [lines.top, lines.name, lines.sub]) assert.ok(line[0] && line[1], `${b.id} ${moment}`);
    }
    assert.ok(titleLines(b.id, 'act')!.name[0].includes(BOSS_HAZARDS[b.id].name[0]), `${b.id} act card matches its mechanic`);
  }
  assert.equal(new Set(BOSSES.map(b => BOSS_TITLES[b.id].epithet[0])).size, BOSSES.length);
  assert.equal(titleLines('wild_1', 'rise'), null);
});

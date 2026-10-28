// New bot vs the previous baseline bot, 1v1 on both maps. Run: npx tsx test/bench/duel.ts
import { getMap } from '../../shared/arenaMap.ts';
import { Bot, BOT_SKILL } from '../../shared/bot.ts';
import { TICK_HZ } from '../../shared/content.ts';
import { Match } from '../../shared/match.ts';
import { Bot as OldBot, BOT_SKILL as OLD } from './botBaseline.ts';
for (const map of ['aster', 'sakura']) for (const lvl of ['easy', 'normal', 'hard'] as const) {
  let a = 0, b = 0;
  for (let i = 0; i < 8; i++) {
    const m = new Match(getMap(map), '1v1');
    m.addPlayer('new', { name: 'new', team: i % 2 ? 'A' : 'B', char: 0, skins: [0, 0, 0], bot: true }, new Bot(i + 1, BOT_SKILL[lvl]));
    m.addPlayer('old', { name: 'old', team: i % 2 ? 'B' : 'A', char: 0, skins: [0, 0, 0], bot: true }, new OldBot(i + 50, OLD.normal) as never);
    for (let t = 0; t < 120 * TICK_HZ; t++) m.step();
    const s = m.snapshot().players;
    a += s.find((p) => p.id === 'new')!.kills; b += s.find((p) => p.id === 'old')!.kills;
  }
  console.log(map, 'new', lvl.padEnd(6), 'vs old normal  kills', a, ':', b);
}

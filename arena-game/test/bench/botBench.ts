// Difficulty benchmark (not part of npm test): how long each bot skill needs to kill a target
// that strafes like a casual human at 12 m and 25 m, and its hit rate. Run: npx tsx test/bench/botBench.ts
import { getMap } from '../../shared/arenaMap.ts';
import { Bot, BOT_SKILL } from '../../shared/bot.ts';
import { TICK_HZ } from '../../shared/content.ts';
import { Match, type Controller } from '../../shared/match.ts';
import type { Input } from '../../shared/sim.ts';

class Strafer implements Controller {
  seq = 0; dir = 1; t = 0;
  constructor(private seed: number, private still = false) {}
  think(match: Match, id: string): Input {
    const me = match.player(id)!;
    if (--this.t <= 0) { this.seed = (this.seed * 16807) % 2147483647; this.dir = -this.dir; this.t = 25 + (this.seed % 40); }
    return { seq: ++this.seq, mx: this.still ? 0 : this.dir, mz: 0, yaw: me.yaw, pitch: 0, buttons: 0, weapon: 0, view: match.tick };
  }
}

const m = getMap('aster');
for (const [skill, s] of Object.entries(BOT_SKILL)) {
  for (const dist of [12, 25]) {
    for (const still of [false, true]) {
      let total = 0, n = 0, timeouts = 0;
      for (let trial = 0; trial < 30; trial++) {
        const match = new Match(m, '1v1');
        const bot = new Bot(trial + 1, s);
        match.addPlayer('bot', { name: 'bot', team: 'A', char: 0, skins: [0, 0, 0], bot: true }, bot);
        match.addPlayer('tgt', { name: 'tgt', team: 'B', char: 0, skins: [0, 0, 0], bot: true }, new Strafer(trial + 7, still));
        for (let k = 0; k < 20 * TICK_HZ && (match as unknown as { phase: string }).phase !== 'live'; k++) match.step();
        const b = match.player('bot')!, t = match.player('tgt')!;
        Object.assign(b, { x: -dist / 2, y: 0, z: 24, yaw: -Math.PI / 2 + 0.6 });
        Object.assign(bot as unknown as { yaw: number }, { yaw: -Math.PI / 2 + 0.6 }); // spotted, not yet aimed
        Object.assign(t, { x: dist / 2, y: 0, z: 24, yaw: Math.PI / 2 });
        let killed = -1;
        for (let k = 0; k < 15 * TICK_HZ; k++) {
          match.step();
          if (!match.player('tgt')!.alive || match.snapshot().players.find((p) => p.id === 'bot')!.kills > 0) { killed = k; break; }
        }
        if (killed < 0) timeouts++; else { total += killed / TICK_HZ; n++; }
      }
      console.log(`${skill.padEnd(6)} ${String(dist).padStart(2)} m ${still ? 'still ' : 'strafe'}  mean TTK ${(n ? total / n : NaN).toFixed(2)} s  timeouts ${timeouts}/30`);
    }
  }
}

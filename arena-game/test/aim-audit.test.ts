import { expect, it } from 'vitest';
import { AimAudit } from '../shared/aimAudit.ts';
import { ARENA_MAP } from '../shared/arenaMap.ts';
import { Match } from '../shared/match.ts';
import { playerHitbox } from '../shared/hit.ts';
import type { Input, SimEvent } from '../shared/sim.ts';
it('records repeated precise snap-and-fire evidence without changing gameplay or issuing a ban', () => {
  const audit = new AimAudit(), match = new Match({ ...ARENA_MAP, solids: [] }, '1v1');
  for (const [id, team, z] of [['a', 'A', 0], ['b', 'B', -10]] as const) {
    match.addPlayer(id, { name: id, team, char: 0, skins: [], bot: false });
    Object.assign(match.player(id)!, { x: 0, y: 0, z });
  }
  match.phase = 'live';
  const p = match.player('a')!;
  let seq = 0;
  const sample = (yaw: number, fire: boolean) => {
    match.tick++;
    const input: Input = { seq: ++seq, mx: 0, mz: 0, yaw, pitch: 0, buttons: fire ? 1 : 0, weapon: 0, view: match.tick };
    const events: SimEvent[] = fire ? [{ type: 'fire', weapon: 0, origin: [0, playerHitbox().headY, 0], dirs: [[0, 0, -1]], view: match.tick, seq }] : [];
    audit.observe(match, p, input, events);
  };
  sample(.8, false); sample(0, true); expect(audit.drain()).toEqual([]); // one good flick is not a verdict
  for (let i = 0; i < 5; i++) { sample(.8, false); sample(0, true); }
  const reports = audit.drain(); expect(reports).toHaveLength(1);
  expect(reports[0].automaticBan).toBe(false); expect(reports[0].evidence).toHaveLength(6);
  expect(match.slots.size).toBe(2); expect(match.player('b')!.hp).toBe(150);
  audit.leave('a'); sample(.8, false); sample(0, true); expect(audit.drain()).toEqual([]);
});
it('ordinary steady aim and high accuracy alone generate no report', () => {
  const audit = new AimAudit(), match = new Match({ ...ARENA_MAP, solids: [] }, '1v1');
  match.addPlayer('a', { name: 'a', team: 'A', char: 0, skins: [], bot: false });
  match.addPlayer('b', { name: 'b', team: 'B', char: 0, skins: [], bot: false });
  Object.assign(match.player('a')!, { x: 0, y: 0, z: 0 });
  Object.assign(match.player('b')!, { x: 0, y: 0, z: -10 });
  match.phase = 'live';
  for (let seq = 1; seq < 100; seq++) {
    match.tick++;
    audit.observe(match, match.player('a')!, { seq, mx: 0, mz: 0, yaw: 0, pitch: 0, buttons: 1, weapon: 0, view: 0 }, [{ type: 'fire', seq, weapon: 0, origin: [0, 1.6, 0], dirs: [[0, 0, -1]], view: 0 }]);
  }
  expect(audit.drain()).toEqual([]);
});

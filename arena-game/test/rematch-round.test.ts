import { expect, it } from 'vitest';
import { getMap } from '../shared/arenaMap.ts';
import { Match } from '../shared/match.ts';
import { COUNTDOWN_TICKS, MATCH_TICKS } from '../shared/content.ts';
import { startOffline } from '../src/session.ts';

function dirtyRound(match: Match) {
  match.phase = 'ended'; match.phaseT = 0; match.score = { A: 7, B: 4 };
  for (const slot of match.slots.values()) { slot.kills = 5; slot.deaths = 3; slot.respawn = 120; slot.state.alive = false; slot.state.hp = 0; slot.state.meleeWindup = 12; }
  match.shields.push({ id: 19, owner: 'a', team: 'A', x: 0, y: 0, z: 0, yaw: 0, hp: 10, life: 100 });
}
function cleanRound(match: Match) {
  const snap = match.snapshot();
  expect(snap.phase).toBe('countdown'); expect(snap.phaseT).toBe(COUNTDOWN_TICKS);
  expect(snap.score).toEqual({ A: 0, B: 0 }); expect(snap.shields).toEqual([]);
  expect(snap.players.every((p) => p.kills === 0 && p.deaths === 0 && p.alive && p.hp > 0 && p.meleeWindup === 0)).toBe(true);
}
it('immediately clears previous-round scores and combat state before countdown, idempotently across two rematches', () => {
  const match = new Match(getMap('aster'), '1v1');
  match.addPlayer('a', { name: 'Keep name', team: 'A', char: 0, skins: [1], loadout: ['longnight', 'firefly', 'hammer'], bot: false });
  match.addPlayer('b', { name: 'Opponent', team: 'B', char: 1, skins: [], bot: false });
  for (let round = 0; round < 2; round++) {
    dirtyRound(match); match.rematch(); cleanRound(match);
    for (let t = 0; t < 10; t++) match.step();
    const remaining = match.phaseT; match.rematch(); match.rematch();
    expect(match.phaseT).toBe(remaining); expect(match.snapshot().events.some((e) => e.t === 'phase')).toBe(false);
    while (match.phase === 'countdown') match.step();
    expect(match.phase).toBe('live'); expect(match.phaseT).toBe(MATCH_TICKS);
    expect(match.score).toEqual({ A: 0, B: 0 }); expect(match.player('a')!.loadout).toEqual(['longnight', 'firefly', 'hammer']);
  }
});
it('actual offline session resets round one and round two without replacing its loop or loadout', () => {
  const session = startOffline({ layout: '1v1', team: 'A', name: 'Local', char: 0, skins: [1], loadout: ['halo', 'lumen', 'polearm'] }, 'easy');
  try {
    session.setPaused(true);
    for (let round = 0; round < 2; round++) { dirtyRound(session.match!); session.rematch(); cleanRound(session.match!); }
    expect(session.match!.player(session.id)!.loadout).toEqual(['halo', 'lumen', 'polearm']);
  } finally { session.close(); }
});
it('an opponent leaving a completed room cannot leave old results in waiting or the next joined round', () => {
  const match = new Match(getMap('aster'), '1v1');
  match.addPlayer('a', { name: 'A', team: 'A', char: 0, skins: [], bot: false });
  match.addPlayer('b', { name: 'B', team: 'B', char: 1, skins: [], bot: false });
  dirtyRound(match); match.removePlayer('b'); match.step();
  expect(match.phase).toBe('waiting'); expect(match.score).toEqual({ A: 0, B: 0 });
  expect(match.snapshot().players[0].kills).toBe(0);
  match.addPlayer('c', { name: 'New opponent', team: 'B', char: 1, skins: [], bot: false }); match.step();
  cleanRound(match);
});

import { expect, it } from 'vitest';
import { buildMap, type MapData } from '../shared/map.ts';
import { COUNTDOWN_TICKS, SPAWN_PROTECTION_TICKS, type Loadout } from '../shared/content.ts';
import { BTN } from '../shared/sim.ts';
import { Match } from '../shared/match.ts';
import { RoomCore } from '../shared/room.ts';
import { RULES_VERSION } from '../shared/protocol.ts';
import { distBucket, sanitizeRecord, type MatchRecord } from '../shared/weaponStats.ts';

const flat = buildMap({ mapId: 'stats-range', version: '1', bounds: { min: [-30, -1, -40], max: [30, 10, 30] }, player: { radius: .32, height: 1.8, eyeHeight: 1.65, walkSpeed: 5.2, stepHeight: .28 }, objects: [{ id: 'floor', type: 'box', position: [0, -.1, 0], size: [60, .2, 80], material: '', collision: true, role: 'floor' }], anchors: [{ id: 'a', kind: 'spawn', team: 'west', position: [0, 0, 0] }, { id: 'b', kind: 'spawn', team: 'east', position: [0, 0, -2] }], routes: [] } as MapData);

function liveMatch(stats: boolean, human: Loadout = ['halo', 'lumen', 'blade']) {
  const m = new Match(flat, '1v1');
  if (stats) m.stats.meta = { source: 'offline', botSkill: 'hard', host: 'test' };
  m.addPlayer('you', { name: 'You', team: 'A', char: 0, skins: [], bot: false, loadout: human });
  m.addPlayer('bot', { name: 'Bot', team: 'B', char: 0, skins: [], bot: true, loadout: ['lumen', 'corona', 'blade'] });
  for (let i = 0; i < COUNTDOWN_TICKS + 2 + SPAWN_PROTECTION_TICKS; i++) m.step();
  expect(m.phase).toBe('live');
  const you = m.player('you')!, bot = m.player('bot')!;
  Object.assign(you, { x: 0, y: 0, z: 0 }); Object.assign(bot, { x: 0, y: 0, z: -12 });
  m.step();
  return m;
}

/** Fire (a fresh press) at a target `dist` metres down -z, aiming at `y` on its body, then wait `wait` ticks. */
function fire(m: Match, id: string, dist: number, y: number, wait: number, yaw = 0) {
  const p = m.player(id)!;
  const pitch = -Math.atan2(1.65 - y, dist);
  m.queueInputs(id, [{ seq: p.lastSeq + 1, mx: 0, mz: 0, yaw, pitch, buttons: BTN.FIRE, weapon: 0, view: m.tick }]);
  m.step();
  for (let i = 0; i < wait; i++) { m.queueInputs(id, [{ seq: p.lastSeq + 1, mx: 0, mz: 0, yaw, pitch, buttons: 0, weapon: 0, view: m.tick }]); m.step(); }
}

it('records only the human shooter: shots, hits, heads, damage, kill distance and time-to-kill', () => {
  const m = liveMatch(true);
  fire(m, 'you', 12, 2.1, 22); // just over the head: a miss, but still aimed at the visible bot
  fire(m, 'you', 12, 0.9, 22); // body 52
  fire(m, 'you', 12, 1.6, 22); // head 104 → 156 ≥ 150, dead
  // The bot shoots back after respawning; that shot is never measured as a bot weapon line.
  m.flushStats();
  const [rec] = m.stats.drain() as MatchRecord[];
  expect(rec).toBeDefined();
  expect(rec.result).toBe('abandoned');
  expect(rec.source).toBe('offline');
  expect(rec.humans).toHaveLength(1);
  expect(rec.bots).toEqual([{ team: 'B', char: 0, loadout: ['lumen', 'corona', 'blade'] }]);
  const h = rec.humans[0], halo = h.weapons.halo;
  expect(halo.shots).toBe(3);
  expect(halo.hits).toBe(2);
  expect(halo.heads).toBe(1);
  expect(halo.damage).toBe(150); // capped at the HP actually removed
  expect(halo.kills).toBe(1);
  expect(halo.headKills).toBe(1);
  expect(halo.ttk).toEqual([23]); // first damage to kill: this helper fires every 1 + 22 ticks
  expect(halo.killDist[distBucket(12)]).toBe(1);
  expect(halo.aimed[distBucket(12)][0]).toBe(3);
  expect(halo.aimed[distBucket(12)][1]).toBe(2);
  expect(halo.wild).toBe(0);
  expect(halo.idle).toBe(0);
  expect(halo.held).toBeGreaterThan(60);
  expect(h.kills).toBe(1);
});

it('bot fire counts against the human (damage taken, deaths by weapon) but never as a weapon line', () => {
  const m = liveMatch(true, ['halo', 'lumen', 'blade']);
  // Bot faces +z from z=-12 toward the human at the origin.
  for (let i = 0; i < 60; i++) {
    const b = m.player('bot')!;
    m.queueInputs('bot', [{ seq: b.lastSeq + 1, mx: 0, mz: 0, yaw: Math.PI, pitch: -Math.atan2(1.65 - 1.6, 12), buttons: BTN.FIRE, weapon: 0, view: m.tick }]);
    m.step();
    if (!m.player('you')!.alive) break;
  }
  m.flushStats();
  const [rec] = m.stats.drain();
  const h = rec.humans[0];
  expect(h.damageTaken).toBe(150);
  expect(h.deaths).toBe(1);
  expect(h.deathsBy).toEqual({ lumen: 1 });
  expect(Object.keys(h.weapons)).toEqual(['halo']); // only what the human held
});

it('is off without a host opt-in, and a finished round is recorded once', () => {
  const off = liveMatch(false);
  fire(off, 'you', 12, 0.9, 5);
  off.flushStats();
  expect(off.stats.drain()).toEqual([]);

  const core = new RoomCore({ layout: '1v1', bots: true }, 'online');
  expect(core.match.stats.meta).toEqual({ source: 'online', botSkill: 'normal' });
  expect(new RoomCore({ layout: '1v1' }).match.stats.meta).toBeNull();
});

it('rebuilds network records from known fields only', () => {
  expect(sanitizeRecord({ v: 99, humans: [{}] }, 'offline')).toBeNull();
  expect(sanitizeRecord({ v: 1, humans: [] }, 'offline')).toBeNull();
  const r = sanitizeRecord({
    v: 1, at: 5, source: 'online', host: 'local<script>host', map: 'aster', layout: '9v9', botSkill: 'hard', ticks: -4, result: 'finished', winner: 'A',
    humans: [{ team: 'B', char: 7, loadout: ['halo', 'halo', 'blade'], weapons: { halo: { shots: 3.6, hits: -1, aimed: [[2, 1]], ttk: [12, 'x'] }, railgun: { shots: 9 } }, deathsBy: { frag: 2, laser: 1 } }],
  }, 'offline')!;
  expect(r.source).toBe('offline'); // the transport decides, not the sender
  expect(r.host).toBe('localscripthost');
  expect(r.layout).toBe('1v1');
  expect(r.ticks).toBe(0);
  expect(r.humans[0].char).toBe(1);
  expect(r.humans[0].loadout).toEqual(['lumen', 'corona', 'blade']);
  expect(Object.keys(r.humans[0].weapons)).toEqual(['halo']);
  expect(r.humans[0].weapons.halo.shots).toBe(4);
  expect(r.humans[0].weapons.halo.hits).toBe(0);
  expect(r.humans[0].weapons.halo.aimed[0]).toEqual([2, 1]);
  expect(r.humans[0].weapons.halo.ttk).toEqual([12, 0]);
  expect(r.humans[0].deathsBy).toEqual({ frag: 2 });
});

it('the last human leaving a bot room closes the round before a bot refills the seat', () => {
  const core = new RoomCore({ layout: '1v1', bots: true, map: 'aster' }, 'online');
  core.join('h1', { rulesVersion: RULES_VERSION, layout: '1v1', team: 'A', name: 'H', char: 1, skins: [], loadout: ['firefly', 'halo', 'hammer'] });
  for (let i = 0; i < COUNTDOWN_TICKS + 120; i++) core.step();
  expect(core.match.phase).toBe('live');
  core.leave('h1');
  const records = core.match.stats.drain();
  expect(records).toHaveLength(1);
  expect(records[0].bots).toHaveLength(1);
  expect(records[0].humans[0]).toMatchObject({ team: 'A', char: 1, loadout: ['firefly', 'halo', 'hammer'] });
  expect(records[0].humans[0].weapons.firefly.held).toBeGreaterThan(100);
  for (let i = 0; i < 300; i++) core.step();
  expect(core.match.stats.drain()).toEqual([]); // bots alone are never recorded
});

it('shots while every enemy is dead count as idle, not as wild misses', () => {
  const m = liveMatch(true, ['halo', 'lumen', 'blade']);
  fire(m, 'you', 12, 0.9, 22); fire(m, 'you', 12, 0.9, 22); fire(m, 'you', 12, 1.6, 22); // 52 + 52 + 104: dead
  expect(m.player('bot')!.alive).toBe(false);
  fire(m, 'you', 12, 0.9, 22); // into the empty respawn wait
  m.player('bot')!.alive = true; Object.assign(m.player('bot')!, { x: 20, z: 0 }); m.step();
  fire(m, 'you', 12, 0.9, 22); // a living enemy, but off to the side
  m.flushStats();
  const halo = m.stats.drain()[0].humans[0].weapons.halo;
  expect(halo.idle).toBe(1);
  expect(halo.wild).toBe(1);
});

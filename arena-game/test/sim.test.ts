import { describe, expect, it } from 'vitest';
import { ARENA_MAP } from '../shared/arenaMap.ts';
import { Bot, BOT_SKILL } from '../shared/bot.ts';
import { TICK_HZ, WEAPONS } from '../shared/content.ts';
import { rayPlayer } from '../shared/hit.ts';
import { groundAt, lineOfSight, raycastMap } from '../shared/map.ts';
import { Match } from '../shared/match.ts';
import { NavGrid } from '../shared/nav.ts';
import { applyInput, BTN, clonePlayer, newPlayer, type Input } from '../shared/sim.ts';

const m = ARENA_MAP;
const inp = (seq: number, o: Partial<Input> = {}): Input =>
  ({ seq, mx: 0, mz: 0, yaw: 0, pitch: 0, buttons: 0, weapon: 0, view: 0, ...o });

function spawned(x: number, z: number, yaw = 0) {
  const p = newPlayer('p', 'A', 0);
  Object.assign(p, { x, y: groundAt(m, x, z, 10), z, yaw, alive: true });
  return p;
}

describe('map', () => {
  it('ground and ramps', () => {
    expect(groundAt(m, 0, 20, 0)).toBeCloseTo(0);
    expect(groundAt(m, 0, -18, 3)).toBeCloseTo(3); // gallery deck
    expect(groundAt(m, 0, -18, 0)).toBeCloseTo(0); // floor under the deck
    const mid = groundAt(m, -17, -18, 3); // west ramp centre
    expect(mid).toBeGreaterThan(1.2);
    expect(mid).toBeLessThan(1.8);
  });
  it('raycast hits walls and ramps, LOS blocked by reactor', () => {
    expect(raycastMap(m, [0, 1.6, 20], [0, 0, 1], 100)).toBeCloseTo(28 - 0.25 - 20, 3);
    expect(lineOfSight(m, [0, 1.6, -4], [0, 1.6, 6])).toBe(false);
    // looking down onto the west ramp from above hits its sloped surface, not its bounding box
    const t = raycastMap(m, [-17, 10, -18], [0, -1, 0], 20);
    expect(10 - t).toBeCloseTo(groundAt(m, -17, -18, 3), 2);
  });
});

describe('applyInput', () => {
  it('walks forward and stops at the outer wall', () => {
    const p = spawned(0, 20, Math.PI); // face +Z (south)
    for (let i = 1; i <= 5 * TICK_HZ; i++) applyInput(m, p, inp(i, { mz: 1, yaw: Math.PI }));
    expect(p.z).toBeGreaterThan(27);
    expect(p.z).toBeLessThan(28 - 0.25 - 0.3);
  });
  it('climbs the central ramp onto the gallery', () => {
    const p = spawned(0, -3, 0);
    for (let i = 1; i <= 150; i++) applyInput(m, p, inp(i, { mz: 1 }));
    expect(p.y).toBeCloseTo(3, 1);
    expect(p.z).toBeLessThan(-14);
  });
  it('jump arcs and lands', () => {
    const p = spawned(0, 20);
    applyInput(m, p, inp(1, { buttons: BTN.JUMP }));
    expect(p.y).toBeGreaterThan(0);
    for (let i = 2; i < 120; i++) applyInput(m, p, inp(i));
    expect(p.y).toBe(0);
    expect(p.grounded).toBe(true);
  });
  it('dash moves ~2.5 m and then cools down', () => {
    const p = spawned(0, 20, Math.PI);
    applyInput(m, p, inp(1, { yaw: Math.PI, buttons: BTN.DASH }));
    for (let i = 2; i <= 12; i++) applyInput(m, p, inp(i, { yaw: Math.PI }));
    expect(p.z - 20).toBeGreaterThan(2.2);
    expect(p.dashCd).toBeGreaterThan(0);
  });
  it('fire consumes ammo, respects interval and auto-reloads', () => {
    const p = spawned(0, 20);
    let shots = 0;
    for (let i = 1; i <= 400; i++) shots += applyInput(m, p, inp(i, { buttons: BTN.FIRE })).filter((e) => e.type === 'fire').length;
    const w = WEAPONS[0];
    expect(shots).toBeGreaterThan(w.mag);
    expect(shots).toBeLessThan(400 / w.interval + 1);
  });
  it('semi-auto needs a fresh press', () => {
    const p = spawned(0, 20);
    p.loadout = ['halo', 'lumen', 'blade']; p.weapon = 2;
    let shots = 0;
    for (let i = 1; i <= 120; i++) shots += applyInput(m, p, inp(i, { weapon: 0, buttons: BTN.FIRE })).filter((e) => e.type === 'fire').length;
    expect(shots).toBe(1);
  });
  it('is deterministic: replaying the same inputs gives the same state', () => {
    const inputs: Input[] = [];
    for (let i = 1; i <= 600; i++) inputs.push(inp(i, { mx: (i >> 5) % 3 - 1, mz: 1, yaw: i * 0.01, buttons: (i % 50 === 0 ? BTN.JUMP : 0) | (i % 7 === 0 ? BTN.FIRE : 0) | (i === 300 ? BTN.DASH : 0) }));
    const a = spawned(-30, 0), b = clonePlayer(a);
    for (const i of inputs) applyInput(m, a, i);
    for (const i of inputs) applyInput(m, b, i);
    expect(b).toEqual(a);
  });
});

describe('hits', () => {
  it('head vs body', () => {
    expect(rayPlayer([0, 1.6, 10], [0, 0, -1], 0, 0, 0)?.head).toBe(true);
    expect(rayPlayer([0, 1.0, 10], [0, 0, -1], 0, 0, 0)?.head).toBe(false);
    expect(rayPlayer([2, 1.0, 10], [0, 0, -1], 0, 0, 0)).toBeNull();
  });
});

describe('match', () => {
  it('enforces team capacity per layout', () => {
    const match = new Match(m, '1v2');
    match.addPlayer('a', { name: 'a', team: 'A', char: 0, skins: [], bot: false });
    expect(() => match.addPlayer('a2', { name: 'a2', team: 'A', char: 0, skins: [], bot: false })).toThrow();
    match.addPlayer('b1', { name: 'b1', team: 'B', char: 0, skins: [], bot: false });
    match.addPlayer('b2', { name: 'b2', team: 'B', char: 1, skins: [], bot: false });
    expect(match.autoTeam()).toBeNull();
  });
  it('server-side hitscan kills and scores', () => {
    const match = new Match(m, '1v1');
    match.addPlayer('a', { name: 'a', team: 'A', char: 0, skins: [], bot: false });
    match.addPlayer('b', { name: 'b', team: 'B', char: 0, skins: [], bot: false });
    for (let i = 0; i < 350; i++) match.step(); // countdown -> live -> spawn protection expired
    expect(match.phase).toBe('live');
    const a = match.player('a')!, b = match.player('b')!;
    Object.assign(a, { x: 0, y: 0, z: 20 });
    Object.assign(b, { x: 0, y: 0, z: 26 });
    let seq = a.lastSeq;
    for (let i = 0; i < 120; i++) {
      match.queueInputs('a', [inp(++seq, { yaw: Math.PI, weapon: 0, buttons: BTN.FIRE, view: match.tick })]);
      match.step();
    }
    expect(b.alive).toBe(false);
    expect(match.score.A).toBe(1);
    const snap = match.snapshot();
    expect(snap.events.some((e) => e.t === 'kill')).toBe(true);
  });
  it('bots find each other and fight to kills on the real map', () => {
    const match = new Match(m, '2v2');
    let seed = 1;
    for (const t of ['A', 'A', 'B', 'B'] as const) {
      match.addPlayer(`bot${seed}`, { name: `bot${seed}`, team: t, char: seed % 2, skins: [], bot: true }, new Bot(seed++, BOT_SKILL.normal));
    }
    for (let i = 0; i < 90 * TICK_HZ; i++) match.step();
    const kills = match.score.A + match.score.B;
    expect(kills).toBeGreaterThan(2);
  }, 60000);
});

describe('nav', () => {
  it('connects both spawns via floor and gallery', () => {
    const nav = new NavGrid(m);
    const a = nav.nearest(-32, 0, -1.5)!, b = nav.nearest(32, 0, -1.5)!, deck = nav.nearest(0, 3, -18)!;
    expect(deck.y).toBeCloseTo(3, 1);
    expect(nav.path(a, b)).not.toBeNull();
    expect(nav.path(a, deck)).not.toBeNull();
  });
});

describe('match end', () => {
  it('holds on the results until rematch(), then counts down again', () => {
    const match = new Match(m, '1v1');
    match.addPlayer('a', { name: 'a', team: 'A', char: 0, skins: [], bot: true }, new Bot(1, BOT_SKILL.hard));
    match.addPlayer('b', { name: 'b', team: 'B', char: 0, skins: [], bot: true }, new Bot(2, BOT_SKILL.hard));
    let t = 0;
    while (match.phase !== 'ended' && t++ < 400 * TICK_HZ) match.step();
    expect(match.phase).toBe('ended');
    for (let i = 0; i < 30 * TICK_HZ; i++) match.step();
    expect(match.phase).toBe('ended'); // no automatic next match
    match.rematch();
    expect(match.phase).toBe('countdown');
  }, 60000);
});

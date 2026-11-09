import { describe, expect, it } from 'vitest';
import { CHARACTERS, FRAG_KILL, TICK_HZ, WEAPONS, weaponIndex } from '../shared/content.ts';
import { groundAt, lineOfSight } from '../shared/map.ts';
import { Match } from '../shared/match.ts';
import { MAPS } from '../shared/arenaMap.ts';
import { POSTS, POST_YAW, DUMMY_RESPAWN_TICKS, RANGE_DATA, applyPracticeLoadout, getRangeMap, resetDummies, setupRange } from '../shared/trainingRange.ts';
import { startRange } from '../src/network/session.ts';
import { RangeStats } from '../src/ui/rangeStats.ts';

const range = () => {
  const m = new Match(getRangeMap(), '1v1'); setupRange(m);
  m.addPlayer('you', { name: 'you', team: 'A', char: 0, skins: [], bot: false });
  return m;
};

describe('the range map', () => {
  it('is an offline-only map: never offered to online rooms or the lobby map list', () => {
    expect(MAPS.some((m) => m.id === 'range' || m.data === RANGE_DATA)).toBe(false);
  });
  it('every post stands on the floor, inside the hall, and is visible from the firing line (except the pit)', () => {
    const m = getRangeMap(), eye: [number, number, number] = [RANGE_DATA.range.firingLine - 1, 1.65, 0];
    for (const post of POSTS) {
      expect(groundAt(m, post.at[0], post.at[2], 1)).toBeCloseTo(0, 3);
      expect(Math.abs(post.at[0])).toBeLessThan(37); expect(Math.abs(post.at[2])).toBeLessThan(22);
      const chest: [number, number, number] = [post.at[0], 1.1, post.at[2]];
      if (post.kind === 'pit' || post.kind === 'peek') continue;
      expect(lineOfSight(m, [eye[0], eye[1], post.at[2]], chest), post.id).toBe(true);
    }
    const pit = POSTS.find((p) => p.kind === 'pit')!;
    expect(lineOfSight(m, [eye[0], 1.65, pit.at[2]], [pit.at[0], 1.1, pit.at[2]])).toBe(false); // the bunker wall hides it
  });
  it('static targets sit at their marked distances from the firing line', () => {
    for (const d of RANGE_DATA.range.distances) expect(POSTS.find((p) => p.id === `static-${d}`)!.at[0] - RANGE_DATA.range.firingLine).toBe(d);
  });
});

describe('a practice match', () => {
  it('seats every dummy on its post facing the firing line, and never ends', () => {
    const m = range();
    expect(m.slots.size).toBe(POSTS.length + 1);
    for (const post of POSTS) { const p = m.player(`dummy-${post.id}`)!; expect([p.x, p.z]).toEqual([post.at[0], post.at[2]]); expect(p.yaw).toBe(POST_YAW); }
    for (let i = 0; i < 12 * 60 * TICK_HZ; i += 1) m.step();
    expect(m.phase).toBe('live');
  });
  it('dummies never fire, and a killed dummy is back on its post at full health a second later', () => {
    const m = range(); for (let i = 0; i < 10; i++) m.step();
    const shots = (n: number) => { let k = 0; for (let i = 0; i < n; i++) { m.step(); k += m.snapshot().events.filter((e) => e.t === 'shot' || e.t === 'meleeStart').length; } return k; };
    expect(shots(300)).toBe(0);
    const id = 'dummy-static-20', slot = m.slots.get(id)!;
    (m as unknown as { damage(from: unknown, v: string, d: number, h: boolean, w: number): void }).damage(m.slots.get('you'), id, 999, false, FRAG_KILL);
    expect(slot.state.alive).toBe(false);
    for (let i = 0; i < DUMMY_RESPAWN_TICKS + 1; i++) m.step();
    expect(slot.state.alive).toBe(true); expect(slot.state.hp).toBe(CHARACTERS[slot.state.char].hp);
    expect([slot.state.x, slot.state.z]).toEqual([POSTS.find((p) => `dummy-${p.id}` === id)!.at[0], POSTS.find((p) => `dummy-${p.id}` === id)!.at[2]]);
  });
  it('the strafing dummy paces its lane and the peeker ducks behind cover', () => {
    const m = range(); const strafe = m.player('dummy-strafe-15')!, peek = m.player('dummy-peek-20')!;
    let minZ = Infinity, maxZ = -Infinity, crouched = 0;
    for (let i = 0; i < 600; i++) { m.step(); minZ = Math.min(minZ, strafe.z); maxZ = Math.max(maxZ, strafe.z); if (peek.crouched) crouched++; }
    expect(maxZ - minZ).toBeGreaterThan(2); expect(maxZ - minZ).toBeLessThan(7);
    expect(crouched).toBeGreaterThan(150); expect(crouched).toBeLessThan(450);
    // From the firing line the cover hides a crouched head and shows a standing one.
    const eye: [number, number, number] = [RANGE_DATA.range.firingLine, 1.65, peek.z];
    expect(lineOfSight(getRangeMap(), eye, [peek.x, 1.0, peek.z])).toBe(false);
    expect(lineOfSight(getRangeMap(), eye, [peek.x, 1.6, peek.z])).toBe(true);
  });
  it('the shield dummy keeps a shield up', () => {
    const m = range(); let seen = 0; for (let i = 0; i < 900; i++) { m.step(); if (m.shields.some((s) => s.owner === 'dummy-shield-25')) seen++; }
    expect(seen).toBeGreaterThanOrEqual(600); // a 10 s shield on a 14 s cooldown: up about 70% of the time
  });
  it('weapons, finishes and grenade swap live; invalid choices are refused; reset returns every dummy', () => {
    const m = range(), skins = WEAPONS.map((w) => w.skins.length - 1);
    expect(applyPracticeLoadout(m, 'you', { loadout: ['longnight', 'firefly', 'hammer'], utility: 'smoke', skins })).toBe(true);
    const p = m.player('you')!; expect(p.loadout).toEqual(['longnight', 'firefly', 'hammer']); expect(p.utility).toBe('smoke'); expect(p.weapon).toBe(weaponIndex('longnight'));
    expect(m.snapshot().players.find((q) => q.id === 'you')!.skins).toEqual(skins);
    expect(() => applyPracticeLoadout(m, 'you', { loadout: ['firefly', 'firefly', 'hammer'], utility: 'smoke', skins })).toThrow();
    const d = m.player('dummy-static-10')!; d.x += 5; d.hp = 1; resetDummies(m);
    expect(d.x).toBe(POSTS[0].at[0]); expect(d.hp).toBe(CHARACTERS[d.char].hp);
  });
  it('startRange runs a local session with practice controls', () => {
    const s = startRange({ layout: '1v1', team: 'A', name: 'me', char: 0, skins: [], loadout: ['lumen', 'halo', 'blade'], utility: 'frag' });
    expect(s.online).toBe(false); expect(s.practice).toBeDefined(); expect(s.match!.practice).not.toBeNull();
    expect(s.practice!.apply({ loadout: ['corona', 'halo', 'polearm'], utility: 'frag', skins: [] })).toBe(true);
    s.close();
  });
});

it('range stats measure accuracy, headshots, DPS and time to kill from match events', () => {
  const st = new RangeStats();
  st.event({ t: 'shot', id: 'me', w: 0, from: [0, 0, 0], to: [] }, 'me', 0);
  st.event({ t: 'shot', id: 'me', w: 0, from: [0, 0, 0], to: [] }, 'me', .1);
  st.event({ t: 'shot', id: 'bot', w: 0, from: [0, 0, 0], to: [] }, 'me', .1);
  st.event({ t: 'hit', shooter: 'me', victim: 'd', dmg: 60, head: true }, 'me', .5);
  st.event({ t: 'hit', shooter: 'me', victim: 'd', dmg: 90, head: false }, 'me', 1.25);
  st.event({ t: 'kill', killer: 'me', victim: 'd', w: 0, head: false }, 'me', 1.25);
  expect(st.shots).toBe(2); expect(st.hits).toBe(2); expect(st.heads).toBe(1); expect(st.kills).toBe(1);
  expect(st.lastTtk).toBeCloseTo(.75, 6); expect(st.dps(1.5)).toBeCloseTo(50, 6); expect(st.dps(10)).toBe(0);
  expect(st.render(1.5)).toContain('100%'); st.reset(); expect(st.kills).toBe(0);
});
